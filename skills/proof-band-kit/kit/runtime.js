// Proof Band Kit runtime. Sizes every mark with ProofBalance (balance.js),
// sets them on one baseline per row, opens a mark's "what they use it for"
// on hover, focus or tap, plays the entrance once when the band comes into
// view, and runs the optional slow marquee. With ?pb-record=1 nothing moves
// on its own: the recorder calls ProofBand.seek(t) for every frame.
(function () {
  var root = document.querySelector('.pb')
  if (!root || root.dataset.pbStarted) return
  root.dataset.pbStarted = '1'
  var cfg = JSON.parse(root.getAttribute('data-pb'))
  var q = new URLSearchParams(location.search)
  var REC = q.has('pb-record')
  var DEBUG = q.has('pb-debug')
  var mq = matchMedia('(prefers-reduced-motion: reduce)')
  var reduce = mq.matches
  root.classList.add('pb-js')
  var runLayout = cfg.layout !== 'grid'
  var ul = root.querySelector('.pb-marks')
  var items = Array.prototype.slice.call(ul.querySelectorAll(':scope > .pb-mark'))
  var svgs = items.map(function (li) { return li.querySelector('svg') })
  var caption = root.querySelector('.pb-cap-t')
  var MARQUEE = !!cfg.marquee && !reduce
  var ease = function (t) { t = Math.min(Math.max(t, 0), 1); return 1 - Math.pow(1 - t, 3) }
  var inout = function (t) { t = Math.min(Math.max(t, 0), 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
  var snap8 = function (v) { return Math.round(v / 8) * 8 }
  var metrics = []
  var last = { plan: null, cols: 0, xMid: 0, baseY: 0 }

  /* ---------- balance and placement ---------- */
  function source(svg) {
    return svg.outerHTML.replace(/viewBox="[^"]*"/, 'viewBox="' + svg.getAttribute('data-vb') + '"').replace(/\swidth="[^"]*"/, '').replace(/\sheight="[^"]*"/, '')
  }
  function bp() {
    var w = root.clientWidth
    return w < 641 ? 'phone' : w < 1024 ? 'tablet' : 'desk'
  }
  function fillers(cols) {
    Array.prototype.slice.call(ul.querySelectorAll('.pb-fill')).forEach(function (f) { f.remove() })
    var n = items.length % cols
    if (!n || MARQUEE) return
    for (var i = 0; i < cols - n; i++) {
      var f = document.createElement('li')
      f.className = 'pb-fill'
      f.setAttribute('aria-hidden', 'true')
      ul.appendChild(f)
    }
  }
  function layout() {
    if (!metrics.length) return
    var b = bp()
    var B = cfg.balance
    var o = {
      area: B.area * (b === 'phone' ? 0.6 : b === 'tablet' ? 0.78 : 1),
      densityWeight: B.densityWeight,
      maxHeight: b === 'phone' ? Math.min(B.maxHeight, 40) : b === 'tablet' ? Math.min(B.maxHeight, 46) : B.maxHeight,
      minHeight: 14,
    }
    var n = items.length, cols, pl
    var bear = b === 'phone' ? 14 : 24
    var gap = 1
    var W = ul.parentElement.clientWidth
    if (!runLayout) {
      cols = b === 'desk' ? cfg.columns : 2
      var cellW = (W - (cols - 1) * gap) / cols
      o.maxWidth = cellW * (b === 'desk' ? 0.66 : 0.82)
      pl = ProofBalance.plan(metrics, o)
    } else if (MARQUEE) {
      o.maxWidth = b === 'phone' ? 150 : 210
      pl = ProofBalance.plan(metrics, o)
      cols = n
    } else {
      var tries = [n, Math.ceil(n / 2), Math.ceil(n / 3), 2].filter(function (c, i, a) { return c >= 2 && c <= n && a.indexOf(c) === i })
      if (b === 'phone') tries = tries.filter(function (c) { return c <= 3 })
      if (!tries.length) tries = [2]
      for (var k = 0; k < tries.length; k++) {
        cols = tries[k]
        var cw = (W - (cols - 1) * gap) / cols
        o.maxWidth = cw - 2 * bear
        pl = ProofBalance.plan(metrics, o)
        if (!pl.shrunk && !pl.problems.length) break
      }
    }
    root.style.setProperty('--cols', cols)
    fillers(cols)
    // where the baseline sits in every cell, on the 8 px grid
    var cellH = items[0].clientHeight
    var baseY = snap8(cellH * (runLayout ? 0.56 : b === 'phone' ? 0.62 : 0.6))
    // half the cap height of the wordmarks: where centred marks sit
    var caps = []
    metrics.forEach(function (m, i) {
      if (items[i].getAttribute('data-align') === 'center') return
      var kk = pl.sizes[i].h / m.ink[3]
      caps.push((m.base - m.ink[1]) * kk)
    })
    caps.sort(function (a, c) { return a - c })
    var xMid = caps.length ? caps[caps.length >> 1] / 2 : 10
    var maxCellW = 0
    metrics.forEach(function (m, i) {
      var s = pl.sizes[i], k = s.h / m.ink[3], svg = svgs[i]
      var w = m.box[2] * k, h = m.box[3] * k
      svg.setAttribute('viewBox', m.box.map(function (v) { return Math.round(v * 1000) / 1000 }).join(' '))
      svg.setAttribute('width', w.toFixed(2))
      svg.setAttribute('height', h.toFixed(2))
      var top
      if (items[i].getAttribute('data-align') === 'center') top = baseY - xMid - (m.ink[1] + m.ink[3] / 2 - m.box[1]) * k
      else top = baseY - (m.base - m.box[1]) * k
      var span = svg.parentElement
      span.style.top = top.toFixed(2) + 'px'
      span.style.width = w.toFixed(2) + 'px'
      items[i].style.setProperty('--w', s.w.toFixed(1) + 'px')
      maxCellW = Math.max(maxCellW, s.w + 4 * bear)
    })
    if (MARQUEE) root.style.setProperty('--cellw', Math.ceil(maxCellW) + 'px')
    fitFigures()
    root.style.setProperty('--pb-xmid', xMid.toFixed(2) + 'px')
    root.style.setProperty('--pb-base', baseY + 'px')
    last = { plan: pl, cols: cols, xMid: xMid, baseY: baseY, options: o }
    if (pl.problems.length) root.setAttribute('data-balance-problem', pl.problems.map(function (p) { return items[p.mark].querySelector('svg').getAttribute('aria-label') + ' ' + p.why }).join('; '))
    else root.removeAttribute('data-balance-problem')
    if (DEBUG) debug()
    if (MARQUEE) marqueeSetup()
    syncDrawer()
  }

  // every figure fits its column: if one would not, all figures come down together
  function fitFigures() {
    root.style.setProperty('--fig-fit', '1')
    var worst = 1
    Array.prototype.forEach.call(root.querySelectorAll('.pb-fig'), function (f) {
      var col = f.parentElement, cs = getComputedStyle(col)
      var room = col.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4
      if (f.scrollWidth > room) worst = Math.min(worst, room / f.scrollWidth)
    })
    if (worst < 1) root.style.setProperty('--fig-fit', (Math.floor(worst * 1000) / 1000).toString())
  }
  function debug() {
    Array.prototype.slice.call(root.querySelectorAll('.pb-dbg')).forEach(function (d) { d.remove() })
    root.classList.add('pb-debugging')
    metrics.forEach(function (m, i) {
      var li = items[i], svg = svgs[i], span = svg.parentElement
      var k = parseFloat(svg.getAttribute('height')) / m.box[3]
      var box = document.createElement('i')
      box.className = 'pb-dbg pb-dbg-box'
      box.style.left = 'calc(50% - ' + (parseFloat(svg.getAttribute('width')) / 2).toFixed(2) + 'px + ' + ((m.ink[0] - m.box[0]) * k).toFixed(2) + 'px)'
      box.style.top = (parseFloat(span.style.top) + (m.ink[1] - m.box[1]) * k).toFixed(2) + 'px'
      box.style.width = (m.ink[2] * k).toFixed(2) + 'px'
      box.style.height = (m.ink[3] * k).toFixed(2) + 'px'
      li.appendChild(box)
      var base = document.createElement('i')
      base.className = 'pb-dbg pb-dbg-base'
      base.style.top = last.baseY + 'px'
      li.appendChild(base)
      var lab = document.createElement('span')
      lab.className = 'pb-dbg pb-dbg-lab'
      var s = last.plan.sizes[i]
      lab.textContent = Math.round(s.w) + ' × ' + Math.round(s.h) + ' px · ink ' + Math.round(m.density * 100) + ' %'
      li.appendChild(lab)
    })
  }

  /* ---------- the phone drawer: on a phone the grid's cells are too narrow
     for the use line, so it opens in a full-width row under the tapped mark ---------- */
  var drawer = null
  function drawerMode() { return !runLayout && bp() === 'phone' }
  function syncDrawer() {
    if (!drawerMode()) { if (drawer) { drawer.remove(); drawer = null } return }
    if (!drawer) {
      drawer = document.createElement('li')
      drawer.className = 'pb-drawer'
      drawer.id = 'pb-drawer'
      drawer.setAttribute('aria-live', 'polite')
      drawer.hidden = true
      items.forEach(function (li) { li.querySelector('.pb-btn').setAttribute('aria-controls', 'pb-drawer') })
    }
    var i = -1, v = 0
    O.forEach(function (st, j) { if (st.o > v) { v = st.o; i = j } })
    if (i < 0 || v < 0.01) { drawer.hidden = true; return }
    var cols = last.cols || 2
    var kids = Array.prototype.filter.call(ul.children, function (k) { return k !== drawer })
    var end = kids[Math.min(kids.length - 1, Math.floor(i / cols) * cols + cols - 1)]
    if (drawer.previousElementSibling !== end || drawer.dataset.i !== String(i)) {
      end.after(drawer)
      drawer.dataset.i = String(i)
      var m = cfg.marks[i]
      drawer.innerHTML = ''
      var b = document.createElement('b')
      b.textContent = m.name + '.'
      drawer.appendChild(b)
      drawer.appendChild(document.createTextNode(' ' + m.use + ' '))
      if (m.href) {
        var a = document.createElement('a')
        a.href = m.href
        a.className = 'pb-lbl'
        a.innerHTML = 'Read the case <span aria-hidden="true">→</span>'
        drawer.appendChild(a)
      }
    }
    drawer.hidden = false
    drawer.style.opacity = v.toFixed(4)
  }

  /* ---------- open state ---------- */
  var O = items.map(function () { return { o: 0, from: 0, to: 0, t0: 0, pinned: false } })
  var openIndex = -1
  function paintOpen(i) {
    var v = O[i].o
    items[i].style.setProperty('--o', v.toFixed(4))
    items[i].classList.toggle('is-open', v > 0.01)
    syncDrawer()
  }
  function writeCaption(i) {
    if (!caption) return
    if (i < 0) { caption.textContent = caption.getAttribute('data-hint'); caption.parentElement.classList.remove('has-mark'); return }
    var m = cfg.marks[i]
    caption.parentElement.classList.add('has-mark')
    caption.innerHTML = ''
    var b = document.createElement('b')
    b.textContent = m.name + '.'
    caption.appendChild(b)
    caption.appendChild(document.createTextNode(' ' + m.use + ' '))
    if (m.href) {
      var a = document.createElement('a')
      a.href = m.href
      a.className = 'pb-lbl'
      a.innerHTML = 'Read the case <span aria-hidden="true">→</span>'
      if (/^https?:/.test(m.href)) a.rel = 'noopener'
      caption.appendChild(a)
    }
  }
  var raf = 0
  function tick() {
    raf = 0
    var now = performance.now(), more = false
    O.forEach(function (s, i) {
      if (s.o === s.to) return
      var p = reduce ? 1 : Math.min(1, (now - s.t0) / 320)
      s.o = s.from + (s.to - s.from) * ease(p)
      if (p >= 1) s.o = s.to
      else more = true
      paintOpen(i)
    })
    if (more) raf = requestAnimationFrame(tick)
  }
  function setOpen(i, open, pinned) {
    if (REC) return
    if (open) items.forEach(function (_, j) { if (j !== i && O[j].to) setOpen(j, false) })
    var s = O[i]
    s.pinned = open && !!pinned
    if (s.to === (open ? 1 : 0)) return
    s.from = s.o
    s.to = open ? 1 : 0
    s.t0 = performance.now()
    items[i].querySelector('.pb-btn').setAttribute('aria-expanded', open ? 'true' : 'false')
    if (open) { openIndex = i; writeCaption(i) }
    else if (openIndex === i) { openIndex = -1; if (runLayout) setTimeout(function () { if (openIndex < 0) writeCaption(-1) }, 330) }
    if (!raf) raf = requestAnimationFrame(tick)
  }
  items.forEach(function (li, i) {
    var btn = li.querySelector('.pb-btn')
    btn.addEventListener('click', function () { setOpen(i, !(O[i].to && O[i].pinned), true) })
    li.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setOpen(i, true) })
    li.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !O[i].pinned && !li.contains(document.activeElement)) setOpen(i, false) })
    btn.addEventListener('focus', function () { if (btn.matches(':focus-visible')) setOpen(i, true) })
    li.addEventListener('focusout', function (e) {
      if (li.contains(e.relatedTarget)) return
      if (runLayout && caption && caption.parentElement.contains(e.relatedTarget)) return
      if (drawer && drawer.contains(e.relatedTarget)) return
      if (!O[i].pinned) setOpen(i, false)
    })
  })
  root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openIndex >= 0) { var i = openIndex; setOpen(i, false); items[i].querySelector('.pb-btn').focus() } })
  if (caption) caption.parentElement.addEventListener('focusout', function (e) {
    if (openIndex >= 0 && !items[openIndex].contains(e.relatedTarget) && !caption.parentElement.contains(e.relatedTarget) && !O[openIndex].pinned) setOpen(openIndex, false)
  })

  /* ---------- marquee (row layout, opt-in, never under reduced motion) ---------- */
  var mq0 = { on: false, x: 0, w: 0, paused: false, hover: false, focus: false, t: 0 }
  var track = null
  var pauseBtn = root.querySelector('.pb-pause')
  function marqueeSetup() {
    if (!track) {
      root.classList.add('pb-marquee')
      track = ul
      items.forEach(function (li) {
        var c = li.cloneNode(true)
        c.classList.add('pb-clone')
        c.setAttribute('aria-hidden', 'true')
        c.removeAttribute('data-e')
        c.querySelectorAll('button, a').forEach(function (el) { el.setAttribute('tabindex', '-1') })
        c.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id') })
        ul.appendChild(c)
      })
      var box = ul.parentElement
      box.addEventListener('pointerenter', function () { mq0.hover = true })
      box.addEventListener('pointerleave', function () { mq0.hover = false })
      box.addEventListener('focusin', function () { mq0.focus = true })
      box.addEventListener('focusout', function (e) { if (!box.contains(e.relatedTarget)) mq0.focus = false })
      if (pauseBtn) {
        pauseBtn.hidden = false
        pauseBtn.addEventListener('click', function () {
          mq0.paused = !mq0.paused
          pauseBtn.setAttribute('aria-pressed', mq0.paused ? 'true' : 'false')
          pauseBtn.querySelector('.pb-pause-t').textContent = mq0.paused ? 'Play' : 'Pause'
          pauseBtn.classList.toggle('is-paused', mq0.paused)
        })
      }
    }
    // the clones copy the sizes of their originals
    var clones = ul.querySelectorAll('.pb-clone')
    items.forEach(function (li, i) {
      var c = clones[i], s = li.querySelector('svg'), cs = c.querySelector('svg')
      ;['viewBox', 'width', 'height'].forEach(function (a) { cs.setAttribute(a, s.getAttribute(a)) })
      c.querySelector('.pb-logo').style.cssText = li.querySelector('.pb-logo').style.cssText
      c.style.setProperty('--w', li.style.getPropertyValue('--w'))
    })
    mq0.w = items.reduce(function (a, li) { return a + li.getBoundingClientRect().width }, 0)
  }
  function marqueeAt(x) {
    if (!track || !mq0.w) return
    var v = x % mq0.w
    track.style.transform = 'translate3d(' + (-v).toFixed(2) + 'px,0,0)'
  }
  function marqueeLive() {
    var prev = performance.now()
    function step(now) {
      var dt = Math.min(64, now - prev)
      prev = now
      if (!(mq0.paused || mq0.hover || mq0.focus || document.hidden)) { mq0.x += (cfg.marquee.speed * dt) / 1000; marqueeAt(mq0.x) }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  /* ---------- the entrance: once, when the band comes into view ---------- */
  var E = []
  ;(function plan() {
    var n = items.length
    var rules = root.querySelectorAll('[data-e="rule"]')
    Array.prototype.forEach.call(rules, function (el, i) { E.push({ el: el, k: 'rule', t0: i * 90, d: 600 }) })
    var markStart = cfg.layout === 'grid' ? 180 : cfg.layout === 'figures' ? 360 : 200
    items.forEach(function (el, i) { E.push({ el: el, k: 'mark', t0: markStart + i * 45, d: 420 }) })
    var figs = root.querySelectorAll('[data-e="fig"]')
    var figStart = cfg.layout === 'figures' ? 140 : markStart + n * 45 + 40
    Array.prototype.forEach.call(figs, function (el, i) { E.push({ el: el, k: 'fig', t0: figStart + i * 80, d: 360 }) })
    var end = 0
    E.forEach(function (e) { end = Math.max(end, e.t0 + e.d) })
    var refStart = Math.max(figStart + figs.length * 80 + 200, end - 160)
    root.querySelectorAll('[data-e="ref"], [data-e="notes"] ol').forEach(function (el, i) { E.push({ el: el, k: 'fade', t0: refStart + i * 30, d: 240 }) })
  })()
  var SETTLE = E.reduce(function (a, e) { return Math.max(a, e.t0 + e.d) }, 0)
  function entrance(ms) {
    E.forEach(function (e) {
      var p = ease((ms - e.t0) / e.d), s = e.el.style
      if (e.k === 'rule') s.transform = 'scaleX(' + p.toFixed(4) + ')'
      else if (e.k === 'mark') s.setProperty('--e', p.toFixed(4))
      else if (e.k === 'fig') { s.opacity = p.toFixed(4); s.translate = '0 ' + ((1 - p) * 6).toFixed(2) + 'px' }
      else s.opacity = p.toFixed(4)
    })
  }
  function settle() {
    E.forEach(function (e) { e.el.style.transform = ''; e.el.style.opacity = ''; e.el.style.translate = ''; e.el.style.removeProperty('--e') })
    root.setAttribute('data-settled', '')
  }
  var played = false
  function play() {
    if (played) return
    played = true
    var t0 = performance.now()
    function step(now) {
      var ms = now - t0
      if (ms >= SETTLE) { settle(); if (MARQUEE) marqueeLive(); return }
      entrance(ms)
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  /* ---------- the recorder's fixed script ---------- */
  var S = { scrollFrom: 0.8, scrollTo: 2.4, enter: 1.7, length: 8, opens: [[cfg.open[0], 3.6, 6.0], [cfg.open[1], 6.4, 99]] }
  function settledAt() { return Math.max(S.scrollTo, S.enter + SETTLE / 1000) }
  function target() {
    var vh = innerHeight
    // the eyebrow near the top of the screen, the hero just gone
    var eb = root.querySelector('.pb-eyebrow').getBoundingClientRect().top + scrollY
    return Math.max(0, eb - (vh < 900 && innerWidth < 641 ? 40 : 72))
  }
  var tgt = null
  function seek(t) {
    if (tgt == null) tgt = target()
    scrollTo(0, tgt * inout((t - S.scrollFrom) / (S.scrollTo - S.scrollFrom)))
    var ms = (t - S.enter) * 1000
    if (reduce || ms >= SETTLE) { if (!root.hasAttribute('data-settled')) settle() }
    else { root.removeAttribute('data-settled'); entrance(ms) }
    var top = -1
    O.forEach(function (s) { s.o = 0 })
    S.opens.forEach(function (op) {
      var i = op[0], a = op[1], b = op[2], v = 0
      if (t >= a && t < b) v = ease((t - a) / 0.32)
      else if (t >= b) v = 1 - ease((t - b) / 0.32)
      if (v > O[i].o) O[i].o = v
      if (v > 0.01) top = i
    })
    O.forEach(function (_, i) { paintOpen(i) })
    if (top !== openIndex) { openIndex = top; writeCaption(top) }
    if (MARQUEE) marqueeAt(cfg.marquee.speed * Math.max(0, t - settledAt()))
  }
  function moments() {
    var s = settledAt()
    return {
      enter: S.enter,
      settled: Math.round(s * 100) / 100,
      end: S.length,
      // stretches where nothing on the band is changing (the marquee aside)
      stretches: [[s, S.opens[0][1]], [S.opens[0][1] + 0.34, S.opens[0][2]], [S.opens[1][1] + 0.34, S.length]].map(function (r) { return r.map(function (v) { return Math.round(v * 100) / 100 }) }),
      marquee: MARQUEE,
    }
  }
  function info() {
    var out = []
    items.forEach(function (li, i) {
      var r = svgs[i].getBoundingClientRect(), c = li.getBoundingClientRect()
      out.push({ i: i, name: cfg.marks[i].name, align: li.getAttribute('data-align'), svg: [r.left, r.top + scrollY, r.width, r.height], cell: [c.left, c.top + scrollY, c.width, c.height] })
    })
    return { marks: out, cols: last.cols, xMid: last.xMid, baseY: last.baseY, weight: last.plan && last.plan.weight, problems: root.getAttribute('data-balance-problem'), options: last.options, marquee: MARQUEE }
  }

  /* ---------- start ---------- */
  var ready = Promise.all(svgs.map(function (s) { return ProofBalance.measure(source(s)) }))
    .then(function (ms) { metrics = ms; layout() })
    .then(function () { return document.fonts ? document.fonts.ready : null })
    .then(function () { layout() })
    .catch(function (e) { root.setAttribute('data-balance-problem', String(e && e.message || e)); throw e })
  var lastW = innerWidth, rt = 0
  addEventListener('resize', function () {
    if (innerWidth === lastW) return
    lastW = innerWidth
    clearTimeout(rt)
    rt = setTimeout(function () { layout(); tgt = null }, 120)
  })
  if (REC) {
    ready.then(function () { entrance(0) })
  } else if (reduce) {
    root.setAttribute('data-settled', '')
  } else if ('IntersectionObserver' in window) {
    entrance(0)
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); ready.then(play, play) } })
    }, { threshold: 0, rootMargin: '0px 0px -22% 0px' })
    io.observe(root)
  } else settle()
  if (!REC && MARQUEE && reduce) root.setAttribute('data-settled', '')

  window.ProofBand = {
    ready: ready,
    settleMs: SETTLE,
    length: S.length,
    seek: seek,
    moments: moments,
    info: info,
    open: function (i, v) { setOpen(i, v !== false, true) },
  }
})()
