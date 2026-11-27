# Progresso — Squeeze

Registro do andamento do Squeeze. Atualize a cada etapa concluída: o que foi feito, como foi
verificado e o que vem a seguir. A especificação vigente é [specifications.md](specifications.md).
O histórico da Rotina da Nina fica no repositório do Ver o Tempo.

## Estado atual (2026-11-06)

O MVP da especificação está implementado em `app/` e substituiu o código do Ver o Tempo.
Inclui identidade visual própria, deadline ao fim da rotina, salvar como e renomear, e alertas
mais intensos. Verificado com lint sem avisos, 182 testes em 15 arquivos e build de produção;
telas conferidas no Chromium em larguras de 320 e 390 px. Publicado em squeeze.ggarrote.workers.dev
(deploy manual feito pelo Guto após o PR 4).

## Etapas

1. [x] Motor de tempo (§6) com os exemplos de §6.4 como testes.
2. [x] Planejamento, horário ideal de início e botão Começar.
3. [x] Execução com swipes (atual, próximas, concluídas, folga), +5 min, atraso e persistência.
4. [x] Modo de edição durante a execução.
5. [x] Rotinas salvas e link v3.
6. [x] Alertas sonoros e modo descanso.

## Pendências conhecidas

- Testar em aparelhos reais (Android e iPhone): gestos, som, tela acesa e instalação como app.
- Reordenar tarefas usa botões ▲▼; arrastar seria mais rápido no celular.
- Os toques são sintetizados (Web Audio); podem ser trocados por sons próprios.

## Registro

### Tipos Fixo e Folga — branch feat/fixed-and-buffer-tasks

- Seletores exclusivos no editor de planejamento e de execução: várias tarefas fixas e uma folga
  por rotina. Dados anteriores continuam flexíveis, sem migração destrutiva.
- Fixas preservam duração e só consomem tempo enquanto atuais; não recebem nem cedem tempo em
  redistribuições. A duração pode ser alterada explicitamente, inclusive pelo botão +5 min.
- Folga explícita é uma reserva, não uma tarefa ativa. Soma a folga automática e absorve primeiro
  o squeeze; ao zerar, só tarefas flexíveis perdem tempo. Aparece no fim da timeline.
- Edição, reordenação, adiamento, reativação, retomada, modelos e recomeço preservam os tipos.
  Links v3 aceitam `tipos=normal,fixo,folga`, uma entrada por tarefa e no máximo uma folga.
- Aviso de tempo insuficiente quando as durações protegidas impedem cumprir o deadline.
- Verificação: lint sem avisos, 221 testes do motor e da interface, build, fluxos completos no Chromium
  em 320/390 px (reserva primeiro, fixas preservadas, recarga, edição e atualização do modelo).
  Sem deploy desta branch.


### Reordenação e nomes das rotinas — branch feat/saved-routine-order

- Nova branch a partir da main atualizada (389f573), preservando as melhorias de timeline e previsão de término.
- Botões ↑/↓ nas rotinas salvas; ordem persistida em localStorage, limites desabilitados e identificação
  por ID para suportar nomes repetidos. Reordenar preserva as edições pendentes do planejamento.
- Links sem nome usam "Rotina fim HH:MM", com o deadline do link. Nomes explícitos são preservados;
  os dois-pontos também funcionam ao copiar e reabrir o link. Rotinas já salvas mantêm seus nomes.
- Documentação do formato v3 atualizada, incluindo os exemplos publicados em /instrucoes.
- Verificação: lint sem avisos, 195 testes e build de produção; Chromium em 320/390 px com salvamento,
  reordenação nos dois sentidos, recarga e importação. Sem deploy desta branch.


### 2026-11-27 — Folga que cresce, marcas de 5 min, tela de rotinas e encerramento único

- Motor: com uma tarefa folga, o tempo que sobra ao concluir devolve às comprimidas o que
  perderam (até a estimativa) e o resto vai para a folga (`giveFreed`). Sem folga, nada muda.
- Alertas: toque leve a cada marca de 5 min acima dos últimos 5 (15, 10...), inclusive ao começar
  numa marca; tipo de alerta urgente ou suave nos Ajustes; tudo também agendado como alarme no
  Android (até 64 alarmes; o plano avança a cada 5 min).
- O app abre na tela de rotinas (`screens/RoutinesScreen`), ordenável por última usada, horário
  final, horário inicial ou manual (`lib/routineSort.js`, `lastUsedAt` nas rotinas salvas).
