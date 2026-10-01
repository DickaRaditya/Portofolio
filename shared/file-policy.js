export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_FILES = 5
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const PHOTO_ACCEPT = '.png,.jpg,.jpeg,.webp'
const photoExtensions = new Set(PHOTO_ACCEPT.split(',').map(extension => extension.slice(1)))
const types = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', txt: 'text/plain', md: 'text/plain', csv: 'text/csv',
  zip: 'application/zip', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
export const FILE_ACCEPT = Object.keys(types).map(extension => `.${extension}`).join(',')
export const contentType = name => {
  const extension = String(name).split('.').pop().toLowerCase()
  return Object.hasOwn(types, extension) ? types[extension] : undefined
}
export const safeFilename = name => String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160) || 'attachment'
export function validateAttachments(files, existingCount = 0) {
  if (files.length + existingCount > MAX_FILES) throw new Error(`Choose up to ${MAX_FILES} files per item.`)
  for (const file of files) {
    if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error(`${file.name}: file size must be greater than zero.`)
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 10 MB file limit.`)
    if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 255 || !contentType(file.name)) {
      throw new Error('Use PDF, DOC, DOCX, PNG, JPG, WebP, TXT, MD, CSV, ZIP, PPTX, or XLSX.')
    }
  }
}
export function validateProfilePhoto(file) {
  if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 255
    || !file.name.includes('.') || !photoExtensions.has(file.name.split('.').pop().toLowerCase())) {
    throw new Error('Use PNG, JPG, JPEG, or WebP for the profile photo.')
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error(`${file.name}: file size must be greater than zero.`)
  if (file.size > MAX_PHOTO_BYTES) throw new Error(`${file.name} exceeds the 5 MB profile photo limit.`)
  if (file.type !== undefined && file.type !== '' && file.type !== contentType(file.name)) {
    throw new Error('Profile photo type must match its filename.')
  }
}
export function validDestination(kind, id) {
  if (kind === 'profile') return id === 'main'
  return ['projects', 'certificates'].includes(kind) && typeof id === 'string'
    && /^[A-Za-z0-9_-]{1,128}$/.test(id)
}
export function parseAttachmentPath(path) {
  if (typeof path !== 'string') return null
  const parts = path.split('/')
  if (parts.length !== 5 || parts[0] !== 'portfolio' || !validDestination(parts[1], parts[2])
    || !/^[A-Za-z0-9_-]{1,128}$/.test(parts[3])
    || !/^[A-Za-z0-9._-]{1,160}$/.test(parts[4]) || ['.', '..'].includes(parts[4])) return null
  return { kind: parts[1], id: parts[2] }
}
