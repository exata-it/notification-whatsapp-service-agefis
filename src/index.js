import { settings } from 'src/config'
import { createApp } from 'src/app'

global.__basedir = __dirname // basedir global para uso em outros módulos

async function main() {
	try {
		const server = await createApp()
		await server.listen({ port: settings.PORT, host: '0.0.0.0' })
		console.log(`Servidor rodando na porta ${settings.PORT}`)
	} catch (error) {
		console.error(error)
		process.exit(1)
	}
}

main()
