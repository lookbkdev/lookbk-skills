// How It Works kit: draws each step's deliverable as a small object on the
// desk, in HTML and inline SVG. Nothing here is read out: every object sits
// inside aria-hidden markup, and the step's "You get" line plus the
// artifact's alt (in a visually hidden paragraph) carry its meaning.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function plan(a) {
  const [W, D] = a.size
  const k = Math.min(290 / W, 140 / D)
  const ox = 40, oy = 34
  const X = (v) => +(ox + v * k).toFixed(1), Y = (v) => +(oy + v * k).toFixed(1)
  const w = X(W), d = Y(D)
  const door = a.door
  // walls with the door opening left in the bottom wall
  const walls = door
    ? `M${X(door.at + door.width)} ${d} H${w} V${oy} H${ox} V${d} H${X(door.at)}`
    : `M${ox} ${oy} H${w} V${d} H${ox} Z`
  const swing = door ? `<path d="M${X(door.at)} ${d} A${(door.width * k).toFixed(1)} ${(door.width * k).toFixed(1)} 0 0 1 ${X(door.at + door.width)} ${(d - door.width * k).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"/><path d="M${X(door.at + door.width)} ${d} V${(d - door.width * k).toFixed(1)}" stroke="currentColor"/>` : ''
  const win = a.window ? `<path d="M${X(a.window[0])} ${oy} H${X(a.window[1])}" stroke="var(--paper)" stroke-width="5"/><path d="M${X(a.window[0])} ${oy - 4} V${oy + 4} M${X(a.window[1])} ${oy - 4} V${oy + 4} M${X(a.window[0])} ${oy} H${X(a.window[1])}" stroke="var(--accent)" stroke-width="2"/><text x="${X(a.window[0]) + 2}" y="${oy - 7}" fill="var(--accent)">window ${a.window[1] - a.window[0]}</text>` : ''
  const units = (a.units ?? []).map(([x, y, uw, uh]) => `<rect x="${X(x)}" y="${Y(y)}" width="${(uw * k).toFixed(1)}" height="${(uh * k).toFixed(1)}"/>`).join('')
  const marks = (a.marks ?? []).map((m) => `<circle cx="${X(m.x)}" cy="${Y(m.y)}" r="4.5" fill="var(--you)" stroke="none"/><text x="${X(m.x) - 8}" y="${Y(m.y) + 18}">${esc(m.label)}</text>`).join('')
  const block = a.block.map(([l, v]) => `<div><small>${esc(l)}</small>${esc(v)}</div>`).join('')
  return `<div class="ps-obj ps-sheet ps-land"><div class="ps-mono">${esc(a.meta)}</div>
<svg viewBox="0 0 380 205" class="ps-plan">
<g class="ps-dim"><path d="M${ox} ${oy - 18} H${w} M${ox} ${oy - 22} V${oy - 14} M${w} ${oy - 22} V${oy - 14}"/><text x="${((ox + w) / 2 - 14).toFixed(1)}" y="${oy - 24}">${W}</text>
<path d="M${w + 16} ${oy} V${d} M${w + 12} ${oy} H${w + 20} M${w + 12} ${d} H${w + 20}"/><text x="${w + 22}" y="${((oy + d) / 2 + 4).toFixed(1)}">${D}</text></g>
<g class="ps-units">${units}</g>
<path d="${walls}" fill="none" stroke="currentColor" stroke-width="3"/>${swing}${win}<g class="ps-dim">${marks}</g>
</svg><div class="ps-tblock" style="--n:${a.block.length}">${block}</div></div>`
}

function sheet(a) {
  if (a.style === 'pairs')
    return `<div class="ps-obj ps-sheet ps-pairs"><div class="ps-mono">${esc(a.meta)}</div><h4 class="ps-big">${esc(a.title)}</h4>${a.rows.map(([l, v]) => `<div class="ps-q"><b>${esc(l)}</b><span>${esc(v)}</span></div>`).join('')}${a.stamp ? `<div class="ps-stamp">${esc(a.stamp)}</div>` : ''}</div>`
  const rows = a.rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join('')
  const total = a.total ? `<tr class="ps-tot"><td>${esc(a.total[0])}</td><td>${esc(a.total[1])}</td></tr>` : ''
  return `<div class="ps-obj ps-sheet"><div class="ps-mono">${esc(a.meta)}</div><h4>${esc(a.title)}</h4><table>${rows}${total}</table><div class="ps-ln" style="width:78%"></div><div class="ps-ln" style="width:58%"></div>${a.stamp ? `<div class="ps-stamp">${esc(a.stamp)}</div>` : ''}</div>`
}

