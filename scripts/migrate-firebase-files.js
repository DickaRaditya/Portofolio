import { mkdir, writeFile } from 'node:fs/promises'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { firebaseAdminApp, r2Client, requiredEnv } from '../server/services.js'
import { copyAttachment } from '../server/migrate-attachment.js'
import { parseAttachmentPath, validateAttachments } from '../shared/file-policy.js'

const args = process.argv.slice(2)
if (args.some(arg => !['--apply', '--help'].includes(arg))) throw new Error('Use --help or --apply; dry-run is the default.')
if (args.includes('--help')) {
  console.log('Preview: npm run migrate:files\nCopy, verify, and switch references: npm run migrate:files -- --apply\nRequires server credentials from .env.example. Never deletes Firebase originals.')
} else {
  const apply = args.includes('--apply')
  const app = firebaseAdminApp()
  const db = getFirestore(app)
  const snapshots = await Promise.all(['projects', 'certificates'].map(kind => db.collection(kind).get()))
  const records = snapshots.flatMap(snapshot => snapshot.docs).filter(doc =>
    (doc.data().attachments || []).some(file => !file.provider || file.provider === 'firebase'))
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${records.length} records with Firebase attachments.`)
  if (records.length) {
    const source = getStorage(app).bucket(requiredEnv('FIREBASE_STORAGE_BUCKET'))
    const references = new Set(snapshots.flatMap(s => s.docs).flatMap(doc => (doc.data().attachments || []).map(file => file.path)))
    const [objects] = await source.getFiles({ prefix: 'portfolio/' })
    console.log(`${objects.length} source objects; ${objects.filter(file => !references.has(file.name)).length} unreferenced objects left untouched.`)
    // Preflight every source before writing any destination object or metadata.
    for (const doc of records) for (const file of doc.data().attachments || []) {
      if (file.provider === 'r2') continue
      if (file.provider && file.provider !== 'firebase') throw new Error(`Unknown provider in ${doc.ref.path}`)
      const location = parseAttachmentPath(file.path)
      if (!location || `${location.kind}/${location.id}` !== doc.ref.path) throw new Error(`Invalid attachment path in ${doc.ref.path}`)
      validateAttachments([file])
      const [metadata] = await source.file(file.path).getMetadata()
      if (Number(metadata.size) !== file.size) throw new Error(`Source size mismatch: ${file.path}`)
      console.log(`  ${file.path} (${file.size} bytes)`)
    }
    if (apply) {
      const s3 = r2Client()
      const bucket = requiredEnv('R2_BUCKET_NAME')
      await mkdir('migration-backups', { recursive: true })
      const backup = `migration-backups/attachments-${Date.now()}.json`
      await writeFile(backup, JSON.stringify(records.map(doc => ({
        document: doc.ref.path, attachments: doc.data().attachments,
        attachment_paths: doc.data().attachment_paths || [],
      })), null, 2), { flag: 'wx' })
      console.log(`Original references saved to ${backup}`)
      for (const doc of records) {
        const attachments = []
        for (const file of doc.data().attachments || []) attachments.push(await copyAttachment(file, source, s3, bucket))
        // Concurrent dashboard edits cause a precondition failure instead of data loss.
        await doc.ref.update({ attachments, attachment_paths: attachments.map(file => file.path) }, { lastUpdateTime: doc.updateTime })
        console.log(`Migrated ${doc.ref.path}`)
      }
      console.log('Migration complete. Firebase originals have not been deleted.')
    } else console.log('No changes made. Review the inventory, then run with --apply to migrate.')
  } else console.log('No referenced Firebase files to migrate. External links are unchanged.')
}
