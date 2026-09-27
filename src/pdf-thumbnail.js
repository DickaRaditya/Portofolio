import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

// Only the first page is rendered; the resulting image has no viewer controls.
export async function pdfThumbnail(blob) {
  const task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false })
  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const original = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(800 / original.width, 1200 / original.height) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: '#ffffff' }).promise
    const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.88))
    if (!image) throw new Error('Could not create thumbnail.')
    return image
  } finally {
    await task.destroy()
  }
}
