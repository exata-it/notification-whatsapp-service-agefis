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
 * Regras de tipoDocumento/numeroDocumento:
 * - os dois andam juntos (ambos ou nenhum);
 * - quando usados, exigem exatamente um arquivo.
 * @returns {string|null} mensagem de erro ou null se ok
 */
function validarDocumentoFiscal(fields, files) {
	const temTipo = !!fields.tipoDocumento
	const temNumero = !!fields.numeroDocumento

	if (temTipo !== temNumero) {
		return 'tipoDocumento e numeroDocumento devem ser enviados juntos'
	}
	if (temTipo && temNumero && files.length !== 1) {
		return 'tipoDocumento e numeroDocumento exigem exatamente um arquivo'
	}

	return null
}

function nomeArquivoSeguro(base) {
	return `${base}.pdf`.replace(/[/\\?%*:|"<>]/g, '-')
}

function documentosFiscaisController() {
	/**
	 * Envia um ou mais documentos fiscais (PDFs) via WhatsApp.
	 * Campos multipart: telefone, nome, tipoDocumento, numeroDocumento + arquivo(s)
	 */
	async function sendWhatsApp(request, reply) {
		const parsed = await lerMultipart(request)

		if (!settings.WHATSAPP_API_URL || !settings.WHATSAPP_INSTANCE) {
			return reply.code(503).send({
				success: false,
				error:
					'WhatsApp não configurado no servidor (WHATSAPP_API_URL / WHATSAPP_INSTANCE)'
			})
		}

		const erroValidacao = validarPdfs(parsed?.files)
		if (erroValidacao) {
			return reply.code(400).send({ success: false, error: erroValidacao })
		}

		const fieldsResult = whatsAppFieldsSchema.safeParse(parsed.fields)
		if (!fieldsResult.success) {
			return reply.code(400).send({
				success: false,
				error: fieldsResult.error.issues[0].message
			})
		}

		const erroDoc = validarDocumentoFiscal(fieldsResult.data, parsed.files)
		if (erroDoc) {
			return reply.code(400).send({ success: false, error: erroDoc })
		}

		const {
			telefone,
			nome = 'Fiscalizado',
			tipoDocumento = 'Documento Fiscal',
			numeroDocumento
		} = fieldsResult.data

		const numeroFormatado = evoService.formatNumber(telefone)

		try {
			const numeroValido = await evoService.validateNumber(numeroFormatado)
			if (!numeroValido) {
				return reply.code(400).send({
					success: false,
					error: `Número ${numeroFormatado} não possui WhatsApp ativo`
				})
			}
		} catch (err) {
			console.warn(
				'[WhatsApp] Falha ao validar número (continuando):',
				err.message
			)
		}

		const total = parsed.files.length
		const numeroDocTexto = numeroDocumento ? ` - Nº ${numeroDocumento}` : ''

		try {
			const mensagemInicial =
				`🏛️ *AGEFIS - Agência de Fiscalização*\n\n` +
				`Olá, *${nome}*!\n\n` +
				`Foi emitido um *${tipoDocumento}* relacionado à fiscalização realizada.\n\n` +
				`📎 ${total > 1 ? `${total} documentos serão enviados` : 'O documento será enviado'} a seguir. Por favor, aguarde...`

			await evoService.sendText(numeroFormatado, mensagemInicial)

			for (let i = 0; i < total; i++) {
				const file = parsed.files[i]
				const indice = total > 1 ? ` (${i + 1}/${total})` : ''
				const fileName =
					file.filename ||
					nomeArquivoSeguro(`${tipoDocumento}${numeroDocTexto} ${i + 1}`)

				await evoService.sendMedia({
					number: numeroFormatado,
					media: file.buffer.toString('base64'),
					fileName,
					caption: `📄 *${tipoDocumento}*${numeroDocTexto}${indice}\n\n`,
					mediatype: 'document',
					mimetype: 'application/pdf'
				})
			}

			const mensagemFinal =
				`✅ *Envio concluído!*\n\n` +
				`⚠️ _Documento importante. Guarde-o com segurança._\n\n` +
				`📞 Em caso de dúvidas, entre em contato com a AGEFIS.\n\n` +
				`_Mensagem automática - não responda._`

			await evoService.sendText(numeroFormatado, mensagemFinal)

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
			console.error('[WhatsApp] Erro ao enviar:', error.message)
			return reply.code(500).send({
				success: false,
				error: error.message || 'Erro ao enviar notificação via WhatsApp'
			})
		}
	}

	/**
	 * Envia um ou mais documentos fiscais (PDFs) como anexo via Email.
	 * Campos multipart: email, nome, tipoDocumento, numeroDocumento + arquivo(s)
	 */
	async function sendEmail(request, reply) {
		const parsed = await lerMultipart(request)

		if (!settings.SMTP_HOST) {
			return reply.code(503).send({
				success: false,
				error: 'Email não configurado no servidor (SMTP_HOST)'
			})
		}

		const erroValidacao = validarPdfs(parsed?.files)
		if (erroValidacao) {
			return reply.code(400).send({ success: false, error: erroValidacao })
		}

		const fieldsResult = emailFieldsSchema.safeParse(parsed.fields)
		if (!fieldsResult.success) {
			return reply.code(400).send({
				success: false,
				error: fieldsResult.error.issues[0].message
			})
		}

		const erroDoc = validarDocumentoFiscal(fieldsResult.data, parsed.files)
		if (erroDoc) {
			return reply.code(400).send({ success: false, error: erroDoc })
		}

		const {
			email,
			nome = 'Fiscalizado',
			tipoDocumento = 'Documento',
			numeroDocumento
		} = fieldsResult.data
		const destino = email

		try {
			await mailService.verify()
		} catch (verifyError) {
			console.error('[Email] Erro ao verificar SMTP:', verifyError.message)
			return reply.code(500).send({
				success: false,
				error: 'Falha na conexão com servidor SMTP'
			})
		}

		const total = parsed.files.length
		const numeroDocTexto = numeroDocumento ? ` Nº ${numeroDocumento}` : ''
		const htmlBody = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="background-color: #1a5f2a; padding: 20px; text-align: center;">
					<h1 style="color: white; margin: 0;">AGEFIS - Fiscalização</h1>
				</div>
				<div style="padding: 30px; background-color: #f9f9f9;">
					<p>Prezado(a) <strong>${nome}</strong>,</p>
					<p>Você possui ${total > 1 ? `${total} documentos fiscais disponíveis` : 'um documento fiscal disponível'}:</p>
					<ul style="background: white; padding: 20px; border-radius: 5px;">
						<li><strong>${tipoDocumento}${numeroDocTexto}</strong></li>
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

		const attachments = parsed.files.map((file, i) => ({
			filename:
				file.filename ||
				nomeArquivoSeguro(`${tipoDocumento}${numeroDocTexto} ${i + 1}`),
			content: file.buffer,
			contentType: 'application/pdf'
		}))

		try {
			const info = await mailService.send({
				to: destino,
				subject: 'Documento Fiscal - AGEFIS',
				html: htmlBody,
				attachments
			})

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
			console.error('[Email] Erro ao enviar:', errorSend.message)
			return reply.code(500).send({
				success: false,
				error: `Erro ao enviar email: ${errorSend.message}`
			})
		}
	}

	return { sendWhatsApp, sendEmail }
}

export { documentosFiscaisController }
