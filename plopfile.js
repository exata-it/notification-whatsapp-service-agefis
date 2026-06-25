export default function (plop) {
	// Helpers customizados
	plop.setHelper('lowercase', (text) => text.toLowerCase())
	plop.setHelper('uppercase', (text) => text.toUpperCase())
	plop.setHelper('camelCase', (text) => {
		return text
			.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
				index === 0 ? word.toLowerCase() : word.toUpperCase()
			)
			.replace(/\s+/g, '')
	})
	plop.setHelper('pascalCase', (text) => {
		return text
			.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
			.replace(/\s+/g, '')
	})
	plop.setHelper('pluralize', (word) => {
		const irregulars = {
			user: 'users',
			role: 'roles',
			permission: 'permissions',
			category: 'categories',
			person: 'people',
			child: 'children',
			tooth: 'teeth',
			foot: 'feet',
			mouse: 'mice',
			goose: 'geese'
		}

		const lower = word.toLowerCase()
		if (irregulars[lower]) return irregulars[lower]

		// Regras gerais
		if (lower.endsWith('y')) return lower.slice(0, -1) + 'ies'
		if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z'))
			return lower + 'es'
		if (lower.endsWith('o')) return lower + 'es'
		return lower + 's'
	})

	// Gerador 1: CRUD Completo em Módulo
	plop.setGenerator('CRUD Completo', {
		description: 'Criar CRUD completo em um módulo com controller + route + schema + permissões',
		prompts: [
			{
				type: 'input',
				name: 'modelName',
				message: 'Nome do modelo Prisma (PascalCase, ex: Post, Article):',
				validate: (value) => {
					if (!value) return 'Nome do modelo é obrigatório'
					if (!/^[A-Z]/.test(value))
						return 'Deve começar com letra maiúscula'
					return true
				}
			},
			{
				type: 'input',
				name: 'moduleName',
				message: 'Nome do módulo/pasta (minúsculas, ex: vendas, produtos):',
				validate: (value) => {
					if (!value) return 'Nome do módulo é obrigatório'
					if (!/^[a-z]/.test(value))
						return 'Deve ser minúsculas'
					return true
				}
			},
			{
				type: 'input',
				name: 'resourceName',
				message: 'Nome do recurso em português (ex: produtos, vendas):'
			},
			{
				type: 'confirm',
				name: 'addPermissions',
				message: 'Adicionar permissões ao seed?',
				default: true
			}
		],
		actions: (data) => {
			// Calcular variáveis derivadas
			const modelLower = data.modelName.toLowerCase()
			const modelCamel = plop.getHelper('camelCase')(data.modelName)
			const modelPlural = plop.getHelper('pluralize')(data.modelName)
			const modelUpper = data.modelName.toUpperCase()
			
			// Processar moduleName para remover barras e criar nome de função válido
			// Se moduleName for "teste/cards", transforma em "testeCards"
			const moduleCamel = plop.getHelper('camelCase')(data.moduleName.replace(/\//g, ' '))
			
			// Extrair o último segmento do caminho para o nome do arquivo
			// Se moduleName for "teste/cards", o arquivo será "cards.controller.js"
			// Se moduleName for apenas "teste", o arquivo será "teste.controller.js"
			const moduleSegments = data.moduleName.split('/').filter(s => s)
			const fileName = moduleSegments[moduleSegments.length - 1]
			const folderPath = moduleSegments.length > 1 
				? moduleSegments.slice(0, -1).join('/') 
				: data.moduleName

			// Adicionar ao contexto dos templates
			const contextData = {
				...data,
				modelLower,
				modelCamel,
				modelPlural,
				modelUpper,
				moduleCamel
			}

			const actions = []

			// 1. Criar index.js do controller se não existir
			actions.push({
				type: 'add',
				path: `src/controllers/${folderPath}/index.js`,
				template: `// Controllers do módulo {{moduleName}}\n`,
				skipIfExists: true
			})

			// 2. Criar Controller no módulo
			actions.push({
				type: 'add',
				path: `src/controllers/${folderPath}/${fileName}.controller.js`,
				templateFile: 'plop-templates/controller.hbs',
				data: contextData,
				skipIfExists: true
			})

			// 3. Criar index.js da route se não existir
			actions.push({
				type: 'add',
				path: `src/routes/${folderPath}/index.js`,
				template: `// Routes do módulo {{moduleName}}\n`,
				skipIfExists: true
			})

			// 4. Criar Route no módulo (direto, sem pasta extra)
			actions.push({
				type: 'add',
				path: `src/routes/${folderPath}/${fileName}.route.js`,
				templateFile: 'plop-templates/route.hbs',
				data: contextData,
				skipIfExists: true
			})

			
			// 6. Atualizar index.js do controller
			actions.push({
				type: 'append',
				path: `src/controllers/${folderPath}/index.js`,
				template: `export { ${modelCamel}Controller } from './${fileName}.controller.js'\n`,
				skipIfExists: false
			})

			// 7. Atualizar index.js da route - adicionar import
			actions.push({
				type: 'append',
				path: `src/routes/${folderPath}/index.js`,
				template: `import { ${modelCamel}Routes } from './${fileName}.route.js'\n`,
				pattern: /^import/,
				skipIfExists: false
			})

			// 7b. Atualizar index.js da route - adicionar função export
			actions.push({
				type: 'append',
				path: `src/routes/${folderPath}/index.js`,
				template: `\nexport function ${moduleCamel}Routes(fastify) {\n\tfastify.register(${modelCamel}Routes, { prefix: '/${modelPlural}' })\n}\n`,
				skipIfExists: false
			})

			// 8. Adicionar permissões ao seed
			if (data.addPermissions) {
				actions.push({
					type: 'add',
					path: `prisma/permissions_${modelLower}.js`,
					templateFile: 'plop-templates/permissions.hbs',
					data: contextData,
					skipIfExists: true
				})

				actions.push({
					type: 'append',
					path: 'prisma/seed_admin.js',
					template: `import { ${modelUpper}_PERMISSIONS_EXPORT as ${modelUpper}_PERMISSIONS } from './permissions_${modelLower}.js'\n`,
					pattern: /^import bcrypt from 'bcrypt'/m,
					skipIfExists: false
				})

				actions.push({
					type: 'append',
					path: 'prisma/seed_admin.js',
					template: `\t...${modelUpper}_PERMISSIONS,\n`,
					pattern: /const PERMISSIONS = \[\n/,
					skipIfExists: false
				})
			}

			return actions
		}
	})

	// Gerador 2: Apenas Permissões
	plop.setGenerator('Adicionar Permissões', {
		description: 'Adicionar apenas permissões de um modelo ao seed',
		prompts: [
			{
				type: 'input',
				name: 'modelName',
				message: 'Nome do modelo Prisma (ex: Post):',
				validate: (value) => {
					if (!value) return 'Nome é obrigatório'
					if (!/^[A-Z]/.test(value))
						return 'Deve começar com letra maiúscula'
					return true
				}
			},
			{
				type: 'input',
				name: 'resourceName',
				message: 'Nome em português (ex: postagens):'
			}
		],
		actions: (data) => {
			const modelLower = data.modelName.toLowerCase()
			const modelUpper = data.modelName.toUpperCase()

			const contextData = { ...data, modelLower, modelUpper }

			return [
				{
					type: 'add',
					path: `prisma/permissions_${modelLower}.js`,
					templateFile: 'plop-templates/permissions.hbs',
					data: contextData,
					skipIfExists: true
				},
				{
					type: 'append',
					path: 'prisma/seed_admin.js',
					template: `import { ${modelUpper}_PERMISSIONS } from './permissions_${modelLower}.js'\n`,
					pattern: /^import/,
					skipIfExists: false
				},
				{
					type: 'append',
					path: 'prisma/seed_admin.js',
					template: `\t...${modelUpper}_PERMISSIONS,\n`,
					pattern: /const PERMISSIONS = \[/,
					skipIfExists: false
				},
				{
					type: 'summary'
				}
			]
		}
	})

	// Gerador 3: Apenas Controller
	plop.setGenerator('Apenas Controller', {
		description: 'Criar apenas um controller em um módulo existente',
		prompts: [
			{
				type: 'input',
				name: 'modelName',
				message: 'Nome do modelo (ex: Post):'
			},
			{
				type: 'input',
				name: 'moduleName',
				message: 'Nome do módulo/pasta (ex: vendas):'
			}
		],
		actions: (data) => {
			const modelLower = data.modelName.toLowerCase()
			const modelCamel = plop.getHelper('camelCase')(data.modelName)

			const contextData = { ...data, modelLower, modelCamel }

			return [
				{
					type: 'add',
					path: `src/controllers/${data.moduleName}/${modelLower}.controller.js`,
					templateFile: 'plop-templates/controller.hbs',
					data: contextData,
					skipIfExists: true
				},
				{
					type: 'append',
					path: `src/controllers/${data.moduleName}/index.js`,
					template: `export { ${modelCamel}Controller } from './${modelLower}.controller.js'\n`,
					skipIfExists: false
				},
				{
					type: 'summary'
				}
			]
		}
	})
}
