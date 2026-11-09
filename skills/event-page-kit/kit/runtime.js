/* Event Page Kit runtime, inlined into every build. It:
   - knows what time it is: the real clock live, or the config's preview clock
     with ?ev-clock=preview|before|after (and always when recording), and
     marks every session past, now or next, draws the now line across the
     day's grid, and fills the now / next row;
   - shows the visitor's own time beside the venue's when the event has
     online sessions and the two clocks differ, using Intl, so daylight
     saving is right on any date (?ev-zone=America/New_York to try one);
   - runs the day tabs and the phone's room or track switcher as tablists
     (arrow keys, Home, End), and the Venue / Both / Mine time choice;
   - counts down to each ticket's sales end, once a minute;
   - fits each session's text to its block: it drops the one-line summary,
     then the footer, then the people, before a title is ever cut;
   - and, with ?ev-record=1, hands the clock to the recorder:
     window.EventKit.seek(t) scrolls a fixed script and runs the preview
     clock, so every frame is the same on any machine. moments() lists the
     holds where nothing on screen moves. */
(() => {
  const root = document.querySelector('.ev')
  const dataEl = document.getElementById('ev-data')
  if (!root || !dataEl) return
  const D = JSON.parse(dataEl.textContent)
  const q = new URLSearchParams(location.search)
  const REC = q.get('ev-record') === '1'
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const phone = matchMedia('(max-width: 759px)')
  root.classList.add('ev-js')
  if (!REC && !reduce.matches) root.classList.add('ev-anim')
  const $ = (s, el = root) => el.querySelector(s)
  const $$ = (s, el = root) => [...el.querySelectorAll(s)]
  const MIN = 60000

  /* ---------- zones ---------- */
  const fmts = new Map()
  const fmt = (zone) => {
    if (!fmts.has(zone)) fmts.set(zone, new Intl.DateTimeFormat('en-GB', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))
    return fmts.get(zone)
  }
  const wall = (ms, zone) => {
    const p = Object.fromEntries(fmt(zone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
    return { date: `${p.year}-${p.month}-${p.day}`, hm: `${String(+p.hour % 24).padStart(2, '0')}:${p.minute}` }
  }
  const offsetAt = (zone, ms) => {
    const p = Object.fromEntries(fmt(zone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
    return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(ms / MIN) * MIN) / MIN)
  }
  const okZone = (z) => { try { fmt(z); return true } catch { return false } }
  /** "2027-03-11T10:40" on the venue clock, to an instant */
  const venueToUtc = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s)
    if (!m) return null
    const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
    let t = naive - offsetAt(D.zone, naive) * MIN
    return naive - offsetAt(D.zone, t) * MIN
  }
  const city = (z) => z.split('/').pop().replace(/_/g, ' ')
  const lang = D.lang || 'en'
  const words = (ms, o) => new Intl.DateTimeFormat(lang, { timeZone: D.zone, ...o }).format(ms)

  /* ---------- the clock ---------- */
  const param = q.get('ev-clock') ?? (REC ? 'preview' : null)
  let base = null
  if (param === 'preview' || param === 'during') base = D.preview.clock
  else if (param === 'before') base = D.preview.before
  else if (param === 'after') base = D.preview.after
  else if (param && /^\d{10,}$/.test(param)) base = +param
  else if (param) base = venueToUtc(param)
  let lapse = 0
  const now = () => (base !== null ? base + lapse : Date.now())
  const zoneParam = q.get('ev-zone')
  const visitor = zoneParam && okZone(zoneParam) ? zoneParam
    : base !== null ? (D.preview.zone || D.zone)
    : (Intl.DateTimeFormat().resolvedOptions().timeZone || D.zone)
  const differs = D.online && D.days.some((d) => {
    const t = venueToUtc(d.date + 'T12:00')
    return offsetAt(visitor, t) !== offsetAt(D.zone, t)
  })
  let tzMode = differs ? 'both' : 'off'
  const setTz = (mode) => {
    tzMode = mode
    root.classList.remove('ev-tz-off', 'ev-tz-both', 'ev-tz-venue', 'ev-tz-mine')
    root.classList.add(`ev-tz-${mode === 'venue' ? 'off' : mode}`)
    $$('.ev-tz [role="radio"]').forEach((b) => { const on = b.dataset.tz === mode; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1 })
    const zn = $('.ev-zn')
    if (zn) zn.textContent = mode === 'both' ? `Times in ${D.city} and in ${city(visitor)}` : mode === 'mine' ? `Times in ${city(visitor)}, your time` : `All times are ${D.city} time`
    render()
  }

  /* ---------- visitor times ---------- */
  const vdays = (ms, ref) => {
    const a = wall(ms, visitor).date, b = wall(ref, D.zone).date
    return a === b ? '' : a > b ? ' +1' : ' −1'
  }
  function fillVisitor() {
    if (!differs) return
    for (const el of $$('.ev-vz')) { const u = +el.dataset.u; el.textContent = wall(u, visitor).hm + vdays(u, u) }
    for (const el of $$('.ev-tm')) { const s = +el.dataset.u0, e = +el.dataset.u1; el.textContent = `${wall(s, visitor).hm}–${wall(e, visitor).hm}${vdays(s, s)}` }
    for (const el of $$('.ev-city')) el.textContent = city(visitor)
    const on = $('.ev-online')
    if (on) on.textContent = `${wall(+on.dataset.u0, visitor).hm} to ${wall(+on.dataset.u1, visitor).hm} in ${city(visitor)}`
  }

  /* ---------- durations ---------- */
  const dur = (ms) => {
    const m = Math.max(1, Math.round(ms / MIN))
    if (m < 60) return `${m} min`
    if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h` }
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60)
    return d >= 3 || !h ? `${d} days` : `${d} day${d > 1 ? 's' : ''} ${h} h`
  }

  /* ---------- the model, read from the page ---------- */
  const days = $$('.ev-day').map((el) => ({ el, id: el.dataset.day, gs: +el.dataset.gs, ge: +el.dataset.ge, gsu: +el.dataset.gsu, date: el.dataset.date }))
  days.forEach((d) => { d.geu = d.gsu + (d.ge - d.gs) * MIN })
  const sessions = $$('.ev-s').map((el) => ({ el, code: el.dataset.code, day: el.dataset.day, room: el.dataset.room, track: el.dataset.track, u0: +el.dataset.u0, u1: +el.dataset.u1, tag: $('.ev-tag', el), title: $('.ev-ti', el).textContent }))
  const breaks = $$('.ev-brk').map((el) => ({ el, u0: +el.dataset.u0, u1: +el.dataset.u1, title: el.dataset.title, rooms: el.dataset.rooms.split(' '), day: el.closest('.ev-day').dataset.day }))
  const bars = $$('.ev-gb').map((el) => ({ el, u0: +el.dataset.u0, u1: +el.dataset.u1 }))
  const roomName = Object.fromEntries(D.rooms.map((r) => [r.id, r.name]))

  /* ---------- tabs ---------- */
  let userDay = null
  function tablist(list, onPick) {
    const tabs = $$('[role="tab"]', list)
    const pick = (t, focus) => { tabs.forEach((x) => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1 }); if (focus) t.focus(); onPick(t) }
    list.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t) pick(t, false) })
    list.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(document.activeElement)
      if (i < 0) return
      const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
      if (k === undefined) return
      e.preventDefault()
      pick(tabs[(k + tabs.length) % tabs.length], true)
    })
    return (id, attr) => { const t = tabs.find((x) => x.dataset[attr] === id); if (t && t.getAttribute('aria-selected') !== 'true') pick(t, false) }
  }
  const showDay = (id) => { for (const d of days) d.el.hidden = d.id !== id; requestAnimationFrame(fit) }
  const pickDay = tablist($('.ev-days'), (t) => { userDay = t.dataset.day; showDay(userDay); render() })
  const dayset = $('#ev-days')
  const pickSw = tablist($('.ev-sw'), (t) => { dayset.dataset.sel = t.dataset.sel; renderNb(); requestAnimationFrame(fit) })
  const selectDay = (id) => { const t = $(`.ev-dt[data-day="${CSS.escape(id)}"]`); t.setAttribute('aria-selected', 'true'); $$('.ev-dt').forEach((x) => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1 }); showDay(id) }

  const tz = $('.ev-tz')
  if (differs && tz) {
    tz.hidden = false
    const radios = $$('[role="radio"]', tz)
    tz.addEventListener('click', (e) => { const b = e.target.closest('[role="radio"]'); if (b) setTz(b.dataset.tz) })
    tz.addEventListener('keydown', (e) => {
      const i = radios.indexOf(document.activeElement)
      const k = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key]
      if (i < 0 || k === undefined) return
      e.preventDefault()
      const b = radios[(k + radios.length) % radios.length]
      b.focus(); setTz(b.dataset.tz)
    })
  }

  /* ---------- state ---------- */
  function phase(t) {
    const first = Math.min(...sessions.map((s) => s.u0)), last = Math.max(...sessions.map((s) => s.u1))
    if (t < first) return 'before'
    if (t >= last) return 'after'
    return days.some((d) => t >= d.gsu && t <= d.geu) ? 'during' : 'between'
  }
  function today(t) {
    const p = phase(t)
    if (p === 'during') return days.find((d) => t >= d.gsu && t <= d.geu).id
    if (p === 'between') return days.find((d) => d.gsu > t).id
    return days[0].id
  }

  function renderNb() {
    const nb = $('.ev-nb')
    if (!nb) return
    const t = now(), p = phase(t)
    nb.hidden = false
    const sw = D.switch
    const byTrack = phone.matches && sw === 'track'
    const groups = byTrack ? D.tracks.map((x) => ({ id: x.id, key: 'track' })) : D.rooms.map((x) => ({ id: x.id, key: 'room' }))
    nb.style.setProperty('--n', groups.length)
    const w = wall(t, D.zone)
    const clock = `<div class="ev-nb-c"><b>${w.hm}</b>${words(t, { weekday: 'short', day: 'numeric', month: 'short' })}<br>${tzMode === 'mine' ? `${wall(t, visitor).hm} your time` : 'now'}</div>`
    const all = [...sessions].sort((a, b) => a.u0 - b.u0)
    const fmtS = (s) => `<span class="ev-code">${s.code}</span> ${s.title}`
    let cells
    if (p === 'before') {
      const s = all[0]
      cells = `<div class="ev-nb-x ev-nb-wide ev-sel"><span class="ev-tg ev-tg-next">Starts in ${dur(s.u0 - t)}</span><p>${words(s.u0, { weekday: 'long', day: 'numeric', month: 'long' })}, ${wall(s.u0, D.zone).hm}: ${fmtS(s)}, ${roomName[s.room]}</p><p class="ev-nb-m">Everything below is the full programme. Add any session to your calendar with its + .ics</p></div>`
    } else if (p === 'after') {
      cells = `<div class="ev-nb-x ev-nb-wide ev-sel"><span class="ev-tg ev-tg-next">Ended</span><p>${D.after}</p></div>`
    } else if (p === 'between') {
      const n = all.find((s) => s.u0 > t)
      const same = all.filter((s) => s.u0 === n.u0).map((s) => s.code).join(', ')
      cells = `<div class="ev-nb-x ev-nb-wide ev-sel"><span class="ev-tg ev-tg-next">Next · in ${dur(n.u0 - t)}</span><p>${words(n.u0, { weekday: 'long', day: 'numeric', month: 'long' })}, ${wall(n.u0, D.zone).hm}: ${same}</p></div>`
    } else {
      const sel = dayset.dataset.sel
      cells = groups.map((g) => {
        const mine = all.filter((s) => s[g.key] === g.id && s.day === today(t))
        const cur = mine.find((s) => s.u0 <= t && s.u1 > t)
        const nx = mine.find((s) => s.u0 > t)
        const brk = breaks.find((b) => b.day === today(t) && b.u0 > t && (!nx || b.u0 < nx.u0) && (g.key !== 'room' || b.rooms.includes(g.id)))
        const inBrk = breaks.find((b) => b.u0 <= t && b.u1 > t && (g.key !== 'room' || b.rooms.includes(g.id)))
        let h
        if (cur) h = `<span class="ev-tg ev-tg-now">Now · until ${wall(cur.u1, D.zone).hm}</span><p>${fmtS(cur)}</p><p class="ev-nb-m">${nx ? `${brk ? brk.title + ', then ' : 'Then '}${nx.code} at ${wall(nx.u0, D.zone).hm}` : 'Last one here today'}</p>`
        else if (inBrk) h = `<span class="ev-tg ev-tg-next">${inBrk.title} · until ${wall(inBrk.u1, D.zone).hm}</span>${nx ? `<p>${fmtS(nx)}</p><p class="ev-nb-m">at ${wall(nx.u0, D.zone).hm}</p>` : ''}`
        else if (nx) h = `<span class="ev-tg ev-tg-next">Next · ${wall(nx.u0, D.zone).hm}, in ${dur(nx.u0 - t)}</span><p>${fmtS(nx)}</p>`
        else h = `<p class="ev-nb-m">Nothing more ${g.key === 'room' ? 'in this room' : 'in this track'} today</p>`
        return `<div class="ev-nb-x${phone.matches ? (g.id === sel ? ' ev-sel' : '') : ' ev-sel'}">${h}</div>`
      }).join('')
    }
    nb.innerHTML = clock + cells
  }

  function render() {
    const t = now(), p = phase(t)
    const td = today(t)
    if (!userDay) selectDay(td)
    for (const s of sessions) {
      const past = s.u1 <= t, on = s.u0 <= t && s.u1 > t
      s.el.classList.toggle('ev-past', past)
      s.el.classList.toggle('ev-on', on)
      s.el.classList.remove('ev-nx')
      s.tag.hidden = true
      if (on) { s.tag.hidden = false; s.tag.textContent = `Now · ${dur(s.u1 - t)} left` }
    }
    if (p === 'during') for (const r of D.rooms) {
      const nx = sessions.filter((s) => s.room === r.id && s.day === td && s.u0 > t).sort((a, b) => a.u0 - b.u0)[0]
      const cur = sessions.some((s) => s.room === r.id && s.u0 <= t && s.u1 > t)
      if (nx && !cur && nx.u0 - t <= 90 * MIN) { nx.el.classList.add('ev-nx'); nx.tag.hidden = false; nx.tag.textContent = `Next · in ${dur(nx.u0 - t)}` }
    }
    for (const d of days) {
      const line = $('.ev-now', d.el)
      const m = (t - d.gsu) / MIN
      const show = m >= 0 && m <= d.ge - d.gs
      line.hidden = !show
      if (show) { line.style.setProperty('--t', m.toFixed(2)); line.firstElementChild.textContent = tzMode === 'mine' ? wall(t, visitor).hm : wall(t, D.zone).hm }
      const gn = $(`.ev-gl-day[data-day="${CSS.escape(d.id)}"] .ev-gl-now`)
      if (gn) {
        const rows = gn.parentElement, a0 = +rows.dataset.a0, a1 = +rows.dataset.a1
        gn.hidden = !show
        if (show) gn.style.left = (((d.gs + m - a0) / (a1 - a0)) * 100).toFixed(3) + '%'
      }
    }
    for (const b of bars) { b.el.classList.toggle('ev-past', b.u1 <= t); b.el.classList.toggle('ev-on', b.u0 <= t && b.u1 > t) }
    // switcher dots: something on now in that room or track
    for (const b of $$('.ev-swb')) {
      const key = D.switch === 'track' ? 'track' : 'room'
      const on = sessions.some((s) => s[key] === b.dataset.sel && s.u0 <= t && s.u1 > t)
      $('.ev-dot', b).hidden = !on
      $('.ev-dot-sr', b).hidden = !on
    }
    // tickets
    let open = []
    for (const row of $$('.ev-tr')) {
      const u1 = +row.dataset.u1
      const ended = u1 <= t
      row.classList.toggle('ev-ended', ended)
      const left = $('.ev-left', row), when = $('.ev-when', row)
      when.dataset.text ??= when.textContent
      when.textContent = ended ? when.dataset.text.replace(/^Sales end /, 'Sales ended ').replace(/^Until /, 'Sales ended ') : when.dataset.text
      left.hidden = ended
      if (!ended) { left.textContent = `${dur(u1 - t)} left`; open.push(u1) }
    }
    const ft = $('[data-tickets]')
    if (ft) {
      const live = D.tickets.filter((x) => x.u1 > t)
      const fv = ft.parentElement.querySelector('.ev-fv a')
      const price = (s) => parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0
      if (!live.length) { fv.textContent = 'Sales have ended'; ft.textContent = '' }
      else {
        const cheap = live.reduce((a, b) => (price(b.price) < price(a.price) ? b : a))
        fv.textContent = `From ${cheap.price}`
        const soon = live.reduce((a, b) => (b.u1 < a.u1 ? b : a))
        const same = wall(soon.u1, D.zone).date === wall(t, D.zone).date
        ft.textContent = `${soon.name}: sales end ${same ? 'today ' + wall(soon.u1, D.zone).hm : words(soon.u1, { weekday: 'short', day: 'numeric', month: 'short' })} · ${dur(soon.u1 - t)}`
      }
    }
    renderNb()
    root.dataset.phase = p
  }

  /* ---------- fit each block's text ---------- */
  const STEPS = ['ev-nolg', 'ev-noft', 'ev-nowho', 'ev-clip']
  function fit() {
    for (const s of sessions) {
      if (!s.el.offsetParent) continue
      s.el.classList.remove(...STEPS)
      for (const step of STEPS) {
        if (s.el.scrollHeight <= s.el.clientHeight + 1) break
        s.el.classList.add(step)
      }
    }
  }

  /* ---------- jumps from a speaker to their session ---------- */
  root.addEventListener('click', (e) => {
    const a = e.target.closest('.ev-go')
    if (!a) return
    const s = sessions.find((x) => x.code === a.dataset.go)
    if (!s) return
    e.preventDefault()
    userDay = s.day
    selectDay(s.day)
    if (phone.matches) pickSw(D.switch === 'track' ? s.track : s.room, 'sel')
    requestAnimationFrame(() => {
      s.el.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'center' })
      s.el.classList.add('ev-hit')
      setTimeout(() => s.el.classList.remove('ev-hit'), 900)
      s.el.setAttribute('tabindex', '-1')
      s.el.focus({ preventScroll: true })
    })
  })

  const ctlw = $('.ev-ctlw')
  const stick = () => root.style.setProperty('--stick', (phone.matches && ctlw ? ctlw.offsetHeight : 0) + 'px')
  addEventListener('resize', () => { stick(); fit() })
  phone.addEventListener('change', () => { stick(); renderNb(); fit() })

  fillVisitor()
  setTz(tzMode)
  stick()

  /* ---------- the recorder's script ---------- */
  const H = (name, from, to) => ({ name, from, to })
  const holds = [H('cover', 0, 2.6), H('programme', 3.8, 6.4), H('later', 8.6, 10.8), H('speakers', 11.8, 13.6), H('tickets', 14.4, 16), H('venue', 16.8, 18.5)]
  const length = 18.5
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
  const lapseMax = () => base === null ? 0 : Math.max(0, Math.min(200, Math.floor((Math.max(...sessions.map((s) => s.u1)) - base) / MIN) - 20)) * MIN
  const lapseAt = (t) => t <= 6.4 ? 0 : t >= 8.6 ? lapseMax() : Math.round((ease((t - 6.4) / 2.2) * lapseMax()) / MIN) * MIN
  const top = (el) => el.getBoundingClientRect().top + scrollY
  function progY() {
    const sec = top($('#programme'))
    const d = days.find((x) => !x.el.hidden)
    const line = d && $('.ev-now', d.el)
    if (!line || line.hidden) return sec
    const ly = top(line)
    return ly - sec > innerHeight * 0.8 ? ly - innerHeight * 0.55 : sec
  }
  const points = () => [
    [0, 0], [2.6, 0], [3.8, null], [6.4, null], [8.6, null], [10.8, null],
    [11.8, top($('#speakers'))], [13.6, top($('#speakers'))], [14.4, top($('#tickets'))], [16, top($('#tickets'))], [16.8, top($('#venue'))], [18.5, top($('#venue'))],
  ]
  function seek(t) {
    t = Math.max(0, Math.min(length, t))
    lapse = lapseAt(t)
    render()
    fit()
    const P = points()
    const maxY = document.documentElement.scrollHeight - innerHeight
    let y
    if (t >= 2.6 && t <= 10.8) {
      const target = progY()
      y = t < 3.8 ? ease((t - 2.6) / 1.2) * target : target
    } else {
      let k = P.findIndex(([a], i) => i < P.length - 1 && t >= a && t <= P[i + 1][0])
      if (k < 0) k = P.length - 2
      const [a, ya] = P[k], [b, yb] = P[k + 1]
      const from = ya ?? (lapse = lapseMax(), render(), progY())
      y = from + (yb - from) * ease((t - a) / (b - a || 1))
    }
    scrollTo(0, Math.min(maxY, Math.max(0, Math.round(y))))
    return t
  }

  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { stick(); render(); fit() })
  if (!REC) setInterval(() => { if (!document.hidden) render() }, 15000)
  window.EventKit = { ready, length, seek, moments: () => ({ length, holds }), phase: () => phase(now()), clock: now, visitor, differs, fit }
})()
