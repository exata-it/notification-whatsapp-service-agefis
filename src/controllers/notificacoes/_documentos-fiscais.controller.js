import { settings } from 'src/config'
import { evoService, mailService } from 'src/services'
import {
	emailFieldsSchema,
	whatsAppFieldsSchema
} from './_documentos-fiscais.schema.js'

/**
 * Extrai TODOS os arquivos (PDF) e os campos de texto de uma requisição multipart.
 * Lê fields e files na ordem em que chegam (busboy).
 * @returns {Promise<{ files: { buffer: Buffer, filename: string, mimetype: string }[], fields: Record<string,string> }|null>}
 */
async function lerMultipart(request) {
	if (!request.isMultipart()) return null

	const files = []
	const fields = {}

	for await (const part of request.parts()) {
		if (part.type === 'file') {
			const buffer = await part.toBuffer()
			files.push({ buffer, filename: part.filename, mimetype: part.mimetype })
		} else if (part.fieldname in fields) {
			// Campo repetido (ex.: tipoDocumento por arquivo) vira array, na ordem
			fields[part.fieldname] = [].concat(fields[part.fieldname], part.value)
		} else {
			fields[part.fieldname] = part.value
		}
	}

	return { files, fields }
}

/**
 * Valida que há ao menos um arquivo e que todos são PDF (mimetype + magic bytes).
 * @returns {string|null} mensagem de erro ou null se ok
 */
function validarPdfs(files) {
	if (!files?.length) return 'Nenhum arquivo enviado'

	for (const f of files) {
		if (!f.buffer?.length) return `Arquivo "${f.filename}" vazio`
		if (f.mimetype !== 'application/pdf') {
			return `Arquivo "${f.filename}" deve ser PDF`
		}
		// magic bytes: %PDF
		if (f.buffer.subarray(0, 4).toString('latin1') !== '%PDF') {
			return `Arquivo "${f.filename}" não é um PDF válido`
		}
	}

	return null
}

/**
 * Regras do campo `documentos` (metadados pareados pelo nome do arquivo):
 * - cada entrada referencia um arquivo enviado (pelo nome exato);
 * - sem entradas duplicadas para o mesmo arquivo;
 * - arquivos referenciados precisam ter nome único no upload.
 * Arquivo sem entrada usa o tipo padrão do canal.
 * @returns {string|null} mensagem de erro ou null se ok
 */
function validarDocumentoFiscal(fields, files) {
	const docs = fields.documentos ?? []
	if (docs.length === 0) return null

	const nomes = files.map(f => f.filename)
	const duplicadosUpload = new Set(
		nomes.filter((n, i) => nomes.indexOf(n) !== i)
	)

	const vistos = new Set()
	for (const d of docs) {
		if (vistos.has(d.arquivo)) {
			return `documentos: entrada duplicada para o arquivo "${d.arquivo}"`
		}
		vistos.add(d.arquivo)

		if (!nomes.includes(d.arquivo)) {
			return `documentos: arquivo "${d.arquivo}" não foi enviado. Arquivos recebidos: ${nomes.join(', ')}`
		}
		if (duplicadosUpload.has(d.arquivo)) {
			return `documentos: mais de um arquivo enviado com o nome "${d.arquivo}" — nomes devem ser únicos para parear metadados`
		}
	}

	return null
}

/**
 * Pareia cada arquivo com seu tipo/número pelo nome do arquivo.
 * @returns {{ file: object, tipo: string, numero: string|null }[]}
 */
function montarDocumentos(fields, files, tipoPadrao) {
	const porArquivo = new Map((fields.documentos ?? []).map(d => [d.arquivo, d]))
	return files.map(file => {
		const meta = porArquivo.get(file.filename)
		return {
			file,
			tipo: meta?.tipoDocumento ?? tipoPadrao,
			numero: meta?.numeroDocumento ?? null
		}
	})
}

