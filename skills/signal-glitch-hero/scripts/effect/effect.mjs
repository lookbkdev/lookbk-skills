// Signal Glitch: the effect description the Motion Heroes kit (v2) reads at
// build time. The drawing itself is effect.js (runs in the browser).
//
// The hero is a receiver acquiring a channel. The picture and the headline
// are one broadcast frame (the headline is burned into it, typeMode
// "scene") that reaches the screen through two real chains, each with its
// own lock: the cable (an analog link whose sync circuits must lock: the
// picture rolls, its lines shear and flag, colour is killed until the
// colour burst locks, then the colour sits off the edges by a chroma delay
// that settles) and the stream (a compressed picture joined mid-group: no
// key frame yet, so the decoder paints motion vectors and residuals over an
// empty reference, which smears and misplaces blocks, until a rolling
// intra refresh sweeps across and every block it passes is clean). Then the
// frame holds, readable, until the signal fades and the cycle restarts.
// On a live page the pointer is interference: it drags the blocks under it
// along its motion and tears the lines it crosses; the stream repairs it.
//
// Raw WebGL1, no libraries. The picture is the buyer's own photograph,
// named in hero.json (a path relative to it). The build resizes it to at
// most 1920 px wide and encodes it as a JPEG with ffmpeg, stepping the
// quality down until it is 400 KB or less, and ships only that file
// (assets/<name>.jpg). Without ffmpeg the file is shipped as it is, if it
// is already a JPEG of 400 KB or less.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contrast, lum, mix } from '../color.mjs'

export const LIMIT_KB = 400
const MAX_W = 1920
const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** The picture named in the hero.json being built (process.argv), resized and encoded. Runs once, when the build imports this file. */
const PIC = (() => {
  const input = process.argv.slice(2).find((a) => !a.startsWith('--') && a.endsWith('.json'))
  if (!input || !existsSync(input)) return null
  let name
  try {
    name = JSON.parse(readFileSync(input, 'utf8'))?.effect?.picture
  } catch {
    return null
  }
  if (typeof name !== 'string' || !name) return null
  const src = resolve(dirname(resolve(input)), name)
  const served = basename(name, extname(name)).replace(/[^\w.-]+/g, '-') + '.jpg'
  const out = { name, src, served, file: null, kb: 0, how: '', error: '' }
  if (!existsSync(src)) {
    out.error = `effect.picture: ${name} isn't there (looked for ${src}; the path is relative to hero.json)`
    return out
  }
  const dir = join(tmpdir(), 'signal-glitch-' + createHash('sha1').update(src + statSync(src).mtimeMs).digest('hex').slice(0, 10))
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, served)
  const ff = process.env.FFMPEG_PATH || 'ffmpeg'
  let encoded = false
  try {
    for (const q of [3, 4, 5, 6, 8, 10, 13]) {
      execFileSync(ff, ['-loglevel', 'error', '-y', '-i', src, '-vf', `scale='min(${MAX_W},iw)':-2:flags=lanczos`, '-frames:v', '1', '-map_metadata', '-1', '-q:v', String(q), dest], { stdio: 'pipe' })
      encoded = true
      out.how = `resized to at most ${MAX_W} px and encoded as JPEG (ffmpeg quality ${q})`
      if (statSync(dest).size <= LIMIT_KB * 1024) break
    }
  } catch {
    encoded = false
  }
  if (!encoded) {
    if (!/\.jpe?g$/i.test(src)) {
      out.error = `effect.picture: ${name} needs ffmpeg to be converted to a JPEG (install ffmpeg or set FFMPEG_PATH), or save it as a JPEG of ${LIMIT_KB} KB or less`
      return out
    }
    copyFileSync(src, dest)
    out.how = 'shipped as it is (ffmpeg was not found, so it was not resized)'
  }
  out.file = dest
  out.kb = Math.round(statSync(dest).size / 1024)
  return out
})()

/** A grey with relative luminance L (sRGB hex). */
function grey(L) {
  const c = L <= 0.0031308 ? 12.92 * L : 1.055 * Math.pow(L, 1 / 2.4) - 0.055
  const v = Math.round(Math.max(0, Math.min(1, c)) * 255)
  return '#' + v.toString(16).padStart(2, '0').repeat(3)
}

/** The luminance limit the title-safe grade holds the picture to under the letters. */
export function gradeLimit(p, theme) {
  const Li = lum(theme.ink)
  return theme.mode === 'dark' ? { cap: Math.max(0, (Li + 0.05) / p.grade - 0.05) } : { floor: Math.min(1, p.grade * (Li + 0.05) - 0.05) }
}

