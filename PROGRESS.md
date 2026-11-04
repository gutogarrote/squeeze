# Progresso — Squeeze

Registro do andamento do Squeeze. Atualize a cada etapa concluída: o que foi feito, como foi
verificado e o que vem a seguir. A especificação vigente é [specifications.md](specifications.md).
O histórico da Rotina da Nina fica no repositório do Ver o Tempo.

## Estado atual (2026-11-04)

O MVP da especificação está implementado em `app/` e substituiu o código do Ver o Tempo.
Verificado com lint sem avisos, 171 testes em 14 arquivos e build de produção; telas conferidas
no Chromium com viewport de iPhone 13. Nenhum deploy executado.

## Etapas

1. [x] Motor de tempo (§6) com os exemplos de §6.4 como testes.
2. [x] Planejamento, horário ideal de início e botão Começar.
3. [x] Execução com swipes (atual, próximas, concluídas, folga), +5 min, atraso e persistência.
4. [x] Modo de edição durante a execução.
5. [x] Rotinas salvas e link v3.
6. [x] Alertas sonoros e modo descanso.

## Pendências conhecidas

- Testar em aparelhos reais (Android e iPhone): gestos, som, tela acesa e instalação como app.
- Ícones do app ainda são os do Ver o Tempo.
- Reordenar tarefas usa botões ▲▼; arrastar seria mais rápido no celular.
- Os toques são sintetizados (Web Audio); podem ser trocados por sons próprios.

## Registro

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
