# PWA — Squeeze

## Instalar

Abra a versão de produção em HTTPS, espere a primeira visita terminar com internet
(e o service worker instalar todos os arquivos) e recarregue uma vez antes de testar
sem rede. A primeira visita offline não funciona. O site também funciona sem instalar.

- **Android/Chrome:** menu do navegador → **Instalar app** ou **Adicionar à tela inicial**;
  confirme Squeeze. A apresentação depende da versão do navegador.
- **iPhone/iPad/Safari:** compartilhar → **Adicionar à Tela de Início** → adicionar.
  Se houver a opção, mantenha **Abrir como App** ativada.
- **Computador/Chrome/Edge:** ícone de instalação na barra de endereço ou menu → instalar.

O manifest tem `id`, `start_url` e `scope` `/`, nome Squeeze, tema/fundo escuro
`#09090b`, ícones 192/512 e versões maskable com o desenho dentro do círculo seguro
central (raio inferior a 40% da largura). Os ícones ainda são os herdados do Ver o Tempo
(`icons/*.svg` são as fontes vetoriais) e devem ganhar uma versão própria do Squeeze.
O ícone Apple tem 180 px. Nenhum prompt de instalação customizado foi adicionado.

As opções de instalação seguem o [suporte de cada navegador](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing).
A validação local usa Chromium instalado via Playwright, com telas TV/celular simuladas;
ela não comprova instalação em hardware Android/iOS. WebKit não estava disponível no
ambiente desta fase; Safari/iOS reais ainda precisam de validação manual.

## Offline e dados

Após a instalação completa do worker, `/` e URLs com `?rotina=...` funcionam offline:
planejamento, execução, edição e rotinas salvas. O parser de links roda no cliente.

O app usa as fontes do sistema (nenhuma fonte é baixada) e sintetiza os alertas com
Web Audio, sem arquivos de som. Os alertas tocam enquanto a página está aberta e visível;
com a tela bloqueada o navegador suspende o app, por isso existe a opção de manter a tela
acesa e o modo descanso (specifications.md §11).

Os [apps Capacitor para Android/iPhone](native.md) oferecem notificações locais
com som em segundo plano e offline. Instalar a **PWA** na tela inicial não habilita
esses recursos nativos. Os apps nativos não registram este service worker e têm
armazenamento separado.

Os dados ficam em `localStorage` por origem, nas chaves `squeeze:draft`, `squeeze:templates`,
`squeeze:run`, `squeeze:settings` e `squeeze:keep-screen-on`. Localhost, workers.dev e outros
domínios não compartilham dados. Uma instalação pode ter um contexto de armazenamento
diferente do navegador, conforme a plataforma. Não há backend, login, sincronização ou
exportação. A rotina em andamento é salva a cada mudança e sobrevive a recargas, porque
todo o tempo é calculado a partir de timestamps. Links seguem o [contrato v3](url-rotina-v3.md).

O navegador pode remover caches/dados por falta de espaço ou política própria. Limpar
os dados do site ou desinstalar pode remover rotinas; o app não faz essa limpeza. A garantia
offline depende de uma instalação bem-sucedida e de o navegador conservar o cache.

## Atualização segura

O novo worker instala uma versão inteira e fica esperando. Não chama `skipWaiting`
na instalação. Ao detectar uma versão esperando, a UI mostra **Atualizar agora** e explica
que o app recarrega mantendo a rotina em andamento e as rotinas salvas. O botão fica
desabilitado enquanto a edição de uma rotina em andamento estiver aberta: salve ou cancele primeiro.
Durante edição, o aviso ocupa espaço no fluxo da página, sem cobrir o botão de salvar.
**Depois** oculta o aviso sem ativar/recarregar; uma nova detecção pode mostrá-lo novamente.
Checagens ocorrem no registro, ao retornar para uma aba visível e ao recuperar conexão.
Não há polling contínuo nem recarga automática ao receber uma nova versão.

Ao aceitar, somente essa aba recarrega após a ativação. Outras abas mantêm a tela e seus
rascunhos; seus bundles anteriores continuam disponíveis no cache. Se uma edição começar
entre o clique e a ativação, a recarga é adiada e requer outro clique após sair do editor.
Se outra aba já ativou a versão, o botão desta aba ainda exige uma ação explícita para
recarregar. A atualização pode ser aceita offline se o novo worker já terminou de instalar.

Um link de rotina é importado uma vez e removido da barra de endereço, então recarregar
(inclusive por atualização) nunca reimporta o link por cima dos dados locais.

## Cache e build

`src/pwa/buildPwa.mjs` gera `/sw.js` após o build do Vite. Uma versão é derivada do
conteúdo do worker e da lista ordenada de assets com SHA-256. A instalação usa
`Cache.addAll` e Requests com integridade e `cache: no-store`: faltas, conteúdo divergente
ou HTML de fallback no lugar de um asset fazem a instalação falhar sem substituir o
worker ativo. A lista inclui HTML, JS/CSS fingerprinted, manifest e ícones;
não inclui `sw.js`, arquivos arbitrários ou URLs visitadas.