export default {
  id: 'signal-glitch',
  name: 'Signal Glitch',
  needs: 'webgl',
  cssPrefix: 'sgl',
  compositions: ['lockup', 'editorial'],
  typeMode: 'scene',
  // only the picture this hero.json names, encoded (a path from the package, as the kit expects)
  assets: PIC?.file ? [relative(PACKAGE, PIC.file)] : [],
  // the held frame (clean, readable): the still, the poster and the card. The video opens on the acquisition
  stillTime: 6,
  posterTime: 6,

  params: {
    picture: { type: 'text', max: 200, default: '', doc: `Your own photograph: a JPEG, PNG or WebP, as a path relative to hero.json. The build resizes it to at most ${MAX_W} px wide and encodes it to ${LIMIT_KB} KB or less; it stops if it can't` },
    focusX: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'Which part of the picture stays in view when it is cropped to the field: 0 its left edge, 1 its right edge (wide screens)' },
    focusY: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'The same, top (0) to bottom (1)' },
    phoneFocusX: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'focusX on phones, where the field is narrow and tall' },
    cycle: { type: 'number', min: 10, max: 20, default: 12, doc: 'Seconds from one acquisition to the next: the loop of the video' },
    acquire: { type: 'number', min: 1.6, max: 3.6, default: 2.4, doc: 'Seconds from the first sync to a clean lock (the cable locks in about the first 60%, colour at 72%, the intra refresh sweeps from 45% to 95%)' },
    fade: { type: 'number', min: 0.6, max: 1.8, default: 1.1, doc: 'Seconds the signal takes to fade at the end of the cycle. The frame is clean and still for cycle - acquire - fade seconds' },
    refresh: { type: 'enum', values: ['columns', 'rows'], default: 'columns', doc: 'How the intra refresh sweeps the frame clean: columns, left to right (a headline locks in reading order), or rows, top to bottom (the picture locks before a headline at the foot)' },
    block: { type: 'integer', min: 8, max: 32, default: 16, doc: 'The macroblock size in CSS pixels on wide screens (phones use three quarters of it)' },
    mosh: { type: 'number', min: 0, max: 1, default: 0.8, doc: 'How far the motion vectors drag the blocks before the key frame arrives (the datamosh smear)' },
    tear: { type: 'number', min: 0, max: 1, default: 0.7, doc: 'How hard the cable loses horizontal sync: shear, flagging at the top of the frame and line jitter' },
    roll: { type: 'boolean', default: true, doc: 'The picture rolls vertically (with the blanking bar) until vertical sync locks' },
    chroma: { type: 'number', min: 0, max: 1, default: 0.7, doc: 'The chroma delay: how far the colour sits off the edges while the colour burst settles' },
    burst: { type: 'boolean', default: true, doc: 'One short burst error in the middle of the held frame (a band of blocks slips sideways for 0.2 s and the next refresh repairs it)' },
    buffer: { type: 'color', default: ({ theme }) => mix(theme.background, theme.mode === 'dark' ? '#000000' : '#ffffff', 0.25), doc: "The decoder's empty reference, seen before the residuals arrive and when the signal fades" },
    blanking: { type: 'color', default: '#050505', doc: 'The blanking bar between frames, seen as the picture rolls' },
    grade: { type: 'number', min: 3, max: 7, default: 4.5, doc: "The title-safe grade: the contrast the headline is guaranteed over the picture (the picture is held darker, or lighter on a light page, in a soft area under the letters only)" },
    follow: { type: 'boolean', default: true, doc: 'The pointer is interference: moving it drags the blocks under it along its path and tears the lines it crosses; the stream repairs it within a second' },
    grain: { type: 'number', min: 0, max: 1, default: 0.4, doc: 'A fixed grain (about 2% at 0.5), the same on every frame so the loop closes' },
  },

  check(p, theme, problems) {
    if (!p.picture) problems.push('effect.picture: name your photograph (a path relative to hero.json)')
    else if (PIC?.error) problems.push(PIC.error)
    else if (PIC && PIC.kb > LIMIT_KB) problems.push(`effect.picture: ${p.picture} is ${PIC.kb} KB after the build's resize and encode (${PIC.how}); the limit is ${LIMIT_KB} KB. Crop it, or export it smaller`)
    if (p.acquire + p.fade > p.cycle * 0.4) problems.push(`effect.acquire + effect.fade (${(p.acquire + p.fade).toFixed(1)} s) is more than 40% of effect.cycle (${p.cycle} s): the frame must hold, readable, for most of the loop`)
    const r = contrast(theme.ink, theme.background)
    if (r < 4.5) problems.push(`theme.ink is ${r.toFixed(1)}:1 on theme.background; the headline needs 4.5:1 where it leaves the picture`)
    const g = gradeLimit(p, theme)
    if (g.cap !== undefined && g.cap < 0.004) problems.push(`theme.ink is too dark for a dark page: the grade would have to black out the picture under the letters`)
    if (g.floor !== undefined && g.floor > 0.85) problems.push(`theme.ink is too light for a light page: the grade would have to white out the picture under the letters`)
  },

  /** The held frame: the letters in ink on the page ground and on the graded picture (its luminance limit). */
  typeGrounds(p, theme) {
    const g = gradeLimit(p, theme)
    return [{ fg: theme.ink, bg: theme.background }, { fg: theme.ink, bg: grey(g.cap ?? g.floor) }]
  },

  notes(p) {
    const n = []
    if (PIC?.file) n.push(`picture ${PIC.name}: ${PIC.how}, ${PIC.kb} KB, shipped as assets/${PIC.served}`)
    if (p.block > 24) n.push(`block ${p.block}: large blocks read as a mosaic more than as compression`)
    if (p.cycle - p.acquire - p.fade < 7) n.push(`the frame holds for ${(p.cycle - p.acquire - p.fade).toFixed(1)} s of every ${p.cycle} s`)
    return n
  },

  /** Before the first frame (and if WebGL fails): the picture, dimmed toward the page so the headline reads. */
  still(p, theme) {
    const veil = theme.mode === 'dark' ? '#000000' : '#ffffff'
    const pic = PIC?.file ? `<image href="assets/${PIC.served}" width="1600" height="900" preserveAspectRatio="xMidYMid slice"/>` : ''
    return {
      backdrop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="${theme.background}"/>${pic}<rect width="1600" height="900" fill="${veil}" fill-opacity="0.5"/></svg>`,
    }
  },
}
