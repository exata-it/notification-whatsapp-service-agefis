import bcrypt from 'bcrypt'
import { prisma, authorizationService } from 'src/services'

// Hash "descartável" usado para igualar o tempo de resposta quando o usuário
// não existe — evita enumeração de usuários por timing attack.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-mitigation-dummy', 10)

export const sessionController = () => {
	/**
	 * @param {import('fastify').FastifyRequest} request
	 * @param {import('fastify').FastifyReply} reply
	 */
	const _login = async (request, reply) => {
		const { email, password } = request.body

		const usuario = await prisma.User.findFirst({
			where: {
				OR: [{ email: email.toLowerCase() }, { login: email.toLowerCase() }],
				active: true
			},
			select: {
				email: true,
				active: true,
				id: true,
				password_hash: true,
				name: true,
				login: true
			}
		})

		// Sempre comparar com um hash (real ou dummy) para tempo constante.
		const hashToCompare = usuario?.password_hash || DUMMY_HASH
		const isPasswordValid = await bcrypt.compare(password, hashToCompare)

		// Mensagem genérica: não revela se o usuário existe ou está inativo.
		if (!usuario || !usuario.active || !isPasswordValid) {
			return reply.code(401).send({
				error: 'Unauthorized',
				message: 'Usuário ou senha inválidos'
			})
		}

		const [permissions, roles] = await Promise.all([
			authorizationService.getUserPermissions(usuario.id),
			authorizationService.getUserRoles(usuario.id)
		])

		// Token enxuto: apenas identidade. Permissões/roles são buscadas no
		// servidor a cada requisição, então NÃO são embutidas no JWT — isso
		// evita permissões desatualizadas presas no token até a expiração.
		const token = request.server.generateToken({
			id: usuario.id,
			email: usuario.email,
			login: usuario.login,
			name: usuario.name
		})

		return reply.send({
			user: {
				id: usuario.id,
				email: usuario.email,
				login: usuario.login,
				name: usuario.name,
				roles,
				permissions
			},
			token
		})
	}

	/**
	 * @param {import('fastify').FastifyRequest & { user?: {id: string} }} request
	 * @param {import('fastify').FastifyReply} reply
	 */
	const getSession = async (request, reply) => {
		const userId = request.user?.id

		if (!userId) {
			return reply.code(401).send({
				error: 'Unauthorized',
				message: 'Token inválido'
			})
		}

		const usuario = await prisma.User.findUnique({
			where: {
				id: userId,
				active: true
			},
			omit: {
				password_hash: true
			}
		})

		if (!usuario) {
			return reply.code(401).send({
				error: 'Unauthorized',
				message: 'Usuário não encontrado ou inativo'
			})
		}

		const [roles, permissions] = await Promise.all([
			authorizationService.getUserRoles(userId),
			authorizationService.getUserPermissions(userId, true)
		])

		return reply.send({
			usuario: {
				id: usuario.id,
				email: usuario.email,
				login: usuario.login,
				name: usuario.name,
				roles,
				permissions,
				createdAt: usuario.createdAt,
				updatedAt: usuario.updatedAt,
				active: usuario.active
			}
		})
	}

	return {
		login: _login,
		getSession
	}
}
