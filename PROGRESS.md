# Progresso — Rotina da Nina

## Manutenção de dependências — issue 28 (2026-10-28)

Node 22.23.3 → 22.23.4 na etapa inicial; follow-up autorizado por Guto migra para
Node **26.13.0 LTS (Lithium)** com npm **11.20.0**, suporte até **2029-04-30**.
Wrangler 4.149.0 → 4.155.0 e correções compatíveis no lockfile de
postcss-selector-parser, undici e zod. Tailwind 3.4.17, React e código funcional
preservados, sem overrides. O CI já consome `.nvmrc`.

Auditoria atual: 5 pacotes afetados (3 moderate, 2 high) → 0; omitindo dev: 0 → 0.
O advisory histórico de braces foi retirado em 23/10. Zero no audit não é garantia
absoluta de segurança. ESLint 9 segue depreciado por compatibilidade dos peers.

Verificação atual com Node 26.13.0/npm 11.20.0 oficiais, isolados e com checksum
conferido: npm ci, lint zero warnings, 491/491 testes em 25 arquivos e build passaram,
executados em sequência. Audit completo e omit-dev: zero. Chromium: 552/552 checks,
8/8 capturas e geometria iguais ao baseline em celular/desktop/TV. PWA offline passou.
JS/CSS e demais assets iguais ao baseline, exceto as duas páginas de instruções
atualizadas pelo pin no guia. Lockfile muda somente engines.node na raiz;
resoluções, código funcional, CSS e testes preservados. Evidências separadas em
`/home/ubuntu/.hermes/cache/scratch/ver-o-tempo-node26-evidence`.

Verificação histórica da etapa Node 22 isolado: npm ci, lint zero warnings,
491 testes/25 arquivos sem skip/todo
e build passaram. Uma execução concorrente com Chromium teve um timeout de 5s;
a repetição completa sem concorrência passou sem alterar testes ou limites.
Chromium: 552/552 verificações em celular/desktop/TV, geometria e estilos medidos
iguais ao baseline, sem overflow horizontal nem erros de página; smoke PWA offline
com atalhos e URLs v1/v2 passou. Build anterior à atualização documental inteiro
byte a byte igual ao baseline. A atualização do pin no guia muda apenas os assets
de instruções gerados; bundles JS/CSS preservados.

Ver [decisões, procedência e evidências](docs/dependency-maintenance.md).
PR32 já aberto na mesma branch. Hermes fará verificação independente, push e
atualização do PR; este follow-up gera commit local, sem push, edição de PR, merge
ou deploy. Issue aberta até o merge.
Os registros das fases abaixo descrevem seus respectivos momentos históricos.

## Instruções oficiais v2 — tarefa 29 (2026-10-10)

V2 já implementada passa a ter guia autossuficiente em `docs/url-rotina-v2.md`,
fonte única de `/instrucoes` e `/instrucoes.md` gerados pelo build. Catálogo atual
completo, limites, escapes, exemplos conferidos pelo parser e prompt para agentes.
V1 permanece referência de compatibilidade. Sem novos IDs ou gerador/editor.
Documentação estática independe de JS e fica fora do shell/cache offline; somente
suas rotas deixam de ser interceptadas pelo PWA. Publicação e verificação final
cabem a Hermes; este trabalho não executa push, deploy, merge ou PR.

## Histórico: proposta local issue 19 (2026-10-10)

Formato legível v2 para salvar URLs: `_` representa espaço, hífen permanece no nome,
`~HH` escapa pontuação ASCII, Unicode é encoded uma vez. IDs/durações/HHMM continuam
editáveis. Underscore literal é rejeitado explicitamente; edição permanece local
com aviso e URL anterior, conforme a política existente. Parser v1 e diagnóstico
preservados, sem fallback que adivinhe nomes. Ver [contrato v2](docs/url-rotina-v2.md).
Proposta pendente de revisão Hermes/aprovação do formato; sem push/PR/merge/deploy.
Chromium de produção em TV/celular simulados verifica save/reload com storage vazio,
ambos os editores, offline, query/hash/histórico e link inválido com storage intacto.
Normalização de query é simulada com `new URL`; launch Telegram Android físico pendente.

## Histórico: fase 4 (2026-10-09)

