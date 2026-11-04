# Guia técnico do repositório — Squeeze

Squeeze é um app de planejamento reverso para adultos: o usuário define um deadline e uma
sequência de tarefas, o app diz a que horas começar e, durante a execução, espreme as próximas
tarefas enquanto a atual não é concluída. A especificação vigente é [specifications.md](specifications.md).
AGENTS.md contém as convenções de contribuição. [PROGRESS.md](PROGRESS.md) registra o andamento:
atualize-o a cada etapa concluída (o que foi feito, como foi verificado, próximos passos).

## Estado atual

O código em `app/` ainda é a base herdada do Ver o Tempo (Rotina da Nina) e está sendo adaptado.
Antes de mudar algo, confira se a parte é para **reaproveitar** ou **substituir** (specifications.md §15).

Reaproveitar:

- Vite + React + Tailwind; PWA em `app/src/pwa/` (ver [docs/pwa.md](docs/pwa.md)).
- `hooks/useScreenWakeLock.js` (manter a tela acesa).
- `splitProportional` e `splitCapped` em `lib/schedule.js` (divisão proporcional com arredondamento exato).
- Gramática de nomes de `lib/routineUrl.js` (`_` = espaço, escapes `~XX`), base do link v3.
- Deploy na Cloudflare (abaixo) e sons em `app/public/sounds/`.

Substituir:

- O motor de agenda de `lib/schedule.js`: no Ver o Tempo as tarefas terminam quando o horário passa.
  **No Squeeze nenhuma tarefa termina automaticamente.**
- A UI infantil (`components/fita/`, `ParentMenu`, `DefaultRoutineEditor`), `taskCatalog.json`,
  a estrutura `monday` com manhã/noite, `routines.json`/`defaultRoutines.json` e a sessão em memória.

## Regras do motor de tempo

- Lógica de tempo em funções puras em `app/src/lib/`, recebendo `nowMs`; nada de `Date.now()` escondido.
- Guardar separadamente estimativa, consumido, referência e orçamento (specifications.md §2).
- Todo cálculo parte de timestamps reais persistidos; a execução ativa sobrevive a reload.
- Preservar a igualdade de §6.1 (`agora + restante da atual + orçamentos + folga = deadline`) e
  usar os exemplos de §6.4 como testes.
- Tirar tempo: folga primeiro, depois pendentes proporcionalmente aos orçamentos. Dar tempo:
  pendentes proporcionalmente às referências; sem referência, vai para a folga.

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

## Testes

- A suíte herdada cobre o comportamento do Ver o Tempo. Ao remover ou substituir um comportamento
  herdado, remova ou reescreva os testes correspondentes no mesmo commit e diga isso na mensagem.
- Testes de infraestrutura (PWA, wake lock, build) continuam passando enquanto a peça for mantida.
- Todo comportamento novo tem teste. Sem `skip`/`todo`.
- Exceções de lint para acesso ao DOM são por linha e justificadas (geometria em jsdom); não desligue
  regras globalmente. Não use `npm audit fix --force`; avisos de audit em ferramentas de dev são dívida conhecida.
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
