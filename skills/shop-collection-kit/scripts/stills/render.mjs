// Shop Collection Kit: renders the product photographs for a page.json from
// its "stills" block, in headless Chrome with three.js (vendored in
// vendor/). Same config in, same pictures out: every glaze speckle and
// drip comes from a seeded random number, and every product in a collection
// is shot from the same distance (true scale; see studio.js scaleFrame).
//
//   node scripts/stills.mjs page.json [--only id,id] [--draft]
//
// Writes, next to page.json, in its photos folder:
//   <id>-<option>.webp   the front, once per option (glaze, metal...)
//   <id>-<option>-turn.webp  the reverse: turned over, inside, from behind
//   <name>.webp          each extra still (the editorial band's photograph)
//   scale.json           how wide each photograph is in millimetres, and
//                        which pieces were brought closer (shown enlarged)
//
// Skip this entirely when the shop has real photographs: put them in the
// photos folder under the same names (see SKILL.md).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from '../kit/cdp.mjs'
import { serve } from '../kit/serve.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = resolve(HERE, '..', '..')
const POSES = { flip: { flip: true }, lay: { lay: -2.3 }, lie: { lie: true } }

/** Every image a page.json's stills block asks for, as studio jobs. */
export function jobsFor(cfg) {
  const st = cfg.stills
  const problems = []
  if (!st) throw new Error('page.json has no "stills" block: nothing to render (real photographs need no rendering)')
  const mats = st.materials ?? {}
  const resolveRefs = (v, at) => {
    if (typeof v === 'string' && v.startsWith('@')) {
      const m = mats[v.slice(1)]
      if (!m) problems.push(`${at}: no material "${v.slice(1)}" in stills.materials`)
      return m ?? {}
    }
    if (Array.isArray(v)) return v.map((x, i) => resolveRefs(x, `${at}[${i}]`))
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveRefs(x, `${at}.${k}`)]))
    return v
  }
  const item = (it, option, extra, at) => {
    const base = { ...(option ? mats[option] : {}), ...(it.use ? mats[it.use] : {}), ...extra, ...it }
    delete base.use
    // "$key" takes that value from the option's material ("hallmark": "$hallmark")
    for (const [k, v] of Object.entries(base)) if (typeof v === 'string' && v.startsWith('$')) base[k] = (mats[option] ?? {})[v.slice(1)]
    return resolveRefs(base, at)
  }
  const W = st.width ?? 960
  const H = st.height ?? 1200
  const camera = (elevation, frameMm) => ({ elevation, frameCm: (frameMm ?? st.frameMm) / 10, minFill: st.minFill ?? 0, aim: st.aim ?? 0.22, focal: st.focal ?? 85 })
  const job = (items, elevation, turn, w = W, h = H, frameMm) => ({
    width: w,
    height: h,
    light: st.light ?? 'soft',
    look: st.look,
    backdrop: { color: st.backdrop ?? '#e3dcd0' },
    products: [{ shape: 'group', dims: { items }, turn: turn ?? 0 }],
    camera: camera(elevation ?? 18, frameMm),
    format: 'webp',
    quality: st.quality ?? 0.88,
  })
  const out = []
  for (const [i, p] of (cfg.products ?? []).entries()) {
    const s = p.still
    const at = `products[${i}].still`
    if (!s) continue
    if (!Array.isArray(s.items) || !s.items.length) {
      problems.push(`${at}.items: list the pieces in the photograph`)
      continue
    }
    for (const o of p.options ?? []) out.push({ file: `${p.id}-${o}.webp`, first: `${p.id}-${p.options[0]}.webp`, id: p.id, job: job(s.items.map((it, k) => item(it, o, {}, `${at}.items[${k}]`)), s.elevation, s.turnDeg) })
    const t = s.turn ?? {}
    const pose = POSES[t.pose] ?? {}
    if (t.pose && !POSES[t.pose]) problems.push(`${at}.turn.pose is one of ${Object.keys(POSES).join(', ')}`)
    const titems = t.items ?? s.items
    // the reverse, once per option, so a celadon bowl turns over as a celadon bowl
    for (const o of p.options ?? [])
      out.push({ file: `${p.id}-${o}-turn.webp`, first: `${p.id}-${p.options[0]}.webp`, id: p.id, turn: true, job: job(titems.map((it, k) => item(it, o, t.items ? {} : pose, `${at}.turn.items[${k}]`)), t.elevation ?? s.elevation, t.turnDeg ?? s.turnDeg) })
  }
  for (const [i, x] of (st.extra ?? []).entries()) {
    const at = `stills.extra[${i}]`
    if (!x.name || !Array.isArray(x.items)) {
      problems.push(`${at}: needs a name and items`)
      continue
    }
    out.push({ file: `${x.name}.webp`, extra: true, job: job(x.items.map((it, k) => item(it, x.option, {}, `${at}.items[${k}]`)), x.elevation, x.turnDeg, x.width ?? 1600, x.height ?? 1100, x.frameMm) })
  }
  if (problems.length) throw new Error(problems.join('\n'))
  return out
}

