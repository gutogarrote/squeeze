# Instruções oficiais — links de rotina v2

A versão 2 está implementada e é o formato canônico de novos links: `serializeRoutineUrl` gera v2. O parser continua aceitando v1, inclusive o formato antigo com pipes; `serializeLegacyRoutineUrl` preserva a serialização v1. Este documento é completo e pode ser entregue sozinho a uma IA para construir links. Não é uma proposta de implementação.

A fonte canônica é `docs/url-rotina-v2.md`. O build gera deste mesmo texto a página humana `/instrucoes` e o arquivo `/instrucoes.md`, sem depender de JavaScript. No host oficial, use [instruções humanas](https://squeeze.ggarrote.workers.dev/instrucoes) ou [Markdown canônico para máquinas](https://squeeze.ggarrote.workers.dev/instrucoes.md).

## Como construir um link

Use a base `https://squeeze.ggarrote.workers.dev/` e exatamente um parâmetro `rotina`. Escolha o período, preserve a ordem solicitada, consulte os IDs abaixo e atribua durações inteiras em minutos. Sempre inclua o horário final explicitamente, exceto quando a pessoa pedir os padrões. Não invente tarefas, durações, período ou horário essenciais: pergunte o que faltar. Não adivinhe códigos; use nome personalizado quando não existir correspondência exata no catálogo. Não crie novos IDs.

Calcule o cronograma de trás para frente quando houver horário final: início = final menos soma das durações; cada tarefa começa quando a anterior termina. Por exemplo, banho 20 min, jantar 25 min e mãos + dentes 5 min terminando às 19:30 começam às 18:40, 19:00 e 19:25. A duração de uma combinação é TOTAL, não por ID. Se o cálculo atravessar meia-noite, explique o dia anterior; o link não codifica data.

## Catálogo completo atual

IDs são duas letras minúsculas, sensíveis a maiúsculas. Nome, emoji e cor abaixo são os valores exatos. Não há outros IDs aprovados.

| ID | Nome | Ícone | Cor |
| --- | --- | --- | --- |
| ac | Acordar | 🌞 | #06b6d4 |
| cf | Café da manhã | ☕️ | #f97316 |
| ma | Lavar as mãos | 🧼 | #34d399 |
| de | Escovar os dentes | 🪥 | #a855f7 |
| ro | Trocar de roupa | 👕 | #22c55e |
| mo | Arrumar mochila | 🎒 | #0ea5e9 |
| xi | Fazer xixi | 🚽 | #f472b6 |
| sa | Tênis e sair | 👟 | #ef4444 |
| ba | Banho | 🛁 | #38bdf8 |
| ja | Jantar | 🍽️ | #fb923c |
| co | Fazer cocô | 💩 | #8B5E3C |
| do | Dormir | 😴 | #60a5fa |
| br | Brincar | 🧸 | #fbbf24 |
| li | Ler livro | 📚 | #818cf8 |
| bo | Arrumar brinquedos | 🧸 | #22c55e |
| ca | Arrumar cama | 🛏️ | #60a5fa |

## Sintaxe e gramática

```text
query       = "?rotina=" valor
valor       = "2." periodo "." tarefa { "." tarefa } [ "." hhmm ]
periodo     = "m" | "n"
tarefa      = catalogo | custom
catalogo    = id { "-" id } "-" minutos
custom      = "~" nome "-" minutos
nome        = unidade { unidade }
unidade     = letra-ASCII | digito-ASCII | "-" | "_" | Unicode-nao-ASCII | escape
escape      = "~" HH
minutos     = inteiro decimal 1..180, sem zeros iniciais
hhmm        = exatamente quatro digitos, HH 00..23 e MM 00..59
id          = um dos IDs exatos do catalogo
HH          = dois digitos hexadecimais MAIUSCULOS de pontuacao ASCII permitida
```

As chaves indicam repetição e os colchetes uma parte opcional; não são caracteres do link. `.` separa tarefas. O último `-` de cada tarefa separa sua duração. Hífens anteriores combinam IDs ou pertencem ao nome personalizado: `~pré-treino-5` é “pré-treino”, cinco minutos. `~Plano-2-5` é “Plano-2”, cinco minutos. O `~` inicial identifica customização. Apenas o último token exatamente de quatro dígitos é horário final; em outra posição ele invalida a lista.

Ordem e repetições são preservadas. `ma-de-7` é “Lavar as mãos + Escovar os dentes”, sete minutos totais, emoji `🧼🪥` concatenado sem espaços e cor `#34d399` do PRIMEIRO ID. `de-ma-7` inverte nome, emoji e cor. Há até 40 IDs por combinação. `ma-ma-2` repete o mesmo ID. Não misture um nome personalizado com IDs na mesma tarefa.

## Limites e períodos

Entre 1 e 40 tarefas; duração de cada uma 1..180 minutos inteiros, soma até 720 minutos. Sem sinais, frações ou zeros iniciais. Nome personalizado: no máximo 80 unidades UTF-16 de JavaScript após expansão (não bytes nem caracteres visuais: 🍄 ocupa duas unidades). Nome vazio ou só whitespace, controles U+0000..001F/U+007F e surrogates isolados são inválidos. Não há trimming nem normalização NFC; espaços repetidos/iniciais/finais são preservados se o nome não for só whitespace.

O valor RAW do parâmetro `rotina` tem limite de 6000 unidades de código JavaScript, medido ANTES de qualquer decodificação; não inclui `?rotina=` nem os outros parâmetros. `%C3%A9` custa seis unidades RAW, embora represente uma letra. Duplicar `rotina` rejeita o link inteiro.

`m` seleciona `monday.morning` (“Manhã”); `n` seleciona `monday.evening` (“Noite”). Sem horário final, os padrões são 06:30 e 21:00 respectivamente. O período não é inferido do horário na query: `n` com `.0630` continua Noite. `0000` e `2359` são válidos; `2400` e `1260` não.

O horário usa o relógio LOCAL do navegador, sem conversão de fuso. Não há campo de timezone, offset UTC ou data: um link terminado em `.1930` significa 19:30 local em cada aparelho. Se a intenção depender de cidade/fuso, esclareça antes e informe essa limitação. O app calcula o começo retroativamente, mantém atraso por até 180 minutos após o final e então usa a próxima ocorrência diária. Modos relativos e ajustes da sessão não são transportados.

## Nomes personalizados, pontuação e transporte

Nomes fora do catálogo recebem sempre ícone `✨` e cor `#CCCCCC`. Um emoji escrito no NOME permanece no texto: “🍄 Cogumelos mágicos” continua com ícone ✨. Não há campos wire para escolher ícone ou cor arbitrários.

`_` significa exatamente um espaço U+0020. Underscore literal no nome NÃO é suportado; o serializer rejeita, e `~5F` também é inválido. Letras ASCII, dígitos, hífen e Unicode não ASCII permanecem no nome. Toda outra pontuação ASCII U+0021..007E usa `~HH` com hexadecimal MAIÚSCULO; espaço usa `_`, nunca `~20`.

| Texto | Wire v2 |
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
| `<` | `~3C` |
| `>` | `~3E` |

A mesma regra cobre colchetes, chaves, barra invertida, pipe e demais pontuações ASCII. `~41`, `~5F`, `~20`, escapes de controles e hex em minúsculas são inválidos. A expansão ocorre uma vez: texto literal `~2E` vira `~7E2E`; texto literal `%20` vira `~2520`, nunca espaço. `+` bruto não vira espaço no v2. `&` bruto começa outro parâmetro e `#` bruto inicia fragmento, por isso use os escapes dentro de nomes.

Separar duas camadas é essencial: `~HH` é escape de PONTUAÇÃO do formato; percent-encoding UTF-8 é só TRANSPORTE de Unicode. O wire `pré` pode aparecer como `pr%C3%A9`; 🍄 como `%F0%9F%8D%84`. O parser aceita Unicode literal ou bytes percent de UTF-8 válido que decodificam exclusivamente para não ASCII. Reconhece o prefixo literal `2.` e faz uma passagem limitada antes de separar tarefas. `%20`, `%2E`, `%2D`, `%25` e percent-encoding ASCII são rejeitados. Não use `encodeURIComponent(nome)` como escape de nome v2: pontuação exige `~HH`. Não use `URLSearchParams.set` para montar o payload v2: ele codifica `~` como `%7E`, que é ASCII codificado e será rejeitado. Depois de montar o wire corretamente, transportar apenas Unicode em percent-encoding UTF-8 é permitido; preserve todo ASCII do wire, inclusive `2.`, `.`, `-`, `~` e `_`. Use a API canônica ou atribua diretamente `url.search = '?rotina=' + valor` a um `new URL`; ele transporta Unicode. Não faça double-decode nem substitua `~HH` fora do parser.

## Exemplos completos verificáveis

Cada linha fornece o valor de `rotina`, o link inteiro e o resultado esperado. Todos incluem horário final.

| Caso | Valor | Link | Resultado |
| --- | --- | --- | --- |
| Noite e combinação | `2.n.ba-20.ja-25.ma-de-5.1930` | [Abrir noite](https://squeeze.ggarrote.workers.dev/?rotina=2.n.ba-20.ja-25.ma-de-5.1930) | Banho 20, Jantar 25, Lavar as mãos + Escovar os dentes 5; final 19:30 |
| Manhã com repetição | `2.m.xi-5.ro-10.xi-5.0720` | [Abrir manhã](https://squeeze.ggarrote.workers.dev/?rotina=2.m.xi-5.ro-10.xi-5.0720) | Fazer xixi 5, Trocar de roupa 10, Fazer xixi 5; final 07:20 |
| Hífens e último split | `2.n.~pré-treino-5.~Plano-2-5.2030` | [Abrir hífens](https://squeeze.ggarrote.workers.dev/?rotina=2.n.~pr%C3%A9-treino-5.~Plano-2-5.2030) | pré-treino 5, Plano-2 5; ambos ✨/#CCCCCC; final 20:30 |
| Pontuação e Unicode | `2.n.~pré-treino_~2B_0~2E5_litros_🍄_~26_50~25-5.1900` | [Abrir pontuação](https://squeeze.ggarrote.workers.dev/?rotina=2.n.~pr%C3%A9-treino_~2B_0~2E5_litros_%F0%9F%8D%84_~26_50~25-5.1900) | pré-treino + 0.5 litros 🍄 & 50%; 5 min, ✨/#CCCCCC; final 19:00 |
| Literais sem dupla expansão | `2.n.~Texto_~7E2E_~2520-3.2030` | [Abrir literais](https://squeeze.ggarrote.workers.dev/?rotina=2.n.~Texto_~7E2E_~2520-3.2030) | Texto ~2E %20; 3 min; final 20:30 |
| Emoji no nome | `2.n.~🍄_Cogumelos_mágicos-3.2030` | [Abrir emoji no nome](https://squeeze.ggarrote.workers.dev/?rotina=2.n.~%F0%9F%8D%84_Cogumelos_m%C3%A1gicos-3.2030) | 🍄 Cogumelos mágicos; 3 min, ícone ✨, cor #CCCCCC; final 20:30 |
| Ordem de combinação | `2.n.de-ma-7.ma-ma-2.2030` | [Abrir combinações](https://squeeze.ggarrote.workers.dev/?rotina=2.n.de-ma-7.ma-ma-2.2030) | Escovar os dentes + Lavar as mãos, 🪥🧼/#a855f7, 7 min; Lavar as mãos + Lavar as mãos, 🧼🧼/#34d399, 2 min; final 20:30 |

## Importação, falhas e campos não suportados

Ao abrir um link válido, o app importa uma vez por montagem apenas o período indicado, preserva o outro período e grava a configuração em `localStorage`, chave `routines`, quando o storage está disponível. Dados locais válidos são a base; na ausência deles usa padrões. A opção “Manter tela ligada” é uma preferência separada deste navegador/origem, desligada por padrão; não é importada nem exportada pelo link de rotina. A sessão/progresso fica em memória; não há backend, conta ou sincronização. O armazenamento é por origem: localhost não migra automaticamente para workers.dev. Uma atualização protegida do PWA pode restaurar a configuração local em vez de reimportar a URL, para preservar alterações durante a atualização.

Versão/ID desconhecidos, encoding malformado, campos extras dentro de uma entrada, tarefas inválidas ou limites excedidos rejeitam TODA a configuração, sem importação parcial. O app mostra padrões temporariamente com aviso e diagnóstico local, sem gravar, apagar ou substituir dados salvos. Abra `/` sem query para voltar aos dados locais. Se o fetch de padrões falhar há uma cópia embarcada. O diagnóstico não envia telemetria.

Não há campos para dia da semana, data, início, timezone, andamento, tarefas concluídas, IDs internos, nome da rotina, ícones/cores arbitrários, modo relativo, pausas, notas ou configurações ocultas. `catalogIds` é metadado da API/local, representado no wire pela combinação de códigos, não por um campo extra. Outros parâmetros de query e fragmentos são ignorados pelo parser de rotina e preservados pelo serializer; NÃO os adicione para tentar configurar funções inexistentes.

Ao salvar nos editores ou salvar horário, o app grava localmente e atualiza a barra com v2 via `history.replaceState`, sem reload. Só o período selecionado vai para a URL; copie depois de salvar. Ícones/cores editados continuam locais. Edições fora dos limites do formato continuam locais e geram aviso; a URL anterior permanece, então corrija e salve antes de copiar. Nomes com underscore literal têm aviso específico. `serializeRoutineUrl(baseUrl, period, tasks, endTime?)` aceita `morning`/`evening`, tarefas `{name, minutes, catalogIds?}` e final `HH:MM`; correspondência exata de nome usa catálogo, combinações preservadas usam `catalogIds`, outros nomes usam customização.

Os atalhos `/0630`, `/0720` ou `/1930`, sem barra final, carregam tarefas PADRÃO (não as personalizadas salvas), ajustam o final e não sobrescrevem storage na carga. Antes de 12h selecionam manhã, a partir de 12h noite. Query `rotina` válida tem prioridade sobre pathname; query inválida não recorre ao atalho. Ao salvar um atalho o pathname vira `/` com query completa. `/instrucoes` e `/instrucoes.md` são assets estáticos de documentação e não entram no parser da aplicação.

## Prompt pronto para qualquer agente

```text
Use estas instruções oficiais v2 e o catálogo completo acima para construir um link de rotina do Squeeze em https://squeeze.ggarrote.workers.dev/.
Minha solicitação: [tarefas em ordem, durações, período e horário final desejados].
Pergunte os dados essenciais que faltarem; não invente tarefas, minutos, período ou horário. Não adivinhe códigos nem acrescente novos IDs, parâmetros irrelevantes ou campos ocultos. Use IDs somente para correspondências exatas do catálogo; outras tarefas são nomes personalizados com ✨/#CCCCCC. Emoji no nome não muda o ícone.
Inclua sempre o horário final hhmm explicitamente, salvo se eu pedir os padrões. Preserve ordem e repetições; em combinações os minutos são totais. Calcule o início e os intervalos de trás para frente quando aplicável, esclarecendo travessia de meia-noite e uso do horário local sem timezone no link.
Valide 1..40 tarefas, 1..180 minutos cada, soma <=720, até 40 IDs por combinação, nomes <=80 unidades UTF-16 e valor RAW <=6000 unidades de código. Use _ para espaços, ~HH MAIÚSCULO para pontuação ASCII; não aceite underscore literal. Não percent-encode ASCII do payload; transporte Unicode em UTF-8 apenas uma vez.
Entregue o valor de rotina e o link completo clicável, mais uma conferência de nomes, minutos, período e final. Se houver parser disponível, valide com parseRoutineUrl; caso contrário confira toda a gramática sem alegar execução. Não prometa campos ou comportamentos não suportados.
```

## Exemplos executáveis para construção

Os dois programas independentes abaixo demonstram a codificação; o parser real valida os links nos testes. Use Node 26.13.0 ou Python 3. A base localhost é só para execução local; substitua pela base oficial para compartilhar.

```js
const base = 'http://localhost:3000/';
function nameWire(name) {
  if (!name.trim() || name.length > 80 || name.includes('_') || !name.isWellFormed() || /[\x00-\x1F\x7F]/.test(name)) throw new Error('Nome não suportado');
  return Array.from(name, char => {
    if (char === ' ') return '_';
    if (/^[A-Za-z0-9-]$/.test(char) || char.charCodeAt(0) >= 128) return char;
    return '~' + char.charCodeAt(0).toString(16).toUpperCase();
  }).join('');
}
function link(value) {
  const url = new URL(base);
  url.searchParams.delete('rotina');
  const other = url.searchParams.toString();
  url.search = (other ? other + '&' : '') + 'rotina=' + value;
  return url.href;
}
console.log(link('2.n.ma-5.ma-de-7.2030'));
console.log(link('2.n.~' + nameWire('pré-treino + 0.5 litros 🍄 & 50%') + '-5.1900'));
```

```python
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode, quote
base = 'http://localhost:3000/'
def name_wire(name):
    units = len(name.encode('utf-16-le')) // 2
    if not name.strip() or units > 80 or '_' in name or any(ord(c) < 32 or ord(c) == 127 for c in name):
        raise ValueError('Nome não suportado')
    return ''.join('_' if c == ' ' else c if ord(c) >= 128 or c.isascii() and (c.isalnum() or c == '-') else '~' + format(ord(c), '02X') for c in name)
def link(value):
    u = urlsplit(base)
    params = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True) if k != 'rotina']
    other = urlencode(params)
    query = (other + '&' if other else '') + 'rotina=' + quote(value, safe='.-~_')
    return urlunsplit((u.scheme, u.netloc, u.path, query, u.fragment))
print(link('2.n.ma-5.ma-de-7.2030'))
print(link('2.n.~' + name_wire('pré-treino + 0.5 litros 🍄 & 50%') + '-5.1900'))
```
