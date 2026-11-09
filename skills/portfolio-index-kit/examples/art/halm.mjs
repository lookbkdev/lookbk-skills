// Example 2 (Teodor Halm, architectural photographer): nine buildings in
// light, drawn in SVG to read as photographs: two-point perspective with
// vertical verticals (a shift lens), concrete and render with texture and
// staining, soft shadow edges, depth haze, skies with cloud, lens falloff
// and grain. The Salt Archive is also a 12 s loop (the shadow of the
// building opposite moves across its face).
import { blur, clouds, face, layer, lens, lin, noise, poly, rad, relief, rng, svg } from './lib.mjs'

const L = [1200, 800]
const P = [800, 1000]

/* ---------- 1. Reixa House: a long low house on a coastal plateau at blue hour ---------- */
function reixa() {
  const [w, h] = L
  const hz = 470
  const R = face({ x0: 300, yTop: 368, yBot: 528, vx: 2700, vy: hz, x1: 1120, W: 30 })
  const Lf = face({ x0: 300, yTop: 368, yBot: 528, vx: -1400, vy: hz, x1: 150, W: 8 })
  const roofR = face({ x0: 282, yTop: 352, yBot: 372, vx: 2700, vy: hz, x1: 1200, W: 34.5 })
  const roofL = face({ x0: 282, yTop: 352, yBot: 372, vx: -1400, vy: hz, x1: 128, W: 9 })
  const defs = [
    lin('sky', [[0, '#0f1828'], [0.35, '#22314d'], [0.66, '#55607a'], [0.86, '#b48a7a'], [1, '#e2ab84']]),
    rad('dusk', [[0, '#f3b98a', 0.55], [1, '#f3b98a', 0]], 0.18, 0.95, 0.6),
    clouds('cl', { freq: '0.0009 0.011', seed: 11, rgb: [214, 168, 158], slope: 2.0, offset: -1.12 }),
    lin('clm', [[0, '#fff', 0], [0.5, '#fff', 0.55], [0.92, '#fff', 0.9], [1, '#fff', 0.3]]),
    `<mask id="clMask"><rect width="${w}" height="${hz}" fill="url(#clm)"/></mask>`,
    lin('sea', [[0, '#6c6f84'], [1, '#2f3548']]),
    lin('ground', [[0, '#25271f'], [0.4, '#191a14'], [1, '#0c0d0a']]),
    noise('grass', { freq: '0.02 0.16', oct: 4, seed: 5, rgb: [56, 60, 40], slope: 1.0, offset: -0.45 }),
    noise('grassD', { freq: '0.08 0.6', oct: 2, seed: 15, rgb: [0, 0, 0], slope: 1.2, offset: -0.45 }),
    relief('stone', { freq: '0.22', oct: 3, seed: 8, scale: 1.6, az: 160, el: 38, color: '#a39a8c' }),
    noise('deckN', { freq: '0.35 0.9', oct: 2, seed: 18, rgb: [0, 0, 0], slope: 0.5, offset: -0.18 }),
    lin('pool', [[0, '#f2b56c', 0.5], [1, '#f2b56c', 0]]),
    lin('glow', [[0, '#fbe0b2'], [0.55, '#eeb26e'], [1, '#c07738']]),
    lin('glassSky', [[0, '#8a96b0', 0.35], [0.4, '#8a96b0', 0]]),
    lin('soffit', [[0, '#b38660'], [0.7, '#6a5240'], [1, '#3a332e']], [0, 0, 1, 0]),
    lin('terr', [[0, '#4a453e'], [1, '#26231f']]),
    lin('haze', [[0, '#c9a28a', 0], [1, '#c9a28a', 0.32]]),
    blur('b2', 2), blur('b6', 6), blur('b14', 14), blur('b30', 30), blur('b3', 3),
    `<clipPath id="glass">${poly(R.quad(4, 24, 0, 1))}</clipPath>`,
  ]
  const lz = lens(w, h, { fall: 0.6, grain: 0.07 })
  defs.push(lz.defs)
  let mull = ''
  for (let d = 4; d <= 24.01; d += 2.5) mull += poly(R.quad(d - 0.05, d + 0.05, 0, 1), 'fill="#2a2420"')
  const lampA = R.P(9.5, 0.8), lampB = R.P(17.5, 0.8)
  // inside: the back wall (lit), the ceiling plane, a long table and bench, a shelf, a person reading
  const B = face({ x0: R.P(4, 0)[0], yTop: R.P(4, 1)[1] + 6, yBot: R.P(4, 0)[1] - 10, vx: 2700, vy: hz, x1: R.P(24, 0)[0], W: 20 })
  const interior = `<g clip-path="url(#glass)">
    <rect width="${w}" height="${h}" fill="url(#glow)"/>
    ${poly([R.P(4, 1), R.P(24, 1), B.P(20, 1), B.P(0, 1)], 'fill="#a4693c" opacity=".7"')}
    ${poly([R.P(4, 0), R.P(24, 0), B.P(20, 0), B.P(0, 0)], 'fill="#8a5326" opacity=".75"')}
    ${poly(B.quad(2, 8, 0.45, 0.5), 'fill="#5a3a22" opacity=".7"')}${[2.5, 4, 5.5, 7].map((d) => poly(B.quad(d, d + 0.9, 0.5, 0.62), 'fill="#6e4628" opacity=".6"')).join('')}
    <ellipse cx="${lampA[0]}" cy="${lampA[1]}" rx="46" ry="30" fill="#fff4d8" filter="url(#b14)" opacity=".85"/>
    <ellipse cx="${lampB[0]}" cy="${lampB[1]}" rx="34" ry="22" fill="#fff4d8" filter="url(#b14)" opacity=".7"/>
    <path d="M${lampA[0] - 9} ${lampA[1]} q9 -10 18 0z" fill="#3a2a1e"/><path d="M${lampB[0] - 7} ${lampB[1]} q7 -8 14 0z" fill="#3a2a1e"/>
    <line x1="${lampA[0]}" y1="${lampA[1] - 5}" x2="${lampA[0]}" y2="${R.P(9.5, 1)[1]}" stroke="#4a3626" stroke-width="1"/><line x1="${lampB[0]}" y1="${lampB[1] - 4}" x2="${lampB[0]}" y2="${R.P(17.5, 1)[1]}" stroke="#4a3626" stroke-width="1"/>
    ${poly([R.P(7.6, 0.31), R.P(12.6, 0.31), R.P(12.6, 0.28), R.P(7.6, 0.28)], 'fill="#3a2618"')}
    ${[8, 12.2].map((d) => poly([R.P(d, 0.28), R.P(d + 0.14, 0.28), R.P(d + 0.14, 0), R.P(d, 0)], 'fill="#3a2618"')).join('')}
    <g transform="translate(${R.P(13.4, 0)[0]} ${R.P(13.4, 0)[1]})" fill="#3c2819"><circle cx="0" cy="-60" r="7"/><path d="M-9 -52 Q0 -55 9 -52 L10 -26 L20 -24 L20 0 L16 0 L15 -18 L-8 -18 L-9 0 L-12 0z"/></g>
    ${poly([R.P(19.5, 0.7), R.P(23, 0.7), R.P(23, 0), R.P(19.5, 0)], 'fill="#d79a5c" opacity=".45"')}
    <rect width="${w}" height="${h}" fill="url(#glassSky)"/>
    ${mull}
  </g>`
  // the terrace: a stone deck in front of the glass, with the room reflected in it
  const deck = [R.P(0, 0), R.P(30, 0), [1300, 548], [1300, 600], [-40, 690], [-40, 600]]
  const refl = (d0, d1) => [R.P(d0, -0.02), R.P(d1, -0.02), R.P(d1, -0.55), R.P(d0, -0.55)]
  const bollards = [[150, 690], [430, 628], [640, 594], [810, 573], [950, 558]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y + 4}" rx="${26 - i * 3}" ry="${7 - i}" fill="#ffd9a0" filter="url(#b6)" opacity=".45"/><rect x="${x - 2.5 + i * 0.3}" y="${y - 14 + i * 2}" width="${5 - i * 0.6}" height="${16 - i * 2}" fill="#1c1b18"/><rect x="${x - 2.5 + i * 0.3}" y="${y - 14 + i * 2}" width="${5 - i * 0.6}" height="2.4" fill="#ffe7b8"/>`).join('')
  const body = `
  <rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="${hz}" fill="url(#dusk)"/>
  <g mask="url(#clMask)"><rect width="${w}" height="${hz}" filter="url(#cl)" opacity=".7"/></g>
  <rect y="${hz - 4}" width="${w}" height="30" fill="url(#sea)"/>
  <rect y="${hz - 4}" width="${w}" height="1.6" fill="#f0bb92" opacity=".6"/>
  <path d="M0 ${hz + 24} C300 ${hz + 18} 700 ${hz + 14} ${w} ${hz + 20} L${w} ${h} L0 ${h}z" fill="url(#ground)"/>
  <path d="M0 ${hz + 24} C300 ${hz + 18} 700 ${hz + 14} ${w} ${hz + 20} L${w} ${h} L0 ${h}z" filter="url(#grass)" opacity=".8"/>
  <path d="M0 ${hz + 24} C300 ${hz + 18} 700 ${hz + 14} ${w} ${hz + 20} L${w} ${h} L0 ${h}z" filter="url(#grassD)" opacity=".7"/>
  <rect y="${hz - 30}" width="${w}" height="66" fill="url(#haze)"/>
  ${poly(Lf.quad(0, 8, 0, 1), 'fill="#3a3733"')}${poly(Lf.quad(0, 8, 0, 1), 'filter="url(#stone)" style="mix-blend-mode:multiply" opacity=".7"')}
  ${poly(Lf.quad(0, 8, 0, 1), 'fill="#5a6b8c" opacity=".12"')}
  ${[[0, 4], [24, 30]].map(([a, b]) => poly(R.quad(a, b, 0, 1), 'fill="#2e2b28"') + poly(R.quad(a, b, 0, 1), 'filter="url(#stone)" style="mix-blend-mode:multiply" opacity=".7"')).join('')}
  ${poly(R.quad(0, 4, 0, 1), 'fill="#d79a5c" opacity=".08"')}
  ${interior}
  <g filter="url(#b30)" opacity=".5">${poly(R.quad(4, 24, 0.1, 0.9), 'fill="#f2b56c"')}</g>
  ${poly([roofR.P(0, 0), roofR.P(34.5, 0), R.P(30, 1), R.P(0, 1)], 'fill="url(#soffit)"')}
  ${poly(roofR.quad(0, 34.5, 0, 1), 'fill="#d6cfc2"')}${poly(roofL.quad(0, 9, 0, 1), 'fill="#8f8a82"')}
  ${poly(roofR.quad(0, 34.5, 0, 0.22), 'fill="#2a2622" opacity=".55"')}
  <line x1="${roofR.P(0, 1)[0]}" y1="${roofR.P(0, 1)[1]}" x2="${roofR.P(34.5, 1)[0]}" y2="${roofR.P(34.5, 1)[1]}" stroke="#f4efe6" stroke-width="1.2" opacity=".8"/>
  ${[26, 28.5, 31, 33.5].map((d) => { const q = R.P(d, 1); return `<circle cx="${q[0]}" cy="${q[1] + 3}" r="1.6" fill="#fff1d0"/><ellipse cx="${q[0]}" cy="${q[1] + 12}" rx="6" ry="14" fill="#ffd9a0" opacity=".25" filter="url(#b6)"/>` }).join('')}
  ${poly(deck, 'fill="url(#terr)"')}
  ${poly(deck, 'filter="url(#deckN)"')}
  <clipPath id="deckC">${poly(deck)}</clipPath>
  <g clip-path="url(#deckC)">
    <g filter="url(#b14)">${poly([R.P(4, 0), R.P(24, 0), [1180, 640], [180, 760]], 'fill="url(#pool)"')}</g>
    <g filter="url(#b3)" opacity=".5">${poly(refl(4, 24), 'fill="#f0b46e"')}${[6.5, 9, 11.5, 14, 16.5, 19, 21.5].map((d) => poly([R.P(d - 0.05, -0.02), R.P(d + 0.05, -0.02), R.P(d + 0.05, -0.5), R.P(d - 0.05, -0.5)], 'fill="#2a2420"')).join('')}</g>
    ${[...Array(14)].map((_, k) => { const d = k * 2.4; const a = R.P(d, 0); return `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${(a[0] - 260 + d * 4).toFixed(1)}" y2="820" stroke="#151412" stroke-width=".9" opacity=".55"/>` }).join('')}
    ${[0.12, 0.3, 0.55, 0.85].map((k) => `<line x1="-40" y1="${(530 + 170 * k).toFixed(1)}" x2="1300" y2="${(520 + 60 * k).toFixed(1)}" stroke="#151412" stroke-width=".9" opacity=".55"/>`).join('')}
  </g>
  ${bollards}
  ${lz.body}`
  return svg(w, h, defs.join(''), body)
}

/* ---------- 2. The Salt Archive: a board-marked concrete block; the shadow of the building opposite crosses it (loop) ---------- */
function archive(t = 0) {
  const [w, h] = L
  const hz = 600
  const R = face({ x0: 410, yTop: 92, yBot: 640, vx: 2900, vy: hz, x1: 1210, W: 40 })
  const Lf = face({ x0: 410, yTop: 92, yBot: 640, vx: -1300, vy: hz, x1: 96, W: 18 })
  const defs = [
    lin('sky', [[0, '#6f8fae'], [0.55, '#a9bccb'], [1, '#d6dde0']]),
    clouds('cl', { freq: '0.0019 0.0052', seed: 21, rgb: [246, 246, 243], slope: 2.3, offset: -1.12 }),
    noise('clShade', { freq: '0.0019 0.0052', oct: 5, seed: 21, rgb: [128, 140, 156], slope: 2.0, offset: -1.2 }),
    lin('conR', [[0, '#d3cbbd'], [0.6, '#c2b9a9'], [1, '#aea594']], [0, 0, 1, 0]),
    lin('conRv', [[0, '#000', 0], [0.85, '#000', 0], [1, '#000', 0.22]]),
    lin('conL', [[0, '#6b6862'], [1, '#85817a']], [0, 0, 1, 0]),
    noise('mottle', { freq: '0.008', oct: 4, seed: 9, rgb: [70, 64, 56], slope: 0.9, offset: -0.36 }),
    noise('streak', { freq: '0.05 0.002', oct: 3, seed: 12, rgb: [60, 56, 50], slope: 1.2, offset: -0.6 }),
    noise('pores', { freq: '0.45', oct: 1, seed: 2, rgb: [40, 38, 34], slope: 6, offset: -4.4 }),
    relief('rough', { freq: '0.2', oct: 2, seed: 6, scale: 1, az: 200, el: 55, color: '#ece5d8' }),
    lin('plaza', [[0, '#cbc4b6'], [1, '#8e877b']]),
    noise('pave', { freq: '0.006 0.05', oct: 3, seed: 30, rgb: [70, 66, 60], slope: 0.55, offset: -0.22 }),
    lin('dist', [[0, '#9aa5ad'], [1, '#b9bfbf']]),
    lin('glassR', [[0, '#9fb1bf'], [0.45, '#4f6271'], [1, '#1f262d']]),
    lin('ao', [[0, '#000', 0.38], [1, '#000', 0]]),
    blur('soft', 3), blur('soft8', 8), blur('soft20', 20),
    `<clipPath id="fR">${poly(R.quad(0, 40, 0, 1))}</clipPath>`,
    `<clipPath id="fL">${poly(Lf.quad(0, 18, 0, 1))}</clipPath>`,
    `<clipPath id="gnd"><rect y="${hz}" width="${w}" height="${h - hz}"/></clipPath>`,
  ]
  const lz = lens(w, h, { fall: 0.4, grain: 0.055, seed: 3 })
  defs.push(lz.defs)
  let win = '', ties = '', boards = ''
  const cols = [3, 8.5, 14, 19.5, 25, 30.5, 36]
  const rows = [0.07, 0.225, 0.38, 0.535, 0.69, 0.845]
  const lit = new Set(['2,3', '5,1'])
  rows.forEach((v, ri) => cols.forEach((d, ci) => {
    const d0 = d, d1 = d + 2.6, h0 = v, h1 = v + 0.09
    // glass (sky in it), set back: the far jamb catches the sun, the head and near jamb throw shadow onto the glass
    win += poly(R.quad(d0, d1, h0, h1), `fill="${lit.has(`${ci},${ri}`) ? '#e4c79a' : 'url(#glassR)'}"`)
    win += poly([R.P(d0, h1), R.P(d1 - 0.45, h1), R.P(d1 - 0.45, h1 - 0.03), R.P(d0 + 0.6, h1 - 0.03), R.P(d0 + 0.6, h0), R.P(d0, h0)], 'fill="#1a1d21" opacity=".55"')
    win += poly([R.P(d1 - 0.45, h1 - 0.004), R.P(d1, h1), R.P(d1, h0), R.P(d1 - 0.45, h0 + 0.004)], 'fill="#ddd4c4"')
    win += poly([R.P(d0, h0), R.P(d1, h0), R.P(d1, h0 - 0.007), R.P(d0, h0 - 0.007)], 'fill="#efe9dd"')
    win += poly([R.P(d0 + 0.6, h0 + 0.004), R.P(d1 - 0.45, h0 + 0.004), R.P(d1 - 0.45, h0), R.P(d0 + 0.6, h0)], 'fill="#2b2f33" opacity=".5"')
  }))
  for (let v = 0.035; v < 1; v += 0.0345) boards += `<polyline points="${[0, 10, 20, 30, 40].map((d) => R.P(d, v).map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#776f63" stroke-width=".55" opacity=".3"/>`
  for (let v = 0.02; v < 1; v += 0.069) for (let d = 1.2; d < 40; d += 2.75) { const [x, y] = R.P(d, v); ties += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.5 * (1 - d / 60)).toFixed(2)}" fill="#5e574d" opacity=".55"/>` }
  // the shadow of the building opposite: a straight edge sliding along the face and across the plaza
  const s = 4 + 24 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2))
  const sh = [R.P(-2, 1.5), R.P(s, 1.5), R.P(s + 10, -0.1), R.P(-2, -0.1)]
  const g0 = R.P(s + 10, 0)
  const shG = [[-50, 640], [g0[0], g0[1]], [g0[0] - 460, h + 40], [-50, h + 40]]
  const figure = (x, y, k, c = '#24211e') => `<g transform="translate(${x} ${y}) scale(${k})"><circle cx="0" cy="-35.5" r="3.6" fill="${c}"/><path d="M-4.6 -31 Q0 -33 4.6 -31 L5.4 -14 L3.2 -14 L2.6 0 L0.6 0 L0.2 -12 L-0.4 -12 L-0.9 0 L-2.9 0 L-3.3 -14 L-5.4 -14z" fill="${c}"/><path d="M-3 0 L26 4 L27 6 L-3 2z" fill="#000" opacity=".22"/></g>`
  let paving = ''
  for (let i = -14; i <= 14; i++) paving += `<line x1="2900" y1="${hz}" x2="${410 + i * 230}" y2="${h + 60}" stroke="#6a645a" stroke-width=".7" opacity=".4"/>`
  for (let k = 1; k < 12; k++) { const y = hz + 40 + k * k * 1.6 + k * 4; paving += `<line x1="-100" y1="${y + 26}" x2="${w + 100}" y2="${y - 22}" stroke="#6a645a" stroke-width=".6" opacity=".32"/>` }
  const body = `
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <rect x="-80" width="${w + 160}" height="${hz}" filter="url(#clShade)" opacity=".55" transform="translate(${(-30 * Math.sin(t * Math.PI * 2)).toFixed(2)} 8)"/>
  <rect x="-80" width="${w + 160}" height="${hz}" filter="url(#cl)" opacity=".9" transform="translate(${(-30 * Math.sin(t * Math.PI * 2)).toFixed(2)} 0)"/>
  <rect y="${hz - 70}" width="${w}" height="90" fill="#dfe4e3" opacity=".6" filter="url(#soft20)"/>
  <path d="M0 ${hz} L0 ${hz - 34} L30 ${hz - 34} L30 ${hz - 52} L70 ${hz - 52} L70 ${hz - 28} L110 ${hz - 28} L110 ${hz}z" fill="url(#dist)" opacity=".9"/>
  <g clip-path="url(#gnd)">
    <rect y="${hz}" width="${w}" height="${h - hz}" fill="url(#plaza)"/>
    <rect y="${hz}" width="${w}" height="${h - hz}" filter="url(#pave)" style="mix-blend-mode:multiply" opacity=".5"/>
    ${paving}
    <g filter="url(#soft8)">${poly(shG, 'fill="#2b2d33" opacity=".42"')}</g>
    ${poly([Lf.P(18, 0), Lf.P(0, 0), R.P(0, 0), R.P(40, 0), [1300, 655], [1300, 676], [60, 676]], 'fill="url(#ao)" opacity=".7"')}
  </g>
  ${poly(R.quad(0, 40, 0, 1), 'fill="url(#conR)"')}
  ${poly(Lf.quad(0, 18, 0, 1), 'fill="url(#conL)"')}
  <g clip-path="url(#fR)">
    ${layer(w, h, 'rough', { op: 0.3 })}${layer(w, h, 'mottle', { op: 0.55 })}${layer(w, h, 'streak', { op: 0.45 })}${layer(w, h, 'pores', { op: 0.45 })}
    ${boards}${ties}${win}
    ${poly(R.quad(0, 40, -0.02, 0.06), 'fill="url(#conRv)" opacity=".0"')}
    <g filter="url(#soft)">${poly(sh, 'fill="#20232a" opacity=".5"')}</g>
    ${poly([R.P(0, 0), R.P(40, 0), R.P(40, 0.03), R.P(0, 0.03)], 'fill="#3a3530" opacity=".35"')}
  </g>
  <g clip-path="url(#fL)">${layer(w, h, 'mottle', { op: 0.45 })}${layer(w, h, 'streak', { op: 0.5 })}${layer(w, h, 'pores', { op: 0.35 })}
    ${[0.22, 0.52, 0.82].map((v) => poly(Lf.quad(5, 6.3, v - 0.1, v + 0.1), 'fill="#23272b"')).join('')}</g>
  <line x1="410" y1="92" x2="410" y2="640" stroke="#f3eee4" stroke-width="1" opacity=".5"/>
  ${figure(612, 676, 1.05)}${figure(668, 664, 0.92, '#2d2925')}${figure(980, 652, 0.6, '#3a3631')}
  ${lz.body}`
  return svg(w, h, defs.join(''), body)
}

