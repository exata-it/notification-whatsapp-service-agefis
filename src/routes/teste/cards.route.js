import { baseRouter } from 'src/routes'
import { authenticate, authorize } from 'src/middleware'
import { z } from 'zod'
import { cardController } from 'src/controllers/teste'

const CardCreateSchema = z.object({
  title  :z.string().min(1,"titulo é requerido").describe("um lindo titulo"),
  description: z.string().nullish()
})

const CardUpdateSchema = z.object({
	  title  :z.string().min(1,"titulo é requerido").describe("um lindo titulo"),
      description: z.string().nullish()
})

const CardSchema = z.object({
  id: z.uuid({
	version: 'v7'
  }).describe('ID do card'),
  title: z.string().describe('Título do card'),
  description: z.string().nullable().describe('Descrição do card'),
  createdAt: z.date().describe('Data de criação (ISO 8601)'),
  updatedAt: z.date().describe('Data de atualização (ISO 8601)')
})


export function cardRoutes(fastify) {
	const controller = cardController()

	const listMiddleware = [authenticate, authorize('cards:read')]
	const createMiddleware = [authenticate, authorize('cards:create')]
	const updateMiddleware = [authenticate, authorize('cards:update')]
	const deleteMiddleware = [authenticate, authorize('cards:delete')]

	baseRouter(fastify, controller, {
		tag: 'cards',
		summary: 'Gerenciamento de cards',
		entityName: 'cards',
		listMiddleware: listMiddleware,
		getMiddleware: listMiddleware,
		postMiddleware: createMiddleware,
		putMiddleware: updateMiddleware,
		deleteMiddleware: deleteMiddleware,
		schemas: {
			createSchema: CardCreateSchema,
			updateSchema: CardUpdateSchema,
			entitySchema: CardSchema
		}
	})

	// TODO: Adicione rotas customizadas aqui se necessário
	// Exemplo:
	// fastify.route({
	//   method: 'POST',
	//   url: '/custom',
	//   preHandler: createMiddleware,
	//   handler: controller.customMethod
	// })
}
