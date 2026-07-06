import { settings } from 'src/config'
import { minioService, prisma } from 'src/services'
import { versionToCode } from './_app-updates.schema.js'

const { APP_UPDATE_URL_TTL } = settings

/**
 * Erro com statusCode — o errorHandler global converte na resposta HTTP.
 */
function httpError(statusCode, message) {
	const error = new Error(message)
	error.statusCode = statusCode
	return error
}

function exigirMinioConfigurado() {
	if (!minioService.isConfigured()) {
		throw httpError(
			503,
			'MinIO não configurado no servidor (MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY)'
		)
	}
}

export function appUpdatesController() {
	return {
		/**
		 * GET /latest — manifest da última versão ativa.
		 * 204 quando o aparelho já está na última versão (ou não há release).
		 */
		async latest(request, reply) {
			exigirMinioConfigurado()

			const { platform, current } = request.query

			const latest = await prisma.appRelease.findFirst({
				where: { platform, active: true },
				orderBy: { versionCode: 'desc' }
			})

			if (!latest) return reply.code(204).send()

			const currentCode = current ? versionToCode(current) : -1
			if (currentCode >= latest.versionCode) return reply.code(204).send()

			// Força se QUALQUER release ativa acima da versão instalada exigir —
			// aparelho que pulou uma versão forçada continua bloqueado.
			const force =
				latest.force ||
				(await prisma.appRelease.count({
					where: {
						platform,
						active: true,
						force: true,
						versionCode: { gt: currentCode }
					}
				})) > 0

			const url = minioService.presignGet(latest.objectKey, APP_UPDATE_URL_TTL)

			return {
				version: latest.version,
				versionCode: latest.versionCode,
				url,
				sha256: latest.sha256,
				size: latest.size,
				force,
				notes: latest.notes
			}
		},

		/**
		 * POST / — registra release (chamado pelo CI após upload no MinIO).
		 * Upsert por (platform, version): re-execução do pipeline é idempotente.
		 * O tamanho vem do stat no bucket (fonte da verdade), não do corpo.
		 */
		async create(request, reply) {
			exigirMinioConfigurado()

			const { platform, version, objectKey, sha256, force, notes } =
				request.body

			const stat = await minioService.statObject(objectKey)
			if (!stat) {
				throw httpError(
					400,
					`Objeto "${objectKey}" não encontrado no bucket — faça o upload antes de registrar o release`
				)
			}

			const data = {
				versionCode: versionToCode(version),
				objectKey,
				sha256: sha256.toLowerCase(),
				size: stat.size,
				force,
				notes: notes ?? null,
				active: true
			}

			const release = await prisma.appRelease.upsert({
				where: { platform_version: { platform, version } },
				create: { platform, version, ...data },
				update: data
			})

			return reply.code(201).send(release)
		},

		/**
		 * PUT /:id — operação (rollback via active=false, ligar force, notas).
		 */
		async update(request, reply) {
			const { id } = request.params

			try {
				return await prisma.appRelease.update({
					where: { id },
					data: request.body
				})
			} catch (error) {
				if (error.code === 'P2025')
					throw httpError(404, 'Release não encontrado')
				throw error
			}
		},

		/**
		 * GET / — lista releases (operação/debug), mais recente primeiro.
		 */
		async list(request) {
			const { platform } = request.query
			return prisma.appRelease.findMany({
				where: platform ? { platform } : undefined,
				orderBy: [{ platform: 'asc' }, { versionCode: 'desc' }]
			})
		}
	}
}
