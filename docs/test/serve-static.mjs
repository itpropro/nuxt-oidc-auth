import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const publicDir = resolve(fileURLToPath(new URL('../.output/public/', import.meta.url)))
const publicPrefix = `${publicDir}${sep}`
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function findFile(pathname) {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '')
  const candidates = extname(relativePath)
    ? [relativePath]
    : [join(relativePath, 'index.html')]

  for (const candidate of candidates) {
    const path = resolve(publicDir, candidate)
    if (!path.startsWith(publicPrefix))
      continue

    try {
      if ((await stat(path)).isFile())
        return path
    }
    catch {}
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    const path = await findFile(url.pathname)

    if (!path) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not found')
      return
    }

    response.writeHead(200, {
      'content-type': contentTypes[extname(path)] || 'application/octet-stream',
    })
    response.end(await readFile(path))
  }
  catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(error instanceof Error ? error.message : 'Internal server error')
  }
})

server.listen(4173, '127.0.0.1')
process.once('SIGTERM', () => server.close())
