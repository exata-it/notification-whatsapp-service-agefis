import { prisma } from './index.js'

// Cache em memória com TTL
const permissionCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

/**
 * Limpa cache expirado
 */
function invalidateCache(userId) {
  permissionCache.delete(userId)
}

/**
 * Verifica se cache expirou
 */
function isCacheExpired(timestamp) {
  return Date.now() - timestamp > CACHE_TTL
}

/**
 * Obtém todas as permissões de um usuário (com cache)
 * @param {number} userId - ID do usuário
 * @param {boolean} forceRefresh - Se true, ignora o cache e busca direto do banco
 */
async function getUserPermissions(userId, forceRefresh = false) {
  // Verificar cache (se não forçar refresh)
  if (!forceRefresh) {
    const cached = permissionCache.get(userId)
    if (cached && !isCacheExpired(cached.timestamp)) {
      return cached.permissions
    }
  }

  // Buscar do banco
  const now = new Date()
  const [directPermissions, rolePermissions] = await Promise.all([
    // Permissões diretas do usuário (ignorando expiradas)
    prisma.userPermission.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      include: { permission: true }
    }),
    // Permissões via roles (ignorando atribuições expiradas e roles inativas)
    prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        role: { active: true }
      },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } }
        }
      }
    })
  ])

  // Compilar permissões únicas
  const permissions = new Set()

  // Adicionar permissões diretas (apenas permissões ativas)
  directPermissions.forEach(up => {
    if (up.permission.active) permissions.add(up.permission.identifier)
  })

  // Adicionar permissões dos roles (apenas permissões ativas)
  rolePermissions.forEach(ur => {
    ur.role.rolePermissions.forEach(rp => {
      if (rp.permission.active) permissions.add(rp.permission.identifier)
    })
  })

  // Se tiver wildcard '*', retornar apenas isso
  if (permissions.has('*')) {
    permissions.clear()
    permissions.add('*')
  }

  const permissionArray = Array.from(permissions)

  // Cachear
  permissionCache.set(userId, {
    permissions: permissionArray,
    timestamp: Date.now()
  })

  return permissionArray
}

/**
 * Obtém todos os roles de um usuário
 */
async function getUserRoles(userId) {
  const now = new Date()
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      role: { active: true }
    },
    include: { role: true }
  })
  return userRoles.map(ur => ur.role.name)
}

/**
 * Verifica se usuário tem uma permissão específica
 */
async function hasPermission(userId, requiredPermission) {
  const userPermissions = await getUserPermissions(userId)
  return checkPermissionMatch(requiredPermission, userPermissions)
}

/**
 * Verifica se permissão é concedida (suporta wildcards)
 */
function checkPermissionMatch(required, userPermissions) {
  // Permissão exata
  if (userPermissions.includes(required)) return true

  // Wildcard total (super admin)
  if (userPermissions.includes('*')) return true

  const [resource, action] = required.split(':')

  if (!resource || !action) return false

  // Wildcard de recurso: "users:*"
  if (userPermissions.includes(`${resource}:*`)) return true

  // Wildcard de ação: "*:read"
  if (userPermissions.includes(`*:${action}`)) return true

  return false
}

/**
 * Concede permissão a um usuário
 */
async function grantPermissionToUser(userId, permissionId, grantedBy, expiresAt = null) {
  const userPermission = await prisma.userPermission.upsert({
    where: { userId_permissionId: { userId, permissionId } },
    create: {
      userId,
      permissionId,
      grantedBy,
      expiresAt
    },
    update: {
      expiresAt,
      grantedAt: new Date()
    }
  })

  // Invalidar cache
  invalidateCache(userId)

  return userPermission
}

/**
 * Remove permissão de um usuário
 */
async function revokePermissionFromUser(userId, permissionId, revokedBy) {
  await prisma.userPermission.delete({
    where: { userId_permissionId: { userId, permissionId } }
  })

  invalidateCache(userId)
}

/**
 * Atribui role a um usuário
 */
async function assignRoleToUser(userId, roleId, assignedBy, expiresAt = null) {
  const userRole = await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    create: {
      userId,
      roleId,
      assignedBy,
      expiresAt
    },
    update: {
      expiresAt,
      assignedAt: new Date()
    }
  })

  invalidateCache(userId)

  return userRole
}

/**
 * Remove role de um usuário
 */
async function removeRoleFromUser(userId, roleId, removedBy) {
  await prisma.userRole.delete({
    where: { userId_roleId: { userId, roleId } }
  })

  invalidateCache(userId)
}

/**
 * Cria nova permissão
 */
async function createPermission(data) {
  const permission = await prisma.permission.create({ data })
  permissionCache.clear() // Limpar todos os caches
  return permission
}

/**
 * Cria novo role
 */
async function createRole(name, description, permissionIds = []) {
  const role = await prisma.role.create({
    data: {
      name,
      rolePermissions: {
        createMany: {
          data: permissionIds.map(permissionId => ({ permissionId }))
        }
      }
    },
    include: { rolePermissions: { include: { permission: true } } }
  })

  permissionCache.clear()

  return role
}

/**
 * Limpa cache
 */
function clearCache(userId = null) {
  if (userId) {
    invalidateCache(userId)
  } else {
    permissionCache.clear()
  }
}

export const authorizationService = {
  getUserPermissions,
  getUserRoles,
  hasPermission,
  checkPermissionMatch,
  grantPermissionToUser,
  revokePermissionFromUser,
  assignRoleToUser,
  removeRoleFromUser,
  createPermission,
  createRole,
  clearCache
}
