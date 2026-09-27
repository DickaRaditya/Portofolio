import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, isAdmin, isConfigured, storageEnabled } from './firebase.js'
import { deleteContent, loadPortfolio, saveContent, saveProfile } from './data.js'
import { downloadAttachment, getAttachmentUrl, FILE_ACCEPT, fileSize, validateAttachments } from './files.js'
import './style.css'

const app = document.querySelector('#app')
const emptyContent = () => ({ profile: null, projects: [], certificates: [] })
let state = { user: null, ...emptyContent(), error: '' }
let routeVersion = 0
let authReady = !auth
let signingIn = false
let loginMessage = ''
let previewObserver
const previewObjectUrls = new Set()

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
function safeUrl(value) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}
function validateUrl(value, label) {
  if (value && !safeUrl(value)) throw new Error(`${label} must use an http:// or https:// URL.`)
}
function resumePreviewUrl(value) {
  const safe = safeUrl(value)
  if (!safe) return ''
  const url = new URL(safe)
  if (url.hostname === 'drive.google.com') {
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1] || url.searchParams.get('id')
    if (!id || !/^[\w-]+$/.test(id)) return ''
    const preview = new URL(`https://drive.google.com/file/d/${id}/preview`)
    if (url.searchParams.has('resourcekey')) preview.searchParams.set('resourcekey', url.searchParams.get('resourcekey'))
    return preview.href
  }
  return /\.pdf$/i.test(url.pathname) ? safe : ''
}
function resumeSection(profile) {
  const url = safeUrl(profile.resume_url)
  const preview = resumePreviewUrl(url)
  return `<section id="resume" class="resumeSection"><div class="wrap"><div class="sectionHead"><span>01 — RESUME</span><h2>My resume</h2><p class="meta">Read my education, experience, and cybersecurity skills right here.</p></div>${url ? `<div class="card resumeCard"><div class="resumeToolbar"><span>Resume preview</span><a class="btn small" target="_blank" rel="noopener noreferrer" href="${esc(url)}">Open in a new tab</a></div>${preview ? `<iframe class="resumePreview" src="${esc(preview)}" title="${esc(profile.full_name || 'Portfolio owner')} — resume" loading="lazy" allow="fullscreen"></iframe><p class="meta resumeHint">If the preview doesn't load, use “Open in a new tab” above.</p>` : '<p class="meta">Use “Open in a new tab” to view this resume.</p>'}</div>` : '<div class="card"><p class="meta">My resume will be available here soon.</p></div>'}</div></section>`
}
function cardPreviewUrl(value) {
  const fileUrl = resumePreviewUrl(value)
  if (fileUrl) return fileUrl
  const safe = safeUrl(value)
  if (!safe) return ''
  const url = new URL(safe)
  const folderId = url.hostname === 'drive.google.com' && url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)(?:\/|$)/)?.[1]
  if (folderId) {
    const preview = new URL('https://drive.google.com/embeddedfolderview')
    preview.searchParams.set('id', folderId)
    if (url.searchParams.has('resourcekey')) preview.searchParams.set('resourcekey', url.searchParams.get('resourcekey'))
    preview.hash = 'grid'
    return preview.href
  }
  if (url.hostname === 'docs.google.com') {
    const document = url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([\w-]+)(?:\/|$)/)
    if (document) return `https://docs.google.com/${document[1]}/d/${document[2]}/${document[1] === 'presentation' ? 'embed' : 'preview'}`
  }
  return ''
}
function cardPreview(item, collection) {
  const index = (item.attachments || []).findIndex(file => /\.(pdf|png|jpe?g|webp)$/i.test(file.name))
  if (index !== -1) return `<div class="filePreview" data-preview-collection="${collection}" data-preview-id="${esc(item.id)}" data-preview-index="${index}"><p class="meta" role="status">Loading preview…</p></div>`
  const link = collection === 'projects' ? item.url : item.public_url
  const url = cardPreviewUrl(link)
  if (url) return `<div class="filePreview"><iframe src="${esc(url)}" title="${esc(item.title)} — preview" loading="lazy" allow="fullscreen"></iframe></div>`
  const imageUrl = safeUrl(link)
  if (imageUrl && /\.(png|jpe?g|webp)$/i.test(new URL(imageUrl).pathname)) return `<div class="filePreview"><img src="${esc(imageUrl)}" alt="${esc(item.title)}" loading="lazy"></div>`
  return ''
}
function clearFilePreviews() {
  previewObserver?.disconnect()
  for (const url of previewObjectUrls) URL.revokeObjectURL(url)
  previewObjectUrls.clear()
}
function bindFilePreviews() {
  const version = routeVersion
  previewObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      previewObserver.unobserve(entry.target)
      void loadFilePreview(entry.target, version)
    }
  }, { rootMargin: '200px' })
  document.querySelectorAll('[data-preview-id]').forEach(element => previewObserver.observe(element))
}
async function loadFilePreview(container, version) {
  const item = state[container.dataset.previewCollection]?.find(item => item.id === container.dataset.previewId)
  const file = item?.attachments?.[Number(container.dataset.previewIndex)]
  if (!file) return
  try {
    let url
    if (file.provider === 'r2') {
      url = await getAttachmentUrl(file)
    } else {
      const blob = await downloadAttachment(file)
      if (version !== routeVersion) return
      url = URL.createObjectURL(blob)
      previewObjectUrls.add(url)
    }
    if (version !== routeVersion || !container.isConnected) return
    const isPdf = /\.pdf$/i.test(file.name)
    const preview = document.createElement(isPdf ? 'iframe' : 'img')
    if (isPdf) {
      preview.title = `${item.title} — preview`
      preview.src = `${url}#toolbar=0&navpanes=0&view=Fit`
    } else {
      preview.alt = item.title || file.name
      preview.src = url
    }
    preview.addEventListener('error', () => {
      container.innerHTML = '<p class="meta" role="status">Preview unavailable. Use the file button below to open it.</p>'
    })
    container.replaceChildren(preview)
  } catch {
    if (version === routeVersion && container.isConnected) container.innerHTML = '<p class="meta" role="status">Preview unavailable. Use the file button below to open it.</p>'
  }
}
function errorMessage(error) {
  if (error.code?.startsWith('storage/')) {
    if (error.code === 'storage/unauthorized') return 'File access denied. Check Storage rules and whether the item is published.'
    if (error.code === 'storage/object-not-found') return 'This file could not be found. Please refresh and try again.'
    if (['storage/no-default-bucket', 'storage/bucket-not-found', 'storage/project-not-found'].includes(error.code)) return 'Cloud Storage uploads require Blaze. Use the Project URL or Verification URL field for a link, or enable Storage later.'
    return 'File transfer failed. Check your connection and Firebase Storage setup (billing, rules, and CORS), then retry.'
  }
  if (error.code === 'permission-denied') return 'Access denied. Check the deployed Firestore rules and admin UID.'
  if (error.code?.startsWith('auth/')) {
    if (error.code === 'auth/too-many-requests') return 'Too many sign-in attempts. Please try again later.'
    if (error.code === 'auth/network-request-failed') return 'Unable to connect. Check your internet connection.'
    return 'Sign-in failed. Check your credentials and Firebase Authentication settings.'
  }
  return error.message || 'Something went wrong. Please try again.'
}
function shell(content) {
  return `<nav><div class="wrap"><a class="brand" href="#"><span>~/</span>cybersec</a>
  <div class="navlinks"><a href="#resume">Resume</a><a href="#about">About</a><a href="#projects">Projects</a><a href="#certificates">Certificates</a><a href="#contact">Contact</a>${isAdmin(state.user) ? '<a href="#dashboard">Dashboard</a>' : '<a href="#login">Admin</a>'}</div></div></nav>${content}
  <footer><div class="wrap">© ${new Date().getFullYear()} ${esc(state.profile?.full_name || 'Your Name')} · Cybersecurity Portfolio</div></footer>`
}
function notice() {
  const message = !isConfigured
    ? 'Firebase is not configured. Set the values from .env.example and restart or redeploy the app.'
    : state.error
  return message ? `<div class="wrap error" role="alert">${esc(message)}${isConfigured ? ' <button id="retry" class="btn small">Retry</button>' : ''}</div>` : ''
}

