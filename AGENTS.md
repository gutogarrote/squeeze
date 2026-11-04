# Repository Guidelines

Squeeze is a backward-planning app for adults: set a deadline and a sequence of tasks, see when to
start, and watch upcoming tasks get squeezed while the current one runs. Tasks never end on their own.
The current spec is `specifications.md` (Portuguese). `CLAUDE.md` holds the technical guide.

## Project Structure & Module Organization
- Root docs: `specifications.md` (current spec), `CLAUDE.md`, `README.md`, `PROGRESS.md`, `docs/`.
  `original_specification.md` and `ver-o-tempo-ui-handoff.md` are Ver o Tempo history only.
- App code in `app/` (Vite + React + Tailwind):
  - `app/src/lib/` pure logic (time engine, URL parsing); `app/src/components/` UI; `app/src/hooks/`; `app/src/pwa/`.
  - `app/public/` static assets (`sounds/`, `icons/`, `fonts/`, `manifest.json`).
- The code is still the inherited Ver o Tempo base being adapted. See `specifications.md` §15 for
  what to reuse and what to replace before changing a module.

## Build, Test, and Development Commands
From `app/` (Node 26.13.0 from `.nvmrc`; Python 3 on PATH for doc tests):
- `npm ci`: install dependencies.
- `npm start`: dev server at `http://localhost:3000` (no service worker in dev).
- `npm test`: Vitest in watch mode; `npm test -- --run` for a single run.
- `npm run lint -- --max-warnings=0`: lint production code and tests with zero warnings.
- `npm run build`: production build to `app/build/`.

## Coding Style & Naming Conventions
- React (JS/JSX), functional components and hooks.
- 2-space indentation; single quotes; semicolons allowed by ESLint.
- Lint config: `app/eslint.config.mjs` (core, React, hooks, accessibility, Testing Library, jest-dom).
- Components: PascalCase files and exports. Functions/variables: camelCase. Constants: UPPER_SNAKE_CASE.
- Styling: Tailwind utilities in JSX; keep component CSS minimal.
- Time logic lives in pure functions that take `nowMs`; keep estimate, consumed, reference and budget
  as separate values (spec §2). All timing comes from persisted real timestamps.
- User-facing text is in Portuguese.

## Testing Guidelines
- Vitest + React Testing Library; tests colocated as `*.test.js` / `*.test.jsx`.
- Interaction tests query by role/label, not implementation details.
- Every new behavior gets tests; the examples in spec §6.4 are required time-engine tests.
- Inherited Ver o Tempo tests may be removed or rewritten only together with the behavior they cover,
  stated in the commit message. No `skip`/`todo`. DOM lint exceptions are per line and justified;
  never disable rules globally.

## Commit & Pull Request Guidelines
- Commits: imperative, concise subject (e.g., "Add squeeze time engine").
- Keep changes scoped; no unrelated diffs or generated files.
- PRs include summary, rationale, linked issue (if any), screenshots/GIFs for UI changes, and test notes.
- CI runs `npm ci`, lint with zero warnings, tests and production build.

## Security & Configuration Tips
- No backend, accounts or secrets; data stays in `localStorage`.
- Deploy is a Cloudflare Worker named `squeeze`, independent from Ver o Tempo: see `docs/deploy.md`
  and the deploy section of `CLAUDE.md`. Never commit tokens, `.dev.vars`, `.wrangler/` or the build.
