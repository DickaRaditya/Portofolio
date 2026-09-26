import { createVerify } from 'node:crypto'

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
let cachedCertificates = null
let certificatesExpireAt = 0

function decodePart(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
}

async function certificates() {
  if (cachedCertificates && Date.now() < certificatesExpireAt) return cachedCertificates
  const response = await fetch(CERT_URL)
  if (!response.ok) throw new Error('Firebase certificate service unavailable.')
  const cacheControl = response.headers.get('cache-control') || ''
  const maxAge = Number(/max-age=(\d+)/i.exec(cacheControl)?.[1] || 3600)
  cachedCertificates = await response.json()
  certificatesExpireAt = Date.now() + Math.max(60, Math.min(maxAge, 86400)) * 1000
  return cachedCertificates
}

export async function verifyFirebaseIdToken(token, projectId) {
  const parts = String(token).split('.')
  if (parts.length !== 3) throw new Error('Invalid Firebase ID token.')
  const header = decodePart(parts[0])
  const payload = decodePart(parts[1])
  const now = Math.floor(Date.now() / 1000)
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Invalid Firebase ID token.')
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`
    || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128
    || !Number.isInteger(payload.exp) || payload.exp <= now
    || !Number.isInteger(payload.iat) || payload.iat > now + 60) throw new Error('Invalid Firebase ID token.')
  const cert = (await certificates())[header.kid]
  if (!cert) {
    cachedCertificates = null
    certificatesExpireAt = 0
    throw new Error('Firebase signing key not found.')
  }
  const verifier = createVerify('RSA-SHA256')
  verifier.update(`${parts[0]}.${parts[1]}`)
  verifier.end()
  if (!verifier.verify(cert, Buffer.from(parts[2], 'base64url'))) throw new Error('Invalid Firebase ID token.')
  return payload
}
