import { z } from 'zod'

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/
const SHA256_REGEX = /^[a-f0-9]{64}$/i

const platformSchema = z
	.enum(['android'])
	.describe('Plataforma do release (hoje apenas android)')

const versionSchema = z
	.string()
	.regex(SEMVER_REGEX, 'Versão deve ser semver (ex.: 0.4.0)')
	.describe('Versão semver do release (ex.: 0.4.0)')

/**
 * Converte semver na fórmula do versionCode Android usada pelo Tauri:
 * major*1_000_000 + minor*1_000 + patch. Ordenação/monotonicidade.
 * @param {string} version
 * @returns {number}
 */
export function versionToCode(version) {
	const [major, minor, patch] = version.split('.').map(Number)
	return major * 1_000_000 + minor * 1_000 + patch
}

export const latestQuerySchema = z.object({
	platform: platformSchema.default('android'),
	current: versionSchema
		.optional()
		.describe('Versão instalada no aparelho. Ausente = sempre retorna latest')
})

export const manifestSchema = z
	.object({
		version: versionSchema,
		versionCode: z.number().int().describe('versionCode Android derivado'),
		url: z
			.string()
			.describe('URL presignada de download do APK (TTL curto — usar logo)'),
		sha256: z.string().describe('SHA-256 do APK para validação no aparelho'),
		size: z.number().int().describe('Tamanho do APK em bytes'),
		force: z.boolean().describe('true = app deve bloquear o uso até atualizar'),
		notes: z.string().nullable().describe('Notas do release')
	})
	.describe('Manifest de atualização disponível')

export const createReleaseBodySchema = z.object({
	platform: platformSchema.default('android'),
	version: versionSchema,
	objectKey: z
		.string()
		.min(1)
		.describe('Chave do objeto no bucket (ex.: android/0.4.0/app-arm64.apk)'),
	sha256: z
		.string()
		.regex(SHA256_REGEX, 'sha256 deve ser hex de 64 caracteres')
		.describe('SHA-256 do APK calculado pelo CI'),
	force: z
		.boolean()
		.default(false)
		.describe('Forçar atualização (tela bloqueante no app)'),
	notes: z.string().max(2000).optional().describe('Notas do release')
})

export const updateReleaseBodySchema = z
	.object({
		active: z
			.boolean()
			.optional()
			.describe('false = rollback (latest volta a apontar para a anterior)'),
		force: z.boolean().optional(),
		notes: z.string().max(2000).nullable().optional()
	})
	.refine(body => Object.keys(body).length > 0, {
		message: 'Informe ao menos um campo (active, force, notes)'
	})

export const releaseEntitySchema = z
	.object({
		id: z.string().describe('ID do release (UUID v7)'),
		platform: platformSchema,
		version: versionSchema,
		versionCode: z.number().int(),
		objectKey: z.string(),
		sha256: z.string(),
		size: z.number().int(),
		force: z.boolean(),
		active: z.boolean(),
		notes: z.string().nullable(),
		createdAt: z.date().or(z.string()),
		updatedAt: z.date().or(z.string())
	})
	.describe('Release registrado')

export const listQuerySchema = z.object({
	platform: platformSchema.optional()
})