/* ---------- 3. Quarry Chapel: a stone room lit by one slot in the roof ---------- */
function chapel() {
  const [w, h] = P
  const defs = [
    relief('rock', { freq: '0.018', oct: 5, seed: 14, scale: 5, az: 90, el: 25, color: '#8f8576' }),
    relief('rockF', { freq: '0.06', oct: 3, seed: 4, scale: 2, az: 90, el: 40, color: '#b0a796' }),
    lin('beam', [[0, '#fff3d6', 0.55], [0.7, '#fff3d6', 0.16], [1, '#fff3d6', 0.04]]),
    rad('pool', [[0, '#fff1d2', 0.95], [0.5, '#e8d4ae', 0.5], [1, '#e8d4ae', 0]], 0.5, 0.5, 0.5),
    lin('dark', [[0, '#000', 0.2], [0.5, '#000', 0.55], [1, '#000', 0.8]], [0, 0, 1, 0]),
    lin('darkR', [[0, '#000', 0.8], [0.5, '#000', 0.55], [1, '#000', 0.2]], [0, 0, 1, 0]),
    noise('dust', { freq: '0.6', oct: 1, seed: 5, rgb: [255, 245, 220], slope: 6, offset: -5.1 }),
    blur('b4', 4), blur('b18', 18), blur('b40', 40),
    `<clipPath id="beamC"><path d="M380 0 L420 0 L560 900 L250 900z"/></clipPath>`,
  ]
  const lz = lens(w, h, { fall: 0.7, grain: 0.08, seed: 9 })
  defs.push(lz.defs)
  const body = `
  <rect width="${w}" height="${h}" fill="#3d3832"/>
  <rect width="${w}" height="${h}" filter="url(#rock)" opacity=".9" style="mix-blend-mode:multiply"/>
  <rect width="${w}" height="${h}" filter="url(#rockF)" opacity=".35" style="mix-blend-mode:multiply"/>
  <path d="M0 0 L240 120 L240 860 L0 1000z" fill="url(#dark)"/><path d="M800 0 L560 120 L560 860 L800 1000z" fill="url(#darkR)"/>
  <path d="M240 860 L560 860 L800 1000 L0 1000z" fill="#26231f"/>
  <path d="M240 860 L560 860 L800 1000 L0 1000z" filter="url(#rockF)" style="mix-blend-mode:multiply" opacity=".6"/>
  <path d="M0 0 L800 0 L560 120 L240 120z" fill="#1a1815"/>
  <rect x="383" y="0" width="34" height="120" fill="#fff8e6"/>
  <rect x="383" y="120" width="34" height="740" fill="#e9dcc2" opacity=".8"/>
  <rect x="383" y="120" width="34" height="740" filter="url(#rockF)" style="mix-blend-mode:multiply"/>
  <g filter="url(#b18)"><path d="M383 0 L417 0 L560 900 L250 900z" fill="url(#beam)"/></g>
  <g clip-path="url(#beamC)" opacity=".5"><rect width="${w}" height="${h}" filter="url(#dust)"/></g>
  <ellipse cx="405" cy="905" rx="150" ry="34" fill="url(#pool)" filter="url(#b4)"/>
  <rect x="352" y="812" width="96" height="48" fill="#5a5145"/><rect x="352" y="812" width="96" height="6" fill="#c9b892" opacity=".7"/>
  <path d="M352 860 L448 860 L470 876 L330 876z" fill="#000" opacity=".35" filter="url(#b4)"/>
  <circle cx="400" cy="60" r="60" fill="#fff6e0" filter="url(#b40)" opacity=".6"/>
  ${lz.body}`
  return svg(w, h, defs.join(''), body)
}

