// Snow Globe: the effect description the Motion Heroes kit (v2) reads at
// build time. The drawing itself is effect.js (runs in the browser).
//
// Editorial composition, headline cut into the scene (typeMode "scene"): a
// glass snow globe on a turned base stands on a stone plinth by a window;
// the headline is a V-cut inscription filled with paint in the plinth’s
// front face, lit by the same light that throws the globe's shadow and
// caustic. Every loop the globe is shaken, the liquid swirls, the flakes
// settle and the room goes still again.
//
// Raw WebGL1, no libraries. The still picture (before the first frame, and
// if WebGL fails) is a baked photograph of the set without the inscription,
// shipped in assets/, with the page's own headline over it in theme.ink.
import { contrast, mix } from '../color.mjs'

const STILL = 0

export default {
  id: 'snow-globe',
  name: 'Snow Globe',
  needs: 'webgl',
  cssPrefix: 'sgh',
  compositions: ['editorial'],
  typeMode: 'scene',
  stillTime: STILL,
  posterTime: STILL,
  assets: ['assets/cafe-wide.webp', 'assets/cafe-tall.webp', 'assets/observatory-wide.webp', 'assets/observatory-tall.webp'],
  css: '.sgh-pic.sgh-tall{display:none}@media (max-width:759px){.sgh-pic.sgh-wide{display:none}.sgh-pic.sgh-tall{display:block}}',

  params: {
    scene: { type: 'enum', values: ['cafe', 'observatory'], default: ({ theme }) => (theme.mode === 'dark' ? 'observatory' : 'cafe'), doc: 'The miniature inside the glass, and the light that goes with it: a small café with lit windows, firs, a lamp post and a figure, under a low sun through a side window; or an observatory with its dome open, a fir and a figure looking up, in one shaft of moonlight' },
    flakeKind: { type: 'enum', values: ['snow', 'glitter'], default: ({ theme }) => (theme.mode === 'dark' ? 'glitter' : 'snow'), doc: 'Flat white flakes, or gold and silver glitter that flashes as it turns' },
    flakes: { type: 'integer', min: 60, max: 320, default: 220, doc: 'How many flakes or glitter pieces are in the liquid' },
    wall: { type: 'color', default: ({ theme }) => mix(theme.background, theme.ink, 0.06), doc: 'The wall behind, as it looks in the shade' },
    stone: { type: 'color', default: ({ theme }) => theme.background, doc: 'The plinth’s front face (where the headline is cut), as it looks in the shade' },
    ledge: { type: 'color', default: ({ theme }) => mix(theme.background, '#ffffff', 0.06), doc: 'The plinth’s top, as it looks in the shade' },
    paint: { type: 'color', default: ({ theme }) => theme.ink, doc: 'The paint (or gilt) that fills the cut letters' },
    sun: { type: 'color', default: ({ theme }) => (theme.mode === 'dark' ? '#b8c8ff' : '#ffe1b8'), doc: 'The key light: a low sun through a side window, or the moon through the dome’s slit' },
    sunStrength: { type: 'number', min: 0.5, max: 3, default: 1.5, doc: 'How bright the key is against the fill' },
    fill: { type: 'color', default: ({ theme }) => (theme.mode === 'dark' ? '#525a6a' : '#c6cdd8'), doc: 'The cool fill from the room' },
    base: { type: 'enum', values: ['walnut', 'ebony'], default: ({ theme }) => (theme.mode === 'dark' ? 'ebony' : 'walnut'), doc: 'The turned base, under lacquer, with a brass ring' },
    lipLight: { type: 'number', min: 0, max: 2, default: ({ theme }) => (theme.mode === 'dark' ? 1.25 : 0), doc: 'A warm strip light hidden under the ledge’s lip that grazes down the face and the letters (the night set needs it; 0 for none)' },
    polish: { type: 'number', min: 0, max: 1, default: ({ theme }) => (theme.mode === 'dark' ? 0.9 : 0), doc: 'How polished the plinth’s top is: 0 is honed stone, 1 a black mirror that reflects the globe and the base' },
    cycle: { type: 'number', min: 12, max: 20, default: 14, doc: 'Seconds for one loop: hold, shake, swirl, settle, hold' },
    shakeAt: { type: 'number', min: 0.5, max: 4, default: 2.2, doc: 'Seconds into the loop when the globe is shaken (the loop starts on a settled hold)' },
    shake: { type: 'number', min: 0.4, max: 1.4, default: 1, doc: 'How hard the globe is shaken: the jolt, the slosh of the surface and the swirl' },
    follow: { type: 'boolean', default: true, doc: 'On a live page a quick move across the globe, or a press on it, shakes it (once the snow has settled)' },
    grain: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'A fixed grain (about 1% at 0.5), the same on every frame so the loop closes' },
  },

  check(p, theme, problems) {
    const r = contrast(p.paint, p.stone)
    if (r < 3) problems.push(`effect.paint ${p.paint} on effect.stone ${p.stone} is ${r.toFixed(1)}:1; the cut letters need 3:1 (darker paint on light stone, or gilt on dark)`)
    if (p.polish > 0.2 && p.scene === 'cafe' && theme.mode === 'light') problems.push('effect.polish is for the dark stone of the night set; honed limestone (polish 0) suits the café')
  },

  /** The letters the effect cuts: in the fill, and where the light reaches the face. */
  typeGrounds(p, theme) {
    const lit = theme.mode === 'dark' ? mix(p.stone, '#c99a5e', 0.18) : mix(p.stone, '#ffffff', 0.3)
    return [
      { fg: p.paint, bg: p.stone },
      { fg: p.paint, bg: lit },
    ]
  },

  notes(p) {
    const n = []
    if (p.flakes > 260) n.push('more than 260 flakes reads as a blizzard; 180 to 240 settles into visible drifts')
    return n
  },

  /** Before the first frame (and if WebGL fails): a baked photograph of the set, wide or tall; the page's headline shows over it in theme.ink. */
  still(p, theme) {
    const name = p.scene === 'observatory' ? 'observatory' : 'cafe'
    const pic = (cls, file, w, h, par) =>
      `<svg class="sgh-pic ${cls}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${par}"><rect width="${w}" height="${h}" fill="${p.stone}"/><image href="assets/${file}" xlink:href="assets/${file}" width="${w}" height="${h}" preserveAspectRatio="${par}"/></svg>`
    return {
      backdrop: pic('sgh-wide', `${name}-wide.webp`, 1440, 900, 'xMidYMax slice') + pic('sgh-tall', `${name}-tall.webp`, 390, 844, 'xMidYMax slice'),
    }
  },
}
