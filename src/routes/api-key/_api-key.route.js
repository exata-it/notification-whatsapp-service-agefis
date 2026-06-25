import { apiKeyController } from 'src/controllers/api-key'
import { z } from 'zod'

const TokenGeradoSchema = z
	.object({
		success: z.literal(true),
		token: z.string().describe('Token gerado (hex, 64 caracteres)'),
		envVar: z
			.string()
			.describe('Variável de ambiente onde o token deve ser colado'),
		instrucoes: z.string().describe('Como utilizar o token gerado')
	})
	.describe('Token de API gerado')

export function apiKeyRoutes(fastify) {
	const controller = apiKeyController()

	fastify.get(
		'/generate',
		{
			schema: {
				tags: ['API Key'],
				summary: 'Gerar token de API',
				description: [
					'Gera um token de API forte e aleatório e o **retorna apenas** — nada é persistido.',
					'',
					'Os tokens válidos são **fixos via env** (`INTERNAL_API_KEYS`). Para ativar o token,',
					'cole o valor retornado nessa variável de ambiente e reinicie o serviço.',
					'O token não concede acesso enquanto não estiver no env.'
				].join('\n'),
				response: {
					200: TokenGeradoSchema
				}
			}
		},
		controller.generate
	)
}