PWA Ver o Tempo com manifest raiz, ícones próprios 192/512 e maskable, Nunito e
Fredoka locais licenciadas (SIL OFL 1.1). Worker nativo gerado pelo build, sem novas
dependências: precache com integridade, shell canônico sem queries particulares e
assets fingerprinted. Offline inclui atalhos, URLs custom e os dois editores.
Dev não registra SW e identifica/aposenta um worker de preview na mesma origem.

Atualização fica esperando ação, bloqueada durante edição. Somente a aba que aceita
recarrega; outras abas preservam drafts e assets antigos. Marcador transitório no
histórico protege cores/ícones/storage da reaplicação de URL no reload de atualização;
sem nova persistência de marcas ou sessão. Ver [guia PWA](docs/pwa.md), incluindo
limites de cache/origem e rollback para versões PWA ou aposentadoria do worker.

Sem backend, login, sync, telemetria, novos alarmes ou redesign das telas. Os MP3
continuam placeholders vazios e os alertas inativos. Nenhum deploy remoto, push, PR
ou merge executado nesta fase. A fase 3 permanece baseline de branch, ainda sem merge.

Verificação com Node 22.23.3: `npm ci`, lint sem warnings, 269 testes em 15 suítes
(228 originais intactos), build e Wrangler deploy dry-run passaram. Chromium 148
via Playwright validou TV/celular em preview e Wrangler local: instalação elegível,
SW ativado/controlando, reload offline, atalhos/queries nunca visitadas, fontes e
ambos os editores. Preview exercitou v1→v2 em duas abas com ativação offline,
storage idêntico, drafts preservados, hashes JS/CSS novos, rejeição por integridade
e rollback local v2→v1. Dev na mesma origem recebeu módulos Vite, desregistrou o
worker anterior e abriu uma aba nova sem controller. Sem WebKit instalado ou teste
em hardware Android/iOS. Evidências e resultado fora do repo em
`/home/ubuntu/.hermes/cache/scratch/ver-o-tempo-fase4`.

Audit: 7 achados herdados (2 moderate, 5 high) na cadeia Tailwind/tooling;
`npm audit --omit=dev` retorna zero. Nenhuma dependência foi adicionada/atualizada.
ESLint exclui somente o output gerado `.wrangler/`, mantendo todas as regras de
produção/testes; os asserts originais e os timeouts não foram alterados.

## Histórico: fase 3 (2026-10-09)

A configuração `wrangler.jsonc` na raiz prepara o Worker `squeeze` na conta
`339987eb42deac962dcd86bffd351107`, com Wrangler fixado em 4.149.0.
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
Não foi adicionado recurso de migração/exportação, backend, storage remoto, telemetria, PWA
ou service worker; a UI de produção permanece igual. Não versionar tokens, segredos,
`.dev.vars`, `.wrangler/` ou o build.


Verificação local da fase 3 com Node 22.23.3: `npm ci`, lint zero warnings,
228 testes em 8 suítes, build e Wrangler deploy `--dry-run` passaram.
Wrangler `dev --local` entregou HTTP 200 e o index do build em `/`, `/0720`
e query customizada; smoke Chromium em TV/celular preservou os contratos da fase 2.
A instalação ainda relata 7 vulnerabilidades (2 moderate, 5 high) e deprecação
ESLint 9; a inclusão de Wrangler não atualizou versões de dependências existentes.
Nenhum código em `app/src/` ou `app/public/` foi alterado; nenhum deploy remoto realizado.

## Histórico: fase 2 (2026-10-09)

- Correção independente: desmarcar uma tarefa preserva as outras marcas explícitas e doneSeq;
  elapsed automático continua distinto da marca manual. O corpo da tarefa ainda permite pular/reiniciar.
- CRA/react-scripts substituído por Vite 8.3.4 e Vitest 5.0.3, mantendo React/Tailwind,
  fontes, UI, horários, domínio, URLs, storage e build em `app/build/`.
- 220 cenários originais preservados, mais 8 regressões: 228 em 8 suítes, sem skip/todo.
- JSX em `.jsx`; mocks migrados para `vi`; setup mantém detecção de fake timers da Testing Library.
- Node 22.23.3 e Python 3; CI usa npm ci, lint zero warnings, Vitest nonwatch e build.
- ESLint explícito: 9.39.5 depreciado, mantido por compatibilidade com peers React/a11y.
- Audit: 7 advisories (2 moderate, 5 high), transitivos do Tailwind 3 em tooling;
  não foi usado audit fix --force, nem migrado Tailwind para 4 fora do escopo.
