import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { vi } from 'vitest';

const origin = 'https://example.test';
const source = readFileSync('src/pwa/service-worker.js', 'utf8');
const currentName = 'squeeze-shell-test';

function worker() {
  const listeners = {};
  const stores = new Map();
  const cache = entries => ({
    addAll: vi.fn().mockResolvedValue(),
    match: vi.fn(async path => entries.get(path)?.clone()),
  });
  stores.set(currentName, cache(new Map([
    ['/index.html', new Response('shell v2')],
    ['/routines.json', new Response('defaults v2')],
    ['/assets/new-hash.js', new Response('new code')],
    ['/sounds/test.mp3', new Response('0123456789', { headers: { 'Content-Type': 'audio/mpeg' } })],
  ])));
  stores.set('squeeze-shell-old', cache(new Map([
    ['/index.html', new Response('shell v1')],
    ['/routines.json', new Response('defaults v1')],
    ['/assets/old-hash.js', new Response('old code')],
  ])));
  stores.set('unrelated-cache', cache(new Map([['/assets/foreign.js', new Response('foreign')]])));
  const caches = {
    open: vi.fn(async name => stores.get(name)),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(),
  };
  const self = {
    location: { origin },
    clients: { claim: vi.fn().mockResolvedValue() },
    registration: { unregister: vi.fn().mockResolvedValue(true) },
    skipWaiting: vi.fn().mockResolvedValue(),
    addEventListener: (type, handler) => { listeners[type] = handler; },
  };
  // Node Request requires an absolute URL, unlike a worker's relative Request.
  class WorkerRequest extends Request {
    constructor(url, options) { super(new URL(url, origin), options); }
  }
  const fetch = vi.fn().mockRejectedValue(new Error('offline'));
  const assets = ['/index.html', '/routines.json', '/assets/new-hash.js', '/sounds/test.mp3']
    .map(url => ({ url, integrity: 'sha256-test' }));
  runInNewContext(source.replace('__BUILD_VERSION__', 'test').replace('/* __PRECACHE__ */ []', JSON.stringify(assets)), {
    self, caches, fetch, Request: WorkerRequest, Response, Headers, URL, AbortController, setTimeout, clearTimeout,
  });
  function request(path, options = {}) {
    let response;
    const event = {
      request: { url: new URL(path, origin).href, method: 'GET', mode: 'cors', headers: new Headers(), ...options },
      respondWith: promise => { response = promise; },
    };
    listeners.fetch(event);
    return response;
  }
  return { listeners, stores, caches, self, fetch, request };
}

test('installs only canonical assets with no-store and integrity; never skips waiting on install', async () => {
  const env = worker();
  let installation;
  env.listeners.install({ waitUntil: promise => { installation = promise; } });
  await installation;
  const requests = env.stores.get(currentName).addAll.mock.calls[0][0];
  expect(requests).toHaveLength(4);
  expect(requests.every(request => !new URL(request.url).search && request.cache === 'no-store' && request.integrity === 'sha256-test')).toBe(true);
  expect(env.self.skipWaiting).not.toHaveBeenCalled();
});

test('failed precache rejects installation and leaves earlier shell and unrelated caches intact', async () => {
  const env = worker();
  env.stores.get(currentName).addAll.mockRejectedValue(new Error('integrity mismatch'));
  let installation;
  env.listeners.install({ waitUntil: promise => { installation = promise; } });
  await expect(installation).rejects.toThrow('integrity mismatch');
  expect(await (await env.stores.get('squeeze-shell-old').match('/index.html')).text()).toBe('shell v1');
  expect(env.caches.delete).not.toHaveBeenCalled();
  expect(env.self.skipWaiting).not.toHaveBeenCalled();
});

test.each(['/0720', '/?rotina=private-family-link', '/custom/path?rotina=another'])('offline navigation %s uses canonical SPA shell without storing private URLs', async path => {
  const env = worker();
  expect(await (await env.request(path, { mode: 'navigate' })).text()).toBe('shell v2');
  expect(env.stores.get(currentName).addAll).not.toHaveBeenCalled();
  expect(env.stores.get(currentName).match).toHaveBeenCalledWith('/index.html');
});

