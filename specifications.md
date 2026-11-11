# Squeeze — Especificação vigente (MVP)

*There's always room for one more thing.*

Esta especificação substitui a da Rotina da Nina (Ver o Tempo). A visão original do
Ver o Tempo continua em `original_specification.md`, apenas como histórico. O andamento da
implementação está em `PROGRESS.md`.

## 1. Conceito

Squeeze é um app de planejamento reverso e gestão dinâmica do tempo para adultos.

O usuário define um horário final (*deadline*) e uma sequência de tarefas com duração estimada.
O app calcula **a que horas é preciso começar** e, durante a execução, adapta o plano ao tempo
real: enquanto uma tarefa não é concluída, ela continua consumindo tempo e as seguintes são
espremidas, sem mover o deadline.

**O deadline é fixo; o planejamento é flexível.**

- **Antes de começar:** "Que horas preciso começar?"
- **Depois de começar:** "O que ainda cabe no tempo que me resta?"

## 2. Vocabulário

Estes valores são sempre guardados separadamente e nunca confundidos:

| Termo | Significado |
|---|---|
| **Estimativa** | Duração planejada da tarefa (do modelo ou editada nesta execução). |
| **Consumido** | Tempo em que a tarefa foi de fato a tarefa atual. Nunca é apagado nem contado duas vezes. |
| **Referência** | Quanto ainda falta pela estimativa: `estimativa − consumido`, mínimo 0. |
| **Orçamento** | Tempo que o plano reserva para a tarefa nesta execução. Pode ser maior (expandida) ou menor (comprimida) que a estimativa. |
| **Restante** | `orçamento − consumido`. Na tarefa atual pode ficar negativo: é o excesso (`-5 min`). |
| **Folga** | Reserva de tempo criada ao começar adiantado (ou que sobra quando não há mais tarefas). Fica no fim, logo antes do deadline. |

### Tipos de tarefa

No editor, cada tarefa tem seletores **Fixo** e **Folga**, mutuamente exclusivos. Sem nenhum selecionado,
ela continua flexível, como nas rotinas existentes. Pode haver várias fixas, mas só uma folga por rotina.

- **Fixo:** preserva a duração escolhida; não perde nem recebe tempo automaticamente. Só o tempo
  efetivamente ativo reduz seu restante. Adiar, concluir, reativar e reabrir o app preservam o tempo
  consumido. Editar a duração ou usar +5 min é uma mudança explícita dessa duração.
- **Folga:** reserva única, consumida antes de qualquer squeeze nas tarefas flexíveis. A folga criada
  ao começar adiantado soma-se à folga escolhida; não há dois cards de reserva. Ela aparece no fim da
  timeline e não vira tarefa atual. Distribuir folga libera seu restante apenas para tarefas flexíveis.
- As regras de distribuição e compressão abaixo se aplicam às tarefas **flexíveis**, excluindo as fixas
  e usando primeiro a folga. No começo atrasado, a folga é reduzida antes das tarefas flexíveis.
- Se as fixas não couberem no tempo disponível, suas durações são preservadas e o excesso é mostrado.
  A igualdade de §6.1 só vale enquanto as durações protegidas couberem até o deadline. Tempo liberado
  por uma conclusão paga esse excesso antes de ser redistribuído.
- Os tipos são mantidos em modelos salvos, rascunhos, execução ativa, edição, recomeço e links.

## 3. Planejamento (antes de começar)

O usuário pode:

- Dar um nome à rotina e definir o deadline.
- Criar, editar, remover e reordenar tarefas (nome e estimativa em minutos).
- Importar um plano completo por link (§14).

O campo de deadline fica ao final da lista de tarefas, também na edição durante a execução.

Logo acima dele, o app mostra **a que horas a rotina terminaria se começasse agora** (agora + soma das
estimativas, arredondado para cima ao minuto) e quanto sobra ou passa do deadline. O botão
**Usar HH:MM como deadline** troca o deadline por esse horário, exato. Depois da meia-noite mostra só o
horário (ex.: às 23:12, com 73 min de tarefas, 00:25), que vale como próxima ocorrência.

### Horário ideal de início

`início ideal = deadline − soma das estimativas`.

Exemplo: deadline 15h; tarefas de 60, 20, 25, 20 e 20 min (145 min) → **começar às 12h35**.

O início ideal aparece em destaque, junto com o tempo total e o deadline, e é atualizado a cada
edição. Enquanto a rotina não começa:

- **Adiantado:** mostra quanto falta para o início ideal e que, se começar agora, haverá `+X min` de folga.
- **Atrasado:** mostra o atraso e quanto será comprimido (`faltam X min; as tarefas terão Y% da estimativa`).

