// Event Page Kit: records the built page frame by frame into a video and a
// poster, or takes one still.
//
//   node scripts/record.mjs out/index.html [--seconds 18.5] [--size 1920x1080] [--poster 1.3]
//   node scripts/record.mjs out/index.html --still 5.1 [--size 390x844 --scale 2] [--png file.png] [--clock before|preview|after]
//   node scripts/record.mjs out/index.html --full [--size 1440x900] [--clock preview] --png page.png
//   node scripts/record.mjs out/index.html --moments
//
// The page runs with ?ev-record=1: nothing moves on its own, the clock is
// the config's preview clock (or --clock before / after), and for every frame
// the recorder asks the page to scroll along its fixed script: the cover,
// the programme at the preview "now", the same programme a few hours later
// on a fast clock (the now line moves and sessions turn past), the
// speakers, the tickets, the venue. Every frame is taken at its exact time,
// so the video is the same on any machine. --moments prints { length, holds:
// [{ name, from, to }] }: the stretches where nothing on screen moves.
// Stills and posters belong inside a hold.
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

/** Opens the built page in a recording tab; resolves to { tab, ev, close }. */
export async function openPage(input, { size = '1920x1080', scale = 1, clock, zone, reduce, record = true, query = '' } = {}) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the page first`)
  const [w, h] = String(size).split('x').map(Number)
  const server = await serve(dirname(file))
  const chrome = await launch({ width: Math.max(w, 800), height: h })
  const errors = []
  try {
    const tab = await chrome.page()
    chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: Number(scale), mobile: w < 760 })
    if (w < 760) await tab.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] })
    const loaded = tab.once('Page.loadEventFired', 60000)
    const qs = new URLSearchParams({ ...(record ? { 'ev-record': '1' } : {}), ...(clock ? { 'ev-clock': clock } : {}), ...(zone ? { 'ev-zone': zone } : {}) })
    await tab.send('Page.navigate', { url: `${server.url}${relative(dirname(file), file)}?${qs}${query}` })
    await loaded
    const ev = async (expression) => {
      const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    for (let i = 0; i < 100 && !(await ev('!!window.EventKit')); i++) await new Promise((r) => setTimeout(r, 100))
    if (!(await ev('!!window.EventKit'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
    await ev('window.EventKit.ready')
    await new Promise((r) => setTimeout(r, 300))
    return { tab, chrome, ev, errors, w, h, out: dirname(file), close: async () => { await chrome.close(); server.close() } }
  } catch (e) {
    await chrome.close(); server.close()
    throw e
  }
}

export async function record(input, opts = {}) {
  const fps = Number(opts.fps ?? 30)
  const scale = Number(opts.scale ?? 1)
  const clock = typeof opts.clock === 'string' ? opts.clock : undefined
  const P = await openPage(input, { size: opts.size ?? '1920x1080', scale, clock, zone: typeof opts.zone === 'string' ? opts.zone : undefined, reduce: !!opts.reduce })
  const { tab, ev, errors, w, h, out } = P
  const tmp = mkdtempSync(join(tmpdir(), 'event-page-kit-'))
  try {
    const length = Number(opts.seconds ?? (await ev('window.EventKit.length')))
    if (opts.moments) return { moments: await ev('window.EventKit.moments()') }
    const snap = async (path) => {
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(path, Buffer.from(data, 'base64'))
    }
    if (opts.full) {
      await ev('window.EventKit.seek(5)')
      const H = await ev('document.documentElement.scrollHeight')
      await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: H, deviceScaleFactor: scale, mobile: w < 760 })
      await new Promise((r) => setTimeout(r, 300))
      await ev('window.EventKit.fit(); scrollTo(0, 0)')
      await new Promise((r) => setTimeout(r, 150))
      const png = resolve(opts.png ?? join(out, 'full.png'))
      await snap(png)
      return { png }
    }
    if (opts.still !== undefined) {
      const png = resolve(opts.png ?? join(out, 'still.png'))
      await ev(`window.EventKit.seek(${Math.min(Math.max(Number(opts.still) || 0, 0), length)})`)
      await new Promise((r) => setTimeout(r, 150))
      await snap(png)
      return { png }
    }
    const frames = Math.round(length * fps)
    for (let i = 0; i < frames; i++) {
      await ev(`window.EventKit.seek(${i / fps})`)
      await snap(join(tmp, `${String(i + 1).padStart(5, '0')}.png`))
    }
    const mp4 = join(out, 'preview.mp4')
    ffmpeg(['-framerate', String(fps), '-i', join(tmp, '%05d.png'), '-vf', `scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf ?? 18), '-movflags', '+faststart', mp4])
    const posterAt = Math.min(Math.max(Number(opts.poster ?? 1.3), 0), length - 1 / fps)
    const poster = join(out, 'poster.png')
    ffmpeg(['-ss', String(posterAt), '-i', mp4, '-frames:v', '1', '-update', '1', poster])
    if (errors.length) console.warn(`page errors: ${errors.join(' | ')}`)
    return { mp4, poster }
  } finally {
    await P.close()
    rmSync(tmp, { recursive: true, force: true })
  }
}

export async function main(argv = process.argv.slice(2)) {
  const a = args(argv)
  const [input] = a._
  if (!input) {
    console.log('usage: node scripts/record.mjs out/index.html [--seconds 18.5] [--size 1920x1080] [--poster 1.3]\n       node scripts/record.mjs out/index.html --still SECONDS [--size 390x844 --scale 2] [--png file.png] [--clock before|preview|after] [--zone America/New_York] [--reduce]\n       node scripts/record.mjs out/index.html --full [--size 1440x900] [--png page.png]\n       node scripts/record.mjs out/index.html --moments')
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
