import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const canonicalDocument = new URL('../../../docs/url-rotina-v2.md', import.meta.url);
const escapeHtml = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Deliberately bounded Markdown: headings, paragraphs, fenced code, tables,
// inline code and links. Raw HTML is always text; URL schemes are allowlisted.
function inline(text) {
  return text.split(/(`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g).map(part => {
    if (part.startsWith('`') && part.endsWith('`')) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(part);
    if (link && /^(https:\/\/|http:\/\/localhost:|\/(?!\/)|#)/.test(link[2])) {
      return `<a href="${escapeHtml(link[2])}">${escapeHtml(link[1])}</a>`;
    }
    return escapeHtml(part);
  }).join('');
}

export function renderInstructions(markdown) {
  const lines = markdown.trimEnd().split('\n');
  const sections = [];
  const blocks = [];
  let headingIndex = 0;
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      if (i === lines.length) throw new Error('Unclosed Markdown fence');
      i++;
      blocks.push(`<pre tabindex="0"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    } else if (/^#{1,3} /.test(line)) {
      const [, hashes, title] = /^(#{1,3}) (.*)$/.exec(line);
      const id = `secao-${headingIndex++}`;
      if (hashes.length > 1) sections.push(`<a href="#${id}">${escapeHtml(title)}</a>`);
      blocks.push(`<h${hashes.length} id="${id}">${inline(title)}</h${hashes.length}>`);
      i++;
    } else if (line.startsWith('| ') && /^\|[ -]+\|/.test(lines[i + 1] || '')) {
      const cells = row => row.slice(1, -1).split('|').map(cell => cell.trim());
      const headers = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith('| ')) {
        const row = cells(lines[i++]);
        if (row.length !== headers.length) throw new Error('Unsupported table shape');
        rows.push(`<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`);
      }
      blocks.push(`<div class="table-scroll" role="region" aria-label="Tabela de referência" tabindex="0"><table><thead><tr>${headers.map(cell => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
    } else {
      const paragraph = [];
      while (i < lines.length && lines[i].trim() && !/^(#|```|\| )/.test(lines[i])) paragraph.push(lines[i++]);
      if (!paragraph.length) throw new Error('Unsupported Markdown block');
      blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }
  }
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instruções oficiais de links v2 — Ver-o-Tempo</title><meta name="description" content="Catálogo completo, gramática, exemplos e prompt para criar links de rotina v2."><link rel="alternate" type="text/markdown" href="/instrucoes.md"><style>
:root{color-scheme:light;font-family:system-ui,sans-serif;color:#222;background:#fff9ef}*{box-sizing:border-box}body{margin:0}main,header{max-width:72rem;margin:auto;padding:1.25rem}main{background:white}a{color:#0757a3;text-decoration:underline}a:focus-visible,pre:focus-visible,.table-scroll:focus-visible{outline:3px solid #9c36b5;outline-offset:3px}p{line-height:1.7;overflow-wrap:anywhere}h1{font-size:clamp(1.6rem,4vw,2.6rem)}h2{margin-top:2.5rem;scroll-margin-top:1rem}nav{display:flex;flex-wrap:wrap;gap:.6rem 1rem}code{font-size:.9em;background:#f0f3f6;border-radius:.2rem;padding:.12rem .25rem;overflow-wrap:anywhere}pre{overflow:auto;max-width:100%;padding:1rem;background:#f0f3f6;line-height:1.5}pre code{padding:0;overflow-wrap:normal}table{border-collapse:collapse;min-width:100%;font-size:.95rem}th,td{text-align:left;vertical-align:top;padding:.65rem;border:1px solid #cbd5e1;line-height:1.5}th{background:#edf3f8}.table-scroll{overflow:auto}td code{white-space:normal}.skip{display:inline-block;margin-bottom:.75rem}@media(max-width:600px){main,header{padding:1rem}table{min-width:40rem}}
</style></head><body><header><a class="skip" href="#conteudo">Ir para as instruções</a><nav aria-label="Navegação principal"><a href="/">Abrir aplicativo</a><a href="/instrucoes.md">Ler ou baixar Markdown canônico</a></nav></header><main id="conteudo"><nav aria-label="Índice das instruções">${sections.join('')}</nav>${blocks.join('\n')}</main></body></html>\n`;
}

export async function instructionsAssets() {
  const markdown = await readFile(canonicalDocument, 'utf8');
  return { markdown, html: renderInstructions(markdown) };
}

export function buildInstructions() {
  let output;
  function middleware(server) {
    server.middlewares.use(async (request, response, next) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (!['/instrucoes', '/instrucoes/', '/instrucoes.md'].includes(pathname)) return next();
      try {
        const { markdown, html } = await instructionsAssets();
        response.setHeader('Content-Type', pathname.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8');
        response.end(pathname.endsWith('.md') ? markdown : html);
      } catch (error) { next(error); }
    });
  }
  return {
    name: 'squeeze-instructions',
    configResolved(config) { output = resolve(config.root, config.build.outDir); },
    configureServer: middleware,
    configurePreviewServer: middleware,
    async writeBundle() {
      const { markdown, html } = await instructionsAssets();
      await mkdir(resolve(output, 'instrucoes'), { recursive: true });
      await writeFile(resolve(output, 'instrucoes/index.html'), html);
      await writeFile(resolve(output, 'instrucoes.md'), markdown);
      // Preserve every existing PWA/cache header copied by Vite. Static Assets
      // applies the additional Markdown MIME rule without adding Worker code.
      const headers = await readFile(new URL('../../public/_headers', import.meta.url), 'utf8');
      await writeFile(resolve(output, '_headers'), headers + '/instrucoes.md\n  Content-Type: text/markdown; charset=utf-8\n');
    },
  };
}
