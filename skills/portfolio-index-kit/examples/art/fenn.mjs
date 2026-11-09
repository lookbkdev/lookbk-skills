// Example 1 (Fenn Type Office, type foundry and graphic design): ten pieces
// of work drawn in SVG: type specimens, posters, a record sleeve, a station
// sign on its wall, book covers and a catalogue spread on a table. Flat work
// is printed on paper (fibre, ink grain, a hair of misregistration); objects
// sit in light with soft shadows.
import { blur, lens, lin, noise, rad, relief, rng, svg } from './lib.mjs'

const L = [1200, 800]
const P = [800, 1000]
const BRIC = "font-family=\"Bricolage Grotesque\""
const MONO = "font-family=\"DM Mono\""
const SERIF = "font-family=\"Instrument Serif\""
const cond = (w) => `style="font-variation-settings:'wdth' ${w}"`

/** paper: fibre, a little mottling, ink grain over the top */
function paper(w, h, seed = 1, k = 1) {
  const defs = noise('fibre', { freq: '0.9 0.5', oct: 2, seed, rgb: [90, 80, 60], slope: 0.35 * k, offset: -0.12 * k }) +
    noise('mott', { freq: '0.012', oct: 4, seed: seed + 2, rgb: [120, 100, 70], slope: 0.1 * k, offset: -0.04 * k }) +
    noise('inkg', { freq: '1.2', oct: 1, seed: seed + 4, rgb: [255, 255, 255], slope: 0.5 * k, offset: -0.3 * k })
  const body = `<rect width="${w}" height="${h}" filter="url(#mott)"/><rect width="${w}" height="${h}" filter="url(#fibre)"/><rect width="${w}" height="${h}" filter="url(#inkg)"/>`
  return { defs, body }
}

function gannet() {
  const [w, h] = P
  const p = paper(w, h, 3)
  const lines = [['200', 42, 800], ['400', 42, 850], ['600', 42, 900], ['800', 42, 950]]
  return svg(w, h, p.defs, `<rect width="${w}" height="${h}" fill="#ece5d4"/>
    <text x="26" y="520" ${BRIC} font-weight="800" font-size="560" letter-spacing="-34" ${cond(75)} fill="#16140f">Gg</text>
    <line x1="44" x2="756" y1="700" y2="700" stroke="#16140f" stroke-width="1.5"/>
    <text x="44" y="734" ${MONO} font-size="18" fill="#16140f" letter-spacing="2">GANNET SANS · NINE WEIGHTS · 2026</text>
    <text x="756" y="734" text-anchor="end" ${MONO} font-size="18" fill="#16140f" letter-spacing="2">FENN TYPE OFFICE</text>
    ${lines.map(([wt, s, y]) => `<text x="44" y="${y}" ${BRIC} font-weight="${wt}" font-size="${s}" fill="#16140f" ${cond(75)}>Hamburgefonstiv 0123</text><text x="756" y="${y}" text-anchor="end" ${MONO} font-size="16" fill="#16140f">${wt}</text>`).join('')}
    <circle cx="726" cy="74" r="20" fill="#c63b1c"/>
    <text x="44" y="70" ${MONO} font-size="18" fill="#16140f" letter-spacing="2">SPECIMEN 01</text>${p.body}`)
}

function season() {
  const [w, h] = P
  const p = paper(w, h, 5)
  return svg(w, h, p.defs, `<rect width="${w}" height="${h}" fill="#eee6d3"/>
    <g style="mix-blend-mode:multiply"><text x="-30" y="520" ${BRIC} font-weight="800" font-size="600" letter-spacing="-44" ${cond(75)} fill="#e2483c">25</text>
    <text x="318" y="958" ${BRIC} font-weight="800" font-size="600" letter-spacing="-44" ${cond(75)} fill="#2c52c4">26</text>
    <text x="321" y="955" ${BRIC} font-weight="800" font-size="600" letter-spacing="-44" ${cond(75)} fill="#2c52c4" opacity=".18">26</text></g>
    <text x="44" y="68" ${MONO} font-size="20" letter-spacing="2" fill="#16140f">HAVERLAND PHILHARMONIC</text>
    <text x="756" y="68" text-anchor="end" ${MONO} font-size="20" letter-spacing="2" fill="#16140f">SEASON</text>
    <text x="44" y="590" ${BRIC} font-size="30" font-weight="600" fill="#16140f">38 concerts</text><text x="44" y="626" ${BRIC} font-size="30" fill="#16140f">September to June</text>
    <text x="44" y="662" ${BRIC} font-size="30" fill="#16140f">Haverland Hall</text>${p.body}`)
}

