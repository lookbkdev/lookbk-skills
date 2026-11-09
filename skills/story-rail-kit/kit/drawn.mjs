// Story Rail: the drawn set. Scenes drawn in code (SVG with a grain filter)
// for a brand that has no photographs yet, and for both examples. Each
// function returns one <svg> string. `wide` scenes are drawn on a 1450x1000
// board and `tall` scenes on 750x1000; both are cropped to the card with
// preserveAspectRatio="xMidYMid slice", so keep the subject in the middle.
//
// Two scenes move: `library` (the fin shadows track the sun) and `broth`
// (the oil drifts round the bowl). They mark the moving part with
// data-sr-loop, and kit/runtime.js drives it from the page clock, so the
// recorder can step it frame by frame.

function rng(s) {
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const f1 = (n) => n.toFixed(1)
const grain = (id, o = 0.1) =>
  `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${o} 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`
const svg = (w, body, extra = '') => `<svg viewBox="0 0 ${w} 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"${extra}>${body}</svg>`

/* ---------- architecture ---------- */

// A long, low timber house set below a concrete sea wall, with the marsh and
// a strip of standing water in front of it.
function saltmarsh() {
  const r = rng(7)
  let grass = ''
  for (let i = 0; i < 620; i++) {
    const x = r() * 1450, y = 690 + r() * 310, h = 8 + r() * 30 * (y / 1000)
    if (y > 770 && y < 812) continue
    grass += `<line x1="${f1(x)}" y1="${f1(y)}" x2="${f1(x + (r() - 0.5) * 7)}" y2="${f1(y - h)}"/>`
  }
  let bat = ''
  for (let x = 300; x < 1150; x += 13) bat += `<rect x="${x}" y="452" width="7" height="160" fill="${x % 39 < 13 ? '#9c7149' : '#b4875a'}"/>`
  let clouds = ''
  for (let i = 0; i < 7; i++) clouds += `<ellipse cx="${f1(r() * 1450)}" cy="${f1(90 + r() * 260)}" rx="${f1(160 + r() * 260)}" ry="${f1(10 + r() * 18)}" fill="#fbf8f1" opacity="${(0.35 + r() * 0.35).toFixed(2)}"/>`
  let joints = ''
  for (let x = 0; x < 1450; x += 120) joints += `<line x1="${x}" y1="474" x2="${x}" y2="548"/>`
  const house = `<g transform="translate(725 640) scale(1.16) translate(-725 -612)">
    <rect x="262" y="432" width="926" height="20" fill="#24272a"/>
    <rect x="270" y="452" width="910" height="160" fill="#7f5d3e"/>${bat}
    <rect x="610" y="452" width="330" height="160" fill="url(#sm-gl)"/>
    <rect x="610" y="452" width="330" height="26" fill="#000" opacity=".3"/>
    <g fill="#d9d3c4"><rect x="692" y="452" width="3" height="160"/><rect x="774" y="452" width="3" height="160"/><rect x="856" y="452" width="3" height="160"/></g>
    <rect x="270" y="452" width="910" height="16" fill="#000" opacity=".2"/>
    <path d="M262 612 L1188 612 L1250 642 L310 642 Z" fill="#3f4630" opacity=".55"/>
    <rect x="1188" y="566" width="80" height="46" fill="#d6cfbf"/><rect x="1188" y="566" width="80" height="6" fill="#b4ab99"/></g>`
  return svg(1450, `<defs>
  <linearGradient id="sm-sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb2bd"/><stop offset=".55" stop-color="#d8dcd7"/><stop offset="1" stop-color="#efe7d4"/></linearGradient>
  <linearGradient id="sm-gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c9f76"/><stop offset="1" stop-color="#5f6745"/></linearGradient>
  <linearGradient id="sm-wl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d4c8"/><stop offset="1" stop-color="#b7b0a2"/></linearGradient>
  <linearGradient id="sm-gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262d31"/><stop offset=".38" stop-color="#4f5b5e"/><stop offset=".44" stop-color="#b5c1c3"/><stop offset=".5" stop-color="#6d797b"/><stop offset="1" stop-color="#30383b"/></linearGradient>
  <linearGradient id="sm-wa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3cfd2"/><stop offset="1" stop-color="#8fa1a6"/></linearGradient>
  <filter id="sm-bl"><feGaussianBlur stdDeviation="10"/></filter>${grain('sm-g', 0.16)}</defs>
  <rect width="1450" height="1000" fill="url(#sm-sk)"/>
  <g filter="url(#sm-bl)">${clouds}</g>
  <rect y="468" width="1450" height="84" fill="url(#sm-wl)"/>
  <rect y="462" width="1450" height="10" fill="#8e877a"/><rect y="462" width="1450" height="3" fill="#ece6d8"/>
  <g stroke="#9e9788" stroke-width="2" opacity=".6">${joints}</g>
  <path d="M0 552 L1450 552 L1450 600 C 1000 590 400 596 0 604 Z" fill="#a3a07a"/>
  <rect y="600" width="1450" height="400" fill="url(#sm-gr)"/>
  ${house}
  <rect y="772" width="1450" height="40" fill="url(#sm-wa)"/><rect y="772" width="1450" height="3" fill="#e8ecea" opacity=".8"/>
  <rect x="420" y="782" width="610" height="10" fill="#6d5a45" opacity=".35"/>
  <g stroke="#4f5638" stroke-width="1.6" opacity=".6">${grass}</g>
  <rect width="1450" height="1000" filter="url(#sm-g)"/>`)
}

// A board-marked concrete stair tower in raking light from a rooflight.
function stair() {
  let lines = ''
  for (let y = 0; y < 1000; y += 46) lines += `<line x1="0" x2="750" y1="${y}" y2="${y}"/>`
  let ties = ''
  for (let y = 23; y < 1000; y += 92) for (let x = 60; x < 750; x += 150) ties += `<circle cx="${x}" cy="${y}" r="4"/>`
  const flight = (x0, y0, dir, n) => {
    let p = `M${x0} ${y0}`, x = x0, y = y0, rail = `M${x0} ${y0 - 70}`
    for (let i = 0; i < n; i++) { y -= 26; p += ` L${x} ${y}`; x += dir * 34; p += ` L${x} ${y}` }
    rail += ` L${x} ${y - 70}`
    return { p, x, y, rail }
  }
  const a = flight(70, 990, 1, 11), b = flight(a.x, a.y - 52, -1, 11), c = flight(b.x, b.y - 52, 1, 11)
  const slab = (f, x0, y0) => {
    const body = `${f.p} L${f.x} ${f.y + 52} L${x0} ${y0 + 52} Z`
    return `<path d="${body}" transform="translate(30 40)" fill="#2d2924" opacity=".42" filter="url(#st-sb)"/>
    <path d="${body}" fill="url(#st-sl)"/>
    <path d="M${x0} ${y0 + 52} L${f.x} ${f.y + 52}" stroke="#5d564b" stroke-width="12" opacity=".7"/>
    <path d="${f.p}" fill="none" stroke="#fffaf0" stroke-width="3"/>
    <path d="${f.rail}" stroke="#2a2724" stroke-width="5" fill="none"/>
    <path d="${f.rail}" stroke="#d9d2c4" stroke-width="1.5" fill="none" transform="translate(0 -2)"/>`
  }
  return svg(750, `<defs>
  <linearGradient id="st-wl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a99f8e"/><stop offset="1" stop-color="#776f62"/></linearGradient>
  <linearGradient id="st-sl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#efe8da"/><stop offset="1" stop-color="#d2c9b8"/></linearGradient>
  <linearGradient id="st-ls" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6e2" stop-opacity=".95"/><stop offset=".7" stop-color="#fff6e2" stop-opacity=".15"/><stop offset="1" stop-color="#fff6e2" stop-opacity="0"/></linearGradient>
  <filter id="st-sb"><feGaussianBlur stdDeviation="6"/></filter>${grain('st-g', 0.2)}</defs>
  <rect width="750" height="1000" fill="url(#st-wl)"/>
  <g stroke="#5f584c" stroke-width="1" opacity=".4">${lines}</g><g fill="#4d473e" opacity=".55">${ties}</g>
  <polygon points="750,0 500,0 40,1000 750,1000" fill="url(#st-ls)" opacity=".5"/>
  ${slab(a, 70, 990)}${slab(b, a.x, a.y - 52)}${slab(c, b.x, b.y - 52)}
  <rect x="0" y="0" width="52" height="1000" fill="#4f493f" opacity=".55"/>
  <rect x="0" y="0" width="750" height="34" fill="#f6f0e2" opacity=".9"/><rect x="0" y="34" width="750" height="6" fill="#3a352e" opacity=".5"/>
  <rect width="750" height="1000" filter="url(#st-g)"/>`)
}

// A terracotta facade of deep fins; the shadows move like a sun study.
export function libraryShadow(x, off) {
  return `${x + 26},250 ${f1(x + 26 + off)},${f1(250 + off * 0.55)} ${f1(x + 26 + off)},810 ${x + 26},810`
}
function library() {
  const off = 130
  let fins = '', shad = '', win = ''
  for (let x = 60; x < 1450; x += 78) {
    fins += `<rect x="${x}" y="250" width="26" height="560" fill="#c58866"/><rect x="${x}" y="250" width="6" height="560" fill="#e3b493"/>`
    shad += `<polygon data-x="${x}" points="${libraryShadow(x, off)}"/>`
    for (const y of [300, 470, 640]) win += `<rect x="${x + 30}" y="${y}" width="44" height="120" fill="#27333a"/><rect x="${x + 30}" y="${y}" width="44" height="36" fill="#86a0a9" opacity=".55"/>`
  }
  return svg(1450, `<defs>
  <linearGradient id="lb-sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c8d0"/><stop offset="1" stop-color="#ece6da"/></linearGradient>${grain('lb-g', 0.14)}</defs>
  <rect width="1450" height="1000" fill="url(#lb-sk)"/>
  <rect x="0" y="230" width="1450" height="600" fill="#e6d5c1"/>${win}
  <g data-sr-loop="library" fill="#53362a" opacity=".36">${shad}</g>${fins}
  <rect x="0" y="222" width="1450" height="28" fill="#a26b55"/><rect x="0" y="810" width="1450" height="18" fill="#a26b55"/>
  <rect x="0" y="828" width="1450" height="172" fill="#cdc6b6"/><rect x="0" y="828" width="1450" height="40" fill="#000" opacity=".12"/>
  <rect width="1450" height="1000" filter="url(#lb-g)"/>`)
}

// A courtyard plan: paving, six trees that were there first, and the poche.
function orchard() {
  const r = rng(11)
  let paving = ''
  for (let x = 150; x < 600; x += 30) paving += `<line x1="${x}" y1="150" x2="${x}" y2="850"/>`
  for (let y = 150; y < 850; y += 30) paving += `<line x1="150" y1="${y}" x2="600" y2="${y}"/>`
  let trees = ''
  for (const [x, y] of [[250, 280], [470, 300], [360, 470], [240, 640], [490, 660], [370, 790]]) {
    const rr = 56 + r() * 22
    trees += `<circle cx="${x + 22}" cy="${y + 26}" r="${f1(rr)}" fill="#4a5538" opacity=".38"/><circle cx="${x}" cy="${y}" r="${f1(rr)}" fill="#86966a"/><circle cx="${f1(x - rr * 0.25)}" cy="${f1(y - rr * 0.25)}" r="${f1(rr * 0.62)}" fill="#a1af80" opacity=".8"/><circle cx="${x}" cy="${y}" r="4" fill="#3c4430"/>`
  }
  let hatch = ''
  for (let i = -1000; i < 1000; i += 16) hatch += `<line x1="${i}" y1="0" x2="${i + 1000}" y2="1000"/>`
  return svg(750, `<defs><clipPath id="oc-po"><path fill-rule="evenodd" d="M40 40 H710 V960 H40 Z M150 150 H600 V850 H150 Z"/></clipPath>${grain('oc-g', 0.15)}</defs>
  <rect width="750" height="1000" fill="#ebe7dc"/>
  <g clip-path="url(#oc-po)"><rect width="750" height="1000" fill="#d6d0c2"/><g stroke="#8a8272" stroke-width="1.5">${hatch}</g></g>
  <rect x="150" y="150" width="450" height="700" fill="#e2dccd"/><g stroke="#c8c0af" stroke-width="1">${paving}</g>
  <rect x="150" y="150" width="450" height="700" fill="none" stroke="#2a2b27" stroke-width="5"/><rect x="40" y="40" width="670" height="920" fill="none" stroke="#2a2b27" stroke-width="5"/>
  <rect x="330" y="845" width="90" height="10" fill="#e2dccd"/><rect x="330" y="955" width="90" height="10" fill="#ebe7dc"/>
  ${trees}
  <rect width="750" height="1000" filter="url(#oc-g)"/>`)
}

/* ---------- food ---------- */

// A clear broth from above, with oil on it and two charred limes beside it.
function broth() {
  const r = rng(3)
  let oil = ''
  for (let i = 0; i < 46; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 250, x = 725 + Math.cos(a) * d, y = 500 + Math.sin(a) * d, s = 3 + r() * r() * 22
    oil += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(s)}" fill="#f2b453" opacity=".5"/><circle cx="${f1(x - s * 0.3)}" cy="${f1(y - s * 0.3)}" r="${f1(s * 0.35)}" fill="#fff1c9" opacity=".55"/>`
  }
  let scal = ''
  for (let i = 0; i < 14; i++) {
    const a = r() * 6.283, d = 40 + r() * 200
    scal += `<circle cx="${f1(725 + Math.cos(a) * d)}" cy="${f1(500 + Math.sin(a) * d)}" r="${f1(9 + r() * 6)}" fill="none" stroke="#7fa64a" stroke-width="5"/>`
  }
  let fl = ''
  for (let i = 0; i < 70; i++) {
    const x = 150 + r() * 1150, y = 60 + r() * 880
    if (Math.hypot(x - 725, y - 500) < 360) continue
    fl += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${f1(3 + r() * 5)}" height="${f1(2 + r() * 3)}" fill="#b8321c" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" opacity=".9"/>`
  }
  const lime = (cx, cy, R, rot) => {
    let seg = ''
    const p = (a, d) => `${f1(cx + Math.cos(a) * d)} ${f1(cy + Math.sin(a) * d)}`
    for (let k = 0; k < 9; k++) {
      const a0 = (k / 9) * 6.283 + rot, a1 = ((k + 1) / 9) * 6.283 + rot - 0.09
      seg += `<path d="M${p((a0 + a1) / 2, R * 0.12)} L${p(a0 + 0.03, R * 0.8)} A${f1(R * 0.8)} ${f1(R * 0.8)} 0 0 1 ${p(a1, R * 0.8)} Z" fill="#c7d98a"/>`
    }
    return `<circle cx="${cx + 14}" cy="${cy + 18}" r="${R}" fill="#000" opacity=".45"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#1d2410"/><circle cx="${cx}" cy="${cy}" r="${f1(R * 0.92)}" fill="#e9efc4"/>${seg}<circle cx="${cx}" cy="${cy}" r="${f1(R * 0.92)}" fill="url(#bt-ch)"/>`
  }
  return svg(1450, `<defs>
  <radialGradient id="bt-tb" cx=".5" cy=".45" r=".8"><stop offset="0" stop-color="#2d251e"/><stop offset="1" stop-color="#0f0c09"/></radialGradient>
  <radialGradient id="bt-bw" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#5a5047"/><stop offset=".8" stop-color="#2a241e"/><stop offset="1" stop-color="#171310"/></radialGradient>
  <radialGradient id="bt-br" cx=".45" cy=".42" r=".62"><stop offset="0" stop-color="#dda04a"/><stop offset=".7" stop-color="#a5601f"/><stop offset="1" stop-color="#6a3711"/></radialGradient>
  <radialGradient id="bt-ch" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset=".86" stop-color="#1a1408" stop-opacity=".55"/><stop offset="1" stop-color="#0b0904" stop-opacity=".95"/></radialGradient>
  <clipPath id="bt-bc"><circle cx="725" cy="500" r="268"/></clipPath>${grain('bt-g', 0.18)}</defs>
  <rect width="1450" height="1000" fill="url(#bt-tb)"/>
  <circle cx="752" cy="534" r="350" fill="#000" opacity=".45"/>
  <circle cx="725" cy="500" r="340" fill="url(#bt-bw)"/><circle cx="725" cy="500" r="340" fill="none" stroke="#7a6f63" stroke-width="2" opacity=".6"/>
  <circle cx="725" cy="500" r="272" fill="#1b1612"/>
  <g clip-path="url(#bt-bc)"><circle cx="725" cy="500" r="268" fill="url(#bt-br)"/><g data-sr-loop="broth">${oil}</g>${scal}
   <ellipse cx="640" cy="390" rx="120" ry="44" fill="#fff4d6" opacity=".14" transform="rotate(-28 640 390)"/></g>
  ${lime(1180, 250, 118, 0.3)}${lime(290, 790, 96, 1.1)}${fl}
  <rect width="1450" height="1000" filter="url(#bt-g)"/>`)
}

