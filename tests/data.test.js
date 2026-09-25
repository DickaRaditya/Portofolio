import assert from 'node:assert/strict'
import { beforeEach, mock, test } from 'node:test'

const auth = { currentUser: null }
const calls = []
const documents = {
  profile: [{ id: 'main', full_name: 'Draft profile', published: false }],
  projects: [
    { id: 'private', title: 'Draft', published: false, sort_order: 0 },
    { id: 'second', title: 'Second', published: true, sort_order: 2 },
    { id: 'first', title: 'First', published: true, sort_order: 1 },
  ],
  certificates: [
    { id: 'draft', title: 'Private certificate', published: false },
    { id: 'public', title: 'Public certificate', published: true },
  ],
}
const docSnapshot = row => ({ id: row?.id, data: () => row, exists: () => !!row })
mock.module('../src/firebase.js', {
  namedExports: { auth, db: {}, isAdmin: user => user?.uid === 'admin' },
})
mock.module('firebase/firestore', {
  namedExports: {
    collection: (_db, name) => ({ name }),
    doc: (parent, name, id) => id ? { name, id } : { ...parent, id: name },
    documentId: () => 'id',
    where: (field, operator, value) => ({ field, operator, value }),
    query: (source, ...filters) => ({ ...source, filters }),
    getDocs: async source => {
      calls.push({ operation: 'read', source })
      const rows = documents[source.name].filter(row => (source.filters || []).every(filter => row[filter.field] === filter.value))
      return { docs: rows.map(docSnapshot) }
    },
    getDoc: async source => docSnapshot(documents[source.name].find(row => row.id === source.id)),
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    setDoc: async (target, data) => calls.push({ operation: 'set', target, data }),
    addDoc: async (target, data) => calls.push({ operation: 'add', target, data }),
    updateDoc: async (target, data) => calls.push({ operation: 'update', target, data }),
    deleteDoc: async target => calls.push({ operation: 'delete', target }),
  },
})
const { loadPortfolio, saveProfile, saveContent, deleteContent } = await import('../src/data.js')

beforeEach(() => { auth.currentUser = null; calls.length = 0 })

test('public reads exclude drafts, including the profile, even while admin is signed in', async () => {
  auth.currentUser = { uid: 'admin' }
  const result = await loadPortfolio()
  assert.equal(result.profile, null)
  assert.deepEqual(result.projects.map(item => item.id), ['first', 'second'])
  assert.deepEqual(result.certificates.map(item => item.id), ['public'])
  assert.equal(calls.length, 3)
  for (const call of calls) assert.ok(call.source.filters.some(filter => filter.field === 'published' && filter.value === true))
})

test('admin dashboard includes draft content', async () => {
  auth.currentUser = { uid: 'admin' }
  const result = await loadPortfolio(true)
  assert.equal(result.profile.full_name, 'Draft profile')
  assert.equal(result.projects.length, 3)
  assert.equal(result.certificates.length, 2)
})

for (const user of [null, { uid: 'other-user' }]) {
  test(`${user ? 'non-admin' : 'anonymous'} cannot access admin reads or mutations`, async () => {
    auth.currentUser = user
    for (const action of [
      () => loadPortfolio(true),
      () => saveProfile({ published: true }),
      () => saveContent('projects', '', { published: true }),
      () => saveContent('certificates', 'existing', { published: false }),
      () => deleteContent('projects', 'existing'),
    ]) await assert.rejects(action, /Admin access required/)
    assert.equal(calls.length, 0)
  })
}

test('profile saves use the singleton and server timestamp', async () => {
  auth.currentUser = { uid: 'admin' }
  await saveProfile({ full_name: 'Admin', published: false })
  assert.deepEqual(calls[0], { operation: 'set', target: { name: 'profile', id: 'main' }, data: { full_name: 'Admin', published: false, updated_at: 'SERVER_TIMESTAMP' } })
})

for (const name of ['projects', 'certificates']) {
  test(`${name} supports create, edit, and delete without resetting creation time`, async () => {
    auth.currentUser = { uid: 'admin' }
    await saveContent(name, '', { title: 'New', published: false })
    await saveContent(name, 'existing', { title: 'Edited', published: true })
    await deleteContent(name, 'existing')
    assert.deepEqual(calls.map(call => call.operation), ['add', 'update', 'delete'])
    assert.equal(calls[0].data.created_at, 'SERVER_TIMESTAMP')
    assert.equal(calls[1].data.created_at, undefined)
    assert.equal(calls[1].data.published, true)
    assert.deepEqual(calls[2].target, { name, id: 'existing' })
  })
}

test('content API rejects unexpected collections', async () => {
  auth.currentUser = { uid: 'admin' }
  await assert.rejects(() => saveContent('users', '', {}), /Unknown collection/)
  await assert.rejects(() => deleteContent('users', 'admin'), /Unknown collection/)
})
