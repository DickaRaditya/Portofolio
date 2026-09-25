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
// Spark-plan deployments stay link-only. Set this to "true" only after
// Cloud Storage is enabled and its rules/CORS are configured.
export const storageEnabled = import.meta.env.VITE_FIREBASE_ENABLE_STORAGE === 'true'
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
