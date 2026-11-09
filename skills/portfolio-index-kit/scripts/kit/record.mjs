// Work Index: records the built index running its fixed script (the pointer
// visits two rows, the plate hangs from each; Index to Grid and back; a
// filter and back), frame by frame, into a video and a poster; or takes one
// still of the index or of a case page.
//
//   node scripts/record.mjs out/index.html [--seconds 15] [--size 1920x1080] [--poster 3]
//   node scripts/record.mjs out/index.html --still 3 [--size 390x844 --scale 2] [--png file.png]
//   node scripts/record.mjs out/work/reixa-house.html --still 0 --png case.png [--full]
//   node scripts/record.mjs out/index.html --moments [--size 390x844]
//
// The page runs with ?wi-record=1: nothing moves on its own; for every frame
// the recorder asks the page to step its clock to that time (the pointer,
// the springs, the reveal, the riffle, FLIP and the scroll are all computed
// from it, loops are seeked to the same time). Phones (under 761 px) run a
// phone script: scroll to the list, tap a thumbnail, the plate opens inline.
// --moments prints {length, moments: [[label, from, to], ...]}: the stretches
// where nothing on the page is moving. Stills and posters belong inside them.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
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
  // a case page (out/work/x.html) is served from out/ so its ../media pictures load
  const out = basename(dirname(file)) === 'work' && existsSync(join(dirname(file), '..', 'index.html')) ? dirname(dirname(file)) : dirname(file)
  const [w, h] = String(opts.size ?? '1920x1080').split('x').map(Number)
  const scale = Number(opts.scale ?? 1)
  const fps = Number(opts.fps ?? 30)
  const server = await serve(out)
  const chrome = await launch({ width: Math.max(w, 800), height: h })
  const tmp = mkdtempSync(join(tmpdir(), 'work-index-'))
  const errors = []
  try {
    const tab = await chrome.page()
    chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: w < 760 })
    if (opts.reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const loaded = tab.once('Page.loadEventFired', 60000)
    const q = '?wi-record=1'
    await tab.send('Page.navigate', { url: `${server.url}${relative(out, file)}${q}` })
    await loaded
    const ev = async (expression) => {
      const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    const isIndex = await ev('!!document.querySelector(".wi-idx")')
    if (isIndex) {
      for (let i = 0; i < 100 && !(await ev('!!window.WorkIndex')); i++) await new Promise((r) => setTimeout(r, 100))
      if (!(await ev('!!window.WorkIndex'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
      await ev('window.WorkIndex.ready')
    } else await ev('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => { i.loading = "eager"; return i.decode().catch(() => {}) })))')
    await new Promise((r) => setTimeout(r, 300))
    const length = Number(opts.seconds ?? (isIndex ? await ev('window.WorkIndex.length') : 1))
    const shot = async (t, path) => {
      if (isIndex) await ev(`window.WorkIndex.seek(${t})`)
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(path, Buffer.from(data, 'base64'))
    }
    if (opts.moments) return { moments: { length, moments: await ev('window.WorkIndex.moments()') } }
    if (opts.still !== undefined) {
      const png = resolve(opts.png ?? join(out, 'still.png'))
      if (isIndex) await ev(`window.WorkIndex.seek(${Math.min(Math.max(Number(opts.still) || 0, 0), length)})`)
      if (opts.full) {
        const H = await ev('document.documentElement.scrollHeight')
        await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: Math.min(H, 16000), deviceScaleFactor: scale, mobile: w < 760 })
        await new Promise((r) => setTimeout(r, 400))
        await ev('Promise.all([...document.images].map((i) => i.decode().catch(() => {})))')
      }
      let clip
      if (opts.clip) {
        // one part of the page, with a margin: --clip ".cc-st"
        const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(String(opts.clip))}); if (!e) return null; e.scrollIntoView({ block: 'center' }); dispatchEvent(new Event('scroll')); const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height } })()`)
        if (!r) throw new Error(`--clip: nothing matches ${opts.clip}`)
        await new Promise((r) => setTimeout(r, 150))
        const m = Number(opts.margin ?? 24)
        clip = { x: Math.max(0, r.x - m), y: Math.max(0, r.y - m), width: r.w + 2 * m, height: r.h + 2 * m, scale: 1 }
      }
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) })
      writeFileSync(png, Buffer.from(data, 'base64'))
      return { png }
    }
    const frames = Math.round(length * fps)
    for (let i = 0; i < frames; i++) await shot(i / fps, join(tmp, `${String(i + 1).padStart(5, '0')}.png`))
    const mp4 = join(out, 'preview.mp4')
    ffmpeg(['-framerate', String(fps), '-i', join(tmp, '%05d.png'), '-vf', `scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf ?? 18), '-movflags', '+faststart', mp4])
    const posterAt = Math.min(Math.max(Number(opts.poster ?? 3), 0), length - 1 / fps)
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
    console.log('usage: node scripts/record.mjs out/index.html [--seconds 15] [--size 1920x1080] [--poster 3]\n       node scripts/record.mjs out/index.html --still SECONDS [--size 390x844 --scale 2] [--png file.png] [--full]\n       node scripts/record.mjs out/work/<slug>.html --still 0 [--png case.png] [--full]\n       node scripts/record.mjs out/index.html --moments [--size 390x844]')
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
