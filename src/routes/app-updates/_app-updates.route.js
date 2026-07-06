import {
	appUpdatesController,
	createReleaseBodySchema,
	latestQuerySchema,
	listQuerySchema,
	manifestSchema,
	releaseEntitySchema,
	updateReleaseBodySchema
} from 'src/controllers/app-updates'
import { apiKeyAuth } from 'src/middleware'
import { z } from 'zod'

const ErroSchema = z
	.object({
		error: z.string().optional().describe('Mensagem de erro legível'),
		message: z.string().optional().describe('Detalhe adicional do erro'),
		statusCode: z.number().int().optional().describe('Código HTTP do erro')
	})
	.describe('Resposta de erro')

export function appUpdatesRoutes(fastify) {
	const controller = appUpdatesController()

	// SEM autenticação deste serviço: o contrato é o mesmo que a API da AGEFIS
	// vai replicar atrás do JWT deles. O app manda o Authorization (JWT AGEFIS)
	// que este serviço ignora — assim a troca de base URL não muda nada no app.
	fastify.get(
		'/latest',
		{
			schema: {
				tags: ['App Updates'],
				summary: 'Última versão disponível do app',
				description: [
					'Retorna o manifest da última release **ativa** da plataforma, com URL',
					'presignada de download do APK no MinIO (TTL curto).',
					'',
					'Responde **204 (sem corpo)** quando `current` já é a última versão',
					'ou quando não há release registrada.',
					'',
					'`force` vem `true` se a release mais nova — ou **qualquer** release',
					'ativa acima da versão instalada — exigir atualização obrigatória.',
					'',
					'Endpoint sem autenticação própria: o contrato será replicado pela',
					'API da AGEFIS atrás do JWT deles.'
				].join('\n'),
				security: [],
				querystring: latestQuerySchema,
				response: {
					200: manifestSchema,
					400: ErroSchema.describe('Query inválida (semver malformado)'),
					503: ErroSchema.describe('MinIO não configurado no servidor')
				}
			}
		},
		controller.latest
	)

	fastify.post(
		'/',
		{
			onRequest: [apiKeyAuth],
			schema: {
				tags: ['App Updates'],
				summary: 'Registrar release (CI)',
				description: [
					'Registra uma release após o upload do APK no bucket. Chamado pelo',
					'pipeline de CI, autenticado por API key (`x-api-key`).',
					'',
					'Valida que o objeto existe no bucket; `size` vem do stat no MinIO.',
					'`versionCode` é derivado da versão (major×10⁶ + minor×10³ + patch —',
					'mesma fórmula do Tauri).',
					'',
					'Upsert por `(platform, version)`: reexecutar o pipeline da mesma tag',
					'atualiza o registro em vez de falhar.'
				].join('\n'),
				security: [{ ApiKeyAuth: [] }],
				body: createReleaseBodySchema,
				response: {
					201: releaseEntitySchema,
					400: ErroSchema.describe(
						'Corpo inválido ou objeto ausente no bucket'
					),
					401: ErroSchema.describe('API key inválida ou ausente'),
					503: ErroSchema.describe('MinIO não configurado no servidor')
				}
			}
		},
		controller.create
	)

	fastify.put(
		'/:id',
		{
			onRequest: [apiKeyAuth],
			schema: {
				tags: ['App Updates'],
				summary: 'Atualizar release (rollback/force/notas)',
				description: [
					'Operação sobre uma release registrada:',
					'- `active: false` — **rollback**: o `/latest` volta a apontar para a',
					'  release ativa anterior (aparelhos que ainda não baixaram param de vê-la);',
					'- `force: true` — torna a atualização obrigatória;',
					'- `notes` — ajusta as notas.'
				].join('\n'),
				security: [{ ApiKeyAuth: [] }],
				params: z.object({ id: z.string().describe('ID do release') }),
				body: updateReleaseBodySchema,
				response: {
					200: releaseEntitySchema,
					401: ErroSchema.describe('API key inválida ou ausente'),
					404: ErroSchema.describe('Release não encontrado')
				}
			}
		},
		controller.update
	)

	fastify.get(
		'/',
		{
			onRequest: [apiKeyAuth],
			schema: {
				tags: ['App Updates'],
				summary: 'Listar releases',
				description:
					'Lista todas as releases registradas (ativas e inativas), mais recente primeiro. Uso operacional.',
				security: [{ ApiKeyAuth: [] }],
				querystring: listQuerySchema,
				response: {
					200: z.array(releaseEntitySchema),
					401: ErroSchema.describe('API key inválida ou ausente')
				}
			}
		},
		controller.list
	)
}