function rail() {
  const [w, h] = L
  const r = rng(3)
  let tiles = ''
  for (let y = -10; y < h; y += 60) for (let x = -20; x < w; x += 120) { const g = 214 + Math.floor(r() * 14); tiles += `<rect x="${x + 2}" y="${y + 2}" width="116" height="56" fill="rgb(${g},${g - 2},${g - 6})"/>` }
  const defs = lin('light', [[0, '#fff', 0.35], [0.5, '#fff', 0], [1, '#000', 0.25]], [0, 0, 1, 1]) + blur('b10', 10) + blur('b2', 2) +
    noise('tileN', { freq: '0.02', oct: 3, seed: 9, rgb: [80, 70, 60], slope: 0.15, offset: -0.05 }) + lin('plate', [[0, '#17473a'], [1, '#0f3529']]) + lens(w, h, { fall: 0.4, grain: 0.05 }).defs
  return svg(w, h, defs, `<rect width="${w}" height="${h}" fill="#7c7a74"/>${tiles}<rect width="${w}" height="${h}" filter="url(#tileN)" style="mix-blend-mode:multiply"/>
    <rect x="190" y="270" width="820" height="300" rx="10" fill="#000" opacity=".4" filter="url(#b10)" transform="translate(10 16)"/>
    <rect x="180" y="250" width="840" height="300" rx="10" fill="url(#plate)"/>
    <rect x="180" y="250" width="840" height="5" rx="2" fill="#4d7a6b" opacity=".7"/>
    <path d="M250 368h110M318 324l46 44-46 44" stroke="#f4f1e8" stroke-width="20" fill="none"/>
    <text x="420" y="404" ${BRIC} font-weight="650" font-size="112" fill="#f4f1e8" ${cond(85)}>Perron 4</text>
    <text x="424" y="482" ${BRIC} font-size="44" fill="#a9cbb7">Platform 4 · Kestrel Rail</text>
    <rect x="884" y="300" width="88" height="88" rx="8" fill="#f4f1e8"/><rect x="902" y="318" width="52" height="38" rx="7" fill="#123a2b"/><circle cx="913" cy="370" r="5" fill="#123a2b"/><circle cx="943" cy="370" r="5" fill="#123a2b"/>
    <rect x="590" y="550" width="20" height="250" fill="#5a5852"/><rect x="590" y="550" width="6" height="250" fill="#8a8780"/>
    <rect width="${w}" height="${h}" fill="url(#light)"/>${lens(w, h, { fall: 0.4, grain: 0.05 }).body}`)
}

function covers() {
  const [w, h] = L
  const cv = (x, y, r, c, a, t, s) => {
    const rr = rng(s)
    let bars = ''
    for (let i = 0; i < 5; i++) bars += `<rect x="-118" y="${-140 + i * 40}" width="${70 + Math.floor(rr() * 150)}" height="20" fill="${a}"/>`
    return `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-150" y="-215" width="300" height="430" fill="#000" opacity=".35" filter="url(#b12)" transform="translate(10 14)"/>
      <rect x="-150" y="-215" width="300" height="430" fill="${c}"/><rect x="-150" y="-215" width="8" height="430" fill="#000" opacity=".12"/>${bars}
      <text x="-118" y="168" ${BRIC} font-weight="650" font-size="30" fill="${a}" ${cond(85)}>${t}</text><text x="-118" y="196" ${MONO} font-size="14" fill="${a}">MURO PRESS</text>
      <rect x="-150" y="-215" width="300" height="430" filter="url(#fibre)"/></g>`
  }
  const p = paper(w, h, 7)
  const defs = p.defs + blur('b12', 12) + lin('table', [[0, '#cfc6b4'], [1, '#b3a994']], [0, 0, 1, 1]) + rad('pool', [[0, '#fff', 0.25], [1, '#fff', 0]], 0.45, 0.4, 0.6) + lens(w, h, { fall: 0.45, grain: 0.05 }).defs + relief('wood', { freq: '0.004 0.08', oct: 3, seed: 2, scale: 1.2, az: 90, el: 60, color: '#efe6d4' })
  return svg(w, h, defs, `<rect width="${w}" height="${h}" fill="url(#table)"/><rect width="${w}" height="${h}" filter="url(#wood)" style="mix-blend-mode:multiply" opacity=".35"/>
    ${cv(330, 420, -8, '#2e4a3d', '#e9e1cc', 'Field Notes 4', 1)}${cv(600, 410, 1.5, '#ece4cf', '#16140f', 'Field Notes 5', 2)}${cv(870, 420, 9, '#c94a2a', '#f6ecd5', 'Field Notes 6', 3)}
    <rect width="${w}" height="${h}" fill="url(#pool)"/>${lens(w, h, { fall: 0.45, grain: 0.05 }).body}`)
}

