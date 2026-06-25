import Fastify from 'fastify'
import fastifyQs from 'fastify-qs'
import {
	serializerCompiler,
	validatorCompiler
} from 'fastify-type-provider-zod'
import corsPlugin from 'src/plugins/_cors'
import rateLimitPlugin from 'src/plugins/_rate-limit'
import swaggerPlugin from 'src/plugins/_swagger'
import { z } from 'zod'
import { errorHandler, useUtils } from './helpers'
import { jwtPlugin } from './plugins'
import { segurancaRoutes, testeRoutes } from './routes'

export async function createApp() {
	// biome-ignore lint/correctness/noUnusedVariables: <>
	const { delay } = useUtils()

	const server = Fastify({ logger: true })

	server.setValidatorCompiler(validatorCompiler)
	server.setSerializerCompiler(serializerCompiler)

	await server.register(corsPlugin)
	await server.register(swaggerPlugin)
	await server.register(jwtPlugin)
	await server.register(rateLimitPlugin)
	await server.register(fastifyQs, { parseArrays: true })

	const HomeSchema = {
		tags: ['API Info'],
		summary: 'Informações da API',
		description: 'Retorna informações básicas sobre a API',
		response: {
			200: z.object({
				msg: z.string().describe('Mensagem de boas-vindas da API')
			})
		}
	}

	server.get('/', { schema: HomeSchema }, function handler(_request, _reply) {
		return { msg: 'API TEMPLATE' }
	})

	server.register(segurancaRoutes, { prefix: '/api/seguranca' })
	server.register(testeRoutes, { prefix: '/api/teste' })

	// if (settings.NODE_ENV === 'development') {
	// 	server.addHook('onRequest', async (request) => {
	// 		// Atraso aleatório entre 1s e 5s para simular latência em dev
	// 		const ms = Math.floor(Math.random() * 4000) + 1000
	// 		request.log.info({ delayMs: ms }, 'Aplicando atraso de desenvolvimento')
	// 		await delay(ms)
	// 	})
	// }

	// Registrar o errorHandler nativo do Fastify
	server.setErrorHandler(errorHandler)

	return server
}
