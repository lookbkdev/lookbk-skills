// Feature Tabs Kit: records the built section touring its tabs, frame by
// frame, into a video and a poster, or takes one still.
//
//   node scripts/record.mjs out/index.html [--seconds 12] [--size 1920x1080] [--poster 1.2]
//   node scripts/record.mjs out/index.html --still 4.2 [--size 390x844 --scale 2] [--png file.png]
//   node scripts/record.mjs out/index.html --still 1 --full --png page.png     (the whole page)
//   node scripts/record.mjs out/index.html --still 0 --nojs --full --png stacked.png
//   node scripts/record.mjs out/index.html --moments
//
// The page runs with ?ftk-record=1: the tour's clock is off, and for every
// frame the recorder asks the page to draw its fixed script at that time
// (each tab held for 2.1 s, then a 0.9 s switch to the next, looping), with
// every animation paused at its exact time. So the video is the same on any
// machine. --moments prints { length, settled: [[from, to, tab]...],
// switches: [[from, to, fromTab, toTab]...] }: stills are taken from inside
// the settled stretches, or on purpose half way through a switch.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { launch } from './cdp.mjs'
import { serve } from './serve.mjs'

export function args(argv) {
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
  const tmp = mkdtempSync(join(tmpdir(), 'feature-tabs-kit-'))
  const errors = []
  try {
    const tab = await chrome.page()
    chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false })
    if (opts.reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    if (opts.nojs) await tab.send('Emulation.setScriptExecutionDisabled', { value: true })
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url: `${server.url}${relative(out, file)}?ftk-record=1` })
    await loaded
    const ev = async (expression) => {
      const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    const capture = async (path) => {
      let clip
      if (opts.full) {
        const H = await ev('document.documentElement.scrollHeight')
        await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: H, deviceScaleFactor: scale, mobile: false })
        await new Promise((r) => setTimeout(r, 300))
        if (!opts.nojs) await ev('window.FeatureTabs.measure(), scrollTo(0, 0)')
      }
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) })
      writeFileSync(path, Buffer.from(data, 'base64'))
    }
    if (opts.nojs) {
      await new Promise((r) => setTimeout(r, 1500))
      const png = resolve(opts.png ?? join(out, 'stacked.png'))
      await capture(png)
      return { png }
    }
    for (let i = 0; i < 100 && !(await ev('!!(window.FeatureTabs && window.FeatureTabs.ready)')); i++) await new Promise((r) => setTimeout(r, 100))
    if (!(await ev('!!window.FeatureTabs'))) throw new Error(`the page did not start: ${errors.join(' | ') || 'unknown'}`)
    await ev('window.FeatureTabs.ready')
    await new Promise((r) => setTimeout(r, 300))
    await ev('window.FeatureTabs.place()')
    const length = Number(opts.seconds ?? (await ev('window.FeatureTabs.length')))
    if (opts.moments) return { moments: await ev('window.FeatureTabs.moments()') }
    if (opts.still !== undefined) {
      const png = resolve(opts.png ?? join(out, 'still.png'))
      await ev(`window.FeatureTabs.seek(${Number(opts.still) || 0})`)
      await new Promise((r) => setTimeout(r, 150))
      await capture(png)
      return { png }
    }
    const frames = Math.round(length * fps)
    for (let i = 0; i < frames; i++) {
      await ev(`window.FeatureTabs.seek(${i / fps})`)
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(tmp, `${String(i + 1).padStart(5, '0')}.png`), Buffer.from(data, 'base64'))
    }
    const mp4 = join(out, 'preview.mp4')
    ffmpeg(['-framerate', String(fps), '-i', join(tmp, '%05d.png'), '-vf', `scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf ?? 18), '-movflags', '+faststart', mp4])
    const posterAt = Math.min(Math.max(Number(opts.poster ?? 1.2), 0), length - 1 / fps)
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
    console.log('usage: node scripts/record.mjs out/index.html [--seconds 12] [--size 1920x1080] [--poster 1.2]\n       node scripts/record.mjs out/index.html --still SECONDS [--size 390x844 --scale 2] [--png file.png] [--full] [--reduce] [--nojs]\n       node scripts/record.mjs out/index.html --moments')
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
