import assert from 'node:assert/strict'
import { test } from 'node:test'
import { copyAttachment } from '../server/migrate-attachment.js'

const file = { path: 'portfolio/projects/test/upload/file.pdf', name: 'file.pdf', size: 3 }
const source = { file: () => ({ getMetadata: async () => [{ size: '3' }], download: async () => [Buffer.from('pdf')] }) }
const object = text => ({ ContentLength: 3, ContentType: 'application/pdf', Body: { transformToByteArray: async () => Buffer.from(text) } })

test('migration verifies downloaded R2 bytes and retains source paths', async () => {
  const operations = []
  const s3 = { send: async command => {
    operations.push(command)
    if (operations.length === 1) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
    return object('pdf')
  } }
  const result = await copyAttachment(file, source, s3, 'private')
  assert.equal(result.path, file.path)
  assert.equal(result.provider, 'r2')
  assert.deepEqual(operations.map(x => x.constructor.name), ['GetObjectCommand', 'PutObjectCommand', 'GetObjectCommand'])
  assert.equal(operations[1].input.IfNoneMatch, '*')
})

test('checksum mismatch aborts migration and does not return switched metadata', async () => {
  let count = 0
  const s3 = { send: async () => {
    if (++count === 1) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
    return object('bad')
  } }
  await assert.rejects(copyAttachment(file, source, s3, 'private'), /checksum/)
})

test('reruns reuse matching objects and never overwrite conflicting destinations', async () => {
  let count = 0
  const s3 = { send: async () => { count++; return object('pdf') } }
  assert.equal((await copyAttachment(file, source, s3, 'private')).provider, 'r2')
  assert.equal(count, 1)
  await assert.rejects(copyAttachment(file, source, { send: async () => object('bad') }, 'private'), /conflict/)
})
