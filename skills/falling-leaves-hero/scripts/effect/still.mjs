#!/usr/bin/env node
// Bakes the hero's still picture, the one a visitor sees if WebGL is off (and
// until the first frame is drawn): node scripts/effect/still.mjs out/index.html
// It opens the built page in headless Chrome, draws the scene at its still
// moment at 1600x900 and at 390x844 (2x), and writes the backdrop and the
// leaves as one picture, without the letters (the page shows the real
// headline over it when WebGL is off):
//   out/assets/flh-<scene>-wide.jpg and out/assets/flh-<scene>-tall.jpg
// Run it after build.mjs whenever you change the words, colours, scene or seed.
// build.mjs ships the two examples' own pictures until you do.
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launch } from '../kit/cdp.mjs'

const file = process.argv[2]
if (!file || !existsSync(resolve(file))) {
  console.error('usage: node scripts/effect/still.mjs out/index.html')
  process.exit(1)
}
const shots = [
  ['wide', 1600, 900, 1, 0.84],
  ['tall', 390, 844, 2, 0.84],
]
for (const [name, width, height, scale, quality] of shots) {
  const chrome = await launch({ width, height })
  try {
    const tab = await chrome.page()
    const send = tab.send
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: width < 600 })
    const loaded = tab.once('Page.loadEventFired', 60000)
    await send('Page.navigate', { url: pathToFileURL(resolve(file)).href + '?mh-record=1' })
    await loaded
    const ev = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    for (let i = 0; i < 100 && !(await ev('!!window.MotionHero')); i++) await new Promise((r) => setTimeout(r, 100))
    const ready = await ev('MotionHero.ready')
    if (!ready.ok) throw new Error(`the effect didn't start (${ready.reason}); a still can only be baked where WebGL works`)
    await ev('document.fonts.ready.then(() => true)')
    await ev("document.querySelector('.mh').flh.bake(true)")
    await ev('MotionHero.seek(MotionHero.stillTime)')
    const { scene, url } = await ev(`(() => {
      const root = document.querySelector('.mh')
      const c = root.querySelector('.mh-canvas')
      return { scene: root.flh.p.scene, url: c.toDataURL('image/jpeg', ${quality}) }
    })()`)
    const out = join(dirname(resolve(file)), 'assets', `flh-${scene}-${name}.jpg`)
    writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'))
    console.log(`  ${out}  ${width * scale}×${height * scale}`)
  } finally {
    await chrome.close()
  }
}
