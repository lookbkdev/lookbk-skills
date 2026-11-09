/* Work Index runtime, inlined into every built index page.
   One plate per row: it hangs from the row under the pointer (or stands on
   it when there is no room below), follows the pointer on a spring, never
   covers the row being read, and riffles to the next picture when the row
   changes. Index/Grid and the filter move with FLIP. On phones the row's
   thumbnail opens the plate inline. Every motion is computed from one clock,
   so a recording (?wi-record=1) is the same frame for frame on any machine. */
(function () {
  'use strict'
  var root = document.querySelector('.wi')
  var idx = document.querySelector('.wi-idx')
  if (!root || !idx) return
  var DATA = JSON.parse(document.getElementById('wi-data').textContent)
  var Q = new URLSearchParams(location.search)
  var RECORD = Q.has('wi-record')
  var RM = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (RECORD) root.classList.add('is-record')

  /* ---------- easing ---------- */
  function bezier(x1, y1, x2, y2) {
    function a(p, q) { return 1 - 3 * q + 3 * p }
    function b(p, q) { return 3 * q - 6 * p }
    function c(p) { return 3 * p }
    function f(t, p, q) { return ((a(p, q) * t + b(p, q)) * t + c(p)) * t }
    function d(t, p, q) { return 3 * a(p, q) * t * t + 2 * b(p, q) * t + c(p) }
    return function (x) {
      if (x <= 0) return 0
      if (x >= 1) return 1
      var t = x
      for (var i = 0; i < 8; i++) { var s = d(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (f(t, x1, x2) - x) / s }
      return f(Math.min(1, Math.max(0, t)), y1, y2)
    }
  }
  var E_REVEAL = bezier(0.16, 1, 0.3, 1), E_OUT = bezier(0.2, 0.8, 0.2, 1), E_FLIP = bezier(0.7, 0, 0.2, 1)
  function E_IN(x) { return x * x }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }
  function prog(t, t0, dur) { return dur <= 0 ? 1 : clamp((t - t0) / dur, 0, 1) }

  /* ---------- state ---------- */
  var rows = [].slice.call(idx.querySelectorAll('.wi-row'))
  var plate = document.querySelector('.wi-plate')
  var frame = plate.querySelector('.wi-frame')
  var pcap = plate.querySelector('.wi-pcap')
  var cursor = document.querySelector('.wi-cursor')
  var desk = matchMedia('(min-width: 761px)')
  var now = 0
  var P = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, rot: 0, row: null, px: 0, side: 'below', shown: false, rev: 0, t0: -9, hideT0: -9, w: 300, h: 200, s: 1, layers: [] }
  var cells = rows.map(function (r) { return [].slice.call(r.querySelectorAll('.wi-no, .wi-ti, .wi-cl, .wi-ds, .wi-oc, .wi-yr, .wi-chip')) })
  var cellOp = new Map(), rowOp = rows.map(function () { return 1 })
  var flips = [], scrollAnim = null, inl = null

  function pad(n) { return (n < 10 ? '0' : '') + n }
  function contentBox() { var m = document.querySelector('main.wi-wrap'); var r = m.getBoundingClientRect(); var p = parseFloat(getComputedStyle(m).paddingLeft); return { l: r.left + p, r: r.right - p } }

  /* ---------- the plate ---------- */
  function sizeFor(i) {
    var it = DATA.items[i], land = it.w >= it.h
    var w = land ? DATA.plate.land : DATA.plate.port
    return [w, Math.round(w * it.h / it.w)]
  }
  function media(i, sizes) {
    var it = DATA.items[i]
    if (it.loop) {
      var v = document.createElement('video')
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '')
      v.poster = it.poster; v.src = it.loop
      if (!RECORD && !RM) v.autoplay = true
      return v
    }
    var img = new Image()
    img.alt = ''
    img.decoding = 'async'
    img.sizes = sizes
    img.srcset = it.srcset
    img.src = it.src
    return img
  }
  function textUnder(rect) {
    // how much row text a plate at `rect` would sit over (titles count double)
    var sum = 0
    rows.forEach(function (r, i) {
      if (r.hidden || r === P.row) return
      cells[i].forEach(function (c) {
        if (c.classList.contains('wi-chip')) return
        var b = c.getBoundingClientRect()
        var ix = Math.max(0, Math.min(rect.r, b.right) - Math.max(rect.l, b.left))
        var iy = Math.max(0, Math.min(rect.b, b.bottom) - Math.max(rect.t, b.top))
        sum += ix * iy * (c.classList.contains('wi-ti') ? 2 : 1)
      })
    })
    return sum
  }
  function place(decide) {
    var row = P.row
    if (!row) return
    var r = row.getBoundingClientRect(), cb = contentBox()
    if (decide) { pcap.style.width = P.w + 'px'; frame.style.width = P.w + 'px' }
    var capH = pcap.offsetHeight || 30, gap = 14
    var H = P.h + capH
    var below = innerHeight - 12 - (r.bottom + gap), above = (r.top - gap) - 12
    var x = clamp(P.px + 28, cb.l, cb.r - P.w)
    if (decide) {
      // it may stand on the row only inside the list, never over the statement or the controls
      var listTop = idx.getBoundingClientRect().top
      var fitB = below >= H, fitA = above >= H && r.top - gap - H >= Math.max(12, listTop)
      var side
      if (fitB && fitA) {
        var rb = { l: x, r: x + P.w, t: r.bottom + gap, b: r.bottom + gap + H }
        var ra = { l: x, r: x + P.w, t: r.top - gap - H, b: r.top - gap }
        side = textUnder(ra) < textUnder(rb) * 0.85 ? 'above' : 'below'
      } else if (fitB) side = 'below'
      else if (fitA) side = 'above'
      else side = below >= Math.min(above, r.top - gap - Math.max(12, listTop)) ? 'below' : 'above'
      P.side = side
      var room = side === 'below' ? below : Math.min(above, r.top - gap - Math.max(12, listTop))
      P.s = clamp((room - capH) / P.h, 0.3, 1)
      // a scaled plate keeps its caption on one line (the full text is in its title)
      pcap.classList.toggle('is-tight', P.s < 1)
      row.classList.toggle('is-below', side === 'below')
      row.classList.toggle('is-above', side === 'above')
      plate.classList.toggle('is-up', side === 'above')
      frame.style.width = P.w * P.s + 'px'; frame.style.height = P.h * P.s + 'px'
      pcap.style.width = P.w * P.s + 'px'
      // a narrower caption may wrap onto another line: fit again with its real height
      for (var it = 0; it < 4 && P.s < 1; it++) {
        var capH2 = pcap.offsetHeight
        if (P.h * P.s + capH2 <= room + 0.5) break
        P.s = clamp((room - capH2) / P.h, 0.3, 1)
        frame.style.width = P.w * P.s + 'px'; frame.style.height = P.h * P.s + 'px'; pcap.style.width = P.w * P.s + 'px'
      }
      capH = pcap.offsetHeight
    }
    var Hs = P.h * P.s + capH
    P.tx = clamp(P.px + 28, cb.l, cb.r - P.w * P.s)
    P.ty = P.side === 'below' ? r.bottom + gap : r.top - gap - Hs
  }
  function setRow(row, px) {
    var i = +row.dataset.i, it = DATA.items[i]
    var prev = P.row ? +P.row.dataset.i : null
    rows.forEach(function (r) { if (r !== row) r.classList.remove('is-on', 'is-below', 'is-above') })
    row.classList.add('is-on')
    P.row = row; P.px = px
    var wh = sizeFor(i); P.w = wh[0]; P.h = wh[1]
    pcap.innerHTML = '<span>Pl. ' + pad(i + 1) + '</span><span></span><span>' + it.year + '</span>'
    pcap.children[1].textContent = it.client
    pcap.title = 'Pl. ' + pad(i + 1) + ' · ' + it.client + ' · ' + it.year
    place(true)
    var el = document.createElement('div')
    el.appendChild(media(i, Math.round(P.w) + 'px'))
    if (it.loop) el.insertAdjacentHTML('beforeend', '<span class="wi-tag"><i></i>Loop · ' + it.seconds + ' s</span>')
    if (!P.shown) {
      frame.innerHTML = ''; frame.appendChild(el); P.layers = [{ el: el, t0: -9, dir: 0, out: false }]
      P.x = P.tx; P.y = P.ty; P.vx = P.vy = 0; P.rot = 0
      P.shown = true; P.t0 = now; P.hideT0 = -9
      plate.style.visibility = 'visible'
    } else if (prev !== i) {
      var dir = prev < i ? 1 : -1
      P.layers.forEach(function (l) { if (!l.out) { l.out = true; l.t0 = now; l.dir = dir } })
      frame.appendChild(el)
      P.layers.push({ el: el, t0: now, dir: dir, out: false })
      if (P.hideT0 > 0) { P.hideT0 = -9; P.t0 = now - 0.46 * (P.rev) }
    }
    playLoops()
  }
  function hide() {
    if (!P.shown) return
    P.shown = false; P.hideT0 = now
    rows.forEach(function (r) { r.classList.remove('is-on') })
    P.row = null
  }
  function playLoops() {
    frame.querySelectorAll('video').forEach(function (v) { if (!RECORD && !RM && v.paused) v.play().catch(function () {}) })
  }

  /* ---------- one step of the clock ---------- */
  var KX = 170, CX = 24, KY = 238, CY = 27.6
  function step(dt) {
    if (P.row && P.shown) place(false)
    if (RM) { P.x = P.tx; P.y = P.ty; P.vx = P.vy = 0; P.rot = 0 }
    else {
      P.vx += ((P.tx - P.x) * KX - P.vx * CX) * dt
      P.vy += ((P.ty - P.y) * KY - P.vy * CY) * dt
      P.x += P.vx * dt; P.y += P.vy * dt
      var target = clamp(P.vx * 0.006, -3.5, 3.5)
      P.rot += (target - P.rot) * (1 - Math.exp(-dt * 7.2))
    }
    // reveal and hide
    if (P.shown) P.rev = RM ? 1 : E_REVEAL(prog(now, P.t0, 0.46))
    else if (P.hideT0 > 0) {
      var k = RM ? 1 : prog(now, P.hideT0, 0.24)
      P.rev = Math.min(P.rev, 1 - E_IN(k))
      if (k >= 1) { P.rev = 0; P.hideT0 = -9; frame.innerHTML = ''; P.layers = []; plate.style.visibility = 'hidden'; rows.forEach(function (r) { r.classList.remove('is-below', 'is-above') }) }
    }
    // row dimming and the text the plate is over
    var pr = P.rev > 0 ? { l: P.x, r: P.x + P.w * P.s, t: P.y, b: P.y + P.h * P.s + (pcap.offsetHeight || 30) } : null
    var a = RM ? 1 : 1 - Math.exp(-dt * 14)
    rows.forEach(function (r, i) {
      var target = P.shown && P.row && r !== P.row ? DATA.dim : 1
      rowOp[i] += (target - rowOp[i]) * a
      if (Math.abs(target - rowOp[i]) < 0.002) rowOp[i] = target
      cells[i].forEach(function (c) {
        var t = 1
        if (pr && r !== P.row && !r.hidden) {
          var b = c.getBoundingClientRect()
          if (b.width && b.right > pr.l && b.left < pr.r && b.bottom > pr.t && b.top < pr.b) t = 0
        }
        var o = cellOp.has(c) ? cellOp.get(c) : 1
        o += (t - o) * a
        if (Math.abs(t - o) < 0.002) o = t
        cellOp.set(c, o)
      })
    })
  }
  function busy() {
    var spring = Math.abs(P.vx) + Math.abs(P.vy) > 3 || Math.abs(P.tx - P.x) + Math.abs(P.ty - P.y) > 0.5
    var rev = (P.shown && P.rev < 1) || P.hideT0 > 0
    var rif = P.layers.some(function (l) { return l.t0 > 0 && now - l.t0 < 0.42 })
    var dims = rows.some(function (r, i) { var t = P.shown && P.row && r !== P.row ? DATA.dim : 1; return Math.abs(rowOp[i] - t) > 0.004 })
    var under = false
    cellOp.forEach(function (o) { if (o !== 1 && o !== 0) under = true })
    var fl = flips.length > 0, sc = !!scrollAnim, il = !!(inl && inl.t0 > 0 && now - inl.t0 < inl.dur + 0.56)
    return (P.shown && spring) || rev || rif || dims || under || fl || sc || il
  }
  function draw() {
    // the plate
    if (P.rev > 0 || P.shown) {
      var c = (1 - P.rev) * 100
      plate.style.clipPath = P.side === 'below' ? 'inset(0 0 ' + c + '% 0)' : 'inset(' + c + '% 0 0 0)'
      plate.style.transform = 'translate3d(' + P.x.toFixed(2) + 'px,' + P.y.toFixed(2) + 'px,0) rotate(' + P.rot.toFixed(3) + 'deg)'
    }
    P.layers = P.layers.filter(function (l) {
      if (l.t0 < 0) { l.el.style.transform = ''; l.el.style.opacity = ''; return true }
      var e = RM ? 1 : E_OUT(prog(now, l.t0, 0.42))
      if (l.out) {
        l.el.style.transform = 'translateY(' + (-l.dir * 35 * e) + '%)'
        l.el.style.opacity = String(1 - e)
        if (e >= 1) { l.el.remove(); return false }
      } else l.el.style.transform = 'translateY(' + (l.dir * 100 * (1 - e)) + '%)'
      return true
    })
    rows.forEach(function (r, i) { r.style.opacity = rowOp[i] === 1 ? '' : rowOp[i].toFixed(3) })
    cellOp.forEach(function (o, c) { c.style.opacity = o === 1 ? '' : o.toFixed(3) })
    // FLIP
    flips = flips.filter(function (f) {
      var k = RM ? 1 : prog(now, f.t0 + f.delay, f.dur)
      var e = f.ease(k)
      if (f.fade) { f.el.style.opacity = String(e); f.el.style.transform = 'translateY(' + (12 * (1 - e)).toFixed(2) + 'px)' }
      else f.el.style.transform = 'translate(' + (f.dx * (1 - e)).toFixed(2) + 'px,' + (f.dy * (1 - e)).toFixed(2) + 'px) scale(' + (1 + (f.sx - 1) * (1 - e)).toFixed(4) + ',' + (1 + (f.sy - 1) * (1 - e)).toFixed(4) + ')'
      if (k >= 1) { f.el.style.transform = ''; f.el.style.opacity = ''; f.el.style.transformOrigin = ''; return false }
      return true
    })
    if (scrollAnim) {
      var k = RM ? 1 : prog(now, scrollAnim.t0, scrollAnim.dur)
      scrollTo(0, scrollAnim.from + (scrollAnim.to - scrollAnim.from) * E_OUT(k))
      if (k >= 1) scrollAnim = null
    }
    if (inl) drawInline()
  }

  /* ---------- Index / Grid ---------- */
  function parts() {
    var out = []
    rows.forEach(function (r, i) { if (!r.hidden) r.querySelectorAll('.wi-chip, .wi-no, .wi-ti, .wi-yr, .wi-cl').forEach(function (el) { out.push({ el: el, i: i }) }) })
    return out
  }
  function setView(v) {
    if (idx.dataset.view === v) return
    hide(); P.rev = 0; P.hideT0 = -9; frame.innerHTML = ''; P.layers = []; plate.style.visibility = 'hidden'
    var ps = parts(), first = ps.map(function (p) { p.el.style.transform = ''; return p.el.getBoundingClientRect() })
    idx.dataset.view = v
    document.querySelectorAll('.wi-views button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === v)) })
    idx.querySelectorAll('.wi-chip img').forEach(function (img) { img.sizes = v === 'grid' ? DATA.gridSizes : '64px' })
    flips = []
    if (RM) return
    var n = 0
    ps.forEach(function (p, k) {
      var l = p.el.getBoundingClientRect(), f = first[k]
      if (!l.width || !l.height) return
      var delay = (n = p.i) * 0.018
      if (!f.width || !f.height) { flips.push({ el: p.el, fade: true, t0: now, delay: 0.26 + delay, dur: 0.4, ease: E_OUT }); return }
      var chip = p.el.classList.contains('wi-chip')
      p.el.style.transformOrigin = '0 0'
      flips.push({ el: p.el, dx: f.left - l.left, dy: f.top - l.top, sx: chip ? f.width / l.width : 1, sy: chip ? f.height / l.height : 1, t0: now, delay: delay, dur: 0.64, ease: E_FLIP })
    })
    draw()
  }
  /* ---------- filter ---------- */
  function setFilter(f) {
    hide()
    var first = rows.map(function (r) { return r.hidden ? null : r.getBoundingClientRect() })
    var shown = 0
    rows.forEach(function (r) { r.hidden = !(f === '*' || r.dataset.d === f); if (!r.hidden) shown++ })
    document.querySelectorAll('.wi-filters button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.f === f)) })
    var live = document.getElementById('wi-count')
    if (live) live.textContent = shown + (shown === 1 ? ' project' : ' projects') + ' shown' + (f === '*' ? '' : ': ' + f)
    flips = []
    if (RM) return
    rows.forEach(function (r, i) {
      if (r.hidden) return
      var l = r.getBoundingClientRect(), fr = first[i]
      if (!fr) flips.push({ el: r, fade: true, t0: now, delay: 0.12, dur: 0.32, ease: E_OUT })
      else flips.push({ el: r, dx: fr.left - l.left, dy: fr.top - l.top, sx: 1, sy: 1, t0: now, delay: 0, dur: 0.52, ease: E_OUT })
    })
    draw()
  }
  /* ---------- phone: the plate inline ---------- */
  function toggleInline(row) {
    var open = !row.classList.contains('is-open')
    rows.forEach(function (r) {
      if (r !== row && r.classList.contains('is-open')) { r.classList.remove('is-open'); r.querySelector('.wi-tg').setAttribute('aria-expanded', 'false'); var b = r.querySelector('.wi-inl'); b.style.height = '0px'; b.hidden = true }
    })
    var box = row.querySelector('.wi-inl'), fig = box.querySelector('figure'), btn = row.querySelector('.wi-tg')
    if (open) {
      box.hidden = false
      var img = fig.querySelector('img'); if (img && img.loading === 'lazy') img.loading = 'eager'
      var v = fig.querySelector('video'); if (v && !RECORD && !RM) v.play().catch(function () {})
      row.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true')
      btn.querySelector('.tl span').textContent = 'Close'
    } else {
      row.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false')
      btn.querySelector('.tl span').textContent = 'Plate'
    }
    rows.forEach(function (r) { if (r !== row) { var s = r.querySelector('.wi-tg .tl span'); if (s) s.textContent = 'Plate' } })
    inl = { box: box, fig: fig, open: open, t0: now, dur: open ? 0.42 : 0.3, from: box.offsetHeight, to: open ? box.firstElementChild.offsetHeight : 0 }
    drawInline()
  }
  function drawInline() {
    var k = RM ? 1 : prog(now, inl.t0, inl.dur)
    var e = inl.open ? E_OUT(k) : E_IN(k)
    inl.box.style.height = (inl.from + (inl.to - inl.from) * e).toFixed(1) + 'px'
    var c = inl.open ? (RM ? 1 : E_REVEAL(prog(now, inl.t0 + 0.06, 0.5))) : 1
    inl.fig.style.clipPath = 'inset(0 0 ' + ((1 - c) * 100).toFixed(2) + '% 0)'
    if (k >= 1 && c >= 1) {
      if (inl.open) inl.box.style.height = 'auto'
      else inl.box.hidden = true
      inl = null
    }
  }

  /* ---------- live input ---------- */
  function hoverAt(e) {
    if (RECORD || !desk.matches || idx.dataset.view === 'grid' || e.pointerType === 'touch') return
    var row = e.target.closest && e.target.closest('.wi-row')
    P.px = e.clientX
    if (row && row !== P.row) setRow(row, e.clientX)
    else if (!row) hide()
  }
  idx.addEventListener('pointermove', hoverAt)
  idx.addEventListener('pointerleave', function () { if (!RECORD) hide() })
  idx.addEventListener('focusin', function (e) {
    if (RECORD || !desk.matches || idx.dataset.view === 'grid') return
    var row = e.target.closest('.wi-row'); if (!row || !e.target.matches('.wi-r')) return
    var b = row.getBoundingClientRect(); setRow(row, b.left + b.width * 0.56)
  })
  idx.addEventListener('focusout', function (e) { if (!RECORD && !idx.contains(e.relatedTarget)) hide() })
  addEventListener('keydown', function (e) { if (e.key === 'Escape') hide() })
  document.querySelectorAll('.wi-views button').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.v) }) })
  document.querySelectorAll('.wi-filters button').forEach(function (b) { b.addEventListener('click', function () { setFilter(b.dataset.f) }) })
  rows.forEach(function (r) { var b = r.querySelector('.wi-tg'); if (b) b.addEventListener('click', function () { toggleInline(r) }) })
  addEventListener('scroll', function () { if (!RECORD && P.shown && P.row) { var b = P.row.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) hide() } }, { passive: true })
  if (RM) document.querySelectorAll('.wi video').forEach(function (v) { v.removeAttribute('autoplay'); v.pause() })

  var last = 0
  function loop(ts) {
    if (!RECORD) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 1 / 60
      last = ts
      var n = Math.max(1, Math.round(dt * 120))
      for (var i = 0; i < n; i++) { now += dt / n; step(dt / n) }
      draw()
      requestAnimationFrame(loop)
    }
  }
  requestAnimationFrame(loop)

  /* ---------- recording: a fixed script, stepped by the recorder ---------- */
  var script = null, simT = 0, label = 'index', ptr = { x: -60, y: 300, vis: false, click: -9 }
  function center(el) { var b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] }
  function rowY(i) { var b = rows[i].getBoundingClientRect(); return b.top + b.height / 2 }
  function hoverX(i) { var oc = rows[i].querySelector('.wi-oc').getBoundingClientRect(); return oc.left - 30 }
  function buildScript() {
    var pv = DATA.preview, a = pv.hover[0], b = pv.hover[1]
    if (desk.matches) {
      var vbtn = document.querySelector('.wi-views [data-v="grid"]'), ibtn = document.querySelector('.wi-views [data-v="index"]')
      var fbtn = document.querySelector('.wi-filters [data-f="' + CSS.escape(pv.filter) + '"]'), all = document.querySelector('.wi-filters [data-f="*"]')
      return [
        { t: 0, label: 'index' },
        { t: 1.0, scroll: function () {
          // scroll only if the first row's plate would not fit under it; then park the controls at the top (a clean edge, no sliced headline)
          var wh = sizeFor(a), rb = rows[a].getBoundingClientRect()
          if (rb.bottom + 14 + wh[1] + 44 <= innerHeight - 12) return scrollY
          return document.querySelector('.wi-ctrl').getBoundingClientRect().top + scrollY - 24
        }, dur: 0.9, label: 'list' },
        { t: 2.0, move: function () { return [innerWidth - 24, rowY(a)] }, dur: 0.01, show: true },
        { t: 2.05, move: function () { return [hoverX(a), rowY(a)] }, dur: 0.75, label: 'hover-1' },
        { t: 5.0, move: function () { return [hoverX(b) - 6, rowY(b)] }, dur: 0.8, label: 'hover-2' },
        { t: 7.4, move: function () { return center(vbtn) }, dur: 0.9, label: 'to-grid' },
        { t: 8.4, click: function () { setView('grid') }, label: 'grid' },
        { t: 10.6, move: function () { return center(ibtn) }, dur: 0.4 },
        { t: 11.1, click: function () { setView('index') } },
        { t: 11.4, move: function () { return center(fbtn) }, dur: 0.6 },
        { t: 12.1, click: function () { setFilter(pv.filter) }, label: 'filter' },
        { t: 13.9, move: function () { return center(all) }, dur: 0.5 },
        { t: 14.5, click: function () { setFilter('*') }, label: 'end' },
        { t: 16, end: true },
      ]
    }
    var o = pv.open
    return [
      { t: 0, label: 'top' },
      { t: 0.8, scroll: function () { return document.querySelector('.wi-ctrl').getBoundingClientRect().top + scrollY - 8 }, dur: 1.0, label: 'list' },
      { t: 2.0, click: function () { toggleInline(rows[o]) }, tap: function () { return center(rows[o].querySelector('.wi-tg .th')) }, label: 'open' },
      { t: 16, end: true },
    ]
  }
  var moveA = null
  function runScriptTo(t) {
    script.forEach(function (s) {
      if (s.done || s.t > t) return
      s.done = true
      if (s.label) label = s.label
      if (s.show) ptr.vis = true
      if (s.move) { var to = s.move(); moveA = { from: [ptr.x, ptr.y], to: to, t0: s.t, dur: s.dur } }
      if (s.scroll) scrollAnim = { from: scrollY, to: Math.max(0, s.scroll()), t0: s.t, dur: s.dur }
      if (s.tap) { var c = s.tap(); ptr.x = c[0]; ptr.y = c[1]; ptr.vis = true }
      if (s.click) { ptr.click = s.t; s.click() }
    })
  }
  function pointerAt() {
    if (!moveA) return
    var k = prog(now, moveA.t0, moveA.dur), e = bezier(0.45, 0, 0.25, 1)(k)
    ptr.x = moveA.from[0] + (moveA.to[0] - moveA.from[0]) * e
    ptr.y = moveA.from[1] + (moveA.to[1] - moveA.from[1]) * e
    if (k >= 1) moveA = null
    if (!desk.matches || idx.dataset.view === 'grid') return
    var el = document.elementFromPoint(ptr.x, ptr.y)
    var row = el && el.closest('.wi-row')
    P.px = ptr.x
    if (row && row !== P.row) setRow(row, ptr.x)
    else if (!row && P.shown) hide()
  }
  function drawCursor() {
    if (!cursor) return
    cursor.style.transform = 'translate(' + ptr.x.toFixed(1) + 'px,' + ptr.y.toFixed(1) + 'px)'
    cursor.style.opacity = ptr.vis ? '1' : '0'
    cursor.querySelector('svg').style.display = desk.matches ? '' : 'none'
    var k = prog(now, ptr.click, 0.5)
    var ring = cursor.querySelector('.ring')
    ring.style.opacity = k > 0 && k < 1 ? String(0.8 * (1 - k)) : '0'
    ring.style.transform = 'scale(' + (0.6 + 0.8 * k) + ')'
  }
  function advance(t) {
    if (!script) script = buildScript()
    var dt = 1 / 120
    while (simT + dt <= t + 1e-9) {
      simT += dt
      now = simT
      runScriptTo(simT)
      pointerAt()
      step(dt)
      draw()
    }
    drawCursor()
  }
  function waitVideos() {
    var vids = [].slice.call(document.querySelectorAll('.wi-plate video, .wi-inl:not([hidden]) video'))
    return Promise.all(vids.map(function (v) {
      return new Promise(function (ok) {
        var d = v.duration || DATA.loopSeconds || 12
        var target = (simT % d)
        if (v.readyState < 2) { v.addEventListener('loadeddata', function go() { v.removeEventListener('loadeddata', go); v.currentTime = target; v.addEventListener('seeked', ok, { once: true }); setTimeout(ok, 1500) }); v.load(); setTimeout(ok, 3000); return }
        if (Math.abs(v.currentTime - target) < 0.01) return ok()
        v.addEventListener('seeked', function () { ok() }, { once: true })
        v.currentTime = target
        setTimeout(ok, 1500)
      })
    }))
  }
  function imagesReady() {
    var imgs = [].slice.call(document.querySelectorAll('.wi-plate img, .wi-inl:not([hidden]) img, .wi-chip img'))
    return Promise.all(imgs.map(function (i) { return i.complete ? (i.decode ? i.decode().catch(function () {}) : 0) : new Promise(function (ok) { i.onload = i.onerror = ok; setTimeout(ok, 4000) }) }))
  }

  var ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    idx.querySelectorAll('.wi-chip img').forEach(function (i) { i.loading = 'eager' })
    return imagesReady()
  })
  window.WorkIndex = {
    ready: ready,
    length: 16,
    seek: function (t) {
      if (t < simT - 1e-6) throw new Error('seek only moves forward; reload to go back')
      advance(t)
      return imagesReady().then(waitVideos).then(function () { return new Promise(function (ok) { requestAnimationFrame(function () { requestAnimationFrame(ok) }) }) })
    },
    /** [[label, from, to]] stretches where nothing moves (springs at rest, no reveal, riffle, FLIP or scroll in progress) */
    moments: function () {
      var out = [], fps = 30, cur = null
      for (var f = 0; f <= 16 * fps; f++) {
        var t = f / fps
        advance(t)
        var quiet = !busy() && !moveA && prog(t, ptr.click, 0.5) >= 1
        if (quiet && cur && cur[0] === label) cur[2] = t
        else if (quiet) { cur = [label, t, t]; out.push(cur) }
        else cur = null
      }
      return out.filter(function (m) { return m[2] - m[1] >= 0.3 }).map(function (m) { return [m[0], Math.round(m[1] * 100) / 100, Math.round(m[2] * 100) / 100] })
    },
    state: function () { return { label: label, busy: busy(), side: P.side, rev: P.rev, plate: P.shown ? plate.getBoundingClientRect().toJSON() : null, row: P.row ? P.row.getBoundingClientRect().toJSON() : null } },
    hover: function (i, x) { var r = rows[i]; setRow(r, x == null ? r.getBoundingClientRect().left + r.offsetWidth * 0.56 : x) },
    hide: hide, setView: setView, setFilter: setFilter, toggleInline: function (i) { toggleInline(rows[i]) },
  }
})()