function nomeArquivoSeguro(base) {
	return `${base}.pdf`.replace(/[/\\?%*:|"<>]/g, '-')
}

/**
 * Resumo seguro dos arquivos para log (sem despejar o buffer).
 */
function resumoArquivos(files = []) {
	return files.map(f => ({
		filename: f.filename,
		mimetype: f.mimetype,
		tamanho_bytes: f.buffer?.length ?? 0,
		assinatura: f.buffer?.subarray(0, 4).toString('latin1') ?? null
	}))
}

/**
 * Resumo dos campos de texto para log (trunca valores longos).
 */
function resumoFields(fields = {}) {
	const out = {}
	for (const [k, v] of Object.entries(fields)) {
		out[k] = typeof v === 'string' && v.length > 80 ? `${v.slice(0, 80)}…` : v
	}
	return out
}

function documentosFiscaisController() {
	/**
	 * Envia um ou mais documentos fiscais (PDFs) via WhatsApp.
	 * Campos multipart: telefone, nome, documentos (JSON) + arquivo(s)
	 */
	async function sendWhatsApp(request, reply) {
		const log = request.log.child({ rota: 'send-whatsapp' })
		const t0 = Date.now()
		log.info('[whatsapp] início')

		const parsed = await lerMultipart(request)
		log.info(
			{
				is_multipart: request.isMultipart(),
				qtd_arquivos: parsed?.files?.length ?? 0,
				arquivos: resumoArquivos(parsed?.files),
				campos: resumoFields(parsed?.fields),
				ms_parse: Date.now() - t0
			},
			'[whatsapp] multipart lido'
		)

		if (!settings.WHATSAPP_API_URL || !settings.WHATSAPP_INSTANCE) {
			log.error(
				{
					tem_url: !!settings.WHATSAPP_API_URL,
					tem_instancia: !!settings.WHATSAPP_INSTANCE
				},
				'[whatsapp] config ausente → 503'
			)
			return reply.code(503).send({
				success: false,
				error:
					'WhatsApp não configurado no servidor (WHATSAPP_API_URL / WHATSAPP_INSTANCE)'
			})
		}

		const erroValidacao = validarPdfs(parsed?.files)
		if (erroValidacao) {
			log.warn({ erro: erroValidacao }, '[whatsapp] validação PDF falhou → 400')
			return reply.code(400).send({ success: false, error: erroValidacao })
		}

		const fieldsResult = whatsAppFieldsSchema.safeParse(parsed.fields)
		if (!fieldsResult.success) {
			const erro = fieldsResult.error.issues[0].message
			log.warn(
				{ erro, issues: fieldsResult.error.issues },
				'[whatsapp] validação de campos falhou → 400'
			)
			return reply.code(400).send({ success: false, error: erro })
		}

		const erroDoc = validarDocumentoFiscal(fieldsResult.data, parsed.files)
		if (erroDoc) {
			log.warn(
				{
					erro: erroDoc,
					qtd_documentos: fieldsResult.data.documentos?.length ?? 0,
					qtd_arquivos: parsed.files.length
				},
				'[whatsapp] regra tipo/numero falhou → 400'
			)
			return reply.code(400).send({ success: false, error: erroDoc })
		}

		const { telefone, nome = 'Fiscalizado' } = fieldsResult.data
		const documentos = montarDocumentos(
			fieldsResult.data,
			parsed.files,
			'Documento Fiscal'
		)

		const numeroFormatado = evoService.formatNumber(telefone)
		log.info(
			{ telefone_original: telefone, numero_formatado: numeroFormatado, nome },
			'[whatsapp] número formatado'
		)

		try {
			const tVal = Date.now()
			const numeroValido = await evoService.validateNumber(numeroFormatado)
			log.info(
				{ numero_valido: numeroValido, ms: Date.now() - tVal },
				'[whatsapp] validação de número (Evolution)'
			)
			if (!numeroValido) {
				return reply.code(400).send({
					success: false,
					error: `Número ${numeroFormatado} não possui WhatsApp ativo`
				})
			}
		} catch (err) {
			const erroEvo = err.response?.data?.output?.payload?.message
			const semResposta = !err.response
			if (erroEvo === 'Connection Closed' || semResposta) {
				log.error(
					{ erro: erroEvo || err.message },
					'[whatsapp] instância desconectada/indisponível → 503'
				)
				return reply.code(503).send({
					success: false,
					error:
						'Instância do WhatsApp desconectada ou indisponível. Refaça o pareamento (QR code).'
				})
			}
			log.warn(
				{ erro: err.message },
				'[whatsapp] falha ao validar número (continuando)'
			)
		}

		const total = documentos.length

		try {
			const listaDocs = documentos
				.map(d => `• *${d.tipo}*${d.numero ? ` - Nº ${d.numero}` : ''}`)
				.join('\n')
			const mensagemInicial =
				`🏛️ *AGEFIS - Agência de Fiscalização*\n\n` +
				`Olá, *${nome}*!\n\n` +
				(total > 1
					? `Foram emitidos os seguintes documentos relacionados à fiscalização realizada:\n\n${listaDocs}\n\n`
					: `Foi emitido um *${documentos[0].tipo}*${documentos[0].numero ? ` - Nº ${documentos[0].numero}` : ''} relacionado à fiscalização realizada.\n\n`) +
				`📎 ${total > 1 ? `${total} documentos serão enviados` : 'O documento será enviado'} a seguir. Por favor, aguarde...`

			let tStep = Date.now()
			await evoService.sendText(numeroFormatado, mensagemInicial)
			log.info(
				{ ms: Date.now() - tStep },
				'[whatsapp] mensagem inicial enviada'
			)

			for (let i = 0; i < total; i++) {
				const { file, tipo, numero } = documentos[i]
				const numeroTexto = numero ? ` - Nº ${numero}` : ''
				const indice = total > 1 ? ` (${i + 1}/${total})` : ''
				const fileName =
					file.filename || nomeArquivoSeguro(`${tipo}${numeroTexto} ${i + 1}`)

				tStep = Date.now()
				log.info(
					{
						indice: `${i + 1}/${total}`,
						fileName,
						tamanho_bytes: file.buffer.length
					},
					'[whatsapp] enviando mídia'
				)
				await evoService.sendMedia({
					number: numeroFormatado,
					media: file.buffer.toString('base64'),
					fileName,
					caption: `📄 *${tipo}*${numeroTexto}${indice}\n\n`,
					mediatype: 'document',
					mimetype: 'application/pdf'
				})
				log.info(
					{ indice: `${i + 1}/${total}`, ms: Date.now() - tStep },
					'[whatsapp] mídia enviada'
				)
			}

			const mensagemFinal =
				`✅ *Envio concluído!*\n\n` +
				`⚠️ _Documento importante. Guarde-o com segurança._\n\n` +
				`📞 Em caso de dúvidas, entre em contato com a AGEFIS.\n\n` +
				`_Mensagem automática - não responda._`

			tStep = Date.now()
			await evoService.sendText(numeroFormatado, mensagemFinal)
			log.info({ ms: Date.now() - tStep }, '[whatsapp] mensagem final enviada')

			log.info(
				{ total_arquivos: total, ms_total: Date.now() - t0 },
				'[whatsapp] concluído → 200'
			)
			return reply.code(200).send({
				success: true,
				message: `Notificação enviada via WhatsApp com sucesso (${total} arquivo(s))`,
				canal: 'whatsapp',
				data: {
					nome,
					telefone: numeroFormatado,
					total_arquivos: total,
					notificado_em: new Date().toISOString()
				}
			})
		} catch (error) {
			log.error(
				{
					erro: error.message,
					codigo: error.code,
					status_evo: error.response?.status,
					resposta_evo: error.response?.data,
					ms_total: Date.now() - t0
				},
				'[whatsapp] erro ao enviar → 500'
			)
			return reply.code(500).send({
				success: false,
				error: error.message || 'Erro ao enviar notificação via WhatsApp'
			})
		}
	}

	/**
	 * Envia um ou mais documentos fiscais (PDFs) como anexo via Email.
	 * Campos multipart: email, nome, documentos (JSON) + arquivo(s)
	 */
	async function sendEmail(request, reply) {
		const log = request.log.child({ rota: 'send-email' })
		const t0 = Date.now()
		log.info('[email] início')

		const parsed = await lerMultipart(request)
		log.info(
			{
				is_multipart: request.isMultipart(),
				qtd_arquivos: parsed?.files?.length ?? 0,
				arquivos: resumoArquivos(parsed?.files),
				campos: resumoFields(parsed?.fields),
				ms_parse: Date.now() - t0
			},
			'[email] multipart lido'
		)

		if (!settings.SMTP_HOST) {
			log.error('[email] SMTP_HOST ausente → 503')
			return reply.code(503).send({
				success: false,
				error: 'Email não configurado no servidor (SMTP_HOST)'
			})
		}

		const erroValidacao = validarPdfs(parsed?.files)
		if (erroValidacao) {
			log.warn({ erro: erroValidacao }, '[email] validação PDF falhou → 400')
			return reply.code(400).send({ success: false, error: erroValidacao })
		}

		const fieldsResult = emailFieldsSchema.safeParse(parsed.fields)
		if (!fieldsResult.success) {
			const erro = fieldsResult.error.issues[0].message
			log.warn(
				{ erro, issues: fieldsResult.error.issues },
				'[email] validação de campos falhou → 400'
			)
			return reply.code(400).send({ success: false, error: erro })
		}

		const erroDoc = validarDocumentoFiscal(fieldsResult.data, parsed.files)
		if (erroDoc) {
			log.warn(
				{
					erro: erroDoc,
					qtd_documentos: fieldsResult.data.documentos?.length ?? 0,
					qtd_arquivos: parsed.files.length
				},
				'[email] regra tipo/numero falhou → 400'
			)
			return reply.code(400).send({ success: false, error: erroDoc })
		}

		const { email, nome = 'Fiscalizado' } = fieldsResult.data
		const documentos = montarDocumentos(
			fieldsResult.data,
			parsed.files,
			'Documento'
		)
		const destino = email
		log.info({ destino, nome }, '[email] campos validados')

		try {
			const tV = Date.now()
			await mailService.verify()
			log.info({ ms: Date.now() - tV }, '[email] conexão SMTP verificada')
		} catch (verifyError) {
			log.error(
				{ erro: verifyError.message, codigo: verifyError.code },
				'[email] falha ao verificar SMTP → 500'
			)
			return reply.code(500).send({
				success: false,
				error: 'Falha na conexão com servidor SMTP'
			})
		}

		const total = documentos.length
		const itensHtml = documentos
			.map(
				d =>
					`<li><strong>${d.tipo}${d.numero ? ` Nº ${d.numero}` : ''}</strong></li>`
			)
			.join('\n\t\t\t\t\t\t')
		const htmlBody = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="background-color: #1a5f2a; padding: 20px; text-align: center;">
					<h1 style="color: white; margin: 0;">AGEFIS - Fiscalização</h1>
				</div>
				<div style="padding: 30px; background-color: #f9f9f9;">
					<p>Prezado(a) <strong>${nome}</strong>,</p>
					<p>Você possui ${total > 1 ? `${total} documentos fiscais disponíveis` : 'um documento fiscal disponível'}:</p>
					<ul style="background: white; padding: 20px; border-radius: 5px;">
						${itensHtml}
					</ul>
					<p>${total > 1 ? 'Os documentos estão anexados' : 'O documento está anexado'} a este email.</p>
					<p style="font-size: 14px; color: #888;">
						<em>Documento importante para sua empresa. Guarde-o com segurança.</em>
					</p>
					<p style="font-size: 14px; color: #888;">
						Em caso de dúvidas, entre em contato com a AGEFIS.
					</p>
				</div>
				<div style="background-color: #333; padding: 15px; text-align: center;">
					<p style="color: #aaa; font-size: 12px; margin: 0;">
						Agência de Fiscalização de Fortaleza - AGEFIS<br>
						Mensagem automática - não responda.
					</p>
				</div>
			</div>
		`

		const attachments = documentos.map(({ file, tipo, numero }, i) => ({
			filename:
				file.filename ||
				nomeArquivoSeguro(`${tipo}${numero ? ` Nº ${numero}` : ''} ${i + 1}`),
			content: file.buffer,
			contentType: 'application/pdf'
		}))

		try {
			const tS = Date.now()
			log.info(
				{ destino, total_anexos: total, assunto: 'Documento Fiscal - AGEFIS' },
				'[email] enviando'
			)
			const info = await mailService.send({
				to: destino,
				subject: 'Documento Fiscal - AGEFIS',
				html: htmlBody,
				attachments
			})

			log.info(
				{
					messageId: info.messageId,
					ms_envio: Date.now() - tS,
					ms_total: Date.now() - t0
				},
				'[email] enviado → 200'
			)
			return reply.code(200).send({
				success: true,
				message: `Email enviado com sucesso (${total} arquivo(s))`,
				canal: 'email',
				data: {
					nome,
					email: destino,
					total_arquivos: total,
					notificado_em: new Date().toISOString(),
					messageId: info.messageId
				}
			})
		} catch (errorSend) {
			log.error(
				{
					erro: errorSend.message,
					codigo: errorSend.code,
					comando: errorSend.command,
					resposta_smtp: errorSend.response,
					ms_total: Date.now() - t0
				},
				'[email] erro ao enviar → 500'
			)
			return reply.code(500).send({
				success: false,
				error: `Erro ao enviar email: ${errorSend.message}`
			})
		}
	}

	return { sendWhatsApp, sendEmail }
}

export { documentosFiscaisController }
