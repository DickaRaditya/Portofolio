import assert from 'node:assert/strict'
import { test } from 'node:test'
import { S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createFilesHandler } from '../server/files-handler.js'
import { MAX_FILE_BYTES } from '../shared/file-policy.js'

const path = 'portfolio/projects/test/upload/report.pdf'
function fixture(overrides = {}, sign) {
  const calls = []
  const attachment = { path, name: 'report.pdf', type: 'application/pdf', size: 100, provider: 'r2' }
  const record = { published: true, attachments: [attachment], attachment_paths: [path], ...overrides }
  const handler = createFilesHandler(() => ({
    adminUid: 'admin', bucket: 'private',
    auth: { verifyIdToken: async (token, revoked) => {
      assert.equal(revoked, true)
      if (token === 'expired') throw new Error('expired')
      return { uid: token }
    } },
    db: { collection: kind => ({ doc: id => ({ get: async () => {
      calls.push({ read: `${kind}/${id}` })
      return { exists: true, data: () => record }
    } }) }) },
    s3: { send: async command => { calls.push(command); return { ContentLength: 100, ContentType: 'application/pdf' } } },
  }), sign || (async (_, command, options) => { calls.push({ command, options }); return 'https://r2.example/signed' }))
  async function request(body, token, method = 'POST', contentType = 'application/json') {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v }, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
    await handler({ method, body, headers: { 'content-type': contentType, ...(token ? { authorization: `Bearer ${token}` } : {}) } }, res)
    return res
  }
  return { request, calls, record }
}

test('anonymous, non-admin, expired tokens cannot upload or delete', async () => {
  for (const token of [undefined, 'other', 'expired']) for (const action of ['upload', 'delete']) {
    const { request, calls } = fixture()
    assert.equal((await request({ action, path, kind: 'projects', id: 'test', name: 'report.pdf', size: 100 }, token)).code, token === 'expired' ? 401 : 403)
    assert.equal(calls.length, 0)
  }
})

test('rejects invalid destinations, paths, formats, and sizes on the server', async () => {
  const { request } = fixture()
  const body = { action: 'upload', kind: 'projects', id: 'test', name: 'report.pdf', size: 100 }
  for (const change of [{ kind: 'users' }, { id: '../test' }, { size: MAX_FILE_BYTES + 1 }, { size: 0 }, { size: '100' }, { name: 'page.html' }, { name: 'app.exe' }, { name: 'a.constructor' }, { name: 'a.__proto__' }]) {
    assert.equal((await request({ ...body, ...change }, 'admin')).code, 400)
  }
  for (const path of ['elsewhere/file.pdf', 'portfolio/projects/test/../file.pdf', 'portfolio/projects/test/id/a/b.pdf']) {
    assert.equal((await request({ action: 'delete', path }, 'admin')).code, 400)
  }
})

test('upload signatures enforce size, type, private cache metadata, and unique keys', async () => {
  const { request, calls } = fixture()
  const body = { action: 'upload', kind: 'projects', id: 'test', name: 'My report.doc', size: 100 }
  const first = await request(body, 'admin')
  const second = await request(body, 'admin')
  assert.equal(first.code, 200)
  assert.notEqual(first.body.attachment.path, second.body.attachment.path)
  assert.equal(first.body.attachment.provider, 'r2')
  assert.equal(first.body.attachment.type, 'application/msword')
  assert.equal(calls[0].command.input.ContentLength, 100)
  assert.equal(calls[0].command.input.CacheControl, 'private, no-store, max-age=0')
  assert.ok(calls[0].options.signableHeaders.has('content-length'))
})

test('actual AWS presigner binds content-length and content-type without network access', async () => {
  const s3 = new S3Client({ region: 'auto', endpoint: 'https://test.r2.cloudflarestorage.com', credentials: { accessKeyId: 'test', secretAccessKey: 'test' }, requestChecksumCalculation: 'WHEN_REQUIRED' })
  const { request } = fixture({}, (_, command, options) => getSignedUrl(s3, command, options))
  const result = await request({ action: 'upload', kind: 'projects', id: 'test', name: 'a.pdf', size: 100 }, 'admin')
  const signed = new URL(result.body.url).searchParams.get('X-Amz-SignedHeaders').split(';')
  for (const header of ['content-length', 'content-type', 'cache-control', 'content-disposition']) assert.ok(signed.includes(header), header)
  s3.destroy()
})

test('published attached files download anonymously with a 60 second non-cacheable URL', async () => {
  const { request, calls } = fixture()
  const result = await request({ action: 'download', path })
  assert.equal(result.code, 200)
  assert.equal(result.headers['Cache-Control'], 'private, no-store')
  assert.equal(calls.at(-1).options.expiresIn, 60)
  assert.equal(calls.at(-1).command.input.ResponseCacheControl, 'private, no-store, max-age=0')
})

test('drafts, removed attachments, and legacy provider references cannot produce public R2 URLs', async () => {
  for (const record of [{ published: false }, { attachments: [] }, { attachment_paths: [] }, { attachments: [{ path }] }]) {
    const { request, calls } = fixture(record)
    const result = await request({ action: 'download', path, published: true })
    assert.equal(result.code, 404)
    assert.equal(calls.length, 1)
  }
})

test('admin can download attached drafts; mismatched objects are rejected', async () => {
  assert.equal((await fixture({ published: false }).request({ action: 'download', path }, 'admin')).code, 200)
  assert.equal((await fixture({ attachments: [{ path, provider: 'r2', size: 200, type: 'application/pdf' }] }).request({ action: 'download', path })).code, 409)
})

test('admin deletion supports cleanup before a parent exists or after deletion', async () => {
  const { request, calls } = fixture()
  assert.equal((await request({ action: 'delete', path }, 'admin')).code, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].constructor.name, 'DeleteObjectCommand')
})

test('rejects unsupported methods, malformed JSON and form posts', async () => {
  const { request } = fixture()
  assert.equal((await request({}, undefined, 'GET')).code, 405)
  assert.equal((await request('{', 'admin')).code, 400)
  assert.equal((await request({}, 'admin', 'POST', 'text/plain')).code, 415)
})
