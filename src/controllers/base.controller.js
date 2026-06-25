import { useUtils } from 'src/helpers'
import { prisma } from 'src/services'

function baseController(model, params = {}) {
	const { 
		select = null, 
		include = null, 
		omit = null,
		allowedFields = null,
		sensitiveFields = ['senha', 'password', 'token', 'hash']
	} = params
	const { mappingFields, mapOrder } = useUtils()

	/**
	 * Valida e processa campos solicitados dinamicamente
	 * @param {string|null} requestSelect - Campo select da requisição (ex: "nome,email")
	 * @returns {object|null} Objeto select validado ou null
	 */
	function validateAndBuildSelect(requestSelect) {
		// Se não foi solicitado select dinâmico, retorna o select estático
		if (!requestSelect || typeof requestSelect !== 'string') {
			return select
		}

		// Se allowedFields não está configurado, não permitir select dinâmico por segurança
		if (!Array.isArray(allowedFields)) {
			return select
		}

		const requestedFields = requestSelect
			.split(',')
			.map(f => f.trim())
			.filter(f => f.length > 0)

		// Validar cada campo
		const validatedFields = requestedFields.reduce((acc, field) => {
			// Verificar se o campo é permitido
			if (!allowedFields.includes(field)) {
				return acc
			}

			// Verificar se o campo é sensível
			if (sensitiveFields.includes(field)) {
				return acc
			}

			acc[field] = true
			return acc
		}, {})

		// Se nenhum campo válido foi encontrado, retorna select estático
		if (Object.keys(validatedFields).length === 0) {
			return select
		}

		return validatedFields
	}

	/**
	 * Constrói opções de query do Prisma
	 * @param {string|null} dynamicSelect - Campo select dinâmico da requisição
	 * @returns {object} Opções com select/include/omit
	 */
	function buildQueryOptions(dynamicSelect = null) {
		const options = {}
		const finalSelect = validateAndBuildSelect(dynamicSelect)
		
		// Se há select dinâmico, use APENAS select (não use omit)
		// Prisma não permite usar select e omit ao mesmo tempo
		if (finalSelect) {
			options.select = finalSelect
		} else {
			// Se não há select dinâmico, use as opções estáticas (include ou omit)
			if (select) options.select = select
			if (include) options.include = include
			if (omit) options.omit = omit
		}
		
		return options
	}

	/**
	 * Constrói o predicado where baseado em termo e filtros específicos
	 * @param {string|null} term - Termo de busca
	 * @param {Array} fields - Campos onde buscar o termo
	 * @param {Array} fspecifics - Filtros específicos
	 * @returns {object} Objeto com where
	 */
	function buildWherePredicate(term, fields, fspecifics) {
		let predicate = { where: {} }
		const table = prisma[model].getDatabase()

		// Aplicar busca por termo se fornecido
		if (term && Array.isArray(fields) && fields.length > 0) {
			predicate = {
				where: {
					OR: fields
						.map(m => mappingFields(m, term, table))
						.filter(m => m) // Remover valores nulos/undefined
				}
			}

			// Se nenhum filtro OR válido, resetar
			if (predicate.where.OR.length === 0) {
				predicate = { where: {} }
			}
		}

		// Aplicar filtros específicos
		if (Array.isArray(fspecifics) && fspecifics.length > 0) {
			const validFspecifics = fspecifics
				.filter(m => m && typeof m === 'string')
				.map(m => m.split('$'))
				.filter(([field, value]) => field && value) // Validar estrutura
				.map(([field, value]) => mappingFields(field, value, table))
				.filter(m => m) // Remover valores nulos/undefined

			if (validFspecifics.length > 0) {
				predicate.where = {
					...predicate.where,
					AND: validFspecifics
				}
			}
		}

		return predicate
	}

	/**
	 * Processa e valida a ordenação
	 * @param {string|null} order - Campo para ordenar
	 * @param {string} orderDirection - Direção da ordenação (asc/desc)
	 * @returns {object|null} Objeto orderBy para Prisma
	 */
	function buildOrderBy(order, orderDirection = 'asc') {
		if (!order) return {}

		if (typeof order === 'string') {
			const direction = ['asc', 'desc'].includes(orderDirection?.toLowerCase()) 
				? orderDirection.toLowerCase() 
				: 'asc'
			return { [order]: direction }
		}

		// Se order é um array ou objeto complexo, usar mapOrder
		return mapOrder(order) || {}
	}

	/**
	 * @param {import('fastify').FastifyRequest} request
	 * @param {import('fastify').FastifyReply} reply
	 */
	async function all(request, reply) {
		const {
			fields = [],
			term = null,
			order = null,
			orderDirection = 'asc',
			fspecifics = [],
			select: dynamicSelect = null
		} = request.query

		const predicate = buildWherePredicate(term, fields, fspecifics)
		const orderBy = buildOrderBy(order, orderDirection)

		const [rowCount, data] = await prisma.$transaction([
			prisma[model].count({ ...predicate }),
			prisma[model].findMany({
				...predicate,
				...(Object.keys(orderBy).length > 0 && { orderBy }),
				...buildQueryOptions(dynamicSelect)
			})
		])
		reply.send({ data, rowCount })
	}

	/**
	 * @param {import('fastify').FastifyRequest} request
	 * @param {import('fastify').FastifyReply} reply
	 */
	async function fetch(request, reply) {
		const {
			fields = [],
			term = null,
			order = null,
			orderDirection = 'asc',
			page = 1,
			pageSize = 20,
			fspecifics = [],
			select: dynamicSelect = null
		} = request.query

		const predicate = buildWherePredicate(term, fields, fspecifics)
		const orderBy = buildOrderBy(order, orderDirection)

		const [rowCount, data] = await prisma.$transaction([
			prisma[model].count({ ...predicate }),
			prisma[model].findMany({
				...predicate,
				take: Number(pageSize),
				skip: (Number(page) - 1) * Number(pageSize),
				...(Object.keys(orderBy).length > 0 && { orderBy }),
				...buildQueryOptions(dynamicSelect)
			})
		])
		reply.send({
			data,
			pagination: {
				page: Number(page),
				rowCount,
				pageCount: Math.ceil(rowCount / Number(pageSize)) || 1,
				pageSize: Number(pageSize)
			}
		})
	}

	/**
	 * @param {import('fastify').FastifyRequest} request
	 * @param {import('fastify').FastifyReply} reply
	 */
	async function one(request, reply) {
		const { id } = request.params
		const { select: dynamicSelect = null } = request.query
		
		const data = await prisma[model].findUnique({
			where: { id: id },
			...buildQueryOptions(dynamicSelect)
		})
		if (!data) {
			const error = new Error('Registro não localizado.')
			error.statusCode = 404
			throw error
		}
		reply.send(data)
	}

	/**
	 * @param {import('fastify').FastifyRequest} request
	 * @param {import('fastify').FastifyReply} reply
	 */
	async function post(request, reply) {
		const { id: _, ...body } = request.body
		const { select: dynamicSelect = null } = request.query
		
		const data = await prisma[model].create({
			data: { ...body },
			...buildQueryOptions(dynamicSelect)
		})
		reply.code(201).send(data)
	}

	/**
	 * @param {import('fastify').FastifyRequest} request
	 * @param {import('fastify').FastifyReply} reply
	 */
	async function put(request, reply) {
		const { id } = request.params
		const { id: _, ...body } = request.body
		const { select: dynamicSelect = null } = request.query
		
		const data = await prisma[model].update({
			data: { ...body },
			where: { id: id },
			...buildQueryOptions(dynamicSelect)
		})
		reply.send(data)
	}

	/**
	 * @param {import('fastify').FastifyRequest} request
	 * @param {import('fastify').FastifyReply} reply
	 */
	async function del(request, reply) {
		const { id } = request.params
		await prisma[model].delete({
			where: { id: id }
		})
		reply.code(204).send()
	}

	return {
		all,
		fetch,
		one,
		post,
		put,
		del
	}
}

export { baseController }
