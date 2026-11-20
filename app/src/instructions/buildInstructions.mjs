import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const canonicalDocument = new URL('../../../docs/url-rotina-v3.md', import.meta.url);
const escapeHtml = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

// Deliberately bounded Markdown: headings, paragraphs, fenced code, tables,
// inline code and links. Raw HTML is always text; URL schemes are allowlisted.
// A fence marked ```prompt becomes the copyable prompt box; the page works without
// JavaScript, and the copy button only appears where the clipboard is available.
const COPY_SCRIPT = `(()=>{const button=document.querySelector('[data-copy]');const status=document.querySelector('.copy-status');if(!button||!navigator.clipboard)return;button.hidden=false;button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(document.getElementById(button.dataset.copy).textContent);status.textContent='Prompt copiado.';button.textContent='Copiado ✓';setTimeout(()=>{button.textContent='Copiar prompt';},2000);}catch(error){status.textContent='Não foi possível copiar. Selecione o texto e copie.';}});})();`;
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
  let hasPrompt = false;
  // The table of contents goes right after the prompt box, or at the top without one.
  let indexAt = 0;
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const prompt = line.trim() === '```prompt' && !hasPrompt;
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      if (i === lines.length) throw new Error('Unclosed Markdown fence');
      i++;
      if (prompt) {
        hasPrompt = true;
        indexAt = blocks.length + 1;
        blocks.push(`<div class="prompt-box"><div class="copy-row"><button type="button" class="copy" data-copy="prompt" hidden>Copiar prompt</button><span class="copy-status" role="status" aria-live="polite"></span></div><pre id="prompt" tabindex="0" aria-label="Prompt para o agente de IA"><code>${escapeHtml(code.join('\n'))}</code></pre></div>`);
      } else {
        blocks.push(`<pre tabindex="0"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      }
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
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#09090b"><title>Instruções oficiais de links v3 — Squeeze</title><meta name="description" content="Gramática, limites, exemplos e prompt para criar links de rotina v3 do Squeeze."><link rel="alternate" type="text/markdown" href="/instrucoes.md"><style>
:root{color-scheme:dark;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#e4e4e7;background:#09090b}*{box-sizing:border-box}body{margin:0;background:#09090b;-webkit-font-smoothing:antialiased}main,header{max-width:72rem;margin:auto;padding:1.25rem}a{color:#bef264;text-decoration:underline;text-underline-offset:2px}a:focus-visible,pre:focus-visible,button:focus-visible,.table-scroll:focus-visible{outline:2px solid #bef264;outline-offset:3px}p{line-height:1.7;overflow-wrap:anywhere;color:#d4d4d8}h1{font-size:clamp(1.6rem,4vw,2.6rem);color:#fafafa}h2{margin-top:2.5rem;scroll-margin-top:1rem;color:#fafafa}nav{display:flex;flex-wrap:wrap;gap:.6rem 1rem}code{font-size:.9em;background:#18181b;color:#f4f4f5;border-radius:.3rem;padding:.12rem .3rem;overflow-wrap:anywhere}pre{overflow:auto;max-width:100%;padding:1rem;background:#18181b;border:1px solid #27272a;border-radius:.75rem;line-height:1.55}pre code{padding:0;background:none;overflow-wrap:normal}table{border-collapse:collapse;min-width:100%;font-size:.95rem}th,td{text-align:left;vertical-align:top;padding:.65rem;border:1px solid #27272a;line-height:1.5}th{background:#18181b;color:#fafafa}.table-scroll{overflow:auto}td code{white-space:normal}.skip{display:inline-block;margin-bottom:.75rem}main>nav{margin:1.5rem 0 0;padding-top:1rem;border-top:1px solid #27272a}.prompt-box{margin:1rem 0 1.5rem;padding:1rem;border-radius:1rem;background:#111113;border:1px solid rgba(190,242,100,.35)}.prompt-box pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:24rem;border-color:#27272a}.prompt-box pre code{overflow-wrap:anywhere}.copy-row{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem}.copy-row:has(.copy:not([hidden])){margin-bottom:.75rem}.copy{appearance:none;border:0;border-radius:.75rem;padding:.75rem 1.25rem;font:inherit;font-weight:600;background:#bef264;color:#09090b;cursor:pointer}.copy:hover{background:#d9f99d}.copy-status{font-size:.9rem;color:#a1a1aa}@media(max-width:600px){main,header{padding:1rem}table{min-width:40rem}}
</style></head><body><header><a class="skip" href="#conteudo">Ir para as instruções</a><nav aria-label="Navegação principal"><a href="/">Abrir aplicativo</a><a href="/instrucoes.md">Ler ou baixar Markdown canônico</a></nav></header><main id="conteudo">${[...blocks.slice(0, indexAt), `<nav aria-label="Índice das instruções">${sections.join('')}</nav>`, ...blocks.slice(indexAt)].join('\n')}</main>${hasPrompt ? `<script>${COPY_SCRIPT}</script>` : ''}</body></html>\n`;
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
