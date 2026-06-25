import { randomBytes } from 'node:crypto'

function apiKeyController() {
	/**
	 * Gera um token de API forte (apenas retorna — NÃO persiste).
	 * Os tokens válidos são fixos via env `INTERNAL_API_KEYS`. Use o valor
	 * gerado aqui colando-o nessa variável de ambiente.
	 */
	async function generate(request, reply) {
		const token = randomBytes(32).toString('hex')

		return reply.code(200).send({
			success: true,
			token,
			envVar: 'INTERNAL_API_KEYS',
			instrucoes:
				'Cole este valor em INTERNAL_API_KEYS no .env e reinicie o serviço. ' +
				'Para múltiplas keys, separe por vírgula. O token não tem efeito até ser adicionado ao env.'
		})
	}

	return { generate }
}

export { apiKeyController }
