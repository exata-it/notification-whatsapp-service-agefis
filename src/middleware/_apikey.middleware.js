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
		// Drena o upload pendente: sem isso, rejeitar uma request multipart antes
		// de consumir o body trava o cliente por backpressure até o timeout dele.
		request.raw.resume()
		return reply.code(503).send({
			error: 'Service Unavailable',
			message: 'API key não configurada no servidor (INTERNAL_API_KEYS)',
			statusCode: 503
		})
	}

	const provided = request.headers['x-api-key']

	if (!provided || !INTERNAL_API_KEYS.some(key => safeEqual(provided, key))) {
		// DEBUG temporário: diagnosticar mismatch de API key. Remover após resolver.
		request.log.warn(
			{
				tem_header: !!provided,
				tamanho_recebido: provided?.length ?? 0,
				prefixo_recebido: provided?.slice(0, 4) ?? null,
				qtd_keys_configuradas: INTERNAL_API_KEYS.length,
				tamanhos_configurados: INTERNAL_API_KEYS.map(k => k.length),
				headers_recebidos: Object.keys(request.headers)
			},
			'[apikey] rejeitada — diagnóstico'
		)
		request.raw.resume()
		return reply.code(401).send({
			error: 'Unauthorized',
			message: 'API key inválida ou ausente',
			statusCode: 401
		})
	}
}

export { apiKeyAuth }
