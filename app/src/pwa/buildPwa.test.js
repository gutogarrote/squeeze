// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPwa } from './buildPwa.mjs';

let root;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'squeeze-pwa-'));
  await mkdir(join(root, 'build/assets'), { recursive: true });
  await writeFile(join(root, 'build/index.html'), 'shell');
  await writeFile(join(root, 'build/assets/bundle-hash.js'), 'code');
  await writeFile(join(root, 'build/manifest.json'), '{}');
  await writeFile(join(root, 'build/_headers'), 'headers');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function generate() {
  const plugin = buildPwa();
  plugin.configResolved({ root, build: { outDir: 'build' } });
  await plugin.closeBundle();
  return readFile(join(root, 'build/sw.js'), 'utf8');
}

test('build emits integrity for every static shell asset and is deterministic on repeated builds', async () => {
  const first = await generate();
  expect(first).toContain('/assets/bundle-hash.js');
  expect(first).toContain('sha256-' + createHash('sha256').update('shell').digest('base64'));
  expect(first).not.toContain('__BUILD_VERSION__');
  expect(first).not.toContain('__PRECACHE__');
  expect(first).not.toContain('"url":"/sw.js"');
  expect(first).not.toContain('"url":"/_headers"');
  expect(await generate()).toBe(first);
});

test('a changed stable-name file changes the worker even if the hashed bundle stays the same', async () => {
  const first = await generate();
  await writeFile(join(root, 'build/manifest.json'), '{"name":"changed"}');
  expect(await generate()).not.toBe(first);
});

test('documentation stays outside the app precache and does not change its version', async () => {
  const first = await generate();
  await mkdir(join(root, 'build/instrucoes'));
  await writeFile(join(root, 'build/instrucoes/index.html'), 'complete static instructions');
  await writeFile(join(root, 'build/instrucoes.md'), 'canonical markdown');
  expect(await generate()).toBe(first);
});
