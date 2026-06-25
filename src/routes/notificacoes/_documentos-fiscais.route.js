import { documentosFiscaisController } from 'src/controllers/notificacoes'
import {
	emailBodySchema,
	whatsAppBodySchema
} from 'src/controllers/notificacoes/_documentos-fiscais.schema.js'
import { apiKeyAuth } from 'src/middleware'
import { z } from 'zod'

// Bypass do validatorCompiler zod: o corpo é multipart (stream), validado no
// controller. O `body` no schema serve só para a documentação OpenAPI.
const skipBodyValidation = () => () => ({ value: true })

const ErroSchema = z
	.object({
		success: z.literal(false).optional().describe('Indica falha na operação'),
		error: z.string().optional().describe('Mensagem de erro legível'),
		message: z.string().optional().describe('Detalhe adicional do erro'),
		statusCode: z.number().int().optional().describe('Código HTTP do erro')
	})
	.describe('Resposta de erro')

const SucessoBaseSchema = {
	success: z.literal(true).describe('Indica sucesso da operação'),
	message: z.string().describe('Resumo do resultado do envio'),
	canal: z.string().describe('Canal utilizado no envio')
}

const SucessoWhatsAppSchema = z
	.object({
		...SucessoBaseSchema,
		canal: z.literal('whatsapp'),
		data: z.object({
			nome: z.string().describe('Nome do destinatário'),
			telefone: z
				.string()
				.describe('Telefone normalizado (DDI 55 + DDD + número)'),
			total_arquivos: z.number().int().describe('Quantidade de PDFs enviados'),
			notificado_em: z
				.string()
				.datetime()
				.describe('Data/hora do envio (ISO 8601)')
		})
	})
	.describe('Notificação enviada via WhatsApp')

const SucessoEmailSchema = z
	.object({
		...SucessoBaseSchema,
		canal: z.literal('email'),
		data: z.object({
			nome: z.string().describe('Nome do destinatário'),
			email: z.string().describe('Email do destinatário'),
			total_arquivos: z.number().int().describe('Quantidade de PDFs anexados'),
			notificado_em: z
				.string()
				.datetime()
				.describe('Data/hora do envio (ISO 8601)'),
			messageId: z
				.string()
				.describe('ID da mensagem retornado pelo servidor SMTP')
		})
	})
	.describe('Notificação enviada via Email')

export function documentosFiscaisRoutes(fastify) {
	const controller = documentosFiscaisController()
	const middleware = [apiKeyAuth]

	// Multipart não passa pelo validatorCompiler (zod): os campos são lidos no
	// controller via request.parts(). Cliente envia os campos de texto ANTES dos arquivos.
	fastify.post(
		'/send-whatsapp',
		{
			preValidation: middleware,
			validatorCompiler: skipBodyValidation,
			schema: {
				tags: ['Notificações - Documentos Fiscais'],
				summary: 'Enviar documento(s) fiscal(is) via WhatsApp',
				body: whatsAppBodySchema,
				description: [
					'Envia um ou mais PDFs **já gerados** ao fiscalizado via WhatsApp (Evolution API).',
					'',
					'O serviço **não gera** o PDF — apenas recebe e encaminha. Cada arquivo é enviado',
					'como mensagem de documento separada, precedida de uma saudação e seguida de um aviso final.',
					'',
					'**Corpo (`multipart/form-data`)** — envie os campos de texto **antes** dos arquivos:',
					'| Campo | Obrigatório | Descrição |',
					'|---|---|---|',
					'| `telefone` | sim | Telefone do destinatário com DDD (DDI 55 é adicionado se faltar) |',
					'| `nome` | não | Nome do destinatário (padrão: `Fiscalizado`) |',
					'| `tipoDocumento` | não | Tipo do documento, ex.: `Auto de Infração` |',
					'| `numeroDocumento` | não | Número do documento fiscal |',
					'| `arquivo` | sim | Um ou mais PDFs (repetir o campo). Máx. 10, 15MB cada |',
					'',
					'Validação: cada arquivo precisa ser PDF (mimetype + assinatura `%PDF`).',
					'O número é validado na Evolution API antes do envio.'
				].join('\n'),
				consumes: ['multipart/form-data'],
				security: [{ ApiKeyAuth: [] }],
				response: {
					200: SucessoWhatsAppSchema,
					400: ErroSchema.describe(
						'Requisição inválida: arquivo ausente/não-PDF, telefone ausente ou número sem WhatsApp'
					),
					401: ErroSchema.describe('API key inválida ou ausente'),
					500: ErroSchema.describe('Falha ao enviar pela Evolution API')
				}
			}
		},
		controller.sendWhatsApp
	)

	fastify.post(
		'/send-email',
		{
			preValidation: middleware,
			validatorCompiler: skipBodyValidation,
			schema: {
				tags: ['Notificações - Documentos Fiscais'],
				summary: 'Enviar documento(s) fiscal(is) via Email',
				body: emailBodySchema,
				description: [
					'Envia um ou mais PDFs **já gerados** ao fiscalizado como anexo de email (SMTP).',
					'',
					'O serviço **não gera** o PDF — apenas recebe e encaminha. Todos os arquivos são',
					'anexados a um único email com template institucional da AGEFIS.',
					'',
					'**Corpo (`multipart/form-data`)** — envie os campos de texto **antes** dos arquivos:',
					'| Campo | Obrigatório | Descrição |',
					'|---|---|---|',
					'| `email` | sim | Email do destinatário |',
					'| `nome` | não | Nome do destinatário (padrão: `Fiscalizado`) |',
					'| `tipoDocumento` | não | Tipo do documento, ex.: `Auto de Infração` |',
					'| `numeroDocumento` | não | Número do documento fiscal |',
					'| `arquivo` | sim | Um ou mais PDFs (repetir o campo). Máx. 10, 15MB cada |',
					'',
					'Validação: cada arquivo precisa ser PDF (mimetype + assinatura `%PDF`).',
					'A conexão SMTP é verificada antes do envio.'
				].join('\n'),
				consumes: ['multipart/form-data'],
				security: [{ ApiKeyAuth: [] }],
				response: {
					200: SucessoEmailSchema,
					400: ErroSchema.describe(
						'Requisição inválida: arquivo ausente/não-PDF ou email ausente'
					),
					401: ErroSchema.describe('API key inválida ou ausente'),
					500: ErroSchema.describe('Falha na conexão SMTP ou no envio do email')
				}
			}
		},
		controller.sendEmail
	)
}