// A blood orange cut across, with fennel fronds.
function orange() {
  const r = rng(5)
  const cx = 430, cy = 560, R = 420
  let seg = '', ves = ''
  const p = (a, d) => `${f1(cx + Math.cos(a) * d)} ${f1(cy + Math.sin(a) * d)}`
  for (let k = 0; k < 11; k++) {
    const a0 = (k / 11) * 6.283, a1 = ((k + 1) / 11) * 6.283 - 0.05
    seg += `<path d="M${p((a0 + a1) / 2, R * 0.1)} L${p(a0 + 0.025, R * 0.78)} A${f1(R * 0.78)} ${f1(R * 0.78)} 0 0 1 ${p(a1, R * 0.78)} Z" fill="url(#or-sg)"/>`
    for (let i = 0; i < 40; i++) {
      const a = a0 + 0.05 + r() * (a1 - a0 - 0.1), d = R * (0.18 + r() * 0.58), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d
      ves += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(4 + r() * 7)}" ry="${f1(2 + r() * 3)}" transform="rotate(${(a * 57.3).toFixed(0)} ${f1(x)} ${f1(y)})" fill="#ff8a6a" opacity="${(0.15 + r() * 0.3).toFixed(2)}"/>`
    }
  }
  let fr = ''
  for (let i = 0; i < 34; i++) {
    const x0 = 560 + r() * 160, y0 = 60 + r() * 260, len = 60 + r() * 120, a = -1.2 + r() * 1.8
    fr += `<path d="M${x0.toFixed(0)} ${y0.toFixed(0)} q ${(Math.cos(a) * len * 0.5).toFixed(0)} ${(Math.sin(a) * len * 0.3).toFixed(0)} ${(Math.cos(a) * len).toFixed(0)} ${(Math.sin(a) * len).toFixed(0)}"/>`
  }
  return svg(750, `<defs>
  <radialGradient id="or-sg" cx="${cx}" cy="${cy}" r="${R * 0.8}" gradientUnits="userSpaceOnUse"><stop offset=".1" stop-color="#e2683e"/><stop offset=".55" stop-color="#b3221f"/><stop offset="1" stop-color="#6e0f16"/></radialGradient>
  <radialGradient id="or-tb" cx=".7" cy=".2" r=".9"><stop offset="0" stop-color="#2b241d"/><stop offset="1" stop-color="#100d0a"/></radialGradient>${grain('or-g', 0.2)}</defs>
  <rect width="750" height="1000" fill="url(#or-tb)"/>
  <circle cx="${cx + 30}" cy="${cy + 40}" r="${R}" fill="#000" opacity=".5"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="#c4521f"/><circle cx="${cx}" cy="${cy}" r="${f1(R * 0.95)}" fill="#f2d7b0"/><circle cx="${cx}" cy="${cy}" r="${f1(R * 0.82)}" fill="#f6e4c8"/>
  ${seg}${ves}<circle cx="${cx}" cy="${cy}" r="${f1(R * 0.08)}" fill="#f6e4c8"/>
  <g stroke="#9fbf6a" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9">${fr}</g>
  <rect width="750" height="1000" filter="url(#or-g)"/>`)
}

