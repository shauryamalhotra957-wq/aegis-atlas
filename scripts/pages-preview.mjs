import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const port = Number(process.env.PORT ?? 4173)
const basePath = '/aegis-atlas/'
const distRoot = path.resolve('dist')

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
])

function resolveFile(urlPath) {
  if (!urlPath.startsWith(basePath)) {
    return null
  }

  const relativePath = decodeURIComponent(urlPath.slice(basePath.length)) || 'index.html'
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '')
  return path.join(distRoot, safePath.endsWith(path.sep) ? `${safePath}index.html` : safePath)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`)
  const filePath = resolveFile(url.pathname)

  if (!filePath) {
    response.writeHead(302, { Location: basePath })
    response.end()
    return
  }

  if (!filePath.startsWith(distRoot)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  try {
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    response.end(body)
  } catch {
    const body = await readFile(path.join(distRoot, 'index.html'))
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    response.end(body)
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Aegis Atlas Pages preview: http://127.0.0.1:${port}${basePath}`)
})
