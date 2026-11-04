# Guia técnico do repositório

## Estado e arquitetura atuais

Rotina da Nina visualiza manhã/noite em uma fita para famílias. Este guia vale para
qualquer implementador; AGENTS.md contém as convenções de contribuição.

- `app/src/App.jsx`: carregamento e normalização `duration → minutes`, precedência URL/storage,
  fallback público/embarcado e relógio por timestamp.
- `pages/Home.jsx`: seleção manhã/noite, prazo, operações da sessão, editores e gravação.
- `components/fita/RoutineTV.jsx`, `RoutinePhone.jsx`, `ParentMenu.jsx`, `theme.js`: UI aprovada.
- `EditControls.jsx` + `lib/routineDraft.js`: modo de edição na tela principal (rascunho; Salvar/Cancelar);
  `DefaultRoutineEditor.jsx`: editor completo (⚙️ Rotinas). AudioAlerts permanece inativo.
- `lib/schedule.js`: agenda e operações; `routineView.js` e `trackLayout.js`: apresentação/geometria;
  `timeline.js`: helpers de horário; `routineUrl.js` e `taskCatalog.json`: contrato de links.
- `public/routines.json` e `lib/defaultRoutines.json`: padrões semanticamente iguais,
  protegidos por teste. Não remover a cópia embarcada, usada no fallback.

Storage usa `routines`; sessão em memória não sobrevive ao reload. Queries válidas vencem
storage e persistem; inválidas não gravam; atalhos usam padrões sem gravação inicial.
A tela principal lê `monday`; outros dias do editor não implicam seleção automática.
O encerramento dura até 180 minutos após o prazo. Não há backend, notificações ou sincronização.
A fase 4 usa worker nativo em produção/preview, fontes locais e atualização consentida,
com bloqueio nos editores e preservação do storage no reload. Veja [docs/pwa.md](docs/pwa.md).

## Comandos

Node 26.13.0 (`.nvmrc`, engines); Python 3 no PATH é necessário ao teste da documentação.
Todos os comandos npm são executados em `app/`:

```bash
npm ci
npm start
npm run lint -- --max-warnings=0
npm test -- --run
npm run build
npm audit
```

A suíte preserva os 228 cenários em 8 arquivos e inclui novos testes PWA, sem skip/todo. Preserve seus asserts e contratos.
Exceções de acesso DOM são por linha e justificadas para geometria em jsdom; não desligue
regras globalmente. Vite/Vitest substituem CRA nesta fase; audit/deprecações transitivas são dívida de
ferramentas, não resolvidas pela classificação devDependencies. Não use audit fix --force.
PROGRESS e specifications distinguem o estado atual do histórico; CHANGES.MD é histórico.

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
