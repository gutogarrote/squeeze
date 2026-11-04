# Repository Guidelines

## Project Structure & Module Organization
- Root docs: `README.md`, `specifications.md`, `PROGRESS.md`.
- App code in `app/` (Vite + Tailwind):
  - `app/src/` React source; `app/src/components/` UI components.
  - `app/public/` static assets (e.g., `routines.json`, `sounds/`).
  - Config: `app/tailwind.config.js`, `app/postcss.config.js`.

## Build, Test, and Development Commands
- From `app/` directory:
  - `npm start`: Run dev server at `http://localhost:3000`.
  - `npm test`: Vitest in watch mode with React Testing Library.
  - `npm run lint -- --max-warnings=0`: Check production and all tests with zero warnings.
- `npm test -- --run`: Run all original 228 scenarios plus the PWA scenarios.
- `npm run build`: Production build to `app/build/`.
- Install deps once: `cd app && npm ci`.

## Coding Style & Naming Conventions
- Language: React (JS/JSX), functional components and hooks.
- Indentation: 2 spaces; prefer single quotes; trailing semicolons allowed by ESLint.
- Linting: Explicit flat configuration in `app/eslint.config.mjs` (core, React, hooks, accessibility, Testing Library and jest-dom).
- Naming:
  - Components: PascalCase JSX files and exports (e.g., `RoutineTV.jsx`).
  - Functions/variables: camelCase; constants UPPER_SNAKE_CASE.
  - Tests: `*.test.js` / `*.test.jsx` colocated in `src/`.
- Styling: Tailwind utility classes in JSX; keep component CSS minimal (`app/src/*.css`).

## Testing Guidelines
- Frameworks: Vitest + React Testing Library (`@testing-library/*`).
- Add tests next to code (e.g., `components/Timeline.test.js`).
- Write interaction-focused tests (queries by role/label, not implementation details).
- Run all tests locally with `npm test`; ensure no failing snapshots.

## Commit & Pull Request Guidelines
- Commits: imperative, concise subject (e.g., "Add Timeline progress bar").
- Scope changes logically; avoid unrelated diffs and generated files.
- PRs should include:
  - Summary, rationale, and scope.
  - Linked issue (if applicable).
  - Screenshots or short GIFs for UI changes.
  - Test notes: what was tested and how to reproduce.

## Security & Configuration Tips
- No secrets required; data persists in `localStorage` only.
- Keep large media in `app/public/`; do not commit build artifacts.
- Tailwind: add utilities/components in `tailwind.config.js` if extending design.


## Current Architecture and Verification
- Use Node 26.13.0 (`.nvmrc` and app engines) and Python 3 on PATH for executable doc examples.
- App loads URL/storage/defaults; Home controls the session; components/fita implements TV/phone UI.
- lib contains schedule, routineView, trackLayout, timeline and routineUrl helpers.
- Configuration persists in localStorage; session is in memory; no backend. Production/preview registers a native PWA worker; dev does not. See docs/pwa.md.
- Preserve all scenarios and assertions, with no skip/todo. DOM lint exceptions must be per-line,
  justified only for geometry/scroll measurement. Never disable rules globally.
- CI runs npm ci, lint with zero warnings, nonwatch tests and production build.
- Vite/Vitest replace CRA; classify audit findings by tooling exposure rather than promising zero vulnerabilities.
- ESLint 9 is deprecated but matches current React/a11y plugin peers; revisit with ESLint 10 support.
- `npm start` and `npm run preview` bind port 3000 with strictPort; build output remains app/build.
- PROGRESS/specifications include labeled historical sections; use their current sections as guidance.

## Implantação: Cloudflare Workers Static Assets (fase 3)

A configuração `wrangler.jsonc` na raiz prepara o Worker `squeeze` na conta
`339987eb42deac962dcd86bffd351107`, com Wrangler fixado em 4.155.0.
Usa somente assets de `./app/build` (caminho relativo à configuração), sem script Worker.
`workers_dev=true` habilita workers.dev; não há routes, domínio personalizado nem alteração de DNS.
O fallback `assets.not_found_handling="single-page-application"` entrega `index.html`
com HTTP 200 para rotas não encontradas, incluindo `/0720`; queries de rotina continuam no cliente.
Esta fase prepara a implantação; nenhum deploy remoto foi executado.

Comandos a partir de `app/`, após `npm ci`:

```bash
npm run dev:assets
# Build seguido de Wrangler local; encerre com Ctrl+C.
npm run build
npx wrangler deploy --dry-run --config ../wrangler.jsonc
# Publicação posterior, somente quando autorizada e autenticada na Cloudflare:
npm run deploy
# Rollback manual para uma versão previamente publicada:
npx wrangler rollback <version-id> --name squeeze --config ../wrangler.jsonc
```

Os scripts usam explicitamente a configuração da raiz. O rollback é manual e não modifica DNS.
`localStorage` é por origem: dados de localhost não migram automaticamente para workers.dev.
A fase 3 não adicionava PWA/service worker. A fase 4 adiciona instalação/offline e aviso
de atualização conforme [docs/pwa.md](docs/pwa.md), sem redesenhar as telas.
Não há migração/exportação, backend, storage remoto ou telemetria. Não versionar tokens, segredos,
`.dev.vars`, `.wrangler/` ou o build.