function log(a, i) {
  const rows = a.entries.map((e) => `<li data-at="${e.day}"><b>${esc(e.label)}</b><span>${esc(e.text)}</span></li>`).join('')
  return `<div class="ps-obj ps-sheet ${i % 2 ? 'ps-tilt-r' : ''}"><div class="ps-mono">${esc(a.meta)}</div><h4>${esc(a.title)}</h4><ul class="ps-log">${rows}</ul></div>`
}

function certificate(a) {
  return `<div class="ps-obj ps-cert"><div class="ps-mono">${esc(a.meta)}</div><h4>${esc(a.title)}</h4><p>${esc(a.body)}</p>${a.foot ? `<div class="ps-mono ps-foot">${esc(a.foot)}</div>` : ''}<div class="ps-seal"><span><b>${esc(a.seal.big)}</b>${esc(a.seal.small)}</span></div></div>`
}

function invite(a) {
  const tones = ['var(--accent)', 'var(--you)', 'var(--paper)', 'var(--paper-mute)']
  const inks = ['var(--on-accent)', 'var(--paper-dark)', 'var(--paper-ink)', 'var(--paper)']
  return `<div class="ps-obj ps-invite"><div class="ps-row2"><span>${esc(a.label)}</span><span>${esc(a.duration)}</span></div><h4>${esc(a.title)}</h4><div class="ps-tm">${esc(a.when)}</div>
<div class="ps-who">${a.people.map((x, i) => `<i style="background:${tones[i]};color:${inks[i]}">${esc(x)}</i>`).join('')}</div>
<ul>${a.agenda.map(([t, x]) => `<li><b>${esc(t)}</b>${esc(x)}</li>`).join('')}</ul><div class="ps-btns"><span class="ps-yes">${esc(a.accept)}</span><span>Propose a time</span></div></div>`
}

function slides(a) {
  return `<div class="ps-deck">${a.slides.map((x) => `<div class="ps-obj ps-slide${x.dark ? ' ps-dark' : ''}"><span class="ps-mono">${esc(x.meta)}</span><span class="ps-mark ps-mark-${x.style}">${esc(x.mark).replace(/ &amp; /g, '<br>&amp; ')}</span><span class="ps-sw">${x.swatches.map((h) => `<i style="background:${h}"></i>`).join('')}</span></div>`).join('')}</div>`
}

function screen(a) {
  const host = a.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `<div class="ps-obj ps-browser"><div class="ps-bar2"><i></i><i></i><i></i><span>${esc(host)}</span></div><div class="ps-hero"><div><h5>${esc(a.headline)}</h5><span class="ps-pill">${esc(a.button)}</span></div><div class="ps-tile" style="background:${a.tile.color}"><span>${esc(a.tile.letter)}</span></div></div></div>`
}

function spread(a) {
  return `<div class="ps-obj ps-spread"><div><div class="ps-mono">${esc(a.meta)}</div><h5>${esc(a.title)}</h5><p>${esc(a.body)}</p><span class="ps-pn">${a.pages[0]}</span></div><div><div class="ps-chips">${a.swatches.map(([n, h]) => `<i style="background:${h};color:${chipInk(h)}">${esc(n)}</i>`).join('')}</div><span class="ps-pn ps-pn-r">${a.pages[1]}</span></div></div>`
}
function chipInk(h) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#141412' : '#f3f1ea'
}

function image(a) {
  return `<div class="ps-obj ps-photo"><img src="${esc(a.src)}" alt="" loading="lazy" decoding="async"></div>`
}

const DRAW = { plan, sheet, log, certificate, invite, slides, screen, spread, image }
/** the object alone, marked up to be hidden from assistive technology by its container */
export const drawArtifact = (a, i) => DRAW[a.kind](a, i)
export const usesSerif = (c) => c.steps.some((s) => s.artifact?.kind === 'slides' && s.artifact.slides.some((x) => x.style === 'serif'))
