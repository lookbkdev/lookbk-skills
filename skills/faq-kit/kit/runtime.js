/* FAQ Kit runtime: inlined into every build. Without it the section still
   works (native <details>, anchors, the JSON-LD); with it you get search that
   narrows as you type, measured open and close, #links that open and scroll,
   copy-link, the current topic, the phone search bar and the live contact
   status. ?fq-record=1 hands the clock to the recorder (window.FAQKit.seek). */
(() => {
  const root = document.querySelector('.fq')
  if (!root) return
  const D = JSON.parse(root.dataset.fq)
  const T = D.text
  root.classList.add('fq-js')
  const params = new URLSearchParams(location.search)
  const REC = params.has('fq-record')
  if (REC) root.classList.add('fq-rec')
  const rm = matchMedia('(prefers-reduced-motion: reduce)')
  const still = () => rm.matches || REC
  const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')
  const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch])
  const entries = [...root.querySelectorAll('details.fq-q')]
  const groups = [...root.querySelectorAll('.fq-group[data-g]')]
  const links = [...root.querySelectorAll('.fq-contents a')]
  const input = root.querySelector('.fq-search input')
  const searchBox = root.querySelector('.fq-search')
  const countEl = root.querySelector('.fq-count')
  const empty = root.querySelector('.fq-empty')
  const list = root.querySelector('.fq-list')
  const bar = root.querySelector('.fq-bar')
  const cur = root.querySelector('.fq-cur')
  const phone = () => getComputedStyle(bar).display !== 'none'
  const pad = () => (phone() ? 68 : 24)

  /* ---------- open and close, with the height measured ---------- */
  const OPEN = 'cubic-bezier(.2,.7,.2,1)', CLOSE = 'cubic-bezier(.4,0,.2,1)'
  const want = (d) => (d.dataset.want ? d.dataset.want === '1' : d.open)
  function setOpen(d, open, animate = !still()) {
    const ans = d.querySelector('.fq-ans'), inner = ans.firstElementChild
    const from = d.open ? ans.getBoundingClientRect().height : 0
    ans.getAnimations().forEach((a) => a.cancel())
    inner.getAnimations().forEach((a) => a.cancel())
    d.dataset.want = open ? '1' : '0'
    if (open) {
      d.classList.remove('fq-closing')
      d.open = true
      if (!animate) return
      const h = ans.scrollHeight
      if (from >= h - 1) return
      const dur = Math.min(480, 220 + h * 0.28) * (1 - from / h)
      ans.animate([{ height: from + 'px' }, { height: h + 'px' }], { duration: dur, easing: OPEN })
      if (from < 1) inner.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: dur * 0.8, delay: 60, easing: OPEN, fill: 'backwards' })
    } else {
      if (!d.open) return
      if (!animate) { d.open = false; return }
      const h = from || ans.offsetHeight
      d.classList.add('fq-closing')
      const a = ans.animate([{ height: h + 'px' }, { height: '0px' }], { duration: Math.min(360, 180 + h * 0.2), easing: CLOSE })
      a.onfinish = () => { if (d.dataset.want === '0') d.open = false; d.classList.remove('fq-closing') }
      a.oncancel = () => d.classList.remove('fq-closing')
    }
  }
  root.addEventListener('click', (e) => {
    const s = e.target.closest('details.fq-q > summary')
    if (!s || !root.contains(s)) return
    e.preventDefault()
    const d = s.parentElement
    const open = !want(d)
    setOpen(d, open)
    if (!REC) history.replaceState(history.state, '', open ? '#' + d.id : location.pathname + location.search)
  })
  // The browser can open an answer by itself: find-in-page and #:~:text= links
  // open a closed <details> that holds the match (Chrome, Edge). Keep in step.
  for (const d of entries)
    d.addEventListener('toggle', () => {
      if (d.open !== want(d) && !d.classList.contains('fq-closing')) {
        d.dataset.want = d.open ? '1' : '0'
        d.querySelector('.fq-ans').getAnimations().forEach((a) => a.cancel())
        if (d.open && d.classList.contains('fq-hidden')) filter('')
      }
    })

  /* ---------- search: narrows as you type, inside the answers too ---------- */
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const hl = (text, t) => {
    const i = norm(text).indexOf(t)
    if (i < 0) return esc(text)
    return esc(text.slice(0, i)) + '<mark class="fq-hit">' + esc(text.slice(i, i + t.length)) + '</mark>' + esc(text.slice(i + t.length))
  }
  const squash = (s) => s.replace(/\s+/g, ' ').trim()
  // the answer as readable units: a paragraph, a step, a table row (cells joined by ·)
  const unitsOf = (d) => (d._units ??= [...d.querySelectorAll('.fq-body p, .fq-body li, .fq-body tbody tr, .fq-body caption')].map((el) =>
    el.matches('tr') ? [...el.cells].map((c) => squash(c.textContent)).join(' · ') : squash(el.textContent)))
  for (const d of entries) {
    const qt = d.querySelector('.fq-qt'), v = d.querySelector('.fq-v')
    qt.dataset.q = qt.textContent
    v.dataset.v = v.textContent
  }
  let current = ''
  function filter(q) {
    const raw = q.trim(), t = norm(raw)
    current = raw
    let n = 0
    for (const d of entries) {
      const qt = d.querySelector('.fq-qt'), v = d.querySelector('.fq-v'), src = qt.dataset.q, vs = v.dataset.v
      d.querySelector('.fq-snip')?.remove()
      const inQ = !!t && norm(src).includes(t), inV = !!t && norm(vs).includes(t)
      const unit = t ? unitsOf(d).find((u) => norm(u).includes(t)) : undefined
      const show = !t || inQ || inV || !!unit
      d.classList.toggle('fq-hidden', !show)
      if (show) n++
      qt.innerHTML = inQ ? hl(src, t) : esc(src)
      v.innerHTML = inV ? hl(vs, t) : esc(vs)
      if (t && !inQ && !inV && unit && !want(d)) {
        const body = unit, i = norm(body).indexOf(t)
        let a = Math.max(0, i - 56), b = Math.min(body.length, i + t.length + 72)
        const dot = body.lastIndexOf('. ', i)
        if (dot >= 0 && i - dot < 80) a = dot + 2
        else if (a > 0) a = body.indexOf(' ', a) + 1
        if (b < body.length) b = Math.max(i + t.length, body.lastIndexOf(' ', b))
        const s = document.createElement('span')
        s.className = 'fq-snip'
        s.innerHTML = (a ? '… ' : '') + hl(body.slice(a, b), t) + (b < body.length ? ' …' : '')
        d.querySelector('summary').appendChild(s)
      }
    }
    for (const g of root.querySelectorAll('.fq-group')) {
      const all = g.querySelectorAll('details.fq-q').length, vis = g.querySelectorAll('details.fq-q:not(.fq-hidden)').length
      g.classList.toggle('fq-hidden', !vis)
      const c = g.dataset.g && root.querySelector(`.fq-contents a[data-g="${g.dataset.g}"] .fq-c`)
      if (c) c.textContent = t ? `${vis} / ${all}` : all
    }
    empty.classList.toggle('fq-on', !!t && !n)
    if (t && !n) empty.innerHTML = `<p>${esc(fill(T.none, { q: raw }))} <a href="#fq-stuck">${esc(T.ask)}</a>; ${esc(fill(T.replies, { promise: D.contact.promise }))}</p>`
    if (countEl) countEl.textContent = t ? fill(T.count, { n, total: D.total, q: raw }) : `${D.total} ${T.answers}`
  }
  if (input) {
    input.addEventListener('input', () => {
      filter(input.value)
      // results appear at the top of the list: bring it into view if it has scrolled away
      const top = list.getBoundingClientRect().top
      if (input.value.trim() && top < 0) scrollTo({ top: Math.max(0, Math.min(top, searchBox.getBoundingClientRect().top) + scrollY - pad()), behavior: 'auto' })
    })
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; filter('') } })
  }
  if (D.hotkey)
    addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const a = document.activeElement
      if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return
      e.preventDefault()
      findFocus()
    })
  function findFocus() {
    const r = searchBox.getBoundingClientRect()
    if (r.top < 0 || r.bottom > innerHeight) scrollTo({ top: r.top + scrollY - pad(), behavior: still() ? 'auto' : 'smooth' })
    input.focus({ preventScroll: true })
  }
  root.addEventListener('click', (e) => { if (e.target.closest('[data-find]')) findFocus() })

  /* ---------- where an answer lands: its topic heading when it is the topic's first ---------- */
  const docTop = (el) => el.getBoundingClientRect().top + scrollY
  const landing = (d) => {
    const g = d.closest('.fq-group[data-g]')
    const first = g && g.querySelector('details.fq-q:not(.fq-hidden)') === d
    return docTop(first ? g : d) - pad()
  }

  /* ---------- #links: open, scroll, focus, flash ---------- */
  function openHash(animate) {
    const id = decodeURIComponent(location.hash.slice(1))
    const d = id && document.getElementById(id)
    if (!d || !d.matches('details.fq-q') || !root.contains(d)) return
    if (current) { if (input) input.value = ''; filter('') }
    const y = landing(d)
    setOpen(d, true, animate && !still())
    scrollTo({ top: y, behavior: animate && !still() ? 'smooth' : 'auto' })
    d.querySelector('summary').focus({ preventScroll: true, focusVisible: false })
    d.classList.remove('fq-flash')
    void d.offsetWidth
    d.classList.add('fq-flash')
  }
  addEventListener('hashchange', () => openHash(true))
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]')
    if (!b) return
    const url = location.origin + location.pathname + location.search + '#' + b.dataset.copy
    const label = b.querySelector('span'), was = label.textContent
    const done = () => { label.textContent = T.copied; setTimeout(() => (label.textContent = was), 1600) }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done)
    else done()
  })

  /* ---------- where you are: the current topic, the phone bar ---------- */
  function spy() {
    if (groups.length) {
      let at = groups[0].dataset.g
      for (const g of groups) if (!g.classList.contains('fq-hidden') && g.getBoundingClientRect().top < innerHeight * 0.35) at = g.dataset.g
      links.forEach((l) => l.setAttribute('aria-current', String(l.dataset.g === at)))
      const i = D.groups.findIndex((g) => g.id === at)
      if (cur) cur.textContent = `${i + 1} · ${D.groups[i].short}`
    } else if (cur) cur.textContent = `${D.total} ${T.answers}`
    if (bar) bar.classList.toggle('fq-on', !!searchBox && searchBox.getBoundingClientRect().bottom < 0 && root.getBoundingClientRect().bottom > 120)
  }
  let raf = 0
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; spy() }) }
  if (!REC) { addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll) }

  /* ---------- the team's status, in their time zone ---------- */
  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  function status() {
    const k = D.contact, el = root.querySelector('.fq-status')
    if (!el) return
    const now = k.now ? new Date(k.now) : new Date()
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: k.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]))
    const day = DAYS.indexOf(parts.weekday.toLowerCase().slice(0, 3)), time = `${parts.hour}:${parts.minute}`
    const on = k.hours.days.includes(DAYS[day]) && time >= k.hours.open && time < k.hours.close
    let when = ''
    if (!on)
      for (let i = 0; i < 8; i++) {
        const d = (day + i) % 7
        if (k.hours.days.includes(DAYS[d]) && (i > 0 || time < k.hours.open)) { when = i === 0 ? T.today : i === 1 ? T.tomorrow : T.days[d]; break }
      }
    el.classList.toggle('fq-off', !on)
    el.querySelector('span').textContent = on ? fill(T.online, { time, city: k.city }) : fill(T.offline, { when, open: k.hours.open, time, city: k.city })
  }
  status()
  if (!REC && !D.contact.now) setInterval(status, 30000)

  /* ---------- the recorder's clock: a fixed script, a pure function of time ---------- */
  const P = D.preview
  const byId = (id) => document.getElementById(id)
  const S = { open1: [1.4, 1.9], scroll1: [3.2, 4.6], open2: [5.0, 5.5], shut: [7.2, 7.6], scrollS: [7.2, 8.0], type: 8.2, step: 0.13, clear: 11.0, scrollC: [11.2, 12.4], openC: [12.5, 13.0], flash: [13.0, 14.2], scrollK: [15.0, 16.2] }
  const length = 18
  const typedEnd = S.type + S.step * (P?.query?.length ?? 0)
  const moments = [['top', 0.2, 1.3], ['open', 2.0, 3.1], ['middle', 5.6, 7.1], ['search', Math.round((typedEnd + 0.15) * 100) / 100, 10.9], ['deeplink', 14.3, 14.9], ['contact', 16.3, 17.9]]
  const clamp = (x) => Math.max(0, Math.min(1, x))
  const ramp = (t, [a, b]) => clamp((t - a) / (b - a))
  const out3 = (p) => 1 - Math.pow(1 - p, 3)
  const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
  const maxY = () => document.documentElement.scrollHeight - innerHeight
  function progress(d, p) {
    const ans = d.querySelector('.fq-ans'), inner = ans.firstElementChild
    d.dataset.want = p > 0 ? '1' : '0'
    d.classList.remove('fq-closing')
    if (p <= 0) { d.open = false; ans.style.height = ''; inner.style.opacity = ''; d.style.removeProperty('--p'); return }
    d.open = true
    if (p >= 1) { ans.style.height = ''; inner.style.opacity = ''; d.style.removeProperty('--p'); return }
    ans.style.height = ''
    const h = ans.scrollHeight
    ans.style.height = out3(p) * h + 'px'
    inner.style.opacity = String(clamp(p * 1.25))
    d.style.setProperty('--p', out3(p).toFixed(4))
  }
  function seek(t) {
    const [A, B, C] = [byId(P.open[0]), byId(P.open[1]), byId(P.deepLink)]
    // what is typed
    const typed = t < S.type || t >= S.clear ? '' : P.query.slice(0, Math.min(P.query.length, Math.floor((t - S.type) / S.step) + 1))
    if (input) input.value = typed
    root.classList.toggle('fq-typing', t >= S.type - 0.4 && t < S.clear)
    filter(typed)
    // what is open
    const p = new Map(entries.map((d) => [d, 0]))
    const add = (d, v) => p.set(d, Math.max(p.get(d), v))
    add(A, ramp(t, S.open1) * (1 - ramp(t, S.shut)))
    add(B, ramp(t, S.open2) * (1 - ramp(t, S.shut)))
    add(C, ramp(t, S.openC))
    for (const [d, v] of p) progress(d, v)
    // the flash on arrival by #link
    const f = ramp(t, S.flash)
    const bump = f <= 0 || f >= 1 ? 0 : f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8
    C.style.setProperty('--mw', (2 + 4 * out3(bump)).toFixed(2) + 'px')
    // where the page is
    // every scroll in the script comes to rest on a row boundary, never through a row
    const anchors = () => [...entries.filter((d) => !d.classList.contains('fq-hidden')).map((d) => d.closest('.fq-group[data-g]')?.querySelector('details.fq-q:not(.fq-hidden)') === d ? d.closest('.fq-group') : d), ...groups, root.querySelector('.fq-stuck')].map((el) => docTop(el) - pad()).filter((v) => v >= 0)
    const snap = (y) => { const at = anchors().filter((v) => v <= y + 0.5); return at.length ? Math.max(...at) : 0 }
    // the last stop shows the whole contact: the first row boundary that fits it, or the end of the page
    const blocks = () => [...root.querySelectorAll('details[open] .fq-body > *, details[open] .fq-body li, details[open] .fq-foot')].map((el) => docTop(el) - 16)
    const snapUp = (y) => { const at = [...anchors(), ...blocks()].filter((v) => v >= y - 0.5 && v <= maxY() + 0.5); return at.length ? Math.min(...at) : maxY() }
    const bottom = (el) => el.getBoundingClientRect().bottom + scrollY
    const y1 = () => snap(Math.min(maxY(), groups.length ? docTop(B.closest('.fq-group')) - pad() : Math.min(docTop(A) - pad(), Math.max(docTop(B) - pad(), bottom(B) - innerHeight + 48))))
    const yS = () => Math.min(maxY(), Math.max(0, Math.min(docTop(list), docTop(searchBox)) - pad() - 8))
    const yC = () => snap(Math.min(maxY(), landing(C)))
    const yK = () => snapUp(Math.max(0, bottom(root.querySelector('.fq-stuck')) - innerHeight + 16))
    const lerp = (a, b, q) => a + (b - a) * inOut(q)
    let y = 0
    if (t >= S.scrollK[0]) y = lerp(yC(), yK(), ramp(t, S.scrollK))
    else if (t >= S.scrollC[0]) y = lerp(yS(), yC(), ramp(t, S.scrollC))
    else if (t >= S.clear) y = yS()
    else if (t >= S.scrollS[0]) y = lerp(y1(), yS(), ramp(t, S.scrollS))
    else if (t >= S.scroll1[0]) y = lerp(0, y1(), ramp(t, S.scroll1))
    scrollTo(0, Math.round(y))
    spy()
    // the phone bar slides rather than snapping in the video
    if (bar) bar.classList.toggle('fq-on', searchBox.getBoundingClientRect().bottom < 0)
  }

  filter('')
  const ready = document.fonts.ready.then(() => {
    spy()
    if (location.hash && !REC) openHash(false)
  })
  window.FAQKit = { ready, seek, length, moments, filter, setOpen, openHash, status }
})()
