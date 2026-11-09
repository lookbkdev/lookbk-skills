// Journal Index Kit: records the built journal frame by frame into a video
// and a poster, or takes one still.
//
//   node scripts/record.mjs out/index.html [--seconds 10] [--size 1920x1080] [--fps 30] [--poster 0.4]
//   node scripts/record.mjs out/index.html --still 6.6 [--size 390x844 --scale 2] [--png file.png]
//   node scripts/record.mjs out/index.html --still 0 --page what-the-bench-taught-us/ --scroll .ji-pull --png article.png
//   node scripts/record.mjs out/index.html --moments [--size 390x844]
//
// The page runs with ?ji-record=1: nothing moves on its own. On the index
// the script is fixed: the masthead and lead (0 to 0.7 s), a scroll down to
// the index (0.7 to 2.1 s), the register rising (from 2.0 s), the preview
// slot following three rows (3.4, 4.7 and 6.0 s), one section filter
// (7.3 s), then a hold to 10 s. Every frame is drawn at its exact time
// (each animation is paused and set to that time), so the video is the same
// on any machine.
// --moments prints { stretches: [[from, to], ...], end }: the stretches in
// which nothing is moving. Take stills and posters from inside them.
// --page opens another page of the build (an article, a section page);
// --scroll puts a selector's element (or a number of pixels) 120 px from
// the top before the still; --full takes the whole page.
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
      out[k] = v ?? (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true)
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
  if (!existsSync(file)) throw new Error(`${input} not found; build the journal first`)
  const out = dirname(file)
  const [w, h] = String(opts.size ?? '1920x1080').split('x').map(Number)
  const scale = Number(opts.scale ?? 1)
  const fps = Number(opts.fps ?? 30)
  const server = await serve(out)
  const chrome = await launch({ width: Math.max(w, 800), height: h })
  const tmp = mkdtempSync(join(tmpdir(), 'journal-index-kit-'))
  const errors = []
  try {
    const tab = await chrome.page()
    chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: w < 760 })
    if (opts.reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const loaded = tab.once('Page.loadEventFired', 60000)
    const page = opts.page ? String(opts.page) : relative(out, file)
    await tab.send('Page.navigate', { url: `${server.url}${page}?ji-record=1` })
    await loaded
    const ev = async (expression) => {
      const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    for (let i = 0; i < 100 && !(await ev('!!(window.JournalIndex && window.JournalIndex.ready)')); i++) await new Promise((r) => setTimeout(r, 100))
    if (!(await ev('!!window.JournalIndex'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
    await ev('window.JournalIndex.ready')
    await new Promise((r) => setTimeout(r, 300))
    const length = Number(opts.seconds ?? (await ev('window.JournalIndex.length')))
    if (opts.moments) {
      const step = 1 / 30
      const stretches = []
      let from = null
      for (let t = 0; t <= length + 1e-9; t += step) {
        await ev(`window.JournalIndex.seek(${t.toFixed(4)})`)
        const busy = await ev('window.JournalIndex.busy()')
        if (!busy && from === null) from = t
        if (busy && from !== null) { stretches.push([r3(from), r3(t - step)]); from = null }
      }
      if (from !== null) stretches.push([r3(from), r3(length)])
      return { moments: { stretches: stretches.filter(([a, b]) => b - a >= 0.2), end: length } }
    }
    if (opts.still !== undefined) {
      const png = resolve(opts.png ?? join(out, 'still.png'))
      await ev(`window.JournalIndex.seek(${Math.min(Math.max(Number(opts.still) || 0, 0), length)})`)
      if (opts.scroll !== undefined) {
        const s = String(opts.scroll)
        const y = /^\d+$/.test(s) ? Number(s) : await ev(`(() => { const e = document.querySelector(${JSON.stringify(s)}); return e ? Math.max(0, e.getBoundingClientRect().top + scrollY - 120) : null })()`)
        if (y === null) throw new Error(`--scroll: nothing matches ${s}`)
        await ev(`(scrollTo(0, ${y}), window.JournalIndex.update && window.JournalIndex.update(), 1)`)
        await new Promise((r) => setTimeout(r, 250))
      }
      let params = { format: 'png' }
      if (opts.full) {
        const H = await ev('document.documentElement.scrollHeight')
        await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: H, deviceScaleFactor: scale, mobile: w < 760 })
        await new Promise((r) => setTimeout(r, 400))
        await ev('window.JournalIndex.update && window.JournalIndex.update()')
      }
      const { data } = await tab.send('Page.captureScreenshot', params)
      writeFileSync(png, Buffer.from(data, 'base64'))
      if (errors.length) console.warn(`page errors: ${errors.join(' | ')}`)
      return { png }
    }
    const frames = Math.round(length * fps)
    for (let i = 0; i < frames; i++) {
      await ev(`window.JournalIndex.seek(${(i / fps).toFixed(5)})`)
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(tmp, `${String(i + 1).padStart(5, '0')}.png`), Buffer.from(data, 'base64'))
    }
    const mp4 = join(out, 'preview.mp4')
    ffmpeg(['-framerate', String(fps), '-i', join(tmp, '%05d.png'), '-vf', `scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf ?? 18), '-movflags', '+faststart', mp4])
    const posterAt = Math.min(Math.max(Number(opts.poster ?? 0.4), 0), length - 1 / fps)
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
const r3 = (x) => Math.round(x * 1000) / 1000

export async function main(argv = process.argv.slice(2)) {
  const a = args(argv)
  const [input] = a._
  if (!input) {
    console.log('usage: node scripts/record.mjs out/index.html [--seconds 10] [--size 1920x1080] [--fps 30] [--poster 0.4]\n       node scripts/record.mjs out/index.html --still SECONDS [--size 390x844 --scale 2] [--png file.png] [--page slug/] [--scroll selector|px] [--full] [--reduce]\n       node scripts/record.mjs out/index.html --moments [--size 390x844]')
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