// Black beans in an enamelled cast-iron pot, with soured cream and coriander.
function beans() {
  const r = rng(9)
  let b = ''
  for (let i = 0; i < 300; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 300, x = 725 + Math.cos(a) * d, y = 500 + Math.sin(a) * d
    b += `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${(r() * 180).toFixed(0)})"><ellipse rx="22" ry="13" fill="#1c1513"/><ellipse rx="22" ry="13" fill="url(#bn-bn)"/><ellipse cx="-7" cy="-5" rx="8" ry="2.6" fill="#f3e4cf" opacity=".6"/></g>`
  }
  let leaves = ''
  for (const [x, y, rot] of [[860, 620, 20], [895, 650, -40], [600, 380, 60], [930, 430, 0], [560, 640, -70]]) {
    leaves += `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 c 14 -22 40 -22 46 0 c -10 18 -34 22 -46 0z" fill="#6c9a3f"/><path d="M0 0 L42 -2" stroke="#3f5f22" stroke-width="2"/></g>`
  }
  return svg(1450, `<defs>
  <radialGradient id="bn-bn" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#5a473f"/><stop offset="1" stop-color="#120d0b" stop-opacity="0"/></radialGradient>
  <radialGradient id="bn-tb" cx=".5" cy=".5" r=".8"><stop offset="0" stop-color="#4a3321"/><stop offset="1" stop-color="#1a110a"/></radialGradient>
  <linearGradient id="bn-sp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8875a"/><stop offset="1" stop-color="#8e6239"/></linearGradient>
  <clipPath id="bn-pc"><circle cx="725" cy="500" r="318"/></clipPath>${grain('bn-g', 0.2)}</defs>
  <rect width="1450" height="1000" fill="url(#bn-tb)"/>
  <g stroke="#2b1d12" stroke-width="3" opacity=".5"><line x1="0" y1="140" x2="1450" y2="150"/><line x1="0" y1="420" x2="1450" y2="410"/><line x1="0" y1="700" x2="1450" y2="712"/></g>
  <circle cx="765" cy="545" r="395" fill="#000" opacity=".5"/>
  <rect x="1060" y="468" width="320" height="64" rx="32" fill="#c9442a"/><rect x="1060" y="468" width="320" height="18" rx="9" fill="#e5694d" opacity=".6"/>
  <circle cx="725" cy="500" r="380" fill="#c9442a"/><circle cx="725" cy="500" r="380" fill="none" stroke="#e5694d" stroke-width="10" opacity=".6"/>
  <circle cx="725" cy="500" r="345" fill="#ece0cd"/><circle cx="725" cy="500" r="345" fill="none" stroke="#fff6e8" stroke-width="3" opacity=".7"/>
  <circle cx="725" cy="500" r="322" fill="#120d0b"/>
  <g clip-path="url(#bn-pc)"><rect width="1450" height="1000" fill="#2c1e18"/>${b}
   <ellipse cx="660" cy="540" rx="96" ry="74" fill="#f1e8d8"/><ellipse cx="640" cy="522" rx="48" ry="24" fill="#fffaf0"/>
   <g fill="#d9482c"><circle cx="680" cy="510" r="5"/><circle cx="626" cy="566" r="4"/><circle cx="666" cy="584" r="4.5"/><circle cx="700" cy="556" r="3.5"/></g>${leaves}</g>
  <g transform="rotate(-24 300 820)"><rect x="40" y="800" width="420" height="34" rx="17" fill="url(#bn-sp)"/><ellipse cx="500" cy="817" rx="74" ry="46" fill="url(#bn-sp)"/><ellipse cx="500" cy="817" rx="56" ry="32" fill="#7a522f"/></g>
  <rect width="1450" height="1000" filter="url(#bn-g)"/>`)
}

