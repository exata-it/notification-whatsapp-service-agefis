import fp from 'fastify-plugin'

/**
 * Rate limiter em memória (janela fixa por IP).
 *
 * Sem dependência externa e sem infraestrutura adicional — adequado para uma
 * única instância. Em deploy multi-instância cada processo mantém seu próprio
 * contador; para um limite global use um store compartilhado (ex: Redis).
 *
 * NOTA: usa request.ip. Atrás de proxy reverso, habilite `trustProxy` no
 * Fastify apenas se o proxy for confiável — caso contrário o cliente pode
 * forjar X-Forwarded-For e burlar o limite.
 */
export default fp(async fastify => {
	const buckets = new Map()

	function hit(key, max, windowMs) {
		const now = Date.now()
		const entry = buckets.get(key)
		if (!entry || now > entry.reset) {
			buckets.set(key, { count: 1, reset: now + windowMs })
			return { allowed: true, remaining: max - 1 }
		}
		entry.count += 1
		return {
			allowed: entry.count <= max,
			remaining: Math.max(0, max - entry.count)
		}
	}

	// Limpeza periódica dos buckets expirados
	const cleanup = setInterval(() => {
		const now = Date.now()
		for (const [key, entry] of buckets) {
			if (now > entry.reset) buckets.delete(key)
		}
	}, 60_000)
	cleanup.unref?.()
	fastify.addHook('onClose', async () => clearInterval(cleanup))

	/**
	 * Cria um preHandler de rate limit.
	 * @param {object} opts
	 * @param {number} [opts.max=100] - Máximo de requisições por janela
	 * @param {number} [opts.windowMs=60000] - Tamanho da janela em ms
	 * @param {string} [opts.keyPrefix='global'] - Prefixo para separar limites
	 */
	fastify.decorate('rateLimit', (opts = {}) => {
		const { max = 100, windowMs = 60_000, keyPrefix = 'global' } = opts
		return async (request, reply) => {
			const key = `${keyPrefix}:${request.ip}`
			const { allowed, remaining } = hit(key, max, windowMs)

			reply.header('x-ratelimit-limit', String(max))
			reply.header('x-ratelimit-remaining', String(remaining))

			if (!allowed) {
				return reply.code(429).send({
					error: 'Too Many Requests',
					message:
						'Limite de requisições excedido. Tente novamente mais tarde.',
					statusCode: 429
				})
			}
		}
	})
})
