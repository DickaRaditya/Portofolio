import { services } from '../server/services.js'
import { createFilesHandler } from '../server/files-handler.js'

export default createFilesHandler(services)
