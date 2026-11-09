// Story Rail: records the built page running its fixed script, frame by
// frame, into a video and a poster; or takes one still; or lists the
// moments where nothing on the rail is moving.
//
//   node scripts/record.mjs out/index.html [--seconds 19] [--size 1920x1080] [--poster 3]
//   node scripts/record.mjs out/index.html --still 3 [--size 390x844 --scale 2] [--png file.png] [--full]
//   node scripts/record.mjs out/index.html --moments [--size 390x844]
//
// The page runs with ?sr-record=1: snapping and transitions are off and,
// for every frame, the recorder asks the page to step its clock to that
// time. The script: Next twice, a pause on a card (the picture zooms in), a
// mouse drag that coasts and settles on a card, a click on the last segment
// of the scale, a click on the first. On a phone (under 761 px) the same
// moves are swipes and taps. --moments prints {length, moments: [[label,
// from, to], ...]}: the stretches where the rail, the cursor and every hover
// are still. Stills and posters belong inside them.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, basename } from 'node:path'
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
  const tmp = mkdtempSync(join(tmpdir(), 'story-rail-'))
  const errors = []
  try {
    const tab = await chrome.page()
    chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: w < 761 })
    if (opts.reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url: `${server.url}${basename(file)}?sr-record=1` })
    await loaded
    const ev = async (expression) => {
      const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    for (let i = 0; i < 100 && !(await ev('!!window.StoryRailReady')); i++) await new Promise((r) => setTimeout(r, 100))
    if (!(await ev('!!window.StoryRailReady'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
    await ev('window.StoryRailReady.then(() => true)')
    await new Promise((r) => setTimeout(r, 300))
    const length = Number(opts.seconds ?? (await ev('window.StoryRail.length')))
    if (opts.moments) return { moments: { length, moments: await ev('window.StoryRail.moments()') } }
    const seek = (t) => ev(`(window.StoryRail.seek(${t}), new Promise((r) => requestAnimationFrame(() => r(1))))`)
    if (opts.still !== undefined) {
      const png = resolve(opts.png ?? join(out, 'still.png'))
      await seek(Math.min(Math.max(Number(opts.still) || 0, 0), length))
      let params = { format: 'png' }
      if (opts.full) {
        const H = await ev('document.documentElement.scrollHeight')
        await ev('scrollTo(0, 0)')
        await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: Math.min(H, 16000), deviceScaleFactor: scale, mobile: w < 761 })
        await new Promise((r) => setTimeout(r, 400))
        await ev('window.StoryRail.layout()')
        await ev('scrollTo(0, 0)')
        await seek(Math.min(Math.max(Number(opts.still) || 0, 0), length))
        await ev('scrollTo(0, 0); document.querySelector(".sr-cursor").style.display = "none"')
      }
      await new Promise((r) => setTimeout(r, 120))
      const { data } = await tab.send('Page.captureScreenshot', params)
      writeFileSync(png, Buffer.from(data, 'base64'))
      return { png }
    }
    const frames = Math.round(length * fps)
    for (let i = 0; i < frames; i++) {
      await seek(i / fps)
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(tmp, `${String(i + 1).padStart(5, '0')}.png`), Buffer.from(data, 'base64'))
    }
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
    console.log('usage: node scripts/record.mjs out/index.html [--seconds 19] [--size 1920x1080] [--poster 3]\n       node scripts/record.mjs out/index.html --still SECONDS [--size 390x844 --scale 2] [--png file.png] [--full]\n       node scripts/record.mjs out/index.html --moments [--size 390x844]')
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
