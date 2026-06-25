# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # dev server with hot reload
bun run build        # bundle to dist/
bun run start        # run from dist/

bun run lint         # biome check
bun run format       # biome format

bun run prisma:generate   # regenerate Prisma client after schema changes
bun run prisma:studio     # open Prisma Studio GUI

bun run seed:admin   # seed roles, permissions, and SUPER_ADMIN user
bun run seed:cards   # seed card data

# Code generators (interactive CLI)
bun run generate:crud         # controller + route + permissions for a new Prisma model
bun run generate:permissions  # permissions seed only
bun run generate:controller   # controller only
```

No test runner is configured. No test commands exist.

## Architecture

**Runtime**: Bun. **Framework**: Fastify v5. **ORM**: Prisma 7 (PostgreSQL). **Validation**: Zod via `fastify-type-provider-zod`. **Linter**: Biome.

### Request lifecycle

```
src/index.js → createApp() → plugins (cors, swagger, jwt, qs)
                            → routes registered with prefix /api/{domain}
                            → setErrorHandler(errorHandler)
```

All Zod/Prisma/Fastify errors are normalized in `src/helpers/_handleerror.helper.js`. Throw `error.statusCode = 404` from a controller to get a 404 response.

### Path aliases

`src/*` resolves to `./src/*` (configured in `jsconfig.json`, resolved natively by Bun).

### Base abstractions

**`baseController(model, params)`** (`src/controllers/base.controller.js`)  
Factory that returns `{ all, fetch, one, post, put, del }` handlers for a Prisma model. Supports:
- `select`, `include`, `omit` — static Prisma query options
- `allowedFields` — whitelist for dynamic `?select=field1,field2` query params
- `sensitiveFields` — always excluded from dynamic select

**`baseRouter(fastify, controller, options)`** (`src/routes/base.route.js`)  
Auto-registers 6 REST endpoints for a controller:
| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/` | `post` |
| `PUT` | `/:id` | `put` |
| `GET` | `/all` | `all` (no pagination) |
| `GET` | `/` | `fetch` (paginated) |
| `GET` | `/:id` | `one` |
| `DELETE` | `/:id` | `del` |

Options: `tag`, `schemas` (`createSchema`, `updateSchema`, `entitySchema` — all Zod), per-verb `middleware` arrays.

### RBAC / Authorization

Permission identifiers follow `resource:action` format (e.g. `users:read`, `cards:*`, `*`).

Middleware in `src/middleware/_authorization.middleware.js`:
- `authenticate` — verifies JWT (`request.jwtVerify()`)
- `authorize(['users:read', 'users:update'])` — checks user has ≥1 permission (pass `{ requireAll: true }` to require all)
- `requireAdmin` — role must be `ADMIN` or `SUPER_ADMIN`
- `requireSuperAdmin` — role must be `SUPER_ADMIN`

`authorizationService` (`src/services/_authorization.service.js`) caches permissions per user in memory (5-minute TTL). Call `authorizationService.clearCache(userId)` after modifying a user's roles/permissions.

### Adding a new domain

1. Run `bun run generate:crud` and answer the prompts (Prisma model name, module folder, resource name).
2. Register the generated routes in `src/app.js`:
   ```js
   import { myDomainRoutes } from './routes/mydomain'
   server.register(myDomainRoutes, { prefix: '/api/mydomain' })
   ```
3. Run `bun run seed:admin` to push the generated permissions to the database.

### Prisma

- Schema: `prisma/schema.prisma` — two DB schemas: `seguranca` (auth models) and `public` (app models).
- Generated client: `prisma/generated/prisma/` — import from there, not from `@prisma/client` directly.
- All IDs use UUID v7 (`@default(uuid(7))`).
- After editing the schema run `bun run prisma:generate`.

### Code style (Biome)

Tabs, width 2. Single quotes. No semicolons (only where required). No trailing commas. Line width 80.
