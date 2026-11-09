/* Spec Sheet Kit runtime. Inlined into every build after core.js.
 * - redraws the drawing and the schedule when the model, units or compare mode change
 * - links lines and parts both ways (hover, keyboard focus, click or tap)
 * - draws the dimension lines in once, when the sheet first comes into view;
 *   after a change only the dimensions whose figure changed draw again
 * - on a phone: one view at a time, and a tapped line jumps to its view
 * - ?ss-record=1: a fixed tour stepped by the recorder (window.SpecSheet.seek),
 *   reporting the stretches where nothing moves */
;(function () {
  'use strict'
  var C = window.SpecSheetCore
  var root = document.querySelector('.ss')
  if (!root || !C) return
  var spec = JSON.parse(root.querySelector('.ss-data').textContent)
  var Q = new URLSearchParams(location.search)
  var REC = Q.get('ss-record') === '1'
  var reduce = matchMedia('(prefers-reduced-motion: reduce)')
  var phoneQ = matchMedia('(max-width: 900px)')
  var st = { model: spec.start.model, compare: !!spec.start.compare, len: spec.units.length.primary, mass: spec.units.mass.primary, view: null, sel: null }
  var $ = function (s, el) { return (el || root).querySelector(s) }
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)) }
  var sdw = $('.ss-sdw'), pdw = $('.ss-pdw'), sched = $('.ss-sched'), live = $('.ss-live'), left = $('.ss-left')
  if (REC) root.classList.add('ss-rec')

  /* ---------- the dimension clock ---------- */
  var clockNow = function () { return REC ? recT * 1000 : performance.now() }
  var recT = 0
  var started = null   // when the first draw-in started (ms on the clock), null = not yet
  var drawCount = 0
  var starts = {}      // dim key -> start ms
  var figs = {}        // dim key -> figure last drawn
  var raf = 0
  function bez(x1, y1, x2, y2) {
    return function (t) {
      if (t <= 0) return 0
      if (t >= 1) return 1
      var lo = 0, hi = 1, u = t
      for (var i = 0; i < 24; i++) { u = (lo + hi) / 2; var x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u; if (x < t) lo = u; else hi = u }
      return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u
    }
  }
  var ease = bez(0.6, 0, 0.2, 1)
  var cl = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x }
  var CROP_BELOW = 740
  var DUR = 860 // extension 260, line 420 from +200, arrows from +600, figure 220 from +640
  function paintDims() {
    var now = clockNow(), busy = false
    $$('.ss-dim', sdw).forEach(function (g) {
      var s = starts[g.getAttribute('data-dim')]
      var e = s === undefined ? -1 : now - s
      if (reduce.matches && s !== undefined) e = 1e9
      if (e < DUR && s !== undefined) busy = true
      var ext = ease(cl(e / 260)), dl = ease(cl((e - 200) / 420)), ar = cl((e - 600) / 120), fg = cl((e - 640) / 220)
      if (s === undefined) { ext = dl = ar = fg = 0 }
      $$('.ss-ext', g).forEach(function (p) { p.style.strokeDasharray = '1'; p.style.strokeDashoffset = String(1 - ext) })
      $$('.ss-dl', g).forEach(function (p) { p.style.strokeDasharray = '1'; p.style.strokeDashoffset = String(1 - dl) })
      $$('.ss-arr', g).forEach(function (p) { p.style.opacity = String(ar) })
      $$('.ss-fig', g).forEach(function (p) { p.style.opacity = String(fg) })
    })
    root.classList.remove('ss-armed')
    if (busy && !REC) { cancelAnimationFrame(raf); raf = requestAnimationFrame(paintDims) }
  }
  /** After a render: dimensions whose figure changed draw again, the rest stay drawn. */
  function restartChanged(now) {
    if (started === null) return
    var j = 0
    $$('.ss-dim', sdw).forEach(function (g) {
      var k = g.getAttribute('data-dim'), f = g.getAttribute('data-fig')
      if (figs[k] !== f) { if (figs[k] !== undefined || starts[k] === undefined) starts[k] = now + 90 * j++; figs[k] = f }
    })
  }
  function startDraw(now) {
    if (started !== null) return
    started = now; drawCount++
    $$('.ss-dim', sdw).forEach(function (g, i) { starts[g.getAttribute('data-dim')] = now + 90 * i; figs[g.getAttribute('data-dim')] = g.getAttribute('data-fig') })
    paintDims()
  }

  /* ---------- render ---------- */
  function sheetPx() {
    var r = $('.ss-sheet').getBoundingClientRect()
    return r.width || 780
  }
  function render() {
    var phone = phoneQ.matches
    // the whole sheet needs 740 px to hold 12 px labels; narrower, it shows one view at a time
    root.classList.remove('ss-crop')
    var crop = sheetPx() < CROP_BELOW
    root.classList.toggle('ss-crop', crop)
    var o
    if (crop) {
      if (!st.view) st.view = spec.drawing.views[Math.min(1, spec.drawing.views.length - 1)].id
      var v = spec.drawing.views.filter(function (x) { return x.id === st.view })[0], cw = v.crop[2] - v.crop[0], ch = v.crop[3] - v.crop[1]
      var w = sheetPx(), ppu = Math.min(w / cw, (phone ? 270 : 440) / ch)
      o = { k: 1 / ppu, only: st.view }
    } else o = { k: 420 / sheetPx() }
    var out = C.svg(spec, st, o)
    sdw.setAttribute('viewBox', out.viewBox); sdw.setAttribute('style', out.style); sdw.innerHTML = out.body
    var pr = C.svg(spec, st, { print: 172 / 420 })
    pdw.setAttribute('viewBox', pr.viewBox); pdw.setAttribute('style', pr.style); pdw.innerHTML = pr.body
    sched.innerHTML = C.schedule(spec, st)
    $$('[data-model]').forEach(function (b) { b.setAttribute('aria-pressed', String(!st.compare && st.model === b.getAttribute('data-model'))) })
    $$('[data-compare]').forEach(function (b) { b.setAttribute('aria-pressed', String(st.compare)) })
    $$('[data-len]').forEach(function (b) { b.setAttribute('aria-pressed', String(st.len === b.getAttribute('data-len'))) })
    $$('[data-mass]').forEach(function (b) { b.setAttribute('aria-pressed', String(st.mass === b.getAttribute('data-mass'))) })
    $$('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(st.view === b.getAttribute('data-view'))) })
    var m = st.compare ? spec.models.map(function (x) { return x.name }).join(', ') : spec.models.filter(function (x) { return x.id === st.model })[0].name
    sdw.setAttribute('aria-label', 'Drawing of ' + m + (st.compare ? ', compared' : '') + ', with numbered parts and dimensions in ' + (st.len === 'in' ? 'inches' : 'millimetres'))
    var pi = $('.ss-printinfo'); if (pi) pi.textContent = spec.brand + ' · ' + spec.drawing.number + ' rev ' + spec.drawing.rev + ' · ' + (st.len === 'in' ? 'inches' : 'mm') + ', ' + (st.mass === 'lb' ? 'lb' : 'kg')
    bindDrawing()
    restartChanged(clockNow())
    paintDims()
    applySel()
    if (!phone && left) left.style.setProperty('--stick', Math.min(24, innerHeight - left.offsetHeight - 16) + 'px')
  }

  /* ---------- selection, both ways ---------- */
  var hover = null
  function lit(sel) {
    if (!sel) return { parts: [], dims: [], rows: [] }
    if (sel.row) { var r = C.row(spec, sel.row), l = C.links(spec, r); return { parts: l.parts, dims: l.dims, rows: [sel.row] } }
    return { parts: [sel.part], dims: [], rows: C.rows(spec).filter(function (r) { return (r.parts || []).indexOf(sel.part) >= 0 }).map(function (r) { return r.key }) }
  }
  function applySel() {
    var s = lit(hover || st.sel)
    $$('.on').forEach(function (n) { n.classList.remove('on') })
    var any = s.parts.length || s.dims.length
    sdw.classList.toggle('ss-hl', !!any)
    s.parts.forEach(function (p) { $$('[data-part="' + p + '"]', sdw).forEach(function (n) { n.classList.add('on') }) })
    s.dims.forEach(function (d) { $$('[data-dim="' + d + '"]', sdw).forEach(function (n) { n.classList.add('on') }) })
    s.rows.forEach(function (k) { $$('.ss-r[data-k="' + k + '"]').forEach(function (n) { n.classList.add('on') }) })
  }
  function select(sel, pin) {
    if (pin) {
      st.sel = sel && st.sel && JSON.stringify(sel) === JSON.stringify(st.sel) ? null : sel
      if (st.sel && root.classList.contains('ss-crop')) {
        var v = st.sel.row ? C.viewForRow(spec, st.sel.row, st.compare ? spec.drawn : st.model) : firstViewWith(st.sel.part)
        if (v && v !== st.view) { st.view = v; render(); return }
      }
    } else hover = sel
    applySel()
  }
  function firstViewWith(part) {
    var m = st.compare ? spec.drawn : st.model
    var vs = spec.drawing.views.map(function (v) { return C.view(spec, v, m) }).filter(function (v) { return v.shapes.some(function (s) { return s.part === part }) })
    return vs.length ? vs[0].id : null
  }
  function bindDrawing() {
    $$('[data-part]', sdw).forEach(function (n) {
      n.addEventListener('pointerenter', function () { select({ part: n.getAttribute('data-part') }) })
      n.addEventListener('pointerleave', function () { select(null) })
      n.addEventListener('click', function () { select({ part: n.getAttribute('data-part') }, true) })
    })
  }
  sched.addEventListener('pointerover', function (e) { var r = e.target.closest && e.target.closest('.ss-link'); if (r && e.pointerType !== 'touch') select({ row: r.getAttribute('data-k') }) })
  sched.addEventListener('pointerleave', function () { select(null) })
  sched.addEventListener('focusin', function (e) { var r = e.target.closest('.ss-link'); if (r) select({ row: r.getAttribute('data-k') }) })
  sched.addEventListener('focusout', function () { select(null) })
  sched.addEventListener('click', function (e) { var r = e.target.closest('.ss-link'); if (r) select({ row: r.getAttribute('data-k') }, true) })
  sched.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('ss-link')) { e.preventDefault(); select({ row: e.target.getAttribute('data-k') }, true) } })

  /* ---------- controls ---------- */
  function say(t) { if (live) live.textContent = t }
  function set(ch, quiet) {
    for (var k in ch) st[k] = ch[k]
    render()
    if (!quiet) say(ch.len ? 'Lengths in ' + (st.len === 'in' ? 'inches' : 'millimetres') : ch.mass ? 'Weights in ' + (st.mass === 'lb' ? 'pounds' : 'kilograms') : ch.compare !== undefined ? (st.compare ? 'Comparing ' + spec.models.length + ' models' : 'Showing ' + st.model) : ch.model ? 'Showing ' + st.model : '')
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return
    if (b.hasAttribute('data-model')) set({ model: b.getAttribute('data-model'), compare: false })
    else if (b.hasAttribute('data-compare')) set({ compare: !st.compare })
    else if (b.hasAttribute('data-len')) set({ len: b.getAttribute('data-len') })
    else if (b.hasAttribute('data-mass')) set({ mass: b.getAttribute('data-mass') })
    else if (b.hasAttribute('data-view')) { st.view = b.getAttribute('data-view'); render() }
    else if (b.hasAttribute('data-print')) window.print()
  })
  var lastW = innerWidth
  addEventListener('resize', function () { if (innerWidth !== lastW) { lastW = innerWidth; render() } })
  phoneQ.addEventListener && phoneQ.addEventListener('change', function () { render() })

  /* ---------- first arrival: the draw-in, once ---------- */
  render()
  if (!REC) {
    if (reduce.matches) startDraw(clockNow())
    else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) { startDraw(clockNow()); io.disconnect() } })
      }, { threshold: 0.35 })
      io.observe($('.ss-sheet'))
    } else startDraw(clockNow())
  }

  /* ---------- recording: a fixed tour, stepped frame by frame ---------- */
  var api = { ready: null, state: st, get drawCount() { return drawCount }, get drawn() { return started !== null }, set: function (ch) { set(ch, true) }, select: function (k) { select(k ? { row: k } : null, true) } }
  window.SpecSheet = api
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
  api.ready = fontsReady.then(function () { render(); if (REC) buildTour() })

  var tour = null, cursor = null
  function buildTour() {
    cursor = document.createElement('div')
    cursor.className = 'ss-cursor'
    cursor.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true"><path d="M3 2l14 8.5-6.2 1.3L8 18z" fill="' + getComputedStyle(root).getPropertyValue('--ink') + '" stroke="' + getComputedStyle(root).getPropertyValue('--paper') + '" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    document.body.appendChild(cursor)
    var phone = phoneQ.matches, cropped = root.classList.contains('ss-crop')
    var base = { model: st.model, compare: st.compare, len: st.len, mass: st.mass, view: st.view, sel: null }
    var steps = spec.tour || []
    var segs = [], t = 0.5, nd = spec.drawing.dims.length
    var drawAt = t, drawEnd = drawAt + ((nd - 1) * 90 + DUR) / 1000
    var cur = { x: innerWidth * 0.62, y: innerHeight * 0.9 }, scroll = 0
    // a phone first scrolls down to the drawing, pinned over the schedule
    var s0 = JSON.parse(JSON.stringify(base))
    var stickTop = function () { var f = $('.ss-fig-wrap'); return phone && f ? f.getBoundingClientRect().height : 0 }
    var maxScroll = function () { return document.documentElement.scrollHeight - innerHeight }
    var restore = function (s) { for (var k in s) st[k] = s[k]; render() }
    restore(s0)
    var settled = [], holds = []
    var docRect = function (el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + scrollY + r.height / 2, top: r.top + scrollY, bottom: r.bottom + scrollY } }
    var scrollFor = function (rect) {
      var top = stickTop() + 24, bottom = innerHeight - 24
      if (rect.top - scroll >= top && rect.bottom - scroll <= bottom) return scroll
      return Math.max(0, Math.min(maxScroll(), rect.y - (top + bottom) / 2))
    }
    if (phone) {
      var fig = $('.ss-fig-wrap').getBoundingClientRect().top + scrollY
      var sc = Math.min(maxScroll(), fig)
      segs.push({ t0: drawEnd + 0.6, t1: drawEnd + 1.3, s: s0, from: cur, to: cur, sf: 0, stt: sc, cursor: false })
      settled.push([drawEnd + 0.1, drawEnd + 0.55])
      scroll = sc; t = drawEnd + 1.3
      // the draw-in happens when the sheet arrives, as on the real page
      drawAt = drawEnd + 0.9; drawEnd = drawAt + ((nd - 1) * 90 + DUR) / 1000
      settled[0] = [0.1, 0.45]
      t = drawEnd + 0.3
    } else t = drawEnd
    var restAt = [t + 0.1, t + 0.9]
    settled.push(restAt); holds.push((restAt[0] + restAt[1]) / 2)
    t += 1.0
    var state = s0, dimStarts = {}
    spec.drawing.dims.forEach(function (d, i) { dimStarts[d.row] = drawAt * 1000 + 90 * i })
    var timeline = [{ at: 0, state: s0, starts: Object.assign({}, dimStarts) }]
    steps.forEach(function (step) {
      var next = JSON.parse(JSON.stringify(state)), target
      restore(state)
      if (step.row) {
        next.sel = { row: step.row }
        if (cropped) next.view = C.viewForRow(spec, step.row, next.compare ? spec.drawn : next.model) || next.view
        var el = $('.ss-r[data-k="' + step.row + '"]'); target = docRect(el.querySelector('.ss-mk'))
        target.x += 14; target.y += 6
      } else if (step.part) {
        next.sel = { part: step.part }
        if (cropped) { next.view = firstViewWith(step.part) || next.view; restore(next) }
        var parts = $$('.ss-part[data-part="' + step.part + '"]', sdw).filter(function (p) { return !p.classList.contains('ss-open') })
        var big = parts.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return rb.width * rb.height - ra.width * ra.height })[0]
        target = docRect(big)
        restore(state)
      } else {
        var k = Object.keys(step.set)[0], v = step.set[k]
        var btn = k === 'compare' ? (v ? $('[data-compare]') : $('[data-model="' + (step.set.model || st.model) + '"]')) : $('[data-' + k + '="' + v + '"]')
        target = docRect(btn)
        // aim at the button's lower right corner, so the pointer never hides its label
        var br = btn.getBoundingClientRect(); target.x = br.right - 4; target.y = br.bottom + scrollY - 6
        for (var kk in step.set) next[kk] = step.set[kk]
        if (step.set.compare === false || step.set.model) next.compare = step.set.compare === undefined ? false : step.set.compare
        next.sel = null
      }
      var sTo = scrollFor(target)
      var move = 0.6
      segs.push({ t0: t, t1: t + move, s: state, from: { x: cur.x, y: cur.y + scroll }, to: { x: target.x, y: target.y }, sf: scroll, stt: sTo, cursor: true })
      t += move
      scroll = sTo; cur = { x: target.x, y: target.y - scroll }
      // the change lands on arrival; changed dimensions draw again
      var before = {}, after = {}
      spec.drawing.dims.forEach(function (d) { before[d.row] = C.dimFig(spec, d, state); after[d.row] = C.dimFig(spec, d, next) })
      var j = 0, redraw = 0
      spec.drawing.dims.forEach(function (d) { if (before[d.row] !== after[d.row]) { dimStarts[d.row] = t * 1000 + 90 * j++; redraw = (j - 1) * 0.09 + DUR / 1000 } })
      timeline.push({ at: t, state: next, starts: Object.assign({}, dimStarts) })
      var hold = 1.3 + redraw
      settled.push([t + redraw + 0.1, t + hold - 0.05])
      holds.push(t + redraw + (hold - redraw) / 2)
      segs.push({ t0: t, t1: t + hold, s: next, from: { x: target.x, y: target.y }, to: { x: target.x, y: target.y }, sf: sTo, stt: sTo, cursor: true })
      t += hold
      state = next
    })
    restore(s0)
    tour = { segs: segs, timeline: timeline, length: Math.round((t + 0.3) * 30) / 30, settled: settled, holds: holds, drawAt: drawAt, phone: phone }
    api.length = tour.length
    api.settled = settled.map(function (x) { return [Math.round(x[0] * 100) / 100, Math.round(x[1] * 100) / 100] })
    api.moments = { rest: Math.round(holds[0] * 100) / 100, steps: holds.slice(1).map(function (h) { return Math.round(h * 100) / 100 }) }
  }
  var lastKey = ''
  api.seek = function (sec) {
    if (!tour) return
    recT = sec
    var tl = tour.timeline.filter(function (x) { return x.at <= sec + 1e-6 }).pop()
    var key = JSON.stringify(tl.state)
    if (key !== lastKey) { for (var k in tl.state) st[k] = tl.state[k]; render(); lastKey = key }
    starts = Object.assign({}, tl.starts)
    if (sec >= tour.drawAt) { started = tour.drawAt * 1000; drawCount = 1 } else started = null
    var seg = tour.segs.filter(function (s) { return sec >= s.t0 && sec <= s.t1 })[0]
    var sY = 0, show = false, x = 0, y = 0
    if (seg) {
      var p = ease(cl((sec - seg.t0) / Math.min(0.6, seg.t1 - seg.t0)))
      sY = seg.sf + (seg.stt - seg.sf) * p
      x = seg.from.x + (seg.to.x - seg.from.x) * p; y = seg.from.y + (seg.to.y - seg.from.y) * p - sY
      show = seg.cursor
    } else {
      var prev = tour.segs.filter(function (s) { return s.t1 <= sec }).pop()
      sY = prev ? prev.stt : 0
    }
    window.scrollTo(0, sY)
    cursor.style.display = show && !tour.phone ? 'block' : 'none'
    cursor.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 2) + 'px)'
    hover = null
    paintDims()
    applySel()
  }
})()
