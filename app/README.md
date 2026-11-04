# App Squeeze

Veja o [README principal](../README.md), o [guia técnico](../CLAUDE.md),
o [formato de links v3](../docs/url-rotina-v3.md) e o [guia PWA](../docs/pwa.md).

Use Node 26.13.0. Nesta pasta:

```bash
npm ci
npm start
npm run lint -- --max-warnings=0
npm test -- --run
npm run build
npm run preview
```

Vite gera `build/` (ignorado pelo Git). Somente produção/preview registra o service worker,
para instalação e uso offline após a primeira visita.
