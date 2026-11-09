/* How It Works kit runtime (inlined into every build).
   One number drives the section: the project day under an anchor line at 42 %
   of the viewport. The cursor, its flag, the mini strip, the "Week n of N"
   ticker, the rail, the active step and the dated log rows all read it, so
   they always agree. The desk's papers move on their own clock (600 ms), and
   the page marks itself data-settled when nothing is moving.
   ?ps-record=1 hands the clock and the scroll to the recorder: seek(t) puts
   the page exactly where a fixed script says it is at t seconds. */
(() => {
  const root = document.querySelector('.ps')
  if (!root || root.dataset.psOn) return
  root.dataset.psOn = '1'
  const cfg = JSON.parse(root.dataset.ps)
  const q = new URLSearchParams(location.search)
  const RECORD = q.has('ps-record')
  const reduceQ = matchMedia('(prefers-reduced-motion: reduce)')
  root.classList.add('ps-js')
  if (RECORD) root.classList.add('ps-rec')
  const $ = (s, el = root) => el.querySelector(s)
  const $$ = (s, el = root) => [...el.querySelectorAll(s)]
  const steps = $$('.ps-step'), bars = $$('.ps-bar'), minis = $$('.ps-mini i'), rows = $$('.ps-chart .ps-row:not(.ps-yrow)')
  const arts = $$('.ps-stage .ps-art'), stage = $('.ps-stage'), chart = $('.ps-chart'), flag = $('.ps-flag'), axisEls = $$('.ps-axis span:not(.ps-flag)')
  const fill = $('.ps-fill'), list = $('.ps-list'), mcur = $('.ps-mcur'), yrow = $('.ps-yrow')
  const ANCHOR = 0.42, SWAP = 600, FADE = 450
  const n = cfg.n, total = cfg.total, week = cfg.week, weeks = total / week
  const two = () => getComputedStyle($('.ps-stagecol')).display !== 'none'
  const pad = (x) => String(x).padStart(2, '0')
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  const ease = (p) => 1 - Math.pow(1 - p, 3)
  const inout = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

  /* ---------- layout ---------- */
  let geo = { laneLeft: 0, laneW: 1, tops: [], hs: [], K: 0, F: 0 }
  function fitArt(art, w, h) {
    const obj = art.firstElementChild
    art.style.setProperty('--fit', 1)
    const ow = obj.offsetWidth, oh = obj.offsetHeight
    const deck = obj.classList.contains('ps-deck') ? 44 : 0
    return Math.min(1, (w - 56) / (ow + deck + 24), h ? (h - 64) / (oh + 24) : 1)
  }
  function layout() {
    const vh = innerHeight
    const isTwo = two()
    // the rail: a fixed floor plus K px per day, so length on screen follows length in days
    const maxL = Math.max(...cfg.steps.map((s) => s.l))
    let F = 0, K = 0
    if (isTwo) {
      K = Math.min(9, (0.9 * Math.min(vh, 960)) / maxL)
      F = Math.max(Math.min(vh, 960) * 0.55, ...steps.map((li) => $('.ps-in', li).offsetHeight + 96))
    }
    steps.forEach((li, i) => { li.style.minHeight = isTwo ? `${Math.round(F + K * cfg.steps[i].l)}px` : '' })
    // week ticks on the rail, where the anchor will meet that week
    steps.forEach((li, i) => {
      const box = $('.ps-wks', li), s = cfg.steps[i]
      box.textContent = ''
      if (getComputedStyle(box).display === 'none') return
      const h = li.offsetHeight
      let last = -1e9
      for (let w = 2; w <= weeks; w++) {
        const b = (w - 1) * week
        if (b <= s.s || b >= s.s + s.l) continue
        const y = (h * (b - s.s)) / s.l
        if (y < 74 || y > h - 20 || y - last < 28) continue
        const sp = document.createElement('span')
        sp.textContent = `W${w}`
        sp.style.top = `${y}px`
        box.appendChild(sp)
        last = y
      }
    })
    // the papers fit their desk
    if (isTwo) arts.forEach((a) => { a.dataset.fit = fitArt(a, stage.clientWidth, stage.clientHeight) })
    $$('.ps-inline .ps-art').forEach((a) => { const desk = a.parentElement; const f = fitArt(a, desk.clientWidth + 40, 0); a.style.setProperty('--fit', f.toFixed(3)) })
    // chart geometry
    const lane = $('.ps-lane', rows[0])
    const cr = chart.getBoundingClientRect(), lr = lane.getBoundingClientRect()
    geo.laneLeft = lr.left - cr.left
    geo.laneW = lr.width
    geo.chartW = cr.width
    axisLabels()
    yourLabels()
    measure()
    geo.K = K; geo.F = F
  }
  function measure() {
    geo.tops = steps.map((li) => li.getBoundingClientRect().top + scrollY)
    geo.hs = steps.map((li) => li.offsetHeight)
    const lr = list.getBoundingClientRect()
    geo.listTop = lr.top + scrollY
    geo.listH = lr.height
  }
  function axisLabels() {
    const ls = axisEls
    // every k-th week, the smallest k at which the widest label fits its share with 12 px to spare
    ls.forEach((l) => (l.style.visibility = 'visible'))
    const col = geo.laneW / ls.length
    const widest = Math.max(...ls.map((l) => l.offsetWidth))
    const k = Math.max(1, Math.ceil((widest + 12) / col))
    ls.forEach((l, i) => { l.dataset.keep = i % k ? '' : '1'; if (i % k) l.style.visibility = 'hidden' })
  }
  /** the buyer's hours: centred under each diamond, nudged inside the lane, then a second line, then the list */
  function yourLabels() {
    const marks = $$('.ps-mk', yrow)
    const w = geo.laneW
    const tiers = [[], []]
    let off = 0
    for (const m of marks) {
      const b = $('b', m)
      b.classList.remove('ps-t2', 'ps-off')
      b.style.left = '0px'
      const x = m.offsetLeft, bw = b.offsetWidth
      const left = clamp(x - bw / 2, 0, w - bw)
      const box = { l: left, r: left + bw }
      let placed = false
      for (let t = 0; t < 2 && !placed; t++) {
        if (tiers[t].every((o) => box.l >= o.r + 10 || box.r <= o.l - 10)) {
          tiers[t].push(box)
          if (t) b.classList.add('ps-t2')
          placed = true
        }
      }
      if (!placed) { b.classList.add('ps-off'); off++ }
      b.style.left = `${left - x}px`
    }
    $('.ps-ylist').classList.toggle('ps-show', off > 0)
  }

  /* ---------- the day under the anchor ---------- */
  function activeAt(y) {
    const a = y + ANCHOR * innerHeight
    let i = 0
    geo.tops.forEach((t, k) => { if (a >= t) i = k })
    return i
  }
  function dayAt(y) {
    const a = y + ANCHOR * innerHeight
    if (a < geo.tops[0]) return { i: 0, day: 0 }
    const i = activeAt(y)
    const s = cfg.steps[i]
    const f = clamp((a - geo.tops[i]) / geo.hs[i], 0, 1)
    if (i === n - 1 && f >= 1) return { i, day: total }
    return { i, day: s.s + f * s.l }
  }

  /* ---------- the papers ---------- */
  const ON = { o: 1, x: 0, y: 0, r: 0, s: 1, c: 1 }
  const target = (j, ai) => {
    const k = ai - j
    if (k === 0) return ON
    if (k < 0) return { o: 0, x: 0, y: 14, r: 0, s: 1, c: 1 }
    const kk = Math.min(k, 3)
    return { o: k <= 2 ? 1 : 0, x: -26 * kk, y: -20 * kk, r: -2.2 * kk, s: 1 - 0.06 * kk, c: 0 }
  }
  let active = -1, t0 = -1e9
  const lerp = (a, b, p) => a + (b - a) * p
  function setActive(i, t, from) {
    arts.forEach((a, j) => {
      a._from = from ? target(j, from.prev) : (a._v ?? target(j, i))
      a._to = target(j, i)
      a.classList.toggle('ps-pile', j < i)
    })
    active = i
    t0 = t
    steps.forEach((li, k) => { li.classList.toggle('ps-on', k === i); if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current') })
    rows.forEach((r, k) => r.classList.toggle('ps-on', k === i))
    bars.forEach((b, k) => { b.classList.toggle('ps-on', k === i); b.classList.toggle('ps-done', k < i) })
    minis.forEach((b, k) => { b.classList.toggle('ps-on', k === i); b.classList.toggle('ps-done', k < i) })
    const s = cfg.steps[i]
    $('.ps-snow').textContent = `${pad(i + 1)} · ${s.t}`
    $('.ps-capv').textContent = s.get
    $('.ps-hand').textContent = `In hand: ${i + 1} of ${n}`
  }
  function render(t) {
    const instant = reduceQ.matches
    const p = instant ? 1 : clamp((t - t0) / SWAP, 0, 1), po = instant ? 1 : clamp((t - t0) / FADE, 0, 1)
    const e = ease(p), eo = ease(po)
    arts.forEach((a) => {
      const f = a._from ?? a._to, g = a._to
      if (!g) return
      const v = { o: lerp(f.o, g.o, eo), x: lerp(f.x, g.x, e), y: lerp(f.y, g.y, e), r: lerp(f.r, g.r, e), s: lerp(f.s, g.s, e), c: lerp(f.c, g.c, eo) }
      a._v = v
      const fit = Number(a.dataset.fit || 1)
      a.style.opacity = v.o.toFixed(3)
      a.style.zIndex = String(20 - Math.round(Math.abs(g.x) / 26))
      a.style.transform = `translate(-50%,-50%) translate(${v.x.toFixed(2)}px,${v.y.toFixed(2)}px) rotate(${v.r.toFixed(3)}deg) scale(${(v.s * fit).toFixed(4)})`
      a.style.setProperty('--c', v.c.toFixed(3))
    })
    const done = p >= 1 && po >= 1
    if (done) root.setAttribute('data-settled', '')
    else root.removeAttribute('data-settled')
    return done
  }

  /* ---------- everything that reads the day ---------- */
  function draw(y, day, i) {
    const cx = (geo.laneW * day) / total
    chart.style.setProperty('--cx', `${((day / total) * 100).toFixed(3)}%`)
    const wk = clamp(Math.floor(Math.min(day, total - 0.001) / week) + 1, 1, weeks)
    flag.textContent = day >= total ? `${cfg.end} · week ${weeks}` : `Week ${wk} · day ${Math.max(1, Math.ceil(day))}`
    // the flag sits in the axis row over the cursor, inside the lane, and stands in for the week labels it covers
    const fw = flag.offsetWidth
    const left = clamp(cx - fw / 2, 0, geo.laneW - fw)
    flag.style.left = `${left}px`
    axisEls.forEach((l) => {
      if (!l.dataset.keep) return
      const a = l.offsetLeft - l.offsetWidth / 2, b = l.offsetLeft + l.offsetWidth / 2
      l.style.visibility = b < left - 6 || a > left + fw + 6 ? 'visible' : 'hidden'
    })
    mcur.style.left = `${(day / total) * 100}%`
    $('.ps-swk').textContent = `Week ${wk} of ${weeks}`
    fill.style.height = `${clamp(y + ANCHOR * innerHeight - geo.listTop, 0, geo.listH)}px`
    $$('.ps-log').forEach((log) => {
      let last = null
      $$('li', log).forEach((li) => {
        const later = Number(li.dataset.at) > day
        li.classList.toggle('ps-later', later)
        li.classList.remove('ps-now')
        if (!later) last = li
      })
      if (last) last.classList.add('ps-now')
    })
    root.dataset.day = day.toFixed(2)
    root.dataset.active = String(i)
  }

  /* ---------- live ---------- */
  let running = false
  function frame() {
    const t = performance.now()
    const { i, day } = dayAt(scrollY)
    if (i !== active) setActive(i, t)
    draw(scrollY, day, i)
    const done = render(t)
    if (!done) requestAnimationFrame(frame)
    else running = false
  }
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame) } }

  /* ---------- the recording script ---------- */
  const H0 = 1.6, MOVE = 1.1, DWELL = 1.6, TAIL = 0.6
  let stops = []
  function dwellY(i) {
    const vh = innerHeight
    const max = document.documentElement.scrollHeight - vh
    if (two()) return clamp(geo.tops[i] + Math.min(0.3 * vh, 0.4 * geo.hs[i]) - ANCHOR * vh, 0, max)
    const desk = $('.ps-desk', steps[i])
    const bottom = desk.getBoundingClientRect().bottom + scrollY
    return clamp(Math.max(bottom + 32 - vh, geo.tops[i] - ANCHOR * vh + 8), 0, max)
  }
  function script() { stops = [0, ...steps.map((_, i) => dwellY(i))] }
  const LENGTH = () => H0 + n * (MOVE + DWELL) + TAIL
  function yAt(t) {
    if (t <= H0) return stops[0]
    let u = t - H0
    for (let i = 0; i < n; i++) {
      if (u < MOVE) return stops[i] + (stops[i + 1] - stops[i]) * inout(u / MOVE)
      u -= MOVE
      if (u < DWELL || i === n - 1) return stops[i + 1]
      u -= DWELL
    }
    return stops[n]
  }
  /** when the active step last changed, at or before t (seconds) */
  function crossing(t) {
    const a = activeAt(yAt(t))
    const dt = 1 / 240
    for (let u = t; u > 0; u -= dt) if (activeAt(yAt(u - dt)) !== a) return { at: u, prev: activeAt(yAt(u - dt)) }
    return null
  }
  function seek(t) {
    t = clamp(t, 0, LENGTH())
    const y = yAt(t)
    scrollTo(0, y)
    const { i, day } = dayAt(y)
    const c = crossing(t)
    if (c) setActive(i, c.at * 1000, { prev: c.prev })
    else { setActive(i, -1e9); arts.forEach((a) => { a._from = a._to }) }
    draw(y, day, i)
    render(t * 1000)
  }
  function moments() {
    const dwells = steps.map((_, i) => {
      const from = H0 + (i + 1) * MOVE + i * DWELL, to = from + DWELL + (i === n - 1 ? TAIL : 0)
      const c = crossing(from)
      const settled = Math.max(from, c ? c.at + SWAP / 1000 + 0.05 : from)
      return { step: i, from: +from.toFixed(3), to: +to.toFixed(3), settled: +settled.toFixed(3) }
    })
    return { hold: [0, H0], dwells, end: +LENGTH().toFixed(3) }
  }

  let readyResolve
  const ready = new Promise((r) => (readyResolve = r))
  window.ProcessSteps = { ready, seek, moments, geo: () => ({ K: geo.K, F: geo.F, two: two(), laneW: geo.laneW }), dwellY: (i) => dwellY(i), get length() { return LENGTH() }, layout: () => { layout(); script() } }
  const start = () => {
    layout()
    script()
    if (RECORD) seek(0)
    else {
      const { i, day } = dayAt(scrollY)
      setActive(i, -1e9)
      arts.forEach((a) => { a._from = a._to })
      draw(scrollY, day, i)
      render(performance.now())
      addEventListener('scroll', kick, { passive: true })
    }
    addEventListener('resize', () => { layout(); script(); if (!RECORD) kick() })
    readyResolve(true)
  }
  ;(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(start))
})()
