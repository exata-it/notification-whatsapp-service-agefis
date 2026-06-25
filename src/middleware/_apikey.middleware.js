import { timingSafeEqual } from 'node:crypto'
import { settings } from 'src/config'

/**
 * Comparação de strings resistente a timing attack.
 */
function safeEqual(a, b) {
	const bufA = Buffer.from(a)
	const bufB = Buffer.from(b)
	if (bufA.length !== bufB.length) return false
	return timingSafeEqual(bufA, bufB)
}

/**
 * Middleware de autenticação por API key (header `x-api-key`).
 * Usado para o app bater diretamente nas rotas internas.
 */
async function apiKeyAuth(request, reply) {
	const { INTERNAL_API_KEYS } = settings

	if (INTERNAL_API_KEYS.length === 0) {
		return reply.code(503).send({
			error: 'Service Unavailable',
			message: 'API key não configurada no servidor (INTERNAL_API_KEYS)',
			statusCode: 503
		})
	}

	const provided = request.headers['x-api-key']

	if (!provided || !INTERNAL_API_KEYS.some(key => safeEqual(provided, key))) {
		return reply.code(401).send({
			error: 'Unauthorized',
			message: 'API key inválida ou ausente',
			statusCode: 401
		})
	}
}

export { apiKeyAuth }
