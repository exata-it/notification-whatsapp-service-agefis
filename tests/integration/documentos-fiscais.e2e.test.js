import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { settings } from 'src/config'
import { evoService } from 'src/services'
import { createApp } from '../../src/app.js'

const TEST_PHONE = process.env.TEST_PHONE || '85986222725'
const TEST_EMAIL = process.env.TEST_EMAIL || 'joaopsilvavolei@gmail.com'

const API_KEY = settings.INTERNAL_API_KEYS[0]

const PDF_MINIMO = Buffer.from(
	'%PDF-1.4\n' +
		'1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n' +
		'2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n' +
		'3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 200 100]>> endobj\n' +
		'trailer <</Root 1 0 R>>\n' +
		'%%EOF\n'
)

let app
let baseUrl
let instanciaAberta = false

// Campos de texto ANTES dos arquivos (ordem exigida pelo controller/busboy)
function montarForm(fields = {}, arquivos = []) {
	const form = new FormData()
	for (const [k, v] of Object.entries(fields)) {
		for (const item of [].concat(v)) form.append(k, item)
	}
	for (const a of arquivos) {
		form.append(
			'arquivo',
			new File([a.conteudo ?? PDF_MINIMO], a.nome ?? 'documento.pdf', {
				type: a.tipo ?? 'application/pdf'
			})
		)
	}
	return form
}

function postar(rota, { form, apiKey = API_KEY } = {}) {
	const headers = {}
	if (apiKey) headers['x-api-key'] = apiKey
	return fetch(`${baseUrl}/api/notificacoes/documentos-fiscais/${rota}`, {
		method: 'POST',
		headers,
		body: form ?? montarForm({ telefone: TEST_PHONE }, [{}])
	})
}

beforeAll(async () => {
	app = await createApp()
	await app.listen({ port: 0 })
	baseUrl = `http://127.0.0.1:${app.server.address().port}`

	try {
		instanciaAberta = (await evoService.getConnectionState()) === 'open'
	} catch {
		instanciaAberta = false
	}
	console.log(
		`[e2e] app em ${baseUrl} | instância WhatsApp: ${instanciaAberta ? 'open' : 'fechada/inacessível'}`
	)
})

afterAll(async () => {
	await app?.close()
})

describe('GET /', () => {
	test('health check responde 200', async () => {
		const res = await fetch(`${baseUrl}/`)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.mensagem).toContain('AGEFIS')
	})
})

describe('POST /send-whatsapp — autenticação', () => {
	test('sem x-api-key → 401', async () => {
		const res = await postar('send-whatsapp', { apiKey: null })
		expect(res.status).toBe(401)
	})

	test('x-api-key inválida → 401', async () => {
		const res = await postar('send-whatsapp', { apiKey: 'chave-errada' })
		expect(res.status).toBe(401)
	})
})

