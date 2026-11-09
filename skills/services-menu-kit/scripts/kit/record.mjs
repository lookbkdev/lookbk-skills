// Services Menu Kit: records the built page frame by frame into a video and
// a poster, takes one still, or prints the page's settled moments.
//
//   node scripts/record.mjs out/index.html [--seconds 18] [--size 1920x1080] [--poster 2.5]
//   node scripts/record.mjs out/index.html --still 6.2 [--size 390x844 --scale 2] [--png file.png]
//   node scripts/record.mjs out/index.html --moments
//   node scripts/record.mjs out/index.html --full 0 [--size 1440x900] [--png file.png]   (the whole page, at a moment, as it is laid out)
//
// The page runs with ?sm-record=1: nothing moves on its own, and for every
// frame the recorder asks it to show one moment of its fixed script (the
// menu at rest, scroll to "help me choose", make the first choice and let
// the verdicts draw, change the budget so some verdicts change, scroll to the
// main course, end on the set menus). Every frame is taken at its exact time, so the video is the same
// on any machine. --moments prints { length, moments: [[name, from, to]] }:
// the stretches where nothing is moving, which is where stills are taken.
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
const shown = (p) => {
  const r = relative(process.cwd(), p)
  return r.startsWith('..') ? p : r
}
function ffmpeg(argv) {
  const bin = process.env.FFMPEG_PATH || 'ffmpeg'
  const r = spawnSync(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: ['ignore', 'inherit', 'pipe'] })
  if (r.error) throw new Error('ffmpeg not found: install it (brew install ffmpeg, winget install ffmpeg, apt install ffmpeg) or set FFMPEG_PATH')
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr).slice(-600)}`)
}

export async function record(input, opts = {}) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const out = dirname(file)
  const [w, h] = String(opts.size ?? '1920x1080').split('x').map(Number)
  const scale = Number(opts.scale ?? 1)
  const fps = Number(opts.fps ?? 30)
  const server = await serve(out)
  const chrome = await launch({ width: Math.max(w, 800), height: h })
  const tmp = mkdtempSync(join(tmpdir(), 'services-menu-kit-'))
  const errors = []
  try {
    const tab = await chrome.page()
    chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: w < 760 })
    if (opts.reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url: `${server.url}${relative(out, file)}?sm-record=1` })
    await loaded
    const ev = async (expression) => {
      const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    for (let i = 0; i < 100 && !(await ev('!!window.ServicesMenu')); i++) await new Promise((r) => setTimeout(r, 100))
    if (!(await ev('!!window.ServicesMenu'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
    await ev('window.ServicesMenu.ready')
    await new Promise((r) => setTimeout(r, 300))
    const length = Number(opts.seconds ?? (await ev('window.ServicesMenu.length')))
    if (opts.moments) return { moments: { length: await ev('window.ServicesMenu.length'), moments: await ev('window.ServicesMenu.moments') } }
    const settle = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
    const shot = async (t, path) => {
      await ev(`window.ServicesMenu.seek(${t})`)
      await settle()
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(path, Buffer.from(data, 'base64'))
    }
    if (opts.full !== undefined) {
      const png = resolve(opts.png ?? join(out, 'full.png'))
      await ev(`window.ServicesMenu.seek(${Number(opts.full) || 0})`)
      await settle()
      await ev('scrollTo(0, 0)')
      const H = await ev('document.documentElement.scrollHeight')
      await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: H, deviceScaleFactor: scale, mobile: w < 760 })
      await settle()
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      writeFileSync(png, Buffer.from(data, 'base64'))
      return { png }
    }
    if (opts.still !== undefined) {
      const png = resolve(opts.png ?? join(out, 'still.png'))
      await shot(Math.min(Math.max(Number(opts.still) || 0, 0), length), png)
      return { png }
    }
    const frames = Math.round(length * fps)
    for (let i = 0; i < frames; i++) await shot(i / fps, join(tmp, `${String(i + 1).padStart(5, '0')}.png`))
    const mp4 = join(out, 'preview.mp4')
    ffmpeg(['-framerate', String(fps), '-i', join(tmp, '%05d.png'), '-vf', `scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf ?? 18), '-movflags', '+faststart', mp4])
    const posterAt = Math.min(Math.max(Number(opts.poster ?? 2.5), 0), length - 1 / fps)
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
    console.log('usage: node scripts/record.mjs out/index.html [--seconds 18] [--size 1920x1080] [--poster 2.5]\n       node scripts/record.mjs out/index.html --still SECONDS [--size 390x844 --scale 2] [--png file.png] [--reduce]\n       node scripts/record.mjs out/index.html --moments\n       node scripts/record.mjs out/index.html --full SECONDS [--size 1440x900] [--png file.png]')
    process.exit(1)
  }
  try {
    const r = await record(input, a)
    if (r.moments) console.log(JSON.stringify(r.moments))
    else if (r.png) console.log(`wrote ${shown(r.png)}`)
    else console.log(`wrote ${shown(r.mp4)} and ${shown(r.poster)}`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
