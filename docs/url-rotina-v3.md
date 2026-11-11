# Instruções oficiais — links de rotina v3

Um link v3 abre no Squeeze uma rotina pronta: deadline, tarefas, durações e ordem. Este documento é completo e pode ser entregue sozinho a uma IA para construir links.

A fonte canônica é `docs/url-rotina-v3.md`. O build gera deste mesmo texto a página `/instrucoes` e o arquivo `/instrucoes.md`. No host oficial: [instruções](https://squeeze.ggarrote.workers.dev/instrucoes) e [Markdown para máquinas](https://squeeze.ggarrote.workers.dev/instrucoes.md).

## Como construir um link

Use a base `https://squeeze.ggarrote.workers.dev/` com o parâmetro `rotina` e, opcionalmente, `nome` e `tipos`. Preserve a ordem pedida, use durações inteiras em minutos e inclua sempre o deadline. Não invente tarefas, durações ou deadline: pergunte o que faltar.

O app calcula o horário ideal de início: deadline menos a soma das durações. Ex.: tarefas de 60, 20, 25, 20 e 20 min com deadline às 15:00 começam às 12:35. O deadline vale a próxima ocorrência desse horário: se já passou hoje, é amanhã.

## Sintaxe

```text
?rotina=3.HHMM.Tarefa-minutos.Tarefa-minutos...&nome=Nome_da_rotina
```

- `3` é a versão.
- `HHMM` é o deadline em 24 horas, com quatro dígitos: `0930`, `1500`, `0100`.
- Cada tarefa é `Nome-minutos`, separada da seguinte por ponto. Os minutos são o que vem depois do último hífen, então `Treino-5-30` é a tarefa "Treino-5" com 30 minutos.
- `nome` é opcional. Sem ele, a rotina se chama "Rotina fim HH:MM", usando o deadline do link (ex.: "Rotina fim 20:30").

## Tipos de tarefa (opcional)

O parâmetro `tipos` é uma lista separada por vírgulas, na mesma ordem das tarefas, com exatamente uma entrada por tarefa: `normal`, `fixo` ou `folga`. Exemplo de valor: `tipos=normal,fixo,folga`. Não escape as vírgulas. Sem esse parâmetro, todas as tarefas são normais.

- `normal`: duração flexível, pode fazer squeeze ou crescer quando sobra tempo.
- `fixo`: duração preservada; só consome tempo quando a tarefa está ativa. Pode haver várias.
- `folga`: reserva que absorve os atrasos antes das tarefas normais; no máximo uma por rotina. A folga automática se soma a ela e não cria outra. A reserva não vira uma tarefa ativa e aparece no fim da timeline.

Os tipos acompanham as rotinas salvas e os links copiados. Se as tarefas fixas não couberem até o deadline, o app mantém suas durações e sinaliza o tempo que falta.

## Limites

- De 1 a 40 tarefas.
- De 1 a 720 minutos por tarefa, no máximo 1440 minutos no total.
- Nomes com até 80 caracteres (unidades UTF-16), sem caracteres de controle.
- Valor de `rotina` com até 6000 caracteres, contados antes de decodificar.

## Nomes: espaços, pontuação e Unicode

Espaço vira `_`. Underscore literal não é suportado. Letras, números e `-` vão como estão. Letras acentuadas e emojis podem ir literalmente ou codificados uma única vez em UTF-8 (`%C3%A7` para `ç`). Pontuação ASCII usa `~` mais o código hexadecimal em maiúsculas. Não use `%` para caracteres ASCII.

| Caractere | No link |
| --- | --- |
| `.` | `~2E` |
| `~` | `~7E` |
| `%` | `~25` |
| `+` | `~2B` |
| `&` | `~26` |
| `#` | `~23` |
| `=` | `~3D` |
| `/` | `~2F` |
| `?` | `~3F` |
| `'` | `~27` |
| `"` | `~22` |
| `,` | `~2C` |
| `:` | `~3A` |
| `;` | `~3B` |
| `(` | `~28` |
| `)` | `~29` |
| `!` | `~21` |
| `@` | `~40` |

## Exemplos verificáveis

| Caso | Valor | Link | Resultado |
| --- | --- | --- | --- |
| Tarde | `3.1500.Orçamento-60.Guardar_equipamentos-20.Banho_e_troca_de_roupa-25.Almoço-20.Preparar_saída-20` | [Abrir tarde](https://squeeze.ggarrote.workers.dev/?rotina=3.1500.Or%C3%A7amento-60.Guardar_equipamentos-20.Banho_e_troca_de_roupa-25.Almo%C3%A7o-20.Preparar_sa%C3%ADda-20&nome=Tarde) | Rotina "Tarde": Orçamento 60, Guardar equipamentos 20, Banho e troca de roupa 25, Almoço 20, Preparar saída 20; deadline 15:00; início ideal 12:35 |
| Pontuação | `3.0930.Ligar_p~2F_Ana~3F-10.Revisar_~28v2~2E1~29-15` | [Abrir pontuação](https://squeeze.ggarrote.workers.dev/?rotina=3.0930.Ligar_p~2F_Ana~3F-10.Revisar_~28v2~2E1~29-15&nome=Manh%C3%A3_de_trabalho) | Rotina "Manhã de trabalho": Ligar p/ Ana? 10, Revisar (v2.1) 15; deadline 09:30 |
| Emoji e hífens | `3.0700.☕_Café-5.Pré-treino-10.Treino-5-30` | [Abrir treino](https://squeeze.ggarrote.workers.dev/?rotina=3.0700.%E2%98%95_Caf%C3%A9-5.Pr%C3%A9-treino-10.Treino-5-30&nome=Treino) | Rotina "Treino": ☕ Café 5, Pré-treino 10, Treino-5 30; deadline 07:00 |
| Depois da meia-noite | `3.0100.Lavar_louça-20.Ler-30` | [Abrir noite](https://squeeze.ggarrote.workers.dev/?rotina=3.0100.Lavar_lou%C3%A7a-20.Ler-30) | Rotina fim 01:00: Lavar louça 20, Ler 30; deadline 01:00 (amanhã, se aberto antes da meia-noite) |

## Ao abrir o link

O app abre a rotina no planejamento, mostrando o horário ideal de início, sem alterar as rotinas salvas; o usuário pode salvá-la. Se houver uma rotina em andamento, o app pergunta antes de substituí-la. Um link inválido não altera nada: o app avisa e continua com os dados locais. Tudo fica no aparelho; não há conta, servidor ou sincronização.

Não há campos para data, horário de início, andamento, tarefas concluídas, ícones, cores ou configurações. Não acrescente parâmetros para tentar configurá-los.

## Prompt pronto para qualquer agente

```text
Use as instruções oficiais de links v3 do Squeeze para montar um link em https://squeeze.ggarrote.workers.dev/.
Minha solicitação: [nome da rotina, tarefas em ordem, minutos de cada uma e deadline].
Pergunte o que faltar; não invente tarefas, minutos ou deadline.
Formato: ?rotina=3.HHMM.Tarefa-min.Tarefa-min...&nome=Nome. Use _ para espaços, ~HH em maiúsculas para pontuação ASCII, nunca underscore literal nem % para ASCII. Acentos e emojis podem ir literais ou em UTF-8 percent-encoded uma vez.
Opcional: &tipos=normal,fixo,folga com exatamente um tipo por tarefa, na mesma ordem; no máximo uma folga.
Limites: 1 a 40 tarefas, 1 a 720 min cada, total até 1440, nomes até 80 caracteres.
Entregue o link clicável e uma conferência com nomes, minutos, deadline e o horário ideal de início (deadline menos a soma).
```