### Interpretação do deadline

O deadline é um horário do dia e vale a **próxima ocorrência**: se o horário já passou hoje, é
amanhã. Ex.: às 23h, `01:00` é amanhã; às 00h30, `02:00` é hoje; às 14h, `10:00` é amanhã.

A margem de segurança é escolhida pelo usuário no próprio deadline; não há configuração de tolerância.

### Começar

A rotina **só começa quando o usuário toca em "Começar"**. O relógio da execução parte desse instante:

- **No horário ou adiantado:** cada tarefa recebe orçamento igual à estimativa. A diferença entre
  o tempo disponível e a soma das estimativas vira **folga**.
- **Atrasado:** **todas** as tarefas, inclusive a primeira, recebem orçamento comprimido pelo mesmo
  fator: `orçamento = estimativa × (tempo disponível ÷ soma das estimativas)`. Não há folga.
- **Depois do deadline:** todas as tarefas começam com orçamento 0 e o contador de atraso já aparece (§9).

## 4. Execução: a timeline

A tela mostra, de cima para baixo:

1. **Linha do tempo**, fixa no topo o tempo todo: horário de início da rotina à esquerda, horário
   atual no meio e deadline à direita. Embaixo, uma linha colorida começa cheia e encolhe da esquerda
   para a direita conforme o tempo passa; o tempo restante (ou o atraso) acompanha o ponto do agora.
   Verde normalmente, âmbar quando faltar tempo para caber tudo, vermelha depois do deadline.
2. Tarefas concluídas, no lugar em que estavam, visualmente esmaecidas.
3. **Tarefa atual** em destaque: nome, restante (ou excesso), consumido e estimativa.
4. Próximas tarefas, com o orçamento ajustado.
5. Card de **folga**, quando houver.
6. Card do **deadline**, com horário, contador e +5 deadline.
7. Botões **Editar**, **Ajustes** e **Encerrar**, alinhados à direita, ao alcance do polegar.

**Nenhuma tarefa termina automaticamente.** Mesmo com o restante esgotado, a tarefa continua
sendo a atual até o usuário concluí-la ou adiá-la.

## 5. Gestos

| Onde | Swipe para a esquerda | Swipe para a direita |
|---|---|---|
| **Tarefa atual** | Conclui. A próxima vira a atual. | Adia: troca de lugar com a próxima, que vira a atual. |
| **Tarefa atual, sendo a última pendente** | Conclui. | Não faz nada: o card desliza e volta. O tempo continua contando. |
| **Tarefa concluída** | Não faz nada (desliza e volta). | **Reativa**: ela vira a atual e a atual anterior vira a próxima. |
| **Próxima tarefa (não atual)** | Conclui antes da vez. A tarefa atual continua a atual. | Adia: troca de lugar com a seguinte. Se for a última pendente, desliza e volta. |
| **Folga** | Marca a folga como feita: o tempo é distribuído (§6.3). | Não faz nada (desliza e volta). |

Não há bolinhas nem caixas de seleção de conclusão: os swipes substituem esse mecanismo.
Reativar é o "desfazer" de uma conclusão.

Exemplo de conclusão antecipada: durante "Arrumar equipamento" ainda faltam "Guardar equipamento no
carro", "Escrever orçamento" e "Almoçar". Quem come algo enquanto arruma faz swipe para a esquerda em
"Almoçar": ela é concluída, o orçamento dela é distribuído e "Arrumar equipamento" segue como a atual.

## 6. Regras de tempo

### 6.1 Princípio

Enquanto o deadline não passou, vale sempre:

```
agora + restante da atual (se positivo) + orçamentos das próximas + folga = deadline
```

Toda operação abaixo preserva essa igualdade. Ela também serve de verificação nos testes.

### 6.2 Tirar e dar tempo

Todas as mudanças se reduzem a duas operações:

**Tirar T minutos** (para quem precisa de mais tempo):

1. Primeiro da **folga**, até ela zerar. A folga é sempre usada primeiro, mesmo que haja tarefas
   com orçamento maior que a estimativa.
2. O que faltar sai das **outras tarefas pendentes**, proporcionalmente aos seus orçamentos restantes
   (todas perdem o mesmo percentual; uma tarefa de 40 min perde o dobro de uma de 20 min).
3. Nenhum orçamento fica negativo. Se tudo chegar a zero, o que faltar vira atraso em relação ao deadline.

**Dar T minutos** (quando sobra tempo):

