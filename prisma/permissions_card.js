// Permissões para Card - cards
// Padrão: resource:action
// Execute este arquivo diretamente: node prisma/permissions_card.js

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL
})
const prisma = new PrismaClient({ adapter })

const CARD_PERMISSIONS = [
	{
		identifier: 'cards:create',
		name: 'Criar cards',
		category: 'cards'
	},
	{
		identifier: 'cards:read',
		name: 'Visualizar cards',
		category: 'cards'
	},
	{
		identifier: 'cards:update',
		name: 'Atualizar cards',
		category: 'cards'
	},
	{
		identifier: 'cards:delete',
		name: 'Deletar cards',
		category: 'cards'
	}
]

async function seedPermissions() {
	try {
		console.log(`🔐 Criando/Atualizando permissões de cards...`)

		for (const permission of CARD_PERMISSIONS) {
			await prisma.permission.upsert({
				where: { identifier: permission.identifier },
				update: {
					name: permission.name,
					category: permission.category
				},
				create: {
					identifier: permission.identifier,
					name: permission.name,
					category: permission.category
				}
			})
		}

		console.log(`✅ Permissões de cards criadas/atualizadas com sucesso!`)
	} catch (error) {
		console.error(`❌ Erro ao criar/atualizar permissões:`, error)
		process.exit(1)
	} finally {
		await prisma.$disconnect()
	}
}

// Executar seed apenas se este arquivo for executado diretamente
if (import.meta.main) {
	seedPermissions()
}

export const CARD_PERMISSIONS_EXPORT = CARD_PERMISSIONS
