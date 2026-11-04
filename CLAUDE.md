# Guia técnico do repositório — Squeeze

Squeeze é um app de planejamento reverso para adultos: o usuário define um deadline e uma
sequência de tarefas, o app diz a que horas começar e, durante a execução, espreme as próximas
tarefas enquanto a atual não é concluída. A especificação vigente é [specifications.md](specifications.md).
AGENTS.md contém as convenções de contribuição. [PROGRESS.md](PROGRESS.md) registra o andamento:
atualize-o a cada etapa concluída (o que foi feito, como foi verificado, próximos passos).

## Arquitetura

Tudo no cliente (React + Vite + Tailwind), sem backend. Em `app/src/`:

- `lib/engine.js`: motor de tempo (specifications.md §6). Funções puras que recebem `nowMs` e devolvem
  uma nova execução: `startRun`, `completeTask`, `postponeTask`, `reactivateTask`, `releaseBuffer`,
  `addTimeToCurrent`, `setDeadline`/`extendDeadline`, `applyEdit`, `viewRun` (leitura) e `planSummary`.
  Uma operação sem efeito devolve o mesmo objeto (a UI usa isso para o card "balançar").
- `lib/split.js` (divisão proporcional exata), `lib/clock.js` (próxima ocorrência do deadline, formatos),
  `lib/routineLink.js` (link v3, ver `docs/url-rotina-v3.md`), `lib/storage.js` (localStorage validado),
  `lib/alerts.js` + `lib/sound.js` (limites dos alertas e toques sintetizados com Web Audio).
- `App.jsx`: estado (rascunho, rotinas salvas, execução, ajustes), importação de links, encerramento.
- `screens/PlanScreen.jsx` e `screens/RunScreen.jsx`; `components/SwipeCard.jsx` (gestos),
  `TaskListEditor`, `RunEditor`, `EndSheet`, `SettingsSheet`, `RestScreen`, `Sheet`, `PwaUpdateNotice`.
- `hooks/`: `useNow` (relógio de 1 s), `useAlerts`, `useRestMode`, `useScreenWakeLock`.
- `pwa/` e `instructions/`: service worker gerado no build e página `/instrucoes` a partir do doc v3.

Chaves de storage: `squeeze:draft`, `squeeze:templates`, `squeeze:run`, `squeeze:settings`,
`squeeze:keep-screen-on`. `App` aceita `clock` (padrão `Date.now`) para testes com tempo controlado.

## Regras do motor de tempo

- Lógica de tempo em funções puras em `app/src/lib/`, recebendo `nowMs`; nada de `Date.now()` escondido.
- Guardar separadamente estimativa, consumido, referência e orçamento (specifications.md §2).
- Todo cálculo parte de timestamps reais persistidos; a execução ativa sobrevive a reload.
- Preservar a igualdade de §6.1 (`agora + restante da atual + orçamentos + folga = deadline`) e
  usar os exemplos de §6.4 como testes.
- Tirar tempo: folga primeiro, depois pendentes proporcionalmente aos orçamentos. Dar tempo:
  pendentes proporcionalmente às referências; sem referência, vai para a folga.
- A tarefa atual é sempre a primeira pendente na ordem; concluídas ficam no lugar.

## Comandos

Node 26.13.0 (`.nvmrc`, engines).
Todos os comandos npm são executados em `app/`:

```bash
npm ci
npm start
npm run lint -- --max-warnings=0
npm test -- --run
npm run build
npm audit
```

## Testes

- Todo comportamento novo tem teste. Sem `skip`/`todo`. Os exemplos de specifications.md §6.4 estão
  em `lib/engine.test.js`; a interface é testada em `App.test.jsx` com relógio controlado e swipes simulados.
- Exceções de lint para acesso ao DOM são por linha e justificadas; não desligue regras globalmente.
  Não use `npm audit fix --force`; avisos de audit em ferramentas de dev são dívida conhecida.
- CI (`.github/workflows/ci.yml`) roda `npm ci`, lint sem avisos, testes e build. Não publica.

## Implantação: Cloudflare Workers Static Assets

Detalhes em [docs/deploy.md](docs/deploy.md). A configuração `wrangler.jsonc` na raiz define o Worker
`squeeze` na conta `339987eb42deac962dcd86bffd351107`, com Wrangler fixado em 4.155.0.
Usa somente assets de `./app/build`, sem script Worker. `workers_dev=true`; sem routes, domínio
personalizado nem alteração de DNS. `assets.not_found_handling="single-page-application"` entrega
`index.html` com HTTP 200 para rotas não encontradas; queries de rotina são lidas no cliente.

Comandos a partir de `app/`, após `npm ci`:

```bash
npm run dev:assets
# Build seguido de Wrangler local; encerre com Ctrl+C.
npm run build
npx wrangler deploy --dry-run --config ../wrangler.jsonc
# Publicação, somente quando autorizada e autenticada na Cloudflare:
npm run deploy
# Rollback manual para uma versão previamente publicada:
npx wrangler rollback <version-id> --name squeeze --config ../wrangler.jsonc
```

Nunca usar o Worker, domínio ou integração do Ver o Tempo. `localStorage` é por origem: dados de
localhost não migram para workers.dev. Não há backend, storage remoto ou telemetria. Não versionar
tokens, segredos, `.dev.vars`, `.wrangler/` ou o build.
