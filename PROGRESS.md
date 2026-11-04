# Progresso — Squeeze

Registro do andamento do Squeeze. Atualize a cada etapa concluída: o que foi feito, como foi
verificado e o que vem a seguir. A especificação vigente é [specifications.md](specifications.md).
O histórico da Rotina da Nina fica no repositório do Ver o Tempo.

## Estado atual (2026-11-04)

- Especificação do MVP escrita (`specifications.md`); `CLAUDE.md` e `AGENTS.md` reescritos para o Squeeze.
- O código em `app/` ainda é a base herdada do Ver o Tempo, sem mudanças funcionais.
  Deploy isolado preparado (Worker `squeeze`, ver `docs/deploy.md`); nenhum deploy executado.

## Próximas etapas

Ordem de specifications.md §15:

1. [ ] Motor de tempo (§6) com os exemplos de §6.4 como testes.
2. [ ] Planejamento, horário ideal de início e botão Começar.
3. [ ] Execução com swipes (atual, próximas, concluídas, folga), +5 min, atraso e persistência.
4. [ ] Modo de edição durante a execução.
5. [ ] Rotinas salvas e link v3.
6. [ ] Alertas sonoros e modo descanso.

## Registro

### 2026-11-04 — Especificação

- Decisões: swipe para a direita troca com a seguinte; a rotina só começa no botão Começar;
  começo atrasado comprime todas as tarefas; começo adiantado cria folga; a folga é sempre usada
  primeiro; reativação por swipe para a direita numa concluída; próximas tarefas também podem ser
  concluídas ou adiadas por swipe; deadline na próxima ocorrência; alertas em 5 min, 1 min e 0;
  modo descanso a partir de 2 min.
