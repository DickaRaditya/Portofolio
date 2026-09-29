import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'

const auth = { currentUser: null }
let failPut = false
let failDelete = false
const requests = []
mock.module('../src/firebase.js', { namedExports: { auth, storage: {}, storageEnabled: true, isAdmin: user => user?.uid === 'admin' } })
mock.module('firebase/storage', { namedExports: {
  ref: (_, path) => path,
  deleteObject: async path => { requests.push({ legacyDelete: path }) },
  getBlob: async (path, limit) => ({ path, limit }),
} })
const { MAX_FILE_BYTES, validateAttachments, uploadAttachment, downloadAttachment, removeAttachments } = await import('../src/files.js')

beforeEach(() => {
  auth.currentUser = null; failPut = false; failDelete = false; requests.length = 0
  mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options })
    if (url !== '/api/files') return { ok: true, blob: async () => new Blob(['pdf']) }
    const body = JSON.parse(options.body)
    if (body.action === 'delete') return { ok: !failDelete, json: async () => ({ error: 'cleanup failed' }) }
    if (body.action === 'download') return { ok: true, json: async () => ({ url: 'https://r2.example/download' }) }
    return { ok: true, json: async () => ({ url: 'https://r2.example/upload', headers: { 'Content-Type': 'application/pdf' }, attachment: { path: `portfolio/${body.kind}/${body.id}/uuid/report.pdf`, name: body.name, size: body.size, type: 'application/pdf', provider: 'r2' } }) }
  })
  globalThis.XMLHttpRequest = class {
    upload = {}
    open(method, url) { requests.push({ method, url }) }
    setRequestHeader() {}
    send(file) { this.upload.onprogress({ lengthComputable: true, loaded: file.size, total: file.size }); this.status = failPut ? 403 : 200; this.onload() }
  }
})
const admin = () => { auth.currentUser = { uid: 'admin', getIdToken: async () => 'verified-token' } }

test('rejects empty, oversized, executable, HTML, and excess files; accepts DOC and DOCX', () => {
  for (const file of [{ name: 'empty.pdf', size: 0 }, { name: 'huge.zip', size: MAX_FILE_BYTES + 1 }, { name: 'app.exe', size: 1 }, { name: 'page.html', size: 1 }]) assert.throws(() => validateAttachments([file]))
  assert.throws(() => validateAttachments(Array(6).fill({ name: 'valid.pdf', size: 100 })))
  for (const name of ['REPORT.PDF', 'report.doc', 'report.docx']) assert.doesNotThrow(() => validateAttachments([{ name, size: MAX_FILE_BYTES }]))
})

test('uploads require admin, use Firebase bearer tokens, and report R2 progress', async () => {
  auth.currentUser = { uid: 'other' }
  await assert.rejects(() => uploadAttachment('projects', 'test', { name: 'test.pdf', size: 100 }), /Admin access/)
  admin()
  const progress = []
  const result = await uploadAttachment('projects', 'test', { name: 'report.pdf', size: 100 }, value => progress.push(value))
  assert.equal(result.provider, 'r2')
  assert.equal(requests[0].options.headers.Authorization, 'Bearer verified-token')
  assert.deepEqual(progress, [100])
})

test('failed transfer cleans the allocated R2 key and reports failed cleanup', async () => {
  admin(); failPut = true
  await assert.rejects(() => uploadAttachment('projects', 'test', { name: 'report.pdf', size: 100 }), /Upload failed/)
  assert.equal(JSON.parse(requests.at(-1).options.body).action, 'delete')
  failDelete = true
  await assert.rejects(() => uploadAttachment('projects', 'test', { name: 'report.pdf', size: 100 }), /cleanup in R2/)
})

test('legacy downloads still use Firebase rules and R2 downloads request fresh authorization', async () => {
  const legacy = await downloadAttachment({ path: 'portfolio/certificates/test/file/cert.pdf' })
  assert.equal(legacy.limit, MAX_FILE_BYTES)
  const blob = await downloadAttachment({ path: 'portfolio/projects/test/upload/a.pdf', provider: 'r2', size: 3 })
  assert.equal(blob.size, 3)
  assert.equal(JSON.parse(requests[0].options.body).action, 'download')
  assert.equal(requests[0].options.headers.Authorization, undefined)
})

test('mixed-provider deletion uses the correct storage and reports failures', async () => {
  admin(); failDelete = true
  const failures = await removeAttachments([{ path: 'legacy' }, { path: 'r2', provider: 'r2' }])
  assert.deepEqual(failures, ['r2'])
  assert.ok(requests.some(x => x.legacyDelete === 'legacy'))
})
