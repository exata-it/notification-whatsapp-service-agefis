// Routes do módulo teste/cards

import { cardRoutes } from "../cards.route";


export function testeCardsRoutes(fastify) {
	fastify.register(cardRoutes, { prefix: '/cards' })
}
