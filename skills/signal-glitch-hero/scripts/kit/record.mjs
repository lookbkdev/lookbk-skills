#!/usr/bin/env node
// Motion Heroes kit: records the built hero to a smooth video and a poster.
//
//   node scripts/record.mjs out/index.html [--seconds 8] [--size 1920x1080] [--fps 30]
//        [--poster 4.4] [--scale 1] [--crf 18]
//   node scripts/record.mjs out/index.html --still 4.4 [--size 390x844] [--scale 2] [--png file.png]
//
// It opens the page in headless Chrome (driven over --remote-debugging-pipe,
// nothing to install), stops the hero's clock and steps it frame by frame:
// every frame is drawn at exactly its time and captured, so the video is
// smooth however slow the machine is. ffmpeg encodes the frames.
//
// Writes out/preview.mp4 (H.264, plays everywhere) and out/poster.png (the
// frame at --poster, default the effect's own poster moment). With --still
// it writes one PNG and no video.
//
// Needs Chrome, Chromium or Edge (set CHROME_PATH if it isn't found) and
// ffmpeg on the PATH (or FFMPEG_PATH).
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launch } from './cdp.mjs'

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

export async function record(input, opts = {}) {
  const file = resolve(input)
  if (!existsSync(file)) throw new Error(`${input} not found; build the hero first`)
  const [width, height] = String(opts.size ?? '1920x1080')
    .split('x')
    .map(Number)
  if (!(width >= 200 && height >= 200)) throw new Error('--size is WIDTHxHEIGHT, e.g. 1920x1080')
  const scale = Number(opts.scale ?? 1)
  const fps = Number(opts.fps ?? 30)
  const seconds = Number(opts.seconds ?? 8)
  const still = opts.still !== undefined ? Number(opts.still) : null
  const crf = Number(opts.crf ?? 18)
  const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg'
  if (still === null) {
    if (!(fps >= 1 && fps <= 120)) throw new Error('--fps is 1 to 120')
    if (!(seconds > 0 && seconds <= 120)) throw new Error('--seconds is up to 120')
    if ((width * scale) % 2 || (height * scale) % 2) throw new Error('--size must be even numbers for H.264')
    const probe = spawnSync(ffmpegBin, ['-version'], { stdio: 'ignore' })
    if (probe.error || probe.status !== 0)
      throw new Error('ffmpeg not found: install it (ffmpeg.org, brew install ffmpeg, winget install ffmpeg, apt install ffmpeg) or set FFMPEG_PATH')
  }

  const chrome = await launch({ width, height })
  const errors = []
  try {
    const tab = await chrome.page()
    const send = tab.send
    chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    chrome.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error' || p.type === 'warning')
        errors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' '))
    })
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: width < 600 })
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
    const loaded = tab.once('Page.loadEventFired', 60000)
    await send('Page.navigate', { url: pathToFileURL(file).href + '?mh-record=1' })
    await loaded
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    // The hero's script may still be starting; wait for it.
    for (let i = 0; i < 100 && !(await evaluate('!!window.MotionHero')); i++) await new Promise((r) => setTimeout(r, 100))
    if (!(await evaluate('!!window.MotionHero')))
      throw new Error(`the page has no Motion Hero runtime (is it a hero built by build.mjs?) ${errors.join(' ')}`)
    const ready = await evaluate('MotionHero.ready')
    await evaluate('document.fonts.ready.then(() => true)')
    if (!ready.ok)
      throw new Error(
        `the effect didn't start (${ready.reason}), so the page shows its still picture. Check the internet connection (three.js and fonts load from a CDN) and that Chrome can use WebGL.`,
      )
    const story = await evaluate('MotionHero.story || null')
    if (story && still === null) {
      const need = await evaluate('MotionHero.storySeconds')
      console.log(`  story: drive "${story.drive}"${story.drive === 'scroll' ? `, the page scrolls through ${story.pin} screen heights on a scripted path` : ''}; it ends at ${need.toFixed(1)}s`)
      if (seconds < need) console.log(`  · --seconds ${seconds} stops before the story ends; use --seconds ${Math.ceil(need + 1)} for all of it`)
    }
    const posterAt = opts.poster !== undefined ? Number(opts.poster) : await evaluate('MotionHero.posterTime')
    const shot = async () => {
      const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, optimizeForSpeed: true })
      return Buffer.from(data, 'base64')
    }

    if (still !== null) {
      await evaluate(`MotionHero.seek(${still})`)
      const png = resolve(opts.png ?? join(dirname(file), `still-${width}x${height}.png`))
      writeFileSync(png, await shot())
      console.log(`  ${shown(png)}  ${width * scale}×${height * scale}, t = ${still}s`)
      return { png }
    }

    const mp4 = resolve(opts.out ?? join(dirname(file), 'preview.mp4'))
    const poster = resolve(opts.posterFile ?? join(dirname(file), 'poster.png'))
    const ff = spawn(
      ffmpegBin,
      ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    )
    const encoded = new Promise((ok, no) => {
      ff.on('error', no)
      ff.on('exit', (code) => (code === 0 ? ok() : no(new Error(`ffmpeg exited ${code}`))))
    })
    const total = Math.round(seconds * fps)
    const posterFrame = Math.min(total - 1, Math.round(posterAt * fps))
    const t0 = Date.now()
    for (let i = 0; i < total; i++) {
      await evaluate(`MotionHero.seek(${i / fps})`)
      const png = await shot()
      if (i === posterFrame) writeFileSync(poster, png)
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
      if ((i + 1) % fps === 0 || i === total - 1)
        process.stdout.write(`\r  recording ${i + 1}/${total} frames (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
    }
    ff.stdin.end()
    await encoded
    process.stdout.write('\n')
    console.log(`  ${shown(mp4)}  ${width * scale}×${height * scale}, ${seconds}s at ${fps} fps`)
    console.log(`  ${shown(poster)}  frame at ${(posterFrame / fps).toFixed(2)}s`)
    const real = errors.filter((e) => e && !/showing the still picture/.test(e))
    if (real.length) console.log(`  · the page logged: ${[...new Set(real)].slice(0, 3).join(' | ')}`)
    return { mp4, poster }
  } finally {
    await chrome.close()
  }
}

export async function main() {
  const a = args(process.argv.slice(2))
  if (!a._[0] || a.help) {
    console.error('usage: node scripts/record.mjs out/index.html [--seconds 8] [--size 1920x1080] [--fps 30] [--poster T] [--scale 1]\n       node scripts/record.mjs out/index.html --still T [--size 390x844] [--scale 2] [--png file.png]')
    process.exit(1)
  }
  try {
    await record(a._[0], {
      seconds: a.seconds,
      size: a.size,
      fps: a.fps,
      poster: a.poster,
      scale: a.scale,
      still: a.still,
      png: a.png,
      out: a.out,
      crf: a.crf,
    })
  } catch (e) {
    console.error(`\nrecord: ${e.message}`)
    process.exit(1)
  }
}
