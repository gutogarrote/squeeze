// Build substitutes these values; this source is never served in development.
const CACHE_PREFIX = 'squeeze-shell-';
const CACHE_NAME = CACHE_PREFIX + '__BUILD_VERSION__';
const PRECACHE = /* __PRECACHE__ */ [];
const ASSET_PATHS = new Set(PRECACHE.map(asset => asset.url));
let development = false;

self.addEventListener('install', event => {
  // Integrity prevents mixed deployments and SPA fallbacks entering the shell.
  // Failed installation leaves the current worker and its cache usable.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    PRECACHE.map(asset => new Request(asset.url, { cache: 'no-store', integrity: asset.integrity }))
  )));
});

self.addEventListener('activate', event => {
  // Earlier shells remain available to tabs still requesting their hashed assets.
  // Never touch localStorage, and never force another tab to reload.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') event.waitUntil(self.skipWaiting());
});

async function shell(request) {
  // Pin navigations to this release, including while an update is waiting.
  // The sole exception is a live Vite development server on this same origin.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.headers.get('X-Squeeze-Dev') === '1') {
      development = true;
      await self.registration.unregister();
      return response;
    }
  } catch (_) { /* Offline navigations use the same canonical shell. */ }
  finally { clearTimeout(timeout); }
  const cached = await (await caches.open(CACHE_NAME)).match('/index.html');
  // Workers Static Assets redirects /index.html to /. A redirected cached
  // response cannot satisfy every navigation redirect mode; copy its bytes.
  return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers: cached.headers });
}

async function assetResponse(path) {
  const cached = await (await caches.open(CACHE_NAME)).match(path);
  if (cached) return cached;
  // Only content-addressed assets may come from an earlier release.
  // Stable names always belong to the active shell.
  if (path.startsWith('/assets/')) {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) {
        const previous = await (await caches.open(name)).match(path);
        if (previous) return previous;
      }
    }
  }
  return fetch(path);
}

async function withRange(response, range) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range || '');
  if (!match || (!match[1] && !match[2])) return response;
  const bytes = await response.arrayBuffer();
  const start = match[1] ? Number(match[1]) : Math.max(0, bytes.byteLength - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
  if (start > end || start >= bytes.byteLength) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.byteLength}` } });
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${bytes.byteLength}`);
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (development || request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Documentation must remain a real static response, never the application shell.
  if (['/instrucoes', '/instrucoes/', '/instrucoes/index.html', '/instrucoes.md'].includes(url.pathname)) return;
  if (request.mode === 'navigate') {
    // No route/query is a cache key: custom routines stay entirely in the client.
    event.respondWith(shell(request));
  } else if (ASSET_PATHS.has(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(assetResponse(url.pathname).then(response => withRange(response, request.headers.get('Range'))));
  }
});