- Nenhum deploy, backend, PWA ou rebranding adicional. Safari real não disponível.

## Histórico: fase 1 (2026-10-08)

- Interface aprovada em `components/fita/`: TV horizontal e celular vertical.
- App carrega URL/storage/padrões; Home coordena edição e sessão em memória.
- Agenda, apresentação, geometria e URL têm helpers e 220 cenários em 8 suítes.
- Manutenção da fase 1: remoção confirmada de componentes mortos, limpeza do template,
  lint completo, Node fixado, tooling em devDependencies e CI de instalação/lint/test/build.
- Persistência já funciona em localStorage; sons não estão ativos (AudioAlerts recebe null).
- Sem migração CRA/Vite, alteração visual, dados novos, backend, PWA ou deploy nesta fase.
- Audit continua como dívida classificada de tooling; mover dependências não corrige advisories.

## Histórico anterior — não é especificação do produto atual

O registro abaixo descreve etapas e propostas antigas, inclusive componentes removidos,
placeholder de salvamento e intenções de PWA. Não representa funcionalidades atuais nem
um plano aprovado. Consulte README, specifications e CLAUDE para o estado vigente.

# Project Log: Ver o Tempo

This document tracks the development progress, decisions made, and next steps for the "Ver o Tempo" application.

## Completed Work

*   **Project Scaffolding:**
    *   Initialized a new Git branch: `feature/timeline-app`.
    *   Set up a new React application using `create-react-app`.
    *   Installed and configured Tailwind CSS for styling.
    *   Resolved dependency conflicts between `react-scripts` and `tailwindcss`.

*   **Core Components:**
    *   `App.js`: The main application component.
    *   `RoutineSelector.js`: Allows users to select a routine for the day.
    *   `Timeline.js`: The core visual component that displays the timeline of tasks.
    *   `TimeIndicator.js`: The "now" marker on the timeline.
    *   `AudioAlerts.js`: Handles playing audio cues for task milestones.
    *   `RoutineEditor.js`: A UI for adding, editing, and deleting tasks within a routine.

*   **Functionality:**
    *   **Timeline Logic:** The timeline now scrolls automatically based on the current time and the routine's defined end time.
    *   **Timeline Redesign (cldcd):** Updated timeline to be fixed with start time at left and end time at right. The "Now" indicator moves along the timeline instead of scrolling. Increased timeline height and added responsive design for mobile devices.
    *   **Enhanced NOW Line (cldcd):** Added dramatic glow effects with multiple shadow layers, enhanced depth with gradients and inner glow. NOW line now displays current time prominently above it for easy time checking. Changed "NOW" to "AGORA" in Portuguese.
    *   **Task Improvements (cldcd):** Added task duration display under task names in lighter font. Updated task colors to use vibrant, professional color combinations with proper contrast ratios.
    *   **Responsive Design (cldcd):** Timeline is now centered on screen with responsive heights (h-32 on mobile to h-56 on large screens) and proper padding for different screen sizes.
    *   **Data Management:**
        *   Routines are loaded from a `routines.json` file.
        *   Routine data is stored in the browser's `localStorage` to persist changes.
    *   **Audio Alerts:** The application is set up to play audio alerts at key moments (5 minutes left, 1 minute left, task complete). Placeholder audio files have been added.
    *   **Routine Editing:** A basic editing mode has been implemented, allowing users to modify routines.
*   **Default Routine Editor (cldcd):** Comprehensive visual editor for managing all default routines without manual JSON editing. Features include editing task names/colors/icons/durations, changing routine end times, creating new routines for any day/period, and deleting tasks or entire routines. All changes persist to localStorage.

## Decisions Made

*   **Technology Stack:**
    *   **Frontend:** React with Tailwind CSS.
    *   **Data Storage:** Browser `localStorage`.
    *   **Backend:** None (client-side only).
*   **Timeline Mechanic:** Implemented the "v2" timeline from the specification: a zoomed-in, scrolling timeline with a fixed "now" indicator.
*   **Initial Data:** A `routines.json` file provides the default routine structure.

## Next Steps & Improvements

### Immediate Priorities

1.  **Refine UI/UX:**
    *   Improve the visual design of the timeline, tasks, and editor.
    *   Add smoother transitions and animations.
    *   Make the `RoutineSelector` dynamic to handle different days of the week.