function publicPage(){
 const p=state.profile||{}
 return shell(`${notice()}<header class="hero"><div class="wrap heroGrid"><div>
 <div class="eyebrow">CYBERSECURITY PORTFOLIO</div><h1>${esc(p.headline||'Security. Detection. Resilience.')}</h1>
 <p>${esc(p.bio||'Cybersecurity professional focused on defensive security, SOC operations, threat detection and secure infrastructure.')}</p>
 <div class="actions"><a class="btn primary" href="#resume">Read my resume</a><a class="btn" href="#projects">Explore Projects</a><a class="btn" href="#contact">Contact</a></div>
 </div><div class="terminal"><div class="termbar">portfolio@security:~$</div><pre>$ whoami
${esc(p.full_name||'Your Name')}

$ focus
SOC · SIEM · Blue Team
Threat Hunting · Digital Forensics

$ status
[✓] building
[✓] documenting
[✓] learning</pre></div></div></header>
 <main>${resumeSection(p)}<section id="about"><div class="wrap"><div class="sectionHead"><span>02 — ABOUT</span><h2>Perkenalan</h2></div><div class="card"><p>${esc(p.about||p.bio||'Tambahkan perkenalan melalui dashboard admin.')}</p><div class="meta">${esc(p.location||'Indonesia')} · ${esc(p.email||'email@example.com')}</div></div></div></section>
 <section id="projects"><div class="wrap"><div class="sectionHead"><span>03 — PROJECTS</span><h2>Security Projects</h2></div><div class="cards">${state.projects.map(x=>`<article class="card projectCard"><div class="tag">${esc(x.category||'Cybersecurity')}</div><h3>${esc(x.title)}</h3>${cardPreview(x, 'projects')}<p>${esc(x.description)}</p>${attachmentLinks(x, 'projects')}${x.url?`<a class="btn small" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(x.url))}">Open project link</a>`:''}</article>`).join('') || '<div class="card"><p class="meta">Belum ada project publik.</p></div>'}</div></div></section>
 <section id="certificates"><div class="wrap"><div class="sectionHead"><span>04 — CERTIFICATES & FILES</span><h2>Credentials</h2></div><div class="cards">${state.certificates.map(x=>`<article class="card fileCard"><div class="fileCardContent"><div class="tag">${esc(x.kind||'Document')}</div><h3>${esc(x.title)}</h3>${x.description ? `<p>${esc(x.description)}</p>` : ''}<small>${esc(x.issuer || "")}</small>${cardPreview(x, 'certificates')}${attachmentLinks(x, 'certificates')}</div>${x.public_url ? `<a class="btn small" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(x.public_url))}">Open link</a>` : ''}</article>`).join('') || '<div class="card"><p class="meta">Belum ada sertifikat/file publik.</p></div>'}</div></div></section>
 <section id="contact"><div class="wrap"><div class="sectionHead"><span>05 — CONTACT</span><h2>Let's connect</h2></div><div class="card"><p class="meta">Untuk kolaborasi, diskusi security, atau peluang profesional.</p><div class="actions"><a class="btn primary" href="mailto:${esc(p.email||'email@example.com')}">Email</a>${p.github?`<a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(p.github))}">GitHub</a>`:''}${p.linkedin?`<a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(p.linkedin))}">LinkedIn</a>`:''}</div></div></div></section></main>`)
}

