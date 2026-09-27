import assert from 'node:assert/strict'
import { test } from 'node:test'
import { previewSource } from '../src/preview-source.js'

test('Drive files and Office/Docs links use pictures while retaining original destinations', () => {
  const file = previewSource('https://drive.google.com/file/d/resume-123/view?resourcekey=access-key')
  assert.equal(file.href, 'https://drive.google.com/file/d/resume-123/view?resourcekey=access-key')
  const thumb = new URL(file.image)
  assert.equal(thumb.pathname, '/thumbnail')
  assert.equal(thumb.searchParams.get('id'), 'resume-123')
  assert.equal(thumb.searchParams.get('resourcekey'), 'access-key')
  for (const type of ['document', 'spreadsheets', 'presentation']) {
    assert.equal(new URL(previewSource(`https://docs.google.com/${type}/d/project_123/edit`).image).searchParams.get('id'), 'project_123')
  }
})

test('folders get a folder cover instead of a broken file thumbnail', () => {
  for (const path of ['/drive/folders/files-123', '/drive/u/0/folders/files-123']) {
    const source = previewSource(`https://drive.google.com${path}`)
    assert.equal(source.kind, 'folder')
    assert.equal(source.image, '')
    assert.equal(source.pdf, '')
  }
})

test('direct PDFs are rendered locally and raster images are used directly', () => {
  const pdf = 'https://files.example/resume.PDF?version=2'
  assert.equal(previewSource(pdf).pdf, pdf)
  const image = 'https://files.example/certificate.webp'
  assert.equal(previewSource(image).image, image)
})

test('unsafe URLs are rejected and unrelated domains cannot be treated as Drive files', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'file:///resume.pdf', 'invalid']) assert.equal(previewSource(url), null)
  assert.equal(previewSource('https://drive.google.com.evil.example/file/d/id/view').image, '')
  assert.equal(previewSource('https://drive.google.com/open?id=bad%2Fid').image, '')
})
