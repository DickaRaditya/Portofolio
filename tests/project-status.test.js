import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_STATUSES, normalizeProjectStatus, projectStatusLabel, validateProjectStatus } from '../src/project-status.js'

test('supported project statuses retain their values and display labels', () => {
  assert.deepEqual(PROJECT_STATUSES, [
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
  ])
  for (const { value, label } of PROJECT_STATUSES) {
    assert.equal(normalizeProjectStatus(value), value)
    assert.equal(projectStatusLabel(value), label)
    assert.equal(validateProjectStatus(value), value)
  }
})

test('legacy records without a status display as completed', () => {
  const legacyProject = { title: 'Existing project' }
  assert.equal(normalizeProjectStatus(legacyProject.status), 'completed')
  assert.equal(projectStatusLabel(legacyProject.status), 'Completed')
})

test('unknown stored statuses use the completed fallback', () => {
  for (const value of [null, '', 'archived', 'Ongoing', 'toString', 0, {}, ['ongoing']]) {
    assert.equal(normalizeProjectStatus(value), 'completed')
    assert.equal(projectStatusLabel(value), 'Completed')
  }
})

test('submitted statuses must be one of the supported values', () => {
  for (const value of [undefined, null, '', 'archived', 'Ongoing', ' ongoing ', 'toString', 0, {}, ['ongoing']]) {
    assert.throws(() => validateProjectStatus(value), /Project status must be Ongoing or Completed/)
  }
})
