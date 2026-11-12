# Progresso — Squeeze

Registro do andamento do Squeeze. Atualize a cada etapa concluída: o que foi feito, como foi
verificado e o que vem a seguir. A especificação vigente é [specifications.md](specifications.md).
O histórico da Rotina da Nina fica no repositório do Ver o Tempo.

## Estado atual (2026-11-12)

O MVP da especificação está implementado em `app/` e substituiu o código do Ver o Tempo.
A PWA continua disponível; projetos Capacitor Android/iPhone acrescentam notificações
locais offline com sons próprios e sem permissão de alarme exato.
Verificado com ESLint sem avisos, 203 testes em 19 arquivos, build de produção,
`native:sync`, compilação do APK Android e Android lint. O APK foi inspecionado:
os três WAVs e o bundle final estão presentes; não há permissão de alarme exato.
Smoke test no Chromium móvel: começar, ajustes, reload e persistência, sem prompt
nativo na web nem erros JavaScript. Nenhum deploy executado.

iOS: projeto, recursos, manifest de privacidade e referências validados estaticamente;
compilação/assinatura exigem Mac/Xcode e não foram executadas neste ambiente Linux.
Entrega de sons com tela bloqueada/Doze ainda exige aparelhos reais. O CI agora inclui
build Android/lint e build iOS para simulador sem assinatura.

## Etapas

1. [x] Motor de tempo (§6) com os exemplos de §6.4 como testes.
2. [x] Planejamento, horário ideal de início e botão Começar.
3. [x] Execução com swipes (atual, próximas, concluídas, folga), +5 min, atraso e persistência.
4. [x] Modo de edição durante a execução.
5. [x] Rotinas salvas e link v3.
6. [x] Alertas sonoros e modo descanso.
7. [x] Projetos Capacitor e notificações locais; guia de instalação e testes em `docs/native.md`.

## Pendências conhecidas

- Testar em aparelhos reais (Android e iPhone): gestos, som, tela acesa e instalação como app.
- Ícones do app ainda são os do Ver o Tempo.
- Reordenar tarefas usa botões ▲▼; arrastar seria mais rápido no celular.
- Na web os toques são sintetizados (Web Audio); nos apps nativos são WAVs gerados da mesma fonte.

## Registro

### 2026-11-12 — Apps Android/iPhone e alertas em segundo plano

- Projetos Capacitor 8 (`dev.ggarrote.squeeze`), dependências fixadas e comandos
  `native:sync`, `android:build`, `android:open` e `ios:open`. Ícones correspondem à
  versão web; os três sons são gerados de `lib/alertTones.mjs` antes do sync.
- Controlador agenda somente os próximos limites da tarefa atual ao perder foco;
  alterações, +5 min, edição, deadline, encerramento e mute invalidam o agendamento.
  Cancelamento/reagendamento serializado, proteção contra respostas atrasadas e
  retomada silenciosa evitam avisos antigos e repetições. Foreground mantém Web Audio.
- Permissão e erros em Ajustes, com tentativa explícita. Android usa notificações
  inexatas que podem acordar o aparelho, sujeitas a atraso/agrupamento; sem modo de
  despertador nem solicitação de “Alarmes e lembretes”. Não há backend.
- A PWA mantém seu comportamento; o app nativo não registra service worker e copia
  links usando o endereço público, em vez do localhost privado do WebView.
- Verificações: 203 testes, ESLint, build/sync, APK + Android lint, inspeção das
  permissões/sons/bundle do APK e smoke test web móvel. Plists/XML e referências dos
  recursos iOS conferidos. Falta compilar/assinar iOS no Mac e validar sons em aparelhos.
- Guia de instalação pessoal, assinatura, TestFlight, limites de entrega e roteiro
  para aparelhos em `docs/native.md`. Sem publicação em loja ou deploy web.

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
