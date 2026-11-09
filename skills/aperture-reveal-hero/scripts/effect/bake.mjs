#!/usr/bin/env node
// Aperture Reveal: bakes the still picture a page shows before its first
// frame and whenever WebGL is unavailable (scripts/effect/stills/*.jpg).
//
//   node scripts/effect/bake.mjs out/index.html scripts/effect/stills/aperture-pier.jpg
//
// It opens a built page in headless Chrome with ?ap-bake, which draws the
// scene alone (no headline, no scale): the pier at f/2.8 seen through the
// iris, centred; the courtyard wide open, without the iris, so the real
// headline the page shows in the fallback sits on the light stone. The frame
// is 1600x900 and saved as a JPEG (quality 0.84).
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launch } from '../kit/cdp.mjs'

const [page, out] = process.argv.slice(2)
if (!page || !out) {
  console.error('usage: node scripts/effect/bake.mjs out/index.html scripts/effect/stills/<name>.jpg')
  process.exit(1)
}
const width = 1600
const height = 900
const chrome = await launch({ width, height })
try {
  const tab = await chrome.page()
  const send = tab.send
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  const loaded = tab.once('Page.loadEventFired', 60000)
  await send('Page.navigate', { url: pathToFileURL(resolve(page)).href + '?mh-record&ap-bake' })
  await loaded
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.value
  const ready = await ev('window.MotionHero.ready')
  if (!ready || !ready.ok) throw new Error('the page did not draw: ' + JSON.stringify(ready))
  await ev('window.MotionHero.seek(0)')
  const url = await ev("document.querySelector('.mh-canvas').toDataURL('image/jpeg', 0.84)")
  writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'))
  console.log(`baked ${out}`)
} finally {
  await chrome.close()
}
