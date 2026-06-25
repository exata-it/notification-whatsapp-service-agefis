import { apiKeyRoutes } from './_api-key.route'

export function apiKeyModuleRoutes(fastify) {
	fastify.register(apiKeyRoutes, { prefix: '/api-key' })
}
