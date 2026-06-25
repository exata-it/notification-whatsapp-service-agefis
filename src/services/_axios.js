import axios from 'axios'

// Criar instância do axios para integração
export const api = axios.create({
	baseURL: process.env.INTEGRA_API_URL || 'http://localhost:3001',
	timeout: 30000
})
