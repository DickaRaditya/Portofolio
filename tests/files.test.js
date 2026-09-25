import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

const auth = { currentUser: null }
let metadata
mock.module('../src/firebase.js', { namedExports: { auth, storage: {}, isAdmin: user => user?.uid === 'admin' } })
mock.module('firebase/storage', { namedExports: {
  ref: (_, path) => path,
  deleteObject: async () => {},
  getBlob: async (path, limit) => ({ path, limit }),
  uploadBytesResumable: (path, file, config) => {
    metadata = config
    return { on: (_, progress, reject, resolve) => { progress({ bytesTransferred: file.size, totalBytes: file.size }); resolve() } }
  },
} })
const { MAX_FILE_BYTES, validateAttachments, uploadAttachment, downloadAttachment } = await import('../src/files.js')

test('rejects empty, oversized, executable, HTML, and excess files', () => {
  for (const file of [{ name: 'empty.pdf', size: 0 }, { name: 'huge.zip', size: MAX_FILE_BYTES + 1 }, { name: 'app.exe', size: 1 }, { name: 'page.html', size: 1 }]) {
    assert.throws(() => validateAttachments([file]))
  }
  assert.throws(() => validateAttachments(Array(6).fill({ name: 'valid.pdf', size: 100 })))
  assert.doesNotThrow(() => validateAttachments([{ name: 'REPORT.PDF', size: MAX_FILE_BYTES }]))
})

test('uploads are admin-only, unique, and use non-cacheable attachment metadata', async () => {
  auth.currentUser = { uid: 'other' }
  await assert.rejects(() => uploadAttachment('projects', 'test', { name: 'test.pdf', size: 100 }), /Admin access/)
  auth.currentUser = { uid: 'admin' }
  const file = { name: 'My report.pdf', size: 100 }
  const first = await uploadAttachment('projects', 'test', file)
  const second = await uploadAttachment('projects', 'test', file)
  assert.notEqual(first.path, second.path)
  assert.ok(first.path.startsWith('portfolio/projects/test/'))
  assert.ok(first.path.endsWith('/My_report.pdf'))
  assert.equal(metadata.contentType, 'application/pdf')
  assert.equal(metadata.cacheControl, 'private, no-store, max-age=0')
  assert.ok(metadata.contentDisposition.startsWith('attachment;'))
})

test('downloads use rule-checked blob reads with a size limit', async () => {
  const result = await downloadAttachment({ path: 'portfolio/certificates/test/file/cert.pdf' })
  assert.equal(result.limit, MAX_FILE_BYTES)
  assert.equal(result.path, 'portfolio/certificates/test/file/cert.pdf')
})