function amp() {
  const [w, h] = P
  const p = paper(w, h, 9)
  return svg(w, h, p.defs, `<rect width="${w}" height="${h}" fill="#f6f2e9"/>
    ${[260, 420, 580, 740].map((y) => `<line x1="0" x2="${w}" y1="${y}" y2="${y}" stroke="#c63b1c" stroke-width="1.2" opacity=".55"/>`).join('')}
    <text x="400" y="800" text-anchor="middle" ${SERIF} font-style="italic" font-size="880" fill="#16140f">&amp;</text>
    <text x="44" y="68" ${MONO} font-size="20" letter-spacing="2" fill="#16140f">OSTRAVA SERIF ITALIC</text>
    <text x="756" y="68" text-anchor="end" ${MONO} font-size="20" letter-spacing="2" fill="#16140f">8 / 9.5</text>
    <text x="44" y="930" ${SERIF} font-size="44" fill="#16140f">Drawn for 8 point on newsprint</text>${p.body}`)
}

function weights() {
  const [w, h] = P
  const p = paper(w, h, 11, 0.8)
  return svg(w, h, p.defs, `<rect width="${w}" height="${h}" fill="#ef6a2c"/>
    ${[200, 350, 500, 650, 800].map((wt, i) => `<text x="40" y="${250 + i * 160}" ${BRIC} font-weight="${wt}" font-size="200" letter-spacing="-8" fill="#16140f" ${cond(75)}>Orrin</text><text x="756" y="${232 + i * 160}" text-anchor="end" ${MONO} font-size="18" fill="#16140f">WEEK ${18 + i}</text>`).join('')}
    <text x="44" y="64" ${MONO} font-size="20" letter-spacing="2" fill="#16140f">ORRIN BIENNALE 2024</text>${p.body}`)
}

function sleeve() {
  const [w, h] = P
  let d = ''
  for (let y = 0; y < 52; y++) for (let x = 0; x < 52; x++) {
    const cx = x * 16 + 8, cy = y * 16 + 8, dd = Math.hypot(cx - 420, cy - 400)
    const r = Math.max(0, 6.8 - Math.abs(Math.sin(dd / 44)) * 6.8)
    if (r > 0.5 && cy < 840) d += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}"/>`
  }
  const p = paper(w, h, 13, 0.6)
  return svg(w, h, p.defs, `<rect width="${w}" height="${h}" fill="#1a1918"/><g fill="#efe5cf">${d}</g><rect y="842" width="${w}" height="158" fill="#1a1918"/>
    <text x="44" y="910" ${BRIC} font-weight="700" font-size="54" fill="#efe5cf" ${cond(75)}>SALTMARSH</text><text x="44" y="952" ${MONO} font-size="20" fill="#efe5cf">TIDE TABLES · LP · SIDES A AND B</text>${p.body}`)
}

function outline() {
  const [w, h] = P
  const p = paper(w, h, 15, 0.6)
  return svg(w, h, p.defs, `<rect width="${w}" height="${h}" fill="#141311"/>
    <text x="36" y="380" ${BRIC} font-weight="800" font-size="340" letter-spacing="-16" ${cond(75)} fill="none" stroke="#efe5cf" stroke-width="2.2">Lum</text>
    <text x="36" y="700" ${BRIC} font-weight="800" font-size="340" letter-spacing="-16" ${cond(75)} fill="#efe5cf">Hall</text>
    <text x="44" y="920" ${MONO} font-size="20" fill="#efe5cf" letter-spacing="2">LUMEN HALL · DISPLAY · SPECIMEN 02</text>
    <circle cx="704" cy="880" r="36" fill="#c63b1c"/>${p.body}`)
}

