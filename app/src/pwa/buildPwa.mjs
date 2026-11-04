import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Run after Vite has written both fingerprinted bundles and public assets.
export function buildPwa() {
  let output;
  return {
    name: 'squeeze-pwa',
    apply: 'build',
    configResolved(config) { output = resolve(config.root, config.build.outDir); },
    async closeBundle() {
      const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
      const assets = [];
      async function scan(directory, prefix = '') {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const path = `${prefix}/${entry.name}`;
          // Documentation is served independently, outside the application offline shell.
          if (path === '/instrucoes') continue;
          if (entry.isDirectory()) await scan(resolve(directory, entry.name), path);
          else if (/\.(html|js|css|json|png|ico|svg|mp3|woff2)$/.test(path) && path !== '/sw.js') {
            const bytes = await readFile(resolve(directory, entry.name));
            assets.push({ url: path, integrity: `sha256-${createHash('sha256').update(bytes).digest('base64')}` });
          }
        }
      }
      await scan(output);
      assets.sort((a, b) => a.url.localeCompare(b.url));
      const version = createHash('sha256').update(template).update(JSON.stringify(assets)).digest('hex').slice(0, 20);
      await writeFile(resolve(output, 'sw.js'), template
        .replace('__BUILD_VERSION__', version)
        .replace('/* __PRECACHE__ */ []', JSON.stringify(assets)));
    },
  };
}

// A controlled preview origin can be reused for Vite development.
export function developmentHeader() {
  return {
    name: 'squeeze-development',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        response.setHeader('X-Squeeze-Dev', '1');
        next();
      });
    },
  };
}
