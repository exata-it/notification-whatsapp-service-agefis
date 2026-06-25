import { authorize, authenticate } from 'src/middleware'
import { roleController } from 'src/controllers/seguranca'
import { baseRouter } from 'src/routes/base.route'
import { z } from 'zod'

const controller = roleController()

const RolePermissionSchema = z.object({
  permission: z.object({
    id: z.string().uuid(),
    identifier: z.string(),
    name: z.string()
  })
})

const RoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  active: z.boolean(),
  rolePermissions: z.array(RolePermissionSchema)
})

const RoleCreateSchema = z.object({
  name: z.string().describe('Nome da role'),
  permissionIds: z.array(z.string().uuid()).optional().describe('IDs das permissões a associar')
})

const RoleUpdateSchema = z.object({
  name: z.string().optional().describe('Nome da role'),
  permissionIds: z.array(z.string().uuid()).optional().describe('IDs das permissões a associar'),
  active: z.boolean().optional().describe('Status ativo')
})

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  login: z.string(),
  name: z.string(),
  active: z.boolean()
})

export const setupRoleRoutes = async (fastify) => {
  // Registrar rotas CRUD padrão usando baseRouter
  baseRouter(fastify, controller, {
    tag: 'Roles',
    summary: 'Role',
    schemas: {
      createSchema: RoleCreateSchema,
      updateSchema: RoleUpdateSchema,
      entitySchema: RoleSchema
    },
    middleware: [authenticate, authorize('roles:read') ],
    postMiddleware: [authenticate, authorize('roles:create')],
    putMiddleware: [authenticate, authorize('roles:update')],
    deleteMiddleware: [authenticate, authorize('roles:delete')],
    entityName: 'role'
  })

  // Rota customizada - Listar usuários de uma role
  fastify.get(
    '/:id/users',
    {
      preHandler: [authenticate, authorize('roles:read')],
      schema: {
        tags: ['Roles'],
        summary: 'Listar usuários de uma role',
        description: 'Retorna todos os usuários que possuem uma role específica',
        params: z.object({
          id: z.string().uuid().describe('ID da role')
        }),
        response: {
          200: z.array(UserSchema),
          404: z.object({
            error: z.string(),
            message: z.string(),
            statusCode: z.number().optional()
          })
        }
      }
    },
    controller.getUsersByRole
  )
}
