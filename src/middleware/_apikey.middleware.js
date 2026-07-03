import { timingSafeEqual } from 'node:crypto'
import { settings } from 'src/config'

/**
 * Comparação de strings resistente a timing attack.
 */
function safeEqual(a, b) {
	const bufA = Buffer.from(String(a))
	const bufB = Buffer.from(String(b))
	if (bufA.length !== bufB.length) return false
	return timingSafeEqual(bufA, bufB)
}

/**
 * Rejeita sem ler o corpo. Como o upload multipart pode estar em andamento no
 * socket, responde com `Connection: close`: o Node fecha a conexão após a
 * resposta, abortando o upload pendente. Isso evita o backpressure que trava o
 * cliente (o "limbo"). Não drenamos o corpo inteiro — um não-autorizado não
 * deve conseguir forçar o servidor a consumir uploads grandes.
 */
function rejeitar(request, reply, code, message) {
	request.log.warn({ code }, '[apikey] rejeitada')
	return reply
		.header('Connection', 'close')
		.code(code)
		.send({
			error: code === 401 ? 'Unauthorized' : 'Service Unavailable',
			message,
			statusCode: code
		})
}

/**
 * Middleware de autenticação por API key (header `x-api-key`).
 * Roda em `onRequest` — antes do parsing do corpo — para rejeitar cedo sem
 * tocar no upload multipart. Usado para o app bater diretamente nas rotas internas.
 */
async function apiKeyAuth(request, reply) {
	const { INTERNAL_API_KEYS } = settings

	if (INTERNAL_API_KEYS.length === 0) {
		return rejeitar(
			request,
			reply,
			503,
			'API key não configurada no servidor (INTERNAL_API_KEYS)'
		)
	}

	const header = request.headers['x-api-key']
	// header repetido chega como array — normaliza p/ não estourar no Buffer
	const provided = Array.isArray(header) ? header[0] : header

	if (!provided || !INTERNAL_API_KEYS.some(key => safeEqual(provided, key))) {
		return rejeitar(request, reply, 401, 'API key inválida ou ausente')
	}
}

export { apiKeyAuth }
