# App Squeeze

Veja o [README principal](../README.md), [guia técnico](../CLAUDE.md),
[contrato de URL](../docs/url-rotina.md) e [guia PWA](../docs/pwa.md).

Use Node 22.23.3 e Python 3 no PATH. Nesta pasta:

```bash
npm ci
npm start
npm run lint -- --max-warnings=0
npm test -- --run
npm run build
npm run preview
```

Vite gera `build/` (ignorado pelo Git). Somente produção/preview registra o worker
gerado, para instalação/offline após a primeira visita. Fontes e ícones são locais.
A atualização pede ação e fica bloqueada durante os editores; configurações salvas
permanecem, sessão reinicia com reload. Não há backend, sync, alarmes ou deploy remoto
realizado. Consulte o guia PWA para limites, validação de dados e rollback seguro.