test('online navigation keeps the active version even if origin already serves a new build', async () => {
  const env = worker();
  env.fetch.mockResolvedValue(new Response('unapproved new shell'));
  expect(await (await env.request('/0720', { mode: 'navigate' })).text()).toBe('shell v2');
});

test('live Vite navigation retires the production registration and serves development HTML', async () => {
  const env = worker();
  env.fetch.mockResolvedValue(new Response('vite client', { headers: { 'X-Squeeze-Dev': '1' } }));
  expect(await (await env.request('/', { mode: 'navigate' })).text()).toBe('vite client');
  expect(env.self.registration.unregister).toHaveBeenCalledOnce();
  expect(env.request('/routines.json')).toBeUndefined();
});

test('timestamped defaults use canonical current defaults and never an old release', async () => {
  const env = worker();
  expect(await (await env.request('/routines.json?v=123')).text()).toBe('defaults v2');
  expect(env.fetch).not.toHaveBeenCalled();
});

test('old tabs can load their hashed assets after another tab accepts the update', async () => {
  const env = worker();
  expect(await (await env.request('/assets/old-hash.js')).text()).toBe('old code');
  expect(await (await env.request('/assets/new-hash.js')).text()).toBe('new code');
  expect(env.fetch).not.toHaveBeenCalled();
});

test('unrelated cache is never used for missing assets', async () => {
  const env = worker();
  await expect(env.request('/assets/foreign.js')).rejects.toThrow('offline');
});

test.each([
  ['https://other.test/index.html', {}],
  ['/routines.json', { method: 'POST' }],
  ['/unknown?private=value', {}],
])('does not intercept arbitrary or cross-origin requests: %s', (path, options) => {
  expect(worker().request(path, options)).toBeUndefined();
});

test.each([
  ['bytes=2-5', 206, '2345', 'bytes 2-5/10'],
  ['bytes=-3', 206, '789', 'bytes 7-9/10'],
  ['bytes=7-', 206, '789', 'bytes 7-9/10'],
  ['bytes=9-50', 206, '9', 'bytes 9-9/10'],
  ['bytes=20-', 416, '', 'bytes */10'],
])('offline media range %s is correctly served', async (range, status, body, contentRange) => {
  const response = await worker().request('/sounds/test.mp3', { headers: new Headers({ Range: range }) });
  expect(response.status).toBe(status);
  expect(await response.text()).toBe(body);
  expect(response.headers.get('Content-Range')).toBe(contentRange);
});

test('activation preserves caches and only an explicit message skips waiting', async () => {
  const env = worker();
  let activation;
  env.listeners.activate({ waitUntil: promise => { activation = promise; } });
  await activation;
  expect(env.self.clients.claim).toHaveBeenCalledOnce();
  expect(env.caches.delete).not.toHaveBeenCalled();
  env.listeners.message({ data: { type: 'OTHER' } });
  expect(env.self.skipWaiting).not.toHaveBeenCalled();
  let update;
  env.listeners.message({ data: { type: 'APPLY_UPDATE' }, waitUntil: promise => { update = promise; } });
  await update;
  expect(env.self.skipWaiting).toHaveBeenCalledOnce();
});
// @vitest-environment node

test('canonical shell normalizes a redirected cached index for navigation redirect modes', async () => {
  const env = worker();
  const redirected = new Response('shell after index redirect', { headers: { 'Content-Type': 'text/html' } });
  Object.defineProperty(redirected, 'redirected', { value: true });
  env.stores.get(currentName).match.mockResolvedValueOnce(redirected);
  const response = await env.request('/0720', { mode: 'navigate' });
  expect(response.redirected).toBe(false);
  expect(response.headers.get('Content-Type')).toBe('text/html');
  expect(await response.text()).toBe('shell after index redirect');
});


test.each(['/instrucoes', '/instrucoes/', '/instrucoes/index.html', '/instrucoes.md'])('documentation %s bypasses the app shell for navigation and fetch', path => {
  const env = worker();
  expect(env.request(path, { mode: 'navigate' })).toBeUndefined();
  expect(env.request(path)).toBeUndefined();
  expect(env.fetch).not.toHaveBeenCalled();
});

test('0630 shortcut still receives the pinned application shell', async () => {
  const env = worker();
  expect(await (await env.request('/0630', { mode: 'navigate' })).text()).toBe('shell v2');
});
