import { beforeAll, describe, expect, test } from 'bun:test'
import { settings } from 'src/config'
import { evoService } from 'src/services'

const TEST_PHONE = process.env.TEST_PHONE || '85986222725'

let estadoInstancia = 'desconhecido'

beforeAll(async () => {
	try {
		estadoInstancia = await evoService.getConnectionState()
	} catch {
		estadoInstancia = 'inacessível'
	}
	console.log(
		`[e2e] instância "${settings.WHATSAPP_INSTANCE}": ${estadoInstancia}`
	)
})

describe('evoService.formatNumber', () => {
	test('adiciona DDI 55 quando ausente', () => {
		expect(evoService.formatNumber('85986222725')).toBe('5585986222725')
	})

	test('remove máscara e espaços', () => {
		expect(evoService.formatNumber('(85) 98622-2725')).toBe('5585986222725')
	})

	test('não duplica DDI 55', () => {
		expect(evoService.formatNumber('5585986222725')).toBe('5585986222725')
	})

	test('vazio/null retorna string vazia', () => {
		expect(evoService.formatNumber(null)).toBe('')
		expect(evoService.formatNumber('')).toBe('')
	})
})

describe('Evolution API (integração real)', () => {
	test('config presente', () => {
		expect(settings.WHATSAPP_API_URL).not.toBe('')
		expect(settings.WHATSAPP_INSTANCE).not.toBe('')
		expect(settings.WHATSAPP_API_KEY).not.toBe('')
	})

	test('getConnectionState responde estado conhecido', async () => {
		const estado = await evoService.getConnectionState()
		expect(['open', 'connecting', 'close']).toContain(estado)
	}, 30_000)

	test('validateNumber reconhece número real (requer instância aberta)', async () => {
		if (estadoInstancia !== 'open') {
			console.log('[skip] instância não conectada')
			return
		}
		const valido = await evoService.validateNumber(TEST_PHONE)
		expect(valido).toBe(true)
	}, 30_000)

	test('validateNumber rejeita número inexistente (requer instância aberta)', async () => {
		if (estadoInstancia !== 'open') {
			console.log('[skip] instância não conectada')
			return
		}
		const valido = await evoService.validateNumber('5585000000000')
		expect(valido).toBe(false)
	}, 30_000)

	test('instância desconectada: validateNumber lança erro (não retorna false)', async () => {
		if (estadoInstancia === 'open') return
		// estado 'connecting' segura a request até o timeout do axios (30s)
		await expect(evoService.validateNumber(TEST_PHONE)).rejects.toThrow()
	}, 60_000)
})
