export function previewSource(value) {
  let url
  try { url = new URL(value) } catch { return null }
  if (!['https:', 'http:'].includes(url.protocol)) return null
  const result = { href: url.href, kind: 'document', image: '', pdf: '' }
  if (url.hostname === 'drive.google.com') {
    if (/^\/drive\/(?:u\/\d+\/)?folders\/[\w-]+(?:\/|$)/.test(url.pathname)) {
      return { ...result, kind: 'folder' }
    }
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1] || url.searchParams.get('id')
    if (id && /^[\w-]+$/.test(id)) {
      const thumbnail = new URL('https://drive.google.com/thumbnail')
      thumbnail.searchParams.set('id', id)
      thumbnail.searchParams.set('sz', 'w800')
      if (url.searchParams.has('resourcekey')) thumbnail.searchParams.set('resourcekey', url.searchParams.get('resourcekey'))
      result.image = thumbnail.href
    }
  } else if (url.hostname === 'docs.google.com') {
    const id = url.pathname.match(/^\/(?:document|spreadsheets|presentation)\/d\/([\w-]+)(?:\/|$)/)?.[1]
    if (id) result.image = `https://drive.google.com/thumbnail?id=${id}&sz=w800`
  } else if (/\.(png|jpe?g|webp)$/i.test(url.pathname)) {
    result.image = url.href
  } else if (/\.pdf$/i.test(url.pathname)) {
    result.pdf = url.href
  }
  return result
}
