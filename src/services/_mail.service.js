import nodemailer from 'nodemailer'
import { settings } from 'src/config'

const {
	SMTP_HOST,
	SMTP_PORT,
	SMTP_USER,
	SMTP_PASSWORD,
	SMTP_FROM,
	SMTP_FROM_NAME
} = settings

let _transporter = null

function getTransporter() {
	if (_transporter) return _transporter

	_transporter = nodemailer.createTransport({
		host: SMTP_HOST,
		port: SMTP_PORT,
		secure: SMTP_PORT === 465,
		requireTLS: SMTP_PORT === 587,
		auth: { type: 'login', user: SMTP_USER, pass: SMTP_PASSWORD },
		tls: { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
		connectionTimeout: 30000,
		greetingTimeout: 30000,
		socketTimeout: 30000
	})

	return _transporter
}

export const mailService = {
	async verify() {
		return getTransporter().verify()
	},

	/**
	 * Envia email com anexo.
	 * @param {object} params
	 * @param {string} params.to
	 * @param {string} params.subject
	 * @param {string} params.html
	 * @param {{ filename: string, content: Buffer, contentType?: string }[]} [params.attachments]
	 */
	async send({ to, subject, html, attachments = [] }) {
		return getTransporter().sendMail({
			from: `"${SMTP_FROM_NAME}" <${SMTP_FROM}>`,
			to,
			subject,
			html,
			attachments
		})
	}
}
