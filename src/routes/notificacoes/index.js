import { documentosFiscaisRoutes } from './_documentos-fiscais.route'

export function notificacoesRoutes(fastify) {
	fastify.register(documentosFiscaisRoutes, { prefix: '/documentos-fiscais' })
}