/* ---------- 4. Pier 9 Terminal: a thin white canopy over the quay, wet ground, overcast ---------- */
function terminal() {
  const [w, h] = L
  const hz = 500
  const C = face({ x0: 140, yTop: 150, yBot: 186, vx: 2400, vy: hz, x1: 1200, W: 60 })
  const defs = [
    lin('sky', [[0, '#8d969c'], [0.6, '#bcc2c3'], [1, '#d6d8d4']]),
    clouds('cl', { freq: '0.0014 0.005', seed: 33, rgb: [230, 232, 230], slope: 1.6, offset: -0.75 }),
    noise('clD', { freq: '0.0014 0.005', oct: 5, seed: 34, rgb: [110, 118, 124], slope: 1.6, offset: -0.85 }),
    lin('sea', [[0, '#7d8a8a'], [1, '#4c5a5c']]),
    lin('quay', [[0, '#9a9890'], [1, '#4a4842']]),
    noise('wet', { freq: '0.004 0.04', oct: 4, seed: 8, rgb: [210, 214, 214], slope: 1.4, offset: -0.6 }),
    noise('grit', { freq: '0.5', oct: 2, seed: 2, rgb: [30, 30, 28], slope: 0.6, offset: -0.2 }),
    lin('under', [[0, '#c7c8c4'], [1, '#8e908d']], [0, 0, 1, 0]),
    lin('glassT', [[0, '#c2cacb', 0.55], [1, '#59656a', 0.7]]),
    blur('b3', 3), blur('b10', 10), blur('b1', 1),
  ]
  const lz = lens(w, h, { fall: 0.38, grain: 0.06, seed: 12 })
  defs.push(lz.defs)
  const G = face({ x0: 140, yTop: 186, yBot: 640, vx: 2400, vy: hz, x1: 1200, W: 60 })
  let cols = '', refl = ''
  for (let d = 3; d < 60; d += 6) {
    const [xt, yt] = G.P(d, 1), [xb, yb] = G.P(d, 0)
    const k = 1 - d / 70
    cols += `<rect x="${(xt - 3.2 * k).toFixed(1)}" y="${yt}" width="${(6.4 * k).toFixed(1)}" height="${(yb - yt).toFixed(1)}" fill="#e6e4dd"/><rect x="${(xt + 0.8 * k).toFixed(1)}" y="${yt}" width="${(2.4 * k).toFixed(1)}" height="${(yb - yt).toFixed(1)}" fill="#9c9d98"/>`
    refl += `<rect x="${(xt - 3.2 * k).toFixed(1)}" y="${yb}" width="${(6.4 * k).toFixed(1)}" height="${((yb - yt) * 0.5).toFixed(1)}" fill="#d9d8d2" opacity=".35"/>`
  }
  const glass = [G.P(14, 0.82), G.P(52, 0.82), G.P(52, 0), G.P(14, 0)]
  let mul = ''
  for (let d = 14; d <= 52; d += 3) mul += poly([G.P(d, 0.82), G.P(d + 0.12, 0.82), G.P(d + 0.12, 0), G.P(d, 0)], 'fill="#3d4447" opacity=".7"')
  const fig = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})" fill="#22201d"><circle cx="0" cy="-36" r="3.8"/><path d="M-5 -31 Q0 -33 5 -31 L5.6 -13 L3 -13 L2.4 0 L.6 0 L0 -11 L-.6 -11 L-1.2 0 L-3 0 L-3.4 -13 L-5.6 -13z"/></g><g transform="translate(${x} ${y}) scale(${k} ${-k * 0.8})" fill="#22201d" opacity=".22"><circle cx="0" cy="-36" r="3.8"/><path d="M-5 -31 L5 -31 L5.6 -13 L2.4 0 L-3 0 L-5.6 -13z"/></g>`
  const body = `
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <rect width="${w}" height="${hz}" filter="url(#clD)" opacity=".6"/><rect width="${w}" height="${hz}" filter="url(#cl)" opacity=".8"/>
  <rect y="${hz - 2}" width="${w}" height="60" fill="url(#sea)"/>
  <path d="M0 ${hz - 2} L60 ${hz - 18} L130 ${hz - 12} L200 ${hz - 22} L260 ${hz - 2}z" fill="#8a9496" opacity=".7"/>
  <path d="M0 ${hz + 58} L${w} ${hz + 20} L${w} ${h} L0 ${h}z" fill="url(#quay)"/>
  <path d="M0 ${hz + 58} L${w} ${hz + 20} L${w} ${h} L0 ${h}z" filter="url(#wet)" opacity=".55" style="mix-blend-mode:screen"/>
  <path d="M0 ${hz + 58} L${w} ${hz + 20} L${w} ${h} L0 ${h}z" filter="url(#grit)" style="mix-blend-mode:multiply"/>
  ${poly(glass, 'fill="url(#glassT)"')}${mul}
  <g filter="url(#b3)">${refl}${poly([G.P(14, 0), G.P(52, 0), G.P(52, -0.3), G.P(14, -0.3)], 'fill="#a9b1b2" opacity=".25"')}</g>
  ${cols}
  ${poly([C.P(0, 0), C.P(60, 0), G.P(60, 1), G.P(0, 1)], 'fill="url(#under)"')}
  ${poly([[0, 168], C.P(0, 1), C.P(60, 1), C.P(60, 0), C.P(0, 0), [0, 210]], 'fill="#f1efe9"')}
  ${poly([C.P(0, 0.12), C.P(60, 0.12), C.P(60, 0), C.P(0, 0)], 'fill="#b9b8b2"')}
  <g filter="url(#b10)" opacity=".35">${poly([[0, 640], G.P(0, 0), G.P(60, 0), [1300, 560], [1300, 600], [0, 760]], 'fill="#2a2a28"')}</g>
  ${fig(520, 600, 1.1)}${fig(700, 574, 0.85)}${fig(905, 552, 0.6)}${fig(360, 640, 1.3)}
  ${lz.body}`
  return svg(w, h, defs.join(''), body)
}