function loginPage() {
  return shell(`<main class="auth"><div class="authBox"><div class="eyebrow">ADMIN ACCESS</div><h1>Sign in</h1><p class="meta">Kelola profile, project, dan sertifikat.</p>${notice()}<form id="loginForm"><input name="email" type="email" placeholder="Email admin" aria-label="Email admin" autocomplete="username" required><input name="password" type="password" placeholder="Password" aria-label="Password" autocomplete="current-password" required><button class="btn primary" type="submit" ${!isConfigured ? 'disabled' : ''}>Sign in</button></form><p id="loginMsg" class="error" role="alert">${esc(loginMessage)}</p></div></main>`)
}
function attachmentLinks(item, collection) {
  return (item.attachments || []).length ? `<div class="attachments">${item.attachments.map((file, index) => `
    <div class="attachment"><button type="button" class="downloadFile" data-collection="${collection}" data-id="${esc(item.id)}" data-index="${index}"><span aria-hidden="true">↓</span> ${esc(file.name)} <small>${fileSize(file.size)}</small></button><span class="attachmentStatus" role="status"></span></div>`).join('')}</div>` : ''
}
function uploadFields() {
  return `<fieldset class="wide uploadPanel"><legend>File attachments</legend>${storageEnabled ? `<label>Choose files<input name="files" type="file" multiple accept="${FILE_ACCEPT}"></label><p class="meta uploadHint">Up to 5 files, 10 MB each. PDF, Word, Excel, PowerPoint, images, text, and ZIP.</p><p class="fileSelection meta" role="status"></p>` : '<p class="meta">Uploads are not configured yet. You can use a public link or manage existing attachments.</p>'}<div class="existingFiles"></div><p class="formStatus meta" role="status" aria-live="polite"></p></fieldset>`
}
function editAttachments(form, item) {
  form.querySelector('.existingFiles').innerHTML = (item.attachments || []).map(file => `<div class="existingFile"><span>${esc(file.name)} <small>${fileSize(file.size)}</small></span><label class="check"><input type="checkbox" name="remove_file" value="${esc(file.path)}"> Remove on save</label></div>`).join('')
}
function dashboard() {
  return shell(`<main class="dashboard"><div class="wrap"><div class="dashTop"><div><div class="eyebrow">ADMIN DASHBOARD</div><h1>Portfolio Control Center</h1></div><button id="logout" class="btn">Sign out</button></div>
  ${notice()}<p id="dashboardMsg" class="meta" role="status" aria-live="polite"></p>
  <section><div class="sectionHead"><span>PROFILE</span><h2>Public identity</h2></div><form id="profileForm" class="formGrid card">
  ${[['full_name', 'Nama lengkap'], ['headline', 'Headline'], ['location', 'Lokasi'], ['email', 'Email'], ['github', 'GitHub URL'], ['linkedin', 'LinkedIn URL']].map(([key, label]) => `<label>${label}<input name="${key}" type="${key === 'email' ? 'email' : ['github', 'linkedin'].includes(key) ? 'url' : 'text'}" value="${esc(state.profile?.[key] || '')}"></label>`).join('')}
  <label class="wide">Bio<textarea name="bio">${esc(state.profile?.bio || '')}</textarea></label><label class="wide">About<textarea name="about">${esc(state.profile?.about || '')}</textarea></label>
  <label class="wide">Resume URL (optional)<input name="resume_url" type="url" placeholder="https://..." aria-describedby="resumeHint" value="${esc(state.profile?.resume_url || '')}"></label><p id="resumeHint" class="wide meta">Paste a public link to your resume, such as a Google Drive PDF with “Anyone with the link” access. Clear this field to remove the resume link.</p>
  <label class="check"><input name="published" type="checkbox" ${state.profile?.published !== false ? 'checked' : ''}> Published</label><button class="btn primary">Save profile</button></form></section>
  <section><div class="sectionHead"><span>PROJECTS</span><h2>Manage projects</h2></div><form id="projectForm" class="card formGrid"><input type="hidden" name="id"><label>Title<input name="title" required></label><label>Category<input name="category"></label><label class="wide">Description<textarea name="description"></textarea></label><label>Project URL (optional)<input name="url" type="url"></label><label>Sort order<input name="sort_order" type="number" step="1" value="0" required></label>${uploadFields()}<label class="check"><input name="published" type="checkbox" checked> Published</label><div class="actions"><button class="btn primary">Save project</button><button class="btn" type="reset">Cancel / New</button></div></form>
  <div class="cards">${state.projects.map(item => adminItem(item, 'projects')).join('')}</div></section>
  <section><div class="sectionHead"><span>CERTIFICATES</span><h2>Manage certificates</h2></div><form id="certificateForm" class="card formGrid"><input type="hidden" name="id"><label>Title<input name="title" required></label><label>Issuer<input name="issuer"></label><label class="wide">Description<textarea name="description"></textarea></label><label>Type<select name="kind"><option>Certificate</option><option>Report</option><option>Project File</option><option>Other</option></select></label><label>Verification URL (optional)<input name="public_url" type="url" placeholder="https://..."></label>${uploadFields()}<label class="check"><input name="published" type="checkbox" checked> Published</label><div class="actions"><button class="btn primary">Save certificate</button><button class="btn" type="reset">Cancel / New</button></div></form>
  <div class="cards">${state.certificates.map(item => adminItem(item, 'certificates')).join('')}</div></section>
  </div></main>`)
}
function adminItem(item, collection) {
  return `<article class="card adminItem"><div><b>${esc(item.title)}</b><p class="meta">${esc(item.category || item.kind || '')} · ${item.published ? 'Published' : 'Draft'}</p>${attachmentLinks(item, collection)}</div><button class="btn small editItem" data-collection="${collection}" data-id="${esc(item.id)}">Edit</button><button class="btn small danger deleteItem" data-collection="${collection}" data-id="${esc(item.id)}">Delete</button></article>`
}