function tiles() {
  const [w, h] = P
  const ic = ['M-20 12h40M0-20v40', 'M-20-20l40 40M20-20l-40 40', 'M-24 16l24-36 24 36z', 'M0 0m-22 0a22 22 0 1 0 44 0a22 22 0 1 0-44 0', 'M-22 -10h44v20h-44z', 'M-20 20 L0 -22 L20 20']
  let t = ''
  for (let i = 0; i < 12; i++) {
    const x = 80 + (i % 4) * 168, y = 140 + Math.floor(i / 4) * 220
    t += `<rect x="${x}" y="${y}" width="144" height="192" fill="${i === 5 ? '#c63b1c' : '#22403a'}"/><path transform="translate(${x + 72} ${y + 80})" d="${ic[i % 6]}" stroke="#f1ebdd" stroke-width="9" fill="${i % 6 === 2 ? '#f1ebdd' : 'none'}"/><text x="${x + 14}" y="${y + 174}" ${MONO} font-size="18" fill="#f1ebdd">${String(i + 1).padStart(2, '0')}</text>`
  }
  const p = paper(w, h, 17)
  return svg(w, h, p.defs, `<rect width="${w}" height="${h}" fill="#e8e1d1"/>${t}<text x="80" y="92" ${MONO} font-size="20" letter-spacing="2" fill="#16140f">KETTLE HILL LIBRARY · PICTOGRAMS</text>
    <text x="80" y="900" ${BRIC} font-size="27" fill="#16140f">Twelve signs, first drawn by readers aged 6 to 11.</text>${p.body}`)
}

function spread() {
  const [w, h] = L
  const p = paper(w, h, 19)
  const defs = p.defs + blur('b14', 14) + lin('pageL', [[0, '#f3eee2'], [0.85, '#efe9dc'], [1, '#c9c2b2']], [0, 0, 1, 0]) + lin('pageR', [[0, '#cfc8b8'], [0.12, '#f7f3ea'], [1, '#f4efe4']], [0, 0, 1, 0]) +
    lin('table', [[0, '#bdb3a0'], [1, '#9f9582']], [0, 0, 1, 1]) + lens(w, h, { fall: 0.45, grain: 0.05 }).defs
  let lines = ''
  for (let i = 0; i < 16; i++) lines += `<rect x="660" y="${236 + i * 22}" width="${300 - (i % 4) * 30}" height="6" fill="#16140f" opacity=".72"/>`
  return svg(w, h, defs, `<rect width="${w}" height="${h}" fill="url(#table)"/>
    <path d="M150 150 L1050 150 L1060 680 L140 680z" fill="#000" opacity=".35" filter="url(#b14)" transform="translate(8 16)"/>
    <path d="M150 140 Q380 130 600 152 L600 676 Q380 660 140 672z" fill="url(#pageL)"/>
    <path d="M600 152 Q820 130 1050 140 L1060 672 Q820 660 600 676z" fill="url(#pageR)"/>
    <text x="200" y="300" ${SERIF} font-size="120" fill="#16140f">Paper</text><text x="200" y="410" ${SERIF} font-style="italic" font-size="120" fill="#c63b1c">Weight</text>
    <text x="204" y="600" ${MONO} font-size="16" fill="#16140f" letter-spacing="2">CATALOGUE · 240 PAGES · MURO PRESS</text>
    ${lines}<rect x="660" y="600" width="140" height="40" fill="#c63b1c"/>${p.body}${lens(w, h, { fall: 0.45, grain: 0.05 }).body}`)
}

export const pictures = {
  'gannet-sans': { size: P, draw: gannet },
  'haverland-season': { size: P, draw: season },
  'kestrel-rail': { size: L, draw: rail },
  'field-notes': { size: L, draw: covers },
  'ostrava-serif': { size: P, draw: amp },
  'orrin-biennale': { size: P, draw: weights },
  'tide-tables': { size: P, draw: sleeve },
  'lumen-hall': { size: P, draw: outline },
  'kettle-hill': { size: P, draw: tiles },
  'paper-weight': { size: L, draw: spread },
}