/* ---------- 5. Low Walls: dry-stone walls of one valley, overcast ---------- */
function walls() {
  const [w, h] = L
  const r = rng(77)
  const defs = [
    lin('sky', [[0, '#8f989c'], [0.7, '#c9ccc6'], [1, '#d9dad3']]),
    clouds('cl', { freq: '0.0012 0.004', seed: 41, rgb: [228, 229, 225], slope: 1.5, offset: -0.7 }),
    lin('h1', [[0, '#9ba29c'], [1, '#aeb3ab']]), lin('h2', [[0, '#7c8676'], [1, '#8e9686']]), lin('h3', [[0, '#5d6a52'], [1, '#6c7660']]),
    lin('field', [[0, '#80866e'], [0.4, '#666c56'], [1, '#41463a']]),
    noise('grassT', { freq: '0.006 0.05', oct: 4, seed: 6, rgb: [30, 40, 20], slope: 0.9, offset: -0.32 }),
    noise('grassF', { freq: '0.05 0.4', oct: 2, seed: 16, rgb: [20, 26, 12], slope: 1.2, offset: -0.5 }),
    relief('stoneR', { freq: '0.35', oct: 2, seed: 3, scale: 1.4, az: 120, el: 45, color: '#d2cec5' }),
    lin('haze', [[0, '#d0d3cd', 0], [0.55, '#d0d3cd', 0.55], [1, '#d0d3cd', 0.1]]),
    blur('b1', 0.5), blur('b6', 6),
  ]
  const lz = lens(w, h, { fall: 0.38, grain: 0.07, seed: 4 })
  defs.push(lz.defs)
  // the wall: a face from the near left edge running to (930, 452), about 1.3 m high
  const F = face({ x0: -60, yTop: 430, yBot: 820, vx: 1180, vy: 446, x1: 1100, W: 140 })
  const T = face({ x0: -60, yTop: 430, yBot: 430, vx: 1180, vy: 446, x1: 1100, W: 140 })
  let stones = ''
  const courses = 8
  for (let c = 0; c < courses; c++) {
    let d = -r() * 1.2
    const h0 = c / courses, h1 = (c + 1) / courses
    while (d < 140) {
      const len = 0.22 + r() * 0.6
      const a = Math.max(d, 0), b = Math.min(d + len, 140)
      const j = 0.3 / courses
      const p = [F.P(a + 0.04, h1 - j * r()), F.P(b - 0.04, h1 - j * r()), F.P(b - 0.04, h0 + j * r()), F.P(a + 0.04, h0 + j * r())]
      const m = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2]
      const bulge = (u, v, k) => { const q = m(u, v); return [q[0], q[1] + k] }
      const H = Math.abs(p[0][1] - p[3][1])
      const g = 92 + Math.floor(r() * 62)
      const tone = `rgb(${g},${g - 3 - Math.floor(r() * 7)},${g - 10 - Math.floor(r() * 12)})`
      const e = (u, v, k) => `Q${bulge(u, v, k)[0].toFixed(1)} ${bulge(u, v, k)[1].toFixed(1)} ${v[0].toFixed(1)} ${v[1].toFixed(1)}`
      stones += `<path d="M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)} ${e(p[0], p[1], -H * 0.18)} ${e(p[1], p[2], 0)} ${e(p[2], p[3], H * 0.14)} ${e(p[3], p[0], 0)}z" fill="${tone}"/>`
      stones += `<path d="M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)} ${e(p[0], p[1], -H * 0.18)}" stroke="#e9e5dc" stroke-width="${Math.max(0.3, H * 0.05).toFixed(2)}" fill="none" opacity=".22"/>`
      d += len
    }
  }
  // coping: stones on edge along the top
  let cope = ''
  for (let d = 0; d < 140; ) { const len = 0.12 + r() * 0.14; const a = T.P(d, 0), b = T.P(d + len, 0); const H = (F.P(d, 0)[1] - F.P(d, 1)[1]) * (0.05 + r() * 0.04); const g = 84 + Math.floor(r() * 50); cope += `<path d="M${a[0].toFixed(1)} ${(a[1] + 2).toFixed(1)} C${a[0].toFixed(1)} ${(a[1] - H).toFixed(1)} ${b[0].toFixed(1)} ${(b[1] - H).toFixed(1)} ${b[0].toFixed(1)} ${(b[1] + 2).toFixed(1)}z" fill="rgb(${g},${g - 4},${g - 12})"/>`; d += len }
  const face0 = F.quad(0, 140, 0, 1)
  const distant = [[340, 456, 760, 446], [520, 470, 1200, 486], [700, 440, 1200, 432], [0, 446, 300, 452]].map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#4d5243" stroke-width="2.2" stroke-dasharray="3 1.4" opacity=".55"/>`).join('')
  const body = `
  <rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="440" filter="url(#cl)" opacity=".7"/>
  <path d="M0 380 C200 330 380 352 560 326 C760 300 980 340 1200 318 L1200 470 L0 470z" fill="url(#h1)"/>
  <path d="M0 418 C220 384 420 404 640 376 C860 352 1020 396 1200 384 L1200 480 L0 480z" fill="url(#h2)"/>
  <rect y="320" width="${w}" height="130" fill="url(#haze)"/>
  <path d="M0 440 C300 428 700 432 1200 424 L1200 800 L0 800z" fill="url(#field)"/>
  <path d="M0 440 C300 428 700 432 1200 424 L1200 800 L0 800z" filter="url(#grassT)" style="mix-blend-mode:multiply"/>
  ${distant}
  <path d="M0 640 L1200 520 L1200 800 L0 800z" filter="url(#grassF)" style="mix-blend-mode:multiply" opacity=".8"/>
  <g filter="url(#b6)" opacity=".5">${poly([F.P(0, 0), F.P(140, 0), [1100, 460], [-60, 880]], 'fill="#1e2218"')}</g>
  ${poly(face0, 'fill="#2a2823"')}
  <g filter="url(#b1)">${stones}</g>
  <clipPath id="wf">${poly(face0)}</clipPath>
  <g clip-path="url(#wf)"><rect width="${w}" height="${h}" filter="url(#stoneR)" style="mix-blend-mode:multiply" opacity=".3"/></g>
  ${cope}
  ${lz.body}`
  return svg(w, h, defs.join(''), body)
}

