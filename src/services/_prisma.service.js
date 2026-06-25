import { PrismaPg } from '@prisma/adapter-pg'
import { useUtils } from 'src/helpers'
import { Prisma, PrismaClient } from '../../prisma/generated/prisma/client'

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL ?? ''
})
const { parseValues, adjustTimezone } = useUtils()

let prisma = new PrismaClient({ adapter })

const middleware = async params => {
	const { model, args } = params
	if (model && (args.where || args.data || args.create || args.update)) {
		const dbInfo = prisma[model]?.getDatabase?.()
		if (!dbInfo) return params

		const { fields, allModels } = dbInfo
		const { where, data, create, update } = args
		if (where && Object.keys(where).length)
			params.args.where = parseValues(fields, where, allModels)
		if (data && Object.keys(data).length)
			params.args.data = parseValues(fields, data, allModels)
		if (create && Object.keys(create).length)
			params.args.create = parseValues(fields, create, allModels)
		if (update && Object.keys(update).length)
			params.args.update = parseValues(fields, update, allModels)
	}
	return params
}

// Apply extensions with safer error handling
prisma = prisma.$extends({
	model: {
		$allModels: {
			getDatabase() {
				try {
					const context = Prisma.getExtensionContext(this)
					const allModels = context.$parent._runtimeDataModel.models
					const { dbName, ...rest } = allModels[context.$name]
					return { name: dbName, allModels, ...rest }
				} catch (_error) {
					console.warn(`Warning: getDatabase() not available for this model`)
					return null
				}
			},
			async truncate() {
				const context = Prisma.getExtensionContext(this)
				const database = context.getDatabase()
				if (!database) throw new Error('Database info not available')
				const query = `TRUNCATE TABLE ${database.name}`
				await prisma.$executeRaw(Prisma.raw(query))
				return 0
			}
		}
	},
	query: {
		$allModels: {
			async $allOperations({ query, ...params }) {
				const { model, args } = await middleware(params)
				const result = await query(args)
				const dbInfo = prisma[model]?.getDatabase?.()
				if (dbInfo) {
					const { fields } = dbInfo
					adjustTimezone(result, fields)
				}
				return result
			}
		}
	}
})

export { prisma }
export default prisma
