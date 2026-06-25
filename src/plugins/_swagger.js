import swagger from '@fastify/swagger'
import scalarApiReference from '@scalar/fastify-api-reference'
import fp from 'fastify-plugin'
import {
	jsonSchemaTransform,
	jsonSchemaTransformObject
} from 'fastify-type-provider-zod'

export default fp(async fastify => {
	// Registrar Swagger
	await fastify.register(swagger, {
		openapi: {
			info: {
				title: 'API Documentation',
				description: 'API description for ',
				version: '1.0.0',
				contact: {
					name: 'Equipe de Desenvolvimento',
					email: 'joaopsilvavolei@gmail.com'
				}
			},
			servers: [
				{
					url: 'http://localhost:3000',
					description: 'Servidor de desenvolvimento'
				}
			],
			security: [
				{
					BearerAuth: []
				}
			],
			components: {
				securitySchemes: {
					BearerAuth: {
						type: 'http',
						scheme: 'bearer',
						bearerFormat: 'JWT',
						description: 'Token JWT para autenticação. Formato: Bearer <token>'
					}
				}
			}
		},
		transform: jsonSchemaTransform,
		jsonSchemaTransform: jsonSchemaTransformObject
	})

	// Registrar Scalar
	await fastify.register(scalarApiReference, {
		routePrefix: '/docs',
		configuration: {
			layout: 'modern',
			theme: 'elysiajs',
			hideClientButton: false,
			showSidebar: true,
			showDeveloperTools: 'localhost',
			showToolbar: 'localhost',
			operationTitleSource: 'summary',
			persistAuth: true,
			telemetry: false,
			isEditable: false,
			isLoading: false,
			hideModels: false,
			documentDownloadType: 'both',
			hideTestRequestButton: false,
			hideSearch: false,
			showOperationId: false,
			hideDarkModeToggle: false,
			withDefaultFonts: true,
			defaultOpenAllTags: false,
			expandAllModelSections: false,
			expandAllResponses: false,
			orderSchemaPropertiesBy: 'alpha',
			orderRequiredPropertiesFirst: true
		}
	})

	// // ✨ NOVO: Rota para expor OpenAPI schema em JSON
	// // Compatibilidade com ferramentas que usavam /docs/json anteriormente
	// fastify.get('/docs/json', async (request, reply) => {
	// 	return fastify.swagger()
	// })

	// // Alternativa: OpenAPI padrão
	// fastify.get('/docs/openapi.json', async (request, reply) => {
	// 	return fastify.swagger()
	// })

	fastify.log.info('Plugin Scalar registrado com sucesso')
	fastify.log.info('OpenAPI JSON disponível em: /docs/json ou /docs/openapi.json')
})
