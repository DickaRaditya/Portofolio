import {
  addDoc, collection, deleteDoc, doc, documentId, getDoc, getDocs,
  query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { auth, db, isAdmin } from './firebase.js'
import { removeAttachments, uploadAttachment, validateAttachments } from './files.js'

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

export async function saveContent(name, id, data, { files = [], removePaths = [], onProgress } = {}) {
  requireAdmin()
  const target = contentCollection(name)
  const content = { ...data, updated_at: serverTimestamp() }
  if (!files.length && !removePaths.length) {
    if (id) await updateDoc(doc(target, id), content)
    else await addDoc(target, { ...content, created_at: serverTimestamp() })
    return { cleanupFailed: [] }
  }
  const recordRef = id ? doc(target, id) : doc(target)
  const existing = id ? await getDoc(recordRef) : null
  if (id && !existing.exists()) throw new Error('This item was deleted. Refresh and create a new item.')
  const oldFiles = existing?.data()?.attachments || []
  const kept = oldFiles.filter(file => !removePaths.includes(file.path))
  validateAttachments(files, kept.length)
  const uploaded = []
  try {
    for (const [index, file] of files.entries()) {
      uploaded.push(await uploadAttachment(name, recordRef.id, file,
        percent => onProgress?.(`Uploading ${index + 1}/${files.length}: ${file.name} (${percent}%)`)))
    }
    const attachments = [...kept, ...uploaded]
    const next = { ...content, attachments, attachment_paths: attachments.map(file => file.path) }
    if (id) await updateDoc(recordRef, next)
    else await setDoc(recordRef, { ...next, created_at: serverTimestamp() })
  } catch (error) {
    // A rejected save should not leave uploaded files behind. All unreferenced
    // objects remain private even if cleanup is interrupted.
    const failed = await removeAttachments(uploaded)
    if (failed.length) error.message += ' Some unattached uploads need cleanup in file storage.'
    throw error
  }
  // Commit metadata first; no new download URLs can be issued for removed files.
  return { cleanupFailed: await removeAttachments(oldFiles.filter(file => removePaths.includes(file.path))) }
}

export async function deleteContent(name, id) {
  requireAdmin()
  const target = doc(contentCollection(name), id)
  const existing = await getDoc(target)
  await deleteDoc(target)
  return { cleanupFailed: await removeAttachments(existing.data()?.attachments || []) }
}
