// Newsletter Kit: records the built page frame by frame into a video and a
// poster, or takes one still.
//
//   node scripts/record.mjs out/index.html [--seconds 12] [--size 1920x1080] [--poster 7.5]
//   node scripts/record.mjs out/index.html --still 7.5 [--size 390x844 --scale 2] [--png file.png]
//   node scripts/record.mjs out/index.html --still 2.5 --state invalid:"ana@weiss" --clip .nk-zone --png invalid.png
//   node scripts/record.mjs out/index.html --still 2.6 --size 390x844 --scale 2 --at .nk-spec --png issue.png
//   node scripts/record.mjs out/index.html --moments
//
// The page runs with ?nk-record=1: nothing moves on its own, the clock is
// pinned to the config's "today", and for every frame the recorder asks the
// page to draw that exact moment of its script (the inbox arrives, an address
// is typed and mirrored on the sample email's "to:" line, it is sent, the
// confirmation email lands in the inbox, and on the page layout the archive).
// --moments prints the page's holds: stretches where nothing on screen moves.
// Stills, posters and phone stills are taken inside them.
// The reader's time zone is the config's demo.readerTz (or --tz), so the
// times the page shows are the same on any machine.
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

/** Opens the page in record mode at `w`×`h`, in the reader's time zone. */
export async function openPage(chrome, server, file, { w, h, scale = 1, reduce = false, tz, query = 'nk-record=1' }) {
  const out = dirname(file)
  const tab = await chrome.page()
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: w < 760 })
  if (reduce) await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  const ev = async (expression) => {
    const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  const url = `${server.url}${relative(out, file)}${query ? '?' + query : ''}`
  const go = async () => {
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url })
    await loaded
    for (let i = 0; i < 100 && !(await ev('!!window.NewsletterKit')); i++) await new Promise((r) => setTimeout(r, 100))
    if (!(await ev('!!window.NewsletterKit'))) throw new Error('the page did not start (no window.NewsletterKit)')
    await ev('window.NewsletterKit.ready')
  }
  await go()
  const zone = tz ?? (await ev('window.NewsletterKit.data.readerTz'))
  if (zone) {
    await tab.send('Emulation.setTimezoneOverride', { timezoneId: zone })
    await go()
  }
  await new Promise((r) => setTimeout(r, 250))
  return { tab, ev }
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
  const tmp = mkdtempSync(join(tmpdir(), 'newsletter-kit-'))
  const errors = []
  try {
    chrome.on('Runtime.exceptionThrown', (p) => errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text))
    const { tab, ev } = await openPage(chrome, server, file, { w, h, scale, reduce: !!opts.reduce, tz: typeof opts.tz === 'string' ? opts.tz : undefined })
    const length = Number(opts.seconds ?? (await ev('window.NewsletterKit.length')))
    if (opts.moments) return { moments: { holds: await ev('window.NewsletterKit.holds'), length } }
    const shot = async (t, path, clip) => {
      await ev(`window.NewsletterKit.seek(${t})`)
      await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) })
      writeFileSync(path, Buffer.from(data, 'base64'))
    }
    if (opts.still !== undefined) {
      const png = resolve(opts.png ?? join(out, 'still.png'))
      await ev(`window.NewsletterKit.seek(${Math.min(Math.max(Number(opts.still) || 0, 0), length)})`)
      if (opts.state) {
        const [state, ...rest] = String(opts.state).split(':')
        const value = rest.length ? rest.join(':') : undefined
        await ev(`window.NewsletterKit.state(${JSON.stringify(state)}, ${JSON.stringify(value)})`)
      }
      if (opts.at) await ev(`(() => { const e = document.querySelector(${JSON.stringify(String(opts.at))}); if (!e) throw new Error('--at: nothing matches ${String(opts.at)}'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 16) })()`)
      await ev('new Promise((r) => setTimeout(r, 120))')
      let clip
      if (opts.clip) {
        const r = await ev(`(() => { const e = document.querySelector(${JSON.stringify(String(opts.clip))}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height } })()`)
        if (!r) throw new Error(`--clip: nothing matches ${opts.clip}`)
        const m = Number(opts.margin ?? 24)
        // --caption "Sending": a label above the clipped part, for a sheet of states (not part of the page)
        const cap = opts.caption ? 30 : 0
        if (cap) await ev(`(() => { const z = document.querySelector(${JSON.stringify(String(opts.clip))}); for (let n = z; n && n !== document.body; n = n.parentElement) for (const sib of n.parentElement.children) if (sib !== n) sib.style.visibility = 'hidden'; const d = document.createElement('div'); d.className = 'nk-l'; d.textContent = ${JSON.stringify(String(opts.caption))}; Object.assign(d.style, { position: 'absolute', left: '${r.x}px', top: '${r.y - cap}px', color: 'var(--accent-text)', fontFamily: getComputedStyle(document.querySelector('.nk')).getPropertyValue('--mono') }); document.querySelector('.nk').appendChild(d) })()`)
        clip = { x: Math.max(0, r.x - m), y: Math.max(0, r.y - m - cap), width: r.w + 2 * m, height: r.h + 2 * m + cap, scale: 1 }
      }
      if (opts.full) {
        const H = await ev('document.documentElement.scrollHeight')
        await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: H, deviceScaleFactor: scale, mobile: w < 760 })
        await ev('scrollTo(0, 0); new Promise((r) => setTimeout(r, 200))')
      }
      const { data } = await tab.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) })
      writeFileSync(png, Buffer.from(data, 'base64'))
      return { png }
    }
    const frames = Math.round(length * fps)
    for (let i = 0; i < frames; i++) await shot(i / fps, join(tmp, `${String(i + 1).padStart(5, '0')}.png`))
    const mp4 = join(out, 'preview.mp4')
    ffmpeg(['-framerate', String(fps), '-i', join(tmp, '%05d.png'), '-vf', `scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf ?? 18), '-movflags', '+faststart', mp4])
    const posterAt = Math.min(Math.max(Number(opts.poster ?? 7.5), 0), length - 1 / fps)
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
    console.log('usage: node scripts/record.mjs out/index.html [--seconds 12] [--size 1920x1080] [--poster 7.5]\n       node scripts/record.mjs out/index.html --still SECONDS [--size 390x844 --scale 2] [--png file.png] [--state name[:text]] [--clip selector [--caption text]] [--at selector] [--full] [--reduce] [--tz Zone/Name]\n       node scripts/record.mjs out/index.html --moments')
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
