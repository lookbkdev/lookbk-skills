// Parallax Depth: the effect description the Motion Heroes kit (v2) reads at
// build time. The drawing itself is effect.js (runs in the browser).
//
// A multiplane camera, in code. A scene is painted on six planes of glass at
// real distances from the lens (a mountain range at first light, or a city
// at night), and the headline is the plate between the third and fourth of
// them. Every plane moves by how far it is from the headline's plane:
// behind it they drift against the pointer, in front of it they move with
// it, and the headline itself is the still pivot. Scrolling raises the
// camera, as if you climbed: the near ridge, which stands across the foot of
// the letters at rest (typeMode "occlude": the two nearest planes are drawn
// on ctx.front, in front of the headline), drops clear of them while the far
// ranges and the sun rise behind: every ridge hides another.
//
// Atmospheric perspective is computed, not painted: every plane is mixed
// toward the colour of the air by its distance, the air brightens toward the
// light (forward scattering), mist lies in each valley, and the near planes
// are drawn out of focus. Raw WebGL1, no libraries.
import { mix, contrast } from '../color.mjs'

const STILL = 0

// Each scene's light and air. `land` is the nearest plane before any air.
const SCENES = {
  range: { sky: '#9fb2c1', horizon: '#efd9bd', light: '#fff1d6', air: '#bfc6ca', land: '#1d2826', lamp: '#ffd9a0' },
  city: { sky: '#070c19', horizon: '#26304a', light: '#f3ead6', air: '#2a3047', land: '#06080d', lamp: '#f2a54a' },
}

const sceneOf = (theme) => (theme.mode === 'dark' ? 'city' : 'range')

/** How much air lies between the lens and a plane at distance z (the shader's own curve). */
export const airAt = (z, scene) => 1 - Math.exp(-z * (scene === 'city' ? 0.13 : 0.2))
// the planes' distances; the headline's plane sits at 2.5
export const DEPTHS = [9, 5.4, 3.4, 1.6, 1]
export const TITLE_Z = 2.5

