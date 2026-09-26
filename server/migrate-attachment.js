import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { contentType, parseAttachmentPath, safeFilename, validateAttachments } from '../shared/file-policy.js'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export async function copyAttachment(file, sourceBucket, s3, destinationBucket) {
  if (file.provider === 'r2') return file
  if (file.provider && file.provider !== 'firebase') throw new Error('Unsupported source provider.')
  if (!parseAttachmentPath(file.path)) throw new Error('Unsupported source path.')
  validateAttachments([file])
  const source = sourceBucket.file(file.path)
  const [metadata] = await source.getMetadata()
  if (Number(metadata.size) !== file.size) throw new Error('Source size differs from Firestore. Review this attachment before migrating.')
  const [bytes] = await source.download({ validation: 'crc32c' })
  if (bytes.length !== file.size) throw new Error('Source download size mismatch.')
  const digest = hash(bytes)
  let existing
  try {
    existing = await s3.send(new GetObjectCommand({ Bucket: destinationBucket, Key: file.path }))
  } catch (error) {
    if (error.name !== 'NoSuchKey' && error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) throw error
  }
  if (existing) {
    if (existing.ContentLength !== bytes.length || hash(await existing.Body.transformToByteArray()) !== digest
      || existing.ContentType !== contentType(file.name)) throw new Error('Destination conflict; existing R2 object was not overwritten.')
  } else {
    await s3.send(new PutObjectCommand({
      Bucket: destinationBucket, Key: file.path, Body: bytes, ContentLength: bytes.length,
      ContentType: contentType(file.name), CacheControl: 'private, no-store, max-age=0',
      ContentDisposition: `attachment; filename="${safeFilename(file.name)}"`,
      Metadata: { sha256: digest }, IfNoneMatch: '*',
    }))
    const copied = await s3.send(new GetObjectCommand({ Bucket: destinationBucket, Key: file.path }))
    if (copied.ContentLength !== bytes.length || hash(await copied.Body.transformToByteArray()) !== digest) {
      throw new Error('R2 checksum verification failed; Firestore was not updated.')
    }
  }
  return { ...file, provider: 'r2', type: contentType(file.name) }
}
