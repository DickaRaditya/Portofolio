import { createServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import filesHandler from '../api/files.js'

const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' })
const server = createServer(async (req, res) => {
  if (req.url?.split('?')[0] !== '/api/files') return vite.middlewares(req, res)
  res.status = status => { res.statusCode = status; return res }
  res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)) }
  try {
    const chunks = []
    let length = 0
    for await (const chunk of req) {
      length += chunk.length
      if (length > 16 * 1024) return res.status(413).json({ error: 'Request too large.' })
      chunks.push(chunk)
    }
    req.body = Buffer.concat(chunks).toString('utf8')
    await filesHandler(req, res)
  } catch {
    if (!res.writableEnded) res.status(500).json({ error: 'Local file API failed.' })
  }
})
server.listen(5173, '127.0.0.1', () => console.log('Portfolio and file API: http://127.0.0.1:5173'))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  await vite.close()
  server.close(() => process.exit(0))
})
