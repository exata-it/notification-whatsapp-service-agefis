import { Prisma } from '../../prisma/generated/prisma/client'

/**
 * Normaliza erros de validação do Zod/Fastify
 */
function getValidationErrors(error) {
	// Erros do fastify-type-provider-zod ou nativos
	if (error.validation) {
		return error.validation.map(err => {
			let field = 'body'

			// Extrai o campo do instancePath
			if (err.instancePath && err.instancePath !== '/') {
				field = err.instancePath.replace(/\//g, '.')
			} else if (err.path) {
				field = Array.isArray(err.path) ? err.path.join('.') : err.path
			}

			return {
				field,
				message: err.message,
				keyword: err.keyword,
				received: err.params?.type || err.params?.received || 'desconhecido',
				expected: err.params?.expected || 'informação ausente'
			}
		})
	}
	// Fallback se vier direto do ZodError (fora do contexto do fastify)
	if (error.issues) {
		return error.issues.map(issue => ({
			field: issue.path?.join('.') || 'campo',
			message: issue.message,
			keyword: issue.code,
			received: issue.type || 'desconhecido',
			expected: issue.message
		}))
	}
	return []
}

export function errorHandler(error, request, reply) {
	// 1. Definição inicial de Status e Mensagem
	// Se o erro já tem um statusCode (ex: http-errors), usamos ele. Caso contrário, 500.
	let statusCode = error.statusCode || 500
	let message = error.message || 'Erro interno do servidor.'
	let errorType = 'Erro Interno'
	let details = null

	// 2. Tratamento de Validação (Zod / Fastify)
	if (error.code === 'FST_ERR_VALIDATION' || error.validation) {
		statusCode = 400
		errorType = 'Erro de Validação'
		message = 'Os dados enviados contêm erros de validação.'
		const validationErrors = getValidationErrors(error)

		details = {
			totalErrors: validationErrors.length,
			errors: validationErrors,
			hint: 'Verifique os campos listados acima. Certifique-se de enviar um objeto JSON válido no corpo da requisição.'
		}
	}

	// 3. Tratamento de Erros do Prisma
	else if (error instanceof Prisma.PrismaClientKnownRequestError) {
		// Mapeamento de erros comuns do Prisma para Status HTTP corretos
		switch (error.code) {
			case 'P2025': // Registro não encontrado
				statusCode = 404
				errorType = 'Não Encontrado'
				message = 'O registro solicitado não foi encontrado.'
				break
			case 'P2002': // Violação de Unique (ex: email duplicado)
				statusCode = 409
				errorType = 'Conflito de Dados'
				message = `Violação de restrição única no campo: ${error.meta?.target || 'desconhecido'}`
				break
			case 'P2003': // Violação de Foreign Key
				statusCode = 400
				errorType = 'Erro de Integridade'
				message = 'A operação viola um relacionamento de dados existente.'
				break
			default:
				// Mantém 500 para erros desconhecidos de banco, mas formata a mensagem
				message = `Erro no banco de dados: ${error.message.split('\n').pop()}` // Tenta pegar a última linha do erro prisma
		}
	}

	// 4. Tratamento de Erros de Serialização (Resposta inválida)
	else if (error.code === 'FST_ERR_REP_SERIALIZATION') {
		statusCode = 500
		errorType = 'Erro de Serialização'
		message = 'A resposta do servidor não corresponde ao schema definido.'
		if (process.env.NODE_ENV === 'development') {
			details = error.cause || error
		}
	}

	// 5. Logging (Essencial para debug)
	// Logamos como erro apenas se for 500. Validações (400) ou Not Found (404) são 'warn' ou 'info'.
	if (statusCode >= 500) {
		request.log.error(error)
	} else {
		request.log.warn({ err: error }, 'Erro operacional capturado')
	}

	// 6. Resposta Final
	// Evita erro de "Reply already sent"
	if (reply.sent) return

	return reply.status(statusCode).send({
		error: errorType,
		message,
		statusCode,
		details: details || undefined, // Só envia se houver detalhes
		timestamp: new Date().toISOString(),
		path: request.url
	})
}