describe('POST /send-whatsapp — validações', () => {
	test('sem arquivo → 400', async () => {
		const res = await postar('send-whatsapp', {
			form: montarForm({ telefone: TEST_PHONE })
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toBe('Nenhum arquivo enviado')
	})

	test('arquivo não-PDF (mimetype) → 400', async () => {
		const res = await postar('send-whatsapp', {
			form: montarForm({ telefone: TEST_PHONE }, [
				{ nome: 'nota.txt', tipo: 'text/plain', conteudo: 'texto puro' }
			])
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toContain('deve ser PDF')
	})

	test('PDF falso (mimetype pdf, sem assinatura %PDF) → 400', async () => {
		const res = await postar('send-whatsapp', {
			form: montarForm({ telefone: TEST_PHONE }, [
				{ conteudo: 'não sou um pdf de verdade' }
			])
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toContain('não é um PDF válido')
	})

	test('sem telefone → 400', async () => {
		const res = await postar('send-whatsapp', { form: montarForm({}, [{}]) })
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toBe('Telefone é obrigatório')
	})

	test('documentos com JSON inválido → 400', async () => {
		const res = await postar('send-whatsapp', {
			form: montarForm({ telefone: TEST_PHONE, documentos: 'não é json' }, [{}])
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toContain('array JSON')
	})

	test('documentos sem tipoDocumento na entrada → 400', async () => {
		const res = await postar('send-whatsapp', {
			form: montarForm(
				{
					telefone: TEST_PHONE,
					documentos: JSON.stringify([
						{ arquivo: 'documento.pdf', numeroDocumento: '2026/001' }
					])
				},
				[{}]
			)
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toContain('tipoDocumento é obrigatório')
	})

	test('documentos referenciando arquivo não enviado → 400', async () => {
		const res = await postar('send-whatsapp', {
			form: montarForm(
				{
					telefone: TEST_PHONE,
					documentos: JSON.stringify([
						{ arquivo: 'nao-existe.pdf', tipoDocumento: 'Auto de Infração' }
					])
				},
				[{ nome: 'auto.pdf' }]
			)
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toContain('"nao-existe.pdf" não foi enviado')
		expect(body.error).toContain('auto.pdf')
	})

	test('documentos com entrada duplicada pro mesmo arquivo → 400', async () => {
		const res = await postar('send-whatsapp', {
			form: montarForm(
				{
					telefone: TEST_PHONE,
					documentos: JSON.stringify([
						{ arquivo: 'auto.pdf', tipoDocumento: 'Auto de Infração' },
						{ arquivo: 'auto.pdf', tipoDocumento: 'Notificação' }
					])
				},
				[{ nome: 'auto.pdf' }]
			)
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toContain('entrada duplicada')
	})

	test('dois arquivos com mesmo nome referenciados em documentos → 400', async () => {
		const res = await postar('send-whatsapp', {
			form: montarForm(
				{
					telefone: TEST_PHONE,
					documentos: JSON.stringify([
						{ arquivo: 'auto.pdf', tipoDocumento: 'Auto de Infração' }
					])
				},
				[{ nome: 'auto.pdf' }, { nome: 'auto.pdf' }]
			)
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toContain('nomes devem ser únicos')
	})
})

describe('POST /send-whatsapp — envio real', () => {
	test('instância desconectada → 503 (não confundir com número inválido)', async () => {
		if (instanciaAberta) {
			console.log('[skip] instância conectada — cenário não aplicável')
			return
		}
		const res = await postar('send-whatsapp', {
			form: montarForm({ telefone: TEST_PHONE, nome: 'João Pedro' }, [{}])
		})
		expect(res.status).toBe(503)
		const body = await res.json()
		expect(body.error).toContain('desconectada')
	}, 60_000)

	test('envia documento para número real → 200', async () => {
		if (!instanciaAberta) {
			console.log('[skip] instância não conectada')
			return
		}
		const res = await postar('send-whatsapp', {
			form: montarForm(
				{
					telefone: TEST_PHONE,
					nome: 'João Pedro (teste e2e)',
					documentos: JSON.stringify([
						{
							arquivo: 'auto-infracao-e2e.pdf',
							tipoDocumento: 'Auto de Infração',
							numeroDocumento: 'E2E-001'
						}
					])
				},
				[{ nome: 'auto-infracao-e2e.pdf' }]
			)
		})
		const body = await res.json()
		expect(res.status).toBe(200)
		expect(body.success).toBe(true)
		expect(body.canal).toBe('whatsapp')
		expect(body.data.telefone).toBe('5585986222725')
		expect(body.data.total_arquivos).toBe(1)
	}, 120_000)

	test('envia 2 documentos com tipo/número próprios → 200', async () => {
		if (!instanciaAberta) {
			console.log('[skip] instância não conectada')
			return
		}
		const res = await postar('send-whatsapp', {
			form: montarForm(
				{
					telefone: TEST_PHONE,
					nome: 'João Pedro (teste e2e multi)',
					documentos: JSON.stringify([
						{
							arquivo: 'auto-infracao-e2e.pdf',
							tipoDocumento: 'Auto de Infração',
							numeroDocumento: 'E2E-001'
						},
						{
							arquivo: 'embargo-e2e.pdf',
							tipoDocumento: 'Notificação de Embargo',
							numeroDocumento: 'E2E-002'
						}
					])
				},
				[{ nome: 'auto-infracao-e2e.pdf' }, { nome: 'embargo-e2e.pdf' }]
			)
		})
		const body = await res.json()
		expect(res.status).toBe(200)
		expect(body.success).toBe(true)
		expect(body.data.total_arquivos).toBe(2)
	}, 120_000)
})

describe('POST /send-email — validações', () => {
	test('sem email → 400', async () => {
		const res = await postar('send-email', { form: montarForm({}, [{}]) })
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toBe('Email é obrigatório')
	})

	test('email inválido → 400', async () => {
		const res = await postar('send-email', {
			form: montarForm({ email: 'nao-eh-email' }, [{}])
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toBe('Email inválido')
	})

	test('sem arquivo → 400', async () => {
		const res = await postar('send-email', {
			form: montarForm({ email: TEST_EMAIL })
		})
		expect(res.status).toBe(400)
	})

	test('documentos referenciando arquivo não enviado → 400', async () => {
		const res = await postar('send-email', {
			form: montarForm(
				{
					email: TEST_EMAIL,
					documentos: JSON.stringify([
						{ arquivo: 'nao-existe.pdf', tipoDocumento: 'Auto de Infração' }
					])
				},
				[{ nome: 'auto.pdf' }]
			)
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toContain('não foi enviado')
	})
})

describe('POST /send-email — envio real', () => {
	test('envia 2 documentos com tipo/número próprios como anexos → 200', async () => {
		if (!settings.SMTP_HOST) {
			console.log('[skip] SMTP não configurado')
			return
		}
		const res = await postar('send-email', {
			form: montarForm(
				{
					email: TEST_EMAIL,
					nome: 'João Pedro (teste e2e)',
					documentos: JSON.stringify([
						{
							arquivo: 'auto-infracao-e2e.pdf',
							tipoDocumento: 'Auto de Infração',
							numeroDocumento: 'E2E-001'
						},
						{
							arquivo: 'embargo-e2e.pdf',
							tipoDocumento: 'Notificação de Embargo',
							numeroDocumento: 'E2E-002'
						}
					])
				},
				[{ nome: 'auto-infracao-e2e.pdf' }, { nome: 'embargo-e2e.pdf' }]
			)
		})
		const body = await res.json()
		expect(res.status).toBe(200)
		expect(body.success).toBe(true)
		expect(body.canal).toBe('email')
		expect(body.data.email).toBe(TEST_EMAIL)
		expect(body.data.total_arquivos).toBe(2)
		expect(body.data.messageId).toBeString()
	}, 120_000)
})
