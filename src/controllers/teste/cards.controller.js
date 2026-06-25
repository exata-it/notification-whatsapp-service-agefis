import { baseController } from 'src/controllers'

function cardController() {
	const select = {
	// 	id: true,
	// 	// TODO: Adicione campos do modelo que deseja retornar
	// 	createdAt: true,
	// 	updatedAt: true
	}

	// Use baseController para CRUD padrão
	const base = baseController('Card', {  })

	// TODO: Adicione métodos customizados aqui se o CRUD base não atender
	// Exemplo:
	// const customMethod = async (request, reply) => { ... }

	return {
		...base // Herda: all, fetch, one, post, put, del
		// customMethod // Adicione aqui se criar
	}
}

export { cardController }