/* ---------- 6. Tidal Pool: a restored sea pool at the lowest tide, low sun ---------- */
function pool() {
  const [w, h] = L
  const hz = 330
  const defs = [
    lin('sky', [[0, '#7f97ad'], [0.7, '#d9d0bd'], [1, '#f1d6a8']]),
    clouds('cl', { freq: '0.0012 0.008', seed: 51, rgb: [250, 236, 214], slope: 2.1, offset: -1.08 }),
    lin('sea', [[0, '#7f8d96'], [0.3, '#4b6372'], [1, '#2b3f4c']]),
    noise('swell', { freq: '0.003 0.06', oct: 3, seed: 7, rgb: [240, 230, 205], slope: 2.6, offset: -1.5 }),
    lin('water', [[0, '#5f9a9c'], [0.6, '#2f6d74'], [1, '#1f4e56']]),
    noise('caust', { freq: '0.03 0.06', oct: 2, seed: 4, rgb: [190, 230, 222], slope: 2.4, offset: -1.35, type: 'turbulence' }),
    lin('rim', [[0, '#e9e1d0'], [1, '#bdb3a1']]),
    noise('conc', { freq: '0.02', oct: 4, seed: 3, rgb: [80, 72, 60], slope: 1, offset: -0.38 }),
    relief('rocks', { freq: '0.045', oct: 5, seed: 22, scale: 5, az: 250, el: 30, color: '#c9c6bf' }),
    lin('glint', [[0, '#fff1cc', 0], [0.5, '#fff1cc', 0.8], [1, '#fff1cc', 0]], [0, 0, 1, 0]),
    blur('b2', 2), blur('b8', 8), blur('b30p', 30),
  ]
  const lz = lens(w, h, { fall: 0.45, grain: 0.06, seed: 21 })
  defs.push(lz.defs)
  // pool rim in perspective: near edge wide, far edge narrow
  const outer = [[150, 420], [1080, 420], [1260, 690], [-60, 690]]
  const inner = [[176, 432], [1052, 432], [1214, 676], [-14, 676]]
  const ladder = [0, 1].map((i) => `<path d="M${620 + i * 30} 432 L${626 + i * 34} 520" stroke="#c9c2b4" stroke-width="2.4"/>`).join('') + [0, 1, 2, 3].map((k) => `<line x1="${621 + k * 1.5}" y1="${446 + k * 20}" x2="${651 + k * 2.4}" y2="${446 + k * 20}" stroke="#c9c2b4" stroke-width="1.6"/>`).join('')
  const body = `
  <rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="${hz}" filter="url(#cl)" opacity=".8"/>
  <circle cx="980" cy="${hz - 34}" r="120" fill="#fff0c8" opacity=".35" filter="url(#b30p)"/><circle cx="980" cy="${hz - 34}" r="26" fill="#fff6e0" opacity=".9" filter="url(#b2)"/>
  <rect y="${hz}" width="${w}" height="${h - hz}" fill="url(#sea)"/>
  <rect y="${hz}" width="${w}" height="${h - hz}" filter="url(#swell)" opacity=".6"/>
  <path d="M760 ${hz} L1200 ${hz} L1200 ${hz + 40} L760 ${hz + 40}z" fill="url(#glint)" opacity=".5"/>
  ${poly(outer, 'fill="url(#rim)"')}${poly(outer, 'filter="url(#conc)" style="mix-blend-mode:multiply"')}
  ${poly([[150, 420], [1080, 420], [1080, 428], [150, 428]], 'fill="#8d8473"')}
  ${poly(inner, 'fill="url(#water)"')}
  <clipPath id="inC">${poly(inner)}</clipPath>
  <g clip-path="url(#inC)"><rect width="${w}" height="${h}" filter="url(#caust)" opacity=".35" style="mix-blend-mode:screen"/>
    <path d="M176 432 L1052 432 L1060 450 L170 450z" fill="#0d2a30" opacity=".35" filter="url(#b2)"/>
    <path d="M760 432 L1000 432 L1100 676 L820 676z" fill="#f6e1b4" opacity=".14" filter="url(#b8)"/></g>
  ${ladder}
  <rect y="690" width="${w}" height="110" fill="#4a4743"/><rect y="690" width="${w}" height="110" filter="url(#rocks)" style="mix-blend-mode:multiply"/>
  <rect y="686" width="${w}" height="10" fill="#d9cfbd"/>
  <g transform="translate(330 420)" fill="#2a2622"><circle cx="0" cy="-26" r="3"/><path d="M-3.6 -22 L3.6 -22 L4 -10 L2 0 L-2 0 L-4 -10z"/></g>
  ${lz.body}`
  return svg(w, h, defs.join(''), body)
}

