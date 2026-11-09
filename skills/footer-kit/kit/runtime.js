/* Footer Kit runtime. Inlined into the built page and the embed; no library.
   - fits the name to the measure on its ink (kerning kept), on one line or,
     when one line would be too short, on two
   - the lift: the page above is a sheet; the board under it is uncovered
     with the scroll, with a cast shadow and the name rising through the gap
   - live hours, the newsletter form's states, back to top
   - ?fk-record=1: nothing moves on its own; window.FooterKit.seek(t) drives it */
(() => {
  const root = document.querySelector('.fk')
  if (!root) return
  const cfg = JSON.parse(root.getAttribute('data-fk') || '{}')
  const qs = new URLSearchParams(location.search)
  const REC = qs.has('fk-record')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const $ = (s, el = root) => el.querySelector(s)
  const $$ = (s, el = root) => [...el.querySelectorAll(s)]
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  const upper = $('.fk-upper'), board = $('.fk-board'), floor = $('.fk-floor')
  let still = false

  /* ---------------------------------------------------------------- the name */
  const wm = $('.fk-wm')
  const ctx = document.createElement('canvas').getContext('2d')
  function measure(el) {
    const cs = getComputedStyle(el)
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} 200px ${cs.fontFamily}`
    if ('fontKerning' in ctx) ctx.fontKerning = 'normal'
    const m = ctx.measureText(el.textContent)
    return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: Math.max(0, m.actualBoundingBoxDescent) }
  }
  /* places a run so its ink starts at x and its ink top at y, at font size fs */
  function place(el, m, fs, x, y) {
    const k = fs / 200
    el.style.fontSize = fs + 'px'
    el.style.left = '0px'
    el.style.top = '0px'
    const probe = document.createElement('span')
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
    el.appendChild(probe)
    const base = probe.getBoundingClientRect().top - el.getBoundingClientRect().top
    probe.remove()
    el.style.left = (x + m.l * k) + 'px'
    el.style.top = (y + m.a * k - base) + 'px'
  }
  const fit = { lines: 1, fs: 0, inkW: 0, inkH: 0, measure: 0 }
  function fitName() {
    if (!wm) return
    const W = wm.clientWidth
    const one = $('.fk-wl[data-set="1"]', wm)
    const two = $$('.fk-wl[data-set="2"]', wm)
    const m1 = measure(one)
    const k1 = W / (m1.l + m1.r)
    const h1 = (m1.a + m1.d) * k1
    const stackBelow = cfg.stackBelow ?? 120
    if (two.length === 2 && h1 < stackBelow) {
      const [a, b] = two.map(measure)
      const k = W / Math.max(a.l + a.r, b.l + b.r)
      const fs = 200 * k
      // ink boxes stacked with one even gap, whatever each line's x-height or ascenders
      const gap = fs * 0.06
      const h1 = (a.a + a.d) * k, h2 = (b.a + b.d) * k
      place(two[0], a, fs, 0, 0)
      place(two[1], b, fs, W - (b.l + b.r) * k, h1 + gap)
      wm.style.height = (h1 + gap + h2) + 'px'
      wm.dataset.lines = '2'
      Object.assign(fit, { lines: 2, fs, inkW: Math.max(a.l + a.r, b.l + b.r) * k, inkH: Math.max(h1, h2), measure: W })
    } else {
      const fs = 200 * k1
      place(one, m1, fs, 0, 0)
      wm.style.height = h1 + 'px'
      wm.dataset.lines = '1'
      Object.assign(fit, { lines: 1, fs, inkW: (m1.l + m1.r) * k1, inkH: h1, measure: W })
    }
  }

  /* ---------------------------------------------------------------- the lift */
  function mode() {
    still = reduce.matches || qs.has('fk-still')
    root.classList.toggle('fk-still', still)
    // the board can only lie under the sheet if the sheet is at least as tall as it
    const lift = !still && cfg.lift !== false && upper.offsetHeight >= board.offsetHeight
    root.classList.toggle('fk-lift', lift)
    if (!lift) { floor.style.transform = ''; root.style.setProperty('--lift', 0) }
  }
  const ix = $('.fk-ix'), map = $('.fk-map'), form = $('.fk-form')
  /* how far an element has travelled up the screen: 0 as its top reaches `from`, 1 at `to` (shares of the viewport) */
  const through = (el, from, to) => {
    const r = el.getBoundingClientRect()
    return clamp((innerHeight * from - r.top) / (innerHeight * (from - to)))
  }
  let doneAt = 0
  function tick() {
    const vh = innerHeight
    const doc = document.documentElement
    root.style.setProperty('--read', clamp(scrollY / Math.max(1, doc.scrollHeight - vh)).toFixed(4))
    if (still) {
      root.classList.add('fk-done')
      return
    }
    if (ix) ix.style.setProperty('--dots', through(ix, 0.95, 0.45).toFixed(3))
    if (map) map.style.setProperty('--route', through(map, 0.9, 0.35).toFixed(3))
    if (form) form.style.setProperty('--field', through(form, 0.98, 0.6).toFixed(3))
    if (!root.classList.contains('fk-lift')) { root.classList.add('fk-done'); return }
    const fh = board.offsetHeight
    const edge = upper.getBoundingClientRect().bottom          // the sheet's cut edge
    let p = clamp((vh - edge) / fh)                            // share of the board uncovered
    if (p > 0.995) p = 1
    const lift = clamp(p / 0.7)
    root.style.setProperty('--edge-y', Math.max(0, edge - (vh - fh)).toFixed(1) + 'px')
    root.style.setProperty('--lift', (lift * (1 - clamp((p - 0.85) / 0.15))).toFixed(3))
    root.classList.toggle('fk-done', p > 0.985)
    const rise = cfg.rise ?? 0.22
    floor.style.transform = p >= 1 ? '' : `translateY(${((1 - p) * rise * fh).toFixed(1)}px)`
    fit.p = p
  }

  /* ---------------------------------------------------------------- hours */
  const hours = $('.fk-hours')
  function hoursNow() {
    if (!hours || !cfg.hours) return
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const now = cfg.now ? new Date(cfg.now) : new Date()
    let wd, hm
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: cfg.now ? 'UTC' : cfg.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
      wd = parts.find((x) => x.type === 'weekday').value.slice(0, 3).toLowerCase()
      hm = Number(parts.find((x) => x.type === 'hour').value) * 60 + Number(parts.find((x) => x.type === 'minute').value)
    } catch { return }
    const i = days.indexOf(wd)
    const mins = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
    const span = (d) => { const v = cfg.hours[days[d]]; if (!v || v === 'closed') return null; const [a, b] = v.split('-'); return [mins(a), mins(b)] }
    $$('tr', hours).forEach((tr, k) => tr.classList.toggle('fk-today', k === i))
    const t = cfg.text, today = span(i)
    const fmt = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    let s
    if (today && hm >= today[0] && hm < today[1]) s = today[1] - hm <= 60 ? t.closesAt.replace('{t}', fmt(today[1])) : t.open
    else {
      let d = i, first = true, next = null
      for (let n = 0; n < 8 && !next; n++, d = (d + 1) % 7, first = false) {
        const sp = span(d)
        if (sp && (!first || hm < sp[0])) next = [d, sp[0]]
      }
      s = next ? t.closed.replace('{d}', cfg.dayNames[next[0]]).replace('{t}', fmt(next[1])) : t.closedAll
    }
    $('.fk-status', hours).textContent = s
  }

  /* ---------------------------------------------------------------- the newsletter */
  function setForm(state, msg, value) {
    if (!form) return
    form.dataset.state = state
    const input = $('input', form), fine = $('.fk-fine', form)
    if (value !== undefined) input.value = value
    fine.textContent = msg ?? (state === 'error' ? form.dataset.err : form.dataset.fine)
    input.setAttribute('aria-invalid', state === 'error' ? 'true' : 'false')
  }
  if (form) {
    const input = $('input', form)
    input.addEventListener('focus', () => form.dataset.state === 'empty' && setForm('typing'))
    input.addEventListener('input', () => form.dataset.state === 'error' && setForm('typing'))
    input.addEventListener('blur', () => form.dataset.state === 'typing' && !input.value && setForm('empty'))
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const v = input.value.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { setForm('error'); input.focus(); return }
      const action = form.getAttribute('action')
      setForm('sending', form.dataset.sending)
      try {
        if (action && action !== '#') await fetch(action, { method: 'POST', body: new FormData(form), mode: 'no-cors' })
        setForm('sent')
        $('.fk-sent', form).focus()
      } catch {
        setForm('error', form.dataset.failed)
      }
    })
  }

  /* ---------------------------------------------------------------- back to top */
  const top = $('.fk-top')
  if (top) top.addEventListener('click', () => {
    let target = document.getElementById(cfg.topTarget || '') || document.querySelector('h1') || document.body
    scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' })
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
  })

  /* ---------------------------------------------------------------- start */
  function layout() { fitName(); mode(); tick() }
  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    layout()
    hoursNow()
    if (!REC) setInterval(hoursNow, 60000)
  })
  addEventListener('scroll', () => tick(), { passive: true })
  addEventListener('resize', layout)
  reduce.addEventListener?.('change', layout)
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (wm && Math.abs(wm.clientWidth - fit.measure) > 0.5) layout() }).observe(root)

  /* ---------------------------------------------------------------- recording */
  // A fixed script of scroll positions over `length` seconds: from the end of the
  // page above, down onto the board, a hold, back up (the lift is reversible), down again.
  const length = 12
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x))
  function scrollAt(t) {
    const doc = document.documentElement
    const end = doc.scrollHeight - innerHeight
    const start = Math.max(0, end - (upper.offsetHeight + board.offsetHeight) - innerHeight * 0.35)
    const back = end - board.offsetHeight * 0.75
    if (t < 1) return start
    if (t < 6) return start + (end - start) * ease((t - 1) / 5)
    if (t < 7.6) return end
    if (t < 9) return end + (back - end) * ease((t - 7.6) / 1.4)
    if (t < 10.6) return back + (end - back) * ease((t - 9) / 1.6)
    return end
  }
  if (REC) root.classList.add('fk-rec')
  window.FooterKit = {
    ready,
    length,
    fit,
    seek(t) {
      scrollTo(0, Math.round(scrollAt(t)))
      tick()
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    },
    /* where the first descent crosses a share of the board uncovered */
    at(share) {
      let best = 1
      for (let t = 1; t <= 6; t += 0.02) {
        scrollTo(0, Math.round(scrollAt(t))); tick()
        if ((fit.p ?? 1) >= share) { best = t; break }
      }
      return Math.round(best * 100) / 100
    },
    form: (state, value) => setForm(state, undefined, value),
    still: () => still,
  }
})()
