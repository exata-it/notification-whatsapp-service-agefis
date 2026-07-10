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

function formatSize(bytes) {
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function downloadPageHtml(latest) {
	const conteudo = latest
		? `
			<p class="version">Versão ${latest.version}</p>
			<p class="meta">${formatSize(latest.size)} · Android (APK)</p>
			${latest.notes ? `<p class="notes">${latest.notes}</p>` : ''}
			<a class="btn" href="download/apk">Baixar APK</a>
			<p class="sha">SHA-256: <code>${latest.sha256}</code></p>`
		: '<p class="version">Nenhuma versão disponível no momento.</p>'

	return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AGEFIS — Download do App</title>
<style>
	body { font-family: system-ui, sans-serif; background: #f4f4f5; color: #18181b;
		display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
	.card { background: #fff; border-radius: 12px; padding: 40px 32px; max-width: 420px;
		width: 90%; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
	h1 { font-size: 1.4rem; margin: 0 0 4px; }
	.version { font-size: 1.1rem; font-weight: 600; margin: 16px 0 4px; }
	.meta { color: #71717a; margin: 0 0 16px; }
	.notes { text-align: left; background: #f4f4f5; border-radius: 8px; padding: 12px;
		font-size: .9rem; white-space: pre-wrap; }
	.btn { display: inline-block; background: #16a34a; color: #fff; text-decoration: none;
		padding: 14px 40px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
	.sha { font-size: .7rem; color: #a1a1aa; word-break: break-all; }
</style>
</head>
<body>
<div class="card">
	<h1>App AGEFIS</h1>
	${conteudo}
</div>
</body>
</html>`
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
		 * GET /download — página HTML simples com botão de download da última versão.
		 */
		async downloadPage(_request, reply) {
			const latest = await prisma.appRelease.findFirst({
				where: { platform: 'android', active: true },
				orderBy: { versionCode: 'desc' }
			})

			return reply.type('text/html; charset=utf-8').send(downloadPageHtml(latest))
		},

		/**
		 * GET /download/apk — 302 para URL presignada fresca (TTL curto,
		 * por isso o botão não aponta direto para o MinIO).
		 */
		async downloadApk(_request, reply) {
			exigirMinioConfigurado()

			const latest = await prisma.appRelease.findFirst({
				where: { platform: 'android', active: true },
				orderBy: { versionCode: 'desc' }
			})

			if (!latest) throw httpError(404, 'Nenhuma release disponível')

			const url = minioService.presignGet(latest.objectKey, APP_UPDATE_URL_TTL)
			return reply.redirect(url, 302)
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
