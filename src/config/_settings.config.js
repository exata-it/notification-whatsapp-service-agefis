const PORT = process.env.PORT || 3000
const JWT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256'
const NODE_ENV = process.env.NODE_ENV || 'development'

// JWT_SECRET nunca deve cair em um valor padrão silencioso.
// Em produção, sem segredo definido a aplicação não deve subir.
if (!process.env.JWT_SECRET && NODE_ENV === 'production') {
	throw new Error(
		'JWT_SECRET é obrigatório em produção. Defina a variável de ambiente JWT_SECRET.'
	)
}

if (!process.env.JWT_SECRET) {
	console.warn(
		'[AVISO] JWT_SECRET não definido — usando segredo inseguro de desenvolvimento. Não use em produção.'
	)
}

const JWT_SECRET =
	process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'
const CORS_ORIGIN =
	process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3001'

const settings = {
	PORT,
	JWT_ALGORITHM,
	JWT_SECRET,
	JWT_EXPIRES_IN,
	JWT_REFRESH_EXPIRES_IN,
	CORS_ORIGIN,

	NODE_ENV
}

export { settings }
