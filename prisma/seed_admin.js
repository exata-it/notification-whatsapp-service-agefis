import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'
import { PrismaClient } from './generated/prisma/client'
import { CARD_PERMISSIONS_EXPORT as CARD_PERMISSIONS } from './permissions_card.js'

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL
})
const db = new PrismaClient({ adapter })

// Definir permissões por categoria
const PERMISSIONS = [
	...CARD_PERMISSIONS,
	{ identifier: '*', name: 'Todas as Permissões', category: 'root' },

	// Gerenciamento de Usuários
	{ identifier: 'users:create', name: 'Criar Usuários', category: 'users' },
	{ identifier: 'users:read', name: 'Visualizar Usuários', category: 'users' },
	{ identifier: 'users:update', name: 'Atualizar Usuários', category: 'users' },
	{ identifier: 'users:delete', name: 'Deletar Usuários', category: 'users' },

	// Gerenciamento de Roles
	{ identifier: 'roles:create', name: 'Criar Roles', category: 'roles' },
	{ identifier: 'roles:read', name: 'Visualizar Roles', category: 'roles' },
	{ identifier: 'roles:update', name: 'Atualizar Roles', category: 'roles' },
	{ identifier: 'roles:delete', name: 'Deletar Roles', category: 'roles' },

	// Gerenciamento de Permissões
	{
		identifier: 'permissions:create',
		name: 'Criar Permissões',
		category: 'permissions'
	},
	{
		identifier: 'permissions:read',
		name: 'Visualizar Permissões',
		category: 'permissions'
	},
	{
		identifier: 'permissions:update',
		name: 'Atualizar Permissões',
		category: 'permissions'
	},
	{
		identifier: 'permissions:delete',
		name: 'Deletar Permissões',
		category: 'permissions'
	},

	// Gerenciamento avançado de autorização (usado pelas rotas de autorização)
	{ identifier: 'users:manage', name: 'Gerenciar Autorização de Usuários', category: 'users' },
	{ identifier: 'permissions:assign', name: 'Conceder Permissões', category: 'permissions' },
	{ identifier: 'permissions:revoke', name: 'Revogar Permissões', category: 'permissions' },
	{ identifier: 'roles:assign', name: 'Atribuir Roles', category: 'roles' },
	{ identifier: 'roles:revoke', name: 'Remover Roles', category: 'roles' }
]

// Definir roles com suas permissões
const ROLES_CONFIG = [
	{
		name: 'SUPER_ADMIN',
		permissionIdentifiers: ['*'] // Wildcard para todas as permissões
	}
]

async function seedPermissions() {
	console.log('🔐 Criando permissões...')

	for (const perm of PERMISSIONS) {
		await db.permission.upsert({
			where: { identifier: perm.identifier },
			update: {},
			create: {
				identifier: perm.identifier,
				name: perm.name,
				category: perm.category,
				active: true
			}
		})
	}

	console.log(`✅ ${PERMISSIONS.length} permissões criadas/atualizadas`)
}

async function seedRoles() {
	console.log('👥 Criando roles...')

	for (const roleConfig of ROLES_CONFIG) {
		const role = await db.role.upsert({
			where: { name: roleConfig.name },
			update: {},
			create: {
				name: roleConfig.name,
				active: true
			}
		})

		// Associar permissões
		await db.rolePermission.deleteMany({
			where: { roleId: role.id }
		})

		if (roleConfig.permissionIdentifiers.includes('*')) {
			// Se for wildcard, associar só o *
			const wildcardPerm = await db.permission.findUnique({
				where: { identifier: '*' }
			})
			if (wildcardPerm) {
				await db.rolePermission.create({
					data: {
						roleId: role.id,
						permissionId: wildcardPerm.id
					}
				})
			}
		} else {
			// Associar permissões específicas
			for (const identifier of roleConfig.permissionIdentifiers) {
				const perm = await db.permission.findUnique({
					where: { identifier }
				})
				if (perm) {
					await db.rolePermission.create({
						data: {
							roleId: role.id,
							permissionId: perm.id
						}
					})
				}
			}
		}
	}

	console.log(`✅ ${ROLES_CONFIG.length} roles criadas/atualizadas`)
}

async function seedAdminUser() {
	console.log('👤 Criando usuário admin...')

	const email = 'admin@admin.com'
	const login = 'admin'
	const name = 'João Pedro'
	const password = '123456'

	try {
		const hashedPassword = await bcrypt.hash(password, 10)

		const existing = await db.user.findUnique({ where: { email } })
		if (existing) {
			console.log('⚠️  Usuário já existe:', existing.email)
			return
		}

		const user = await db.user.create({
			data: {
				email,
				name,
				login,
				password_hash: hashedPassword,
				active: true
			}
		})

		// Atribuir role SUPER_ADMIN
		const superAdminRole = await db.role.findUnique({
			where: { name: 'SUPER_ADMIN' }
		})

		if (superAdminRole) {
			await db.userRole.create({
				data: {
					userId: user.id,
					roleId: superAdminRole.id
				}
			})
		}

		console.log('✅ Usuário admin criado com sucesso:', user.email)
	} catch (error) {
		console.error('❌ Erro ao criar usuário admin:', error.message)
	}
}

async function seed() {
	try {
		console.log('🌱 Iniciando seed...\n')

		await seedPermissions()
		await seedRoles()
		await seedAdminUser()

		console.log('\n✨ Seed concluído com sucesso!')
	} catch (error) {
		console.error('❌ Erro durante o seeding:', error)
		process.exit(1)
	}
}

seed().finally(async () => {
	await db.$disconnect()
})
