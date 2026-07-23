import cors from '@fastify/cors'
import fp from 'fastify-plugin'
import { settings } from 'src/config'

// Origins fixas dos WebViews de app desktop/mobile (Tauri v2).
// tauri://localhost         → macOS, iOS, Linux
// http(s)://tauri.localhost → Windows, Android
const APP_ORIGINS = [
	'tauri://localhost',
	'http://tauri.localhost',
	'https://tauri.localhost'
]

export default fp(async fastify => {
	const allowedOrigins = [
		...APP_ORIGINS,
		...(settings.CORS_ORIGIN || '')
			.split(',')
			.map(origin => origin.trim())
			.filter(Boolean)
	]

	fastify.register(cors, {
		origin: (origin, cb) => {
			// Requisições sem Origin (curl, apps mobile, server-to-server)
			if (!origin) {
				cb(null, true)
				return
			}

			// Correspondência EXATA. Substring permitiria que
			// "https://meusite.com.evil.com" passasse no allowlist.
			if (allowedOrigins.includes(origin)) {
				cb(null, true)
				return
			}

			// Rejeita SEM lançar erro (evita 500 no preflight). Loga o
			// Origin exato pra diagnosticar clientes bloqueados.
			fastify.log.warn({ origin }, 'CORS: origin bloqueada')
			cb(null, false)
		},
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Version'],
		credentials: true
	})
})