- Margens das barras do sistema: `--safe-top`/`--safe-bottom` (env() ou as variáveis do
  Capacitor) no topo das telas, no botão fixo inferior e no fim das janelas; cabeçalho do
  planejamento com botões maiores.
- Uma só janela de encerramento (Encerrar, Recomeçar com novo deadline, Editar rotina e Salvar
  alterações só quando a rotina salva mudou); recomeçar rola até o deadline.
- Verificação: lint sem avisos, 289 testes, build web e APK de debug; telas conferidas em
  Chromium (Pixel 7) com barras simuladas de 40 px e 48 px. Não verificado em aparelho.

### 2026-11-20 — Compartilhar, sons, fim da rotina e reordenação

- Execução: botão de compartilhar (link da rotina como está; folha do sistema ou cópia); tarefas
  reordenáveis segurando as duas linhas do card por 0,3 s e arrastando (`moveTask` no motor,
  `hooks/useReorder`), com setas do teclado como alternativa.
- Sons: lembrete suave depois que o tempo da tarefa acaba (a cada 2 min, 5 min ou nunca, nos
  Ajustes; agendado também como alarme no Android); "plim" ao concluir, notas descendentes ao
  adiar/mover, comemoração ao concluir a última tarefa. Todos seguem o interruptor de sons.
- Fim: concluir a última tarefa abre a janela "Rotina concluída" (salvar alterações, recomeçar
  com novo deadline, editar a rotina, encerrar sem salvar).
- Cards mais proporcionais (minutos^0,56, 60 a 320 px); aviso "Squeeze! Faltam X min para caber
  tudo."; título da rotina numa caixa com lápis no planejamento; − e + mudam 1 min até 10 min e
  5 min a partir daí.
- Instruções de links em modo escuro, com o prompt no topo e botão "Copiar prompt"; prompt revisto
  para ser autossuficiente (regras de hífen, tabela de escapes, limites, tipos).
- Verificação: lint sem avisos, 275 testes, build web e APK de debug; arrasto com pressão longa
  por toque, janela de fim e página de instruções conferidos em Chromium com emulação de Pixel 7.
  Não verificado em aparelho: volume dos novos sons e lembretes com a tela apagada.

### 2026-11-17 — Sons à vista e tamanho dos cards

- Planejamento: interruptor "Sons" ao lado de Começar, mostrando Ligados/Desligados; é a mesma
  preferência dos Ajustes.
- Execução: a altura dos cards segue a raiz quadrada dos minutos (`lib/cardSize.js`), entre 60 e
  240 px. Vale para as próximas (restante), as concluídas (tempo gasto), a atual (reservado, como
  altura mínima) e a folga.
- Verificação: lint sem avisos, 253 testes, build; planejamento e execução conferidos em Chromium
  com emulação de Pixel 7. Próximo passo: régua de horários à esquerda (branch separado).

### 2026-11-17 — Assinatura do app e links de rotina no app

- Release assinado: o build lê o keystore do ambiente e o CI o recebe por secrets; o artefato
  `squeeze-apk` instala por cima do anterior sem apagar dados. Sem secrets, o CI gera debug.
- App Links: links de rotina abrem no app instalado (filtro verificado para a raiz do site,
  `/.well-known/assetlinks.json`, evento `routineLink` importado por `App.jsx`).
- Verificação: lint sem avisos, 247 testes, build web; `assembleRelease` assinado com uma chave
  descartável (assinatura, versão e filtro conferidos no APK).
- Impressão digital da chave de release registrada em `app/public/.well-known/assetlinks.json`.
- **Pendente**: cadastrar os secrets de assinatura no GitHub e publicar o site (até lá os links
  abrem no navegador); depois instalar o `squeeze-apk` do CI. Não verificado em aparelho.

### 2026-11-17 — App Android e animações de swipe

- App Android com Capacitor 8 em `app/android/` (pacote `app.squeeze.android`). Os alertas da
  tarefa atual viram alarmes exatos do sistema e tocam com a tela apagada, em Doze ou com o app
  fechado, no volume de alarme; notificação silenciosa quando o app não está em primeiro plano.
  Uma chave por alerta impede toque duplicado entre alarme e WebView. Ver `docs/android.md`.
- No app: "Manter a tela acesa" pela flag nativa, sem service worker, links com o endereço público,
  ícone e splash próprios.
- Swipe: painel de ação que cresce atrás do card e fica sólido (com tique háptico) quando soltar
  vai agir; flick rápido também age; lado sem ação oferece resistência; volta com mola.
