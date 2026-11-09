// Aperture Reveal: the effect description the Motion Heroes kit (v2) reads at
// build time. The drawing itself is effect.js (runs in the browser).
//
// A real lens iris: nine curved blades, each turning on its own pin, the
// opening the intersection of their edge discs (round wide open, a nearly
// straight-sided nine-gon stopped down, turning a little as it closes). Its
// centre is the counter of an O in the headline: stopped down the opening
// fits inside the letter, opened up the scene pours out of it. The scene
// behind (a pier at night, or a stone courtyard with a fountain at noon) is
// re-rendered for every f-number: depth of field, bokeh in the opening's own
// shape, 18-point diffraction stars, exposure. The aperture ring clicks from
// stop to stop and holds; on a live page the pointer turns it.
//
// The headline is drawn by the effect (typeMode "scene"): over the scene in
// theme.ink, over the blades in effect.bladeInk, with a guard that holds the
// scene down (dark themes) or up (light themes) behind every letter.
// Raw WebGL2, no libraries. The still picture is a baked frame of the scene.
import { contrast, mix } from '../color.mjs'

/** The full stops from f/1.2 to f/22, as printed on the ring. */
export const STOPS = [1.2, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22]
const parseLoop = (s) =>
  String(s)
    .trim()
    .split(/[\s,]+/)
    .map(Number)

export default {
  id: 'aperture-reveal',
  name: 'Aperture Reveal',
  needs: 'webgl',
  cssPrefix: 'apr',
  compositions: ['lockup', 'editorial'],
  typeMode: 'scene',
  stillTime: 0,
  posterTime: 0,
  assets: ['scripts/effect/stills/aperture-pier.jpg', 'scripts/effect/stills/aperture-court.jpg'],

  params: {
    scene: {
      type: 'enum',
      values: ['pier', 'court'],
      default: ({ theme }) => (theme.mode === 'dark' ? 'pier' : 'court'),
      doc: 'What the lens looks at: a timber pier at night with lanterns (dark themes), or a stone courtyard with a fountain at noon (light themes)',
    },
    word: {
      type: 'text',
      max: 24,
      default: '',
      doc: 'The headline word whose first O holds the iris (its counter is the aperture). Empty: the O nearest the middle of the headline',
    },
    loop: {
      type: 'text',
      max: 32,
      default: ({ theme }) => (theme.mode === 'dark' ? '22 1.4 4' : '1.2 22 2.8'),
      doc: 'Three f-numbers from the ring (1.2 1.4 2 2.8 4 5.6 8 11 16 22): the stop at frame 0, the stop it clicks to, and the different stop it clicks to before returning. One 12 s loop',
    },
    widest: {
      type: 'enum',
      values: ['1.2', '1.4'],
      default: '1.4',
      doc: 'The widest stop on the printed scale (the lens is an f/1.2 or an f/1.4)',
    },
    bladeInk: {
      type: 'color',
      default: ({ theme }) => (theme.mode === 'dark' ? theme.ink : '#efe8dc'),
      doc: 'The colour of the letters where they lie over the black blades (over the scene they are theme.ink). Light themes need a light colour here',
    },
    exposure: { type: 'number', min: 0.6, max: 1.6, default: 1, doc: 'Overall brightness of the scene; it still grows two and a half stops from f/22 to the widest stop' },
    scale: { type: 'boolean', default: true, doc: 'Print the f-number scale (the aperture ring) beside the iris' },
    follow: { type: 'boolean', default: true, doc: 'On a live page the pointer turns the aperture ring: its position across the hero sets the f-stop, in clicks' },
    grain: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'A fixed grain (about 2% at 0.5), the same on every frame so the loop closes' },
  },

  check(p, theme, problems) {
    const stops = parseLoop(p.loop)
    const ring = STOPS.filter((s) => s >= Number(p.widest))
    if (stops.length !== 3 || stops.some((s) => !ring.includes(s)))
      problems.push(`effect.loop is three f-numbers from the ring (${ring.join(' ')}), like "22 1.4 4"; got "${p.loop}"`)
    else if (stops[0] === stops[1] || stops[1] === stops[2] || stops[2] === stops[0]) problems.push('effect.loop: the three stops must all be different')
    if (p.scene === 'pier' && theme.mode !== 'dark') problems.push('effect.scene "pier" is a night scene: it needs theme.mode dark (use "court" on a light theme)')
    if (p.scene === 'court' && theme.mode !== 'light') problems.push('effect.scene "court" is a noon scene: it needs theme.mode light (use "pier" on a dark theme)')
    if (contrast(p.bladeInk, '#1c1c1d') < 4.5) problems.push(`effect.bladeInk ${p.bladeInk} reads at ${contrast(p.bladeInk, '#1c1c1d').toFixed(1)}:1 on the blades; it needs 4.5:1 (a light colour)`)
  },

  /**
   * The letters the effect draws and what is behind them. Over the blades:
   * bladeInk on the lightest blade. Over the scene, the guard holds the
   * ground at most at #383838 (dark themes) or at least at #c4c1b9 (light
   * themes) under and around every letter; effect.js measures this on the
   * real frames too (window.__apertureCheck).
   */
  typeGrounds(p, theme) {
    const guard = theme.mode === 'dark' ? '#383838' : '#c4c1b9'
    return [
      { fg: p.bladeInk, bg: '#1f1f20' },
      { fg: theme.ink, bg: guard },
    ]
  },

  notes(p) {
    const n = []
    if (!p.word) n.push('effect.word is empty: the iris goes in the O nearest the middle of the headline. Name the word to choose another')
    return n
  },

  /** Before the first frame, and if WebGL fails: a baked frame of the scene (wide open, the iris around it); the page shows the real headline over it. */
  still(p, theme) {
    const file = p.scene === 'pier' ? 'aperture-pier.jpg' : 'aperture-court.jpg'
    return {
      backdrop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="${mix(theme.background, '#000000', 0.2)}"/><image href="assets/${file}" width="1600" height="900" preserveAspectRatio="xMidYMid slice"/></svg>`,
    }
  },
}
