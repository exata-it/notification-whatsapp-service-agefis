import { z } from 'zod'

// Campo de texto opcional: trata string vazia ('') como ausente (undefined),
// pois clientes multipart enviam campos vazios em vez de omiti-los.
const opcional = descricao =>
	z
		.preprocess(
			v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
			z.string().trim().min(1).optional()
		)
		.describe(descricao)

// Campos de texto comuns aos dois canais.
const camposComuns = {
	nome: opcional('Nome do destinatário'),
	tipoDocumento: opcional('Tipo do documento, ex.: Auto de Infração'),
	numeroDocumento: opcional('Número do documento fiscal')
}

// Validação real dos campos de texto (usada no controller via safeParse).
export const whatsAppFieldsSchema = z.object({
	telefone: z
		.string({ error: 'Telefone é obrigatório' })
		.trim()
		.regex(/\d/, 'Telefone deve conter dígitos')
		.describe('Telefone do destinatário com DDD'),
	...camposComuns
})

export const emailFieldsSchema = z.object({
	email: z
		.string({ error: 'Email é obrigatório' })
		.trim()
		.email('Email inválido')
		.describe('Email do destinatário'),
	...camposComuns
})

// Representação do arquivo binário para o multipart (apenas documentação OpenAPI).
const arquivoBinario = z
	.any()
	.describe('Um ou mais PDFs (campo repetido). Máx. 10, 15MB cada')

// Body multipart para a doc (Scalar). Validação efetiva é feita no controller.
export const whatsAppBodySchema = whatsAppFieldsSchema
	.extend({ arquivo: arquivoBinario })
	.describe('multipart/form-data — campos de texto antes dos arquivos')

export const emailBodySchema = emailFieldsSchema
	.extend({ arquivo: arquivoBinario })
	.describe('multipart/form-data — campos de texto antes dos arquivos')