async function route() {
  const version = ++routeVersion
  clearFilePreviews()
  if (!authReady) {
    app.innerHTML = shell('<main class="auth"><p class="meta" role="status">Loading…</p></main>')
    return
  }
  const path = location.hash.slice(1) || 'home'
  if (path === 'login') {
    state = { ...state, ...emptyContent(), error: '' }
    if (isAdmin(state.user)) { location.hash = 'dashboard'; return }
    app.innerHTML = loginPage()
    bindLogin()
    return
  }
  const admin = path === 'dashboard'
  if (admin && !isAdmin(state.user)) { location.hash = 'login'; return }
  state = { ...state, ...emptyContent(), error: '' }
  app.innerHTML = shell('<main class="auth"><p class="meta" role="status">Loading…</p></main>')
  if (isConfigured) {
    try {
      const content = await loadPortfolio(admin)
      if (version !== routeVersion) return
      Object.assign(state, content)
    } catch (error) {
      if (version !== routeVersion) return
      state.error = errorMessage(error)
    }
  }
  if (version !== routeVersion) return
  // Do not show writable empty forms after a failed admin read.
  app.innerHTML = admin && state.error
    ? shell(`<main class="dashboard"><div class="wrap">${notice()}<button id="logout" class="btn">Sign out</button></div></main>`)
    : admin ? dashboard() : publicPage()
  document.querySelector('#retry')?.addEventListener('click', route)
  if (!admin) bindFilePreviews()
  if (admin) bindDashboard()
  else if (['about', 'projects', 'certificates', 'resume', 'contact'].includes(path)) {
    document.getElementById(path)?.scrollIntoView()
  }
}

