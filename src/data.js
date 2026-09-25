import {
  addDoc, collection, deleteDoc, doc, documentId, getDoc, getDocs,
  query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { auth, db, isAdmin } from './firebase.js'

const records = snapshot => snapshot.docs.map(item => ({ ...item.data(), id: item.id }))
const editableCollections = new Set(['projects', 'certificates'])

function requireAdmin() {
  if (!db || !isAdmin(auth?.currentUser)) throw new Error('Admin access required.')
}

function contentCollection(name) {
  if (!editableCollections.has(name)) throw new Error('Unknown collection.')
  return collection(db, name)
}

export async function loadPortfolio(admin = false) {
  if (admin) requireAdmin()
  // Public queries always include published=true, even for a signed-in admin.
  const source = name => admin
    ? collection(db, name)
    : query(collection(db, name), where('published', '==', true))
  const [profile, projects, certificates] = await Promise.all([
    admin
      ? getDoc(doc(db, 'profile', 'main'))
      : getDocs(query(collection(db, 'profile'), where(documentId(), '==', 'main'), where('published', '==', true))),
    getDocs(source('projects')),
    getDocs(source('certificates')),
  ])
  return {
    profile: admin ? (profile.exists() ? profile.data() : null) : (records(profile)[0] || null),
    // Sorting locally avoids composite indexes and includes imported legacy records.
    projects: records(projects).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.title.localeCompare(b.title)),
    certificates: records(certificates).sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0) || a.title.localeCompare(b.title)),
  }
}

export async function saveProfile(data) {
  requireAdmin()
  await setDoc(doc(db, 'profile', 'main'), { ...data, updated_at: serverTimestamp() })
}

export async function saveContent(name, id, data) {
  requireAdmin()
  const target = contentCollection(name)
  const content = { ...data, updated_at: serverTimestamp() }
  if (id) await updateDoc(doc(target, id), content)
  else await addDoc(target, { ...content, created_at: serverTimestamp() })
}

export async function deleteContent(name, id) {
  requireAdmin()
  await deleteDoc(doc(contentCollection(name), id))
}
