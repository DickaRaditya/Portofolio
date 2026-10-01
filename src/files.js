import { deleteObject, getBlob, ref } from 'firebase/storage'
import { auth, isAdmin, storage, storageEnabled } from './firebase.js'
import { MAX_FILE_BYTES, validateAttachments, validateProfilePhoto } from '../shared/file-policy.js'
export { MAX_FILE_BYTES, MAX_FILES, FILE_ACCEPT, validateAttachments } from '../shared/file-policy.js'

export const fileSize = size => size < 1024 * 1024
  ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`

async function fileRequest(body) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth?.currentUser) headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`
  const response = await fetch('/api/files', { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' })
  let result
  try { result = await response.json() } catch { throw new Error('File API unavailable. Use Vercel or npm run dev:full for uploads.') }
  if (!response.ok) throw new Error(result.error || 'File operation failed.')
  return result
}

function putFile(url, headers, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.timeout = 300000
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value)
    // The browser supplies Content-Length from the Blob; it is bound by the signature.
    request.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)) }
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve() : reject(new Error('Upload failed. Check R2 CORS settings and retry.'))
    request.onerror = () => reject(new Error('Upload failed. Check your connection and R2 CORS settings.'))
    request.ontimeout = () => reject(new Error('Upload timed out. Please retry.'))
    request.send(file)
  })
}

export async function uploadAttachment(kind, id, file, onProgress = () => {}) {
  if (!isAdmin(auth?.currentUser)) throw new Error('Admin access required to upload files.')
  if (!storageEnabled) throw new Error('File uploads are not configured yet. You can still use a public link.')
  if (kind === 'profile') validateProfilePhoto(file)
  else validateAttachments([file])
  const { url, headers, attachment } = await fileRequest({ action: 'upload', kind, id, name: file.name, size: file.size })
  try {
    await putFile(url, headers, file, onProgress)
    return attachment
  } catch (error) {
    // A lost response can happen after R2 has stored the object.
    if ((await removeAttachments([attachment])).length) error.message += ' An unattached file may need cleanup in R2.'
    throw error
  }
}

export async function removeAttachments(attachments) {
  if (!attachments.length) return []
  if (!isAdmin(auth?.currentUser)) return attachments.map(file => file.path)
  const results = await Promise.allSettled(attachments.map(async file => {
    if (file.provider === 'r2') return fileRequest({ action: 'delete', path: file.path })
    if (file.provider && file.provider !== 'firebase') throw new Error('Unknown file provider.')
    if (!storage) throw new Error('Legacy Firebase storage is not configured.')
    try { await deleteObject(ref(storage, file.path)) }
    catch (error) { if (error.code !== 'storage/object-not-found') throw error }
  }))
  return attachments.filter((_, index) => results[index].status === 'rejected').map(file => file.path)
}

export async function downloadAttachment(file) {
  if (file.provider === 'r2') {
    const { url } = await fileRequest({ action: 'download', path: file.path })
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error('Download failed. Please retry.')
    const blob = await response.blob()
    if (blob.size > MAX_FILE_BYTES || blob.size !== file.size) throw new Error('File size does not match. Please refresh and retry.')
    return blob
  }
  if (file.provider && file.provider !== 'firebase') throw new Error('Unknown file provider.')
  if (!storage) throw new Error('Legacy Firebase storage is not configured.')
  return getBlob(ref(storage, file.path), MAX_FILE_BYTES)
}

export async function getAttachmentUrl(file) {
  if (file.provider !== 'r2') return null
  const { url } = await fileRequest({ action: 'download', path: file.path })
  return url
}
