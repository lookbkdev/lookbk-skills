#!/usr/bin/env node
// Measures how much of each letter the near plates cover, over the whole
// scroll story and at the pointer's extremes, at 1440, 1024, 768 and 390 px:
//   node scripts/coverage.mjs out/index.html [--limit 0.3334]
// Each letter is drawn alone in the page's own font; the front canvas's
// alpha over its ink is the covered share. Exits 1 if any letter, at any
// moment, is covered more than the limit (a third by default).
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launch } from './kit/cdp.mjs'

const argv = process.argv.slice(2)
const file = argv.find((a) => !a.startsWith('--'))
const at = argv.indexOf('--limit')
const limit = at >= 0 ? Number(argv[at + 1]) : 1 / 3
if (!file || !existsSync(resolve(file))) {
  console.error('usage: node scripts/coverage.mjs out/index.html [--limit 0.3334]')
  process.exit(1)
}
const SIZES = [[1440, 900], [1024, 768], [768, 1024], [390, 844]]
const POINTERS = [null, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }, { x: 0, y: -1 }]
let worstAll = 0
for (const [width, height] of SIZES) {
  const chrome = await launch({ width, height })
  try {
    const tab = await chrome.page()
    const send = tab.send
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
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
    if (!ready.ok) throw new Error(`the effect didn't start: ${ready.reason}`)
    await ev('document.fonts.ready.then(() => true)')
    const end = (await ev('MotionHero.storySeconds')) + 1
    let worst = { share: 0 }
    let frames = 0
    for (let t = 0; t <= end + 1e-6; t += 0.5)
      for (const ptr of POINTERS) {
        await ev(`(document.querySelector('.mh').pdh.pointer = ${JSON.stringify(ptr)}, MotionHero.seek(${t}))`)
        const c = await ev("document.querySelector('.mh').pdh.coverage()")
        frames++
        if (c.worst.share > worst.share) worst = { ...c.worst, t, ptr }
      }
    worstAll = Math.max(worstAll, worst.share)
    const n = await ev("document.querySelector('.mh').pdh.coverage().letters.length")
    console.log(`${width}px: ${n} letters, ${frames} frames; most covered "${worst.ch ?? ''}" ${(worst.share * 100).toFixed(1)}% at t ${worst.t ?? 0}s, pointer ${JSON.stringify(worst.ptr ?? null)}`)
  } finally {
    await chrome.close()
  }
}
const ok = worstAll <= limit
console.log(`${ok ? 'ok' : 'FAIL'}: no letter covered more than ${(worstAll * 100).toFixed(1)}% (limit ${(limit * 100).toFixed(1)}%)`)
process.exit(ok ? 0 : 1)
