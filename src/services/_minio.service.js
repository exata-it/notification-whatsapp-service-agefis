import { settings } from 'src/config'

const {
	MINIO_ENDPOINT,
	MINIO_PUBLIC_ENDPOINT,
	MINIO_ACCESS_KEY,
	MINIO_SECRET_KEY,
	MINIO_RELEASES_BUCKET
} = settings

/**
 * Clientes S3 nativos do Bun (Bun.S3Client) — sem dependência externa.
 *
 * Dois clientes porque a assinatura presignada (SigV4) inclui o host: a URL
 * precisa ser gerada contra o endpoint que o APARELHO usa para baixar
 * (MINIO_PUBLIC_ENDPOINT), enquanto operações servidor→MinIO (stat/exists)
 * usam o endpoint interno.
 */
let clients = null

function getClients() {
	if (clients) return clients

	const base = {
		accessKeyId: MINIO_ACCESS_KEY,
		secretAccessKey: MINIO_SECRET_KEY,
		bucket: MINIO_RELEASES_BUCKET
	}

	const internal = new Bun.S3Client({ ...base, endpoint: MINIO_ENDPOINT })
	const publico =
		MINIO_PUBLIC_ENDPOINT === MINIO_ENDPOINT
			? internal
			: new Bun.S3Client({ ...base, endpoint: MINIO_PUBLIC_ENDPOINT })

	clients = { internal, publico }
	return clients
}

export const minioService = {
	/**
	 * MinIO configurado? Rotas que dependem dele respondem 503 quando não.
	 */
	isConfigured() {
		return Boolean(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY)
	},

	/**
	 * Metadados do objeto no bucket, ou null se não existir.
	 * @param {string} key
	 * @returns {Promise<{ size: number, etag: string, lastModified: Date }|null>}
	 */
	async statObject(key) {
		const { internal } = getClients()
		const exists = await internal.exists(key)
		if (!exists) return null
		return internal.file(key).stat()
	},

	/**
	 * URL presignada de download (GET), gerada contra o endpoint público.
	 * @param {string} key
	 * @param {number} ttlSeconds
	 * @returns {string}
	 */
	presignGet(key, ttlSeconds) {
		const { publico } = getClients()
		return publico.file(key).presign({ expiresIn: ttlSeconds, method: 'GET' })
	}
}
