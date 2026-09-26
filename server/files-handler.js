import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { contentType, MAX_FILE_BYTES, parseAttachmentPath, safeFilename, validDestination, validateAttachments } from '../shared/file-policy.js'

const fail = (status, message) => Object.assign(new Error(message), { status })

// Dependency injection keeps authorization and storage behavior testable offline.
export function createFilesHandler(getServices, sign = getSignedUrl) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method not allowed.' })
    }
    try {
      if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Use application/json.')
      let body
      try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body } catch { throw fail(400, 'Invalid JSON.') }
      if (!body || !['upload', 'download', 'delete'].includes(body.action)) throw fail(400, 'Invalid file action.')
      const { auth, db, s3, bucket, adminUid } = getServices()
      let admin = false
      if (req.headers.authorization) {
        const match = /^Bearer (\S+)$/.exec(req.headers.authorization)
        if (!match) throw fail(401, 'Sign in again to access files.')
        try { admin = (await auth.verifyIdToken(match[1], true)).uid === adminUid }
        catch { throw fail(401, 'Sign in again to access files.') }
      }
      if (body.action !== 'download' && !admin) throw fail(403, 'Admin access required.')

      if (body.action === 'upload') {
        if (!validDestination(body.kind, body.id)) throw fail(400, 'Invalid upload destination.')
        try { validateAttachments([{ name: body.name, size: body.size }]) } catch (error) { throw fail(400, error.message) }
        const name = safeFilename(body.name)
        const path = `portfolio/${body.kind}/${body.id}/${randomUUID()}/${name}`
        const type = contentType(body.name)
        const headers = {
          'Content-Type': type,
          'Cache-Control': 'private, no-store, max-age=0',
          'Content-Disposition': `attachment; filename="${name}"`,
        }
        const url = await sign(s3, new PutObjectCommand({
          Bucket: bucket, Key: path, ContentLength: body.size, ContentType: type,
          CacheControl: headers['Cache-Control'], ContentDisposition: headers['Content-Disposition'],
        }), { expiresIn: 300, signableHeaders: new Set(['content-type', 'content-length', 'cache-control', 'content-disposition']) })
        return res.status(200).json({ url, headers, attachment: { provider: 'r2', path, name: body.name, size: body.size, type } })
      }

      const location = parseAttachmentPath(body.path)
      if (!location) throw fail(400, 'Invalid file path.')
      if (body.action === 'delete') {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: body.path }))
        return res.status(200).json({ deleted: true })
      }
      // Do not trust a caller's published flag or its attachment metadata.
      const snapshot = await db.collection(location.kind).doc(location.id).get()
      const record = snapshot.data()
      const attachment = record?.attachments?.find(file => file.path === body.path && file.provider === 'r2')
      if (!snapshot.exists || !attachment || !record.attachment_paths?.includes(body.path)
        || (!admin && record.published !== true)) throw fail(404, 'File not found or not published.')
      const object = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: body.path }))
      if (!Number.isSafeInteger(object.ContentLength) || object.ContentLength <= 0
        || object.ContentLength > MAX_FILE_BYTES || object.ContentLength !== attachment.size
        || object.ContentType !== attachment.type) throw fail(409, 'File metadata does not match. Please upload the file again.')
      const url = await sign(s3, new GetObjectCommand({
        Bucket: bucket, Key: body.path,
        ResponseContentDisposition: `inline; filename="${safeFilename(attachment.name)}"`,
        ResponseCacheControl: 'private, no-store, max-age=0',
      }), { expiresIn: 60 })
      return res.status(200).json({ url })
    } catch (error) {
      const missing = error.name === 'NotFound' || error.name === 'NoSuchKey'
      const status = error.status || (missing ? 404 : 503)
      // Never return credentials, signed URLs, or raw SDK errors to the client.
      if (status === 503) console.error('File service unavailable:', error.name || 'Error')
      return res.status(status).json({ error: status === 503
        ? 'File service is not ready. Check the server configuration and R2 setup.'
        : missing ? 'File not found.' : error.message })
    }
  }
}
