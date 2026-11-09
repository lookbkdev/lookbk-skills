// Compare Table Kit runtime, inlined into every build. It:
//   - draws each group's "ahead" underlines once, as the group arrives
//   - opens a source when its mark is pointed at, focused or tapped
//     (Escape closes it and gives focus back to the mark)
//   - keeps the head row stuck and its columns in line with the table
//     when the alternatives scroll sideways
//   - runs the phone pair view: chips, swipe, the pair head and the pager
//   - with ?ct-record=1, plays a fixed tour that the recorder steps frame by
//     frame (CompareTable.seek), and reports the settled stretches
;(() => {
  const root = document.querySelector('.ct')
  if (!root) return
  const data = JSON.parse(root.querySelector('.ct-data').textContent)
  const q = (s, el = root) => el.querySelector(s)
  const qa = (s, el = root) => [...el.querySelectorAll(s)]
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const recording = /[?&]ct-record=1/.test(location.search)
  const narrow = () => root.clientWidth < 700
  const API = (window.CompareTable = { drawCount: {}, ready: null, settled: [], moments: [], length: 0 })
  root.classList.add('ct-armed')
  if (recording) root.classList.add('ct-rec')

  // ---------- draw-in ----------
  const groupRows = (g) => [...qa(`.ct-r[data-g="${g}"]`), ...qa(`.ct-pg[data-g="${g}"] .ct-pr`)]
  const groups = [...new Set(qa('.ct-r[data-g]').map((r) => r.dataset.g))]
  function draw(g) {
    if (API.drawCount[g]) return
    API.drawCount[g] = 1
    const rows = groupRows(g)
    const perPane = qa(`.ct-r[data-g="${g}"]`).length
    rows.forEach((r, i) => { r.style.setProperty('--dl', `${(i % perPane) * 60}ms`); r.classList.add('ct-on') })
  }
  if (reduce && !recording) groups.forEach(draw)
  else if (!recording) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { draw(e.target.dataset.g); } }), { rootMargin: '0px 0px -40% 0px' })
    qa('.ct-gh[data-g], .ct-pg[data-g]').forEach((el) => io.observe(el))
  }

  // ---------- sources ----------
  const layer = root.nextElementSibling && root.nextElementSibling.classList.contains('ct-layer') ? root.nextElementSibling : document.querySelector('.ct-layer')
  const pop = q('.ct-pop', layer), popK = q('.ct-pk2', layer), popX = q('.ct-px', layer), popL = q('.ct-pl', layer), popC = q('.ct-pc', layer)
  if (recording) layer.classList.add('ct-rec')
  let openMark = null, pinned = false
  const srcOf = (n) => data.sources.find((s) => s.n === n)
  function place(m) {
    layer.classList.toggle('is-narrow', narrow())
    if (narrow()) { pop.style.left = ''; pop.style.top = ''; return }
    const S = root.getBoundingClientRect(), L = layer.getBoundingClientRect(), r = m.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight
    const R = { left: L.left, top: L.top, width: S.right - L.left }
    const pad = 16
    let left = r.left - R.left - 18
    left = Math.max(S.left - L.left + pad, Math.min(left, R.width - w - pad))
    const below = innerHeight - r.bottom, above = r.top - parseFloat(getComputedStyle(root).getPropertyValue('--ct-top') || 0) - 140
    const up = below < h + 24 && above > h + 24
    pop.classList.toggle('is-above', up)
    pop.style.left = `${left}px`
    pop.style.top = `${(up ? r.top - R.top - h - 10 : r.bottom - R.top + 10)}px`
    pop.style.setProperty('--tip', `${Math.max(10, Math.min(w - 22, r.left - R.left - left + r.width / 2 - 6))}px`)
  }
  function open(m, { focus = false, pin = false } = {}) {
    if (openMark && openMark !== m) close({ restore: false })
    const s = srcOf(Number(m.dataset.s))
    popK.innerHTML = ''
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = s.label
    const k = document.createElement('span'); k.textContent = `${s.estimate ? 'Estimate' : `Source ${s.n}`} · ${s.asOf}`
    popK.append(tag, k)
    popX.textContent = `${s.text}.`
    popL.hidden = !s.url; if (s.url) popL.href = s.url
    layer.classList.toggle('is-narrow', narrow())
    pop.hidden = false
    if (!openMark && !reduce && !recording) { pop.classList.add('is-in'); requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.remove('is-in'))) }
    place(m)
    openMark = m; pinned = pin
    m.setAttribute('aria-expanded', 'true')
    qa('.ct-sources li').forEach((li) => li.classList.toggle('is-lit', Number(li.dataset.s) === s.n))
    if (focus) pop.focus({ preventScroll: true })
  }
  function close({ restore = true } = {}) {
    if (!openMark) return
    const m = openMark
    pop.hidden = true; openMark = null; pinned = false
    m.setAttribute('aria-expanded', 'false')
    qa('.ct-sources li.is-lit').forEach((li) => li.classList.remove('is-lit'))
    if (restore) m.focus({ preventScroll: true })
  }
  API.open = (m) => open(m); API.close = () => close({ restore: false })
  if (!recording) {
    root.addEventListener('click', (e) => {
      const m = e.target.closest('.ct-m')
      if (m) { e.preventDefault(); if (openMark === m && pinned) close(); else open(m, { focus: true, pin: true }); return }
      if (openMark) close({ restore: false })
    })
    document.addEventListener('click', (e) => { if (openMark && !root.contains(e.target) && !layer.contains(e.target)) close({ restore: false }) })
    popC.addEventListener('click', () => close())
    root.addEventListener('pointerover', (e) => { const m = e.target.closest('.ct-m'); if (m && e.pointerType === 'mouse' && !pinned) open(m) })
    root.addEventListener('pointerout', (e) => { const m = e.target.closest('.ct-m'); if (m && e.pointerType === 'mouse' && !pinned && openMark === m && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.ct-pop'))) close({ restore: false }) })
    pop.addEventListener('pointerleave', (e) => { if (!pinned && e.pointerType === 'mouse') close({ restore: false }) })
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openMark) { e.preventDefault(); close() } })
    pop.addEventListener('focusout', (e) => { if (pinned && e.relatedTarget && !pop.contains(e.relatedTarget) && e.relatedTarget !== openMark) close({ restore: false }) })
    addEventListener('resize', () => openMark && place(openMark))
    addEventListener('scroll', () => { if (openMark && !pinned) close({ restore: false }); else if (openMark) place(openMark) }, { passive: true })
  }

  // ---------- sticky head, sideways scroll ----------
  const bar = q('.ct-headbar'), sc = q('.ct-scroll'), board = q('.ct-board')
  function syncBar() {
    if (!bar) return
    bar.scrollLeft = sc.scrollLeft
    const on = sc.scrollLeft > 1
    sc.classList.toggle('is-scrolled', on); bar.classList.toggle('is-scrolled', on)
    const top = parseFloat(getComputedStyle(bar).top) || 0
    const b = board.getBoundingClientRect()
    bar.classList.toggle('is-stuck', b.top < top - 1 && b.bottom > top + bar.offsetHeight)
    // the table scrolls by keyboard when it overflows
    const over = sc.scrollWidth > sc.clientWidth + 1
    if (over && !sc.hasAttribute('tabindex')) { sc.setAttribute('tabindex', '0'); sc.setAttribute('aria-label', 'Comparison table, scrolls sideways') }
    if (!over && sc.hasAttribute('tabindex')) { sc.removeAttribute('tabindex'); sc.removeAttribute('aria-label') }
  }
  if (sc) { sc.addEventListener('scroll', syncBar, { passive: true }); addEventListener('scroll', syncBar, { passive: true }); addEventListener('resize', syncBar); syncBar() }

  // ---------- pair view ----------
  const track = q('.ct-track'), tabs = qa('.ct-chips [role="tab"]'), phn = q('.ct-phn'), phk = q('.ct-phk'), pgt = q('.ct-pgt'), bars = qa('.ct-bars i'), live = q('.ct-live')
  let cur = 0
  const step = () => track.clientWidth + (parseFloat(getComputedStyle(track).columnGap) || 0)
  function select(i, { scroll = true, focus = false, smooth = !reduce } = {}) {
    i = Math.max(0, Math.min(tabs.length - 1, i))
    const changed = i !== cur
    cur = i
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1 })
    const a = data.alts[i]
    phn.textContent = a.name; phk.textContent = a.kind
    pgt.textContent = `${i + 1} of ${tabs.length} · ${i === tabs.length - 1 ? 'swipe back for the others' : 'swipe for the next'}`
    bars.forEach((b, k) => b.classList.toggle('on', k === i))
    if (scroll) track.scrollTo({ left: i * step(), behavior: smooth ? 'smooth' : 'auto' })
    if (focus) tabs[i].focus()
    if (changed && !recording) live.textContent = `Comparing ${data.alts[0] && root.querySelector('.ct-phead .is-us span').textContent} with ${a.name}`
    const chips = q('.ct-chips'), tb = tabs[i]
    if (tb.offsetLeft < chips.scrollLeft || tb.offsetLeft + tb.offsetWidth > chips.scrollLeft + chips.clientWidth) chips.scrollLeft = tb.offsetLeft - 16
  }
  API.select = select
  if (track) {
    tabs.forEach((t, i) => t.addEventListener('click', () => select(i)))
    q('.ct-chips').addEventListener('keydown', (e) => {
      const k = { ArrowRight: 1, ArrowLeft: -1, Home: -99, End: 99 }[e.key]
      if (k === undefined) return
      e.preventDefault(); select(k === -99 ? 0 : k === 99 ? tabs.length - 1 : cur + k, { focus: true })
    })
    let t
    track.addEventListener('scroll', () => {
      if (recording || !narrow() || step() <= 0) return
      clearTimeout(t)
      t = setTimeout(() => { const i = Math.round(track.scrollLeft / step()); if (i !== cur) select(i, { scroll: false }) }, 60)
    }, { passive: true })
  }

  // ---------- the recorded tour ----------
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
  const docTop = (el) => el.getBoundingClientRect().top + scrollY
  function tour() {
    const phone = narrow()
    const ev = [] // { t0, t1, kind, ... }
    const holds = []
    let t = 0, y = 0, x = 0
    const maxY = () => document.documentElement.scrollHeight - innerHeight
    const scrollTo = (to, dur = 1.0) => { to = Math.max(0, Math.min(maxY(), to)); if (Math.abs(to - y) < 2) return; ev.push({ kind: 'scroll', t0: t, t1: t + dur, from: y, to }); t += dur; y = to }
    const hold = (name, dur) => { holds.push([name, t, t + dur]); t += dur }
    const headH = phone ? q('.ct-phead').offsetHeight : bar.offsetHeight
    const under = (el) => docTop(el) - headH - 18
    const popAt = (m, dur) => { ev.push({ kind: 'pop', t0: t, t1: t + 0.16, m }); t += 0.16; hold('source', dur); ev.push({ kind: 'unpop', t0: t, t1: t + 0.16, m }); t += 0.16 }
    // the first claim about an alternative that comes from the seller's own study: the one a buyer should check
    const ownMark = (scope, g) => {
      const own = new Set(data.sources.filter((s) => s.kind === 'own' && !s.estimate).map((s) => s.n))
      const marks = qa('.ct-c.is-alt .ct-m', scope).filter((m) => g === undefined || m.closest('[data-g]').dataset.g === g)
      return marks.find((m) => own.has(Number(m.dataset.s))) ?? marks[0]
    }
    if (!phone) {
      t = 0.2; hold('top', 1.6)
      scrollTo(under(q('.ct-gh[data-g="0"]')), 1.1); hold('table', 1.4)
      popAt(ownMark(q('.ct-body'), '0'), 1.8)
      for (const g of groups.slice(1)) { scrollTo(under(q(`.ct-gh[data-g="${g}"]`)), 1.1); hold(`group-${g}`, 1.7) }
      scrollTo(under(q('.ct-pkh')), 1.1); hold('picks', 1.6)
      scrollTo(docTop(q('.ct-sources')) - innerHeight * 0.45, 1.1); hold('sources', 1.6)
    } else {
      t = 0.2; hold('top', 1.4)
      scrollTo(docTop(q('.ct-pw')) - 12, 1.0); hold('pair', 1.5)
      ev.push({ kind: 'swipe', t0: t, t1: t + 0.6, from: 0, to: 1 }); t += 0.6; x = 1; hold('swiped', 1.5)
      const pane = qa('.ct-pane')[1]
      const m = ownMark(pane)
      const mTop = docTop(m)
      if (mTop - y > innerHeight * 0.55) { scrollTo(mTop - innerHeight * 0.3, 0.9); hold('row', 0.6) }
      popAt(m, 1.8)
      const g1 = qa('.ct-pg[data-g="1"]', pane)[0]
      if (g1) { scrollTo(under(g1), 1.0); hold('group-1', 1.5) }
      ev.push({ kind: 'swipe', t0: t, t1: t + 0.6, from: 1, to: Math.min(2, tabs.length - 1) }); t += 0.6; hold('swiped-2', 1.5)
    }
    const length = Math.round(t * 100) / 100
    // a group draws when it is 60% up the screen, as it would when scrolled to
    const yAt = (tt) => { let v = 0; for (const e of ev) if (e.kind === 'scroll') { if (tt >= e.t1) v = e.to; else if (tt > e.t0) v = e.from + (e.to - e.from) * ease((tt - e.t0) / (e.t1 - e.t0)) } return v }
    const drawAt = {}
    for (const g of groups) {
      const head = phone ? qa(`.ct-pg[data-g="${g}"]`)[0] : q(`.ct-gh[data-g="${g}"]`)
      const top = docTop(head)
      for (let tt = 0; tt <= length; tt += 0.02) if (top < yAt(tt) + innerHeight * 0.6) { drawAt[g] = Math.max(0.2, Math.round(tt * 100) / 100); break }
    }
    const rowsIn = (g) => qa(`.ct-r[data-g="${g}"]`).length
    for (const [g, at] of Object.entries(drawAt)) ev.push({ kind: 'draw', g, t0: at, t1: at + 0.42 + (rowsIn(g) - 1) * 0.06 + 0.14 })
    // settled: what no event covers, inside the holds
    const busy = ev.map((e) => [e.t0, e.t1]).sort((a, b) => a[0] - b[0])
    const settled = []
    let from = 0
    for (const [a, b] of busy) { if (a - from > 0.3) settled.push([r2(from + 0.05), r2(a - 0.05)]); from = Math.max(from, b) }
    if (length - from > 0.3) settled.push([r2(from + 0.05), r2(length)])
    const moments = holds.map(([n, a, b]) => {
      const s = settled.map(([c, d]) => [Math.max(a, c), Math.min(b, d)]).filter(([c, d]) => d - c > 0.25).sort((u, v) => (v[1] - v[0]) - (u[1] - u[0]))[0]
      return s ? [n, r2(s[0]), r2(s[1])] : null
    }).filter(Boolean)
    return { ev, length, settled, moments, drawAt }
  }
  const r2 = (v) => Math.round(v * 100) / 100

  function seek(time) {
    const T = API._tour
    let y = 0
    for (const e of T.ev) if (e.kind === 'scroll') { if (time >= e.t1) y = e.to; else if (time > e.t0) y = e.from + (e.to - e.from) * ease((time - e.t0) / (e.t1 - e.t0)) }
    scrollTo(0, Math.round(y))
    let x = 0
    for (const e of T.ev) if (e.kind === 'swipe') { if (time >= e.t1) x = e.to; else if (time > e.t0) x = e.from + (e.to - e.from) * ease((time - e.t0) / (e.t1 - e.t0)) }
    if (track && narrow()) {
      track.scrollLeft = Math.round(x * step())
      const i = Math.round(x); if (i !== cur) select(i, { scroll: false })
    }
    for (const g of groups) {
      const at = T.drawAt[g]
      const rows = groupRows(g), per = qa(`.ct-r[data-g="${g}"]`).length
      rows.forEach((r, i) => {
        const p = at === undefined ? 0 : Math.max(0, Math.min(1, (time - at - (i % per) * 0.06) / 0.42))
        r.style.setProperty('--draw', String(1 - Math.pow(1 - p, 3)))
        r.classList.toggle('ct-on', p >= 1)
      })
    }
    let popEv = null
    for (const e of T.ev) if ((e.kind === 'pop' || e.kind === 'unpop') && time >= e.t0) popEv = e
    if (popEv && (popEv.kind === 'pop' || time < popEv.t1)) {
      if (openMark !== popEv.m) open(popEv.m)
      else place(popEv.m)
      const k = Math.min(1, (time - popEv.t0) / (popEv.t1 - popEv.t0)), o = popEv.kind === 'pop' ? k : 1 - k
      pop.style.opacity = String(o); pop.style.transform = `translateY(${(1 - o) * 4}px)`
    } else if (openMark) { close({ restore: false }); pop.style.opacity = ''; pop.style.transform = '' }
    syncBar()
    return true
  }

  API.ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => {
    if (recording) {
      const T = (API._tour = tour())
      API.length = T.length; API.settled = T.settled; API.moments = T.moments
      API.seek = seek
      seek(0)
    } else {
      // settled once every draw that has started has finished
      API.settled = []
    }
    syncBar()
    API.isReady = true
    return true
  })
})()
