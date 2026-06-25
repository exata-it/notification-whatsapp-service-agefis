import { prisma, authorizationService } from 'src/services'
import { baseController } from 'src/controllers'

const select = {
  id: true,
  name: true,
  active: true,
  rolePermissions: {
    select: {
      permission: {
        select: { id: true, identifier: true, name: true }
      }
    }
  }
}

const base = baseController('Role', { select })

/**
 * POST - Criar nova role com permissões
 */
const post = async (request, reply) => {
  const { name, permissionIds } = request.body

  if (!name) {
    return reply.code(400).send({
      error: 'Nome da role é obrigatório'
    })
  }

  const role = await authorizationService.createRole(name, null, permissionIds || [])

  reply.code(201).send(role)
}

/**
 * PUT - Atualizar role e suas permissões
 */
const put = async (request, reply) => {
  const { id } = request.params
  const { name, active, permissionIds } = request.body

  // Atualizar role básico
  const role = await prisma.role.update({
    where: { id },
    data: {
      name: name !== undefined ? name : undefined,
      active: active !== undefined ? active : undefined
    },
    select
  })

  // Atualizar permissões se fornecidas
  if (permissionIds && Array.isArray(permissionIds)) {
    // Remover permissões antigas
    await prisma.rolePermission.deleteMany({
      where: { roleId: id }
    })

    // Criar novas associações
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({
          roleId: id,
          permissionId
        }))
      })
    }

    // Limpar cache de usuários com essa role
    const userRoles = await prisma.userRole.findMany({
      where: { roleId: id },
      select: { userId: true }
    })

    userRoles.forEach(({ userId }) => {
      authorizationService.clearCache(userId)
    })
  }

  // Retornar role atualizada
  const updated = await prisma.role.findUnique({
    where: { id },
    select
  })

  reply.send(updated)
}

/**
 * GET - Listar roles ativas
 */
const list = async (request, reply) => {
  const roles = await prisma.role.findMany({
    where: { active: true },
    select
  })

  reply.send(roles)
}

/**
 * GET - Listar usuários de uma role
 */
const getUsersByRole = async (request, reply) => {
  const { id } = request.params

  const userRoles = await prisma.userRole.findMany({
    where: { roleId: id },
    select: {
      user: {
        select: { id: true, email: true, login: true, name: true, active: true }
      }
    }
  })

  const users = userRoles.map(({ user }) => user)
  reply.send(users)
}

export const roleController = () => ({
  ...base,
  post,
  put,
  list,
  getUsersByRole
})
