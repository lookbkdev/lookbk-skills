/* Booking Slots: the browser runtime. Needs kit/engine.js (window.BookingEngine)
 * before it. No dependencies.
 *
 * window.BookingSlots: ready (a promise), info(), state(), and for the check
 * and the recorder: seek(t), moments(), length, advance(ms), failNext(kind),
 * pick(...), ics(), mailto().
 */
;(function () {
  'use strict'
  var E = window.BookingEngine
  var root = document.querySelector('.bk[data-bk]')
  if (!root || !E) return
  var D = JSON.parse(root.getAttribute('data-bk'))
  var Q = new URLSearchParams(location.search)
  var REC = Q.get('bk-record') === '1'
  var TEST = REC || Q.get('bk-test') === '1'
  var PIN = !!(D.preview && D.preview.pin)
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  var phoneMq = matchMedia('(max-width: 760px)')
  var MIN = 60000
  var $ = function (s, el) { return (el || root).querySelector(s) }
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)) }
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

  /* ---------- clock and zones ---------- */
  var fixed = Q.get('bk-now') || ((REC || PIN) && D.preview.now) || null
  var fixedAt = fixed ? Date.parse(fixed) : null
  var t0 = performance.now()
  var skew = 0
  var recT = 0
  function now() {
    if (REC) return fixedAt + recT * 1000
    if (fixedAt !== null) return fixedAt + (performance.now() - t0) + skew
    return Date.now() + skew
  }
  var SHOP = D.shop.tz
  var VIS = Q.get('bk-tz') || ((REC || PIN) && D.preview.tz) || Intl.DateTimeFormat().resolvedOptions().timeZone || SHOP
  var two = VIS !== SHOP
  var visCity = VIS.split('/').pop().replace(/_/g, ' ')
  var modeQ = TEST && Q.get('bk-mode')
  var MODE = modeQ || D.mode
  var DRY = REC || TEST || PIN
  var loc = D.lang || 'en'
  var fmtDate = function (d, o) { return new Date(d + 'T12:00:00Z').toLocaleDateString(loc === 'en' ? 'en-GB' : loc, Object.assign({ timeZone: 'UTC' }, o)) }
  var dayLong = function (d) { return fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) }
  var dayShort = function (d) { return fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }) }
  var hm = E.hm
  var vis = function (ms) { return E.clock(VIS, ms) }
  function aheadText() {
    var d = E.offsetAt(VIS, now()) - E.offsetAt(SHOP, now())
    if (!d) return 'the same time as ' + D.shop.city + ' today'
    var a = Math.abs(d), h = Math.floor(a / 60), m = a % 60
    return (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '') + (d > 0 ? ' ahead' : ' behind')
  }

  /* ---------- the model ---------- */
  var M = null
  var load = 'ok'
  function makeModel(bookings) {
    M = E.model({ tz: SHOP, hours: D.hours, closed: D.closed, step: D.rules.step, notice: D.rules.notice, horizon: D.rules.horizon, people: D.people, services: D.services, bookings: bookings })
  }
  makeModel(D.bookings)
  var person = function (id) { return E.person(M, id) }
  var service = function (id) { return E.service(M, id) }
  var pdata = function (id) { for (var i = 0; i < D.people.length; i++) if (D.people[i].id === id) return D.people[i] }
  var sdata = function (id) { for (var i = 0; i < D.services.length; i++) if (D.services[i].id === id) return D.services[i] }

  /* ---------- state ---------- */
  var S
  function fresh() {
    var today = E.wallOf(SHOP, now()).date
    return { svc: D.services[0].id, who: D.solo ? 'shop' : 'any', week: weekOf(today), day: null, slot: null, phase: 'pick', hold: null, folded: false, err: {}, note: '', stale: null, failNext: null, reqHref: null, ref: null }
  }
  function weekOf(date) {
    var start = D.rules.weekStart === 'sun' ? 0 : 1
    var back = (E.dowOf(date) - start + 7) % 7
    return E.addDays(date, -back)
  }
  var today = function () { return E.wallOf(SHOP, now()).date }

  /* ---------- motion: Web Animations, driven by the script when recording ---------- */
  var anims = []
  var recClock = 0
  function play(el, kf, o) {
    if (reduce || !el || !el.animate) return null
    var a = el.animate(kf, Object.assign({ fill: REC ? 'both' : 'none', easing: 'cubic-bezier(.2,.7,.2,1)' }, o))
    if (REC) { a.pause(); anims.push({ a: a, at: recClock }) }
    return a
  }

  /* ---------- rendering ---------- */
  function money(s) { return s.price }
  function dayInfo(date) { return E.day(M, S.svc, S.who, date, now()) }
  function runsOf(info, w0, w1) {
    var runs = [], step = D.rules.step
    info.slots.forEach(function (s) {
      var st = { free: 'f', soon: 's', taken: 't', past: 'p' }[s.status]
      if (!st) return
      var L = runs[runs.length - 1]
      if (L && L.st === st && L.b === s.min) L.b = s.min + step
      else runs.push({ st: st, a: s.min, b: s.min + step })
    })
    var Y = function (x) { return ((x - w0) / (w1 - w0)) * 100 }
    return runs.map(function (r) { return '<i class="' + r.st + '" style="top:' + Y(r.a).toFixed(2) + '%;height:calc(' + (Y(Math.min(r.b, w1)) - Y(r.a)).toFixed(2) + '% - 2px)"></i>' }).join('')
  }
  function weekDays() { var out = []; for (var i = 0; i < 7; i++) out.push(E.addDays(S.week, i)); return out }
  function freeCount(info) { var n = 0; info.slots.forEach(function (s) { if (s.status === 'free') n++ }); return n }

  function renderServices() {
    $$('.bk-sv').forEach(function (b) { var on = b.getAttribute('data-svc') === S.svc; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1 })
    var svc = sdata(S.svc)
    $$('.bk-pp').forEach(function (b) {
      var id = b.getAttribute('data-who'), on = id === S.who
      b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1
      var can = id === 'any' || svc.who.indexOf(id) >= 0
      var nx = $('[data-next]', b)
      if (!can) { b.setAttribute('aria-disabled', 'true'); nx.textContent = 'Does not do ' + svc.name.toLowerCase() }
      else {
        b.removeAttribute('aria-disabled')
        var f = load === 'ok' ? E.firstFree(M, S.svc, id, today(), now()) : null
        nx.innerHTML = load !== 'ok' ? '&nbsp;' : f ? 'Next free <b>' + (f.date === today() ? 'today' : esc(fmtDate(f.date, { weekday: 'short', day: 'numeric' }))) + ', ' + hm(f.min) + '</b>' : 'Nothing free in the next ' + D.rules.horizon + ' days'
      }
    })
    var p = S.who === 'any' ? null : pdata(S.who)
    $('[data-sum-a]').textContent = svc.name
    $('[data-sum-b]').textContent = svc.minutes + ' min · ' + money(svc) + (D.solo ? '' : ' · with ' + (p ? p.name.split(' ')[0] : 'anyone free'))
    root.classList.toggle('bk-folded', S.folded)
    $('[data-unfold]').setAttribute('aria-expanded', String(!S.folded))
    $('[data-day-note]').textContent = svc.minutes + ' min' + (p ? ' with ' + p.name.split(' ')[0] : '')
  }

  function renderWeek() {
    var days = weekDays(), t = today()
    var w0 = 1440, w1 = 0
    days.forEach(function (d) { var h = D.hours[E.dowOf(d)]; if (h.length) { w0 = Math.min(w0, h[0][0]); w1 = Math.max(w1, h[h.length - 1][1]) } })
    var lastDay = E.addDays(t, D.rules.horizon)
    $('[data-range]').textContent = fmtDate(days[0], { day: 'numeric', month: days[0].slice(5, 7) === days[6].slice(5, 7) ? undefined : 'short' }) + ' – ' + fmtDate(days[6], { day: 'numeric', month: 'long' })
    var prev = $('[data-wk="-1"]'), next = $('[data-wk="1"]')
    var prevOk = S.week > weekOf(t), nextOk = E.addDays(S.week, 7) <= lastDay
    prev.setAttribute('aria-disabled', String(!prevOk)); next.setAttribute('aria-disabled', String(!nextOk))
    var showPast = false
    var html = days.map(function (d) {
      var info = dayInfo(d)
      var isToday = d === t
      var head = '<span class="bk-dw">' + (isToday ? 'Today' : esc(fmtDate(d, { weekday: 'short' }))) + '</span><span class="bk-dd">' + esc(fmtDate(d, { day: 'numeric' })) + '</span>'
      var label = dayLong(d)
      if (load !== 'ok') return '<button type="button" class="bk-day" role="radio" aria-checked="false" aria-disabled="true" tabindex="-1" aria-label="' + esc(label) + '">' + head + '<span class="bk-runs"></span><span class="bk-ct">–</span></button>'
      if (d < t) return '<button type="button" class="bk-day bk-gone" role="radio" aria-checked="false" aria-disabled="true" tabindex="-1" aria-label="' + esc(label) + ', gone">' + head + '<span class="bk-runs"></span><span class="bk-ct">Gone</span></button>'
      if (info.closed) return '<button type="button" class="bk-day bk-closed" role="radio" aria-checked="false" aria-disabled="true" tabindex="-1" aria-label="' + esc(label) + ', ' + esc(info.closed) + '">' + head + '<span class="bk-runs"></span><span class="bk-ct">' + esc(info.closed.length > 6 ? 'Shut' : info.closed) + '</span></button>'
      if (info.beyond) return '<button type="button" class="bk-day bk-off" role="radio" aria-checked="false" aria-disabled="true" tabindex="-1" aria-label="' + esc(label) + ', not open for booking yet">' + head + '<span class="bk-runs"></span><span class="bk-ct">Later</span></button>'
      if (info.notIn) {
        var h = D.hours[E.dowOf(d)]
        return '<button type="button" class="bk-day bk-off" role="radio" aria-checked="false" aria-disabled="true" tabindex="-1" aria-label="' + esc(label) + ', not in">' + head + '<span class="bk-runs"><i class="o" style="top:' + (((h[0][0] - w0) / (w1 - w0)) * 100).toFixed(2) + '%;height:' + (((h[h.length - 1][1] - h[0][0]) / (w1 - w0)) * 100).toFixed(2) + '%"></i></span><span class="bk-ct">Off</span></button>'
      }
      if (isToday && info.slots.some(function (s) { return s.status === 'past' })) showPast = true
      var n = freeCount(info)
      var sel = d === S.day
      return '<button type="button" class="bk-day' + (isToday ? ' bk-today' : '') + (n ? '' : ' bk-full') + '" role="radio" aria-checked="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" data-day="' + d + '" aria-label="' + esc(label) + ', ' + (n ? n + ' free start' + (n > 1 ? 's' : '') : 'full') + '">' + head + '<span class="bk-runs">' + runsOf(info, w0, w1) + '</span><span class="bk-ct">' + (n ? n + '<span class="bk-ct-w"> free</span>' : 'Full') + '</span></button>'
    }).join('')
    $('[data-week]').innerHTML = html
    if (!$('.bk-day[aria-checked=true]')) { var f = $('.bk-day[data-day]'); if (f) f.tabIndex = 0 }
    $('[data-legend]').innerHTML = '<span><i></i>free</span><span><i class="t"></i>booked</span><span><i class="s"></i>under ' + noticeText() + ' notice</span>' + (showPast ? '<span><i class="p"></i>gone</span>' : '') + '<span>' + hm(w0) + '–' + hm(w1) + ', top to bottom</span>'
  }
  function noticeText() { var n = D.rules.notice; return n % 1440 === 0 && n ? n / 1440 + ' day' + (n > 1440 ? 's' : '') : n % 60 === 0 ? n / 60 + ' h' : n + ' min' }

  function trackHtml(info) {
    var svc = sdata(S.svc)
    var pid = S.slot ? S.slot.person : S.who !== 'any' ? S.who : (function () { for (var i = 0; i < info.slots.length; i++) if (info.slots[i].free.length) return info.slots[i].free[0]; return svc.who[0] })()
    var p = person(pid), pd = pdata(pid)
    var spans = E.workSpans(M, p, S.day)
    var a = info.open[0], b = info.open[1]
    var W = function (x) { return (((Math.max(a, Math.min(b, x)) - a) / (b - a)) * 100).toFixed(3) + '%' }
    var Wd = function (x, y) { return 'left:' + W(x) + ';width:calc(' + W(y) + ' - ' + W(x) + ')' }
    var segs = ''
    var cur = a
    spans.forEach(function (s) { if (s[0] > cur) segs += '<i class="bk-offs" style="' + Wd(cur, s[0]) + '"></i>'; segs += '<i class="bk-wk" style="' + Wd(s[0], s[1]) + '"></i>'; cur = s[1] })
    if (cur < b) segs += '<i class="bk-offs" style="' + Wd(cur, b) + '"></i>'
    if (S.day === today()) { var nw = E.wallOf(SHOP, now() + D.rules.notice * MIN); var until = nw.date === S.day ? nw.min : 1440; segs += '<i class="bk-ntc" style="' + Wd(a, until) + '"></i>' }
    ;(M.busy[pid] || []).forEach(function (bz) {
      var x = E.wallOf(SHOP, bz[0]), y = E.wallOf(SHOP, bz[1])
      if (x.date > S.day || y.date < S.day) return
      segs += '<i class="bk-bz" style="' + Wd(x.date < S.day ? 0 : x.min, y.date > S.day ? 1440 : y.min) + '"></i>'
    })
    if (S.slot) segs += '<i class="bk-blk" data-blk style="' + Wd(S.slot.min, S.slot.min + svc.minutes) + '"></i><i class="bk-buf" style="' + Wd(S.slot.min + svc.minutes, S.slot.min + svc.minutes + svc.buffer) + '"></i>'
    var rul = '', stepH = (b - a) > 600 ? 120 : 60
    var first = Math.ceil(a / 60) * 60
    for (var h = first; h <= b; h += stepH) rul += '<span class="' + (h === first ? 'bk-first' : h + stepH > b ? 'bk-last' : '') + '" style="left:' + W(h) + '">' + hm(h).slice(0, 2) + '</span>'
    var who = D.solo ? '' : esc(pd.name.split(' ')[0]) + "'s day · "
    return '<div class="bk-track"><div class="bk-track-h"><b><span class="bk-wide">' + esc(dayLong(S.day)) + '</span><span class="bk-narrow">' + esc(dayShort(S.day)) + '</span></b><span>' + who + spans.map(function (s) { return hm(s[0]) + '–' + hm(s[1]) }).join(', ') + '</span></div>' +
      '<div class="bk-tl" aria-hidden="true" data-tl>' + segs + '</div><div class="bk-ruler" aria-hidden="true">' + rul + '</div>' +
      '<div class="bk-tl-cap" aria-hidden="true"><span><i class="b"></i>your ' + svc.minutes + ' min</span>' + (svc.buffer ? '<span><i class="u"></i>' + svc.buffer + ' min to reset</span>' : '') + '<span><i class="z"></i>booked</span></div></div>'
  }
  function slotsHtml(info) {
    var parts = [['Morning', 0, 720], ['Afternoon', 720, 1020], ['Evening', 1020, 1440]]
    var soonAny = false
    var html = parts.map(function (pt) {
      var ss = info.slots.filter(function (s) { return s.min >= pt[1] && s.min < pt[2] && s.status !== 'off' && s.status !== 'past' })
      if (!ss.length) return ''
      var free = ss.filter(function (s) { return s.status === 'free' }).length
      return '<div class="bk-sg"><div class="bk-sg-h"><span class="bk-lbl">' + pt[0] + '</span><span class="bk-lbl">' + free + ' of ' + ss.length + ' free</span></div><div class="bk-sg-g">' + ss.map(function (s) {
        var st = s.status, sel = S.slot && S.slot.ms === s.ms
        if (st === 'soon') soonAny = true
        var why = st === 'free' ? 'free' : st === 'soon' ? 'needs ' + noticeText() + ' notice' : 'taken'
        return '<button type="button" class="bk-slot" role="radio" data-st="' + st + '" data-ms="' + s.ms + '" data-min="' + s.min + '" aria-checked="' + !!sel + '" tabindex="-1"' + (st === 'free' ? '' : ' aria-disabled="true"') +
          ' aria-label="' + hm(s.min) + (two ? ', ' + vis(s.ms) + ' your time' : '') + ', ' + why + '"><span class="bk-tm">' + hm(s.min) + '</span>' + (two ? '<small aria-hidden="true">' + vis(s.ms) + ' yours</small>' : '') + '</button>'
      }).join('') + '</div></div>'
    }).join('')
    var note = soonAny ? '<p class="bk-sn">Times under ' + noticeText() + ' from now cannot be booked here.' + (D.shop.phone ? ' For today, call <b><a href="tel:' + D.shop.phone.replace(/[^\d+]/g, '') + '">' + esc(D.shop.phone) + '</a></b>.' : '') + '</p>' : ''
    return '<div class="bk-slots' + (two ? ' bk-two' : '') + '" role="radiogroup" aria-label="Start time">' + html + note + '</div>'
  }
  function noneHtml() {
    var svc = sdata(S.svc), t = today()
    var who = S.who
    var f = E.firstFree(M, S.svc, who, t, now())
    var pn = who === 'any' ? (D.solo ? 'We are' : 'Everyone is') : pdata(who).name.split(' ')[0] + ' is'
    var others = who === 'any' ? [] : svc.who.filter(function (id) { return id !== who })
    var alt = null
    for (var i = 0; i < others.length && !alt; i++) { var g = E.firstFree(M, S.svc, others[i], t, now(), 7); if (g) alt = { id: others[i], f: g } }
    var weekEnd = E.addDays(S.week, 6)
    var head = f ? pn + ' fully booked until ' + dayShort(f.date) + '.' : pn + ' fully booked for the next ' + D.rules.horizon + ' days.'
    var why = svc.name + ' takes ' + svc.minutes + ' min, and nothing that long is free ' + (who === 'any' || D.solo ? '' : 'with ' + pdata(who).name.split(' ')[0] + ' ') + 'before then.' + (who !== 'any' && !others.length && !D.solo ? ' Nobody else here does it.' : '')
    var btns = ''
    if (f) btns += '<button type="button" class="bk-go" data-jump="' + f.date + '" data-jump-ms="' + f.ms + '"><span>Show ' + esc(dayShort(f.date)) + '<small>first free ' + hm(f.min) + (two ? ' (' + vis(f.ms) + ' yours)' : '') + '</small></span><span aria-hidden="true">→</span></button>'
    if (alt) btns += '<button type="button" data-who-go="' + alt.id + '" data-jump="' + alt.f.date + '"><span>' + esc(pdata(alt.id).name) + ' has time sooner<small>' + esc(dayShort(alt.f.date)) + ', ' + hm(alt.f.min) + '</small></span><span aria-hidden="true">→</span></button>'
    if (D.cancelList) btns += '<a href="mailto:' + esc(D.email) + '?subject=' + encodeURIComponent('Cancellation list: ' + svc.name) + '&body=' + encodeURIComponent('Please add me to the cancellation list for ' + svc.name + (who === 'any' ? '' : ' with ' + pdata(who).name) + ' in the week of ' + dayShort(S.week) + '.\nName:\nPhone or email:\n') + '"><span>Join the cancellation list<small>we write if a time opens up</small></span><span aria-hidden="true">→</span></a>'
    return '<div class="bk-none" role="status"><span class="bk-lbl">' + (weekEnd < (f && f.date) || !f ? 'No free time this week' : 'No free time this week') + '</span><h4>' + esc(head) + '</h4><p>' + esc(why) + '</p><div class="bk-alt">' + btns + '</div></div>'
  }
  function loadHtml() {
    return '<div class="bk-none" role="alert"><span class="bk-lbl">' + (load === 'loading' ? 'Loading the diary' : 'The diary did not load') + '</span><h4>' + (load === 'loading' ? 'Checking what is free…' : 'We could not check what is free.') + '</h4><p>' + (load === 'loading' ? 'One moment.' : 'So we are not showing any times: some might already be taken. Try again, or ' + (D.shop.phone ? 'call ' + esc(D.shop.phone) + '.' : 'email ' + esc(D.email) + '.')) + '</p>' + (load === 'failed' ? '<div class="bk-alt"><button type="button" class="bk-go" data-retry-load><span>Try again</span><span aria-hidden="true">→</span></button></div>' : '') + '</div>'
  }
  function renderTime() {
    var el = $('[data-time]')
    if (load !== 'ok') { el.innerHTML = loadHtml(); return }
    if (!S.day) { el.innerHTML = noneHtml(); return }
    var info = dayInfo(S.day)
    el.innerHTML = trackHtml(info) + slotsHtml(info)
    var tabs = $$('.bk-slot[data-st=free]', el)
    var sel = $('.bk-slot[aria-checked=true]', el)
    if (sel) sel.tabIndex = 0
    else if (tabs[0]) tabs[0].tabIndex = 0
  }

  /* ---------- the card ---------- */
  function slotLine() {
    var svc = sdata(S.svc)
    return hm(S.slot.min) + '–' + E.clock(SHOP, S.slot.ms + svc.minutes * MIN) + (two ? '<span class="bk-y">' + vis(S.slot.ms) + '–' + vis(S.slot.ms + svc.minutes * MIN) + ' your time, ' + esc(visCity) + '</span>' : '')
  }
  function renderCard() {
    var svc = sdata(S.svc), done = S.phase === 'done' || S.phase === 'requested'
    var who = S.slot ? pdata(S.slot.person) : S.who !== 'any' ? pdata(S.who) : null
    var withLine = D.solo ? '' : '<dt>With</dt><dd>' + (who ? esc(who.name) + (S.who === 'any' && S.slot ? '<span class="bk-y">first free at this time</span>' : '') : 'Anyone free') + '</dd>'
    $('[data-lines]').innerHTML = '<dl><dt>What</dt><dd>' + esc(svc.name) + '<span class="bk-y">' + svc.minutes + ' min · ' + esc(money(svc)) + '</span></dd>' + withLine +
      '<dt>Day</dt><dd class="' + (S.slot || S.day ? '' : 'bk-blank') + '" data-line-day>' + (S.slot ? esc(dayLong(S.slot.date)) : S.day ? esc(dayLong(S.day)) : 'Pick a day') + '</dd>' +
      '<dt>Time</dt><dd class="' + (S.slot ? '' : 'bk-blank') + '" data-line-time>' + (S.slot ? slotLine() : 'Pick a time') + '</dd>' +
      '<dt>Where</dt><dd>' + esc(D.shop.where) + '</dd></dl>'
    renderHold()
    var cta = $('[data-cta]')
    var ready = !!S.slot && (S.phase === 'pick' || S.phase === 'failed') && !(S.hold && S.hold.expired)
    cta.setAttribute('aria-disabled', String(!ready))
    $('[data-cta-t]').textContent = S.phase === 'sending' ? (MODE === 'request' ? 'Opening your email…' : 'Booking…') : S.phase === 'failed' ? 'Try again' : MODE === 'request' ? 'Request this time' : D.card.cta
    $('[data-form]').hidden = done
    $('.bk-card').classList.toggle('bk-is-done', done)
    var dn = $('[data-done]')
    dn.hidden = !done
    $('[data-fine]').innerHTML = esc(D.card.policy) + (MODE === 'request' ? '' : ' Rather use email? <a href="' + esc(mailto()) + '" data-mail>' + esc(D.email) + '</a>')
    var stamp = $('.bk-stamp', root)
    if (stamp && !done) stamp.remove()
    if (done) {
      var booked = S.phase === 'done'
      if (!$('.bk-stamp')) $('.bk-card').insertAdjacentHTML('beforeend', '<span class="bk-stamp' + (booked ? '' : ' bk-req') + '" aria-hidden="true">' + (booked ? 'Booked' : 'Requested') + '</span>')
      var contact = $('#bk-contact').value
      dn.innerHTML = booked
        ? '<p class="bk-ref">Ref ' + esc(S.ref) + ' · confirmation to ' + esc(contact) + '</p><a class="bk-ghost" data-ics download="' + esc(D.card.ref.toLowerCase()) + '-appointment.ics" href="data:text/calendar;charset=utf-8,' + encodeURIComponent(ics()) + '">Add to calendar (.ics) <span aria-hidden="true">↓</span></a><p class="bk-fine">' + esc(D.card.policy) + ' To change it, reply to the confirmation.</p>'
        : '<p class="bk-ref">Ref ' + esc(S.ref) + ' · nothing is reserved yet</p><p class="bk-fine">Your email app should have opened with the request to ' + esc(D.email) + '. Send it, and we confirm by email; the time is yours once we reply. If nothing opened, <a href="' + esc(mailto()) + '" data-mail>write to us here</a>.</p>'
    }
  }
  function renderHold() {
    var el = $('[data-hold]')
    if (S.stale && S.phase === 'pick') { el.innerHTML = '<div class="bk-note" role="alert"><b>Someone took ' + esc(S.stale.was) + ' while you were choosing.</b>' + (S.stale.next ? esc(S.stale.next) + ' is still free, and it is selected now. Your details are kept.' : 'Nothing else is free that day; pick another day. Your details are kept.') + '</div>'; return }
    if (!S.slot || S.phase === 'done' || S.phase === 'requested') { el.innerHTML = ''; return }
    var t = hm(S.slot.min)
    if (S.stale) { el.innerHTML = '<div class="bk-note" role="alert"><b>Someone took ' + esc(S.stale.was) + ' while you were choosing.</b>' + (S.stale.next ? esc(S.stale.next) + ' is still free, and it is selected now. Your details are kept.' : 'Nothing else is free that day; pick another day. Your details are kept.') + '</div>'; return }
    if (S.phase === 'failed') { el.innerHTML = '<div class="bk-note" role="alert"><b>Not booked yet. Nothing was saved on our side.</b>The connection failed. Try again, or <a href="' + esc(mailto()) + '" data-mail>send it by email</a> with everything filled in.</div>'; return }
    if (MODE === 'request') { el.innerHTML = '<div class="bk-hold bk-plain"><b>We confirm by email</b><span>Your request goes to ' + esc(D.email) + '. The time is not reserved until we reply.</span></div>'; return }
    if (MODE === 'direct') { el.innerHTML = '<div class="bk-hold bk-plain"><b>Not reserved until you book</b><span>We check ' + t + ' is still free when you press ' + esc(D.card.cta.toLowerCase()) + '.</span></div>'; return }
    if (!S.hold) { el.innerHTML = '<div class="bk-hold bk-plain"><b>Reserving ' + t + '…</b><span>&nbsp;</span></div>'; return }
    if (S.hold.expired) { el.innerHTML = '<div class="bk-note" role="alert"><b>Your hold on ' + t + ' ended at ' + E.clock(SHOP, S.hold.until) + '.</b>It may still be free. Your details are kept.<br><button type="button" data-rehold>Check ' + t + ' again</button></div>'; return }
    var left = Math.max(0, S.hold.until - now()), total = D.rules.hold * MIN
    var mm = Math.floor(left / MIN), ss = Math.floor((left % MIN) / 1000)
    var frac = left / total
    el.innerHTML = '<div class="bk-hold" role="timer" aria-live="off"><svg viewBox="0 0 34 34" aria-hidden="true"><circle class="bk-ring0" cx="17" cy="17" r="14" fill="none" stroke-width="3"/><circle class="bk-ring" cx="17" cy="17" r="14" fill="none" stroke-width="3" stroke-dasharray="' + (frac * 87.96).toFixed(2) + ' 88" transform="rotate(-90 17 17)"/></svg><b>Held for you · <span class="bk-num" data-left>' + mm + ':' + String(ss).padStart(2, '0') + '</span></b><span>Nobody else can take it until ' + E.clock(SHOP, S.hold.until) + (two ? ' (' + vis(S.hold.until) + ' yours)' : '') + '.</span></div>'
  }
  function renderBar() {
    var bar = $('[data-bar]')
    var show = phoneMq.matches && !!S.slot && S.phase === 'pick' && !cardInView
    bar.hidden = !show
    if (!S.slot) return
    $('[data-bar-a]').textContent = dayShort(S.slot.date) + ' · ' + hm(S.slot.min)
    var live = S.hold && !S.hold.expired, left = live ? Math.max(0, S.hold.until - now()) : 0
    var b = MODE === 'hold' ? (live ? 'Held for you · ' + Math.floor(left / MIN) + ':' + String(Math.floor((left % MIN) / 1000)).padStart(2, '0') : S.hold ? 'Hold ended' : 'Reserving…') : MODE === 'direct' ? 'Not reserved until you book' : 'We confirm by email'
    $('[data-bar-b]').innerHTML = (MODE === 'hold' && S.hold && !S.hold.expired ? '<i aria-hidden="true"></i>' : '') + esc(b)
  }
  var cardInView = false
  function renderAll() {
    renderServices(); renderWeek(); renderTime(); renderCard(); renderBar()
    var o = D.hours[E.dowOf(today())]
    $('[data-open]').textContent = o.length ? o.map(function (s) { return hm(s[0]) + '–' + hm(s[1]) }).join(', ') : 'Closed today'
    $('[data-tz]').innerHTML = 'Times in ' + esc(D.shop.city) + ' time<span class="bk-clock">' + (two ? '' : 'now ') + E.clock(SHOP, now()) + '</span>' + (two ? '<br>You are in ' + esc(visCity) + ', ' + aheadText() + ': <b>' + vis(now()) + '</b>.<span class="bk-wide"> Your time is under each slot.</span>' : '') + (PIN && !REC ? '<br><span class="bk-demo">Demo: the clock is fixed at ' + esc(dayShort(today())) + ', ' + E.clock(SHOP, now()) + ', and nothing is sent.</span>' : '')
  }

  /* ---------- choosing ---------- */
  function firstDayWithTime() {
    var t = today(), days = weekDays()
    for (var i = 0; i < 7; i++) { var d = days[i]; if (d < t) continue; if (freeCount(dayInfo(d))) return d }
    return null
  }
  function chooseService(id) {
    if (S.phase !== 'pick' && S.phase !== 'failed') return
    var prevLeft = null
    S.svc = id
    var svc = sdata(id)
    if (S.who !== 'any' && svc.who.indexOf(S.who) < 0) S.who = D.solo ? 'shop' : 'any'
    dropSlot()
    S.day = S.day && freeCount(dayInfo(S.day)) ? S.day : firstDayWithTime()
    if (phoneMq.matches && D.solo) S.folded = true
    renderAll()
    var b = $('.bk-sv[aria-checked=true] .bk-sv-bar')
    play(b, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 240 })
    $$('.bk-runs').forEach(function (r) { play(r, [{ opacity: 0.25 }, { opacity: 1 }], { duration: 180 }) })
    say(svc.name + ', ' + svc.minutes + ' minutes. ' + (S.day ? 'Showing ' + dayLong(S.day) + '.' : 'Nothing free this week.'))
  }
  function chooseWho(id) {
    if (S.phase !== 'pick' && S.phase !== 'failed') return
    var svc = sdata(S.svc)
    if (id !== 'any' && svc.who.indexOf(id) < 0) return
    S.who = id
    dropSlot()
    S.day = S.day && freeCount(dayInfo(S.day)) ? S.day : firstDayWithTime()
    if (phoneMq.matches) S.folded = true
    renderAll()
    $$('.bk-runs').forEach(function (r) { play(r, [{ opacity: 0.25 }, { opacity: 1 }], { duration: 180 }) })
  }
  function chooseDay(d, quiet) {
    if (S.phase !== 'pick' && S.phase !== 'failed') return
    var w = weekOf(d)
    if (w !== S.week) S.week = w
    S.day = d
    dropSlot()
    renderAll()
    if (!quiet) {
      var tl = $('[data-tl]')
      play(tl, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 300 })
      $$('.bk-sg').forEach(function (g, i) { play(g, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: 120 + i * 40 }) })
    }
  }
  function chooseWeek(dir) {
    var t = today(), lastDay = E.addDays(t, D.rules.horizon)
    var w = E.addDays(S.week, dir * 7)
    if (w < weekOf(t) || w > lastDay) return
    S.week = w
    dropSlot()
    S.day = firstDayWithTime()
    renderAll()
  }
  function dropSlot() { if (S.hold && S.hold.id) releaseHold(S.hold); S.slot = null; S.hold = null; S.stale = null; if (S.phase === 'failed') S.phase = 'pick' }
  function chooseSlot(ms, fromStale) {
    if (S.phase !== 'pick' && S.phase !== 'failed') return
    var info = dayInfo(S.day), s = null
    for (var i = 0; i < info.slots.length; i++) if (info.slots[i].ms === ms) s = info.slots[i]
    if (!s || s.status !== 'free') return
    var oldBlk = $('[data-blk]'), oldLeft = oldBlk ? oldBlk.getBoundingClientRect().left : null
    if (S.hold && S.hold.id) releaseHold(S.hold)
    var pid = S.who === 'any' || D.solo ? s.free[0] : S.who
    S.slot = { ms: s.ms, min: s.min, date: S.day, person: pid }
    S.hold = null
    if (!fromStale) S.stale = null
    if (S.phase === 'failed') S.phase = 'pick'
    renderAll()
    var blk = $('[data-blk]')
    if (blk) {
      if (oldLeft !== null) play(blk, [{ transform: 'translateX(' + (oldLeft - blk.getBoundingClientRect().left).toFixed(1) + 'px)' }, { transform: 'none' }], { duration: 280 })
      else play(blk, [{ transform: 'scaleX(0)', transformOrigin: 'left' }, { transform: 'scaleX(1)', transformOrigin: 'left' }], { duration: 240 })
    }
    play($('[data-line-day]'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200 })
    play($('[data-line-time]'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, delay: 40 })
    if (MODE === 'hold') takeHold()
    say(hm(s.min) + ' on ' + dayLong(S.day) + ' chosen. ' + (MODE === 'hold' ? 'Held for ' + D.rules.hold + ' minutes.' : MODE === 'direct' ? 'Not reserved until you book.' : 'We confirm by email.'))
  }

  /* ---------- hold ---------- */
  var tick = null
  function takeHold() {
    var slot = S.slot
    request('hold').then(function (r) {
      if (S.slot !== slot) return
      if (r.ok) { S.hold = { id: r.id || 'local', until: r.until || now() + D.rules.hold * MIN, expired: false }; startTick() }
      else if (r.status === 409) staleSlot()
      else { S.hold = null; S.phase = 'failed' }
      renderCard(); renderBar()
    })
  }
  function releaseHold(h) { if (!DRY && D.endpoint && D.endpoint.hold && h.id && h.id !== 'local') try { fetch(D.endpoint.hold + (D.endpoint.hold.indexOf('?') < 0 ? '?' : '&') + 'release=' + encodeURIComponent(h.id), { method: 'DELETE', keepalive: true }) } catch (e) {} }
  function startTick() {
    stopTick()
    if (REC || document.hidden) return
    tick = setInterval(holdTick, 1000)
  }
  function stopTick() { if (tick) clearInterval(tick); tick = null }
  function holdTick() {
    if (!S.hold || S.hold.expired) return stopTick()
    if (now() >= S.hold.until) { S.hold.expired = true; stopTick(); renderCard(); renderBar(); say('Your hold has ended. ' + hm(S.slot.min) + ' may still be free.'); return }
    var left = S.hold.until - now(), el = $('[data-left]')
    if (el) {
      el.textContent = Math.floor(left / MIN) + ':' + String(Math.floor((left % MIN) / 1000)).padStart(2, '0')
      var ring = $('.bk-ring'); if (ring) ring.setAttribute('stroke-dasharray', ((left / (D.rules.hold * MIN)) * 87.96).toFixed(2) + ' 88')
    }
    renderBar()
  }
  // a sleeping tab runs no timers: stop counting while hidden, and on return
  // work out what is left from the hold's real end time
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopTick(); else if (S.hold && !S.hold.expired) { holdTick(); if (!S.hold.expired) startTick() } })
  function staleSlot() {
    var was = hm(S.slot.min), d = S.slot.date, gone = S.slot.ms
    // treat it as taken here until the diary says otherwise
    M.busy[S.slot.person].push([gone, gone + (sdata(S.svc).minutes + sdata(S.svc).buffer) * MIN])
    S.slot = null; S.hold = null
    var info = dayInfo(d), next = null
    for (var i = 0; i < info.slots.length; i++) if (info.slots[i].status === 'free' && info.slots[i].ms > gone) { next = info.slots[i]; break }
    if (!next) for (var k = 0; k < info.slots.length; k++) if (info.slots[k].status === 'free') { next = info.slots[k]; break }
    S.phase = 'pick'
    S.stale = { was: was, next: next ? hm(next.min) : null }
    renderAll()
    if (next) chooseSlot(next.ms, true)
  }

  /* ---------- talking to the endpoint (or not) ---------- */
  function payload() {
    var svc = sdata(S.svc)
    return { service: svc.id, serviceName: svc.name, minutes: svc.minutes, person: S.slot.person, start: new Date(S.slot.ms).toISOString(), startLocal: S.slot.date + 'T' + hm(S.slot.min), timeZone: SHOP, visitorTimeZone: VIS, name: $('#bk-name').value.trim(), contact: $('#bk-contact').value.trim(), note: $('#bk-note').value.trim(), hold: S.hold && S.hold.id, ref: ref() }
  }
  function request(kind) {
    var fail = S.failNext
    if (DRY) {
      S.failNext = null
      var r = fail === 'taken' ? { ok: false, status: 409 } : fail === 'error' ? { ok: false, status: 500 } : { ok: true, id: 'dry-' + S.slot.ms, until: now() + D.rules.hold * MIN }
      if (REC) return { then: function (f) { if (kind !== 'book') f(r) } }
      return new Promise(function (res) { setTimeout(function () { res(r) }, kind === 'book' ? 900 : 60) })
    }
    var url = kind === 'hold' ? D.endpoint.hold : D.endpoint.url
    var p = payload()
    var body = D.endpoint.adapter === 'form' ? new URLSearchParams(p).toString() : JSON.stringify(p)
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort() }, 20000)
    return fetch(url, { method: 'POST', headers: { 'Content-Type': D.endpoint.adapter === 'form' ? 'application/x-www-form-urlencoded' : 'application/json' }, body: body, signal: ctl.signal })
      .then(function (res) { clearTimeout(timer); return res.json().catch(function () { return {} }).then(function (j) { return { ok: res.ok, status: res.status, id: j.id || j.holdId, until: j.expires ? Date.parse(j.expires) : null } }) })
      .catch(function () { clearTimeout(timer); return { ok: false, status: 0 } })
  }
  function ref() {
    var w = E.wallOf(SHOP, S.slot.ms)
    return D.card.ref + '-' + w.date.slice(8, 10) + w.date.slice(5, 7) + '-' + hm(w.min).replace(':', '') + (D.solo ? '' : S.slot.person.slice(0, 1).toUpperCase())
  }
  function mailto() {
    if (!S.slot) return 'mailto:' + D.email
    var svc = sdata(S.svc), p = pdata(S.slot.person)
    var lines = [
      'Booking request',
      'Service: ' + svc.name + ' (' + svc.minutes + ' min, ' + money(svc) + ')',
      D.solo ? null : 'With: ' + p.name,
      'Day: ' + dayLong(S.slot.date) + ' ' + S.slot.date.slice(0, 4),
      'Time: ' + hm(S.slot.min) + ' to ' + E.clock(SHOP, S.slot.ms + svc.minutes * MIN) + ', ' + D.shop.city + ' time' + (two ? ' (' + vis(S.slot.ms) + ' my time, ' + visCity + ')' : ''),
      'Name: ' + $('#bk-name').value.trim(),
      'Mobile or email: ' + $('#bk-contact').value.trim(),
      'Note: ' + ($('#bk-note').value.trim() || 'none'),
      'Ref: ' + ref(),
    ].filter(function (x) { return x !== null })
    return 'mailto:' + D.email + '?subject=' + encodeURIComponent('Booking request ' + ref() + ': ' + svc.name + ', ' + dayShort(S.slot.date) + ' ' + hm(S.slot.min)) + '&body=' + encodeURIComponent(lines.join('\n'))
  }
  /* a calendar file: UTC times, a UID that is the same every time for the same booking */
  function ics() {
    var svc = sdata(S.svc), p = pdata(S.slot.person)
    var u = function (ms) { return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') }
    var x = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n') }
    var fold = function (line) { var out = [], s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74) } out.push(s); return out.join('\r\n') }
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Booking Slots//' + x(D.brand) + '//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + ref() + '-' + u(S.slot.ms) + '-' + D.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      'DTSTAMP:' + u(Math.floor(now() / 1000) * 1000), 'DTSTART:' + u(S.slot.ms), 'DTEND:' + u(S.slot.ms + svc.minutes * MIN),
      'SUMMARY:' + x(svc.name + (D.solo ? '' : ' with ' + p.name) + ', ' + (D.shop.name || D.brand)),
      'LOCATION:' + x(D.shop.where + ', ' + D.shop.address),
      'DESCRIPTION:' + x('Ref ' + ref() + '. ' + D.card.policy),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + x(svc.name + ' tomorrow'), 'TRIGGER:-PT24H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR']
    return lines.map(fold).join('\r\n') + '\r\n'
  }

  /* ---------- the form ---------- */
  function check() {
    var bad = []
    var name = $('#bk-name'), contact = $('#bk-contact')
    var n = name.value.trim(), c = contact.value.trim()
    var set = function (el, key, msg) {
      var e = $('[data-err="' + key + '"]')
      if (msg) { el.setAttribute('aria-invalid', 'true'); e.textContent = msg; e.hidden = false; bad.push(el) }
      else { el.removeAttribute('aria-invalid'); e.textContent = ''; e.hidden = true }
    }
    set(name, 'name', n.length < 2 ? 'Your name, so we know who is coming.' : null)
    var email = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(c), phone = /^\+?[\d ()-]{7,20}$/.test(c)
    set(contact, 'contact', !c ? 'A mobile number or an email, for the confirmation and the reminder.' : !email && !phone ? (c.indexOf('@') >= 0 ? 'This email looks incomplete. Check the part after the @.' : 'This is not a phone number or an email we can use.') : null)
    return bad
  }
  function submit(e) {
    if (e) e.preventDefault()
    if (!S.slot) { say('Pick a time first.'); var f = $('.bk-slot[data-st=free]'); if (f) f.focus(); return }
    if ((S.phase !== 'pick' && S.phase !== 'failed') || (S.hold && S.hold.expired)) return
    var bad = check()
    S.stale = null
    if (bad.length) { say(bad.length === 1 ? 'One thing to fix.' : bad.length + ' things to fix.'); bad[0].focus(); return }
    S.ref = ref()
    if (MODE === 'request') {
      S.reqHref = mailto()
      S.phase = 'requested'
      stopTick()
      renderAll()
      if (!DRY) location.href = S.reqHref
      $('#bk-card-h').focus({ preventScroll: true })
      return
    }
    S.phase = 'sending'
    renderCard(); renderBar()
    var run = $('.bk-bar-run')
    var bar = play(run, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, easing: 'linear' })
    if (!bar && run) run.style.transform = 'scaleX(1)'
    request('book').then(function (r) {
      if (r.ok) finish()
      else if (r.status === 409) { S.phase = 'pick'; staleSlot() }
      else { S.phase = 'failed'; renderAll(); say('Not booked yet. Nothing was saved on our side.') }
    })
  }
  function finish() {
    if (S.phase !== 'sending') return
    S.phase = 'done'; stopTick(); renderAll()
    play($('.bk-stamp'), [{ transform: 'rotate(-6deg) scale(1.25)', opacity: 0 }, { transform: 'rotate(-9deg) scale(.97)', opacity: 1, offset: 0.7 }, { transform: 'rotate(-8deg) scale(1)', opacity: 1 }], { duration: 220 })
    play($('.bk-ghost'), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, delay: 160 })
    if (!REC) $('#bk-card-h').focus({ preventScroll: true })
    say('Booked. Reference ' + S.ref + '.')
  }
  function say(m) { var l = $('[data-live]'); if (l && !REC) { l.textContent = ''; setTimeout(function () { l.textContent = m }, 30) } }

  /* ---------- events ---------- */
  root.addEventListener('click', function (e) {
    var t = e.target.closest('button, a')
    if (!t || !root.contains(t)) return
    if (t.matches('[data-svc]')) chooseService(t.getAttribute('data-svc'))
    else if (t.matches('[data-who]')) chooseWho(t.getAttribute('data-who'))
    else if (t.matches('[data-day]')) chooseDay(t.getAttribute('data-day'))
    else if (t.matches('[data-wk]')) { if (t.getAttribute('aria-disabled') !== 'true') chooseWeek(+t.getAttribute('data-wk')) }
    else if (t.matches('.bk-slot')) { if (t.getAttribute('data-st') === 'free') chooseSlot(+t.getAttribute('data-ms')) }
    else if (t.matches('[data-jump]')) { if (t.hasAttribute('data-who-go')) { S.who = t.getAttribute('data-who-go') } chooseDay(t.getAttribute('data-jump')); var first = $('.bk-slot[data-st=free]'); if (first) first.focus() }
    else if (t.matches('[data-unfold]')) { S.folded = !S.folded; renderServices(); if (!S.folded) $('.bk-sv[aria-checked=true]').focus() }
    else if (t.matches('[data-rehold]')) { S.hold = null; renderCard(); takeHold() }
    else if (t.matches('[data-retry-load]')) fetchBookings()
    else if (t.matches('[data-bar-go]')) { $('.bk-c3').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); setTimeout(function () { $('#bk-name').focus({ preventScroll: true }) }, reduce ? 0 : 400) }
  })
  $('[data-card]').addEventListener('submit', submit)
  $('[data-card]').addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') === 'true') check() })
  // arrow keys inside each radio group
  root.addEventListener('keydown', function (e) {
    var t = e.target
    var group = t.closest('[role=radiogroup]')
    if (!group || ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) < 0) return
    var items = $$('[role=radio]', group).filter(function (b) { return b.getAttribute('aria-disabled') !== 'true' })
    var i = items.indexOf(t)
    if (i < 0) return
    e.preventDefault()
    var n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    var to = items[n]
    var key = to.getAttribute('data-svc') ? '[data-svc="' + to.getAttribute('data-svc') + '"]' : to.getAttribute('data-who') ? '[data-who="' + to.getAttribute('data-who') + '"]' : to.getAttribute('data-day') ? '[data-day="' + to.getAttribute('data-day') + '"]' : '[data-ms="' + to.getAttribute('data-ms') + '"]'
    to.click()
    var again = $(key); if (again) { again.tabIndex = 0; again.focus() }
  })
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { cardInView = en[0].isIntersecting; renderBar() }, { threshold: 0.2 }).observe($('.bk-c3'))
  phoneMq.addEventListener && phoneMq.addEventListener('change', function () { renderAll() })

  /* ---------- the diary from a URL (optional) ---------- */
  function fetchBookings() {
    if (TEST && Q.get('bk-diary') === 'fail') { load = 'failed'; renderAll(); return }
    if (!D.bookingsUrl || DRY) return
    load = 'loading'; renderAll()
    fetch(D.bookingsUrl, { headers: { Accept: 'application/json' } }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json() }).then(function (list) {
      if (!Array.isArray(list)) throw new Error('not a list')
      makeModel((D.bookings || []).concat(list)); load = 'ok'; S.day = S.day || firstDayWithTime(); renderAll()
    }).catch(function () { load = 'failed'; renderAll() })
  }

  /* ---------- live: statuses move on with the clock ---------- */
  if (!REC) setInterval(function () {
    if (S.phase !== 'pick' || document.hidden) return
    var before = S.slot
    if (before && !S.hold) {
      var info = dayInfo(before.date), still = info.slots.some(function (s) { return s.ms === before.ms && s.status === 'free' })
      if (!still) { S.slot = null; say(hm(before.min) + ' is now too close to book here.') }
    }
    renderWeek(); renderTime(); renderBar()
  }, 30000)

  /* ---------- entrance ---------- */
  function entrance() {
    $$('.bk-runs').forEach(function (r, i) { play(r, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 500, delay: i * 50 }) })
  }
  function settle() { root.setAttribute('data-settled', '') }

  /* ---------- the recorder's script ---------- */
  var SC = (D.preview && D.preview.script) || null
  var SCRIPT = [
    { t: 0, busy: 1.0, run: function () { entrance() } },
    { t: 2.6, busy: 0.4, run: function () { chooseService(SC.service) } },
    { t: 3.8, busy: 0.4, run: function () { chooseWho(SC.person || 'any') } },
    { t: 5.0, busy: 0.6, run: function () { chooseDay(SC.day) } },
    { t: 6.4, busy: 0.5, run: function () { chooseSlot(scriptSlot(SC.times[0])) } },
    { t: 8.0, busy: 0.4, run: function () { chooseSlot(scriptSlot(SC.times[1])) } },
    { t: 9.2, busy: 0.5, scroll: true },
    { t: 9.9, busy: 1.0, type: '#bk-name', text: function () { return SC.draft.name } },
    { t: 11.1, busy: 1.0, type: '#bk-contact', text: function () { return SC.draft.contact } },
    { t: 12.8, busy: 0.9, run: function () { submit() } },
    { t: 13.7, busy: 0.45, run: function () { finish() } },
  ]
  var LENGTH = 16.5
  function scriptSlot(hhmm) {
    var m = +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5)
    var info = dayInfo(S.day), best = null
    for (var i = 0; i < info.slots.length; i++) if (info.slots[i].status === 'free' && (best === null || Math.abs(info.slots[i].min - m) < Math.abs(best.min - m))) best = info.slots[i]
    return best ? best.ms : null
  }
  function moments() {
    var busy = SCRIPT.map(function (s) { return [s.t, s.t + s.busy] })
    var out = [], at = 0
    busy.forEach(function (b) { if (b[0] - at >= 0.6) out.push([Math.round(at * 100) / 100, Math.round(b[0] * 100) / 100]); at = Math.max(at, b[1]) })
    if (LENGTH - at >= 0.6) out.push([Math.round(at * 100) / 100, LENGTH])
    return { stretches: out, end: LENGTH, poster: (out[4][0] + out[4][1]) / 2 }
  }
  function scrollTarget() {
    // phones: bring the card up; wide screens: only if the card is not all on screen
    var c = $('.bk-c3').getBoundingClientRect(), top = c.top + scrollY, bottom = c.bottom + scrollY
    if (phoneMq.matches) return Math.max(0, top - 16)
    if (bottom + 24 <= innerHeight) return scrollY
    return Math.max(0, Math.min(top - 16, bottom + 24 - innerHeight))
  }
  var ease = function (x) { return x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3) }
  function seek(t) {
    anims.forEach(function (x) { x.a.cancel() })
    anims = []
    recT = 0
    window.scrollTo(0, 0)
    S = fresh()
    S.day = firstDayWithTime()
    renderAll()
    var y0 = 0, yTo = 0, scrollAt = null
    for (var i = 0; i < SCRIPT.length; i++) {
      var s = SCRIPT[i]
      if (s.t > t) break
      recClock = s.t
      recT = s.t
      if (s.run) s.run()
      if (s.scroll) { y0 = scrollY; yTo = scrollTarget(); scrollAt = s }
      if (s.type) { var el = $(s.type), txt = s.text(); el.value = txt.slice(0, Math.round(txt.length * Math.min(1, (t - s.t) / (s.busy * 0.9)))) }
    }
    recT = t
    recT = t
    if (S.hold && !S.hold.expired) renderHold()
    renderBar()
    if (scrollAt) window.scrollTo(0, y0 + (yTo - y0) * ease((t - scrollAt.t) / scrollAt.busy))
    if (S.slot) renderBar()
    cardInView = (function () { var r = $('.bk-c3').getBoundingClientRect(); return r.top < innerHeight * 0.8 })()
    renderBar()
    anims.forEach(function (x) { var tm = x.a.effect.getTiming(); x.a.currentTime = Math.max(0, Math.min((t - x.at) * 1000, (tm.delay || 0) + tm.duration)) })
  }

  /* ---------- start ---------- */
  S = fresh()
  S.day = firstDayWithTime()
  renderAll()
  fetchBookings()
  var ready
  if (REC) { ready = document.fonts.ready.then(function () { seek(0) }) }
  else if (reduce) { settle(); ready = document.fonts.ready }
  else {
    $$('.bk-runs').forEach(function (r) { r.style.transform = 'scaleY(0)' })
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return
      io.disconnect()
      $$('.bk-runs').forEach(function (r) { r.style.transform = '' })
      entrance()
      setTimeout(settle, 900)
    }, { threshold: 0.3 }) : null
    if (io) io.observe($('[data-week]')); else settle()
    ready = document.fonts.ready
  }

  window.BookingSlots = {
    ready: ready,
    length: LENGTH,
    seek: seek,
    moments: moments,
    info: function () { return { now: now(), shopTz: SHOP, visitorTz: VIS, mode: MODE, today: today(), week: S.week, ticking: !!tick } },
    state: function () { return { phase: S.phase, svc: S.svc, who: S.who, day: S.day, slot: S.slot, hold: S.hold, stale: S.stale, ref: S.ref, load: load, folded: S.folded } },
    advance: function (ms) { skew += ms },
    failNext: function (kind) { S.failNext = kind },
    ics: function () { return S.slot ? ics() : null },
    mailto: function () { return mailto() },
    reqHref: function () { return S.reqHref },
    // designed states for stills and the check
    force: function (st) {
      if (st === 'none') {
        for (var i = 0; i < D.services.length; i++) {
          var sv = D.services[i], whos = sv.who.concat(['any'])
          for (var k = 0; k < whos.length; k++) {
            S.svc = sv.id; S.who = whos[k]
            if (!firstDayWithTime()) { dropSlot(); S.day = null; if (phoneMq.matches) S.folded = true; renderAll(); return true }
          }
        }
        return false
      }
      if (!S.slot) return false
      if (st === 'expired') { if (MODE !== 'hold' || !S.hold) return false; S.hold.expired = true; stopTick(); renderCard(); renderBar(); return true }
      if (st === 'stale') { staleSlot(); return true }
      if (st === 'failed') { S.phase = 'failed'; renderAll(); return true }
      if (st === 'invalid') { $('#bk-name').value = ''; $('#bk-contact').value = 'callum@'; check(); return true }
      return false
    },
  }
})()
