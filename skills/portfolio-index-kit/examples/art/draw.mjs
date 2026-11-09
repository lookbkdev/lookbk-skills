#!/usr/bin/env node
// Work Index: draws the two examples' pictures in code and writes them as
// WebP files (and the one loop as an MP4), so the examples ship the same kind
// of files a buyer would: examples/fenn/media/*.webp and
// examples/halm/media/*.webp (+ salt-archive.mp4).
//
// Every picture here is drawn in SVG by the functions in fenn.mjs and
// halm.mjs: no photographs, stock or generated images are used. The page is
// rendered in headless Chrome at twice its size and captured.
//
//   node examples/art/draw.mjs [fenn|halm] [--only name] [--loop]
//
// Needs Chrome (CHROME_PATH) and, for --loop, ffmpeg.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { launch } from '../../scripts/kit/cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const which = args.filter((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--only'))
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const sets = which.length ? which : ['fenn', 'halm']

const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=block'
const page = (svg, w, h) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}">
<style>html,body{margin:0;background:#000}svg{display:block;width:${w}px;height:${h}px}</style></head><body>${svg}</body></html>`

const tmp = mkdtempSync(join(tmpdir(), 'work-index-art-'))
const chrome = await launch({ width: 1300, height: 1100 })
try {
  const tab = await chrome.page()
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  const ev = async (e) => (await tab.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.value
  async function shoot(svg, w, h, file, format = 'webp', scale = 2) {
    const html = join(tmp, 'p.html')
    writeFileSync(html, page(svg, w, h))
    await tab.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false })
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url: pathToFileURL(html).href })
    await loaded
    await ev(`Promise.all(['800 40px "Bricolage Grotesque"','40px "DM Mono"','40px "Instrument Serif"','italic 40px "Instrument Serif"'].map(f=>document.fonts.load(f))).then(()=>document.fonts.ready).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`)
    const { data } = await tab.send('Page.captureScreenshot', { format, quality: 88, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } })
    writeFileSync(file, Buffer.from(data, 'base64'))
  }
  for (const set of sets) {
    const mod = await import(pathToFileURL(join(here, `${set}.mjs`)).href)
    const out = join(here, '..', set, 'media')
    mkdirSync(out, { recursive: true })
    for (const [name, pic] of Object.entries(mod.pictures)) {
      if (only && only !== name) continue
      const [w, h] = pic.size
      await shoot(pic.draw(0), w, h, join(out, `${name}.webp`))
      console.log(`wrote ${set}/media/${name}.webp (${w * 2}x${h * 2})`)
      if (pic.loop && args.includes('--loop')) {
        // the loop: the same drawing at t = 0..1, 24 frames a second, seamless
        const frames = Math.round(pic.loop.seconds * 24)
        const dir = join(tmp, name)
        mkdirSync(dir, { recursive: true })
        for (let i = 0; i < frames; i++) {
          await shoot(pic.draw(i / frames), w, h, join(dir, `${String(i).padStart(4, '0')}.png`), 'png', pic.loop.width / w)
        }
        const mp4 = join(out, `${name}.mp4`)
        const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '24', '-i', join(dir, '%04d.png'), '-vf', `scale=${pic.loop.width}:-2:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' })
        if (r.status !== 0) throw new Error('ffmpeg failed')
        console.log(`wrote ${set}/media/${name}.mp4 (${frames} frames)`)
      }
    }
  }
} finally {
  await chrome.close()
  rmSync(tmp, { recursive: true, force: true })
}