/* ---------- 7. Concrete Hours: a monumental stair between two walls, raking light ---------- */
function stair() {
  const [w, h] = L
  const vx = 600, vy = 120
  const defs = [
    noise('mottle', { freq: '0.007', oct: 4, seed: 19, rgb: [70, 64, 56], slope: 0.8, offset: -0.3 }),
    noise('pores', { freq: '0.5', oct: 1, seed: 6, rgb: [40, 38, 34], slope: 6, offset: -4.5 }),
    noise('streak', { freq: '0.04 0.002', oct: 3, seed: 8, rgb: [60, 56, 50], slope: 1.1, offset: -0.55 }),
    relief('rough', { freq: '0.2', oct: 2, seed: 2, scale: 1, az: 160, el: 50, color: '#efe8db' }),
    lin('wallL', [[0, '#d9d0bf'], [1, '#c1b8a6']], [0, 0, 1, 0]),
    lin('wallR', [[0, '#8f887c'], [1, '#a59d8f']], [0, 0, 1, 0]),
    lin('sky', [[0, '#8fa9bf'], [1, '#dfe3e2']]),
    clouds('clS', { freq: '0.003 0.008', seed: 71, rgb: [248, 248, 246], slope: 2.2, offset: -1.1 }),
    blur('soft', 4), blur('b12', 12),
  ]
  const lz = lens(w, h, { fall: 0.45, grain: 0.06, seed: 31 })
  defs.push(lz.defs)
  // one-point perspective: the stair rises toward the vanishing point between two walls
  const xL = (y) => vx + ((-260 - vx) * (y - vy)) / (900 - vy)
  const xR = (y) => vx + ((1460 - vx) * (y - vy)) / (900 - vy)
  const wl = (y) => vx + ((140 - vx) * (y - vy)) / (900 - vy)
  const wr = (y) => vx + ((1060 - vx) * (y - vy)) / (900 - vy)
  let steps = ''
  let y = 800
  const top = 330
  let i = 0
  while (y > top) {
    const k = (y - vy) / (800 - vy)
    const rise = 34 * k, tread = 22 * k
    steps += `<path d="M${wl(y)} ${y} L${wr(y)} ${y} L${wr(y - rise)} ${y - rise} L${wl(y - rise)} ${y - rise}z" fill="#7c766c"/>`
    steps += `<path d="M${wl(y - rise)} ${y - rise} L${wr(y - rise)} ${y - rise} L${wr(y - rise - tread)} ${y - rise - tread} L${wl(y - rise - tread)} ${y - rise - tread}z" fill="#e3dccf"/>`
    steps += `<path d="M${wl(y - rise)} ${y - rise} L${wr(y - rise)} ${y - rise}" stroke="#f7f2e8" stroke-width="${(1.2 * k + 0.3).toFixed(2)}" opacity=".8"/>`
    y -= rise + tread; i++
  }
  const land = y
  const sh = [[wl(800), 800], [wl(land), land], [wl(land) + 70, land], [wr(800) - 260, 800]]
  const body = `
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <path d="M${wl(land)} ${land} L${wr(land)} ${land} L${wr(land)} ${land - 140} L${wl(land)} ${land - 140}z" fill="#cfc7b8"/>
  <path d="M${vx - 40} ${land} L${vx + 40} ${land} L${vx + 40} ${land - 92} L${vx - 40} ${land - 92}z" fill="#25282c"/>
  ${steps}
  <path d="M0 0 L${wl(land)} ${land - 140} L${wl(land)} ${land} L${wl(800)} 800 L${wl(900)} 900 L0 900z" fill="url(#wallL)"/>
  <path d="M${w} 0 L${wr(land)} ${land - 140} L${wr(land)} ${land} L${wr(800)} 800 L${wr(900)} 900 L${w} 900z" fill="url(#wallR)"/>
  <path d="M0 0 L${wl(land)} ${land - 140} L${wr(land)} ${land - 140} L${w} 0z" fill="url(#sky)"/>
  <path d="M0 0 L${wl(land)} ${land - 140} L${wr(land)} ${land - 140} L${w} 0z" filter="url(#clS)" opacity=".7"/>
  <clipPath id="conc"><path d="M0 0 L${wl(land)} ${land - 140} L${wr(land)} ${land - 140} L${w} 0 L${w} ${h} L0 ${h}z"/></clipPath>
  <g clip-path="url(#conc)">
  <rect width="${w}" height="${h}" filter="url(#rough)" style="mix-blend-mode:multiply" opacity=".3"/>
  <rect width="${w}" height="${h}" filter="url(#mottle)" style="mix-blend-mode:multiply" opacity=".5"/>
  <rect width="${w}" height="${h}" filter="url(#streak)" style="mix-blend-mode:multiply" opacity=".28"/>
  <rect width="${w}" height="${h}" filter="url(#pores)" opacity=".35"/></g>
  <g filter="url(#soft)">${poly(sh, 'fill="#1f2228" opacity=".46"')}</g>
  <path d="M${w} 0 L${wr(land)} ${land - 140} L${wr(900)} 900 L${w} 900z" fill="#1f2228" opacity=".18"/>
  <g transform="translate(${vx + 14} ${land})" fill="#25221e"><circle cx="0" cy="-27" r="3"/><path d="M-3.6 -23 L3.6 -23 L4 -10 L1.9 0 L.4 0 L0 -8 L-.4 -8 L-1.4 0 L-3 0 L-4 -10z"/></g>
  ${lz.body}`
  return svg(w, h, defs.join(''), body)
}

