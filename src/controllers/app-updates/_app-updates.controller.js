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

function escapeHtml(text) {
	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}

const CHANNELS = [
	{ channel: 'prod', title: 'Fiscalize', tag: 'Produção' },
	{
		channel: 'qa',
		title: 'Fiscalize QA',
		tag: 'Homologação',
		aviso: 'Ambiente de testes — não use para fiscalizações reais.'
	}
]

function channelCardHtml({ channel, title, tag, aviso }, latest) {
	const conteudo = latest
		? `
		<p class="version">Versão ${escapeHtml(latest.version)}</p>
		<p class="meta">${formatSize(latest.size)} · Android (APK)</p>
		${latest.notes ? `<p class="notes">${escapeHtml(latest.notes)}</p>` : ''}
		<a class="btn" href="download/apk?channel=${channel}">Baixar ${title}</a>
		<p class="sha">SHA-256: <code>${escapeHtml(latest.sha256)}</code></p>`
		: '<p class="version">Nenhuma versão disponível no momento.</p>'

	return `
<div class="card ${channel}">
	<span class="tag">${tag}</span>
	<h1>${title}</h1>
	${aviso ? `<p class="aviso">${aviso}</p>` : ''}
	${conteudo}
</div>`
}

function downloadPageHtml(latestByChannel) {
	return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AGEFIS — Download do App</title>
<style>
	body { font-family: system-ui, sans-serif; background: #f4f4f5; color: #18181b;
		display: flex; flex-wrap: wrap; gap: 24px; align-items: center; justify-content: center;
		min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
	.card { background: #fff; border-radius: 12px; padding: 40px 32px; max-width: 420px;
		width: 100%; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.1);
		box-sizing: border-box; border-top: 6px solid var(--cor); }
	.prod { --cor: #16a34a; }
	.qa { --cor: #ea580c; }
	.tag { display: inline-block; background: var(--cor); color: #fff; font-size: .75rem;
		font-weight: 600; padding: 2px 10px; border-radius: 999px; text-transform: uppercase; }
	h1 { font-size: 1.4rem; margin: 12px 0 4px; }
	.aviso { color: #c2410c; font-size: .85rem; margin: 4px 0 0; }
	.version { font-size: 1.1rem; font-weight: 600; margin: 16px 0 4px; }
	.meta { color: #71717a; margin: 0 0 16px; }
	.notes { text-align: left; background: #f4f4f5; border-radius: 8px; padding: 12px;
		font-size: .9rem; white-space: pre-wrap; }
	.btn { display: inline-block; background: var(--cor); color: #fff; text-decoration: none;
		padding: 14px 40px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
	.sha { font-size: .7rem; color: #a1a1aa; word-break: break-all; }
</style>
</head>
<body>
${CHANNELS.map(c => channelCardHtml(c, latestByChannel[c.channel])).join('')}
</body>
</html>`
}

function findLatest(platform, channel) {
	return prisma.appRelease.findFirst({
		where: { platform, channel, active: true },
		orderBy: { versionCode: 'desc' }
	})
}

export function appUpdatesController() {
	return {
		/**
		 * GET /latest — manifest da última versão ativa do canal.
		 * 204 quando o aparelho já está na última versão (ou não há release).
		 */
		async latest(request, reply) {
			exigirMinioConfigurado()

			const { platform, channel, current } = request.query

			const latest = await findLatest(platform, channel)

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
						channel,
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
		 * GET /download — página HTML com um card por canal (prod e QA).
		 */
		async downloadPage(_request, reply) {
			const [prod, qa] = await Promise.all([
				findLatest('android', 'prod'),
				findLatest('android', 'qa')
			])

			return reply
				.type('text/html; charset=utf-8')
				.send(downloadPageHtml({ prod, qa }))
		},

		/**
		 * GET /download/apk?channel= — 302 para URL presignada fresca (TTL curto,
		 * por isso o botão não aponta direto para o MinIO).
		 */
		async downloadApk(request, reply) {
			exigirMinioConfigurado()

			const latest = await findLatest('android', request.query.channel)

			if (!latest) throw httpError(404, 'Nenhuma release disponível')

			const url = minioService.presignGet(latest.objectKey, APP_UPDATE_URL_TTL)
			return reply.redirect(url, 302)
		},

		/**
		 * POST / — registra release (chamado pelo CI após upload no MinIO).
		 * Upsert por (platform, channel, version): re-execução do pipeline é
		 * idempotente. O tamanho vem do stat no bucket (fonte da verdade).
		 */
		async create(request, reply) {
			exigirMinioConfigurado()

			const { platform, channel, version, objectKey, sha256, force, notes } =
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
				where: {
					platform_channel_version: { platform, channel, version }
				},
				create: { platform, channel, version, ...data },
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
			const { platform, channel } = request.query
			return prisma.appRelease.findMany({
				where: { platform, channel },
				orderBy: [
					{ platform: 'asc' },
					{ channel: 'asc' },
					{ versionCode: 'desc' }
				]
			})
		}
	}
}
