/* Fee Calculator Kit: the browser runtime, inlined after engine.js.
   Reads the amount as it is typed or pasted, recomputes the whole sum with
   FeeEngine, rolls only the digits that changed, runs the entrance once,
   keeps the cut-off sentence true minute by minute, shows the phone's result
   bar only while the real result is off screen, and calls a rate adapter
   if the page defines one (it fetches nothing on its own).

   Every moving part is drawn from one clock, so ?fk-record=1 can step the
   page frame by frame (window.FeeKit.seek) and get the same picture on any
   machine. ?fk-now=YYYY-MM-DDTHH:MM pins "now" in the cut-off's time zone. */
;(function () {
  'use strict'
  var E = window.FeeEngine
  var root = document.querySelector('.fk')
  if (!root || !E) return
  var c = JSON.parse(root.querySelector('script.fk-cfg').textContent)
  var zone = c.arrival.cutoffZone
  var q = new URLSearchParams(location.search)
  var REC = q.has('fk-record')
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  var pinned = q.get('fk-now') || (REC && c.preview && c.preview.now) || null
  function wallNow() { return pinned ? E.local(pinned, zone) : Date.now() }

  /* ---------- clock ---------- */
  var recT = 0
  function now() { return REC ? recT : performance.now() }

  /* ---------- easing ---------- */
  function bezier(x1, y1, x2, y2) {
    function a(t, p1, p2) { return 3 * p1 * t * (1 - t) * (1 - t) + 3 * p2 * t * t * (1 - t) + t * t * t }
    return function (x) {
      if (x <= 0) return 0
      if (x >= 1) return 1
      var lo = 0, hi = 1, t = x
      for (var i = 0; i < 24; i++) { t = (lo + hi) / 2; if (a(t, x1, x2) < x) lo = t; else hi = t }
      return a(t, y1, y2)
    }
  }
  var DIGIT = bezier(0.3, 0.9, 0.2, 1), TRAVEL = bezier(0.2, 0.7, 0.2, 1)
  function prog(t, start, dur) { return dur <= 0 ? 1 : Math.min(1, Math.max(0, (t - start) / dur)) }

  /* ---------- state ---------- */
  var input = root.querySelector('#fk-amt')
  var msg = root.querySelector('#fk-msg')
  var live = root.querySelector('[data-live]')
  var state = { amount: E.parse(c, input.value).minor, toggles: E.initialToggles(c), now: wallNow() }
  var figs = {}
  var enterAt = null
  var spinAt = -1e9
  var timers = { range: null, live: null }

  /* ---------- rolling figures ---------- */
  var STRIP = '<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>'
  function mount(el) {
    var k = el.getAttribute('data-k')
    var f = { el: el, value: el.getAttribute('data-v'), cols: [] }
    figs[k] = f
    paint(f, f.value, null)
  }
  /** lays out `str` as columns; each digit column remembers where it rolls from */
  function paint(f, str, roll) {
    var old = f.cols
    var html = '<span class="fk-sr">' + E.esc(str) + '</span><span aria-hidden="true">'
    var cols = []
    var n = str.length, rank = 0
    for (var i = 0; i < n; i++) {
      var ch = str.charAt(i)
      if (/\d/.test(ch)) {
        var d = +ch
        var fromRight = n - 1 - i
        var prev = null
        for (var j = 0; j < old.length; j++) if (old[j].fromRight === fromRight) prev = old[j]
        var col = { fromRight: fromRight, to: d, from: d, start: 0, dur: 0, pos: d }
        if (roll) {
          var at = prev ? prev.pos : (roll.zero ? 0 : d)
          if (at !== d) { col.from = at; col.start = roll.t + rank * 30; col.dur = roll.dur || 420; col.pos = at }
        }
        cols.push(col)
        html += '<span class="fk-col"><span class="fk-ph">0</span><span class="fk-dg" style="--d:' + col.pos.toFixed(3) + '">' + STRIP + '</span></span>'
      } else html += E.esc(ch)
    }
    // the stagger runs right to left: the rightmost digit moves first
    var moving = cols.filter(function (x) { return x.dur > 0 })
    moving.sort(function (a, b) { return a.fromRight - b.fromRight })
    for (var m = 0; m < moving.length; m++) moving[m].start = (roll ? roll.t : 0) + m * 30
    f.el.innerHTML = html + '</span>'
    var strips = f.el.querySelectorAll('.fk-dg')
    for (var s = 0; s < cols.length; s++) cols[s].strip = strips[s]
    f.cols = cols
    f.value = str
    f.el.setAttribute('data-v', str)
  }
  function setFig(k, str, t, opts) {
    var f = figs[k]
    if (!f) return
    if (f.value === str && !(opts && opts.zero)) return
    paint(f, str, reduce ? null : { t: t, zero: opts && opts.zero, dur: opts && opts.dur })
  }
  function drawFigs(t) {
    var busy = false
    for (var k in figs) {
      var cols = figs[k].cols
      for (var i = 0; i < cols.length; i++) {
        var col = cols[i]
        if (!col.dur) continue
        var p = prog(t, col.start, col.dur)
        col.pos = col.from + (col.to - col.from) * DIGIT(p)
        col.strip.style.setProperty('--d', col.pos.toFixed(3))
        if (p < 1) busy = true
        else { col.dur = 0; col.pos = col.to; col.strip.style.setProperty('--d', String(col.to)) }
      }
    }
    return busy
  }

  /* ---------- recompute ---------- */
  function update(t, quiet) {
    var r = E.compute(c, state.amount, state.toggles)
    var v = E.values(c, r)
    for (var k in v) setFig(k, v[k], t)
    var w = root.querySelector('[data-w="diffw"]')
    if (w && r.bk) w.textContent = r.diff < 0n ? E.words(c).less : E.words(c).more
    c.fees.forEach(function (row, i) {
      var el = root.querySelector('[data-sub="' + i + '"]')
      var kase = r.us.fees[i].kase
      if (el) el.textContent = kase ? E.feeDetail(c, kase) : (row.none || 'Not charged here')
    })
    var p = r.per100
    var z = BigInt(p.zoom) * E.T(c.from.decimals)
    var bars = { a: p.arrive, f: p.fees, m: p.margin, za: z - p.fees - p.margin, zf: p.fees, zm: p.margin }
    for (var b in bars) { var el = root.querySelector('[data-b="' + b + '"]'); if (el) el.style.flexGrow = String(bars[b]) }
    if (!quiet) announce(r, v)
  }
  function announce(r, v) {
    clearTimeout(timers.live)
    var w = E.words(c)
    var text = w.receive + ' ' + v.recv + '. ' + w.total + ' ' + v.tot.replace(' · ', ', ') + '.'
    if (REC) return
    timers.live = setTimeout(function () { live.textContent = text }, 600)
  }

  /* ---------- the amount ---------- */
  function setProblem(code) {
    if (code) {
      msg.textContent = E.message(c, code)
      input.setAttribute('aria-invalid', 'true')
      root.setAttribute('data-invalid', code)
    } else {
      msg.textContent = ''
      input.removeAttribute('aria-invalid')
      root.removeAttribute('data-invalid')
    }
  }
  function onText(text, t) {
    clearTimeout(timers.range)
    var r = E.parse(c, text)
    var code = E.problem(c, r)
    if (!code) {
      setProblem(null)
      state.amount = r.minor
      update(t)
      kick()
      return
    }
    if (code === 'min' || code === 'max') {
      // a range problem waits for a pause: "4" on the way to "4800" is not an error yet
      setProblem(null)
      if (REC) return
      timers.range = setTimeout(function () { setProblem(code) }, 700)
      return
    }
    setProblem(code)
  }
  function reformat() {
    var r = E.parse(c, input.value)
    if (!E.problem(c, r)) input.value = E.plain(c, r.minor, c.from.decimals)
    else if (r.minor != null) setProblem(E.problem(c, r))
  }
  input.addEventListener('input', function () { onText(input.value, now()) })
  input.addEventListener('blur', function () { clearTimeout(timers.range); reformat() })
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { reformat(); input.select() } })
  input.addEventListener('paste', function (e) {
    var text = (e.clipboardData || window.clipboardData).getData('text')
    e.preventDefault()
    paste(text, now())
  })
  function paste(text, t) {
    var r = E.parse(c, text)
    var code = E.problem(c, r)
    if (code && code !== 'min' && code !== 'max') {
      // nothing that is not an amount goes into the field
      msg.textContent = E.message(c, code)
      return
    }
    input.value = r.minor != null ? E.plain(c, r.minor, c.from.decimals) : ''
    onText(input.value, t)
    if (code) setProblem(code)
  }

  /* ---------- toggles ---------- */
  function toggle(id, value, t) {
    state.toggles[id] = value
    var bs = root.querySelectorAll('[data-t="' + id + '"]')
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(bs[i].getAttribute('data-o') === value))
    update(t)
    kick()
  }
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]')
    if (b) toggle(b.getAttribute('data-t'), b.getAttribute('data-o'), now())
  })

  /* ---------- the rate ---------- */
  var rstat = root.querySelector('.fk-rstat')
  root.querySelector('.fk-refresh').addEventListener('click', function () {
    spinAt = now(); kick()
    var get = window.FeeKitRates
    if (typeof get !== 'function') { rstat.textContent = c.rate.fixedNote || 'Rates are fixed for this page. Ask us for a live quote.'; return }
    rstat.textContent = 'Checking the rate…'
    Promise.resolve(get({ from: c.from.code, to: c.to.code })).then(function (x) {
      var at = typeof x.asOf === 'number' ? x.asOf : Date.parse(x.asOf)
      if (!x || !/^\d+(\.\d+)?$/.test(String(x.mid)) || isNaN(at)) throw new Error('bad')
      if (at > wallNow() + 60000) { rstat.textContent = 'The rate source gave a time in the future, so the rate shown is unchanged.'; return }
      c.rate.mid = String(x.mid)
      var asEl = root.querySelector('[data-asof]')
      asEl.setAttribute('data-asof', String(at))
      asEl.textContent = E.clock(at, zone)
      var mid = root.querySelector('[data-k="mid"]')
      var t = now()
      figs.mid && setFig('mid', E.rateText(c, E.scaled(c.rate.mid, E.RP)), t)
      if (!figs.mid && mid) mid.textContent = E.rateText(c, E.scaled(c.rate.mid, E.RP))
      update(t + 120)
      rstat.textContent = 'Updated at ' + E.clock(at, zone) + ' ' + c.arrival.cutoffCity + ' time.'
      kick()
    }).catch(function () { rstat.textContent = 'The rate could not be updated. The rate shown is unchanged.' })
  })

  /* ---------- time ---------- */
  function retime() {
    state.now = wallNow()
    var wrap = root.querySelector('.fk-stripwrap')
    var html = E.strip(c, state.now)
    if (wrap.innerHTML !== html) { wrap.innerHTML = html; drawEnter(now()) }
    var a = E.arrival(c, state.now)
    var mw = root.querySelector('.fk-mwhen')
    if (mw) mw.textContent = E.df(c.arrival.zone, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(a.arrive)) + ', ' + c.arrival.by
  }
  if (!pinned) setInterval(retime, 30000)

  /* ---------- entrance ---------- */
  var rows = function () { return root.querySelectorAll('.fk-ledger tbody tr:not(.fk-rule)') }
  var ENTER = { row: 60, rowDur: 420, rule: 360, result: 400, resultDur: 700, go: 600, goDur: 800, pin: 1400, pinDur: 220, settle: 1700 }
  function enter(t) {
    if (enterAt != null) return
    enterAt = t
    if (!reduce) setFig('recv', figs.recv.value, t + ENTER.result, { zero: true, dur: ENTER.resultDur })
    kick()
  }
  function drawEnter(t) {
    var done = reduce || (enterAt != null && t >= enterAt + ENTER.settle)
    var rs = rows()
    var e0 = enterAt == null ? Infinity : enterAt
    for (var i = 0; i < rs.length; i++) {
      var p = done ? 1 : TRAVEL(prog(t, e0 + i * ENTER.row, ENTER.rowDur))
      rs[i].style.setProperty('--e-o', p.toFixed(3))
      rs[i].style.setProperty('--e-y', ((1 - p) * 10).toFixed(2) + 'px')
    }
    var ruleStart = e0 + rs.length * ENTER.row + 60
    root.style.setProperty('--e-rule', (done ? 1 : TRAVEL(prog(t, ruleStart, ENTER.rule))).toFixed(3))
    root.style.setProperty('--e-go', (done ? 1 : TRAVEL(prog(t, e0 + ENTER.go, ENTER.goDur))).toFixed(3))
    var pp = done ? 1 : TRAVEL(prog(t, e0 + ENTER.pin, ENTER.pinDur))
    root.style.setProperty('--e-pin', ((1 - pp) * -8).toFixed(2) + 'px')
    root.style.setProperty('--e-pino', pp.toFixed(3))
    if (done) root.setAttribute('data-entered', '')
    return !done
  }
  if (reduce) { enterAt = -1e9; root.setAttribute('data-entered', '') }
  else if (!REC) {
    var io = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) { enter(now()); io.disconnect() }
    }, { threshold: 0.35 })
    io.observe(root.querySelector('.fk-sheet'))
  }

  /* ---------- the phone's result bar ---------- */
  var mbarEl = root.querySelector('.fk-mbar')
  function drawBar() {
    if (!mbarEl || getComputedStyle(mbarEl).display === 'none') return
    var sheet = root.querySelector('.fk-sheet').getBoundingClientRect()
    var res = root.querySelector('.fk-total').getBoundingClientRect()
    var vh = innerHeight
    var bar = mbarEl.offsetHeight
    var sheetIn = sheet.top < vh - bar && sheet.bottom > vh * 0.5
    var resultIn = res.top >= 0 && res.bottom <= vh - bar
    // it lives in the sheet's last row with no height of its own, and steps aside
    // once the real result, or the end of the sheet, is on screen
    mbarEl.style.marginTop = -bar + 'px'
    var show = sheetIn && !resultIn && sheet.bottom > vh + 8
    mbarEl.style.setProperty('--mb', show ? '0%' : '130%')
    mbarEl.style.visibility = show ? 'visible' : 'hidden'
    mbarEl.toggleAttribute('data-shown', show)
  }
  addEventListener('scroll', drawBar, { passive: true })
  addEventListener('resize', drawBar)

  /* ---------- the frame loop ---------- */
  var looping = false
  function draw(t) {
    var a = drawFigs(t)
    var b = drawEnter(t)
    var sp = prog(t, spinAt, 480)
    root.querySelector('.fk-refresh svg').style.setProperty('--spin', (reduce ? 0 : TRAVEL(sp) * 360).toFixed(1) + 'deg')
    var busy = a || b || sp < 1
    root.toggleAttribute('data-settled', !busy && enterAt != null)
    return busy
  }
  function frame() {
    looping = draw(now())
    if (looping) requestAnimationFrame(frame)
  }
  function kick() { if (!REC && !looping) { looping = true; requestAnimationFrame(frame) } }

  /* ---------- start ---------- */
  root.querySelectorAll('[data-k]').forEach(mount)
  retime()
  update(0, true)
  draw(now())
  drawBar()

  /* ---------- the recording script ---------- */
  var P = c.preview || {}
  var script = []
  var length = 0
  var marks = []
  ;(function plan() {
    var t = 0.3
    script.push({ t: t, enter: true })
    marks.push(['start', t + ENTER.settle / 1000 + 0.05, 3.2])
    t = 3.25
    script.push({ t: t, focus: true })
    var typed = String(P.type || '2400')
    var text = ''
    for (var i = 0; i < typed.length; i++) { text += typed.charAt(i); t += 0.22; script.push({ t: t, text: text }) }
    t += 0.95
    script.push({ t: t, blur: true })
    marks.push(['typed', t + 0.1, t + 1.3])
    t += 1.5
    if (P.toggle) { script.push({ t: t, toggle: P.toggle }); marks.push(['toggle', t + 0.8, t + 1.9]); t += 2.1 }
    if (P.paste) { script.push({ t: t, paste: P.paste }); marks.push(['paste', t + 0.8, t + 1.9]); t += 2.1 }
    script.push({ t: t, scroll: 'strip', dur: 1.2 })
    marks.push(['strip', t + 1.3, t + 2.6])
    t += 2.8
    script.push({ t: t, scroll: 'top', dur: 1.0 })
    marks.push(['end', t + 1.1, t + 1.9])
    length = Math.round((t + 2) * 10) / 10
  })()
  function scrollTarget(name) {
    var phone = innerWidth < 760
    var top = root.getBoundingClientRect().top + scrollY
    if (name === 'top') return phone ? top : top + 40
    var s = root.querySelector('.fk-stripwrap').getBoundingClientRect()
    return Math.max(0, s.bottom + scrollY - innerHeight + (phone ? 120 : 160))
  }
  function seek(sec) {
    var T = sec * 1000
    // replay the script from scratch up to T, so every frame is exact
    recT = 0
    enterAt = reduce ? -1e9 : null
    state.amount = E.parse(c, c.amount.start).minor
    state.toggles = E.initialToggles(c)
    input.value = E.plain(c, state.amount, c.from.decimals)
    setProblem(null)
    var bs = root.querySelectorAll('[data-t]')
    for (var b = 0; b < bs.length; b++) bs[b].setAttribute('aria-pressed', String(state.toggles[bs[b].getAttribute('data-t')] === bs[b].getAttribute('data-o')))
    var r = E.compute(c, state.amount, state.toggles), v = E.values(c, r)
    for (var k in figs) { if (v[k] != null) { figs[k].cols = []; paint(figs[k], v[k], null) } }
    update(0, true)
    var y = scrollTarget('top'), focused = false
    for (var i = 0; i < script.length; i++) {
      var ev = script[i], et = ev.t * 1000
      if (et > T) break
      recT = et
      if (ev.enter) enter(et)
      if (ev.focus) focused = true
      if (ev.text != null) { input.value = ev.text; onText(ev.text, et) }
      if (ev.blur) { focused = false; reformat() }
      if (ev.toggle) toggle(ev.toggle.id, ev.toggle.value, et)
      if (ev.paste) paste(ev.paste, et)
      if (ev.scroll) {
        var from = y, to = scrollTarget(ev.scroll)
        var p = TRAVEL(prog(T, et, ev.dur * 1000))
        y = from + (to - from) * p
      }
    }
    recT = T
    root.toggleAttribute('data-typing', focused)
    if (focused) { input.focus({ preventScroll: true }); try { input.setSelectionRange(input.value.length, input.value.length) } catch (e) {} } else input.blur()
    scrollTo(0, Math.round(y))
    draw(T)
    drawBar()
    return true
  }

  window.FeeKit = {
    ready: (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { return true }),
    length: length,
    settleMs: ENTER.settle,
    seek: seek,
    moments: function () { return { length: length, moments: marks.map(function (m) { return [m[0], Math.round(m[1] * 100) / 100, Math.round(m[2] * 100) / 100] }) } },
    /** for the check: finish every animation now */
    settle: function () { for (var k in figs) figs[k].cols.forEach(function (x) { x.dur = 0; x.pos = x.to; x.strip.style.setProperty('--d', String(x.to)) }); if (enterAt == null) enterAt = -1e9; draw(now() + 1e7); drawBar() },
    /** what each figure shows right now, read from its rolling columns */
    shown: function () {
      var out = {}
      for (var k in figs) {
        var f = figs[k], s = '', ci = 0
        for (var i = 0; i < f.value.length; i++) { var ch = f.value.charAt(i); if (/\d/.test(ch)) { s += String(Math.round(f.cols[ci].pos) % 10); ci++ } else s += ch }
        out[k] = s
      }
      return out
    },
    state: function () { return { amount: String(state.amount), toggles: state.toggles, now: state.now, asOf: +root.querySelector('[data-asof]').getAttribute('data-asof'), invalid: root.getAttribute('data-invalid') } },
    type: function (text) { input.value = text; onText(text, now()) },
    paste: function (text) { paste(text, now()) },
    toggle: function (id, value) { toggle(id, value, now()) },
    blur: reformat,
  }
})()
