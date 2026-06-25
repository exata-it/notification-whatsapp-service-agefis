import { prisma, authorizationService } from 'src/services'
import { baseController } from 'src/controllers'

const select = {
  id: true,
  identifier: true,
  name: true,
  description: true,
  category: true,
  active: true
}

const base = baseController('Permission', { select })

/**
 * POST - Criar nova permissão
 */
const post = async (request, reply) => {
  const { identifier, name, description, category } = request.body

  // Validar identificador
  if (!identifier || !identifier.includes(':')) {
    return reply.code(400).send({
      error: 'Identificador inválido',
      message: 'Identificador deve seguir padrão: "recurso:ação"'
    })
  }

  const permission = await authorizationService.createPermission({
    identifier,
    name,
    description,
    category
  })

  reply.code(201).send(permission)
}

/**
 * GET - Listar permissões por categoria
 */
const listByCategory = async (request, reply) => {
  const { category } = request.params

  const permissions = await prisma.permission.findMany({
    where: { category, active: true },
    select
  })

  reply.send(permissions)
}

export const permissionController = () => ({
  ...base,
  post,
  listByCategory
})
