// Laser Etch: the effect description the Motion Heroes kit (v2) reads at
// build time. The drawing itself is effect.js (runs in the browser).
//
// The headline is cut into a real plate by a laser engraver: a vector
// contour pass, then a gantry raster (maple, slate) or a galvo hatch at two
// angles (anodised aluminium). The letters are a height field lit by one low
// raking lamp, with shadows cast inside the cut, so they live in the plate
// (typeMode "scene"). Maple is a board lying on a bench, held by a clamp bar
// the copy is printed on; aluminium fills the hero edge to edge. The pointer
// moves the lamp.
//
// Raw WebGL2, no libraries. The still picture (before the first frame and
// if WebGL fails) is a baked photograph of the material, shipped in assets/.
import { mix } from '../color.mjs'

// The loop opens on the settled plate (the poster): t = 0 is inside the first hold.
const STILL = 0

const MATERIAL = {
  maple: { fg: '#2b1c12', bg: '#ccb896', shadow: '#3a2a1e', still: 'maple.webp' },
  anodised: { fg: '#8e9297', bg: '#1c1d21', shadow: '#72767d', still: 'anodised.webp' },
  slate: { fg: '#a2a6aa', bg: '#2f3337', shadow: '#8c9094', still: 'slate.webp' },
}

export default {
  id: 'laser-etch',
  name: 'Laser Etch',
  needs: 'webgl',
  cssPrefix: 'leh',
  compositions: ['lockup', 'type-effect'],
  typeMode: 'scene',
  stillTime: STILL,
  posterTime: STILL,
  assets: ['assets/maple.webp', 'assets/anodised.webp', 'assets/slate.webp'],

  params: {
    material: { type: 'enum', values: ['maple', 'anodised', 'slate'], default: 'maple', doc: 'What the headline is cut into: maple (chars, smokes), black anodised aluminium (the coating ablates to bright metal, sparks) or slate (frosts pale grey)' },
    machine: { type: 'enum', values: ['gantry', 'galvo'], default: ({ theme }) => (theme.mode === 'dark' ? 'galvo' : 'gantry'), doc: 'How the fill is cut: a gantry raster (the whole job scanned line by line, both directions) or a galvo hatch (glyph by glyph at 45 degrees, then 135 degrees)' },
    layout: { type: 'enum', values: ['board', 'full'], default: ({ composition }) => (composition === 'lockup' ? 'board' : 'full'), doc: 'board: the plate is a board lying on a bench with its ends in view, and the copy is printed on a clamp bar across it; full: the plate fills the hero' },
    bench: { type: 'color', default: ({ theme }) => mix(theme.plate ?? theme.background, theme.ink, 0.1), doc: 'The bench under the board (layout board). The clamp bar is always theme.plate, so the copy plate is part of it' },
    lamp: { type: 'color', default: ({ theme }) => (theme.mode === 'dark' ? '#f6f8ff' : '#fff3e0'), doc: 'The raking lamp’s colour' },
    mark: { type: 'text', default: '', doc: 'One or two letters burned as a maker’s mark (a double ring) in the board’s free corner, or below the clamp bar on phones; empty for none. Not on aluminium' },
    scale: { type: 'boolean', default: false, doc: 'A graduation scale burned along the foot of the plate (aluminium only), or down its edge on phones' },
    depth: { type: 'number', min: 0.4, max: 1.6, default: 1, doc: 'How deep the cut reads (walls and cast shadows)' },
    smoke: { type: 'number', min: 0, max: 1, default: 0.8, doc: 'The smoke off maple while it burns (none on aluminium or slate)' },
    sparks: { type: 'number', min: 0, max: 1, default: 0.8, doc: 'The sparks off aluminium while it is marked' },
    cycle: { type: 'number', min: 12, max: 30, default: ({ theme }) => (theme.mode === 'dark' ? 16 : 20), doc: 'Seconds for one loop: hold, the lamp swings, the plate swap, the contour pass, the fill, the lamp swings back' },
    follow: { type: 'boolean', default: true, doc: 'The pointer moves the raking lamp on a spring (shadows, sheen and glare follow); it goes back to its scripted sweep when the pointer rests or leaves' },
    grain: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'A fixed grain (about 1% at 0.5), the same on every frame so the loop closes' },
  },

  check(p, theme, problems) {
    if (p.mark && p.mark.length > 2) problems.push('effect.mark is one or two letters')
    if (p.layout === 'board' && p.material === 'anodised') problems.push('effect.layout "board" is for maple and slate; anodised plates fill the hero (layout "full")')
  },

  /** The letters the effect cuts: finished, lit and on their shaded side. */
  typeGrounds(p) {
    const m = MATERIAL[p.material] ?? MATERIAL.maple
    return [
      { fg: m.fg, bg: m.bg },
      { fg: m.shadow, bg: m.bg },
    ]
  },

  notes(p) {
    const n = []
    if (p.material === 'maple' && p.machine === 'galvo') n.push('a galvo on maple: real, but the raster (machine gantry) is what shows the scan lines in the char')
    if (p.depth > 1.3 && p.material === 'anodised') n.push('deep cuts in aluminium read as stamped; depth 1 is a deep laser mark')
    return n
  },

  /** Before the first frame (and if WebGL fails): a baked photograph of the material; the page shows the headline in theme.ink over it. */
  still(p, theme) {
    const m = MATERIAL[p.material] ?? MATERIAL.maple
    const board = p.layout === 'board'
    return {
      backdrop: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="${board ? p.bench : m.bg}"/><image href="assets/${m.still}" xlink:href="assets/${m.still}" x="${board ? 64 : 0}" y="${board ? 110 : 0}" width="${board ? 1472 : 1600}" height="${board ? 820 : 900}" preserveAspectRatio="xMidYMid slice"/></svg>`,
    }
  },
}
