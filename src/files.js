import { deleteObject, getBlob, ref, uploadBytesResumable } from 'firebase/storage'
import { auth, isAdmin, storage, storageEnabled } from './firebase.js'

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const MAX_FILES = 5
const types = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', txt: 'text/plain', md: 'text/plain', csv: 'text/csv',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
export const FILE_ACCEPT = Object.keys(types).map(extension => `.${extension}`).join(',')
export const fileSize = size => size < 1024 * 1024
  ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`

export function validateAttachments(files, existingCount = 0) {
  if (files.length + existingCount > MAX_FILES) throw new Error(`Choose up to ${MAX_FILES} files per item.`)
  for (const file of files) {
    if (!file.size) throw new Error(`${file.name} is empty.`)
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 10 MB file limit.`)
    if (!types[file.name.split('.').pop().toLowerCase()]) {
      throw new Error(`${file.name}: use PDF, PNG, JPG, WebP, TXT, MD, CSV, ZIP, DOCX, PPTX, or XLSX.`)
    }
  }
}

export async function uploadAttachment(kind, id, file, onProgress = () => {}) {
  if (!storageEnabled) throw new Error('This Spark deployment is link-only. Paste a public URL instead of uploading a file.')
  if (!storage || !isAdmin(auth?.currentUser)) throw new Error('Admin access required to upload files.')
  if (!['projects', 'certificates'].includes(kind) || !id || id.includes('/')) throw new Error('Invalid upload destination.')
  validateAttachments([file])
  const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-160) || 'attachment'
  const path = `portfolio/${kind}/${id}/${crypto.randomUUID()}/${name}`
  const contentType = types[file.name.split('.').pop().toLowerCase()]
  const upload = uploadBytesResumable(ref(storage, path), file, {
    contentType, cacheControl: 'private, no-store, max-age=0',
    contentDisposition: `attachment; filename="${name}"`,
  })
  await new Promise((resolve, reject) => upload.on('state_changed',
    snapshot => onProgress(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)), reject, resolve))
  return { path, name: file.name, size: file.size, type: contentType }
}

export async function removeAttachments(attachments) {
  if (!attachments.length) return []
  if (!storage || !isAdmin(auth?.currentUser)) return attachments.map(file => file.path)
  const results = await Promise.allSettled(attachments.map(async file => {
    try { await deleteObject(ref(storage, file.path)) }
    catch (error) { if (error.code !== 'storage/object-not-found') throw error }
  }))
  return attachments.filter((_, index) => results[index].status === 'rejected').map(file => file.path)
}

export async function downloadAttachment(file) {
  if (!storage) throw new Error('File storage is not configured.')
  // SDK reads enforce Storage rules every time. Do not persist public token URLs:
  // those would keep working after a record is unpublished.
  return getBlob(ref(storage, file.path), MAX_FILE_BYTES)
}
