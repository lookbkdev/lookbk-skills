// Falling Leaves: the effect description the Motion Heroes kit (v2) reads at
// build time. The drawing itself is effect.js (runs in the browser).
//
// One frame from a long lens at a quarter speed: leaves falling through real
// light, with the headline as a sign standing in the focal plane (typeMode
// "scene": the effect draws the letters from view.type). Instanced, bent leaf
// quads cut from an atlas painted in code (sugar maple or ginkgo), lit by one
// light with transmission when backlit, blurred by a thin-lens circle of
// confusion; flutter, spiral and tumble paths from the falling-plate
// literature; a few leaves per cycle land on the letters' top edges (solved
// from the glyph outlines), rest, slide off along the edge and fall again; a
// scripted gust once per cycle, and the pointer as a gust on a live page.
//
// three.js r180, the kit's pin. Two worlds: golden hour in a maple wood
// (light) and a ginkgo avenue under a street lamp (dark).
import { contrast, mix } from '../color.mjs'

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js'
// a settled moment with no leaf over a letter, measured with scripts/effect/coverage.mjs
const STILL = 1

const SCENES = {
  'golden-hour': { leaf: 'maple', sign: 'steel', letters: '#1f130c', air: '#ecdcae', crown: '#d9b83a', light: 0.2 },
  'lamp-night': { leaf: 'ginkgo', sign: 'painted', letters: '#e6dcc2', air: '#0d1118', crown: '#d9b83a', light: 0.68 },
}
const sceneOf = (theme) => (theme.mode === 'dark' ? 'lamp-night' : 'golden-hour')