export async function renderStills(configPath, { only, draft } = {}) {
  const file = resolve(configPath)
  const cfg = JSON.parse(readFileSync(file, 'utf8'))
  const photos = resolve(dirname(file), cfg.photos?.dir ?? 'photos')
  mkdirSync(photos, { recursive: true })
  let jobs = jobsFor(cfg)
  if (only) jobs = jobs.filter((j) => only.includes(j.id) || only.includes(j.file.replace(/\.webp$/, '')))
  const scaleFile = join(photos, 'scale.json')
  const scale = existsSync(scaleFile) && only ? JSON.parse(readFileSync(scaleFile, 'utf8')) : { files: {} }
  scale.frameMm = cfg.stills.frameMm
  scale.files ??= {}
  const server = await serve(PKG)
  const chrome = await launch({ width: 800, height: 600, args: ['--enable-gpu', '--use-angle=default'] })
  try {
    const tab = await chrome.page()
    await tab.send('Page.enable')
    await tab.send('Runtime.enable')
    const loaded = tab.once('Page.loadEventFired', 60000)
    await tab.send('Page.navigate', { url: `${server.url}scripts/stills/studio.html` })
    await loaded
    const ev = async (expression) => {
      const r = await tab.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      return r.result.value
    }
    if (!(await ev("!!(globalThis['studio'] && globalThis['Objects'])"))) throw new Error('the studio did not load')
    const mags = {}
    for (const j of jobs) {
      let job = draft ? { ...j.job, width: Math.round(j.job.width / 2), height: Math.round(j.job.height / 2) } : j.job
      // one scale per product: the first photograph sets it, the rest follow
      if (j.id && !mags[j.id] && j.file !== j.first && scale.files[j.first]) mags[j.id] = scale.files[j.first].enlarged
      if (j.id && mags[j.id]) job = { ...job, camera: { ...job.camera, mag: mags[j.id] } }
      const r = await ev(`globalThis['studio'].render(${JSON.stringify(job)}).then((r) => ({ png: r.png, mag: r.mag, fill: r.fill, ms: r.ms }))`)
      if (!r.png.startsWith('data:image/webp')) throw new Error('this browser cannot encode WebP; use Chrome, Chromium or Edge')
      writeFileSync(join(photos, j.file), Buffer.from(r.png.split(',')[1], 'base64'))
      if (j.id) mags[j.id] ??= r.mag
      const frameMm = (j.job.camera.frameCm * 10) / r.mag
      scale.files[j.file] = { mmAcross: Math.round(frameMm * 10) / 10, enlarged: Math.round(r.mag * 100) / 100 }
      console.log(`  ${j.file}  ${r.ms} ms${r.mag > 1.001 ? `  (brought ${r.mag.toFixed(2)}x closer: small piece)` : ''}`)
    }
  } finally {
    await chrome.close()
    server.close()
  }
  writeFileSync(scaleFile, JSON.stringify(scale, null, 2) + '\n')
  return { photos, count: jobs.length }
}

export async function main(argv = process.argv.slice(2)) {
  const input = argv.find((a) => !a.startsWith('--'))
  const oi = argv.indexOf('--only')
  const only = oi >= 0 ? argv[oi + 1]?.split(',') : null
  if (!input) {
    console.log('usage: node scripts/stills.mjs page.json [--only id,id] [--draft]')
    process.exit(1)
  }
  try {
    const r = await renderStills(input, { only, draft: argv.includes('--draft') })
    console.log(`stills: wrote ${r.count} photographs and scale.json to ${r.photos}`)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
