// Shared drawing helpers for the examples' pictures: SVG filters for paper,
// concrete, render, stone, clouds and film grain; a two-point perspective
// with vertical verticals (the way a shift lens draws a building); soft
// shadows; lens falloff.

export const svg = (w, h, defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`

export const pts = (a) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
export const poly = (a, attrs = '') => `<polygon points="${pts(a)}" ${attrs}/>`

/** grain, colour noise shaped into alpha: `alpha = R * slope + offset`, coloured `rgb` */
export function noise(id, { freq = '0.8', oct = 2, seed = 1, rgb = [0, 0, 0], slope = 1, offset = 0, type = 'fractalNoise' } = {}) {
  const [r, g, b] = rgb.map((v) => (v / 255).toFixed(3))
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="${type}" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch"/>
<feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${slope} 0 0 0 ${offset}"/></filter>`
}

/** relief: noise lit from one side (stone, rough concrete, render) */
export function relief(id, { freq = '0.04', oct = 4, seed = 3, scale = 3, az = 225, el = 35, color = '#fff' } = {}) {
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}" stitchTiles="stitch" result="n"/>
<feDiffuseLighting in="n" surfaceScale="${scale}" lighting-color="${color}" diffuseConstant="1"><feDistantLight azimuth="${az}" elevation="${el}"/></feDiffuseLighting></filter>`
}

export const blur = (id, s) => `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${s}"/></filter>`

/** A full-frame layer of filter `f`, clipped and blended. */
export const layer = (w, h, f, { clip, blend = 'multiply', op = 1 } = {}) =>
  `<rect width="${w}" height="${h}" filter="url(#${f})" ${clip ? `clip-path="url(#${clip})"` : ''} style="mix-blend-mode:${blend}" opacity="${op}"/>`

/** linear gradient from stops [[offset, colour, opacity?]] */
export const lin = (id, stops, [x1, y1, x2, y2] = [0, 0, 0, 1], extra = '') =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}>${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`
export const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.7, extra = '') =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" ${extra}>${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`

/** lens: falloff to the corners, a touch of warmth, film grain */
export function lens(w, h, { fall = 0.5, grain = 0.06, seed = 7 } = {}) {
  const defs = rad('lensFall', [[0.45, '#000', 0], [0.8, '#000', fall * 0.45], [1.05, '#000', fall]], 0.5, 0.5, 0.75) +
    noise('lensGrain', { freq: '0.9', oct: 2, seed, rgb: [128, 128, 128], slope: 0, offset: grain }) +
    noise('lensGrainD', { freq: '0.75', oct: 1, seed: seed + 3, rgb: [0, 0, 0], slope: grain * 2.2, offset: -grain * 0.6 })
  const body = `<rect width="${w}" height="${h}" fill="url(#lensFall)"/><rect width="${w}" height="${h}" filter="url(#lensGrainD)"/>`
  return { defs, body }
}

/**
 * Two-point perspective with vertical verticals. A face starts at the
 * vertical edge x0 (from yTop to yBot) and runs toward the vanishing point
 * (vx, vy). d is the distance along the face in world units (0..W ends at
 * x1); h is the height from the bottom (0) to the top (1).
 */
export function face({ x0, yTop, yBot, vx, vy, x1, W }) {
  const D = (W * (vx - x1)) / (x1 - x0)
  const X = (d) => x0 + ((vx - x0) * d) / (d + D)
  const Y = (y0, x) => y0 + ((vy - y0) * (x - x0)) / (vx - x0)
  const P = (d, h) => {
    const x = X(d)
    const yt = Y(yTop, x), yb = Y(yBot, x)
    return [x, yb + (yt - yb) * h]
  }
  return { P, X, quad: (d0, d1, h0, h1) => [P(d0, h1), P(d1, h1), P(d1, h0), P(d0, h0)] }
}

/** deterministic random */
export function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** cloud layer: stretched fractal noise turned into soft white masses */
export function clouds(id, { freq = '0.0016 0.0055', oct = 5, seed = 4, rgb = [255, 255, 255], slope = 2.4, offset = -1.15 } = {}) {
  return noise(id, { freq, oct, seed, rgb, slope, offset })
}