function bindLogin() {
  document.querySelector('#loginForm').addEventListener('submit', async event => {
    event.preventDefault()
    if (!auth || signingIn) return
    const form = event.currentTarget
    const button = form.querySelector('button')
    const message = document.querySelector('#loginMsg')
    button.disabled = true
    signingIn = true
    message.textContent = 'Signing in…'
    try {
      const { user } = await signInWithEmailAndPassword(auth, form.elements.email.value.trim(), form.elements.password.value)
      if (!isAdmin(user)) {
        await signOut(auth)
        throw new Error('This account does not have admin access.')
      }
      state.user = user
      loginMessage = ''
      location.hash = 'dashboard'
    } catch (error) {
      loginMessage = errorMessage(error)
      message.textContent = loginMessage
    } finally {
      signingIn = false
      button.disabled = false
    }
  })
}

async function mutate(button, action, success) {
  if (button.disabled) return
  const version = routeVersion
  const controls = [...document.querySelectorAll('.dashboard input, .dashboard textarea, .dashboard select, .dashboard button')]
  const disabled = controls.map(control => control.disabled)
  controls.forEach(control => { control.disabled = true })
  const message = button.closest('form')?.querySelector('.formStatus') || document.querySelector('#dashboardMsg')
  if (message) message.textContent = 'Saving…'
  try {
    const result = await action(text => { if (message) message.textContent = text })
    if (version !== routeVersion) return
    await route()
    const nextMessage = document.querySelector('#dashboardMsg')
    if (nextMessage) {
      nextMessage.textContent = result?.cleanupFailed?.length
        ? `${success} Some old files could not be deleted from Storage. They are no longer public; remove them in Firebase Storage.` : success
    }
  } catch (error) {
    if (version !== routeVersion) return
    if (message) { message.textContent = errorMessage(error); message.className = 'error' }
    else window.alert(errorMessage(error))
  } finally { controls.forEach((control, index) => { control.disabled = disabled[index] }) }
}