1. Vai para as **outras tarefas pendentes**, proporcionalmente às suas referências
   (quem ainda precisa de mais recebe mais). As tarefas podem passar da estimativa (expandir).
2. Se nenhuma tarefa pendente tiver referência maior que zero, o tempo vai para a **folga**
   (que passa a representar tempo livre até o deadline).

### 6.3 Eventos

| Evento | Efeito |
|---|---|
| **Tarefa atual dentro do orçamento** | Só o restante dela diminui. As outras não mudam. |
| **Tarefa atual estourando** | Cada segundo de excesso é **tirado** (folga primeiro, depois as pendentes). O excesso aparece em negativo (`-2 min`). |
| **Concluir a atual** | Se sobrou restante, ele é **dado** às pendentes (que crescem). O restante da tarefa concluída é guardado para uma eventual reativação. |
| **Concluir uma próxima tarefa** | Todo o restante dela é **dado** às outras pendentes, incluindo a atual. Fica guardado para uma eventual reativação. O tempo já consumido (se ela foi atual antes de um adiamento) continua registrado. |
| **Adiar** | A tarefa troca de lugar com a seguinte e **conserva o restante** (orçamento e consumido não mudam). Se tinha estourado, volta com 0 min. Adiar uma próxima tarefa não muda nenhum tempo, só a ordem. |
| **Reativar uma concluída** | Ela vira a atual com o restante que tinha ao ser concluída (0 se tinha estourado). Esse tempo é **tirado** (folga primeiro, depois as pendentes, incluindo a atual anterior, que agora é a próxima e fica pausada com o tempo que já gastou). |
| **+5 min na tarefa atual** | O orçamento dela aumenta 5 min, **tirados** (folga primeiro, depois as seguintes). |
| **Marcar a folga como feita** | A folga inteira é **dada** a todas as pendentes, incluindo a atual. A folga desaparece. |
| **+5 min no deadline** | Os 5 min são **dados** às pendentes, incluindo a atual. |

### 6.4 Exemplos

Base: deadline 16h; A 30 min, B 60 min, C 30 min; início ideal 14h.

1. **Estouro sem folga.** Começou às 14h. Às 14h45 A segue ativa (15 min de excesso):
   B fica com 50 min e C com 25 min. O deadline continua às 16h.
2. **Estouro com folga.** Começou às 13h40, então há 20 min de folga. Às 14h25 A tem 15 min de excesso:
   a folga cai para 5 min, B e C não mudam. Às 14h35 (25 min de excesso) a folga zerou e os 5 min
   restantes saem de B e C: B fica com 56:40 e C com 28:20.
3. **Começo atrasado.** Começou às 14h30, com 90 min para 120 min de estimativas (fator 0,75):
   A fica com 22:30, B com 45:00, C com 22:30.
4. **Conclusão antecipada.** Começou às 14h e concluiu A às 14h20 (sobraram 10 min).
   B e C recebem 6:40 e 3:20: ficam com 66:40 e 33:20.
5. **Adiamento.** Começou às 14h; às 14h10 adiou A (restavam 20 min). Ordem: B (atual, 60 min),
   A (20 min), C (30 min).
6. **Reativação.** Continuando o exemplo 4, às 14h30 (B com 56:40 restantes, C com 33:20) o usuário
   reativa A. A volta como atual com 10 min, tirados de B e C na proporção dos orçamentos:
   B fica com 50:22 (pausada, como próxima) e C com 29:38.

### 6.5 Tempo insuficiente

Sempre que a soma das referências das pendentes for maior que o tempo disponível, o app mostra
claramente **quanto falta** (`faltam 15 min para caber tudo`). Cada tarefa comprimida mostra o orçamento
e a estimativa (`45 de 60 min`), para não parecer que o esforço necessário diminuiu.

## 7. Ajustes durante a execução

### 7.1 +5 min na tarefa atual

O botão **+5 min** aparece quando o restante da tarefa atual chega a 5 min ou menos, e continua
disponível depois que ela estoura. Cada toque segue a regra de §6.3.

### 7.2 Modo de edição

Disponível antes e durante a execução. Permite mudar o nome da rotina, renomear tarefas,
mudar a estimativa, incluir, remover e reordenar tarefas pendentes, e mudar o deadline.
Tarefas concluídas não são editadas (reative primeiro).

Ao salvar uma edição durante a execução:

- **Tarefa atual com estimativa alterada:** o orçamento dela muda na mesma medida, sem ficar abaixo do
  consumido (reduzir a estimativa não apaga tempo gasto). Aumentos são **tirados**; reduções são **dados**.
