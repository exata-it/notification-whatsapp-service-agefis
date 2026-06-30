import axios from 'axios'
import { settings } from 'src/config'

const { WHATSAPP_API_URL, WHATSAPP_INSTANCE, WHATSAPP_API_KEY } = settings

const evoClient = axios.create({
	baseURL: WHATSAPP_API_URL,
	timeout: 30_000,
	headers: {
		'Content-Type': 'application/json',
		apikey: WHATSAPP_API_KEY
	}
})

export const evoService = {
	/**
	 * Formata número para o padrão WhatsApp (DDI 55 + DDD + número)
	 */
	formatNumber(phone) {
		let formatted = phone?.replace(/\D/g, '') || ''
		if (formatted && !formatted.startsWith('55')) {
			formatted = `55${formatted}`
		}
		return formatted
	},

	/**
	 * Valida lista de números na Evolution API
	 */
	async validateNumbers(numbers) {
		const numbersArray = Array.isArray(numbers) ? numbers : [numbers]
		const formattedNumbers = numbersArray
			.map(n => this.formatNumber(n))
			.filter(Boolean)

		if (formattedNumbers.length === 0) return []

		const response = await evoClient.post(
			`/chat/whatsappNumbers/${WHATSAPP_INSTANCE}`,
			{ numbers: formattedNumbers }
		)
		return response.data
	},

	/**
	 * Valida se um número possui WhatsApp ativo
	 */
	async validateNumber(number) {
		try {
			const results = await this.validateNumbers(number)
			return results?.[0]?.exists === true
		} catch (error) {
			console.error(
				`[EvoService] Falha na validação do número ${number}:`,
				error.message
			)
			return false
		}
	},

	/**
	 * Envia mensagem de texto simples
	 */
	async sendText(number, text, options = {}) {
		const formattedNumber = this.formatNumber(number)
		const payload = {
			number: formattedNumber,
			text,
			options: {
				delay: options.delay ?? 1200,
				presence: options.presence ?? 'composing',
				...options
			}
		}

		const response = await evoClient.post(
			`/message/sendText/${WHATSAPP_INSTANCE}`,
			payload
		)
		return response.data
	},

	/**
	 * Envia arquivo de mídia.
	 * @param {string} params.media URL pública ou Base64 puro
	 * @param {'image'|'video'|'document'|'audio'} params.mediatype
	 */
	async sendMedia({
		number,
		media,
		fileName,
		caption = '',
		mediatype = 'document',
		mimetype = 'application/pdf',
		options = {}
	}) {
		const formattedNumber = this.formatNumber(number)
		const payload = {
			number: formattedNumber,
			mediatype,
			mimetype,
			fileName,
			caption,
			media,
			options: {
				delay: options.delay ?? 2000,
				presence: options.presence ?? 'composing',
				...options
			}
		}

		const response = await evoClient.post(
			`/message/sendMedia/${WHATSAPP_INSTANCE}`,
			payload
		)
		return response.data
	}
}
