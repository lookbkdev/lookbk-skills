// Closing CTA Kit (from the Scroll Cinema kit): serves a built page on http://localhost so it can be
// looked at, with Range requests so the films can seek (Safari needs them).
//
//   node scripts/serve.mjs out [--port 4310]
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}

/** Serves `dir` (with Range requests, which Safari needs for video); resolves to { url, close }. */
export function serve(dir, port = 0) {
  const root = resolve(dir)
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = normalize(join(root, path))
    if (!file.startsWith(root + sep) && file !== root) return res.writeHead(403).end()
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) return res.writeHead(404).end('not found')
    const size = statSync(file).size
    const type = TYPES[extname(file)] ?? 'application/octet-stream'
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
    if (range) {
      const start = range[1] ? Number(range[1]) : size - Number(range[2])
      const end = range[1] && range[2] ? Number(range[2]) : size - 1
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 })
      return createReadStream(file, { start, end }).pipe(res)
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' })
    createReadStream(file).pipe(res)
  })
  return new Promise((ok) =>
    server.listen(port, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })),
  )
}

export async function main(argv = process.argv.slice(2)) {
  const dir = argv.find((a) => !a.startsWith('--')) ?? 'out'
  const i = argv.indexOf('--port')
  const port = i >= 0 ? Number(argv[i + 1]) : 4310
  if (!existsSync(join(dir, 'index.html'))) {
    console.error(`${dir}/index.html not found; build the page first`)
    process.exit(1)
  }
  const { url } = await serve(dir, port)
  console.log(`serving ${dir} at ${url} (Ctrl+C to stop)`)
}
