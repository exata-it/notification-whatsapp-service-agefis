import { sessionController } from 'src/controllers/seguranca'
import { z } from 'zod'

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export const sessionRoutes = fastify => {
	const controller = sessionController()

	const LoginSchema = {
		tags: ['Segurança - Autenticação'],
		summary: 'Realizar login no sistema',
		description: 'Autentica usuário e retorna token JWT',
		body: z.object({
			email: z.string().describe('Email ou login do usuário'),
			password: z
				.string()
				.min(1, 'Senha é obrigatória')
				.describe('Senha do usuário')
		}),
		response: {
			200: z.object({
				token: z.string().describe('Token JWT para autenticação'),
				user: z.object({
					id: z.string().uuid().describe('ID do usuário (UUID)'),
					email: z.string().describe('Email do usuário'),
					login: z.string().describe('Login do usuário'),
					name: z.string().describe('Nome completo do usuário'),
					roles: z.array(z.string()).describe('Roles do usuário'),
					permissions: z.array(z.string()).describe('Permissões do usuário')
				})
			}),
			401: z.object({
				error: z.string().describe('Tipo do erro'),
				message: z.string().describe('Mensagem de erro')
			}),
			429: z.object({
				error: z.string().describe('Tipo do erro'),
				message: z.string().describe('Mensagem de erro'),
				statusCode: z.number().optional()
			})
		}
	}

	const GetSessionSchema = {
		tags: ['Segurança - Autenticação'],
		summary: 'Obter dados da sessão atual',
		description: 'Retorna dados do usuário autenticado com roles e permissões',
		response: {
			200: z.object({
				usuario: z.object({
					id: z.string().uuid().describe('ID do usuário (UUID)'),
					email: z.email().describe('Email do usuário'),
					login: z.string().describe('Login do usuário'),
					name: z.string().describe('Nome completo do usuário'),
					roles: z.array(z.string()).describe('Roles do usuário'),
					permissions: z.array(z.string()).describe('Permissões do usuário'),
					createdAt: z.date().describe('Data de criação (ISO 8601)'),
					updatedAt: z.date().describe('Data de atualização (ISO 8601)'),
					active: z.boolean().describe('Status ativo do usuário')
				})
			}),
			401: z.object({
				error: z.string().describe('Tipo do erro'),
				message: z.string().describe('Mensagem de erro')
			})
		}
	}

	// Rate limit estrito no login para mitigar brute force / credential stuffing.
	fastify.post(
		'/session',
		{
			schema: LoginSchema,
			preHandler: fastify.rateLimit({
				max: 5,
				windowMs: 60_000,
				keyPrefix: 'login'
			})
		},
		controller.login
	)

	fastify.get(
		'/session',
		{
			schema: GetSessionSchema,
			preHandler: fastify.authenticate
		},
		controller.getSession
	)
}