export default {
  id: 'falling-leaves',
  name: 'Falling Leaves',
  needs: 'webgl',
  cssPrefix: 'flh',
  compositions: ['lockup', 'editorial'],
  typeMode: 'scene',
  stillTime: STILL,
  posterTime: STILL,
  libs: [{ name: 'three', url: THREE_URL, integrity: 'sha384-G204cH8yiGRBsIeOd0ayBXn7MSDuf0X5To614xt+2b1ApqNUxAWn/XqL8Xilauyd' }],

  params: {
    scene: {
      type: 'enum',
      values: ['golden-hour', 'lamp-night'],
      default: ({ theme }) => sceneOf(theme),
      doc: 'golden-hour: a maple wood looking into a low sun, the crowns lit through, a misty meadow under the headline (a forest floor on phones). lamp-night: a ginkgo avenue at night under one street lamp, its cone in the mist, lamps receding down the street. Default follows theme.mode',
    },
    leaf: { type: 'enum', values: ['maple', 'ginkgo'], default: ({ theme }) => SCENES[sceneOf(theme)].leaf, doc: 'The species: sugar maple (5 serrated lobes, palmate veins, muted crimson, rust, ochre and turning) or ginkgo (a notched fan with forked veins, gold and green-gold)' },
    sign: { type: 'enum', values: ['steel', 'painted'], default: ({ theme }) => SCENES[sceneOf(theme)].sign, doc: 'The letters: flat dark weathering steel seen against the light, or painted letters with a thin top face lit from above' },
    letters: { type: 'color', default: ({ theme }) => SCENES[sceneOf(theme)].letters, doc: "The letters' colour (the build keeps it at 3:1 or more on everything the scene puts behind them)" },
    light: { type: 'number', min: 0.1, max: 0.9, default: ({ theme }) => SCENES[sceneOf(theme)].light, doc: 'Where the sun (or the lamp) stands across the width on wide screens, 0 left to 1 right. On phones it is placed for the phone layout' },
    air: { type: 'color', default: ({ theme }) => SCENES[sceneOf(theme)].air, doc: 'The colour far leaves fade into with distance (the haze, or the night)' },
    crown: { type: 'color', default: '#d9b83a', doc: "lamp-night: the ginkgo crown's colour where the lamp lights it" },
    density: { type: 'number', min: 0.4, max: 1.6, default: 1, doc: 'How many leaves fall (1: 24 far, 4 to 9 near the focal plane and 3 close to the lens on wide screens; about half on phones)' },
    landings: { type: 'integer', min: 0, max: 3, default: 3, doc: 'How many leaves land on the letters per cycle (phones take 2 at most)' },
    gust: { type: 'number', min: 0, max: 1.5, default: 1, doc: 'Strength of the gust that crosses the frame once per cycle (8 to 10.6 s), and of the pointer\'s gust' },
    cycle: { type: 'number', min: 16, max: 30, default: 20, doc: 'Seconds in one cycle: the loop of the video. Every leaf lives a whole number of times per cycle and the landings are scheduled within it' },
    follow: { type: 'boolean', default: true, doc: 'The pointer is a gust on a live page: it pushes the leaves near it, which spring back onto their paths' },
    grain: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'Fixed film grain, the same on every frame so the loop closes' },
    seed: { type: 'integer', min: 1, max: 9999, default: 7, doc: 'Where the leaves, the crowns and the bokeh fall' },
  },

  check(p, theme, problems) {
    if (theme.mode === 'dark' && p.scene === 'golden-hour') problems.push('a dark theme over the golden-hour wood puts light letters on bright haze; use scene "lamp-night" or a light theme')
    if (theme.mode !== 'dark' && p.scene === 'lamp-night') problems.push('a light theme over the night avenue puts dark letters on the night; use scene "golden-hour" or a dark theme')
    if (p.scene === 'golden-hour' && p.sign === 'painted') problems.push('painted letters are lit by the lamp; in the golden-hour wood use sign "steel"')
  },

  /** The letters the effect draws and what the scene puts behind them: the haze floor and the darkest crown it reaches (golden hour); the night and the lamp's spill (night). */
  typeGrounds(p) {
    if (p.scene === 'golden-hour') return [{ fg: p.letters, bg: '#cdb27a' }, { fg: p.letters, bg: '#8a6a3c' }, { fg: p.letters, bg: '#f2e0b4' }]
    return [{ fg: p.letters, bg: '#080b11' }, { fg: p.letters, bg: mix('#080b11', p.crown, 0.18) }, { fg: mix(p.letters, '#000000', 0.16), bg: '#141a24' }]
  },

  notes(p) {
    const n = []
    if (p.density > 1.3) n.push('above 1.3 the leaves start to read as a shower; the photograph holds best with few leaves in focus')
    if (p.scene === 'golden-hour' && contrast(p.letters, '#8a6a3c') < 4) n.push(`the letters read at ${contrast(p.letters, '#8a6a3c').toFixed(1)}:1 where the darkest crown can reach them; a darker letters colour gives more room`)
    return n
  },

  // the baked still pictures of the two worlds (scripts/effect/still.mjs bakes your own over them)
  assets: ['scripts/effect/stills/flh-golden-hour-wide.jpg', 'scripts/effect/stills/flh-golden-hour-tall.jpg', 'scripts/effect/stills/flh-lamp-night-wide.jpg', 'scripts/effect/stills/flh-lamp-night-tall.jpg'],
  // the wide picture on wide screens, the tall one on phones
  css: '.flh-tall{display:none} @media (max-width:759px){.flh-wide{display:none} .flh-tall{display:inline}}',

  /**
   * Before the first frame, and if WebGL is off: the scene at its still moment, baked by
   * scripts/effect/still.mjs (backdrop and leaves, without the letters: the page shows the real
   * headline over it), over a plain painting of the same light in case the picture is missing.
   */
  still(p, theme) {
    const night = p.scene === 'lamp-night'
    const x = 1600 * p.light
    const sky = night
      ? `<rect width="1600" height="900" fill="#080b11"/><radialGradient id="flh-l" cx="${x}" cy="180" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe6b0" stop-opacity="0.55"/><stop offset="0.3" stop-color="${p.crown}" stop-opacity="0.25"/><stop offset="1" stop-color="#080b11" stop-opacity="0"/></radialGradient><rect width="1600" height="900" fill="url(#flh-l)"/>`
      : `<linearGradient id="flh-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98a52"/><stop offset="0.45" stop-color="#ecd9a6"/><stop offset="1" stop-color="${theme.plate || theme.background}"/></linearGradient><rect width="1600" height="900" fill="url(#flh-s)"/><radialGradient id="flh-g" cx="${x}" cy="180" r="600" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="#fff4d6" stop-opacity="0"/></radialGradient><rect width="1600" height="900" fill="url(#flh-g)"/>`
    return {
      backdrop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${sky}</svg><svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%"><image class="flh-wide" href="assets/flh-${p.scene}-wide.jpg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/><image class="flh-tall" href="assets/flh-${p.scene}-tall.jpg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/></svg>`,
    }
  },
}
