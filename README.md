# Squeeze — There's always room for one more thing

Squeeze é um app de planejamento reverso para o dia a dia. Você define até que horas
precisa terminar (o *deadline*) e a sequência de tarefas, e o app responde:

- **Antes de começar:** que horas preciso começar?
- **Depois de começar:** o que ainda cabe no tempo que me resta?

Nenhuma tarefa termina sozinha. Enquanto a tarefa atual não é concluída, ela continua
consumindo tempo e as próximas vão sendo espremidas, sem mover o deadline.

É derivado do [Ver o Tempo](https://github.com/gutogarrote/ver-o-tempo), mas é um app
independente, com build e deploy próprios. A especificação completa está em
[specifications.md](specifications.md).

## Como funciona

**Planejar.** Dê um nome à rotina, escolha o deadline e liste as tarefas com a duração
estimada. O app mostra em destaque o horário ideal de início (deadline menos a soma das
estimativas). Se esse horário já passou, mostra o atraso e quanto as tarefas serão comprimidas.
O deadline vale a próxima ocorrência do horário: às 23h, escolher 01:00 significa amanhã.

**Começar.** A rotina só começa quando você toca em **Começar**.

- Adiantado: a diferença vira uma **folga**, no fim da lista.
- Atrasado: todas as tarefas, inclusive a primeira, são comprimidas na mesma proporção.

**Executar com gestos.**

| Onde | ← Swipe para a esquerda | Swipe para a direita → |
| --- | --- | --- |
| Tarefa atual | Conclui | Adia: troca de lugar com a seguinte |
| Próximas tarefas | Conclui antes da vez | Adia: troca com a seguinte |
| Tarefa concluída | — | Reativa: volta a ser a atual |
| Folga | Distribui a folga entre as tarefas | — |

Tocar num card mostra os mesmos comandos como botões.

**O tempo se ajusta sozinho.**

- Se a tarefa atual estoura, o excesso sai primeiro da folga e depois das próximas
  tarefas, proporcionalmente (uma tarefa maior perde mais).
- Se você conclui antes, a sobra é dividida entre as próximas, que crescem.
- **+5 min** aparece quando faltam 5 minutos para a tarefa atual; **+5 deadline** está sempre à mão.
- **Editar** permite mudar durações, incluir, remover e reordenar tarefas durante a rotina.
- Depois do deadline, um aviso vermelho mostra o atraso em tempo real. Tudo continua funcionando.

**Alertas e tela.** Toques aos 5 minutos, a 1 minuto e quando o tempo da tarefa acaba.
Em **Ajustes** dá para desligar os sons, manter a tela acesa e escolher o modo descanso
(tela preta depois de 2, 5 ou 10 minutos sem toques; um toque volta).

**Rotinas salvas.** Salve uma rotina com nome para reutilizar. Ajustes feitos durante a
execução não mudam a rotina salva, a não ser que você escolha atualizá-la ao encerrar.
Também dá para recomeçar as mesmas tarefas com um novo deadline.

A rotina em andamento fica salva no aparelho: fechar e reabrir o app conta o tempo
que passou. Uma rotina esquecida é encerrada 12 horas depois do deadline.

## Links de rotina

Um link abre uma rotina pronta no planejamento, por exemplo
[esta tarde de trabalho](https://squeeze.ggarrote.workers.dev/?rotina=3.1500.Or%C3%A7amento-60.Guardar_equipamentos-20.Banho_e_troca_de_roupa-25.Almo%C3%A7o-20.Preparar_sa%C3%ADda-20&nome=Tarde),
com deadline às 15:00 e início ideal às 12:35. **Copiar link** no planejamento gera o link
da rotina aberta. As [instruções do formato v3](docs/url-rotina-v3.md) são completas e
podem ser entregues a uma IA para montar links; o build as publica em `/instrucoes`.

## Apps Android e iPhone

O Squeeze também pode ser compilado como app Capacitor, mantendo a interface e o
motor da versão web. Os apps usam notificações locais com sons próprios para os
avisos da tarefa atual, inclusive com a tela bloqueada e sem internet. Alterar a
tarefa, acrescentar minutos, encerrar a rotina ou desligar os sons cancela/recalcula
os avisos. O Android pode atrasar ou agrupar essas notificações; não há modo de
despertador nem permissão de alarme exato. Os ajustes de som do aparelho prevalecem.

Instalação pessoal, compilação, assinatura, permissões e roteiro de teste em aparelhos:
[docs/native.md](docs/native.md). A PWA continua disponível, com sua limitação de som
em segundo plano. Os dados do app nativo são separados dos dados do navegador/PWA.

## Privacidade

Tudo fica no navegador (`localStorage`). Não há conta, servidor, sincronização ou telemetria.
Os dados de cada endereço (localhost, workers.dev) são separados.

## Desenvolvimento

Use Node **26.13.0** (`nvm use` na raiz). Em `app/`:

```bash
npm ci
npm start
npm run lint -- --max-warnings=0
npm test -- --run
npm run build
```

`npm start` abre o servidor de desenvolvimento em `http://localhost:3000`.
O CI roda lint, testes e build. O guia técnico está em [CLAUDE.md](CLAUDE.md) e as
convenções em [AGENTS.md](AGENTS.md). Instalação como app, offline e atualização:
[docs/pwa.md](docs/pwa.md). Manutenção de dependências: [docs/dependency-maintenance.md](docs/dependency-maintenance.md).

## Implantação

O deploy é um Cloudflare Worker `squeeze` só com assets estáticos, independente do Ver o
Tempo. Passos, verificação e rollback em [docs/deploy.md](docs/deploy.md).
