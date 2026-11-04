# Deploy isolado do Squeeze

## Identidade e estado inicial

- Repositório: `gutogarrote/squeeze`; branch de produção proposta: `main`.
- Worker: `squeeze`; conta: `339987eb42deac962dcd86bffd351107`.
- Endereço esperado após o primeiro deploy: `https://squeeze.ggarrote.workers.dev/`.
- Essa URL é o destino configurado, não evidência de publicação. Na auditoria inicial o Worker ainda não existia.
- `workers_dev: true`; sem rotas, domínio personalizado, banco ou bindings.
- Não reutilizar o Worker, domínio ou integração Git do Ver o Tempo.

O workflow `.github/workflows/ci.yml` só instala, verifica e compila; não publica. Secrets e variáveis do outro repositório não são herdados.

## Deploy manual

Com Node da `.nvmrc`, a partir de `app/`:

```bash
npm ci
npm run lint -- --max-warnings=0
npm test -- --run
npm run build
npx wrangler whoami
npx wrangler deploy --dry-run --config ../wrangler.jsonc
# Só depois de conferir a conta e o nome squeeze e autorizar a publicação:
npx wrangler deploy --config ../wrangler.jsonc
```

Wrangler pode criar o Worker no primeiro deploy. O OAuth local permite esse caminho sem copiar tokens para o repo. Não executar comandos com `--name ver-o-tempo`. Rollback usa exclusivamente a versão do Squeeze:

```bash
npx wrangler rollback <version-id-do-squeeze> --name squeeze --config ../wrangler.jsonc
```

Depois de publicar, ler novamente o Worker e suas rotas e abrir a URL real. Não inferir sucesso somente pelo build ou pela saída do comando.

## Cloudflare Builds (opcional)

A integração Git do Cloudflare é separada do GitHub Actions. Criar/conectar uma integração nova para o Worker `squeeze` e o repo `gutogarrote/squeeze`; nunca reconectar o Worker original. Conferir antes de salvar:

- Branch de produção: `main`.
- Diretório raiz: `/`.
- Build: `cd app && npm ci && npm run build`.
- Deploy: `cd app && npx wrangler deploy --config ../wrangler.jsonc`.
- Versão Node: igual a `.nvmrc`.
- Não habilitar previews de outras branches antes de definir e validar isolamento.
- Não copiar variáveis, secrets, tokens, rotas ou domínios do projeto original.
- Não adicionar overrides como `CLOUDFLARE_WORKER_NAME` ou flags `--name` apontando ao original.

A API de Builds exige um **user-scoped API token**, criado em Profile → API Tokens (não um account-scoped token), com permissões da conta:

- `Workers Builds Configuration: Edit`.
- `Workers Scripts: Read` para consultar o tag do Worker.
- Restrição à conta acima e prazo de validade curto.

Esse token de administração da API de Builds não é o token de deploy do build. O token de deploy é selecionado/criado separadamente na configuração do novo Worker. Nunca publicar tokens em chat, Git, logs ou variáveis frontend (`VITE_*`). Guardá-los em canal de segredos apropriado fora do checkout, com acesso restrito.

Fontes oficiais:

- https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/
- https://developers.cloudflare.com/workers/ci-cd/builds/
