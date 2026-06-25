import fastifyJwt from '@fastify/jwt'
import fp from 'fastify-plugin'
import { settings } from 'src/config'

export default fp(async fastify => {
	if (!settings.JWT_SECRET) {
		throw new Error('JWT_SECRET é obrigatório nas configurações')
	}

	await fastify.register(fastifyJwt, {
		secret: settings.JWT_SECRET,
		sign: {
			algorithm: settings.JWT_ALGORITHM,
			expiresIn: settings.JWT_EXPIRES_IN
		},
		verify: {
			algorithms: [settings.JWT_ALGORITHM]
		},
		messages: {
			badRequestErrorMessage:
				'Formato do authorization header deve ser Authorization: Bearer [token]',
			noAuthorizationInHeaderMessage: 'Authorization header não encontrado',
			authorizationTokenExpiredMessage: 'Token expirado',
			authorizationTokenInvalid: 'Token inválido'
		}
	})

	fastify.decorate('authenticate', async (request, reply) => {
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
	})

	/**
	 * @param {object} payload - Dados para o token
	 * @param {object} options - Opções do token
	 * @returns {string} Token JWT
	 */
	fastify.decorate('generateToken', (payload, options = {}) => {
		return fastify.jwt.sign(payload, {
			expiresIn: options.expiresIn || settings.JWT_EXPIRES_IN,
			...options
		})
	})
})
