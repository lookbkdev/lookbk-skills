/* Newsletter Kit runtime. Everything the page shows already works without
   it (the times are the sender's, the form posts normally); this adds the
   reader's own time zone, the next issue worked out from the clock, the
   inbox's entrance, the form's states and the sample email's "to:" line. */
(function () {
  var root = document.querySelector('.nk[data-nk]')
  if (!root) return
  var D = JSON.parse(root.getAttribute('data-nk'))
  var q = new URLSearchParams(location.search)
  var REC = q.has('nk-record')
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  var pinned = q.get('nk-now') ? Date.parse(q.get('nk-now')) : REC && D.today ? Date.parse(D.today + 'T10:00:00Z') : null
  var now = function () { return pinned || Date.now() }
  var readerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  var $ = function (s, r) { return (r || root).querySelector(s) }
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)) }

  /* ---------- time, in the reader's zone ---------- */
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  var fmts = {}
  function wall(ms, tz) {
    var f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' }))
    var p = {}
    f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value })
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, wd: WD.indexOf(p.weekday) }
  }
  function fmt(ms, tz, kind) {
    var w = wall(ms, tz)
    var hm = String(w.h).padStart(2, '0') + ':' + String(w.min).padStart(2, '0')
    if (kind === 'day') return WD[w.wd] + ' ' + w.d + ' ' + MON[w.m - 1]
    if (kind === 'short') return w.d + ' ' + MON[w.m - 1]
    if (kind === 'long') return w.d + ' ' + MONL[w.m - 1] + ' ' + w.y
    if (kind === 'time') return hm
    if (kind === 'wdtime') return WD[w.wd] + ' ' + hm
    return WD[w.wd] + ' ' + w.d + ' ' + MON[w.m - 1] + ', ' + hm
  }
  var nextIssue = null
  function vars() {
    var n = nextIssue
    var immediate = n && n === D.upcoming[0]
    return { next: n && immediate ? 'No. ' + n.no : D.msg.nextFallback, nextDay: n ? fmt(n.at, readerTz, 'day') : '' }
  }
  function fill(tpl) { var v = vars(); return tpl.replace(/\{(\w+)\}/g, function (m, k) { return k in v ? v[k] : m }) }
  function times() {
    var t = now()
    $$('.nk-today').forEach(function (el) { el.setAttribute('data-at', String(t)) })
    $$('time[data-at]').forEach(function (el) { el.textContent = fmt(+el.getAttribute('data-at'), readerTz, el.getAttribute('data-f')) })
    var after = Math.max(t, D.latest.at)
    nextIssue = null
    for (var i = 0; i < D.upcoming.length; i++) if (D.upcoming[i].at > after) { nextIssue = D.upcoming[i]; break }
    var v = vars()
    $$('[data-nk="next-no"]').forEach(function (el) { el.textContent = v.next })
    $$('[data-nk="next-day"]').forEach(function (el) { el.textContent = v.nextDay })
    var yours = $('[data-nk="yours"]')
    if (yours && nextIssue) {
      var theirs = fmt(nextIssue.at, D.tz, 'wdtime'), mine = fmt(nextIssue.at, readerTz, 'wdtime')
      yours.textContent = ''
      if (theirs !== mine) {
        var sep = document.createElement('span')
        sep.className = 'nk-sep2'
        sep.setAttribute('aria-hidden', 'true')
        sep.textContent = '· '
        yours.append(sep, mine + ' your time')
      }
    }
    $('[data-nk="confirm-line"]').textContent = fill(D.msg.confirmLine)
    var row = $('.nk-confirmrow .nk-sub span')
    if (row) row.textContent = '· ' + fill(D.msg.confirmRowLine)
    var b = $('.nk-btxt')
    if (b && b.getAttribute('data-tpl')) b.firstChild.textContent = fill(b.getAttribute('data-tpl')) + ' '
    if (state === 'empty' || state === 'typing') msg.textContent = fill(D.msg.hint)
  }

  /* ---------- the inbox arriving (once, on view) ---------- */
  var client = $('.nk-client'), sel = $('.nk-sel'), dot = $('.nk-sel .nk-dot'), open = $('.nk-open')
  var cells = $$('.nk-cal li'), draw = $('.nk-draw'), marks = $$('.nk-pt, .nk-cl')
  var SETTLE = 1800
  var ease = function (x) { return 1 - Math.pow(1 - x, 3) }
  var inout = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
  var p = function (ms, a, b) { return Math.min(1, Math.max(0, (ms - a) / (b - a))) }
  function paint(ms) {
    if (ms >= SETTLE) {
      ;[client, sel, dot, open, draw].concat(cells, marks).forEach(function (el) { if (el) { el.style.opacity = ''; el.style.transform = ''; el.style.clipPath = '' } })
      return
    }
    var o = ease(p(ms, 0, 480))
    client.style.opacity = o
    client.style.transform = 'translateY(' + ((1 - o) * 12).toFixed(2) + 'px)'
    var s = ease(p(ms, 220, 640))
    sel.style.opacity = s
    sel.style.transform = 'translateY(' + ((1 - s) * -10).toFixed(2) + 'px)'
    dot.style.transform = 'scale(' + ease(p(ms, 560, 740)).toFixed(3) + ')'
    var k = inout(p(ms, 640, 1260))
    open.style.clipPath = 'inset(0 0 ' + ((1 - k) * 100).toFixed(2) + '% 0)'
    var n = cells.length
    cells.forEach(function (c, i) {
      var x = i === n - 1 ? p(ms, 700 + 35 * n, 940 + 35 * n) : ease(p(ms, 700 + 35 * i, 900 + 35 * i))
      c.style.opacity = x
      if (i < n - 1) c.style.transform = 'scaleY(' + x.toFixed(3) + ')'
    })
    if (draw) {
      var r = inout(p(ms, 1100, 1750)) * 100
      draw.style.clipPath = 'inset(-10% ' + (100 - r).toFixed(2) + '% -10% 0)'
      marks.forEach(function (m) { m.style.opacity = Math.min(1, Math.max(0, (r - +m.getAttribute('data-x')) / 6)) })
    }
  }

  /* ---------- the form ---------- */
  var form = $('.nk-form'), input = $('#nk-email'), msg = $('#nk-msg'), to = $('[data-nk="to"]'), btn = $('.nk-form button[type=submit]')
  var hp = form.querySelector('[name="' + D.form.honeypot + '"]')
  var btxt = $('.nk-btxt')
  var state = 'empty'
  var rowbox = $('.nk-rows'), crow = $('.nk-confirmrow'), unread = $('[data-nk="unread"]')
  var dots = $$('.nk-dots i'), dotTimer = null
  function stepDots(i) { dots.forEach(function (d, j) { d.style.opacity = j === i % 3 ? '1' : j === (i + 2) % 3 ? '.6' : '.25' }) }
  function rowIn(k) {
    // the confirmation email arrives at the top; the list moves down one row
    var h = crow.getBoundingClientRect().height
    rowbox.style.transform = k >= 1 ? '' : 'translateY(' + (-(1 - ease(k)) * h).toFixed(2) + 'px)'
    crow.style.opacity = k >= 1 ? '' : String(ease(k))
  }
  function setState(s, opts) {
    opts = opts || {}
    state = s
    root.setAttribute('data-state', s)
    var v = input.value.trim()
    to.textContent = v && s !== 'invalid' ? v : v || 'you'
    to.classList.toggle('nk-live', s === 'typing' && !!v)
    $$('[data-nk="addr"]').forEach(function (el) { el.textContent = v + '.'; el.title = v })
    input.setAttribute('aria-invalid', s === 'invalid' || s === 'error' ? 'true' : 'false')
    input.readOnly = s === 'sending'
    btn.setAttribute('aria-disabled', s === 'sending' ? 'true' : 'false')
    if (s === 'sending') btn.setAttribute('aria-label', D.msg.sending)
    else btn.removeAttribute('aria-label')
    if (s === 'empty' || s === 'typing') msg.textContent = fill(D.msg.hint)
    else if (s === 'invalid') msg.textContent = opts.why ? D.msg[opts.why] : D.msg.invalidDot
    else if (s === 'sending') msg.textContent = D.msg.sending
    else if (s === 'error') msg.textContent = D.msg.error
    unread.textContent = s === 'confirm' ? '2 unread' : '1 unread'
    var cl = $('[data-nk="confirm-line"]')
    cl.textContent = fill(opts.opaque ? D.msg.confirmOpaque : D.msg.confirmLine)
    clearInterval(dotTimer)
    if (s === 'sending' && !REC) { var i = 0; stepDots(0); dotTimer = setInterval(function () { stepDots(++i) }, 200) }
    if (s === 'confirm' && opts.animate && !reduce) {
      var t0 = performance.now()
      rowIn(0)
      requestAnimationFrame(function tick(t) { var k = (t - t0) / 420; rowIn(k); if (k < 1) requestAnimationFrame(tick) })
    } else rowIn(1)
    var panel = s === 'confirm' ? $('.nk-confirm') : s === 'already' ? $('.nk-already') : s === 'done' ? $('.nk-subd') : null
    if (panel && opts.focus) panel.focus({ preventScroll: true })
  }
  input.addEventListener('input', function () {
    if (state === 'sending') return
    setState(input.value.trim() ? 'typing' : 'empty')
  })
  function why(v) {
    if (!v) return 'invalidEmpty'
    if (v.indexOf('@') < 0) return 'invalidAt'
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(v)) return 'invalidDot'
    return null
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms) }) }
  function send(v) {
    var action = form.getAttribute('action')
    if (action === '#') return wait(700).then(function () { return 'ok' })
    var fd = new FormData(form)
    var mode = D.form.mode
    var ctl = new AbortController()
    var timer = setTimeout(function () { ctl.abort() }, 12000)
    var init = { method: 'POST', signal: ctl.signal }
    if (mode === 'json') {
      var body = {}
      fd.forEach(function (x, k) { body[k] = x })
      for (var k in D.form.extra) body[k] = D.form.extra[k]
      init.headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
      init.body = JSON.stringify(body)
    } else {
      init.body = new URLSearchParams(fd)
      if (mode === 'no-cors') init.mode = 'no-cors'
      else init.headers = { Accept: 'application/json' }
    }
    return fetch(action, init).then(function (res) {
      clearTimeout(timer)
      if (mode === 'no-cors') return 'opaque'
      if (res.status === 409) return 'already'
      if (res.status === 400 || res.status === 422) return 'invalid'
      if (!res.ok) return 'error'
      return res.text().then(function (t) {
        try { var j = JSON.parse(t); var st = j && (j.state || j.status) } catch (e) { st = null }
        if (st === 'already' || st === 'already_subscribed') return 'already'
        if (st === 'invalid') return 'invalid'
        if (st === 'subscribed' || st === 'done') return 'done'
        return 'ok'
      })
    }, function () { clearTimeout(timer); return 'error' })
  }
  form.addEventListener('submit', function (e) {
    var v = input.value.trim()
    var bad = why(v)
    if (bad) { e.preventDefault(); setState('invalid', { why: bad }); input.focus(); return }
    if (hp && hp.value) { e.preventDefault(); setState(D.form.doubleOptIn ? 'confirm' : 'done', { focus: true }); return }
    if (D.form.mode === 'navigate' && form.getAttribute('action') !== '#') { setState('sending'); return }
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    send(v).then(function (r) {
      if (r === 'already') setState('already', { focus: true })
      else if (r === 'invalid') { setState('invalid', { why: 'invalidServer' }); input.focus() }
      else if (r === 'error') { setState('error'); input.focus() }
      else if (r === 'done' || !D.form.doubleOptIn) setState('done', { focus: true })
      else setState('confirm', { focus: true, animate: true, opaque: r === 'opaque' })
    })
  })
  if (btxt) btxt.setAttribute('data-tpl', D.button)

  /* The form's box is as tall as its tallest state, measured with the real
     messages and a long address, so no state moves anything below it. */
  var zone = $('.nk-zone')
  function reserve() {
    var addrs = $$('[data-nk="addr"]'), cl = $('[data-nk="confirm-line"]')
    var keep = { msg: msg.textContent, cl: cl.textContent, addrs: addrs.map(function (a) { return a.textContent }) }
    zone.style.minHeight = ''
    addrs.forEach(function (a) { a.textContent = 'firstname.lastname@yourmail.example.' })
    var max = 0
    ;[fill(D.msg.hint), D.msg.invalidEmpty, D.msg.invalidAt, D.msg.invalidDot, D.msg.invalidServer, D.msg.sending, D.msg.error].forEach(function (t) { msg.textContent = t; max = Math.max(max, form.offsetHeight) })
    ;[D.msg.confirmLine, D.msg.confirmOpaque].forEach(function (t) { cl.textContent = fill(t); max = Math.max(max, $('.nk-confirm').offsetHeight) })
    max = Math.max(max, $('.nk-already').offsetHeight, $('.nk-subd').offsetHeight)
    msg.textContent = keep.msg; cl.textContent = keep.cl
    addrs.forEach(function (a, i) { a.textContent = keep.addrs[i] })
    zone.style.minHeight = Math.ceil(max) + 'px'
  }
  var rz
  addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(reserve, 100) })

  /* ---------- recording: a fixed script, stepped frame by frame ---------- */
  var S = { enter: 0.3, typeFrom: 3.4, typeTo: 4.9, submit: 5.6, confirm: 6.5, length: 12 }
  var holds = [
    { name: 'arrived', from: 2.2, to: 3.3 },
    { name: 'typed', from: 5.0, to: 5.5 },
    { name: 'confirm', from: 7.1, to: D.layout === 'page' ? 8.9 : 12 },
  ]
  if (D.layout === 'page') holds.push({ name: 'archive', from: 10.4, to: 12 })
  var demoEmail = D.demoEmail || 'reader@yourmail.example'
  function top(el) { return el.getBoundingClientRect().top + scrollY }
  function scrollFor(t) {
    var max = document.documentElement.scrollHeight - innerHeight
    var y0 = D.layout === 'page' ? 0 : Math.min(max, top(root))
    var zone = $('.nk-zone')
    var yForm = Math.min(max, Math.max(y0, top(zone) + zone.offsetHeight + 32 - innerHeight))
    var y = y0 + (yForm - y0) * (reduce ? (t >= 3.2 ? 1 : 0) : inout(p(t, 3.0, 3.4)))
    if (D.layout === 'page') {
      var yArch = Math.min(max, top($('.nk-lower')) - 96)
      y += (Math.max(yForm, yArch) - yForm) * (reduce ? (t >= 9.6 ? 1 : 0) : inout(p(t, 9.0, 10.2)))
    }
    return Math.round(y)
  }
  function seek(t) {
    paint(reduce ? Infinity : (t - S.enter) * 1000)
    var f = $('.nk-form'), c = $('.nk-confirm')
    f.style.opacity = ''; c.style.opacity = ''
    if (t < S.typeFrom) { input.value = ''; setState('empty') }
    else if (t < S.submit) {
      input.value = demoEmail.slice(0, Math.round(demoEmail.length * p(t, S.typeFrom, S.typeTo)))
      setState(input.value ? 'typing' : 'empty')
      if (document.activeElement !== input) input.focus({ preventScroll: true })
    } else if (t < S.confirm) {
      input.value = demoEmail
      setState('sending')
      stepDots(Math.floor((t - S.submit) / 0.2))
    } else {
      input.value = demoEmail
      if (document.activeElement === input) input.blur()
      setState('confirm')
      var k = reduce ? 1 : p(t, S.confirm, S.confirm + 0.42)
      rowIn(k)
      var x = reduce ? 1 : p(t, S.confirm, S.confirm + 0.2)
      if (x < 1) { f.style.opacity = String(1 - x); f.style.visibility = 'visible'; c.style.opacity = String(x) } else f.style.visibility = ''
    }
    scrollTo(0, scrollFor(t))
  }

  /* ---------- start ---------- */
  times()
  reserve()
  if (REC) {
    root.classList.add('nk-rec')
    var st = document.createElement('style')
    st.textContent = '.nk-rec .nk-zone > *, .nk-rec .nk-field, .nk-rec .nk-ar { transition: none !important }'
    document.head.appendChild(st)
    seek(0)
  } else if (reduce || !('IntersectionObserver' in window)) paint(Infinity)
  else {
    paint(0)
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting })) return
      io.disconnect()
      var t0 = performance.now()
      requestAnimationFrame(function tick(t) { var ms = t - t0; paint(ms); if (ms < SETTLE) requestAnimationFrame(tick); else settled = true })
    }, { threshold: 0.3 })
    io.observe(client)
  }
  var settled = REC || reduce
  setInterval(function () { if (!REC) times() }, 60000)
  window.NewsletterKit = {
    ready: (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { reserve(); return true }),
    length: S.length,
    holds: holds,
    seek: seek,
    settled: function () { return settled },
    readerTz: readerTz,
    /** Sets a form state for a still: empty, typing, invalid, sending, confirm, already, done, error. */
    state: function (s, value) {
      paint(Infinity)
      if (value !== undefined) input.value = value
      clearInterval(dotTimer)
      setState(s, { why: s === 'invalid' ? why(input.value.trim()) || 'invalidDot' : undefined })
      if (s === 'sending') stepDots(1)
      if (s === 'typing') input.focus({ preventScroll: true })
      else if (document.activeElement === input) input.blur()
      return state
    },
    data: D,
  }
})()
