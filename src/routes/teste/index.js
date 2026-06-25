// Routes do módulo teste/cards

import { cardRoutes } from "./cards.route";


export function testeRoutes(fastify) {
	fastify.register(cardRoutes, { prefix: '/cards' })
}
