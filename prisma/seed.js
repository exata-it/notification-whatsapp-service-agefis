import { PrismaClient } from './generated/prisma/client'

const prisma = new PrismaClient()

const PERMISSIONS = [
	// Usuários
	{ identifier: 'users:create', name: 'Criar Usuários', category: 'users' },
	{ identifier: 'users:read', name: 'Ler Usuários', category: 'users' },
	{ identifier: 'users:update', name: 'Atualizar Usuários', category: 'users' },
	{ identifier: 'users:delete', name: 'Deletar Usuários', category: 'users' },
	{ identifier: 'users:list', name: 'Listar Usuários', category: 'users' },
	{ identifier: 'users:export', name: 'Exportar Usuários', category: 'users' },

	// Roles e Permissões
	{ identifier: 'roles:create', name: 'Criar Roles', category: 'admin' },
	{ identifier: 'roles:read', name: 'Ler Roles', category: 'admin' },
	{ identifier: 'roles:update', name: 'Atualizar Roles', category: 'admin' },
	{ identifier: 'roles:delete', name: 'Deletar Roles', category: 'admin' },
	{
		identifier: 'permissions:manage',
		name: 'Gerenciar Permissões',
		category: 'admin'
	},

	// Admin
	{
		identifier: 'admin:manage-users',
		name: 'Gerenciar Usuários',
		category: 'admin'
	},
	{
		identifier: 'admin:manage-roles',
		name: 'Gerenciar Roles',
		category: 'admin'
	},
	{
		identifier: 'admin:manage-permissions',
		name: 'Gerenciar Permissões',
		category: 'admin'
	},
	{
		identifier: 'admin:system-settings',
		name: 'Configurações do Sistema',
		category: 'admin'
	}
]

const ROLES = [
	{
		name: 'SUPER_ADMIN',
		description: 'Acesso total ao sistema',
		permissionIds: ['*']
	},
	{
		name: 'ADMIN',
		description: 'Administrador do sistema',
		permissionIds: [
			'users:create',
			'users:read',
			'users:update',
			'users:delete',
			'users:list',
			'users:export',
			'roles:create',
			'roles:read',
			'roles:update',
			'roles:delete',
			'permissions:manage',
			'admin:manage-users',
			'admin:manage-roles',
			'admin:manage-permissions',
			'admin:system-settings'
		]
	},
	{
		name: 'MANAGER',
		description: 'Gerente - Gestão de usuários',
		permissionIds: ['users:list', 'users:read', 'users:update', 'users:create']
	},
	{
		name: 'USER',
		description: 'Usuário comum - Apenas leitura',
		permissionIds: ['users:read']
	}
]

async function main() {
	console.log('Iniciando seed do banco de dados...')

	try {
		// 1. Criar permissões
		console.log('Criando permissões...')
		const createdPermissions = await Promise.all(
			PERMISSIONS.map(perm =>
				prisma.permission.upsert({
					where: { identifier: perm.identifier },
					update: {},
					create: perm
				})
			)
		)
		console.log(`✓ ${createdPermissions.length} permissões criadas/verificadas`)

		// 2. Criar roles
		console.log('Criando roles...')
		for (const roleData of ROLES) {
			const { name, description, permissionIds } = roleData

			if (permissionIds.includes('*')) {
				// Super admin com todas as permissões
				await prisma.role.upsert({
					where: { name },
					update: { description },
					create: {
						name,
						description,
						rolePermissions: {
							createMany: {
								data: createdPermissions.map(p => ({ permissionId: p.id })),
								skipDuplicates: true
							}
						}
					}
				})
			} else {
				// Roles específicas
				const permIds = createdPermissions
					.filter(p => permissionIds.includes(p.identifier))
					.map(p => p.id)

				await prisma.role.upsert({
					where: { name },
					update: { description },
					create: {
						name,
						description,
						rolePermissions: {
							createMany: {
								data: permIds.map(permissionId => ({ permissionId })),
								skipDuplicates: true
							}
						}
					}
				})
			}
		}
		console.log(`✓ ${ROLES.length} roles criadas/verificadas`)

		console.log('✓ Seed completado com sucesso!')
	} catch (error) {
		console.error('Erro durante seed:', error)
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
