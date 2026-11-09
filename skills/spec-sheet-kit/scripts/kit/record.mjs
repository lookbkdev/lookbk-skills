// Spec Sheet Kit: records the built page's tour frame by frame into a video
// and a poster, or takes one still, or prints the sheet.
//
//   node scripts/record.mjs out/index.html [--seconds 14] [--size 1920x1080] [--poster 2.4]
//   node scripts/record.mjs out/index.html --still 2.4 [--size 390x844 --scale 2] [--png file.png]
//   node scripts/record.mjs out/index.html --moments [--size 390x844]
//   node scripts/record.mjs out/index.html --print [--png sheet.png] [--pdf sheet.pdf]
//
// The page runs with ?ss-record=1: nothing moves on its own, and for every
// frame the recorder asks it to step its tour (spec.json "tour": the
// dimensions draw in, then each step points at a line, a part or a control
// and holds). Every frame is taken at its exact time, so the video is the
// same on any machine. --moments prints when nothing moves: { length, rest,
// steps, settled }, so stills and posters are only taken at rest.
// --print saves the page as the browser prints it (PDF) and, with --png, a
// picture of that one printed sheet (print styles, paper size, margins).
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

function args(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) out._.push(a)
    else {
      const [k, v] = a.slice(2).split('=')
      out[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true)
    }
  }
  return out
}
const shown = (p) => { const r = relative(process.cwd(), p); return r.startsWith('..') ? p : r }
function ffmpeg(argv) {
  const bin = process.env.FFMPEG_PATH || 'ffmpeg'
  const r = spawnSync(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: ['ignore', 'inherit', 'pipe'] })
  if (r.error) throw new Error('ffmpeg not found: install it (brew install ffmpeg, winget install ffmpeg, apt install ffmpeg) or set FFMPEG_PATH')
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr).slice(-600)}`)
}
/** Page count of a PDF Chrome wrote. */
export const pdfPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
export const PAPER = { A4: [11.69, 8.27], Letter: [11, 8.5] }

export async function record(input, opts = {}) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const out = dirname(file)
  const [w, h] = String(opts.size ?? '1920x1080').split('x').map(Number)
  const scale = Number(opts.scale ?? 1)
  const fps = Number(opts.fps ?? 30)
  const server = await serve(out)
  const chrome = await launch({ width: Math.max(w, 800), height: h })
  const tmp = mkdtempSync(join(tmpdir(), 'spec-sheet-kit-'))
  const errors = []
  try {
    const tab = await chrome.page()
    chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: w < 760 })
    if (opts.reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url: `${server.url}${relative(out, file)}${opts.print ? '' : '?ss-record=1'}` })
    await loaded
    const ev = async (expression) => {
      const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    for (let i = 0; i < 100 && !(await ev('!!(window.SpecSheet && window.SpecSheet.ready)')); i++) await new Promise((r) => setTimeout(r, 100))
    if (!(await ev('!!window.SpecSheet'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
    await ev('window.SpecSheet.ready')
    await new Promise((r) => setTimeout(r, 300))

    if (opts.print) {
      // the sheet as the browser prints it
      const paper = await ev(`JSON.parse(document.querySelector('.ss-data').textContent).print?.paper || 'A4'`)
      const [pw, ph] = PAPER[paper]
      const r = await tab.send('Page.printToPDF', { landscape: true, paperWidth: pw, paperHeight: ph, printBackground: true, preferCSSPageSize: true })
      const pdf = Buffer.from(r.data, 'base64')
      const pdfPath = resolve(opts.pdf ?? join(out, 'sheet.pdf'))
      writeFileSync(pdfPath, pdf)
      let png
      if (opts.png) {
        // a picture of the printed page: print styles at the paper's size, its margins as white
        const W = Math.round(pw * 96), H = Math.round(ph * 96), M = Math.round(9 / 25.4 * 96)
        await tab.send('Emulation.setDeviceMetricsOverride', { width: W - 2 * M, height: H - 2 * M, deviceScaleFactor: 2, mobile: false })
        await tab.send('Emulation.setEmulatedMedia', { media: 'print' })
        await new Promise((r) => setTimeout(r, 500))
        const { data } = await tab.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W - 2 * M, height: H - 2 * M, scale: 1 } })
        const inner = join(tmp, 'inner.png')
        writeFileSync(inner, Buffer.from(data, 'base64'))
        png = resolve(opts.png)
        ffmpeg(['-i', inner, '-vf', `pad=${2 * W}:${2 * H}:${2 * M}:${2 * M}:color=white`, '-frames:v', '1', '-update', '1', png])
      }
      return { pdf: pdfPath, pages: pdfPages(pdf), png, paper }
    }

    const length = Number(opts.seconds ?? (await ev('window.SpecSheet.length')))
    if (opts.moments) return { moments: { length, ...(await ev('({ rest: SpecSheet.moments.rest, steps: SpecSheet.moments.steps, settled: SpecSheet.settled })')) } }
    const shot = async (t, path) => {
      await ev(`window.SpecSheet.seek(${t})`)
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(path, Buffer.from(data, 'base64'))
    }
    if (opts.still !== undefined) {
      const png = resolve(opts.png ?? join(out, 'still.png'))
      const t = Math.min(Math.max(Number(opts.still) || 0, 0), length)
      await ev(`window.SpecSheet.seek(${t})`)
      await new Promise((r) => setTimeout(r, 150))
      const settled = await ev(`window.SpecSheet.settled.some(([a, b]) => ${t} >= a && ${t} <= b)`)
      if (!settled) console.warn(`note: ${t}s is not inside a settled stretch (${await ev('JSON.stringify(window.SpecSheet.settled)')})`)
      let clip
      if (opts.full) {
        const hh = await ev('document.documentElement.scrollHeight')
        await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: hh, deviceScaleFactor: scale, mobile: w < 760 })
        await new Promise((r) => setTimeout(r, 300))
        await ev(`window.SpecSheet.seek(${t})`)
      }
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) })
      writeFileSync(png, Buffer.from(data, 'base64'))
      return { png }
    }
    const frames = Math.round(length * fps)
    for (let i = 0; i < frames; i++) await shot(i / fps, join(tmp, `${String(i + 1).padStart(5, '0')}.png`))
    const mp4 = join(out, 'preview.mp4')
    ffmpeg(['-framerate', String(fps), '-i', join(tmp, '%05d.png'), '-vf', `scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf ?? 18), '-movflags', '+faststart', mp4])
    const posterAt = Math.min(Math.max(Number(opts.poster ?? (await ev('window.SpecSheet.moments.rest'))), 0), length - 1 / fps)
    const poster = join(out, 'poster.png')
    ffmpeg(['-ss', String(posterAt), '-i', mp4, '-frames:v', '1', '-update', '1', poster])
    if (errors.length) console.warn(`page errors: ${errors.join(' | ')}`)
    return { mp4, poster }
  } finally {
    await chrome.close()
    server.close()
    rmSync(tmp, { recursive: true, force: true })
  }
}

export async function main(argv = process.argv.slice(2)) {
  const a = args(argv)
  const [input] = a._
  if (!input) {
    console.log('usage: node scripts/record.mjs out/index.html [--seconds S] [--size 1920x1080] [--poster S]\n       node scripts/record.mjs out/index.html --still S [--size 390x844 --scale 2] [--png file.png] [--full]\n       node scripts/record.mjs out/index.html --moments [--size 390x844]\n       node scripts/record.mjs out/index.html --print [--png sheet.png] [--pdf sheet.pdf]')
    process.exit(1)
  }
  try {
    const r = await record(input, a)
    if (r.moments) console.log(JSON.stringify(r.moments))
    else if (r.pdf) console.log(`wrote ${shown(r.pdf)} (${r.pages} page${r.pages === 1 ? '' : 's'}, ${r.paper} landscape)${r.png ? ` and ${shown(r.png)}` : ''}`)
    else if (r.png) console.log(`wrote ${shown(r.png)}`)
    else console.log(`wrote ${shown(r.mp4)} and ${shown(r.poster)}`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
