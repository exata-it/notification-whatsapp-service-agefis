import { format } from 'date-fns'

const CONDITIONS_AND_OPERATORS = [
	'AND',
	'OR',
	'NOT',
	'equals',
	'not',
	'in',
	'notIn',
	'lt',
	'lte',
	'gt',
	'gte',
	'contains',
	'search',
	'mode',
	'startsWith',
	'endsWith',
	'some',
	'every',
	'none',
	'is',
	'isNot'
]

const useUtils = () => {
	function createRouteGroup(server, prefix, routes) {
		routes.forEach(({ method, path, handler, options }) => {
			server.route({
				method,
				url: `${prefix}${path}`,
				handler,
				...(options || {})
			})
		})
	}
	function convertMetadado(value, type) {
		if (!value || value === 'Não informado') return value
		if (type === 'date') return format(new Date(value), 'dd/MM/yyyy')
		if (type === 'checkbox') return value === 'true' ? 'Sim' : 'Não'
		return value
	}
	function isNumeric(value) {
		return /^-?\d+$/.test(value)
	}
	function isDateTimeString(input) {
		const dateTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
		return dateTimePattern.test(input)
	}
	function validationParse(body, ignore = []) {
		for (const key in body) {
			if (typeof body[key] !== 'string') continue
			if (key === 'senha') continue
			if (ignore.includes(key)) continue
			if (isNumeric(body[key])) {
				body[key] = Number(body[key])
			} else if (isDateTimeString(body[key])) {
				body[key] = new Date(body[key].concat('Z'))
			}
		}
		return body
	}
	function ajustarFusoHorario(dataString, horasParaRemover = 3) {
		const data = new Date(dataString)
		data.setHours(data.getHours() - horasParaRemover)
		return data.toISOString()
	}
	function capitalizeFirstLetter(string) {
		return string.charAt(0).toUpperCase() + string.slice(1)
	}
	function parseArray(type, array) {
		if (Array.isArray(type) || !Array.isArray(array)) return array
		switch (type) {
			case 'Int':
				return array.map(Number)
			case 'DateTime':
				return array.map(a => new Date(a))
			case 'Boolean':
				return array.map(m => m === 'true')
		}
	}
	function parseObject(type, json, fields) {
		if (Array.isArray(type)) return json
		if (json === null) return json
		for (const [key, value] of Object.entries(json)) {
			if (Array.isArray(value)) {
				json[key] = parseArray(type, value)
				continue
			}
			if (CONDITIONS_AND_OPERATORS.includes(key)) {
				json[key] = parseValues(fields, value)
				continue
			}
			switch (type) {
				case 'DateTime':
					json[key] = new Date(value)
					break
				case 'Int':
					json[key] = Number(value)
					break
				case 'Boolean':
					json[key] = value === 'true'
					break
			}
		}
		return json
	}
	/**
	 * @param {{name: String, isId: Boolean, kind: String, type: String, default: { name: String }}[]} fields
	 */
	function parseValues(fields = {}, json = {}, models = {}) {
		if (json === null) return json
		for (const [key, value] of Object.entries(json)) {
			if (CONDITIONS_AND_OPERATORS.includes(key)) {
				json[key] = Array.isArray(value)
					? value.map(j => parseValues(fields, j, models))
					: parseValues(fields, value, models)
				continue
			}
			const field = fields.find(f => f.name === key)
			if (!field) {
				if (typeof value === 'object')
					json[key] = parseValues(fields, value, models)
				continue
			}
			if (field.kind === 'object' && field.relationName) {
				json[key] = parseValues(models[field.type].fields, value, models)
				continue
			}
			if (field.kind !== 'scalar') continue
			if (typeof value === 'object')
				json[key] = parseObject(field.type, value, fields)
			else if (typeof value === 'string')
				switch (field.type) {
					case 'DateTime':
						json[key] = new Date(value)
						break
					case 'Int':
						json[key] = Number(value)
						break
					case 'Boolean':
						json[key] = value === 'true'
						break
				}
			else if (field.type === 'String') json[key] = String(value)
		}
		return json
	}
	function adjustTimezone(obj, fields = null) {
		if (Array.isArray(obj)) {
			obj.forEach(item => adjustTimezone(item, fields))
		} else if (obj && typeof obj === 'object') {
			Object.keys(obj).forEach(key => {
				if (obj[key] instanceof Date) {
					if (fields) {
						const field = fields.find(f => f.name === key)
						if (field?.nativeType && field.nativeType[0] === 'Date') return
					}
					obj[key] = new Date(obj[key].getTime() - 3 * 60 * 60 * 1000)
				} else if (
					obj[key] &&
					(typeof obj[key] === 'object' || Array.isArray(obj[key]))
				) {
					adjustTimezone(obj[key], fields)
				}
			})
		}
	}
	function intervaloDoDiaBrasilia(dataStr) {
		const dataInicio = new Date(`${dataStr}T00:00:00-03:00`)
		const dataFim = new Date(`${dataStr}T23:59:59-03:00`)

		return {
			inicioUTC: new Date(dataInicio.getTime() - 3 * 60 * 60 * 1000),
			fimUTC: new Date(dataFim.getTime() - 3 * 60 * 60 * 1000)
		}
	}

	//#region mapping term e fields
	function mappingFields(field, term, table) {
		const checkFields = ['Int', 'Boolean', 'Date', 'DateTime', 'Uuid']
		const isNumericTerm = /^-?\d+$/.test(term)

		// Detecção de UUID (v4 ou v7)
		const isUuid =
			typeof term === 'string' &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				term
			)

		// ---------------------------------------------------------
		// CASO 1: Dot Notation (ex: usuario.email ou lista:item.campo)
		// ---------------------------------------------------------
		if (field.includes('.')) {
			const [field1, field2] = field.split('.')

			// Tratamento especial para listas aninhadas (ex: metadado:tipo_fiscalizacao.nome)
			if (field1.includes(':')) {
				const [fieldList, fieldCheck] = field1.split(':')

				// Se o fieldList é o nome da tabela atual, simplifica
				if (
					fieldList === table.name &&
					table.fields.find(f => f.name === fieldCheck)
				) {
					const directField = table.fields.find(f => f.name === fieldCheck)

					if (isUuid) return { [fieldCheck]: term }

					if (checkFields.includes(directField?.type)) {
						if (directField.type === 'DateTime') {
							const { inicioUTC, fimUTC } = intervaloDoDiaBrasilia(term)
							return { [fieldCheck]: { gte: inicioUTC, lte: fimUTC } }
						}
						return { [fieldCheck]: isNumericTerm ? Number(term) : term }
					}
					return { [fieldCheck]: { contains: term, mode: 'insensitive' } }
				}

				// Lógica padrão para listas
				if (checkFields.includes(table.fields[field2]?.type) || isUuid) {
					if (isUuid) {
						return {
							[fieldList]: { some: { [fieldCheck]: { [field2]: term } } }
						}
					}
					if (table.fields[field2]?.type === 'DateTime') {
						const { inicioUTC, fimUTC } = intervaloDoDiaBrasilia(term)
						return {
							[fieldList]: {
								some: {
									[fieldCheck]: { [field2]: { gte: inicioUTC, lte: fimUTC } }
								}
							}
						}
					}
					return {
						[fieldList]: {
							some: {
								[fieldCheck]: { [field2]: isNumericTerm ? Number(term) : term }
							}
						}
					}
				}
				return {
					[fieldList]: {
						some: {
							[fieldCheck]: {
								[field2]: { contains: term, mode: 'insensitive' }
							}
						}
					}
				}
			}

			// Relacionamento padrão (ex: usuario.id)
			const relationField = table.fields.find(f => f.name === field1)

			// Prioridade para UUID no relacionamento direto
			if (isUuid) {
				return { [field1]: { [field2]: term } }
			}

			if (relationField?.relationName) {
				const isIntField = field2.includes('_id') || field2 === 'id'
				if (isIntField || isNumericTerm) {
					return { [field1]: { [field2]: isNumericTerm ? Number(term) : term } }
				}
			}

			const field2Type = table.fields.find(f => f.name === field2)?.type
			if (checkFields.includes(field2Type)) {
				if (field2Type === 'DateTime') {
					const { inicioUTC, fimUTC } = intervaloDoDiaBrasilia(term)
					return { [field1]: { [field2]: { gte: inicioUTC, lte: fimUTC } } }
				}
				return { [field1]: { [field2]: isNumericTerm ? Number(term) : term } }
			}
			return { [field1]: { [field2]: { contains: term, mode: 'insensitive' } } }
		}

		// ---------------------------------------------------------
		// CASO 2: Colon Notation (Listas) (ex: tags:nome)
		// ---------------------------------------------------------
		else if (field.includes(':')) {
			const [fieldList, fieldCheck] = field.split(':')
			const fieldListInfo = table.fields.find(f => f.name === fieldList)

			// Se não é campo da tabela, tenta ver se é campo direto mascarado
			if (!fieldListInfo) {
				const directField = table.fields.find(f => f.name === fieldCheck)
				if (directField) {
					if (isUuid) return { [fieldCheck]: term }

					if (checkFields.includes(directField.type)) {
						if (directField.type === 'DateTime') {
							const { inicioUTC, fimUTC } = intervaloDoDiaBrasilia(term)
							return { [fieldCheck]: { gte: inicioUTC, lte: fimUTC } }
						}
						return { [fieldCheck]: isNumericTerm ? Number(term) : term }
					}
					return { [fieldCheck]: { contains: term, mode: 'insensitive' } }
				}
			}

			// Verifica se é lista real
			if (fieldListInfo?.isList) {
				const checkFieldType = table.allModels?.[
					fieldListInfo.type
				]?.fields.find(f => f.name === fieldCheck)?.type

				if (checkFields.includes(checkFieldType) || isUuid) {
					if (isUuid) {
						return { [fieldList]: { some: { [fieldCheck]: term } } }
					}
					if (checkFieldType === 'DateTime') {
						const { inicioUTC, fimUTC } = intervaloDoDiaBrasilia(term)
						return {
							[fieldList]: {
								some: { [fieldCheck]: { gte: inicioUTC, lte: fimUTC } }
							}
						}
					}
					return {
						[fieldList]: {
							some: { [fieldCheck]: isNumericTerm ? Number(term) : term }
						}
					}
				}
				return {
					[fieldList]: {
						some: { [fieldCheck]: { contains: term, mode: 'insensitive' } }
					}
				}
			}

			// Fallback para campo simples que usou notação de dois pontos
			let fieldType = table.fields.find(f => f.name === fieldList)
			if (fieldType?.isList) {
				fieldType = table.allModels?.[fieldListInfo?.type]?.fields.find(
					f => f.name === fieldCheck
				)?.type
			}
			if (checkFields.includes(fieldType) || isUuid) {
				if (isUuid) {
					return { [fieldList]: { some: { [fieldCheck]: term } } }
				}
				if (fieldType === 'DateTime') {
					const { inicioUTC, fimUTC } = intervaloDoDiaBrasilia(term)
					return {
						[fieldList]: {
							some: { [fieldCheck]: { gte: inicioUTC, lte: fimUTC } }
						}
					}
				}
				return {
					[fieldList]: {
						some: { [fieldCheck]: isNumericTerm ? Number(term) : term }
					}
				}
			}
			return {
				[fieldList]: {
					some: { [fieldCheck]: { contains: term, mode: 'insensitive' } }
				}
			}
		}

		// ---------------------------------------------------------
		// CASO 3: Campo Simples (ex: nome, id, status)
		// ---------------------------------------------------------
		const fieldType = table.fields.find(f => f.name === field)?.type

		if (isUuid) {
			return { [field]: term }
		}

		if (checkFields.includes(fieldType)) {
			if (fieldType === 'DateTime') {
				const { inicioUTC, fimUTC } = intervaloDoDiaBrasilia(term)
				return { [field]: { gte: inicioUTC, lte: fimUTC } }
			}
			return { [field]: isNumericTerm ? Number(term) : term }
		}
		return { [field]: { contains: term, mode: 'insensitive' } }
	}
	//#endregion

	const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

	return {
		createRouteGroup,
		validationParse,
		parseValues,
		mappingFields,
		convertMetadado,
		capitalizeFirstLetter,
		ajustarFusoHorario,
		adjustTimezone,
		delay
	}
}

const utils = useUtils()

export { useUtils, utils }
export const {
	createRouteGroup,
	validationParse,
	parseValues,
	mappingFields,
	convertMetadado,
	capitalizeFirstLetter,
	ajustarFusoHorario,
	adjustTimezone,
	delay
} = utils

export default useUtils
