import bcrypt from 'bcrypt'
import { baseController } from 'src/controllers'
import { authorizationService, prisma } from 'src/services'

function usuarioController() {
	const select = null
	const SALT_ROUNDS = 10

	const base = baseController('User', {
		select,
		omit: {
			password_hash: true
		},
		include: {
			userRoles: {
				include: {
					role: {
						include: {
							rolePermissions: {
								include: {
									permission: true
								}
							}
						}
					}
				}
			}
		},
		allowedFields: [
			'id',
			'email',
			'login',
			'name',
			'active',
			'createdAt',
			'updatedAt'
		],
		sensitiveFields: ['password_hash', 'senha', 'password', 'token', 'hash']
	})

	const post = async (request, reply) => {
		const { body } = request
		// A API recebe "password" em texto puro; o hash é feito no servidor.
		const { password: pwd, email, ...rest } = body

		const hashedPassword = await bcrypt.hash(pwd, SALT_ROUNDS)

		const usuarioData = {
			...rest,
			email: email.toLowerCase().trim(),
			password_hash: hashedPassword
		}

		const data = await prisma.User.create({
			data: { ...usuarioData },
			omit: {
				password_hash: true
			}
		})
		reply.code(201).send(data)
	}

	const updatePassword = async (request, reply) => {
		const { id } = request.user
		const { oldPassword, newPassword } = request.body
		if (!oldPassword || !newPassword) {
			return reply
				.code(400)
				.send({ error: 'oldPassword e newPassword são obrigatórios' })
		}
		const usuario = await prisma.User.findUnique({
			where: { id },
			select: { password_hash: true }
		})
		if (!usuario) {
			return reply.code(404).send({ error: 'Usuário não encontrado' })
		}
		const match = await bcrypt.compare(oldPassword, usuario.password_hash)
		if (!match) {
			return reply.code(401).send({ error: 'Senha antiga incorreta' })
		}

		const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)
		await prisma.User.update({
			where: { id },
			data: { password_hash: hashedPassword }
		})
		reply.code(200).send({ success: true })
	}

	const assignRole = async (request, reply) => {
		const { userId, roleId } = request.params
		const { expiresAt } = request.body || {}

		const user = await prisma.User.findUnique({ where: { id: userId } })
		if (!user) {
			return reply.code(404).send({ error: 'Usuário não encontrado' })
		}

		const role = await prisma.Role.findUnique({ where: { id: roleId } })
		if (!role) {
			return reply.code(404).send({ error: 'Role não encontrada' })
		}

		// Quem atribuiu vem do token, nunca do body (evita spoofing). O service
		// faz o upsert e invalida o cache de permissões do usuário.
		const userRole = await authorizationService.assignRoleToUser(
			userId,
			roleId,
			request.user.id,
			expiresAt ? new Date(expiresAt) : null
		)

		reply.code(200).send(userRole)
	}

	const removeRole = async (request, reply) => {
		const { userId, roleId } = request.params

		await authorizationService.removeRoleFromUser(
			userId,
			roleId,
			request.user.id
		)
		reply.code(200).send({ success: true })
	}

	const grantPermission = async (request, reply) => {
		const { userId, permissionId } = request.params
		const { expiresAt } = request.body || {}

		const user = await prisma.User.findUnique({ where: { id: userId } })
		if (!user) {
			return reply.code(404).send({ error: 'Usuário não encontrado' })
		}

		const permission = await prisma.Permission.findUnique({
			where: { id: permissionId }
		})
		if (!permission) {
			return reply.code(404).send({ error: 'Permissão não encontrada' })
		}

		// grantedBy vem do token, nunca do body. Service invalida o cache.
		const userPermission = await authorizationService.grantPermissionToUser(
			userId,
			permissionId,
			request.user.id,
			expiresAt ? new Date(expiresAt) : null
		)

		reply.code(200).send(userPermission)
	}

	const revokePermission = async (request, reply) => {
		const { userId, permissionId } = request.params

		await authorizationService.revokePermissionFromUser(
			userId,
			permissionId,
			request.user.id
		)
		reply.code(200).send({ success: true })
	}

	return {
		...base,
		post,
		updatePassword,
		assignRole,
		removeRole,
		grantPermission,
		revokePermission
	}
}

export { usuarioController }
