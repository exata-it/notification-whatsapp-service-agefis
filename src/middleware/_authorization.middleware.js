import { authorizationService } from 'src/services/index.js'

/**
 * Middleware que verifica se usuário está autenticado
 */
const authenticate = async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    const statusCode = err.statusCode || 401
    reply.code(statusCode).send({
      error: 'Unauthorized',
      message: err.message || 'Token inválido ou expirado',
      statusCode
    })
  }
}

/**
 * Middleware que verifica se usuário tem permissão(ões) específica(s)
 */
function authorize(requiredPermissions, options = {}) {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions]

  const { requireAll = false } = options

  return async (request, reply) => {
    if (!request.user?.id) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Usuário não identificado',
        statusCode: 401
      })
    }

    const userPermissions = await authorizationService.getUserPermissions(
      request.user.id
    )

    // Verificar se usuário tem as permissões necessárias (levando em conta wildcards)
    const hasRequiredPermissions = permissions.map(perm =>
      authorizationService.checkPermissionMatch(perm, userPermissions)
    )

    const hasAccess = requireAll
      ? hasRequiredPermissions.every(has => has)
      : hasRequiredPermissions.some(has => has)

    if (!hasAccess) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Você não tem permissão para acessar este recurso',
        required: permissions,
        statusCode: 403
      })
    }

    // Enriquecer request com informações de permissão
    request.permissions = userPermissions
  }
}

/**
 * Middleware que verifica se usuário é admin
 */
async function requireAdmin(request, reply) {
  if (!request.user?.id) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Usuário não identificado',
      statusCode: 401
    })
  }

  const roles = await authorizationService.getUserRoles(request.user.id)

  // Checa TODAS as roles, não apenas a primeira (roles[0]).
  const isAdmin = roles.some(role => ['ADMIN', 'SUPER_ADMIN'].includes(role))
  if (!isAdmin) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Acesso restrito a administradores',
      statusCode: 403
    })
  }
}

/**
 * Middleware que verifica se é super admin
 */
async function requireSuperAdmin(request, reply) {
  if (!request.user?.id) {
    return reply.code(401).send({
      error: 'Unauthorized',
      statusCode: 401
    })
  }

  const roles = await authorizationService.getUserRoles(request.user.id)

  if (!roles.includes('SUPER_ADMIN')) {
    return reply.code(403).send({
      error: 'Forbidden',
      message: 'Acesso restrito a super administradores',
      statusCode: 403
    })
  }
}

export {
  authenticate,
  authorize,
  requireAdmin,
  requireSuperAdmin
}