/* ---------- 8. White Curve: one rendered wall turning away against a deep sky, one figure ---------- */
function curve() {
  const [w, h] = P
  const defs = [
    lin('sky', [[0, '#0f2a4d'], [0.55, '#2b5a8a'], [1, '#7ea4c6']]),
    clouds('cl', { freq: '0.003 0.014', seed: 61, rgb: [236, 242, 250], slope: 1.3, offset: -0.95 }),
    lin('wallG', [[0, '#cfc9be'], [0.16, '#f3f0e9'], [0.34, '#fdfcf8'], [0.58, '#e9e4d9'], [0.8, '#c2bcb0'], [1, '#8c877e']], [0, 0, 1, 0]),
    noise('render', { freq: '0.9', oct: 2, seed: 12, rgb: [90, 86, 78], slope: 0.35, offset: -0.12 }),
    noise('renderM', { freq: '0.012 0.02', oct: 4, seed: 4, rgb: [120, 112, 100], slope: 0.35, offset: -0.14 }),
    lin('ground', [[0, '#b9b0a0'], [1, '#7e776b']]),
    lin('foot', [[0, '#000', 0], [1, '#000', 0.22]]),
    blur('b3', 3), blur('b6', 6),
  ]
  const lz = lens(w, h, { fall: 0.5, grain: 0.06, seed: 17 })
  defs.push(lz.defs)
  // a cylinder seen from low down: the top edge is an arc, the foot almost straight
  const top = 'M-20 300 C160 236 420 214 830 262'
  const wall = `${top} L830 842 C420 836 160 838 -20 846z`
  const body = `
  <rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="${h}" filter="url(#cl)" opacity=".35"/>
  <path d="${wall}" fill="url(#wallG)"/>
  <clipPath id="wc"><path d="${wall}"/></clipPath>
  <g clip-path="url(#wc)">${layer(w, h, 'renderM', { op: 0.28 })}${layer(w, h, 'render', { op: 0.55 })}
    <rect y="760" width="${w}" height="90" fill="url(#foot)"/>
    <path d="M482 842 L482 700 L514 700 L514 842z" fill="#2c2b2a"/><path d="M482 700 L514 700 L514 706 L482 706z" fill="#000" opacity=".3"/></g>
  <path d="${top}" stroke="#ffffff" stroke-width="2.4" fill="none" opacity=".8"/>
  <path d="M-20 846 C160 838 420 836 830 842 L830 1000 L-20 1000z" fill="url(#ground)"/>
  <path d="M-20 846 C160 838 420 836 830 842 L830 1000 L-20 1000z" filter="url(#render)" opacity=".8"/>
  <g transform="translate(300 852)"><path d="M-2 0 L-130 20 L-128 23 L2 4z" fill="#3a352e" opacity=".35" filter="url(#b3)"/>
    <g fill="#1d1b19"><circle cx="0" cy="-46" r="4.6"/><path d="M-6 -40 Q0 -42.5 6 -40 L7 -17 L3.6 -17 L3 0 L.8 0 L.2 -15 L-.5 -15 L-1.1 0 L-3.3 0 L-3.9 -17 L-7 -17z"/></g></g>
  ${lz.body}`
  return svg(w, h, defs.join(''), body)
}

