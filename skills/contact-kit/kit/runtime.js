/* Contact Desk runtime. No dependencies. It works out, from each person's
   hours and time zone: who is at their desk now, when each reason will get
   its reply (in the visitor's own time), the rota and the offices' status.
   It shapes the form to the chosen reason, validates it, sends it (or hands
   it to the visitor's email app) and shows what happens next.

   Every animation runs on one clock, so the recorder can step it frame by
   frame (?ck-record=1). window.ContactDesk exposes ready, length, seek(t),
   moments() and form(state) for the kit's check and record scripts. */
(function () {
  'use strict'
  var root = document.querySelector('.ck[data-ck]')
  if (!root) return
  var C = JSON.parse(root.getAttribute('data-ck'))
  var Q = new URLSearchParams(location.search)
  var REC = Q.has('ck-record')
  var PV = C.preview || {}
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  var pinned = Q.get('ck-now') || (REC ? PV.now : null)
  var t0wall = Date.now(), t0real = performance.now()
  var NOW0 = pinned ? Date.parse(pinned) : Date.now()
  function nowMs() { return REC ? NOW0 : NOW0 + (performance.now() - t0real) }
  var VTZ = Q.get('ck-tz') || (REC || Q.get('ck-now') ? PV.tz : null) || Intl.DateTimeFormat().resolvedOptions().timeZone
  root.classList.add('js')
  var $ = function (s, el) { return (el || root).querySelector(s) }
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)) }
  var form = $('.ck-desk'), slip = $('.ck-slip'), fieldsBox = $('.ck-fields')
  var store = { get: function (k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set: function (k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch (e) {} } }
  var DRAFT = 'ck-draft-' + C.brand

  /* ---------- time ---------- */
  var DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  var FC = {}
  function parts(tz, ms) {
    var f = FC[tz] || (FC[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }))
    var o = {}
    f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value })
    return { key: o.year + '-' + o.month + '-' + o.day, wd: DAYN.indexOf(o.weekday), m: +o.hour * 60 + +o.minute, hm: o.hour + ':' + o.minute, y: +o.year, mo: +o.month, d: +o.day }
  }
  function away(p, key) { for (var i = 0; i < (p.away || []).length; i++) if (key >= p.away[i][0] && key <= p.away[i][1]) return true; return false }
  function isOpen(p, ms) {
    var x = parts(p.tz, ms)
    if (away(p, x.key)) return false
    var s = p.hours[x.wd]
    for (var i = 0; i < s.length; i++) if (x.m >= s[i][0] && x.m < s[i][1]) return true
    return false
  }
  function anyOpen(team, ms) { for (var i = 0; i < team.length; i++) if (isOpen(team[i], ms)) return team[i]; return null }
  var STEP = 3e5
  function nextChange(p, ms) {
    var open = isOpen(p, ms), t = Math.floor(ms / STEP) * STEP
    for (var i = 0; i < 24 * 12 * 40; i++) { t += STEP; if (isOpen(p, t) !== open) return t }
    return null
  }
  /** a wall-clock date and minute in `tz` → epoch ms */
  function zoned(key, minutes, tz) {
    var a = key.split('-').map(Number)
    var guess = Date.UTC(a[0], a[1] - 1, a[2], 0, minutes)
    for (var i = 0; i < 3; i++) {
      var x = parts(tz, guess)
      var wall = Date.UTC(x.y, x.mo - 1, x.d, 0, x.m)
      var want = Date.UTC(a[0], a[1] - 1, a[2], 0, minutes)
      guess += want - wall
    }
    return guess
  }
  function addDays(key, n) { var a = key.split('-').map(Number); var d = new Date(Date.UTC(a[0], a[1] - 1, a[2] + n)); return d.toISOString().slice(0, 10) }
  function fmtT(tz, ms) { return parts(tz, ms).hm }
  var DF = {}
  function fmtD(tz, ms) { var f = DF[tz] || (DF[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' })); return f.format(new Date(ms)) }
  /** "today", "tomorrow", "Fri" (this week) or "Thu 12 Nov", in tz */
  function rel(tz, ms, now) {
    var a = parts(tz, now).key, b = parts(tz, ms).key
    if (a === b) return 'today'
    if (addDays(a, 1) === b) return 'tomorrow'
    if (b < addDays(a, 6)) return DAYN[parts(tz, ms).wd]
    return fmtD(tz, ms)
  }
  function when(tz, ms, now) {
    var r = rel(tz, ms, now), t = fmtT(tz, ms)
    return r === 'today' ? 'today at ' + t : r === 'tomorrow' ? 'tomorrow at ' + t : r.length === 3 ? r + ' at ' + t : r + ' at ' + t
  }
  function dur(ms) {
    var m = Math.max(1, Math.round(ms / 6e4))
    if (m < 60) return m + ' min'
    if (m >= 48 * 60) return Math.round(m / 1440) + ' days'
    var h = Math.floor(m / 60), r = m % 60
    return h + ' h' + (r ? ' ' + r + ' min' : '')
  }
  var team = function (r) { return r.to.map(function (id) { return C.people[id] }) }
  /** The reply promise as a time: working hours are walked minute by minute
      through whoever on the reason is in; a working day is a day on which
      someone on the reason works, and the reply comes by its close. */
  function replyBy(r, now) {
    var T = team(r)
    if (r.reply.unit === 'working-hours') {
      var need = r.reply.within * 60, t = now
      for (var i = 0; i < 24 * 12 * 60 && need > 0; i++) {
        var b = Math.floor(t / STEP) * STEP + STEP
        if (anyOpen(T, t)) need -= (b - t) / 6e4
        t = b
      }
      if (need < 0) t += need * 6e4
      return Math.ceil(t / 18e5) * 18e5
    }
    var tz0 = T[0].tz, today = parts(tz0, now).key, count = 0
    for (var k = 0; k < 120; k++) {
      var key = addDays(today, k), close = null, open = null
      T.forEach(function (p) {
        if (away(p, key)) return
        var wd = new Date(key + 'T12:00:00Z').getUTCDay(), s = p.hours[wd]
        if (!s.length) return
        var o = zoned(key, s[0][0], p.tz), c = zoned(key, s[s.length - 1][1], p.tz)
        open = open == null ? o : Math.min(open, o)
        close = close == null ? c : Math.max(close, c)
      })
      if (close == null) continue
      if (k === 0 && now >= open) continue
      if (++count === r.reply.within) return close
    }
    return now + 7 * 864e5
  }
  function status(p, now) {
    var open = isOpen(p, now), nx = nextChange(p, now)
    if (open) return { open: true, line: 'At the desk', sub: 'until ' + fmtT(VTZ, nx) + ' · ' + dur(nx - now) + ' left', next: nx }
    var r = rel(VTZ, nx, now)
    return { open: false, line: 'Back ' + (r === 'today' ? 'at ' + fmtT(VTZ, nx) : r === 'tomorrow' ? 'at ' + fmtT(VTZ, nx) + ' tomorrow' : r + ' ' + fmtT(VTZ, nx)), sub: 'in ' + dur(nx - now), next: nx }
  }
  function cityOf(tz) { return tz.split('/').pop().replace(/_/g, ' ') }
  function first(name) { return name.split(' ')[0] }

  /* ---------- one clock for every animation ---------- */
  var recT = 0
  function clock() { return REC ? recT : performance.now() / 1000 }
  var anims = [], raf = 0
  var EASE = function (p) { return 1 - Math.pow(1 - p, 3) }
  var OUTIN = function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2 }
  function anim(dur, fn, o) {
    o = o || {}
    if (reduce || dur === 0) { fn(1); return }
    var a = { t0: clock() + (o.delay || 0), dur: dur, fn: fn, ease: o.ease || EASE, end: o.end }
    anims.push(a)
    fn(0)
    kick()
  }
  function tick() {
    raf = 0
    var t = clock()
    anims.slice().forEach(function (a) {
      var p = Math.min(1, Math.max(0, (t - a.t0) / a.dur))
      a.fn(a.ease(p))
      if (p >= 1) { anims.splice(anims.indexOf(a), 1); if (a.end) a.end() }
    })
    if (anims.length) kick()
    else settle()
  }
  function kick() { if (!REC && !raf) raf = requestAnimationFrame(tick) }
  /** swap the text of an element half way through a short slide and fade */
  function swap(el, html, d) {
    if (!el || el.innerHTML === html) return
    var old = el.innerHTML
    if (reduce) { el.innerHTML = html; return }
    anim(d || 0.26, function (p) {
      if (p < 0.5) { if (el.innerHTML !== old && p === 0) el.innerHTML = old; el.style.opacity = String(1 - p * 2); el.style.transform = 'translateY(' + (-6 * p * 2) + 'px)' }
      else { if (el.innerHTML !== html) el.innerHTML = html; el.style.opacity = String((p - 0.5) * 2); el.style.transform = 'translateY(' + 6 * (1 - (p - 0.5) * 2) + 'px)' }
      if (p === 1) { el.style.opacity = ''; el.style.transform = '' }
    }, { ease: function (p) { return p } })
  }

  /* ---------- the desk: reasons and the slip ---------- */
  var routes = C.routes, cur = routes[0]
  var rowEls = $$('.ck-ro'), ind = $('.ck-ind')
  var fieldEls = {}
  $$('.ck-f', fieldsBox).forEach(function (el) { fieldEls[el.getAttribute('data-k')] = el })
  form.noValidate = true
  form.setAttribute('aria-describedby', 'ck-note-h')
  function sendLabel(r) { return r.button || 'Send to ' + (r.to.length > 1 ? 'the ' + r.desk.toLowerCase() : first(C.people[r.to[0]].name)) }
  function toLine(r) {
    var T = team(r)
    return T.length > 1 ? '<b>' + esc(r.desk) + '</b> · ' + T.map(function (p) { return esc(first(p.name)) + ' (' + esc(p.city) + ')' }).join(', ') : '<b>' + esc(T[0].name) + '</b> · ' + esc(T[0].role) + ', ' + esc(T[0].city)
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function etaHtml(r, now) {
    var rb = replyBy(r, now)
    return { main: 'Expect a reply by <b>' + esc(when(VTZ, rb, now)) + '</b>, your time.', at: rb }
  }
  function etaNote(r, now) {
    var T = team(r), on = anyOpen(T, now)
    if (T.length > 1) {
      if (on) return 'Whoever is in picks it up. ' + first(on.name) + ' is on now in ' + on.city + '.'
      var nx = T.map(function (p) { return { p: p, t: nextChange(p, now) } }).sort(function (a, b) { return a.t - b.t })[0]
      return 'Nobody is in right now. ' + first(nx.p.name) + ' is first back, ' + when(VTZ, nx.t, now) + ' your time.'
    }
    return r.note || first(T[0].name) + ' replies within ' + r.say + '.'
  }
  function hands(ms) {
    var x = parts(VTZ, ms)
    return { h: ((x.m / 60) % 12) * 30, m: (x.m % 60) * 6 }
  }
  var handEl = { h: $('.ck-hh'), m: $('.ck-mh') }, handNow = { h: 0, m: 0 }
  function setHands(a) { handNow = a; handEl.h.setAttribute('transform', 'rotate(' + a.h.toFixed(2) + ' 18 18)'); handEl.m.setAttribute('transform', 'rotate(' + a.m.toFixed(2) + ' 18 18)') }
  function turnHands(to, instant) {
    var from = handNow
    var dm = ((to.m - from.m) % 360 + 540) % 360 - 180, dh = ((to.h - from.h) % 360 + 540) % 360 - 180
    if (instant) return setHands(to)
    anim(0.42, function (p) { setHands({ h: from.h + dh * p, m: from.m + dm * p }) }, { ease: OUTIN })
  }
  function placeIndicator(r, instant) {
    var row = rowEls[routes.indexOf(r)], box = row.parentNode
    var top = row.offsetTop, h = row.offsetHeight
    var ft = parseFloat(ind.style.top) || 0, fh = parseFloat(ind.style.height) || 0
    rowEls.forEach(function (x) { x.classList.toggle('on', x === row) })
    if (instant || !fh) { ind.style.top = top + 'px'; ind.style.height = h + 'px'; return }
    anim(0.3, function (p) { ind.style.top = ft + (top - ft) * p + 'px'; ind.style.height = fh + (h - fh) * p + 'px' })
  }
  /** shape the slip to a reason: its fields, order, labels, widths and requirements */
  function shape(r) {
    var keys = r.fields.map(function (f) { return f.k })
    Object.keys(fieldEls).forEach(function (k) {
      var el = fieldEls[k], i = keys.indexOf(k)
      var on = i >= 0
      el.hidden = !on
      el.querySelectorAll('input,select,textarea').forEach(function (x) { x.disabled = !on })
      if (!on) return
      var f = r.fields[i]
      el.style.order = String(i)
      el.classList.toggle('half', !!f.half)
      var lab = el.querySelector('.ck-lab')
      if (lab.textContent !== f.label) lab.textContent = f.label
      el.querySelector('[data-opt]').hidden = !!f.required
      var hint = el.querySelector('[data-hint]')
      hint.textContent = f.hint; hint.hidden = !f.hint
      var ctl = el.querySelector('input:not([type=radio]),select,textarea')
      if (ctl) { ctl.required = f.required; if ('placeholder' in ctl && ctl.tagName !== 'SELECT') ctl.placeholder = f.placeholder || '' }
      else el.querySelectorAll('input[type=radio]').forEach(function (x, j) { x.required = f.required && j === 0 })
      el.setAttribute('aria-required', f.required ? 'true' : 'false')
    })
    form.setAttribute('data-route', r.id)
    form.action = C.endpoint || 'mailto:' + r.email
    var mail = $('[data-mail]'); mail.href = 'mailto:' + r.email; mail.textContent = r.email
  }
  function writeHeader(r, now, animate) {
    var e = etaHtml(r, now)
    var put = animate ? swap : function (el, h) { el.innerHTML = h }
    put($('[data-to]'), toLine(r))
    put($('[data-re]'), esc(r.title))
    put($('[data-eta]'), e.main)
    put($('[data-eta-note]'), esc(etaNote(r, now)))
    put($('[data-send]'), esc(sendLabel(r)))
    turnHands(hands(e.at), !animate)
  }
  var rects = function () {
    var box = fieldsBox.getBoundingClientRect(), out = {}
    Object.keys(fieldEls).forEach(function (k) { var el = fieldEls[k]; if (!el.hidden) { var b = el.getBoundingClientRect(); out[k] = { x: b.left - box.left, y: b.top - box.top, w: b.width, h: b.height } } })
    return { box: box, f: out }
  }
  /** choose a reason: the slip morphs; fields both reasons share stay where they are (or glide), the others leave and arrive */
  function choose(id, instant) {
    var r = routes.filter(function (x) { return x.id === id })[0]
    if (!r) return
    var radio = rowEls[routes.indexOf(r)].querySelector('input')
    radio.checked = true
    if (r === cur && !instant) return
    var before = rects()
    var oldH = fieldsBox.offsetHeight
    cur = r
    clearErrors()
    shape(r)
    placeIndicator(r, instant)
    writeHeader(r, nowMs(), !instant)
    if (instant || reduce) return
    var after = rects()
    var newH = fieldsBox.offsetHeight
    fieldsBox.style.height = oldH + 'px'
    anim(0.36, function (p) { fieldsBox.style.height = oldH + (newH - oldH) * p + 'px'; if (p === 1) fieldsBox.style.height = '' }, { ease: OUTIN })
    var entering = 0
    Object.keys(fieldEls).forEach(function (k) {
      var el = fieldEls[k], a = before.f[k], b = after.f[k]
      if (a && b) {
        var dx = a.x - b.x, dy = a.y - b.y, sw = a.w / b.w
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(1 - sw) * 100 < 0.5) return
        anim(0.36, function (p) { el.style.transform = p === 1 ? '' : 'translate(' + dx * (1 - p) + 'px,' + dy * (1 - p) + 'px)' }, { ease: OUTIN })
      } else if (a && !b) {
        // leaving: held where it was, faded out over the incoming layout
        el.hidden = false
        el.style.position = 'absolute'; el.style.left = a.x + 'px'; el.style.top = a.y + 'px'; el.style.width = a.w + 'px'; el.style.margin = '0'
        el.style.pointerEvents = 'none'
        el.setAttribute('aria-hidden', 'true')
        anim(0.16, function (p) { el.style.opacity = String(1 - p) }, { ease: function (p) { return p }, end: function () { el.hidden = cur.fields.every(function (f) { return f.k !== el.getAttribute('data-k') }); ['position', 'left', 'top', 'width', 'margin', 'opacity', 'pointerEvents'].forEach(function (s) { el.style[s] = '' }); el.removeAttribute('aria-hidden') } })
      } else if (b && !a) {
        var i = entering++
        anim(0.3, function (p) { el.style.opacity = p === 1 ? '' : String(p); el.style.transform = p === 1 ? '' : 'translateY(' + 10 * (1 - p) + 'px)' }, { delay: 0.16 + i * 0.05 })
      }
    })
  }
  rowEls.forEach(function (row) { row.querySelector('input').addEventListener('change', function (e) { if (e.target.checked) choose(e.target.value) }) })

  /* ---------- validation, sending, states ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  function fdef(k) { return cur.fields.filter(function (f) { return f.k === k })[0] }
  function valueOf(k) {
    var el = fieldEls[k]
    var radios = el.querySelectorAll('input[type=radio]')
    if (radios.length) { for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i].value; return '' }
    return el.querySelector('input,select,textarea').value.trim()
  }
  function problem(f) {
    var v = valueOf(f.k), who = first(team(cur)[0].name)
    if (!v) return f.required ? (f.type === 'choice' || f.type === 'swatch' ? 'Pick one, so ' + (team(cur).length > 1 ? 'we' : who) + ' can start in the right place.' : f.type === 'email' ? 'We need an email to write back to.' : 'This one is needed.') : null
    if (f.type === 'email' && !EMAIL.test(v)) return v.indexOf('@') < 0 ? 'This email has no @ in it. We need it to write back.' : 'This email looks unfinished. Check the part after the @.'
    if (f.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) return 'This does not look like a link. It should start with https://'
    if (f.pattern && !new RegExp('^(?:' + f.pattern + ')$').test(v.toUpperCase())) return f.patternMessage
    return null
  }
  function markField(f, msg) {
    var el = fieldEls[f.k], ctl = el.querySelector('input:not([type=radio]),select,textarea') || el
    var err = el.querySelector('.ck-err'), id = 'ck-f-' + f.k + '-e'
    el.classList.toggle('bad', !!msg)
    var target = el.classList.contains('ck-f-group') ? el : ctl
    if (msg) {
      if (!err) { err = document.createElement('span'); err.className = 'ck-err'; err.id = id; el.appendChild(err) }
      err.textContent = msg
      target.setAttribute('aria-invalid', 'true')
      target.setAttribute('aria-describedby', 'ck-f-' + f.k + '-h ' + id)
    } else {
      if (err) err.remove()
      target.removeAttribute('aria-invalid')
      target.setAttribute('aria-describedby', 'ck-f-' + f.k + '-h')
    }
  }
  function clearErrors() { routes.forEach(function (r) { r.fields.forEach(function (f) { if (fieldEls[f.k]) markField(f, null) }) }); $('[data-errsum]').textContent = ''; tried = false }
  var tried = false
  function validateAll() {
    var bad = []
    cur.fields.forEach(function (f) { var m = problem(f); markField(f, m); if (m) bad.push(f) })
    $('[data-errsum]').textContent = bad.length ? (bad.length === 1 ? 'One thing to fix before this can go: ' : bad.length + ' things to fix before this can go: ') + bad.map(function (f) { return f.label }).join(', ') + '.' : ''
    return bad
  }
  fieldsBox.addEventListener('input', function (e) {
    saveDraft()
    if (!tried) return
    var k = e.target.closest('.ck-f').getAttribute('data-k'), f = fdef(k)
    if (f && fieldEls[k].classList.contains('bad')) markField(f, problem(f))
  })
  fieldsBox.addEventListener('focusout', function (e) {
    if (!tried) return
    var el = e.target.closest('.ck-f'); if (!el) return
    var f = fdef(el.getAttribute('data-k')); if (f) markField(f, problem(f))
  })
  function saveDraft() {
    if (REC) return
    var d = { route: cur.id }
    Object.keys(fieldEls).forEach(function (k) { d[k] = valueOf(k) })
    store.set(DRAFT, JSON.stringify(d))
  }
  function fill(d) {
    Object.keys(d || {}).forEach(function (k) {
      var el = fieldEls[k]; if (!el) return
      var radios = el.querySelectorAll('input[type=radio]')
      if (radios.length) radios.forEach(function (x) { x.checked = x.value === d[k] })
      else el.querySelector('input,select,textarea').value = d[k]
    })
  }
  var state = 'ready', refNo = ''
  function setState(s) { state = s; slip.setAttribute('data-state', s); root.setAttribute('data-state', s) }
  function banner(html) { var b = $('[data-banner]'); if (!html) { b.hidden = true; b.innerHTML = ''; return } b.innerHTML = html; b.hidden = false }
  function mailtoHref() {
    var lines = cur.fields.map(function (f) { return f.label + ': ' + valueOf(f.k) })
    return 'mailto:' + cur.email + '?subject=' + encodeURIComponent(cur.title + (refNo ? ' (' + refNo + ')' : '')) + '&body=' + encodeURIComponent(lines.join('\n'))
  }
  function makeRef(now) {
    var x = parts(VTZ, now)
    var n = REC ? (PV.ref || '001') : String(Math.floor(Math.random() * 900) + 100)
    return cur.ref + '-' + String(x.mo).padStart(2, '0') + String(x.d).padStart(2, '0') + '-' + n
  }
  var api = { dry: REC }
  function submit() {
    if (state === 'sending' || state === 'sent') return
    tried = true
    var trap = form.querySelector('[name="' + C.honeypot + '"]')
    var bad = validateAll()
    if (bad.length) {
      setState('invalid')
      var el = fieldEls[bad[0].k], ctl = el.querySelector('input,select,textarea')
      ctl.focus({ preventScroll: REC })
      return
    }
    refNo = makeRef(nowMs())
    if (trap && trap.value) { sent(true); return }
    if (!navigator.onLine && !api.dry) { offline(true); return }
    setState('sending')
    banner('')
    var btn = $('.ck-send'), bar = $('.ck-bar')
    btn.disabled = true
    swap($('[data-send]'), 'Sending to ' + esc(team(cur).length > 1 ? 'the ' + cur.desk.toLowerCase() : first(team(cur)[0].name)) + '…', 0.2)
    anim(0.9, function (p) { bar.style.transform = 'scaleX(' + (0.08 + 0.92 * p) + ')' }, { ease: function (p) { return 1 - Math.pow(1 - p, 2) } })
    if (api.dry) { later(0.95, function () { sent(false) }); return }
    if (!C.endpoint) {
      later(0.5, function () { location.href = mailtoHref(); sent(false, true) })
      return
    }
    var body = { reason: cur.id, to: cur.to, ref: refNo, sentAt: new Date(nowMs()).toISOString(), visitorTimeZone: VTZ }
    cur.fields.forEach(function (f) { body[f.k] = valueOf(f.k) })
    var ctl = 'AbortController' in window ? new AbortController() : null
    var slow = setTimeout(function () { banner('<span class="ck-dot"></span><span><b>This is taking longer than usual.</b> It may still go through. If not, <a href="' + esc(mailtoHref()) + '">send it by email</a> instead.</span>') }, 8000)
    var stop = setTimeout(function () { if (ctl) ctl.abort() }, 20000)
    fetch(C.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: ctl && ctl.signal })
      .then(function (res) { if (!res.ok) throw new Error(String(res.status)); sent(false) })
      .catch(function () { failed() })
      .then(function () { clearTimeout(slow); clearTimeout(stop) })
  }
  var timers = []
  function later(s, fn) { if (REC) timers.push({ t: recT + s, fn: fn }); else setTimeout(fn, reduce ? 0 : s * 1000) }
  function resetButton() {
    var btn = $('.ck-send'); btn.disabled = false
    $('.ck-bar').style.transform = ''
    $('[data-send]').innerHTML = esc(sendLabel(cur))
  }
  function failed() {
    setState('failed')
    resetButton()
    banner('<span class="ck-dot"></span><span><b>This did not go through.</b> Nothing is lost: try again, or <a href="' + esc(mailtoHref()) + '">send it by email</a> to ' + esc(cur.email) + '.</span>')
  }
  function offline(on) {
    if (on) {
      setState('offline')
      saveDraft()
      store.set(DRAFT + '-pending', '1')
      $('.ck-send').disabled = true
      banner('<span class="ck-dot"></span><span><b>You are offline.</b> Your note is kept on this device and goes as soon as you are back. Or <a href="' + esc(mailtoHref()) + '">open it in your email app</a>.</span>')
    } else if (state === 'offline') {
      banner(''); resetButton(); setState('ready')
      if (store.get(DRAFT + '-pending')) { store.set(DRAFT + '-pending', null); submit() }
    }
  }
  addEventListener('offline', function () { if (state === 'ready' || state === 'invalid') banner('<span class="ck-dot"></span><span><b>You are offline.</b> Keep writing; your note is kept on this device and goes when you are back.</span>') })
  addEventListener('online', function () { if (state === 'offline') offline(false); else if (state === 'ready' || state === 'invalid') banner('') })
  function sent(silent, viaMail) {
    var now = nowMs(), T = team(cur)
    var on = anyOpen(T, now)
    var lead = on || T.map(function (p) { return { p: p, t: nextChange(p, now) } }).sort(function (a, b) { return a.t - b.t })[0].p
    var readAt = on ? now + 45 * 6e4 : nextChange(lead, now) + 30 * 6e4
    var rb = replyBy(cur, now)
    var name = fieldEls.name ? first(valueOf('name')) : ''
    var fillIn = function (s) { return s.replace(/\{name\}/g, name).replace(/\{first\}/g, first(lead.name)).replace(/\{city\}/g, lead.city).replace(/^Thank you, \./, 'Thank you.').replace(/^Got it, \./, 'Got it.').replace(/^Thanks, \./, 'Thanks.').replace(/, \./, '.') }
    var email = valueOf('email')
    var head = viaMail ? 'Over to your email app.' : fillIn(cur.sent.headline)
    var lead1 = viaMail ? 'Your email app should have opened with the note, addressed to ' + esc(cur.email) + '. Press send there, and it reaches ' + esc(first(lead.name)) + '.' : 'A copy is on its way to ' + esc(email) + '. Reply to that email to add anything later.'
    var box = $('[data-sent]')
    box.innerHTML = '<p class="ck-lbl ok"><span class="ck-dot on"></span>' + (viaMail ? 'Ready to send' : 'Sent') + ' · ' + fmtT(VTZ, now) + ' your time</p><h3>' + esc(head) + '</h3><p>' + lead1 + '</p><ol>' +
      '<li><span class="ck-lbl">' + fmtT(VTZ, now) + ' · now</span><span>' + (viaMail ? 'Written, with reference ' : 'Received and filed under ') + esc(refNo) + '</span></li>' +
      '<li><span class="ck-lbl">' + esc(rel(VTZ, readAt, now) === 'today' ? 'by ' + fmtT(VTZ, readAt) : when(VTZ, readAt, now)) + '</span><span>' + esc(first(lead.name)) + ' reads it ' + esc(fillIn(cur.sent.read)) + '</span></li>' +
      '<li><span class="ck-lbl">by ' + esc(rel(VTZ, rb, now) === 'today' ? fmtT(VTZ, rb) : (rel(VTZ, rb, now).length === 3 || rel(VTZ, rb, now) === 'tomorrow' ? rel(VTZ, rb, now) : fmtD(VTZ, rb)) + ' ' + fmtT(VTZ, rb)) + '</span><span>A reply from ' + esc(first(lead.name)) + ', ' + esc(fillIn(cur.sent.reply)) + '</span></li></ol>'
    var oldH = slip.offsetHeight
    $('[data-ref-l]').textContent = 'Ref'
    $('[data-ref]').textContent = refNo
    var hide = [$('.ck-eta'), fieldsBox, $('.ck-slip-ft'), $('[data-errsum]'), $('[data-banner]')]
    hide.forEach(function (el) { el.hidden = true })
    box.hidden = false
    setState('sent')
    store.set(DRAFT, null); store.set(DRAFT + '-pending', null)
    rowEls.forEach(function (row) { row.querySelector('input').disabled = true })
    if (!REC) box.focus({ preventScroll: false })
    if (reduce) return
    var newH = slip.offsetHeight
    slip.style.height = oldH + 'px'
    anim(0.45, function (p) { slip.style.height = p === 1 ? '' : oldH + (newH - oldH) * p + 'px' }, { ease: OUTIN })
    $$('h3, p, li', box).forEach(function (el, i) { anim(0.32, function (p) { el.style.opacity = p === 1 ? '' : String(p); el.style.transform = p === 1 ? '' : 'translateY(' + 8 * (1 - p) + 'px)' }, { delay: 0.1 + i * 0.06 }) })
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); submit() })

  /* ---------- live status: board, reasons, rota, offices ---------- */
  var rota = $('[data-rota]')
  var people = Object.keys(C.people).map(function (id) { return { id: id, p: C.people[id], row: $('[data-person="' + id + '"]') } })
  function floor3(now) { var x = parts(VTZ, now); return Math.floor(now / 6e4) * 6e4 - (x.m % 180) * 6e4 }
  var lastMinute = -1, rotaIn = reduce
  function renderLive(force) {
    var now = nowMs(), minute = Math.floor(now / 6e4)
    if (minute === lastMinute && !force) return
    lastMinute = minute
    // board and offices
    $$('[data-board]').forEach(function (li) {
      var o = C.offices[+li.getAttribute('data-board')], s = status(o, now)
      li.querySelector('.ck-dot').classList.toggle('on', s.open)
      li.querySelector('[data-bst]').textContent = ' · ' + (s.open ? 'open' : 'opens ' + (rel(o.tz, s.next, now) === 'today' ? 'at ' + fmtT(o.tz, s.next) : rel(o.tz, s.next, now) === 'tomorrow' ? fmtT(o.tz, s.next) + ' tomorrow' : rel(o.tz, s.next, now) + ' ' + fmtT(o.tz, s.next)))
      li.querySelector('[data-btime]').textContent = fmtT(o.tz, now)
    })
    $$('[data-office]').forEach(function (art) {
      var o = C.offices[+art.getAttribute('data-office')], open = isOpen(o, now), nx = nextChange(o, now)
      var r = rel(o.tz, nx, now)
      art.querySelector('[data-ostatus]').innerHTML = '<span><b><span class="ck-dot' + (open ? ' on' : '') + '"></span>' + (open ? 'Open now' : 'Opens ' + (r === 'today' ? 'at ' + fmtT(o.tz, nx) : r === 'tomorrow' ? fmtT(o.tz, nx) + ' tomorrow' : r + ' ' + fmtT(o.tz, nx))) + '</b><small>' + (open ? 'until ' + fmtT(o.tz, nx) + ' · ' : '') + '<span class="ck-time">' + fmtT(o.tz, now) + ' local</span></small></span>'
    })
    routes.forEach(function (r, i) {
      var on = anyOpen(team(r), now), row = rowEls[i]
      row.querySelector('[data-route-dot]').classList.toggle('on', !!on)
      row.querySelector('[data-route-here]').textContent = on ? (team(r).length > 1 ? first(on.name) + ' is in' : 'In now') : 'Away'
    })
    if (state !== 'sent') writeHeader(cur, now, false)
    renderRota(now)
  }
  var nowEls = { line: $('[data-nowline]'), chip: $('[data-nowchip]') }
  var rotaStart = 0
  function renderRota(now) {
    var start = floor3(now) - 6 * 36e5, span = 24 * 36e5
    rotaStart = start
    var pct = function (t) { return ((t - start) / span) * 100 }
    var ruler = $('[data-ruler]')
    var html = ''
    for (var k = 0; k <= 8; k++) html += '<span class="ck-tick' + (k % 2 ? ' odd' : '') + '" style="left:' + k * 12.5 + '%">' + (k < 8 ? '<span>' + fmtT(VTZ, start + k * 3 * 36e5) + '</span>' : '') + '</span>'
    ruler.innerHTML = html
    $('[data-tz-note]').textContent = 'Times are yours (' + cityOf(VTZ) + '). Boxes show when each person works; the line is now.'
    people.forEach(function (x) {
      var p = x.p, track = x.row.querySelector('[data-track]'), spans = [], open = null
      for (var t = start; t <= start + span; t += STEP) {
        var o = t < start + span && isOpen(p, t)
        if (o && open == null) open = t
        if (!o && open != null) { spans.push([open, t]); open = null }
      }
      var h = '<span class="ck-base"></span><span class="ck-nowtick" style="left:' + pct(now).toFixed(3) + '%"></span>'
      spans.forEach(function (s) { h += '<span class="ck-blk' + (s[0] <= now && now < s[1] ? ' live' : '') + '" style="left:' + pct(s[0]).toFixed(3) + '%;width:' + (pct(s[1]) - pct(s[0])).toFixed(3) + '%"></span>' })
      var st = status(p, now)
      if (!spans.length) h += '<span class="ck-nextm">next: ' + esc(rel(VTZ, st.next, now) === 'tomorrow' ? 'tomorrow ' + fmtT(VTZ, st.next) : (rel(VTZ, st.next, now).length === 3 ? rel(VTZ, st.next, now) : fmtD(VTZ, st.next)) + ' ' + fmtT(VTZ, st.next)) + ' →</span>'
      track.innerHTML = h
      track.setAttribute('role', 'img')
      track.setAttribute('aria-label', p.name + ': ' + (spans.length ? spans.map(function (s) { return fmtT(VTZ, s[0]) + ' to ' + fmtT(VTZ, s[1]) }).join(' and ') + ' your time' : 'not working in these 24 hours'))
      x.row.querySelector('[data-status]').innerHTML = '<span class="ck-dot' + (st.open ? ' on' : '') + '"></span><span><b>' + esc(st.line) + '</b><small>' + esc(st.sub) + '</small><small class="ck-loc">' + fmtT(p.tz, now) + ' in ' + esc(p.city) + '</small></span>'
    })
    nowEls.chip.textContent = 'Now ' + fmtT(VTZ, now)
    nowEls.chip.hidden = false
    nowEls.chip.style.left = pct(now).toFixed(3) + '%'
    nowEls.line.hidden = false
    placeNowLine()
    if (!rotaIn) hideRota()
  }
  function placeNowLine() {
    var tracks = $$('[data-track]')
    if (!tracks.length) return
    var rb = rota.getBoundingClientRect(), a = tracks[0].getBoundingClientRect(), z = tracks[tracks.length - 1].getBoundingClientRect()
    var rl = $('[data-ruler]'); rl.classList.toggle('sparse', rl.getBoundingClientRect().width < 520)
    var ruler = rl.getBoundingClientRect()
    var x = a.left + a.width * ((nowMs() - rotaStart) / (24 * 36e5)) - rb.left
    nowEls.line.style.left = x - 1 + 'px'
    nowEls.line.style.top = ruler.bottom - rb.top + 'px'
    nowEls.line.style.height = z.bottom - ruler.bottom + 10 + 'px'
  }
  function hideRota() {
    $$('.ck-blk, .ck-nextm', rota).forEach(function (b) { b.style.transform = 'scaleX(0)'; b.style.opacity = '0' })
    nowEls.line.style.transform = 'scaleY(0)'; nowEls.chip.style.opacity = '0'
    $$('.ck-nowtick', rota).forEach(function (b) { b.style.transform = 'scaleY(0)' })
  }

  /* ---------- plans: the phone crop, labels held at 12 px ---------- */
  var plans = $$('.ck-plan')
  function fitPlans() {
    plans.forEach(function (svg) {
      var w = svg.getBoundingClientRect().width
      if (!w) return
      var vb = (w < 520 ? svg.getAttribute('data-crop') : svg.getAttribute('data-full')).split(' ').map(Number)
      svg.setAttribute('viewBox', vb.join(' '))
      var k = Math.max(1, vb[2] / w)
      $$('.ck-pl-lb', svg).forEach(function (t) { t.setAttribute('font-size', (12 * k).toFixed(2)); t.style.strokeWidth = (4 * k).toFixed(2) + 'px'; t.style.letterSpacing = k > 1.15 ? '.04em' : '' })
      var mk = Math.min(k, 1.8)
      $$('.ck-pl-mk', svg).forEach(function (g) { g.setAttribute('data-k', mk); g.setAttribute('transform', 'translate(' + g.getAttribute('data-x') + ' ' + g.getAttribute('data-y') + ') scale(' + mk.toFixed(3) + ')' + (g.getAttribute('data-s') ? ' ' + g.getAttribute('data-s') : '')) })
      // labels that would run off the view slide back inside it
      $$('.ck-pl-lb', svg).forEach(function (t) {
        if (!t.hasAttribute('data-x0')) t.setAttribute('data-x0', t.getAttribute('x'))
        t.setAttribute('x', t.getAttribute('data-x0'))
        if (t.getAttribute('transform')) return
        var bb = t.getBBox(), pad = 6 * k, x = +t.getAttribute('x')
        if (bb.x < vb[0] + pad) x += vb[0] + pad - bb.x
        else if (bb.x + bb.width > vb[0] + vb[2] - pad) x -= bb.x + bb.width - (vb[0] + vb[2] - pad)
        t.setAttribute('x', x.toFixed(2))
      })
      // the scale bar and the north point take the first corner where they cover no label, mark or each other
      var n = $('.ck-pl-n', svg), sc = $('.ck-pl-sc', svg), u = +sc.getAttribute('data-units')
      $$('text', sc).forEach(function (t) { t.setAttribute('font-size', (12 * k).toFixed(2)); t.setAttribute('x', u + 6 * k) })
      var busy = $$('.ck-pl-lb, .ck-pl-mk', svg).map(function (e) { return e.getBoundingClientRect() })
      var hit = function (r) { return busy.some(function (q) { return !(r.right < q.left - 4 || r.left > q.right + 4 || r.bottom < q.top - 4 || r.top > q.bottom + 4) }) }
      var X0 = vb[0], Y0 = vb[1], X1 = vb[0] + vb[2], Y1 = vb[1] + vb[3], scw = u + 50 * k
      var place = function (el, spots, scale) {
        for (var i = 0; i < spots.length; i++) {
          el.setAttribute('transform', 'translate(' + spots[i][0].toFixed(2) + ' ' + spots[i][1].toFixed(2) + ')' + scale)
          if (!hit(el.getBoundingClientRect())) return
        }
        el.setAttribute('transform', 'translate(' + spots[0][0].toFixed(2) + ' ' + spots[0][1].toFixed(2) + ')' + scale)
      }
      place(sc, [[X1 - scw - 8 * k, Y1 - 16 * k], [X0 + 16 * k, Y1 - 16 * k], [X0 + 16 * k, Y0 + 22 * k], [X1 - scw - 8 * k, Y0 + 22 * k]], '')
      busy.push(sc.getBoundingClientRect())
      place(n, [[X1 - 24 * mk, Y0 + 30 * mk], [X0 + 24 * mk, Y0 + 30 * mk], [X0 + 24 * mk, Y1 - 44 * mk], [X1 - 24 * mk, Y1 - 44 * mk]], ' scale(' + mk.toFixed(3) + ')')
    })
  }
  function hidePlan(svg) {
    var m = $('.ck-pl-reveal', svg); m.style.strokeDashoffset = m.getAttribute('data-len')
    $$('.ck-pl-mk', svg).forEach(function (g) { g.style.opacity = '0' })
  }
  function enterPlan(svg) {
    var m = $('.ck-pl-reveal', svg), len = +m.getAttribute('data-len')
    anim(1.0, function (p) { m.style.strokeDashoffset = String(len * (1 - p)) }, { ease: OUTIN })
    $$('.ck-pl-mk', svg).forEach(function (g, i) {
      anim(0.22, function (p) { g.style.opacity = p === 1 ? '' : String(p); g.setAttribute('data-s', p === 1 ? '' : 'scale(' + (0.5 + 0.5 * p) + ')'); var k = g.getAttribute('data-k') || 1; g.setAttribute('transform', 'translate(' + g.getAttribute('data-x') + ' ' + g.getAttribute('data-y') + ') scale(' + (+k * (p === 1 ? 1 : 0.5 + 0.5 * p)).toFixed(3) + ')') }, { delay: 0.3 + i * 0.28 })
    })
  }

  /* ---------- entrances: once each, when a part comes into view ---------- */
  var parts3 = { desk: false, rota: false, plans: plans.length === 0 }
  function enterDesk() {
    if (parts3.desk) return
    parts3.desk = true
    root.setAttribute('data-in-desk', '')
    var head = [$('.ck-eyebrow'), $('.ck-h'), $('.ck-board')].filter(Boolean)
    head.forEach(function (el, i) { anim(0.6, function (p) { el.style.opacity = p === 1 ? '' : String(p); el.style.transform = p === 1 ? '' : 'translateY(' + 14 * (1 - p) + 'px)' }, { delay: i * 0.08 }) })
    rowEls.forEach(function (el, i) { anim(0.46, function (p) { el.style.opacity = p === 1 ? '' : String(p); el.style.transform = p === 1 ? '' : 'translateY(' + 10 * (1 - p) + 'px)' }, { delay: 0.2 + i * 0.06 }) })
    var ft = parseFloat(ind.style.height) || 0
    anim(0.4, function (p) { ind.style.transform = p === 1 ? '' : 'scaleY(' + p + ')'; ind.style.transformOrigin = 'top' }, { delay: 0.5 })
    var right = $('.ck-right')
    anim(0.62, function (p) { right.style.opacity = p === 1 ? '' : String(p); right.style.transform = p === 1 ? '' : 'translateY(' + 16 * (1 - p) + 'px)' }, { delay: 0.3 })
  }
  function enterRota() {
    if (parts3.rota) return
    parts3.rota = rotaIn = true
    root.setAttribute('data-in-rota', '')
    people.forEach(function (x, r) {
      $$('.ck-blk, .ck-nextm', x.row).forEach(function (b) { anim(0.62, function (p) { b.style.transform = p === 1 ? '' : 'scaleX(' + p + ')'; b.style.opacity = p === 1 ? '' : String(Math.min(1, p * 2)) }, { delay: r * 0.07, ease: OUTIN }) })
      var tk = x.row.querySelector('.ck-nowtick')
      if (tk) anim(0.3, function (p) { tk.style.transform = p === 1 ? '' : 'scaleY(' + p + ')' }, { delay: 0.55 + r * 0.04 })
    })
    anim(0.36, function (p) { nowEls.line.style.transform = p === 1 ? '' : 'scaleY(' + p + ')' }, { delay: 0.55 })
    anim(0.24, function (p) { nowEls.chip.style.opacity = p === 1 ? '' : String(p) }, { delay: 0.5 })
  }
  function enterPlans() {
    if (parts3.plans) return
    parts3.plans = true
    root.setAttribute('data-in-plans', '')
    plans.forEach(enterPlan)
  }
  function settle() {
    if (parts3.desk && parts3.rota && parts3.plans && !anims.length && !root.hasAttribute('data-settled')) root.setAttribute('data-settled', '')
  }
  function hideDesk() {
    ;[$('.ck-eyebrow'), $('.ck-h'), $('.ck-board'), $('.ck-right')].concat(rowEls).forEach(function (el) { if (el) el.style.opacity = '0' })
    ind.style.transform = 'scaleY(0)'
  }

  /* ---------- start ---------- */
  shape(cur)
  if (!REC) { var saved = store.get(DRAFT); if (saved) { try { var d = JSON.parse(saved); fill(d); if (d.route && d.route !== cur.id) choose(d.route, true) } catch (e) {} } }
  if (REC && PV.draft) fill(PV.draft)
  placeIndicator(cur, true)
  renderLive(true)
  fitPlans()
  if (reduce) {
    rotaIn = true
    renderLive(true)
    parts3 = { desk: true, rota: true, plans: true }
    root.setAttribute('data-in-desk', ''); root.setAttribute('data-in-rota', ''); root.setAttribute('data-in-plans', '')
    settle()
  } else {
    hideDesk(); hideRota(); plans.forEach(hidePlan)
    if (!REC && 'IntersectionObserver' in window) {
      var watch = function (el, fn) { if (!el) { fn(); return } var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn() } }) }, { threshold: 0.3 }); io.observe(el) }
      watch($('.ck-desk'), enterDesk)
      watch(rota, enterRota)
      watch($('.ck-visit'), enterPlans)
    } else if (!REC) { enterDesk(); enterRota(); enterPlans() }
  }
  var rz = 0
  addEventListener('resize', function () { cancelAnimationFrame(rz); rz = requestAnimationFrame(function () { fitPlans(); placeNowLine(); if (cur) placeIndicator(cur, true) }) })
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitPlans(); placeNowLine(); placeIndicator(cur, true) })
  if (!REC && !pinned) setInterval(function () { renderLive(false) }, 15000)

  /* ---------- the recorder's script ---------- */
  // A fixed sequence on the clock: the desk arrives, the slip morphs to
  // another reason and back, the page moves down to the rota and the plans,
  // back up, the note is sent. moments() lists the stretches where nothing
  // moves; stills and posters are taken inside them.
  var other = PV.switchTo || routes[1].id
  var SCRIPT = [
    { t: 0.25, fn: enterDesk },
    { t: 3.3, fn: function () { choose(other) } },
    { t: 5.1, fn: function () { choose(routes[0].id) } },
    { t: 7.4, fn: function () { enterRota(); enterPlans() } },
    { t: 10.9, fn: enterPlans },
    { t: 15.0, fn: submit },
  ]
  var SCROLL = [[0, 'top'], [6.2, 'top'], [7.4, 'rota'], [9.7, 'rota'], [10.9, 'visit'], [13.3, 'visit'], [14.6, 'slip']]
  var LENGTH = 18.5
  var STILL = [[1.7, 3.3], [4.0, 5.1], [5.8, 6.2], [8.9, 9.7], [12.4, 13.3], [16.6, 18.5]]
  function anchorY(name) {
    var max = document.documentElement.scrollHeight - innerHeight
    var y = 0
    if (name === 'rota') y = $('.ck-sec .ck-sec-hd').getBoundingClientRect().top + scrollY - 40
    else if (name === 'visit') { var v = $('.ck-visit'); y = v ? v.closest('.ck-sec').querySelector('.ck-sec-hd').getBoundingClientRect().top + scrollY - 40 : 0 }
    else if (name === 'slip') y = innerWidth < 900 ? $('.ck-right').getBoundingClientRect().top + scrollY - 24 : 0
    return Math.max(0, Math.min(max, y))
  }
  function scrollAt(t) {
    for (var i = 1; i < SCROLL.length; i++) {
      if (t < SCROLL[i][0]) {
        var a = SCROLL[i - 1], b = SCROLL[i], p = (t - a[0]) / (b[0] - a[0])
        var ya = anchorY(a[1]), yb = anchorY(b[1])
        return ya + (yb - ya) * OUTIN(p)
      }
    }
    return anchorY(SCROLL[SCROLL.length - 1][1])
  }
  var done = 0
  function seek(t) {
    for (; done < SCRIPT.length && SCRIPT[done].t <= t; done++) {
      recT = SCRIPT[done].t
      runTimers(recT)
      tick()
      SCRIPT[done].fn()
      tick()
    }
    runTimers(t)
    recT = t
    tick()
    scrollTo(0, scrollAt(t))
  }
  function runTimers(t) {
    timers.sort(function (a, b) { return a.t - b.t })
    while (timers.length && timers[0].t <= t) { var x = timers.shift(); var keep = recT; recT = x.t; tick(); x.fn(); tick(); recT = keep }
  }
  api.ready = document.fonts && document.fonts.ready ? document.fonts.ready.then(function () { return true }) : Promise.resolve(true)
  api.length = LENGTH
  api.settleMs = 2200
  api.seek = seek
  api.moments = function () { return { stretches: STILL, end: LENGTH, poster: (STILL[0][0] + STILL[0][1]) / 2 } }
  api.choose = function (id) { choose(id) }
  api.form = function (s, value) {
    // for stills of each state: empty, typing, invalid, sending, sent, offline, failed
    if (s === 'empty') { Object.keys(fieldEls).forEach(function (k) { fill(((o) => (o[k] = '', o))({})) }); clearErrors(); return }
    if (s === 'typing') { var el = fieldEls.msg || fieldEls[cur.fields[cur.fields.length - 1].k]; var c = el.querySelector('textarea,input'); if (value != null) c.value = value; c.focus({ preventScroll: true }); return }
    if (s === 'invalid') { var e = fieldEls.email.querySelector('input'); e.value = value != null ? value : e.value.replace('@', ' at ').replace(/\.example$/, ''); submit(); return }
    if (s === 'offline') { api.dry = false; tried = true; if (!validateAll().length) { refNo = makeRef(nowMs()); offline(true) } return }
    if (s === 'failed') { refNo = makeRef(nowMs()); failed(); return }
    if (s === 'sending') { api.dry = true; submit(); recT += 0.5; tick(); return }
    if (s === 'sent') { api.dry = true; submit(); recT += 1.6; runTimers(recT); tick(); recT += 1; tick(); return }
  }
  api.state = function () { return state }
  api.info = function () { return { now: nowMs(), tz: VTZ, route: cur.id, replyBy: replyBy(cur, nowMs()) } }
  window.ContactDesk = api
})()