// A jar of chilli oil, side on.
function jar() {
  const r = rng(13)
  let fl = ''
  for (let i = 0; i < 220; i++) {
    const x = 200 + r() * 350, y = 600 + Math.pow(r(), 0.6) * 300
    fl += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${f1(4 + r() * 9)}" height="${f1(3 + r() * 5)}" fill="${r() < 0.25 ? '#f2c27a' : r() < 0.5 ? '#5a120c' : '#8e1d11'}" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`
  }
  let sd = ''
  for (let i = 0; i < 30; i++) sd += `<circle cx="${(220 + r() * 310).toFixed(0)}" cy="${(330 + r() * 260).toFixed(0)}" r="${f1(2 + r() * 3)}" fill="#ffd28a" opacity=".55"/>`
  return svg(750, `<defs>
  <linearGradient id="jr-oi" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e130b"/><stop offset=".3" stop-color="#c8371a"/><stop offset=".55" stop-color="#e8622b"/><stop offset="1" stop-color="#5c0f09"/></linearGradient>
  <linearGradient id="jr-gs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".12" stop-color="#fff" stop-opacity=".35"/><stop offset=".2" stop-color="#fff" stop-opacity="0"/><stop offset=".86" stop-color="#fff" stop-opacity="0"/><stop offset=".92" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="jr-tb" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#3b2c1f"/><stop offset="1" stop-color="#110c08"/></radialGradient>
  <clipPath id="jr-jc"><rect x="190" y="280" width="370" height="640" rx="40"/></clipPath>${grain('jr-g', 0.2)}</defs>
  <rect width="750" height="1000" fill="url(#jr-tb)"/>
  <rect y="880" width="750" height="120" fill="#0d0a07"/><ellipse cx="375" cy="930" rx="240" ry="26" fill="#d9482c" opacity=".25"/>
  <rect x="215" y="180" width="320" height="110" rx="12" fill="#2a2420"/><rect x="215" y="180" width="320" height="20" rx="8" fill="#4a423b"/>
  <g clip-path="url(#jr-jc)"><rect x="190" y="280" width="370" height="640" fill="#2b1410"/><rect x="190" y="330" width="370" height="600" fill="url(#jr-oi)"/><rect x="190" y="330" width="370" height="6" fill="#ffb27a" opacity=".6"/>${fl}${sd}</g>
  <rect x="190" y="280" width="370" height="640" rx="40" fill="url(#jr-gs)"/>
  <rect x="190" y="280" width="370" height="640" rx="40" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="3"/>
  <rect x="270" y="520" width="210" height="150" fill="#efe4d0"/><rect x="286" y="536" width="178" height="118" fill="none" stroke="#2a1a10" stroke-width="2"/>
  <path d="M310 595 h130" stroke="#2a1a10" stroke-width="2"/><circle cx="375" cy="566" r="12" fill="#c8371a"/><path d="M325 618 h100 M340 634 h70" stroke="#6a4a30" stroke-width="4"/>
  <rect width="750" height="1000" filter="url(#jr-g)"/>`)
}

export const DRAWN = {
  saltmarsh: { shape: 'wide', draw: saltmarsh },
  stair: { shape: 'tall', draw: stair },
  library: { shape: 'wide', draw: library, loop: 12 },
  orchard: { shape: 'tall', draw: orchard },
  broth: { shape: 'wide', draw: broth, loop: 8 },
  orange: { shape: 'tall', draw: orange },
  beans: { shape: 'wide', draw: beans },
  jar: { shape: 'tall', draw: jar },
}
