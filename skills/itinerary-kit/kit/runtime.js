/* Itinerary Kit runtime: keeps the plan (map), the section (height strip)
   and the schedule (day ledger) on the same day as the reader scrolls.
   With ?it-record=1 nothing moves on its own: the recorder calls
   Itinerary.seek(t) for every frame of a scripted tour. */
(() => {
  const root = document.querySelector('.it')
  if (!root) return
  const data = JSON.parse(root.querySelector('.it-data').textContent)
  const REC = /[?&]it-record=1/.test(location.search)
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (REC) root.classList.add('is-rec')
  const NS = 'http://www.w3.org/2000/svg'
  const svg = root.querySelector('.it-map'), geoG = svg.querySelector('.it-geo'), over = svg.querySelector('.it-over')
  const wrap = root.querySelector('.it-mapwrap'), panel = root.querySelector('.it-panel')
  const legs = [...svg.querySelectorAll('.it-leg')]
  const dayEls = [...root.querySelectorAll('.it-day')]
  const sds = [...root.querySelectorAll('.it-sd')], bands = [...root.querySelectorAll('.it-band')]
  const where = root.querySelector('.it-where'), sum = root.querySelector('.it-sum')
  const n = dayEls.length
  const CAM = 0.7 // seconds the camera takes between days

  /** the points of a path written by the build: M x y, then l dx dy steps */
  function parseD(d) {
    const tok = d.match(/[Mlz]|-?\d*\.?\d+(?:e-?\d+)?/g) || []
    const pts = []
    let x = 0, y = 0, cmd = 'M'
    for (let i = 0; i < tok.length;) {
      const t = tok[i]
      if (/[Mlz]/.test(t)) { cmd = t; i++; continue }
      const a = +tok[i], b = +tok[i + 1]
      i += 2
      if (cmd === 'M') { x = a; y = b; cmd = 'l' } else { x += a; y += b }
      pts.push([x, y])
    }
    return pts
  }
  const lines = legs.map((g) => parseD(g.querySelector('.it-line').getAttribute('d')))
  const box = (pts) => { let a = [1e9, 1e9, -1e9, -1e9]; for (const [x, y] of pts) a = [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)]; return a }
  const all = box(lines.flat()), aw = all[2] - all[0], ah = all[3] - all[1]
  const pad = (b, k, minW) => { const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; let w = Math.max(b[2] - b[0], minW), h = Math.max(b[3] - b[1], minW * 0.6); w *= 1 + k; h *= 1 + k; return [cx - w / 2, cy - h / 2, w, h] }
  const views = [pad(all, 0.16, 0), ...lines.map((l) => pad(box(l), 0.45, Math.max(aw, ah) * 0.3))]
  const viewOf = (i) => views[i + 1]
  let cur = views[0].slice(), active = -2, layout = null
  const anim = { from: cur, to: cur, t0: 0 }

  svg.setAttribute('preserveAspectRatio', 'none')
  const size = () => ({ W: wrap.clientWidth, H: wrap.clientHeight })
  const phone = () => innerWidth <= 860
  function fit(v) {
    const { W, H } = size(), s = Math.min(W / v[2], H / v[3])
    return { s, tx: W / 2 - (v[0] + v[2] / 2) * s, ty: H / 2 - (v[1] + v[3] / 2) * s, W, H }
  }
  const el = (name, attrs, parent = over) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e }
  const kmNice = (s, W) => [200, 100, 50, 20, 10, 5, 2, 1, 0.5].find((k) => k * s <= (W < 500 ? 90 : 150)) || 0.5

  /** where every label goes for a view: tried near its stop first, then further out on a leader line */
  function place(v) {
    const T = fit(v), P = ([x, y]) => [T.tx + x * T.s, T.ty + y * T.s]
    over.innerHTML = ''
    const probe = el('text', { class: 'it-lbl is-end' })
    const route = []
    lines.forEach((l) => { let last = null; for (const p of l) { const q = P(p); if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 4) { route.push(q); last = q } } })
    const ph = T.W < 500
    const plate = [0, ph ? 0 : T.H - 44, kmNice(T.s, T.W) * T.s + 84, 46]
    const north = ph ? null : [T.W - 44, 0, 44, 60]
    const placed = [plate, ...(north ? [north] : [])]
    const stops = data.stops.map((s, i) => ({ ...s, i, p: P([s.x, s.y]) })).filter((s, i, a) => !(i === a.length - 1 && Math.hypot(s.p[0] - a[0].p[0], s.p[1] - a[0].p[1]) < 2))
    for (const s of stops) placed.push([s.p[0] - 7, s.p[1] - 7, 14, 14])
    const near = [[10, -7, 'start'], [10, 18, 'start'], [-10, -7, 'end'], [-10, 18, 'end'], [0, -13, 'middle'], [0, 27, 'middle']]
    const far = []
    for (const r of [34, 54, 78]) for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2, ox = Math.cos(t) * r, oy = Math.sin(t) * r * 0.8; far.push([ox, oy + 6, ox > 8 ? 'start' : ox < -8 ? 'end' : 'middle']) }
    const out = []
    const order = stops.slice().sort((a, b) => (a.i === active || a.i === active + 1 ? -1 : 0) - (b.i === active || b.i === active + 1 ? -1 : 0))
    for (const s of order) {
      const [x, y] = s.p
      if (x < -20 || x > T.W + 20 || y < -20 || y > T.H + 20) continue
      const text = ph && active < 0 && s.i > 0 ? String(s.i) : s.name
      probe.textContent = text
      const w = probe.getComputedTextLength(), h = 14
      let best = null
      for (const [ring, cands] of [[0, near], [1, far]]) {
        for (const [ox, oy, an] of cands) {
          let bx = an === 'start' ? x + ox : an === 'end' ? x + ox - w : x + ox - w / 2
          const by = y + oy - h + 2
          bx = Math.min(Math.max(bx, 6), T.W - 6 - w)
          let sc = 0
          for (const q of route) if (q[0] > bx - 3 && q[0] < bx + w + 3 && q[1] > by - 3 && q[1] < by + h + 3) sc++
          for (const b of placed) if (bx < b[0] + b[2] && bx + w > b[0] && by < b[1] + b[3] && by + h > b[1]) sc += 60
          if (by < 4 || by + h > T.H - 4) sc += 60
          if (ring) sc += 0.5
          if (!best || sc < best.sc) best = { sc, bx, by, w, h, ring, an }
        }
        if (best && best.sc < 1) break
      }
      const key = active < 0 || s.i === active || s.i === active + 1 || (s.i === 0 && active + 1 === data.stops.length - 1)
      if (!key && best.sc - (best.ring ? 0.5 : 0) >= 1) continue // a context name that would sit on the line is left off
      placed.push([best.bx, best.by, best.w, best.h])
      out.push({ i: s.i, name: s.name, text, dx: best.bx - x, dy: best.by - y, w: best.w, h: best.h, leader: best.ring === 1, score: best.sc })
    }
    probe.remove()
    return out
  }

  function draw() {
    const T = fit(cur)
    if (!T.W || !T.H) return
    svg.setAttribute('viewBox', `0 0 ${T.W} ${T.H}`)
    geoG.setAttribute('transform', `translate(${T.tx.toFixed(2)} ${T.ty.toFixed(2)}) scale(${T.s.toFixed(5)})`)
    over.innerHTML = ''
    const P = ([x, y]) => [T.tx + x * T.s, T.ty + y * T.s]
    const ph = T.W < 500
    // scale bar on a plate, north arrow
    const k = kmNice(T.s, T.W), sx = 16, sy = ph ? 28 : T.H - 18
    el('rect', { class: 'it-plate', x: 0, y: sy - 24, width: k * T.s + 84, height: 38 })
    el('path', { class: 'it-sc', d: `M${sx} ${sy - 6}V${sy}H${(sx + k * T.s).toFixed(1)}V${sy - 6}` })
    el('text', { class: 'it-sct', x: (sx + k * T.s + 8).toFixed(1), y: sy + 1 }).textContent = `${k} km`
    if (!ph) {
      const nx = T.W - 24, ny = 30
      el('path', { class: 'it-north', d: `M${nx} ${ny - 14}L${nx + 6} ${ny + 4}L${nx} ${ny}L${nx - 6} ${ny + 4}Z` })
      el('text', { class: 'it-sct', x: nx, y: ny + 20, 'text-anchor': 'middle' }).textContent = 'N'
    }
    const ends = active < 0 ? [] : [active, active + 1]
    const last = data.stops.length - 1
    const loop = Math.hypot(data.stops[0].x - data.stops[last].x, data.stops[0].y - data.stops[last].y) < 0.3
    data.stops.forEach((s, i) => {
      if (loop && i === last) return
      const [x, y] = P([s.x, s.y]), end = ends.includes(i) || (loop && i === 0 && ends.includes(last))
      el('circle', { class: 'it-mk' + (end ? ' is-end' : ''), cx: x.toFixed(1), cy: y.toFixed(1), r: end ? 6 : 4 })
    })
    for (const L of layout || []) {
      const s = data.stops[L.i], [x, y] = P([s.x, s.y])
      const bx = x + L.dx, by = y + L.dy
      const end = ends.includes(L.i) || (loop && L.i === 0 && ends.includes(last))
      if (L.leader) {
        const tx = Math.min(Math.max(x, bx), bx + L.w), ty = by + L.h + 3 < y ? by + L.h + 3 : by > y ? by - 1 : by + L.h / 2
        el('line', { class: 'it-leader', x1: x.toFixed(1), y1: y.toFixed(1), x2: tx.toFixed(1), y2: ty.toFixed(1) })
      }
      const t = el('text', { class: 'it-lbl' + (end ? ' is-end' : active >= 0 ? ' is-dim' : ''), x: bx.toFixed(1), y: (by + L.h - 2).toFixed(1) })
      t.textContent = L.text
    }
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  function mark(i) {
    dayEls.forEach((e, k) => e.classList.toggle('is-on', k === i))
    legs.forEach((g, k) => { g.classList.toggle('is-on', k === i); g.classList.toggle('is-done', i >= 0 && k < i); g.classList.toggle('is-todo', i >= 0 && k > i) })
    sds.forEach((g, k) => { g.classList.toggle('is-on', k === i); g.classList.toggle('is-done', i >= 0 && k < i) })
    bands.forEach((b, k) => { b.classList.toggle('is-on', k === i); if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current') })
    const d = data.days[i]
    where.textContent = i < 0 ? `The whole route, ${Math.round(data.total).toLocaleString('en-GB')} km` : `Day ${i + 1}: ${d.from} to ${d.to}`
    if (sum) sum.textContent = i < 0 ? `${n} days` : `${d.km.toFixed(1)} km, +${d.up.toLocaleString('en-GB')} m`
  }
  function setActive(i) {
    if (i === active) return false
    active = i
    mark(i)
    anim.from = cur.slice(); anim.to = viewOf(i).slice(); anim.t0 = performance.now()
    layout = place(anim.to)
    window.__settled = false
    return true
  }

  // which day the reader is on: the last day whose top has passed the reading line
  const readLine = () => phone() ? panel.getBoundingClientRect().height + (innerHeight - panel.getBoundingClientRect().height) * 0.3 : innerHeight * 0.42
  const tops = () => dayEls.map((e) => e.getBoundingClientRect().top + scrollY)
  function activeAt(y, T = tops(), line = readLine()) { let a = -1; T.forEach((t, k) => { if (t - y < line) a = k }); return a }

  // live
  function tick() {
    const k = RM ? 1 : Math.min(1, (performance.now() - anim.t0) / (CAM * 1000))
    const e = ease(k)
    cur = anim.from.map((v, j) => v + (anim.to[j] - v) * e)
    draw()
    if (k < 1) requestAnimationFrame(tick); else window.__settled = true
  }
  function onScroll() { if (REC) return; if (setActive(activeAt(scrollY))) tick() }
  bands.forEach((b, k) => b.addEventListener('click', () => {
    const e = dayEls[k], off = phone() ? panel.getBoundingClientRect().height : parseFloat(getComputedStyle(root).getPropertyValue('--top')) + 16
    scrollTo({ top: e.getBoundingClientRect().top + scrollY - off, behavior: RM ? 'auto' : 'smooth' })
  }))

  // recorded tour: rest on the top, four days, the dates and the price
  let tour = null
  function buildTour() {
    const T = tops(), ph = phone()
    const max = document.documentElement.scrollHeight - innerHeight
    const offDay = ph ? panel.getBoundingClientRect().height : parseFloat(getComputedStyle(root).getPropertyValue('--top')) + 16
    const sec = (id) => { const s = root.querySelector('#' + id); return s.getBoundingClientRect().top + scrollY - (ph ? 0 : parseFloat(getComputedStyle(root).getPropertyValue('--top')) - 16) }
    const stops = [['top', 0, 2.4]]
    for (let k = 0; k < Math.min(4, n); k++) stops.push([`day-${k + 1}`, T[k] - offDay, 1.9])
    stops.push(['dates', sec('dates'), 1.9], ['price', sec('price'), 2.2])
    const segs = []
    let t = 0, y = 0
    for (const [name, y1, rest] of stops) {
      const to = Math.max(0, Math.min(max, Math.round(y1)))
      if (segs.length) { segs.push({ glide: true, a: t, b: t + 1.0, y0: y, y1: to }); t += 1.0 }
      segs.push({ name, a: t, b: t + rest, y0: to, y1: to }); t += rest; y = to
    }
    return { segs, length: Math.round(t * 100) / 100, T, line: readLine() }
  }
  const scrollAt = (t) => { const s = tour.segs.find((g) => t >= g.a && t <= g.b) || tour.segs[tour.segs.length - 1]; if (!s.glide) return s.y0; return s.y0 + (s.y1 - s.y0) * ease((t - s.a) / (s.b - s.a)) }
  const actAt = (t) => activeAt(scrollAt(t), tour.T, tour.line)
  function changedAt(t) { const a = actAt(t); let u = t; while (u > 0 && actAt(u - 1 / 60) === a) u -= 1 / 60; return { a, ta: u <= 0 ? -1e9 : u, prev: u <= 0 ? a : actAt(u - 1 / 60) } }
  function seek(t) {
    const y = scrollAt(t)
    scrollTo(0, y)
    const { a, ta, prev } = changedAt(t)
    if (a !== active) { active = a; mark(a); layout = place(viewOf(a)) }
    const k = RM ? 1 : Math.min(1, Math.max(0, (t - ta) / CAM)), e = ease(k)
    const f = viewOf(prev), g = viewOf(a)
    cur = f.map((v, j) => v + (g[j] - v) * e)
    draw()
    return { y, active: a, camera: k }
  }
  function settledList() {
    const out = []
    for (const s of tour.segs) if (!s.glide) {
      const { ta } = changedAt(s.a)
      const from = Math.max(s.a + 0.05, ta + CAM + 0.1)
      if (from < s.b - 0.15) out.push([s.name, Math.round(from * 100) / 100, Math.round((s.b - 0.05) * 100) / 100])
    }
    return out
  }

  const api = { data, seek, get length() { return tour ? tour.length : 0 }, get settled() { return settledList().map(([, a, b]) => [a, b]) }, get moments() { return settledList() },
    state: () => ({ active, cur: cur.slice(), target: viewOf(active).slice(), layout, frame: fit(cur) }), activeAt: () => activeAt(scrollY), viewOf, lines }
  api.ready = document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(r))).then(() => {
    if (REC) { tour = buildTour(); seek(0) } else { setActive(activeAt(scrollY)); tick() }
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', () => { if (REC) return; layout = place(viewOf(active)); draw() })
    return true
  })
  window.Itinerary = api
})()
