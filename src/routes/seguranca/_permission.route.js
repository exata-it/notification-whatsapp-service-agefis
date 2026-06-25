import { authorize, authenticate } from 'src/middleware'
import { permissionController } from 'src/controllers/seguranca'
import { baseRouter } from 'src/routes/base.route'
import { z } from 'zod'

const controller = permissionController()

const PermissionSchema = z.object({
  id: z.string().uuid(),
  identifier: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  active: z.boolean()
})

const PermissionCreateSchema = z.object({
  identifier: z.string().describe('Identificador único (recurso:ação)'),
  name: z.string().describe('Nome da permissão'),
  description: z.string().optional().describe('Descrição da permissão'),
  category: z.string().describe('Categoria da permissão')
})

const PermissionUpdateSchema = z.object({
  identifier: z.string().optional().describe('Identificador único'),
  name: z.string().optional().describe('Nome da permissão'),
  description: z.string().optional().describe('Descrição da permissão'),
  category: z.string().optional().describe('Categoria da permissão'),
  active: z.boolean().optional().describe('Status ativo')
})

export const setupPermissionRoutes = async (fastify) => {
  // Registrar rotas CRUD padrão usando baseRouter
  baseRouter(fastify, controller, {
    tag: 'Permissões',
    summary: 'Permissão',
    schemas: {
      createSchema: PermissionCreateSchema,
      updateSchema: PermissionUpdateSchema,
      entitySchema: PermissionSchema
    },
    middleware: [authenticate, authorize('permissions:read') ],
    postMiddleware: [authenticate, authorize('permissions:create')],
    putMiddleware: [authenticate, authorize('permissions:update')],
    deleteMiddleware: [authenticate, authorize('permissions:delete')],
    entityName: 'permissão'
  })

  // Rota customizada - Listar por categoria
  fastify.get(
    '/category/:category',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Permissões'],
        summary: 'Listar por categoria',
        description: 'Retorna permissões de uma categoria específica',
        params: z.object({
          category: z.string().describe('Categoria da permissão')
        }),
        response: {
          200: z.array(PermissionSchema)
        }
      }
    },
    controller.listByCategory
  )
}
