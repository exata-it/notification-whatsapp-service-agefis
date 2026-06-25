import { authenticate, authorize } from 'src/middleware'
import { userAuthorizationController } from 'src/controllers/seguranca'
import { z } from 'zod'

const controller = userAuthorizationController()

const PermissionDetail = z.object({
  id: z.string().uuid(),
  identifier: z.string(),
  name: z.string(),
  category: z.string(),
  grantedAt: z.date(),
  expiresAt: z.date().nullable(),
  grantedBy: z.string()
})

const RolePermissionDetail = z.object({
  roleName: z.string(),
  roleId: z.uuid(),
  permissions: z.array(z.object({
    id: z.uuid(),
    identifier: z.string(),
    name: z.string(),
    category: z.string()
  }))
})

const errorSchema = z.object({
  error: z.string(),
  message: z.string()
})

export const setupUserAuthorizationRoutes = async (fastify) => {
  /**
   * GET - Listar permissões do usuário (resumido)
   */
  fastify.get(
    '/users/:userId/permissions',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Autorização de Usuários'],
        summary: 'Listar permissões do usuário',
        description: 'Retorna lista de permissões de um usuário (diretas e via roles)',
        params: z.object({
          userId: z.string().uuid().describe('ID do usuário')
        }),
        response: {
          200: z.object({
            userId: z.string().uuid(),
            permissions: z.array(z.string())
          }),
          403: errorSchema,
          404: errorSchema
        }
      }
    },
    controller.getUserPermissions
  )

  /**
   * GET - Listar permissões do usuário (detalhado)
   */
  fastify.get(
    '/users/:userId/permissions/detail',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Autorização de Usuários'],
        summary: 'Detalhes das permissões do usuário',
        description: 'Retorna detalhes completos de permissões diretas e via roles',
        params: z.object({
          userId: z.string().uuid().describe('ID do usuário')
        }),
        response: {
          200: z.object({
            userId: z.string().uuid(),
            directPermissions: z.array(PermissionDetail),
            rolePermissions: z.array(RolePermissionDetail)
          }),
          403: errorSchema,
          404: errorSchema
        }
      }
    },
    controller.getUserPermissionsDetail
  )

  /**
   * GET - Listar roles do usuário
   */
  fastify.get(
    '/users/:userId/roles',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Autorização de Usuários'],
        summary: 'Listar roles do usuário',
        description: 'Retorna lista de roles atribuídas a um usuário',
        params: z.object({
          userId: z.string().uuid().describe('ID do usuário')
        }),
        response: {
          200: z.object({
            userId: z.string().uuid(),
            roles: z.array(z.string())
          }),
          403: errorSchema,
          404: errorSchema
        }
      }
    },
    controller.getUserRoles
  )

  /**
   * POST - Conceder permissão a um usuário
   */
  fastify.post(
    '/users/permissions/grant',
    {
      preHandler: [authenticate, authorize('users:manage'), authorize('permissions:assign')],
      schema: {
        tags: ['Autorização de Usuários'],
        summary: 'Conceder permissão a usuário',
        description: 'Atribui uma permissão direta a um usuário, opcionalmente com data de expiração',
        body: z.object({
          userId: z.string().uuid().describe('ID do usuário'),
          permissionId: z.string().uuid().describe('ID da permissão'),
          expiresAt: z.string().datetime().optional().describe('Data de expiração da permissão (ISO 8601)')
        }),
        response: {
          201: z.object({
            userId: z.string().uuid(),
            permissionId: z.string().uuid(),
            permission: z.any(),
            grantedAt: z.date(),
            expiresAt: z.date().nullable()
          }),
          400: errorSchema,
          403: errorSchema,
          404: errorSchema
        }
      }
    },
    controller.grantPermission
  )

  /**
   * DELETE - Revogar permissão de um usuário
   */
  fastify.delete(
    '/users/:userId/permissions/:permissionId',
    {
      preHandler: [authenticate, authorize('users:manage'), authorize('permissions:revoke')],
      schema: {
        tags: ['Autorização de Usuários'],
        summary: 'Revogar permissão de usuário',
        description: 'Remove uma permissão direta de um usuário',
        params: z.object({
          userId: z.string().uuid().describe('ID do usuário'),
          permissionId: z.string().uuid().describe('ID da permissão')
        }),
        response: {
          204: z.null(),
          403: errorSchema,
          404: errorSchema
        }
      }
    },
    controller.revokePermission
  )

  /**
   * POST - Atribuir role a um usuário
   */
  fastify.post(
    '/users/roles/assign',
    {
      preHandler: [authenticate, authorize('users:manage'), authorize('roles:assign')],
      schema: {
        tags: ['Autorização de Usuários'],
        summary: 'Atribuir role a usuário',
        description: 'Atribui uma role a um usuário, opcionalmente com data de expiração',
        body: z.object({
          userId: z.string().uuid().describe('ID do usuário'),
          roleId: z.string().uuid().describe('ID da role'),
          expiresAt: z.string().datetime().optional().describe('Data de expiração da role (ISO 8601)')
        }),
        response: {
          201: z.object({
            userId: z.string().uuid(),
            roleId: z.string().uuid(),
            role: z.any(),
            assignedAt: z.date(),
            expiresAt: z.date().nullable()
          }),
          400: errorSchema,
          403: errorSchema,
          404: errorSchema
        }
      }
    },
    controller.assignRole
  )

  /**
   * DELETE - Remover role de um usuário
   */
  fastify.delete(
    '/users/:userId/roles/:roleId',
    {
      preHandler: [authenticate, authorize('users:manage'), authorize('roles:revoke')],
      schema: {
        tags: ['Autorização de Usuários'],
        summary: 'Remover role de usuário',
        description: 'Remove uma role atribuída a um usuário',
        params: z.object({
          userId: z.uuid().describe('ID do usuário'),
          roleId: z.uuid().describe('ID da role')
        }),
        response: {
          204: z.null(),
          403: errorSchema,
          404: errorSchema
        }
      }
    },
    controller.removeRole
  )
}
