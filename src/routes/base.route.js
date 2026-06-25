import { z } from 'zod'

/**
 * Base router para registrar automaticamente as 6 rotas padrão de um controller
 * @param {import('fastify').FastifyInstance} fastify - Instância do Fastify
 * @param {object} controller - Controller com os métodos base (all, fetch, one, post, put, del)
 * @param {object} options - Opções do router
 * @param {string} options.tag - Tag para agrupar as rotas na documentação Swagger
 * @param {string} [options.summary] - Resumo opcional das rotas
 * @param {object} [options.schemas] - Schemas Zod para validação (createSchema, updateSchema, entitySchema)
 * @param {object} [options.middleware] - Middleware personalizado para aplicar em todas as rotas
 * @param {Array} [options.listMiddleware] - Middleware específico para GET / e GET /all
 * @param {Array} [options.getMiddleware] - Middleware específico para GET /:id
 * @param {Array} [options.postMiddleware] - Middleware específico para POST /
 * @param {Array} [options.putMiddleware] - Middleware específico para PUT /:id
 * @param {Array} [options.deleteMiddleware] - Middleware específico para DELETE /:id
 * @param {string} [options.entityName] - Nome da entidade (usado para gerar descrições)
 */
function baseRouter(fastify, controller, options = {}) {
	const {
		tag,
		summary = '',
		schemas = {},
		middleware = [],
		listMiddleware = middleware,
		getMiddleware = middleware,
		postMiddleware = middleware,
		putMiddleware = middleware,
		deleteMiddleware = middleware,
		entityName = tag?.toLowerCase() || 'item'
	} = options

	const { createSchema, updateSchema, entitySchema } = schemas

	const { all, fetch, one, post, put, del } = controller

	// Use default middleware if specific ones not provided
	const listMiddlewareArray = listMiddleware?.length > 0 ? listMiddleware : middleware
	const getMiddlewareArray = getMiddleware?.length > 0 ? getMiddleware : middleware
	const postMiddlewareArray = postMiddleware?.length > 0 ? postMiddleware : middleware
	const putMiddlewareArray = putMiddleware?.length > 0 ? putMiddleware : middleware
	const deleteMiddlewareArray = deleteMiddleware?.length > 0 ? deleteMiddleware : middleware

	const errorSchema = z.object({
		error: z.string().optional(),
		message: z.string(),
		statusCode: z.number().optional(),
		details: z.any().optional(),
		errors: z.any().optional()
	})

	const paginationSchema = z.object({
		page: z.number(),
		rowCount: z.number(),
		pageCount: z.number(),
		pageSize: z.number()
	})

	const queryParamsSchema = z.object({
		term: z.string().optional(),
		fields: z
			.union([z.array(z.string()), z.string(), z.undefined()])
			.optional()
			.transform(val => {

				if (Array.isArray(val)) {
					return val
				}
				if (typeof val === 'string') {
					return [val]
				}
				return []
			}),
		order: z.string().optional(),
		orderDirection: z.enum(['asc', 'desc']).default('asc').optional(),
		fspecifics: z.union([
			z.string().regex(/^[^$]+\$[^$]+$/, 'Formato esperado: field$value'),
			z.array(z.string().regex(/^[^$]+\$[^$]+$/, 'Formato esperado: field$value'))
		]).optional(),
		select: z
			.union([z.array(z.string()), z.string(), z.undefined()])
			.optional()
			.transform(val => {
				// Converte array em string (separada por vírgula) para manter compatibilidade
				if (Array.isArray(val)) {
					return val.join(',')
				}
				return val
			}),
	})

	const fetchQueryParamsSchema = queryParamsSchema.extend({
		page: z.coerce.number().positive().optional().default(1),
		pageSize: z.coerce.number().positive().optional().default(20)
	})

	const singleResourceQuerySchema = z.object({
		select: z
			.union([z.array(z.string()), z.string(), z.undefined()])
			.optional()
			.transform(val => {
				if (Array.isArray(val)) {
					return val
				}
				if (typeof val === 'string') {
					return [val]
				}
				return []
			}),
	})

	const idParamsSchema = z.object({
		id: z.uuid()
	})

	// Rota POST - Criar novo registro
	fastify.post('/', {
		preValidation: postMiddlewareArray,
		handler: post,
		schema: {
			tags: [tag],
			summary: summary ? `${summary} - Criar` : `Criar novo ${entityName}`,
			description: `Cria um novo ${entityName}`,
			...(createSchema && { body: createSchema }),
			querystring: singleResourceQuerySchema,
			response: {
				201: entitySchema || z.any(),
				400: errorSchema
			}
		}
	})

	// Rota PUT - Atualizar registro existente
	fastify.put('/:id', {
		preValidation: putMiddlewareArray,
		handler: put,
		schema: {
			tags: [tag],
			summary: summary
				? `${summary} - Atualizar`
				: `Atualizar ${entityName} existente`,
			description: `Atualiza um ${entityName} existente`,
			params: idParamsSchema,
			...(updateSchema && { body: updateSchema }),
			querystring: singleResourceQuerySchema,
			response: {
				200: entitySchema || z.any(),
				400: errorSchema,
				404: errorSchema
			}
		}
	})

	// Rota GET - Listar todos os registros
	fastify.get('/all', {
		preValidation: listMiddlewareArray,
		handler: all,
		schema: {
			tags: [tag],
			summary: summary
				? `${summary} - Listar`
				: `Listar todos os ${entityName}s`,
			description: `Lista todos os ${entityName}s com opções de filtro`,
			querystring: queryParamsSchema,
			response: {
				200: z.object({
					data: z.array(entitySchema || z.any()),
					rowCount: z.number()
				})
			}
		}
	})

	// Rota GET / - Busca paginada
	fastify.get('/', {
		preValidation: listMiddlewareArray,
		handler: fetch,
		schema: {
			tags: [tag],
			summary: summary
				? `${summary} - Buscar`
				: `Buscar ${entityName}s com paginação`,
			description: `Busca ${entityName}s com paginação e filtros`,
			querystring: fetchQueryParamsSchema,
			response: {
				200: z.object({
					data: z.array(entitySchema || z.any()),
					pagination: paginationSchema
				})
			}
		}
	})

	// Rota GET /:id - Obter um registro por ID
	fastify.get('/:id', {
		preValidation: getMiddlewareArray,
		handler: one,
		schema: {
			tags: [tag],
			summary: summary ? `${summary} - Obter` : `Obter ${entityName} por ID`,
			description: `Obtém um ${entityName} específico pelo ID`,
			params: idParamsSchema,
			querystring: singleResourceQuerySchema,
			response: {
				200: entitySchema || z.any(),
				404: errorSchema
			}
		}
	})

	// Rota DELETE /:id - Excluir registro por ID
	fastify.delete('/:id', {
		preValidation: deleteMiddlewareArray,
		handler: del,
		schema: {
			tags: [tag],
			summary: summary
				? `${summary} - Excluir`
				: `Excluir ${entityName} por ID`,
			description: `Exclui um ${entityName} específico pelo ID`,
			params: idParamsSchema,
			response: {
				204: z.null(),
				404: errorSchema
			}
		}
	})
}

export { baseRouter }
export default baseRouter