2.  **Enhance Routine Saving Logic:**
    *   The current saving logic in `App.js` is a placeholder. It needs to be updated to correctly save changes to the specific routine being edited (e.g., "Monday Morning," "Tuesday Evening").
3.  **Add Real Audio Files:**
    *   Replace the placeholder `.mp3` files with actual sound files for the alerts.

### Future Features (v2)

*   **"Journey Map" Gamification:** Implement the more playful, path-based timeline visualization.
*   **Customizable Icons and Colors:** Allow users to select from a wider range of icons and colors for their tasks.
*   **Multiple Profiles:** Add the ability to create and switch between different user profiles, each with their own set of routines.
*   **PWA Enhancements:** Improve the Progressive Web App manifest and service worker for a better offline and installation experience.

### Persistent Task Editing (Future Implementation)

**Problem**: Currently, task edits (names, colors, icons) are only saved to localStorage and are temporary.

**Proposed Solutions** (Easy → Complex):

1. **Enhanced localStorage Persistence** ⭐ *Recommended* (2-3 hours)
   - Modify save logic to always write to localStorage
   - Check localStorage first on startup, fallback to routines.json
   - Add backup/restore functionality
   
2. **Export/Import Feature** ⭐ *Good for Desktop/Mobile* (1-2 hours)
   - Download routines as JSON file
   - Upload custom routines from file
   - Perfect for backup/sharing custom routines
   - **Limitation**: Won't work on Smart TVs (no file system access)

2b. **Smart TV Compatible Solutions** ⭐ *Universal Device Support*
   - **QR Code Sharing** (2-3 hours): Export as QR code, scan to import
   - **Sync Codes** (3-4 hours): Generate 6-digit codes for cross-device sharing
   - **Cloud Integration**: Simple serverless storage with shareable codes
   - Works perfectly with TV remotes and limited input methods

3. **Simple Backend Integration** (5-10 hours)
   - Node.js server with file system or database storage
   - True cross-device persistence
   - **Challenges/Disadvantages**:
     - Requires hosting/deployment infrastructure
     - Database setup and maintenance
     - User authentication needed for multi-user support
     - Network dependency (no offline editing)
     - Backup/disaster recovery considerations
     - CORS configuration for frontend-backend communication
     - Security concerns (input validation, rate limiting)
     - Additional complexity for error handling (network failures, server downtime)
     - Cost implications for hosting and database services

4. **File System Access API** (3-4 hours)
   - Write directly back to routines.json
   - Limited browser support, requires user permission

### Code Quality

*   **Component Refactoring:** Break down larger components (like `App.js`) into smaller, more manageable pieces.
*   **Add Tests:** Implement unit and integration tests to ensure the application is robust.
*   **Error Handling:** Improve error handling, especially for file loading and `localStorage` operations.

## URL de rotina limpa (2026-10-02)

Parser e gerador usam pontos/hífens literais, IDs estáveis, tarefas combinadas
com `catalogIds` preservados pelos dois editores e final opcional HHMM.
Atalhos `/hhhh` usam padrão sem substituir storage; query tem prioridade.
Links inválidos usam padrão seguro e erro amigável, sem apagar dados locais.
O prefixo custom `~` é obrigatório; nomes têm escaping interno de delimitadores.
Formato antigo simples permanece somente para leitura. Detalhes e exemplos
executáveis em [docs/url-rotina.md](docs/url-rotina.md).

Arquitetura atual: App carrega dados e aplica URL uma vez na montagem; Home
seleciona período, controla prazo/modo e edição; `timeline.js` calcula tempo e
`routineView.js` fornece o modelo compartilhado por RoutinePhone/RoutineTV.
Não houve mudança no cálculo de tempo ou na janela de atraso de 180 minutos.

## Salvar edição no link (2026-10-02)

Home usa `serializeRoutineUrl` e `history.replaceState` nos dois editores e em
Salvar horário do menu. URL importada uma vez por App; atalhos de horário viram
query completa em `/`. Outros parâmetros, fragmento e estado do histórico são
preservados. Salvar uma rotina mantém os outros períodos e dias do storage.
Combinações intactas mantêm IDs; nomes editados recebem escaping customizado.
Formato não representável gera aviso e mantém persistência local existente.
Cálculo de tempo e marca-feito não foram modificados. Instruções para copiar
o novo link após salvar em [docs/url-rotina.md](docs/url-rotina.md).