/* ---------- 9. Timber School: a larch facade in fog at the forest edge ---------- */
function fog() {
  const [w, h] = P
  const F = face({ x0: 210, yTop: 370, yBot: 790, vx: 1500, vy: 610, x1: 860, W: 34 })
  const S = face({ x0: 210, yTop: 370, yBot: 790, vx: -700, vy: 610, x1: 60, W: 10 })
  const defs = [
    lin('fogB', [[0, '#d6d8d5'], [1, '#c7cac6']]),
    lin('fogF', [[0, '#e1e3e0', 0.0], [0.6, '#e1e3e0', 0.2], [1, '#e1e3e0', 0.55]]),
    lin('fogSide', [[0, '#e1e3e0', 0], [0.6, '#e1e3e0', 0.15], [1, '#e1e3e0', 0.7]], [0, 0, 1, 0]),
    noise('wood', { freq: '0.25 0.004', oct: 3, seed: 3, rgb: [40, 24, 14], slope: 0.9, offset: -0.3 }),
    lin('larch', [[0, '#7a5539'], [1, '#93704f']], [0, 0, 1, 0]),
    lin('glassF', [[0, '#c9cdca'], [0.5, '#7d8684'], [1, '#4c5452']]),
    lin('ground', [[0, '#8f9187'], [1, '#535549']]),
    noise('grassF', { freq: '0.04 0.3', oct: 2, seed: 16, rgb: [30, 34, 26], slope: 1.0, offset: -0.4 }),
    blur('b1', 1), blur('b3', 3), blur('b8', 8),
  ]
  const lz = lens(w, h, { fall: 0.4, grain: 0.07, seed: 27 })
  defs.push(lz.defs)
  const r = rng(9)
  const spruce = (x, base, hh) => {
    const tw = hh * 0.2
    const pts = [[x, base - hh]]
    const tiers = 14
    for (let i = 1; i <= tiers; i++) { const k = i / tiers; const y = base - hh + hh * k * 0.94; const sp = tw * (0.25 + 0.75 * k) * (0.8 + r() * 0.4); pts.push([x + sp, y + hh * 0.02], [x + sp * 0.45, y - hh * 0.012]) }
    const right = pts.slice(1)
    const left = right.map(([px, py]) => [2 * x - px + (r() - 0.5) * tw * 0.12, py]).reverse()
    return [pts[0], ...right, [x + tw * 0.06, base], [x - tw * 0.06, base], ...left]
  }
  const forest = (n, base, hh, c, op, bl, x0 = -40, x1 = w + 40) => { let s = ''; for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0); s += poly(spruce(x, base + r() * 20, hh * (0.75 + r() * 0.5)), `fill="${c}"`) } return `<g opacity="${op}" filter="url(#${bl})">${s}</g>` }
  let slats = ''
  for (let d = 0; d < 34; d += 0.36) slats += poly(F.quad(d, d + 0.24, 0, 1), `fill="${r() > 0.5 ? '#80593d' : '#6d4a32'}"`)
  let sslats = ''
  for (let d = 0; d < 10; d += 0.36) sslats += poly(S.quad(d, d + 0.24, 0, 1), `fill="${r() > 0.5 ? '#5b3e2a' : '#4e3524'}"`)
  const wins = [[2.5, 9.5], [13, 20], [23.5, 30.5]].map(([a, b]) => poly(F.quad(a, b, 0.3, 0.7), 'fill="#2b2f2e"') + poly(F.quad(a + 0.12, b - 0.12, 0.32, 0.68), 'fill="url(#glassF)"') + poly(F.quad(a + 2, a + 2.08, 0.32, 0.68), 'fill="#2b2f2e"') + poly(F.quad(b - 2.08, b - 2, 0.32, 0.68), 'fill="#2b2f2e"')).join('')
  const body = `
  <rect width="${w}" height="${h}" fill="url(#fogB)"/>
  ${forest(30, 600, 260, '#aeb2ad', 0.7, 'b8')}${forest(20, 640, 330, '#8d938c', 0.65, 'b3')}
  <path d="M0 660 L${w} 610 L${w} ${h} L0 ${h}z" fill="url(#ground)"/>
  <path d="M0 660 L${w} 610 L${w} ${h} L0 ${h}z" filter="url(#grassF)" style="mix-blend-mode:multiply"/>
  ${poly(S.quad(0, 10, 0, 1), 'fill="#523826"')}
  <clipPath id="sc">${poly(S.quad(0, 10, 0, 1))}</clipPath><g clip-path="url(#sc)">${sslats}</g>
  ${poly(F.quad(0, 34, 0, 1), 'fill="url(#larch)"')}
  <clipPath id="fc">${poly(F.quad(0, 34, 0, 1))}</clipPath>
  <g clip-path="url(#fc)">${slats}<rect width="${w}" height="${h}" filter="url(#wood)" style="mix-blend-mode:multiply"/>${wins}</g>
  ${poly([S.P(10, 1.035), [210, F.P(0, 1.035)[1]], F.P(34.5, 1.035), F.P(34.5, 1), [210, 370], S.P(10, 1)], 'fill="#3a2d24"')}
  <g filter="url(#b8)" opacity=".35">${poly([F.P(0, 0), F.P(34, 0), [900, 640], [100, 820]], 'fill="#2b2c26"')}</g>
  <rect width="${w}" height="${h}" fill="url(#fogSide)"/>
  <rect width="${w}" height="${h}" fill="url(#fogF)"/>
  ${forest(2, 1040, 560, '#3c433b', 0.95, 'b1', -60, 40)}
  ${lz.body}`
  return svg(w, h, defs.join(''), body)
}

export const pictures = {
  'reixa-house': { size: L, draw: () => reixa() },
  'salt-archive': { size: L, draw: (t) => archive(t), loop: { seconds: 12, width: 1200 } },
  'quarry-chapel': { size: P, draw: () => chapel() },
  'pier-9-terminal': { size: L, draw: () => terminal() },
  'low-walls': { size: L, draw: () => walls() },
  'tidal-pool': { size: L, draw: () => pool() },
  'concrete-hours': { size: L, draw: () => stair() },
  'white-curve': { size: P, draw: () => curve() },
  'timber-school': { size: P, draw: () => fog() },
}
