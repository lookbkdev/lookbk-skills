#!/usr/bin/env node
// Measures how much of each letter the leaves in front of the sign cover,
// every 0.25 s over the whole cycle, at 1920x1080, 1440x900 and 390x844:
//   node scripts/effect/coverage.mjs out/index.html [--limit 0.08] [--at 0,4.5,17]
// Each letter is drawn alone in the page's own font; the leaves' alpha over
// its ink is the covered share. Leaves may cross the headline in transit, so
// the sweep only reports; it also prints the settled stretches (no landing,
// slide or gust in progress) and the times inside them where no letter is
// covered more than the limit (8% by default) and every landed leaf sits
// wholly inside the frame: where a poster, card or still may be taken.
// With --at, it checks those times and exits 1 if any fails.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { launch } from '../kit/cdp.mjs'

const argv = process.argv.slice(2)
const file = argv.find((a) => !a.startsWith('--') && /\.html$/.test(a))
const opt = (k, d) => {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : d
}
const limit = Number(opt('--limit', 0.08))
const at = opt('--at', null)
if (!file || !existsSync(resolve(file))) {
  console.error('usage: node scripts/effect/coverage.mjs out/index.html [--limit 0.08] [--at 0,4.5,17]')
  process.exit(1)
}
const SIZES = [[1920, 1080], [1440, 900], [390, 844]]
let failed = false
const report = {}
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
    const fx = "document.querySelector('.mh').flh"
    const cycle = await ev(`${fx}.p.cycle`)
    const settled = await ev(`${fx}.settled()`)
    const inSettled = (t) => settled.some(([a, b]) => t >= a && t <= b)
    const sample = async (t) => {
      await ev(`MotionHero.seek(${t})`)
      const c = await ev(`${fx}.coverage()`)
      // a landed leaf (resting or sliding) must sit wholly inside the frame
      c.out = await ev(`${fx}.outside(${t})`)
      return c
    }
    if (at) {
      for (const t of at.split(',').map(Number)) {
        const c = await sample(t)
        const ok = c.worst.share <= limit && inSettled(t) && !c.out.length
        if (!ok) failed = true
        console.log(`${width}px t ${t}s: ${ok ? 'ok' : 'FAIL'}  most covered "${c.worst.ch}" ${(c.worst.share * 100).toFixed(1)}%${inSettled(t) ? '' : ', not in a settled stretch'}${c.out.length ? `, landed leaf outside the frame ${JSON.stringify(c.out)}` : ', landed leaves inside the frame'}`)
      }
    } else {
      const good = []
      let worst = { share: 0 }
      let outs = 0
      for (let t = 0; t < cycle - 1e-6; t += 0.25) {
        const c = await sample(t)
        if (c.worst.share > worst.share) worst = { ...c.worst, t }
        if (c.out.length) outs++
        if (c.worst.share <= limit && inSettled(t) && !c.out.length) good.push(t)
      }
      report[width] = good
      console.log(`${width}px: settled ${settled.map(([a, b]) => `${a}-${b}s`).join(', ')}`)
      console.log(`${width}px: clear and settled at ${good.join(', ')}`)
      console.log(`${width}px: in transit the most covered letter was "${worst.ch}" ${(worst.share * 100).toFixed(1)}% at ${worst.t}s`)
      console.log(`${width}px: moments with a landed leaf outside the frame: ${outs}`)
    }
  } finally {
    await chrome.close()
  }
}
if (!at) {
  const both = (report[1440] || []).filter((t) => (report[390] || []).includes(t))
  console.log(`clear and settled at both sizes: ${both.join(', ')}`)
}
process.exit(failed ? 1 : 0)