function bindDashboard() {
  document.querySelector('#logout')?.addEventListener('click', async event => {
    const button = event.currentTarget
    button.disabled = true
    try {
      await signOut(auth)
      state = { ...state, user: null, ...emptyContent() }
      location.hash = 'home'
    } catch (error) { window.alert(errorMessage(error)); button.disabled = false }
  })
  document.querySelector('#profileForm')?.addEventListener('submit', event => {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    data.published = form.elements.published.checked
    void mutate(form.querySelector('button'), async () => {
      validateUrl(data.github, 'GitHub URL')
      validateUrl(data.linkedin, 'LinkedIn URL')
      data.resume_url = data.resume_url.trim()
      validateUrl(data.resume_url, 'Resume URL')
      await saveProfile(data)
    }, 'Profile saved.')
  })
  for (const [formId, collection] of [['projectForm', 'projects'], ['certificateForm', 'certificates']]) {
    // Hidden input value changes also change its reset default. Clear it explicitly
    // so Cancel / New cannot accidentally overwrite the previously edited record.
    document.getElementById(formId)?.addEventListener('reset', event => {
      event.currentTarget.elements.id.value = ''
      event.currentTarget.querySelector('.existingFiles').innerHTML = ''
      event.currentTarget.querySelector('.fileSelection').textContent = ''
      event.currentTarget.querySelector('.formStatus').textContent = ''
    })
    document.getElementById(formId)?.elements.files?.addEventListener('change', event => {
      const input = event.currentTarget
      const message = input.form.querySelector('.fileSelection')
      try {
        validateAttachments([...input.files])
        message.className = 'fileSelection meta'
        message.textContent = [...input.files].map(file => `${file.name} (${fileSize(file.size)})`).join(' · ')
      } catch (error) { message.className = 'fileSelection error'; message.textContent = error.message }
    })
    document.getElementById(formId)?.addEventListener('submit', event => {
      event.preventDefault()
      const form = event.currentTarget
      const formData = new FormData(form)
      const { id, files: ignoredFiles, remove_file: ignoredRemoval, ...data } = Object.fromEntries(formData)
      const files = storageEnabled ? [...form.elements.files.files] : []
      const removePaths = formData.getAll('remove_file')
      data.published = form.elements.published.checked
      void mutate(form.querySelector('button'), async onProgress => {
        data.title = data.title.trim()
        if (!data.title) throw new Error('Title is required.')
        if (collection === 'projects') {
          validateUrl(data.url, 'Project URL')
          data.sort_order = Number(data.sort_order)
          if (!Number.isSafeInteger(data.sort_order)) throw new Error('Sort order must be a whole number.')
        } else {
          const keptFiles = (state.certificates.find(item => item.id === id)?.attachments || []).filter(file => !removePaths.includes(file.path))
          if (!data.public_url.trim() && !files.length && !keptFiles.length) throw new Error('Upload a certificate file or enter a verification URL.')
          validateUrl(data.public_url, 'Certificate URL')
        }
        return saveContent(collection, id, data, { files, removePaths, onProgress })
      }, collection === 'projects' ? 'Project saved.' : 'Certificate saved.')
    })
  }
  document.querySelectorAll('.editItem').forEach(button => button.addEventListener('click', () => {
    const collection = button.dataset.collection
    const item = state[collection].find(record => record.id === button.dataset.id)
    const form = document.getElementById(collection === 'projects' ? 'projectForm' : 'certificateForm')
    form.reset()
    for (const input of form.elements) {
      if (!input.name || input.type === 'file' || input.name === 'remove_file') continue
      if (input.type === 'checkbox') input.checked = item[input.name] === true
      else input.value = item[input.name] ?? (input.name === 'sort_order' ? 0 : '')
    }
    editAttachments(form, item)
    form.scrollIntoView({ behavior: 'smooth', block: 'center' })
    form.elements.title.focus({ preventScroll: true })
  }))
  document.querySelectorAll('.deleteItem').forEach(button => button.addEventListener('click', () => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return
    void mutate(button, () => deleteContent(button.dataset.collection, button.dataset.id), 'Item deleted.')
  }))
}

app.addEventListener('click', async event => {
  const button = event.target.closest('.downloadFile')
  if (!button || button.disabled) return
  const item = state[button.dataset.collection]?.find(item => item.id === button.dataset.id)
  const file = item?.attachments?.[Number(button.dataset.index)]
  if (!file) return
  const message = button.parentElement.querySelector('.attachmentStatus')
  button.disabled = true
  message.textContent = 'Opening…'
  const preview = window.open('about:blank', '_blank')
  try {
    if (preview) preview.opener = null
    let url
    if (file.provider === 'r2') {
      url = await getAttachmentUrl(file)
    } else {
      const blob = await downloadAttachment(file)
      url = URL.createObjectURL(blob)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    }
    if (preview && !preview.closed) {
      preview.location.href = url
      message.textContent = 'Opened in a new tab.'
    } else {
      window.location.assign(url)
    }
  } catch (error) {
    preview?.close()
    message.textContent = errorMessage(error)
  }
  finally { button.disabled = false }
})
window.addEventListener('hashchange', route)
if (auth) {
  onAuthStateChanged(auth, user => {
    state = { ...state, user, ...emptyContent() }
    authReady = true
    if (!signingIn) void route()
  }, error => {
    authReady = true
    state.error = errorMessage(error)
    app.innerHTML = shell(`<main class="auth">${notice()}</main>`)
    document.querySelector('#retry')?.addEventListener('click', () => location.reload())
  })
}
void route()

