// Journal Index Kit: charts drawn from data, for publications whose lead
// "image" is a figure (an engineering blog's latency graph, a research
// note's results). A chart is a .json file used wherever an image can be:
// a post's lead, the preview slot, or a figure in the body.
//
// The marks are an SVG stretched to the plot; every label is real HTML
// text placed over it in percentages. So a label is 12 px at any size, the
// small copy in the preview slot included, and the check can measure it.
// The small copy ("plate") keeps the first and last labels on each axis and
// drops the notes.
//
// { "kind": "line" | "bars" | "columns",
//   "describe": "what it shows, for screen readers",            required
//   "unit": "ms", "max": 60, "ticks": 4,
//   "values": [..]                       line and bars
//   "x": [[0, "d0"], [16, "d2"]]         x labels at value indexes
//   "shade": 64                          line: shade from this index on
//   "highlight": [3, 29]                 bars: these indexes in the accent
//   "marker": { "at": 64, "label": "scheduler on" }
//   "guide": 41                          a dotted line at this value
//   "notes": [{ "at": 4, "value": 55, "text": "before", "accent": false }]
//   "groups": [["scan", [0.8, 2.4]]], "legend": ["before", "after"]   columns }
import { esc } from './markdown.mjs'

const pct = (v) => `${Math.round(v * 1000) / 10}%`

export function checkChart(c, where) {
  const errs = []
  const need = (ok, msg) => ok || errs.push(`${where}: ${msg}`)
  need(['line', 'bars', 'columns'].includes(c.kind), 'chart "kind" must be line, bars or columns')
  need(typeof c.describe === 'string' && c.describe.length >= 12, 'chart needs "describe", a sentence saying what it shows (for screen readers)')
  need(typeof c.max === 'number' && c.max > 0, 'chart needs "max", the top of the scale')
  if (c.kind === 'line' || c.kind === 'bars') {
    need(Array.isArray(c.values) && c.values.length >= 2 && c.values.every((v) => typeof v === 'number'), 'chart needs "values", 2 or more numbers')
    if (Array.isArray(c.values)) need(c.values.every((v) => v >= 0 && v <= c.max), `every value must be between 0 and max (${c.max})`)
  }
  if (c.kind === 'columns') need(Array.isArray(c.groups) && c.groups.length >= 1 && c.groups.every((g) => Array.isArray(g) && typeof g[0] === 'string' && Array.isArray(g[1])), 'chart needs "groups": [["label", [a, b]], ...]')
  for (const n of c.notes ?? []) need(typeof n.text === 'string' && n.text.length <= 40, 'chart notes need "text" of 40 characters or fewer')
  return errs
}

/** HTML for a chart. size: "full" (lead, body figure) or "plate" (the preview slot). */
export function chartHtml(c, size = 'full') {
  const small = size === 'plate'
  const ticks = c.ticks ?? 4
  const y = (v) => 1 - v / c.max
  let svg = ''
  let labels = ''
  for (let k = 0; k <= ticks; k++) {
    const yy = y((c.max * k) / ticks)
    svg += `<line class="ji-grid${k ? '' : ' ji-base'}" x1="0" x2="1000" y1="${yy * 1000}" y2="${yy * 1000}"/>`
    if (!small || k === 0 || k === ticks) labels += `<span class="ji-ax ji-ax-y" style="top:${pct(yy)}">${esc(fmt((c.max * k) / ticks))}</span>`
  }
  if (c.unit && !small) labels += `<span class="ji-unit">${esc(c.unit)}</span>`
  if (c.kind === 'line' || c.kind === 'bars') {
    const n = c.values.length
    const xi = (i) => (c.kind === 'line' ? i / (n - 1) : (i + 0.5) / n)
    if (c.kind === 'line' && c.shade != null) svg += `<rect class="ji-shade" x="${xi(c.shade) * 1000}" y="0" width="${(1 - xi(c.shade)) * 1000}" height="1000"/>`
    if (c.guide != null) svg += `<line class="ji-guide" x1="0" x2="${(c.marker ? xi(c.marker.at) : 1) * 1000}" y1="${y(c.guide) * 1000}" y2="${y(c.guide) * 1000}"/>`
    if (c.kind === 'line') svg += `<polyline class="ji-line" points="${c.values.map((v, i) => `${(xi(i) * 1000).toFixed(1)},${(y(v) * 1000).toFixed(1)}`).join(' ')}"/>`
    else {
      const [a, b] = c.highlight ?? [-1, -1]
      const w = 1000 / n
      c.values.forEach((v, i) => (svg += `<rect class="ji-bar${i >= a && i <= b ? ' ji-hot' : ''}" x="${(i * w + w * 0.12).toFixed(1)}" y="${(y(v) * 1000).toFixed(1)}" width="${(w * 0.76).toFixed(1)}" height="${((1 - y(v)) * 1000).toFixed(1)}"/>`))
    }
    if (c.marker) svg += `<line class="ji-marker" x1="${xi(c.marker.at) * 1000}" x2="${xi(c.marker.at) * 1000}" y1="0" y2="1000"/>`
    const xs = c.x ?? []
    xs.forEach(([i, t], k) => {
      if (small && k !== 0 && k !== xs.length - 1) return
      const edge = k === 0 ? ' ji-first' : k === xs.length - 1 ? ' ji-last' : ''
      labels += `<span class="ji-ax ji-ax-x${edge}" style="left:${pct(xi(i))}">${esc(t)}</span>`
    })
    if (!small) {
      // a label right of the middle reads leftwards from its point, so it never runs off the chart
      const flip = (x) => (x > 0.7 ? ' ji-flip' : '')
      if (c.marker?.label) labels += `<span class="ji-note ji-acc ji-mk${flip(xi(c.marker.at))}" style="left:${pct(xi(c.marker.at))};top:${pct(0.04)}">${esc(c.marker.label)}</span>`
      for (const nt of c.notes ?? []) labels += `<span class="ji-note${nt.accent ? ' ji-acc' : ''}${flip(xi(nt.at))}" style="left:${pct(xi(nt.at))};top:${pct(y(nt.value))}">${esc(nt.text)}</span>`
    }
  } else {
    const g = c.groups.length
    const per = c.groups[0][1].length
    c.groups.forEach(([label, vals], gi) => {
      const gw = 1000 / g
      const bw = (gw * 0.56) / per
      vals.forEach((v, k) => (svg += `<rect class="ji-bar${k === per - 1 ? ' ji-hot' : ''}" x="${(gi * gw + gw * 0.22 + k * bw + 3).toFixed(1)}" y="${(y(v) * 1000).toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${((1 - y(v)) * 1000).toFixed(1)}"/>`))
      if (!small || gi === 0 || gi === g - 1) labels += `<span class="ji-ax ji-ax-x" style="left:${pct((gi + 0.5) / g)}">${esc(label)}</span>`
    })
    if (!small && c.legend) labels += `<span class="ji-legend">${c.legend.map((l, k) => `<span><i class="${k === c.legend.length - 1 ? 'ji-hot' : ''}"></i>${esc(l)}</span>`).join('')}</span>`
  }
  return `<div class="ji-chart ji-chart-${small ? 'plate' : 'full'}" role="img" aria-label="${esc(c.describe)}"><div class="ji-plot"><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">${svg}</svg>${labels}</div></div>`
}

function fmt(v) {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`.replace('.0k', 'k')
  return String(Math.round(v * 10) / 10)
}