- **Próximas tarefas** (inclusões, remoções e mudanças de estimativa): se a soma das referências aumentou,
  a folga cobre o aumento primeiro. Em seguida, o tempo reservado às próximas tarefas é **redistribuído
  entre elas proporcionalmente às referências**. Assim, incluir uma tarefa nova divide o tempo que sobrou
  com as tarefas ainda por fazer, e reduzir uma estimativa faz as outras crescerem.
- **Reordenação:** a primeira pendente vira a atual. Se mudou, a atual anterior fica pausada como num adiamento.
- **Deadline:** adiar o deadline **dá** tempo às pendentes; antecipá-lo **tira** tempo (folga primeiro).
- **Término seguindo as estimativas:** como no planejamento, a edição mostra a que horas tudo terminaria
  a partir de agora (o que falta de cada estimativa, descontado o tempo já consumido) e permite usar esse
  horário como deadline.
- O recálculo é imediato.

É assim que se responde "o que ainda cabe?": quem adianta as tarefas vê as próximas crescerem (ou a
folga) e pode incluir novas tarefas para aproveitar o tempo até o deadline.

## 8. Encerramento

- O usuário pode encerrar a rotina a qualquer momento (com confirmação).
- Ao encerrar, pode escolher **atualizar o modelo** com as tarefas e estimativas desta execução.
- Uma rotina aberta é encerrada automaticamente **12 horas depois do deadline**.

## 9. Deadline e atraso

Quando o deadline é atingido:

- Aparece um aviso destacado em vermelho: o tempo acabou.
- Um contador negativo em tempo real mostra o atraso (`-5:20`, `-10:03`), baseado no relógio real.
- As pendentes ficam com orçamento 0; a tarefa atual continua mostrando o próprio excesso.
- Concluir, adiar, reativar, editar e +5 min continuam disponíveis. A rotina não termina sozinha.

## 10. Alertas sonoros

Três toques, baseados no **restante da tarefa atual**:

| Momento | Toque |
|---|---|
| Restante chega a **5 min** | Dois toques firmes. |
| Restante chega a **1 min** | Três toques mais fortes. |
| Restante chega a **0** (tempo esgotado) | Seis toques alternados, mais intensos e prolongados. |

Regras:

- Cada toque soa uma vez por ativação da tarefa.
- Quando uma tarefa vira a atual (por conclusão ou adiamento da anterior, ou por reativação) já abaixo
  de um limite, soa **na hora** o toque do limite mais severo já alcançado, sem tocar dois sons juntos.
  Ex.: uma tarefa de 3 min toca o aviso de 5 min ao começar e o de 1 min depois; uma tarefa adiada já
  estourada toca o toque intenso assim que volta a ser a atual.
- Um +5 min que leva o restante de volta para cima de um limite rearma aquele toque.
- O usuário liga e desliga os sons. Os alertas nunca mudam o estado das tarefas.
- Os tons sustentam o volume antes de desaparecer; volume, duração e repetição crescem com a urgência.
- Os toques são sintetizados no próprio app (Web Audio), sem arquivos de som. O áudio é liberado no toque em "Começar".

Prioridade: os alertas vêm **depois** da primeira versão de UI/UX.

## 11. Tela acesa e modo descanso

Navegadores suspendem o app (e o som) quando o celular bloqueia. Por isso:

- **Manter a tela acesa** (opção já existente, `useScreenWakeLock`), ativa durante a execução.
- **Modo descanso:** após um período sem toques (padrão 2 min; opções 2, 5 ou 10 min, ou nunca),
  a tela fica preta, com só a tarefa atual e o restante em cinza bem escuro, mudando de posição devagar
  para não marcar a tela. Um toque volta ao app; esse primeiro toque não aciona gestos. Um alerta sonoro
  também tira a tela do descanso.

Limitações conhecidas: um site não consegue reduzir o brilho do aparelho. Em telas OLED (a maioria dos
celulares recentes) o preto praticamente apaga os pixels e economiza bateria; em telas LCD a luz de
fundo continua ligada. Manter a tela acesa depende do navegador; no iPhone, com o app instalado na
tela de início, versões antigas do iOS falhavam (as recentes funcionam). Testar nos aparelhos reais.

## 12. Visual e interface

Abandonar a estética infantil: ferramenta elegante, moderna e dinâmica. Priorizar:

- Início ideal em destaque no planejamento; deadline e tempo até ele na execução.
- Tarefa atual com contador e restante ou excesso.
- Próximas tarefas com orçamento ajustado e, quando comprimidas, a estimativa ao lado.
- Compressão visível em tempo real; atrasos e tempo insuficiente bem sinalizados.
- Concluídas diferenciadas das pendentes; folga como um card próprio.
- Gestos fluidos no celular, com resposta visual (o card acompanha o dedo e "balança" quando o gesto não faz nada).

