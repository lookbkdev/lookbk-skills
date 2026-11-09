// About Story Kit: draws the cut-paper portrait stand-ins in examples/hollin/people/
// (flat layered shapes, no faces; made in code so the photo path can be shown
// without anyone's picture). Buyers use their own photos instead.
//
//   node scripts/kit/paper-portraits.mjs examples/hollin/about.json examples/hollin/people
import { writeFileSync, readFileSync } from 'node:fs'
const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const outDir = process.argv[3]
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
function rng(seed) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const pick = (r, a) => a[Math.floor(r() * a.length)]
const GROUNDS = ['#d9c7a8', '#c8d0c4', '#e2cdb8', '#bfc8cf', '#d8c0b0', '#cfc6a6']
const SKIN = ['#e7c3a0', '#c99a72', '#a87452', '#7c5236', '#f0d2b6', '#5e3b26']
const HAIR = ['#2a1d16', '#4a3020', '#7a5232', '#b98b54', '#1c1c1c', '#8f8a84']
const CLOTH = ['#3d4f6b', '#7a3b22', '#55623a', '#2f2f33', '#b0793a', '#6b4a5e', '#2f5557']
const files = []
for (const p of cfg.people.featured) {
  const r = rng(hash(p.name + 'paper'))
  const g = pick(r, GROUNDS), skin = pick(r, SKIN), hair = pick(r, HAIR), cloth = pick(r, CLOTH)
  const tilt = (r() - 0.5) * 6
  const hx = 200 + (r() - 0.5) * 24, hy = 238 + (r() - 0.5) * 14
  const hw = 78 + r() * 12, hh = 100 + r() * 10
  const style = Math.floor(r() * 6)
  const top = hy - hh
  let hairBack = '', hairTop = ''
  // 0 short crop, 1 long, 2 bun, 3 curls, 4 cap, 5 side part
  if (style === 0) hairTop = `<path d="M${hx - hw - 2} ${hy - 10} C ${hx - hw - 4} ${top - 26}, ${hx + hw + 4} ${top - 26}, ${hx + hw + 2} ${hy - 10} C ${hx + hw - 14} ${hy - 58}, ${hx - hw + 14} ${hy - 58}, ${hx - hw - 2} ${hy - 10} Z" fill="${hair}"/>`
  if (style === 1) { hairBack = `<path d="M${hx - hw - 22} ${hy + 170} C ${hx - hw - 46} ${hy - 40}, ${hx - 50} ${top - 40}, ${hx} ${top - 22} C ${hx + 60} ${top - 40}, ${hx + hw + 50} ${hy - 30}, ${hx + hw + 24} ${hy + 170} Z" fill="${hair}"/>`; hairTop = `<path d="M${hx - hw - 4} ${hy - 6} C ${hx - hw} ${top - 26}, ${hx + hw} ${top - 30}, ${hx + hw + 4} ${hy - 20} C ${hx + 30} ${hy - 72}, ${hx - 40} ${hy - 50}, ${hx - hw - 4} ${hy - 6} Z" fill="${hair}"/>` }
  if (style === 2) { hairBack = `<circle cx="${hx + (r() - 0.5) * 40}" cy="${top - 16}" r="${32 + r() * 8}" fill="${hair}"/>`; hairTop = `<path d="M${hx - hw} ${hy - 16} C ${hx - hw} ${top - 20}, ${hx + hw} ${top - 20}, ${hx + hw} ${hy - 16} C ${hx + 34} ${hy - 56}, ${hx - 34} ${hy - 56}, ${hx - hw} ${hy - 16} Z" fill="${hair}"/>` }
  if (style === 3) { let c = ''; for (let k = 0; k < 15; k++) { const a = Math.PI * (0.98 + k / 14 * 1.04); c += `<circle cx="${(hx + Math.cos(a) * (hw + 4)).toFixed(1)}" cy="${(hy - 18 + Math.sin(a) * (hh + 2)).toFixed(1)}" r="${24 + r() * 8}" fill="${hair}"/>` } hairBack = c }
  if (style === 4) hairTop = `<path d="M${hx - hw - 8} ${hy - 22} C ${hx - hw - 6} ${top - 34}, ${hx + hw + 6} ${top - 34}, ${hx + hw + 8} ${hy - 22} Z" fill="${cloth}"/><path d="M${hx - hw - 10} ${hy - 30} L ${hx + hw + 56} ${hy - 30} L ${hx + hw + 52} ${hy - 16} L ${hx - hw - 10} ${hy - 16} Z" fill="${cloth}"/>`
  if (style === 5) hairTop = `<path d="M${hx - hw - 4} ${hy + 10} C ${hx - hw - 10} ${top - 40}, ${hx + hw + 20} ${top - 34}, ${hx + hw + 6} ${hy + 6} L ${hx + hw - 6} ${hy - 40} C ${hx + 10} ${hy - 80}, ${hx - 50} ${hy - 50}, ${hx - hw - 4} ${hy + 10} Z" fill="${hair}"/>`
  const sh = hy + hh + 22 + r() * 10, sw = 170 + r() * 30
  const collar = pick(r, ['v', 'round', 'shirt'])
  const coll = collar === 'v' ? `<path d="M${hx - 40} ${sh - 8} L ${hx} ${sh + 64} L ${hx + 40} ${sh - 8} Z" fill="${skin}"/>` : collar === 'shirt' ? `<path d="M${hx - 46} ${sh - 12} L ${hx - 6} ${sh + 44} L ${hx - 30} ${sh + 58} Z M${hx + 46} ${sh - 12} L ${hx + 6} ${sh + 44} L ${hx + 30} ${sh + 58} Z" fill="#efe8dc"/>` : `<ellipse cx="${hx}" cy="${sh - 6}" rx="46" ry="20" fill="${skin}"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="800" height="1000">
<!-- A cut-paper stand-in made in code for the About Story Kit demo. Not a photo of anyone. -->
<defs>
<filter id="lift" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#2a1d10" flood-opacity=".32"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${hash(p.name) % 97}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .09 0"/></filter>
</defs>
<rect width="400" height="500" fill="${g}"/>
${pick(r, [`<circle cx="${80 + r() * 240}" cy="${60 + r() * 60}" r="${60 + r() * 40}" fill="#fff" opacity=".2"/>`, `<path d="M0 ${120 + r() * 80} L400 ${60 + r() * 80} L400 0 L0 0 Z" fill="#fff" opacity=".14"/>`, `<rect x="${30 + r() * 200}" y="0" width="${60 + r() * 60}" height="500" fill="#000" opacity=".05"/>`])}
<g transform="rotate(${tilt.toFixed(1)} 200 400)">
<g filter="url(#lift)">${hairBack}</g>
<g filter="url(#lift)"><path d="M${hx - sw} 520 C ${hx - sw} ${sh + 30}, ${hx - sw + 40} ${sh - 10}, ${hx - 46} ${sh - 14} L ${hx + 46} ${sh - 14} C ${hx + sw - 40} ${sh - 10}, ${hx + sw} ${sh + 30}, ${hx + sw} 520 Z" fill="${cloth}"/></g>
<g filter="url(#lift)"><rect x="${hx - 30}" y="${hy + 50}" width="60" height="${sh - hy - 44}" rx="12" fill="${skin}"/>${coll}</g>
<g filter="url(#lift)"><ellipse cx="${hx}" cy="${hy}" rx="${hw}" ry="${hh}" fill="${skin}"/></g>
<g filter="url(#lift)">${hairTop}</g>
</g>
<rect width="400" height="500" filter="url(#grain)"/>
</svg>
`
  const file = p.name.toLowerCase().normalize('NFD').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') + '.svg'
  writeFileSync(`${outDir}/${file}`, svg)
  files.push([p.name, file])
}
console.log(JSON.stringify(files))
