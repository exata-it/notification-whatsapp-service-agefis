import { prisma, authorizationService } from 'src/services'

/**
 * GET - Listar permissões de um usuário
 */
const getUserPermissions = async (request, reply) => {
  const { userId } = request.params
  const { id: checkUser } = request.user

  // Verificar se o usuário está tentando acessar suas próprias permissões ou tem permissão admin
  if (userId !== request.user.id && !await authorizationService.hasPermission(checkUser, 'users:manage')) {
    return reply.code(403).send({
      error: 'Acesso negado',
      message: 'Você não tem permissão para visualizar permissões de outros usuários'
    })
  }

  const permissions = await authorizationService.getUserPermissions(userId)
  reply.send({ userId, permissions })
}

/**
 * GET - Listar roles de um usuário
 */
const getUserRoles = async (request, reply) => {
  const { userId } = request.params
  const { id: checkUser } = request.user

  // Verificar se o usuário está tentando acessar seus próprios roles ou tem permissão admin
  if (userId !== request.user.id && !await authorizationService.hasPermission(checkUser, 'users:manage')) {
    return reply.code(403).send({
      error: 'Acesso negado',
      message: 'Você não tem permissão para visualizar roles de outros usuários'
    })
  }

  const roles = await authorizationService.getUserRoles(userId)
  reply.send({ userId, roles })
}

/**
 * GET - Listar detalhes completos das permissões de um usuário (diretas + via roles)
 */
const getUserPermissionsDetail = async (request, reply) => {
  const { userId } = request.params
  const { id: checkUser } = request.user

  // Verificar acesso
  if (userId !== request.user.id && !await authorizationService.hasPermission(checkUser, 'users:manage')) {
    return reply.code(403).send({
      error: 'Acesso negado',
      message: 'Você não tem permissão para visualizar detalhes de permissões de outros usuários'
    })
  }

  // Buscar permissões diretas
  const directPermissions = await prisma.userPermission.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    include: {
      permission: {
        select: { id: true, identifier: true, name: true, category: true }
      }
    }
  })

  // Buscar permissões via roles
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        select: {
          id: true,
          name: true,
          rolePermissions: {
            include: {
              permission: {
                select: { id: true, identifier: true, name: true, category: true }
              }
            }
          }
        }
      }
    }
  })

  reply.send({
    userId,
    directPermissions: directPermissions.map(up => ({
      ...up.permission,
      grantedAt: up.grantedAt,
      expiresAt: up.expiresAt,
      grantedBy: up.grantedBy
    })),
    rolePermissions: userRoles.flatMap(ur => ({
      roleName: ur.role.name,
      roleId: ur.role.id,
      permissions: ur.role.rolePermissions.map(rp => rp.permission)
    }))
  })
}

/**
 * POST - Conceder permissão a um usuário
 */
const grantPermission = async (request, reply) => {
  const { userId, permissionId } = request.body
  const { id: grantedBy } = request.user

  // Validar que o usuário existe
  const user = await prisma.User.findUnique({ where: { id: userId } })
  if (!user) {
    return reply.code(404).send({
      error: 'Usuário não encontrado',
      message: `Usuário com ID ${userId} não existe`
    })
  }

  // Validar que a permissão existe
  const permission = await prisma.permission.findUnique({ where: { id: permissionId } })
  if (!permission) {
    return reply.code(404).send({
      error: 'Permissão não encontrada',
      message: `Permissão com ID ${permissionId} não existe`
    })
  }

  const expiresAt = request.body.expiresAt ? new Date(request.body.expiresAt) : null

  const userPermission = await authorizationService.grantPermissionToUser(
    userId,
    permissionId,
    grantedBy,
    expiresAt
  )

  reply.code(201).send({
    userId,
    permissionId,
    permission,
    grantedAt: userPermission.grantedAt,
    expiresAt: userPermission.expiresAt
  })
}

/**
 * DELETE - Revogar permissão de um usuário
 */
const revokePermission = async (request, reply) => {
  const { userId, permissionId } = request.params
  const { id: revokedBy } = request.user

  await authorizationService.revokePermissionFromUser(userId, permissionId, revokedBy)

  reply.code(204).send()
}

/**
 * POST - Atribuir role a um usuário
 */
const assignRole = async (request, reply) => {
  const { userId, roleId } = request.body
  const { id: assignedBy } = request.user

  // Validar que o usuário existe
  const user = await prisma.User.findUnique({ where: { id: userId } })
  if (!user) {
    return reply.code(404).send({
      error: 'Usuário não encontrado',
      message: `Usuário com ID ${userId} não existe`
    })
  }

  // Validar que a role existe
  const role = await prisma.role.findUnique({ where: { id: roleId } })
  if (!role) {
    return reply.code(404).send({
      error: 'Role não encontrada',
      message: `Role com ID ${roleId} não existe`
    })
  }

  const expiresAt = request.body.expiresAt ? new Date(request.body.expiresAt) : null

  const userRole = await authorizationService.assignRoleToUser(
    userId,
    roleId,
    assignedBy,
    expiresAt
  )

  reply.code(201).send({
    userId,
    roleId,
    role,
    assignedAt: userRole.assignedAt,
    expiresAt: userRole.expiresAt
  })
}

/**
 * DELETE - Remover role de um usuário
 */
const removeRole = async (request, reply) => {
  const { userId, roleId } = request.params
  const { id: removedBy } = request.user

  await authorizationService.removeRoleFromUser(userId, roleId, removedBy)

  reply.code(204).send()
}

export const userAuthorizationController = () => ({
  getUserPermissions,
  getUserRoles,
  getUserPermissionsDetail,
  grantPermission,
  revokePermission,
  assignRole,
  removeRole
})
