import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const adminUid = import.meta.env.VITE_FIREBASE_ADMIN_UID?.trim() || ''
// Enable only after the private R2 bucket and server credentials are configured.
export const storageEnabled = import.meta.env.VITE_R2_ENABLE_UPLOADS === 'true'
export const isConfigured = Object.values(config).every(value => value?.trim())
  && !!adminUid && adminUid !== 'REPLACE_WITH_ADMIN_UID'
const firebaseApp = isConfigured ? initializeApp(config) : null
export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const db = firebaseApp ? getFirestore(firebaseApp) : null
// Keep existing link-only deployments working until Storage is enabled.
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim()
  || (config.projectId ? `${config.projectId}.firebasestorage.app` : '')
export const storage = firebaseApp ? getStorage(firebaseApp, `gs://${storageBucket}`) : null
export const isAdmin = user => !!user && !!adminUid && user.uid === adminUid