- Lista animada (FLIP): o card concluído sai voando para a esquerda e o item concluído surge com
  o ✓ pulsando; o adiado/reativado viaja até o novo lugar; os demais deslizam. Respeita
  `prefers-reduced-motion`.
- Entradas suaves para telas, janelas e avisos; barras de progresso contínuas; botões com retorno
  ao toque.
- CI: job `android` gera o APK de debug como artefato.
- Verificação: lint sem avisos, 245 testes, build web e `assembleDebug`; swipes conferidos em
  Chromium com emulação de Pixel 7 (quadros durante o arrasto e as animações).
- **Não verificado**: execução em aparelho ou emulador Android (indisponível no ambiente). Próximo
  passo: seguir a lista "Verificação manual no aparelho" de `docs/android.md`; depois, assinatura
  de release e abertura de links de rotina direto no app.

### 2026-11-08 — Término se começar agora

- No planejamento e na edição durante a rotina, acima do deadline: "Começando agora, termina às HH:MM",
  quanto sobra ou passa do deadline e o botão "Usar HH:MM como deadline" (horário exato; depois da
  meia-noite só o horário). Na rotina, desconta o que cada tarefa já consumiu (`finishFromNow` no motor).
- Verificação: lint sem avisos, testes e build; tela conferida no Chromium com viewport de iPhone 13.

### 2026-11-07 — Linha do tempo no topo e ações no fim

- Card fixo no topo da execução: início à esquerda, agora no meio, deadline à direita; linha colorida
  que encolhe para a direita com o tempo restante (ou atraso) acompanhando o ponto do agora.
- Editar, Ajustes e Encerrar saíram do topo e foram para depois do card do deadline, à direita.
- Modo descanso: o texto não passa mais da borda da tela.
- Ícone trocado: o S deu lugar a cards espremidos de tamanhos diferentes (feita, atual, próxima,
  última) acima da linha do deadline. PNGs 192/512, maskable, Apple 180 e favicon 16/32/48 gerados
  a partir dos SVGs.
- Verificação: lint sem avisos, testes e build; telas conferidas no Chromium com viewport de iPhone 13.

### 2026-11-06 — Identidade e controles das rotinas

- Ícone próprio: S geométrico verde-lima sobre fundo escuro, fontes SVG, PNGs de 192/512 px,
  versões maskable dentro da área segura, Apple de 180 px e favicons de 16/32/48 px.
- Deadline após as tarefas no planejamento e na edição; na execução, contador, aviso de atraso
  e +5 deadline reunidos após as tarefas e a folga.
- Salvar como pede o nome da cópia e preserva o modelo original. Renomear na lista altera só
  o nome do modelo e acompanha o rascunho correspondente, preservando tarefas não salvas.
  O nome também pode ser editado durante uma execução e atualizado no modelo ao encerrar.
- Alertas com mais volume, sustentação e repetições, crescendo em intensidade nos três limites.
- Janelas acima dos avisos temporários para o campo de nome permanecer visível.
- Verificação: lint sem avisos, 182 testes, build; fluxos de nome, recarga, deadline e atraso
  conferidos em Chromium mobile. Renderização Web Audio offline confirma intensidade e duração
  crescentes sem clipping. Próximo passo: conferir ícone instalado e volume em aparelhos reais.

### 2026-11-04 — Implementação do MVP

- Motor de tempo em `lib/engine.js` (folga primeiro ao tirar tempo; dar tempo pela referência;
  consumido, referência e orçamento separados; tudo por timestamps), com 39 testes.
- Telas de planejamento e execução, cards com swipe e botões equivalentes, edição durante a rotina,
  rotinas salvas, encerramento com atualização do modelo, recomeçar com novo deadline,
  encerramento automático após 12 h, link v3 com documentação para IA, alertas aos 5 min, 1 min e 0,
  modo descanso e tema escuro.
- Removidos a fita infantil, o catálogo de tarefas, manhã/noite, links v1/v2, fontes e os MP3 vazios.
- Decisão de implementação: numa edição durante a rotina, a tarefa atual mantém seu tempo e só as
  próximas são redistribuídas (specifications.md §7.2).

### 2026-11-04 — Especificação

- Decisões: swipe para a direita troca com a seguinte; a rotina só começa no botão Começar;
  começo atrasado comprime todas as tarefas; começo adiantado cria folga; a folga é sempre usada
  primeiro; reativação por swipe para a direita numa concluída; próximas tarefas também podem ser
  concluídas ou adiadas por swipe; deadline na próxima ocorrência; alertas em 5 min, 1 min e 0;
  modo descanso a partir de 2 min.
