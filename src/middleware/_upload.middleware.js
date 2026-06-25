import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import { settings } from 'src/config'

const { DOC_PATH, DOC_SIZE } = settings

const storage = {
	local: multer.diskStorage({
		destination: (req, file, cb) => cb(null, DOC_PATH),
		filename: (req, file, cb) => {
			const timestamp = new Date().getTime()
			const ext = file.originalname.split('.').pop()
			const key = `${timestamp}_${uuidv4()}.${ext.toLocaleLowerCase()}`
			file.key = key
			cb(null, file.key)
		}
	})
}

const config = {
	dest: DOC_PATH,
	storage: storage['local'],
	limits: { fileSize: DOC_SIZE },
	fileFilter: (req, file, cb) => {
		const allowedMimes = ['application/pdf']
		if (allowedMimes.includes(file.mimetype)) cb(null, true)
		else cb(new Error(['Tipo de documento inválido.']))
	}
}

const upload = multer(config)

export { upload }