Navegação usa `/index.html` do worker ativo, mesmo quando o servidor já tem uma versão
nova esperando consentimento. Um probe de rede limitado a 1,5 s identifica o servidor
de desenvolvimento; sua resposta de produção nunca vira cache de uma navegação.
O HTML cached é copiado para uma resposta sem redirecionamento, pois Workers Static
Assets redireciona `/index.html` para `/`; assim também satisfaz navegações sob controle do SW.
Atalhos e queries não são chaves de cache. Requests de assets conhecidos ignoram query
na busca e retornam apenas bytes públicos canônicos do build. Não há cache runtime de
conteúdo personalizado, requests externos ou outros métodos. Assets `/assets/` de uma
versão anterior só são usados quando seu caminho fingerprinted é solicitado; nomes
estáveis sempre pertencem ao worker ativo. Ranges simples de mídia têm respostas 206/416.

Caches `squeeze-shell-<hash>` anteriores são mantidos deliberadamente, pois outras
abas podem estar usando seus assets. Não há coleta automática nesta fase: o espaço pode
crescer a cada release (o shell inicial tem cerca de 0,5 MB, sem compressão HTTP), sujeito
à quota/remoção do navegador. Nenhum cache de outro aplicativo ou storage é apagado.

`public/_headers` define revalidação para worker/index/manifest e cache immutable dos
bundles em `/assets/*`, conforme [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/headers/).
O `updateViaCache: none` evita cache HTTP na checagem do worker. O fallback SPA da
configuração Wrangler da fase 3 permanece, sem script Worker/backend, rotas ou DNS novos.
O service worker roda no navegador; não é um script Cloudflare Worker.

`npm start` não registra SW. O servidor Vite marca respostas com `X-Squeeze-Dev`;
um worker desta fase que controlava a mesma origem de preview se desregistra ao navegar
para o dev e passa a deixar seus requests na rede. Um worker desregistrado pode continuar sendo o controller da aba existente; feche
as abas dessa origem e abra uma nova para removê-lo. HMR e módulos dev não são precached. Para alternar testes, prefira
origens separadas (ex.: preview em `localhost`, dev em `127.0.0.1`). Nunca use o servidor
de desenvolvimento para validar instalação/offline.

Nenhuma dependência de runtime/build foi adicionada; não há Workbox/vite-plugin-pwa.
O worker nativo basta para este shell estático, sem API nem sincronização. Os ícones
são binários versionados; a conversão deles não faz parte de `npm ci` ou do build.

## Verificar localmente

Com Node 26.13.0, em `app/`:

```bash
npm ci
npm run lint -- --max-warnings=0
npm test -- --run
npm run build
npm audit
npm audit --omit=dev
npx wrangler deploy --dry-run --config ../wrangler.jsonc
npm run preview
# Ou, depois de encerrar preview:
npm run dev:assets
```

A suíte cobre registro/atualização, integridade e fallback offline e ranges.
No navegador: primeira visita com rede → aguarde SW **activated** e **controller** → reload
→ offline → abra um link `?rotina=3...` nunca visitado → comece, edite e salve uma rotina.
Confira que Cache Storage só contém URLs públicas sem query.

Para atualização: mantenha a edição de uma rotina em andamento aberta em abas de v1; sirva um build v2
com novos hashes JS/CSS e HTML. Force `registration.update()` ou retorne à aba.
Verifique o aviso e botão bloqueado, e ausência de recarga/perda de draft. Salve uma aba,
aceite a atualização e confirme JS/CSS/HTML de v2, storage idêntico e draft preservado
na outra aba; então salve e atualize a segunda. Essa transição também foi exercitada
com a rede desligada depois de v2 terminar de instalar.

## Rollback operacional

Não houve deploy remoto nesta fase. Quando uma publicação for autorizada, o rollback
manual para uma versão PWA anterior já publicada continua:

```bash
# A partir de app/; somente com autorização e autenticação:
npx wrangler rollback <version-id> --name squeeze --config ../wrangler.jsonc
```

O servidor volta à versão escolhida; os clientes precisam estar online para descobrir
seu `sw.js`. Ela instala como uma atualização comum e pede **Atualizar agora**. Clientes
offline permanecem na versão instalada até reconectar e aceitar. O rollback não apaga
rotinas, não migra origens nem modifica DNS.

**Retornar à fase 3 ou remover PWA exige uma versão de aposentadoria do worker.** Só
voltar aos assets sem `sw.js` pode produzir HTML pelo fallback SPA nesse caminho; isso
não desinstala um worker existente. Prepare uma release com os assets antigos e um
`/sw.js` válido servido como JavaScript, que instala/ativa e se desregistra sem reload:

```js
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.registration.unregister()));
```

Essa release precisa servir esse arquivo no lugar do worker gerado (o build da fase 4
sobrescreveria `sw.js`). Publique-a somente com autorização; mantenha o endpoint de
aposentadoria disponível para clientes que retornem mais tarde. Sem fetch handler,
novas navegações usam a rede. Não limpe localStorage ou recarregue abas no script de
aposentadoria. As abas existentes podem salvar antes de fechar/recarregar. A remoção
do worker encerra a garantia offline; não foi executada nem validada remotamente aqui.

## Instruções estáticas

`/instrucoes` (e sua barra final) e `/instrucoes.md` são documentação gerada da
mesma fonte `docs/url-rotina-v3.md`. Não entram no precache nem no shell da
aplicação: o SW deixa essas requisições para a rede, evitando erro de parser
em navegadores controlados. Não há promessa de leitura offline das instruções.
Links de rotina mantêm o comportamento offline.
Um SW antigo pode ainda entregar a SPA nessas rotas até o usuário aceitar a
atualização; não há atualização forçada.
