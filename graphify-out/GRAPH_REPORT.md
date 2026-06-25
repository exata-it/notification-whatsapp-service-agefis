# Graph Report - api  (2026-06-15)

## Corpus Check
- 67 files · ~55,076 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1026 nodes · 1157 edges · 26 communities (24 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d4e19c15`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 23|Community 23]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `scripts` - 14 edges
3. `authorize()` - 12 edges
4. `formatter` - 9 edges
5. `baseRouter()` - 9 edges
6. `baseController()` - 8 edges
7. `prisma` - 8 edges
8. `formatter` - 7 edges
9. `authenticate()` - 7 edges
10. `authorizationService` - 7 edges

## Surprising Connections (you probably didn't know these)
- `baseController()` --calls--> `useUtils()`  [EXTRACTED]
  src/controllers/base.controller.js → src/helpers/_util.helper.js
- `usuarioController()` --calls--> `baseController()`  [EXTRACTED]
  src/controllers/seguranca/_user.controller.js → src/controllers/base.controller.js
- `cardRoutes()` --calls--> `cardController()`  [EXTRACTED]
  src/routes/teste/cards.route.js → src/controllers/teste/cards.controller.js
- `createApp()` --calls--> `useUtils()`  [EXTRACTED]
  src/app.js → src/helpers/_util.helper.js
- `main()` --calls--> `createApp()`  [EXTRACTED]
  src/index.js → src/app.js

## Import Cycles
- 3-file cycle: `prisma/generated/prisma/internal/prismaNamespace.ts -> prisma/generated/prisma/models.ts -> prisma/generated/prisma/models/UserRole.ts -> prisma/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `prisma/generated/prisma/internal/prismaNamespace.ts -> prisma/generated/prisma/models.ts -> prisma/generated/prisma/models/Role.ts -> prisma/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `prisma/generated/prisma/internal/prismaNamespace.ts -> prisma/generated/prisma/models.ts -> prisma/generated/prisma/models/UserPermission.ts -> prisma/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `prisma/generated/prisma/commonInputTypes.ts -> prisma/generated/prisma/internal/prismaNamespace.ts -> prisma/generated/prisma/models.ts -> prisma/generated/prisma/commonInputTypes.ts`
- 3-file cycle: `prisma/generated/prisma/internal/prismaNamespace.ts -> prisma/generated/prisma/models.ts -> prisma/generated/prisma/models/User.ts -> prisma/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `prisma/generated/prisma/internal/prismaNamespace.ts -> prisma/generated/prisma/models.ts -> prisma/generated/prisma/models/Card.ts -> prisma/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `prisma/generated/prisma/internal/prismaNamespace.ts -> prisma/generated/prisma/models.ts -> prisma/generated/prisma/models/Permission.ts -> prisma/generated/prisma/internal/prismaNamespace.ts`
- 3-file cycle: `prisma/generated/prisma/internal/prismaNamespace.ts -> prisma/generated/prisma/models.ts -> prisma/generated/prisma/models/RolePermission.ts -> prisma/generated/prisma/internal/prismaNamespace.ts`

## Communities (26 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (105): Args, At, AtLeast, AtLoose, AtStrict, BatchPayload, Boolean, BooleanFieldRefInput (+97 more)

### Community 1 - "Community 1"
Cohesion: 0.02
Nodes (92): AggregateUserRole, GetUserRoleAggregateType, GetUserRoleGroupByPayload, NullableDateTimeFieldUpdateOperationsInput, Prisma__UserRoleClient, UserRoleAggregateArgs, UserRoleCountAggregateInputType, UserRoleCountAggregateOutputType (+84 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (91): AggregateRolePermission, GetRolePermissionAggregateType, GetRolePermissionGroupByPayload, Prisma__RolePermissionClient, RolePermissionAggregateArgs, RolePermissionCountAggregateInputType, RolePermissionCountAggregateOutputType, RolePermissionCountArgs (+83 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (91): AggregateUserPermission, GetUserPermissionAggregateType, GetUserPermissionGroupByPayload, Prisma__UserPermissionClient, UserPermissionAggregateArgs, UserPermissionCountAggregateInputType, UserPermissionCountAggregateOutputType, UserPermissionCountArgs (+83 more)

### Community 4 - "Community 4"
Cohesion: 0.02
Nodes (86): AggregateUser, BoolFieldUpdateOperationsInput, DateTimeFieldUpdateOperationsInput, GetUserAggregateType, GetUserGroupByPayload, Prisma__UserClient, StringFieldUpdateOperationsInput, User$userPermissionsArgs (+78 more)

### Community 5 - "Community 5"
Cohesion: 0.02
Nodes (84): AggregatePermission, GetPermissionAggregateType, GetPermissionGroupByPayload, NullableStringFieldUpdateOperationsInput, Permission$rolePermissionsArgs, Permission$userPermissionsArgs, PermissionAggregateArgs, PermissionCountAggregateInputType (+76 more)

### Community 6 - "Community 6"
Cohesion: 0.02
Nodes (83): AggregateRole, GetRoleAggregateType, GetRoleGroupByPayload, Prisma__RoleClient, Role$rolePermissionsArgs, Role$userRolesArgs, RoleAggregateArgs, RoleCountAggregateInputType (+75 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (54): AggregateCard, CardAggregateArgs, CardCountAggregateInputType, CardCountAggregateOutputType, CardCountArgs, CardCountOrderByAggregateInput, CardCreateArgs, CardCreateInput (+46 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (22): baseController(), base, permissionController(), select, base, roleController(), select, assignRoleToUser() (+14 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (43): CardScalarFieldEnum, ModelName, NullsOrder, NullTypes, PermissionScalarFieldEnum, QueryMode, RolePermissionScalarFieldEnum, RoleScalarFieldEnum (+35 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (33): authenticate(), authorize(), requireAdmin(), requireSuperAdmin(), baseRouter(), controller, PermissionCreateSchema, PermissionSchema (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (32): @prisma/client, Card, Permission, PrismaClient, Role, RolePermission, User, UserPermission (+24 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (30): files, ignoreUnknown, formatter, arrowParentheses, bracketSameLine, bracketSpacing, enabled, formatWithErrors (+22 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (13): settings, errorHandler(), getValidationErrors(), CONDITIONS_AND_OPERATORS, useUtils(), utils, config, storage (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, checkJs, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (17): dependencies, axios, bcrypt, date-fns, dotenv, fastify, @fastify/cors, @fastify/jwt (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (14): scripts, build, dev, format, generate, generate:controller, generate:crud, generate:permissions (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, packageManager, type (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (9): devDependencies, @biomejs/biome, @faker-js/faker, prisma, @prisma/internals, tsx, @types/bcrypt, @types/jsonwebtoken (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (4): config, LogOptions, PrismaClient, PrismaClientConstructor

### Community 20 - "Community 20"
Cohesion: 0.40
Nodes (4): compilerOptions, baseUrl, paths, src/*

## Knowledge Gaps
- **872 isolated node(s):** `$schema`, `enabled`, `clientKind`, `useIgnoreFile`, `ignoreUnknown` (+867 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 15` to `Community 17`, `Community 11`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Why does `@prisma/client` connect `Community 11` to `Community 15`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `prisma` connect `Community 8` to `Community 11`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `$schema`, `enabled`, `clientKind` to the rest of the system?**
  _872 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.018867924528301886 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.021505376344086023 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.021739130434782608 - nodes in this community are weakly interconnected._