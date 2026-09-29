# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
bun run dev          # servidor de desenvolvimento com hot reload
bun run build        # empacota em dist/
bun run start        # executa a partir de dist/

bun run lint         # biome check
bun run format       # biome format

bun run prisma:generate   # regenera o client do Prisma após mudanças no schema
bun run prisma:studio     # abre o Prisma Studio (GUI)

bun run seed:admin   # popula papéis, permissões e o usuário SUPER_ADMIN
bun run seed:cards   # popula dados de cards

# Geradores de código (CLI interativa)
bun run generate:crud         # controller + rota + permissões para um novo model Prisma
bun run generate:permissions  # apenas o seed de permissões
bun run generate:controller   # apenas o controller
```

Testes: `bun test tests` (tudo) e `bun run test:e2e` (`tests/integration`). Para um único arquivo: `bun test tests/integration/arquivo.test.js`.

## Arquitetura

**Runtime**: Bun. **Framework**: Fastify v5. **ORM**: Prisma 7 (PostgreSQL). **Validação**: Zod via `fastify-type-provider-zod`. **Linter**: Biome.

### Ciclo de vida da requisição

```
src/index.js → createApp() → plugins (cors, swagger, jwt, qs)
                            → rotas registradas com prefixo /api/{dominio}
                            → setErrorHandler(errorHandler)
```

Todos os erros de Zod/Prisma/Fastify são normalizados em `src/helpers/_handleerror.helper.js`. Defina `error.statusCode = 404` em um controller para obter resposta 404.

### Aliases de caminho

`src/*` resolve para `./src/*` (configurado em `jsconfig.json`, resolvido nativamente pelo Bun).

### Abstrações base

**`baseController(model, params)`** (`src/controllers/base.controller.js`)  
Factory que devolve os handlers `{ all, fetch, one, post, put, del }` para um model Prisma. Suporta:
- `select`, `include`, `omit` — opções estáticas de consulta do Prisma
- `allowedFields` — lista de campos permitidos para o parâmetro dinâmico `?select=campo1,campo2`
- `sensitiveFields` — sempre excluídos do select dinâmico

**`baseRouter(fastify, controller, options)`** (`src/routes/base.route.js`)  
Registra automaticamente 6 endpoints REST para um controller:
| Método | Caminho | Handler |
|--------|---------|---------|
| `POST` | `/` | `post` |
| `PUT` | `/:id` | `put` |
| `GET` | `/all` | `all` (sem paginação) |
| `GET` | `/` | `fetch` (paginado) |
| `GET` | `/:id` | `one` |
| `DELETE` | `/:id` | `del` |

Opções: `tag`, `schemas` (`createSchema`, `updateSchema`, `entitySchema` — todos Zod), arrays de `middleware` por verbo.

### RBAC / Autorização

Os identificadores de permissão seguem o formato `recurso:ação` (ex.: `users:read`, `cards:*`, `*`).

Middleware em `src/middleware/_authorization.middleware.js`:
- `authenticate` — verifica o JWT (`request.jwtVerify()`)
- `authorize(['users:read', 'users:update'])` — confere se o usuário tem ≥1 permissão (passe `{ requireAll: true }` para exigir todas)
- `requireAdmin` — o papel deve ser `ADMIN` ou `SUPER_ADMIN`
- `requireSuperAdmin` — o papel deve ser `SUPER_ADMIN`

O `authorizationService` (`src/services/_authorization.service.js`) mantém em memória as permissões por usuário (TTL de 5 minutos). Chame `authorizationService.clearCache(userId)` após alterar papéis/permissões de um usuário.

### Adicionando um novo domínio

1. Rode `bun run generate:crud` e responda às perguntas (nome do model Prisma, pasta do módulo, nome do recurso).
2. Registre as rotas geradas em `src/app.js`:
   ```js
   import { myDomainRoutes } from './routes/mydomain'
   server.register(myDomainRoutes, { prefix: '/api/mydomain' })
   ```
3. Rode `bun run seed:admin` para gravar as permissões geradas no banco.

### Prisma

- Schema: `prisma/schema.prisma` — dois schemas de banco: `seguranca` (models de autenticação) e `public` (models da aplicação).
- Client gerado: `prisma/generated/prisma/` — importe dali, não diretamente de `@prisma/client`.
- Todos os IDs usam UUID v7 (`@default(uuid(7))`).
- Após editar o schema, rode `bun run prisma:generate`.

### Estilo de código (Biome)

Tabs, largura 2. Aspas simples. Sem ponto e vírgula (apenas onde necessário). Sem vírgulas finais. Largura de linha 80.
