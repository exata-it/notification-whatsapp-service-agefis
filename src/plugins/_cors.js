import cors from '@fastify/cors'
import fp from 'fastify-plugin'
import { settings } from 'src/config'

export default fp(async fastify => {
	const allowedOrigins = (settings.CORS_ORIGIN || '')
		.split(',')
		.map(origin => origin.trim())
		.filter(Boolean)

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

			cb(new Error('Not allowed by CORS'), false)
		},
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
		allowedHeaders: ['Content-Type', 'Authorization'],
		credentials: true
	})
})
