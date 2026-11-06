# Progresso — Squeeze

Registro do andamento do Squeeze. Atualize a cada etapa concluída: o que foi feito, como foi
verificado e o que vem a seguir. A especificação vigente é [specifications.md](specifications.md).
O histórico da Rotina da Nina fica no repositório do Ver o Tempo.

## Estado atual (2026-11-06)

O MVP da especificação está implementado em `app/` e substituiu o código do Ver o Tempo.
Inclui identidade visual própria, deadline ao fim da rotina, salvar como e renomear, e alertas
mais intensos. Verificado com lint sem avisos, 182 testes em 15 arquivos e build de produção;
telas conferidas no Chromium em larguras de 320 e 390 px. Nenhum deploy executado.

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
