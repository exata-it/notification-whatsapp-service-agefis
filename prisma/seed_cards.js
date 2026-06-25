import { faker } from '@faker-js/faker'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL
})
const prisma = new PrismaClient({ adapter })

async function main() {
	console.log('Iniciando seed de cards...')

	try {
		// Limpar cards existentes (opcional)
		// await prisma.card.deleteMany({})
		// console.log('Cards anteriores removidos')

		// Gerar 20 cards com dados aleatórios
		const cardsToCreate = Array.from({ length: 20000 }, () => ({
			title: faker.lorem.sentence({ min: 3, max: 5 }),
			description: faker.lorem.paragraph()
		}))

		const createdCards = await prisma.card.createMany({
			data: cardsToCreate
		})

		console.log(`✓ ${createdCards.count} cards criados com sucesso!`)
	} catch (error) {
		console.error('Erro durante seed de cards:', error)
		throw error
	}
}

main()
	.catch(e => {
		console.error(e)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