export default {
  id: 'parallax-depth',
  name: 'Parallax Depth',
  needs: 'webgl',
  cssPrefix: 'pdh',
  compositions: ['lockup'],
  typeMode: 'occlude',
  stillTime: STILL,
  posterTime: STILL,
  // scroll raises the camera over 1.25 screen heights; a recording rests 0.8 s, travels 6 s, rests 1.4 s
  story: (p) => (p.scroll ? { drive: 'scroll', pin: 1.25, length: 6, lead: 0.8, hold: 1.4, loop: false } : null),

  params: {
    scene: {
      type: 'enum',
      values: ['range', 'city'],
      default: ({ theme }) => (theme.mode === 'dark' ? 'city' : 'range'),
      doc: 'range: five ridges of a mountain range at first light, the sun low behind them, spruce on the near ridges and grass at the lens. city: a skyline at night in five depths, lit windows thinning out in the haze, a moon, rooftops and a water tower in front of the words. Default follows theme.mode',
    },
    depth: { type: 'number', min: 0, max: 1.5, default: 1, doc: 'How far the planes travel against each other when the pointer moves; 0 holds them still' },
    rise: { type: 'number', min: 0, max: 1, default: 0.8, doc: 'How far the camera rises over the scroll: the near ridge drops clear of the letters while the far ranges and the sun (or moon) rise behind them. 0 holds the camera at its height' },
    cover: { type: 'number', min: 0.1, max: 0.33, default: 0.3, doc: 'The most of any letter (share of its ink) the near plates may ever cover, at any pointer position or scroll. The page works it out per letter from the real font and holds the near plates below it; scripts/coverage.mjs measures it. At most a third' },
    scroll: { type: 'boolean', default: true, doc: 'Pin the hero for 1.25 screen heights and lower the camera as the visitor scrolls. false: no pinning, the scene only drifts and follows the pointer' },
    light: { type: 'number', min: 0.1, max: 0.9, default: 0.7, doc: 'Where the sun (or the moon) stands across the width, 0 left to 1 right' },
    mist: { type: 'number', min: 0, max: 1, default: 0.6, doc: 'How much mist lies in the valleys between the planes, and how much it drifts' },
    sky: { type: 'color', default: ({ theme }) => SCENES[sceneOf(theme)].sky, doc: "The sky overhead. Default the scene's own (the scene follows theme.mode)" },
    glow: { type: 'color', default: ({ theme }) => SCENES[sceneOf(theme)].horizon, doc: "The sky at the horizon, and the colour the air takes toward the light. Default the scene's own (the scene follows theme.mode)" },
    land: { type: 'color', default: ({ theme }) => SCENES[sceneOf(theme)].land, doc: "The nearest plane before any air is mixed in; the far planes are this colour seen through more and more air. Default the scene's own (the scene follows theme.mode)" },
    grain: { type: 'number', min: 0, max: 1, default: 0.5, doc: 'Fixed film grain (about 2% at 0.5), the same on every frame' },
    seed: { type: 'integer', min: 1, max: 9999, default: 3, doc: 'Where the peaks, trees and buildings fall' },
  },

  check(p, theme, problems) {
    if (!(p.cover <= 1 / 3)) problems.push(`effect.cover is ${p.cover}; the near plates may cover at most a third of any letter`)
    if (theme.mode === 'dark' && p.scene === 'range') problems.push('a dark theme over the range puts light letters on a pale dawn sky; use scene "city" or a light theme')
    if (theme.mode !== 'dark' && p.scene === 'city') problems.push('a light theme over the city puts dark letters on a night sky; use scene "range" or a dark theme')
  },

  /** What can sit behind the headline: the sky at the letters' height and the three planes behind them, each through its air. */
  grounds(p) {
    const air = SCENES[p.scene].air
    const out = [p.sky, mix(p.sky, p.glow, 0.5), p.glow]
    for (const z of DEPTHS.slice(0, 3)) out.push(mix(p.land, mix(air, p.glow, 0.35), airAt(z, p.scene)))
    return out
  },

  notes(p, theme) {
    const n = []
    if (p.depth > 1.2) n.push('depth above 1.2 moves the near ridge far enough that the letters it covers change while the pointer moves; keep it near 1 for long headlines')
    const worst = Math.min(...DEPTHS.slice(0, 3).map((z) => contrast(theme.ink, mix(p.land, SCENES[p.scene].air, airAt(z, p.scene)))))
    if (worst < 4) n.push(`the nearest plane behind the headline reads at ${worst.toFixed(1)}:1 under it; a lighter land colour (light theme) or darker (dark theme) gives more room`)
    return n
  },

  // the baked still pictures of the two examples (scripts/still.mjs bakes your own over them)
  assets: ['scripts/effect/stills/pdh-range-wide.jpg', 'scripts/effect/stills/pdh-range-tall.jpg', 'scripts/effect/stills/pdh-city-wide.jpg', 'scripts/effect/stills/pdh-city-tall.jpg'],
  // the wide picture on wide screens, the tall one on phones
  css: '.pdh-tall{display:none} @media (max-width:759px){.pdh-wide{display:none} .pdh-tall{display:inline}}',

  /**
   * Before the first frame, and if WebGL is off: the scene itself, baked at its still moment by
   * scripts/still.mjs (sky, every plate, light and mist, without the page's text), over a plain
   * painting of the same sky and ridges in case the picture is missing.
   */
  still(p) {
    const air = SCENES[p.scene].air
    const ridge = (i, base, amp, f, ph) => {
      let d = `M0 900 L0 ${base}`
      for (let x = 0; x <= 1600; x += 20) {
        const y = base - amp * (0.55 + 0.25 * Math.sin(x * f + ph) + 0.2 * Math.sin(x * f * 2.7 + ph * 1.9))
        d += ` L${x} ${y.toFixed(1)}`
      }
      const c = mix(p.land, mix(air, p.glow, 0.35), airAt(DEPTHS[i], p.scene))
      return `<path d="${d} L1600 900Z" fill="${c}"/>`
    }
    const city = p.scene === 'city'
    const sun = `<circle cx="${1600 * p.light}" cy="${city ? 150 : 420}" r="${city ? 22 : 34}" fill="${SCENES[p.scene].light}"/>`
    return {
      backdrop: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="pdh-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky}"/><stop offset="0.6" stop-color="${p.glow}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#pdh-s)"/>${sun}${ridge(0, 470, 150, 0.004, 1)}${ridge(1, 560, 110, 0.006, 2.3)}${ridge(2, 650, 90, 0.008, 4.1)}${ridge(3, 720, 60, 0.011, 0.7)}</svg><svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%"><image class="pdh-wide" href="assets/pdh-${p.scene}-wide.jpg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/><image class="pdh-tall" href="assets/pdh-${p.scene}-tall.jpg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/></svg>`,
    }
  },
}
