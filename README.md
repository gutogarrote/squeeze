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

**Planejar.** Dê um nome à rotina, liste as tarefas com a duração estimada e escolha o
deadline ao final da lista. O app mostra em destaque o horário ideal de início (deadline menos a soma das
estimativas). Se esse horário já passou, mostra o atraso e quanto as tarefas serão comprimidas.
O deadline vale a próxima ocorrência do horário: às 23h, escolher 01:00 significa amanhã.
Acima do deadline, o app mostra a que horas tudo terminaria se você começasse agora, quanto sobra
ou passa do deadline, e um botão para usar esse horário como deadline. O mesmo aparece em **Editar**
durante a rotina.

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

**Tipos de tarefa.** Ao criar ou editar, marque **Fixo** para preservar a duração ou **Folga**
para reservar tempo que absorve atrasos antes das outras tarefas. Os seletores são exclusivos:
pode haver várias fixas e uma folga por rotina. Sem seleção, a tarefa continua flexível.
A folga automática soma-se à reserva escolhida. As fixas só gastam tempo enquanto estão ativas;
se não couberem no deadline, o app mantém a duração e mostra o excesso.

**O tempo se ajusta sozinho.**

- Se a tarefa atual estoura, o excesso sai primeiro da folga e depois das próximas
  tarefas, proporcionalmente (uma tarefa maior perde mais).
- Se você conclui antes, a sobra é dividida entre as próximas, que crescem.
- **+5 min** aparece quando faltam 5 minutos para a tarefa atual; **+5 deadline** está sempre à mão.
- **Editar** permite mudar durações, incluir, remover e reordenar tarefas durante a rotina.
- Uma linha do tempo fixa no topo mostra início, agora e deadline, com o tempo restante.
- O deadline, o contador e **+5 deadline** ficam ao final das tarefas e da folga, seguidos de
  **Editar**, **Ajustes** e **Encerrar**. Depois
  do deadline, esse card fica vermelho e mostra o atraso em tempo real. Tudo continua funcionando.

**Alertas e tela.** Toques mais fortes e repetidos aos 5 minutos, a 1 minuto e quando o
tempo da tarefa acaba, com intensidade crescente.
Em **Ajustes** dá para desligar os sons, manter a tela acesa e escolher o modo descanso
(tela preta depois de 2, 5 ou 10 minutos sem toques; um toque volta).

**Rotinas salvas.** Use ↑ e ↓ na lista para reordenar as rotinas; a ordem fica salva no aparelho. Salve uma rotina com nome para reutilizar. **Salvar como…** pede um
nome e cria uma cópia, preservando a original. Em **Rotinas → Renomear**, mude o nome de
uma rotina salva sem gravar outras alterações pendentes. O nome também pode ser editado
durante a execução. Ajustes feitos durante a
execução não mudam a rotina salva, a não ser que você escolha atualizá-la ao encerrar.
Também dá para recomeçar as mesmas tarefas com um novo deadline.

A rotina em andamento fica salva no aparelho: fechar e reabrir o app conta o tempo
que passou. Uma rotina esquecida é encerrada 12 horas depois do deadline.

## Links de rotina

Um link abre uma rotina pronta no planejamento, por exemplo
[esta tarde de trabalho](https://squeeze.ggarrote.workers.dev/?rotina=3.1500.Or%C3%A7amento-60.Guardar_equipamentos-20.Banho_e_troca_de_roupa-25.Almo%C3%A7o-20.Preparar_sa%C3%ADda-20&nome=Tarde),
com deadline às 15:00 e início ideal às 12:35. Links sem nome abrem como **Rotina fim HH:MM**, com o horário final do link.
**Copiar link** no planejamento gera o link
da rotina aberta. As [instruções do formato v3](docs/url-rotina-v3.md) são completas e
podem ser entregues a uma IA para montar links; o build as publica em `/instrucoes`.

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
