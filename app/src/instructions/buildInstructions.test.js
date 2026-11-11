// @vitest-environment node
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { buildInstructions, canonicalDocument, instructionsAssets, renderInstructions } from './buildInstructions.mjs';
import { parseRoutineLink, serializeRoutineLink } from '../lib/routineLink';

const doc = await readFile(canonicalDocument, 'utf8');
const expectedExamples = [
  ['Tarde', '15:00', [['Orçamento', 60], ['Guardar equipamentos', 20], ['Banho e troca de roupa', 25], ['Almoço', 20], ['Preparar saída', 20]]],
  ['Manhã de trabalho', '09:30', [['Ligar p/ Ana?', 10], ['Revisar (v2.1)', 15]]],
  ['Treino', '07:00', [['☕ Café', 5], ['Pré-treino', 10], ['Treino-5', 30]]],
  ['Rotina fim 01:00', '01:00', [['Lavar louça', 20], ['Ler', 30]]],
];

test('every documented routine link parses, uses only supported fields, and matches intended outputs and wire values', () => {
  const links = [...doc.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(match => match[1]).filter(link => new URL(link).searchParams.has('rotina'));
  expect(links).toHaveLength(expectedExamples.length);
  const wireValues = [...doc.matchAll(/^\| [^|]+ \| `([^`]+)` \| \[/gm)].map(match => match[1]);
  expect(wireValues).toHaveLength(links.length);
  links.forEach((link, i) => {
    const url = new URL(link);
    expect(url.origin).toBe('https://squeeze.ggarrote.workers.dev');
    expect([...url.searchParams.keys()].every(key => ['rotina', 'nome', 'tipos'].includes(key))).toBe(true);
    expect(url.pathname).toBe('/');
    expect(url.hash).toBe('');
    const parsed = parseRoutineLink(url.search);
    expect(parsed.status).toBe('valid');
    const [name, deadline, tasks] = expectedExamples[i];
    expect(parsed.plan.name).toBe(name);
    expect(parsed.plan.deadline).toBe(deadline);
    expect(parsed.plan.tasks.map(task => [task.name, task.minutes])).toEqual(tasks);
    const plan = { ...parsed.plan, name: url.searchParams.has('nome') ? name : '' };
    expect(serializeRoutineLink(url.origin, plan)).toBe(link);
    expect(parseRoutineLink('?rotina=' + wireValues[i]).plan.tasks).toEqual(parsed.plan.tasks);
  });
});

test('generated HTML exposes all document content, code and prompt without JavaScript', async () => {
  const { markdown, html } = await instructionsAssets();
  expect(markdown).toBe(doc);
  expect(renderInstructions(markdown)).toBe(html);
  const page = new JSDOM(html).window.document;
  expect(page.documentElement.lang).toBe('pt-BR');
  expect(page.title).toContain('Instruções oficiais');
  expect(page.querySelectorAll('script')).toHaveLength(0);
  expect(page.querySelector('a[href="/instrucoes.md"]')).not.toBeNull();
  expect(page.querySelectorAll('h1')).toHaveLength(1);
  for (const heading of [...doc.matchAll(/^#{1,3} (.+)$/gm)]) expect(page.body.textContent).toContain(heading[1]);
  for (const block of [...doc.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]) expect(page.body.textContent).toContain(block[1].trimEnd());
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  for (const paragraph of markdown.split(/\n\n+/).filter(part => !/^(#|\||```)/.test(part))) {
    expect(normalize(page.body.textContent)).toContain(normalize(paragraph.replace(/`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')));
  }
  for (const [, label, href] of doc.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    expect([...page.querySelectorAll('a')].some(anchor => anchor.getAttribute('href') === href && anchor.textContent === label)).toBe(true);
  }
  for (const anchor of page.querySelectorAll('a[href^="#"]')) expect(page.getElementById(anchor.getAttribute('href').slice(1))).not.toBeNull();
});

test('bounded renderer escapes HTML and prevents executable links', () => {
  const view = renderInstructions('# Teste\n\n<img src=x onerror=alert(1)> [x](javascript:alert) [y](//evil.test)\n\n```text\n<script>alert(1)</script>\n```');
  const page = new JSDOM(view).window.document;
  expect(page.querySelectorAll('img,script')).toHaveLength(0);
  expect(page.querySelectorAll('a[href^="javascript:"],a[href^="//"]')).toHaveLength(0);
  expect(page.body.textContent).toContain('<img src=x onerror=alert(1)>');
  expect(() => renderInstructions('```text\nunfinished')).toThrow('Unclosed');
});

test('build writes canonical Markdown, static index and Cloudflare MIME header to output only', async () => {
  const output = await mkdtemp(resolve(tmpdir(), 'squeeze-instructions-'));
  try {
    const plugin = buildInstructions();
    plugin.configResolved({ root: output, build: { outDir: '.' } });
    await plugin.writeBundle();
    expect(await readFile(resolve(output, 'instrucoes.md'), 'utf8')).toBe(doc);
    expect(await readFile(resolve(output, 'instrucoes/index.html'), 'utf8')).toBe(renderInstructions(doc));
    const existingHeaders = await readFile(new URL('../../public/_headers', import.meta.url), 'utf8');
    expect(await readFile(resolve(output, '_headers'), 'utf8')).toBe(existingHeaders + '/instrucoes.md\n  Content-Type: text/markdown; charset=utf-8\n');
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('development and preview documentation routes return static bodies with correct MIME', async () => {
  const plugin = buildInstructions();
  for (const configure of [plugin.configureServer, plugin.configurePreviewServer]) {
    let handler;
    configure({ middlewares: { use(fn) { handler = fn; } } });
    for (const route of ['/instrucoes', '/instrucoes/', '/instrucoes.md']) {
      const headers = {};
      let body;
      await handler({ url: route + '?ignored=yes' }, { setHeader(key, value) { headers[key] = value; }, end(value) { body = value; } }, () => { throw new Error('Unexpected SPA fallback'); });
      expect(headers['Content-Type']).toBe(route.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8');
      expect(body).toBe(route.endsWith('.md') ? doc : renderInstructions(doc));
    }
    let passed = false;
    await handler({ url: '/0630' }, {}, () => { passed = true; });
    expect(passed).toBe(true);
  }
});

test('every whole routine URL in the documentation and README is a valid v3 link', async () => {
  const readme = await readFile(new URL('../../../README.md', import.meta.url), 'utf8');
  const urls = [...(doc + '\n' + readme).matchAll(/https?:\/\/[^\s`)<]+/g)].map(match => match[0]).filter(link => link.includes('rotina='));
  expect(urls.length).toBeGreaterThanOrEqual(expectedExamples.length);
  for (const link of urls) expect(parseRoutineLink(new URL(link).search).status).toBe('valid');
});

test('every punctuation escape printed in the documentation decodes to the stated literal character', () => {
  const escapes = [...doc.matchAll(/^\| `([^`]+)` \| `(~[0-9A-F]{2})` \|$/gm)];
  expect(escapes).toHaveLength(18);
  for (const [, text, wire] of escapes) {
    const parsed = parseRoutineLink('?rotina=3.1930.prefix' + wire + '-1');
    expect(parsed.status).toBe('valid');
    expect(parsed.plan.tasks[0].name).toBe('prefix' + text);
  }
});