### Altura dos cards

Proporcional ao restante de cada tarefa, entre **64 px** e **144 px**. Nenhum card some ou fica
ilegível quando o tempo se esgota. Proporções finais ficam a critério do design.

## 13. Rotinas salvas e persistência

Não há rotinas fixas de manhã e noite. O usuário pode:

- Criar uma rotina nova e salvá-la com nome.
- Abrir, modificar e salvar de novo uma rotina salva.
- **Salvar como…**: escolher um nome para uma nova cópia, preservando a rotina original.
- Reordenar rotinas salvas com botões de subir e descer; a ordem é persistida no aparelho.
- **Renomear** na lista de rotinas salvas: mudar só o nome, sem alterar tarefas ou deadline
  nem gravar edições pendentes no planejamento. O rascunho aberto acompanha o novo nome
  quando corresponde à rotina renomeada.
- Reiniciar uma rotina com as mesmas tarefas e estimativas, informando só um novo deadline.

Rotinas salvas são **modelos**: ajustes feitos durante a execução não alteram o modelo, a não ser que
o usuário escolha atualizá-lo (§8).

### Execução ativa

- Só há uma execução ativa por vez, salva localmente (`localStorage`) a cada mudança.
- Todo o tempo é calculado a partir de **timestamps reais** (início da rotina, início da ativação da
  tarefa atual, eventos), nunca de contadores em memória.
- Ao reabrir o app 20 min depois: a tarefa continua a atual, os 20 min são contados, as próximas
  aparecem recalculadas e o deadline não muda.

## 14. Importação por link (versão 3)

Mesma ideia do link do Ver o Tempo, sem manhã/noite e sem o catálogo de tarefas infantis:

```
/?rotina=3.<HHMM>.<Tarefa>-<min>.<Tarefa>-<min>...&nome=<Nome_da_rotina>
```

Exemplo (o plano de §3):

```
/?rotina=3.1500.Orçamento-60.Guardar_equipamentos-20.Banho_e_troca_de_roupa-25.Almoço-20.Preparar_saída-20&nome=Tarde
```

- `HHMM`: deadline, obrigatório, interpretado como na §3.
- Nomes: `_` vale espaço; pontuação usa o escape `~XX` da v2; letras acentuadas e emojis podem ir
  literalmente (ou codificados em `%XX`). Emojis são só parte do nome, opcionais.
- `tipos` é opcional: lista de `normal`, `fixo` ou `folga`, separada por vírgulas, com uma entrada por tarefa e no máximo uma folga.
- `nome` é opcional; sem ele, a rotina se chama "Rotina fim HH:MM", usando o deadline do link (ex.: "Rotina fim 20:30").
- Limites: até 40 tarefas, de 1 a 720 min cada, no máximo 1440 min no total.
- Abrir um link cria uma rotina em planejamento, sem sobrescrever modelos salvos (o usuário pode salvá-la).
  Se houver uma execução ativa, o app pergunta antes de substituí-la.
- Links v1/v2 do Ver o Tempo não precisam ser aceitos.
- A gramática está documentada em `docs/url-rotina-v3.md`, para que agentes de IA gerem links; o build a publica em `/instrucoes`.

## 15. Diretrizes de desenvolvimento

- Funciona localmente, sem cadastro, backend ou serviços externos. Boa experiência mobile, simples e rápido.
- Independente do Ver o Tempo, inclusive em build e deploy (Worker `squeeze`, ver `docs/deploy.md`).
- O motor de tempo fica em funções puras (`app/src/lib/`) que recebem `nowMs`, com os exemplos de §6.4
  como testes.

### Herança do Ver o Tempo

Foram mantidos Vite/React/Tailwind, a PWA (`app/src/pwa`), `useScreenWakeLock`, as funções de divisão
proporcional (`lib/split.js`), a gramática de nomes dos links e o deploy na Cloudflare. O motor de agenda
(no Ver o Tempo as tarefas terminam sozinhas quando o horário passa), a UI infantil, o catálogo de
tarefas, a estrutura manhã/noite e a sessão em memória foram substituídos.

## 16. Fora do MVP

- **Aprendizado das estimativas:** histórico do tempo gasto por tarefa e sugestões de estimativas, sem
  alterar modelos automaticamente.
- **Integrações** com TickTick, Todoist ou Trello para importar tarefas.
