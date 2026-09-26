import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { S3Client } from '@aws-sdk/client-s3'

export function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}
export function firebaseAdminApp() {
  const existing = getApps().find(app => app.name === 'portfolio-server')
  return existing || initializeApp({
    credential: cert({
      projectId: requiredEnv('FIREBASE_PROJECT_ID'),
      clientEmail: requiredEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: requiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
  }, 'portfolio-server')
}
let client
export function r2Client() {
  const account = requiredEnv('R2_ACCOUNT_ID')
  if (!/^[a-f0-9]{32}$/i.test(account)) throw new Error('Invalid R2_ACCOUNT_ID')
  const jurisdiction = process.env.R2_JURISDICTION?.trim() || 'default'
  if (!['default', 'eu', 'us', 'fedramp'].includes(jurisdiction)) throw new Error('Invalid R2_JURISDICTION')
  const suffix = jurisdiction === 'default' ? '' : `.${jurisdiction}`
  return client ||= new S3Client({
    region: 'auto', endpoint: `https://${account}${suffix}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'), secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY') },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  })
}
export function services() {
  const app = firebaseAdminApp()
  return {
    auth: getAuth(app), db: getFirestore(app), s3: r2Client(),
    bucket: requiredEnv('R2_BUCKET_NAME'), adminUid: requiredEnv('FIREBASE_ADMIN_UID'),
  }
}
