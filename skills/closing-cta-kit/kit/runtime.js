/* Closing CTA Kit: the browser runtime, inlined into every build.
   - works out "today" (the real date; or the config's preview.now when the
     page is recorded or opened with ?cc-now=YYYY-MM-DD) and, past the
     deadline, swaps the band to its after-close copy
   - writes the live day counts and places the price window's today marker
   - punches the perforation, finds a clear place for the stamp (it never
     covers text), fits the figure to its column
   - the entrance: one timeline, run once when the band comes into view and
     settled after it; under reduced motion it is settled from the start
   - the sentence form: sizes each blank to its text, checks the email, and
     shows typing, error, sending and sent
   - window.ClosingCTA: ready, length, seek(t), moments, form(state, value)
     for the recorder, which steps the page frame by frame */
(() => {
  const root = document.querySelector('.cc')
  if (!root) return
  const cfg = JSON.parse(root.dataset.cc)
  const Q = new URLSearchParams(location.search)
  const RECORD = Q.has('cc-record')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const $ = (s, el = root) => el.querySelector(s)
  const $$ = (s, el = root) => [...el.querySelectorAll(s)]
  const layout = root.dataset.layout
  const DAY = 864e5

  /* ---------- today, the deadline and after close ---------- */
  const nowParam = Q.get('cc-now')
  const parseNow = (s) => { const t = Date.parse(/T/.test(s) ? s : s + 'T12:00:00Z'); return Number.isFinite(t) ? t : null }
  const now = (nowParam && parseNow(nowParam)) ?? (RECORD && cfg.previewNow ? parseNow(cfg.previewNow) : null) ?? Date.now()
  /** the calendar day (as a day number) of an instant in the deadline's time zone */
  const dayIn = (t) => {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t))
    return Math.round(Date.parse(p + 'T00:00:00Z') / DAY)
  }
  const closed = cfg.closes != null && now >= cfg.closes
  if (closed) {
    root.setAttribute('data-closed', '')
    for (const el of $$('[data-when="open"]')) el.hidden = true
    for (const el of $$('[data-when="closed"]')) el.hidden = false
  }
  // days left, counting today and the last day before the deadline
  const daysLeft = cfg.closes != null ? Math.max(0, dayIn(cfg.closes - 1) - dayIn(now) + 1) : null
  for (const el of $$('[data-days]')) {
    const n = daysLeft
    el.textContent = el.dataset.days.replace('{days}', String(n)).replace('{s}', n === 1 ? '' : 's')
  }
  const win = $('.cc-win')
  if (win && cfg.opened != null && cfg.closes != null) {
    const t = Math.max(0, Math.min(1, (now - cfg.opened) / (cfg.closes - cfg.opened)))
    win.style.setProperty('--t', (t * 100).toFixed(3) + '%')
    const span = Math.round((cfg.closes - cfg.opened) / DAY)
    win.style.setProperty('--tick', `calc(100% / ${Math.max(1, span)})`)
    $('.cc-today', win).dataset.side = t > 0.62 ? 'l' : 'r'
    if (closed) win.setAttribute('data-closed', '')
  }

  /* ---------- easing ---------- */
  function bezier(x1, y1, x2, y2) {
    const a = (p1, p2) => 1 - 3 * p2 + 3 * p1, b = (p1, p2) => 3 * p2 - 6 * p1, c = (p1) => 3 * p1
    const at = (t, p1, p2) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t
    const slope = (t, p1, p2) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1)
    return (x) => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      let t = x
      for (let i = 0; i < 8; i++) { const s = slope(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (at(t, x1, x2) - x) / s }
      return at(Math.min(1, Math.max(0, t)), y1, y2)
    }
  }
  const TRAVEL = bezier(0.2, 0.7, 0.2, 1)
  const DIGIT = bezier(0.3, 0.9, 0.2, 1)
  const OUT = bezier(0, 0, 0.2, 1)
  /** 0..1 progress of a step that starts at `from` ms and lasts `dur` ms, at `e` ms */
  const step = (e, from, dur, ease = TRAVEL) => ease(Math.min(1, Math.max(0, (e - from) / dur)))

  /* ---------- layout helpers (re-run on resize) ---------- */
  const phone = () => innerWidth <= 640
  function perforate() {
    const tk = $('.cc-tk')
    if (!tk) return
    const stub = $('.cc-stub-face')
    if (phone()) tk.style.setProperty('--py', stub.offsetHeight + 'px')
    const p = $('.cc-perf'), horiz = phone()
    const len = horiz ? p.offsetWidth : p.offsetHeight, gap = 11
    const n = Math.max(0, Math.floor(len / gap))
    const off = (len - (n - 1) * gap) / 2 - 2.5
    p.innerHTML = Array.from({ length: n }, (_, i) => `<i style="${horiz ? 'left' : 'top'}:${(off + i * gap).toFixed(1)}px"></i>`).join('')
  }
  function fitFigure() {
    for (const f of $$('.cc-fig')) {
      if (f.closest('[hidden]')) continue
      f.style.setProperty('--fs', '400px')
      const w = $('.cc-cur', f).offsetWidth + $('.cc-n', f).scrollWidth + 4
      const cap = phone() ? 300 : 560
      f.style.setProperty('--fs', Math.min(cap, (400 * f.clientWidth * 0.985) / w).toFixed(1) + 'px')
    }
    for (const num of $$('.cc-num')) {
      if (num.closest('[hidden]')) continue
      num.style.removeProperty('--num-size')
      const fact = num.parentElement, room = fact.clientWidth - ($('.cc-of', fact)?.offsetWidth ?? 0) - 16
      const size = parseFloat(getComputedStyle(num).fontSize)
      if (num.scrollWidth > room) num.style.setProperty('--num-size', Math.floor((size * room) / num.scrollWidth) + 'px')
    }
  }
  /** Rectangles of everything on the ticket the stamp must not cover, relative to the ticket. */
  function keepClear(tk) {
    const o = tk.getBoundingClientRect(), out = []
    const add = (r, pad = 6) => { if (r.width && r.height) out.push({ l: r.left - o.left - pad, t: r.top - o.top - pad, r: r.right - o.left + pad, b: r.bottom - o.top + pad }) }
    const walker = document.createTreeWalker(tk, NodeFilter.SHOW_TEXT)
    for (let n; (n = walker.nextNode());) {
      if (!n.textContent.trim() || n.parentElement.closest('.cc-stamp, [hidden]')) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      for (const r of range.getClientRects()) add(r)
    }
    for (const el of $$('.cc-seats, .cc-legend, .cc-barcode, .cc-btn, .cc-link', tk)) if (el.offsetParent) add(el.getBoundingClientRect())
    return out
  }
  function placeStamp() {
    const tk = $('.cc-tk'), stamp = $('.cc-stamp')
    if (!tk || !stamp) return
    const W = tk.clientWidth, H = tk.clientHeight
    const clear = keepClear(tk)
    const stub = $('.cc-stub-face'), so = stub.getBoundingClientRect(), to = tk.getBoundingClientRect()
    const perfX = phone() ? null : so.left - to.left
    const cost = (x, y, s) => {
      let hit = 0
      // the stamp is round: test its inscribed square plus the four arcs roughly as a slightly smaller square
      const cx = x + s / 2, cy = y + s / 2, rad = s / 2
      for (const c of clear) {
        // how deep the round stamp reaches into the box
        const nx = Math.max(c.l, Math.min(cx, c.r)), ny = Math.max(c.t, Math.min(cy, c.b))
        const d = Math.hypot(nx - cx, ny - cy)
        if (d < rad) hit += (rad - d) * Math.min(c.r - c.l, c.b - c.t, rad)
      }
      const want = perfX != null ? Math.abs(cx - (perfX - s / 2 - 12)) * 0.6 + Math.abs(cy - H * 0.62) * 0.25 : Math.abs(cx - (W - s / 2 - 18)) * 0.3 + Math.abs(cy - (so.height * 0.35)) * 0.3
      return hit * 1e4 + want
    }
    let best = null
    for (const s of phone() ? [116, 108, 100, 92] : [172, 160, 148, 136, 124, 112]) {
      for (let y = 14; y <= H - s - 14; y += 6)
        for (let x = 14; x <= W - s - 14; x += 6) {
          const c = cost(x, y, s)
          if (!best || c < best.c) best = { x, y, s, c }
        }
      if (best && best.c < 1e4) break
      best = best && best.c < 1e4 ? best : best
    }
    stamp.style.setProperty('--stamp', best.s + 'px')
    stamp.style.setProperty('--sx', best.x + 'px')
    stamp.style.setProperty('--sy', best.y + 'px')
    stamp.dataset.clear = best.c < 1e4 ? '1' : '0'
    // mostly on the coloured stub: print it in the stub's light ink instead of dark ink that would vanish
    const onStub = phone() ? best.y + best.s / 2 < so.height : best.x + best.s / 2 > so.left - to.left
    stamp.toggleAttribute('data-on-stub', onStub)
  }

  /* ---------- the sentence form ---------- */
  const form = $('.cc-form')
  const measure = document.createElement('span')
  measure.setAttribute('aria-hidden', 'true')
  measure.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0'
  function sizeBlank(ctl) {
    const blank = ctl.closest('.cc-blank')
    const cs = getComputedStyle(ctl)
    // where the baseline sits in the blank's 1em line box, so the rule runs just under the letters
    const g = document.createElement('canvas').getContext('2d')
    g.font = cs.font
    const m = g.measureText('Hg'), asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent, fs = parseFloat(cs.fontSize)
    if (asc && fs) blank.style.setProperty('--base', ((fs - (asc + desc)) / 2 + asc).toFixed(1) + 'px')
    measure.style.font = cs.font
    measure.style.letterSpacing = cs.letterSpacing
    measure.style.textTransform = cs.textTransform
    let text = ctl.tagName === 'SELECT' ? ctl.options[ctl.selectedIndex]?.text ?? '' : ctl.value || ctl.placeholder
    measure.textContent = text
    blank.appendChild(measure)
    const w = measure.getBoundingClientRect().width
    measure.remove()
    if (ctl.tagName === 'SELECT') ctl.style.width = `calc(${Math.ceil(w)}px + .42em)`
    else ctl.style.width = Math.ceil(w + 6) + 'px'
    blank.toggleAttribute('data-filled', ctl.tagName === 'SELECT' || !!ctl.value)
  }
  function total() {
    if (!form) return
    const n = Number($('select[name="count"]', form)?.value ?? 1)
    for (const el of $$('[data-each]', form)) el.textContent = el.dataset.each.replace('{n}', n).replace('{total}', (Number(el.dataset.price) * n).toLocaleString('en-GB'))
  }
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
  function setState(state, value) {
    if (!form) return
    const input = $('input[type="email"]', form), blank = input.closest('.cc-blank'), msg = $('.cc-msg', form), btn = $('.cc-primary', form)
    if (value !== undefined) { input.value = value; sizeBlank(input) }
    root.dataset.state = state
    blank.toggleAttribute('data-err', state === 'error')
    input.setAttribute('aria-invalid', state === 'error' ? 'true' : 'false')
    msg.textContent = state === 'error' ? (input.value ? cfg.form.errBad : cfg.form.errEmpty) : ''
    btn.disabled = state === 'sending'
    $('.cc-go', btn).hidden = state === 'sending'
    $('.cc-dots', btn).hidden = state !== 'sending'
    if (state === 'sent') {
      const sel = (n) => $(`select[name="${n}"]`, form)
      const fill = (s) => s.replace('{n}', sel('count')?.value ?? '').replace('{option}', sel('option') ? sel('option').options[sel('option').selectedIndex].text : '').replace('{email}', input.value)
      const done = $('.cc-sent')
      $('.cc-say', done).innerHTML = fill(done.dataset.say).replace(/\[([^\]]+)\]/g, (_, x) => `<b${x.includes('@') ? ' class="cc-as-typed"' : ''}>${x.replace(/</g, '&lt;')}</b>`)
      for (const el of $$('[data-fill]', done)) el.textContent = fill(el.dataset.fill)
      if (!RECORD) $('.cc-say', done).focus({ preventScroll: true })
    }
  }
  if (form) {
    for (const ctl of $$('select, input', form)) {
      sizeBlank(ctl)
      ctl.addEventListener(ctl.tagName === 'SELECT' ? 'change' : 'input', () => {
        sizeBlank(ctl)
        total()
        if (root.dataset.state === 'error' && ctl.type === 'email' && emailOk(ctl.value)) setState('typing')
        else if (ctl.type === 'email' && root.dataset.state !== 'error') setState(ctl.value ? 'typing' : 'empty')
      })
    }
    total()
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      const input = $('input[type="email"]', form)
      if (!emailOk(input.value)) { setState('error'); input.focus(); return }
      setState('sending')
      const action = form.getAttribute('action')
      try {
        if (action && action !== '#') {
          const r = await fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
          if (!r.ok) throw new Error(String(r.status))
        } else await new Promise((r) => setTimeout(r, 900))
        setState('sent')
      } catch {
        setState('typing')
        $('.cc-msg', form).textContent = cfg.form.errSend
      }
    })
  }

  /* ---------- the entrance ---------- */
  const tk = $('.cc-tk'), stamp = $('.cc-stamp')
  const SETTLE = { stub: 1300, poster: 1750, sentence: 760 }[layout]
  function apply(e) {
    if (layout === 'stub') {
      const k = step(e, 0, 520)
      $('.cc-shadow').style.cssText = `opacity:${k};transform:translateY(${(1 - k) * 16}px)`
      const holes = $$('.cc-perf i')
      holes.forEach((h, i) => { h.style.opacity = step(e, 200 + i * 8, 120, OUT) })
      for (const d of $$('.cc-num > span')) d.style.transform = `translateY(${(1 - step(e, 300, 560, DIGIT)) * 105}%)`
      $$('.cc-seats i').forEach((s, i) => { const q = step(e, 700 + i * 40, 200, OUT); s.style.opacity = q; s.style.scale = String(0.6 + 0.4 * q) })
      if (stamp) {
        const q = step(e, 1000, 160, OUT)
        stamp.style.opacity = String(0.9 * q)
        stamp.style.scale = String(1.12 - 0.12 * q)
        stamp.style.rotate = `${-3 * (1 - q)}deg`
      }
    } else if (layout === 'poster') {
      const k = step(e, 0, 600)
      for (const el of $$('.cc-ps-title, .cc-ps-copy')) el.style.cssText = `opacity:${k};transform:translateY(${(1 - k) * 24}px)`
      $$('.cc-fig .cc-n > span').forEach((d, i) => { d.style.transform = `translateY(${(1 - step(e, 150 + i * 70, 700, DIGIT)) * 105}%)` })
      const cur = $('.cc-fig .cc-cur'); if (cur) cur.style.opacity = step(e, 150, 500)
      const was = $('.cc-was'); if (was) was.style.opacity = step(e, 700, 400)
      const draw = $('.cc-draw'); if (draw) draw.style.transform = `scaleX(${step(e, 500, 900, bezier(0.65, 0, 0.35, 1))})`
      const today = $('.cc-today'); if (today) { const q = step(e, 1400, 220, OUT); today.style.opacity = q; today.style.translate = `0 ${(1 - q) * -8}px` }
      const ring = $('.cc-end circle'); if (ring) ring.style.strokeDashoffset = String(70 * (1 - step(e, 1400, 300)))
    } else {
      $$('.cc-form .cc-rule').forEach((r, i) => { r.style.transform = `scaleX(${step(e, i * 90, 480)})` })
      const k = step(e, 0, 480)
      for (const el of $$('.cc-st-head, .cc-st-foot')) el.style.opacity = String(k)
    }
  }
  let started = null, settled = false
  const settle = () => { settled = true; root.setAttribute('data-settled', ''); apply(1e9) }
  function tick() {
    const e = performance.now() - started
    apply(e)
    if (e < SETTLE) requestAnimationFrame(tick)
    else settle()
  }
  const visibleEnough = () => {
    const r = root.getBoundingClientRect()
    const vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0))
    return vis >= Math.min(0.35 * r.height, 0.5 * innerHeight)
  }

  /* ---------- the recorder's clock ---------- */
  // A fixed script: rest with the band coming into the bottom of the screen,
  // scroll it into place (0.8 to 2.6 s), hold to the end.
  const LENGTH = 8
  const top = () => root.getBoundingClientRect().top + scrollY
  function scrollAt(t) {
    const h = root.offsetHeight, vh = innerHeight
    const max = document.documentElement.scrollHeight - vh
    const a = Math.max(0, Math.min(max, top() - vh * 0.82))
    const b = Math.max(0, Math.min(max, h <= vh ? top() - (vh - h) / 2 : top() - 16))
    const q = bezier(0.65, 0, 0.35, 1)(Math.min(1, Math.max(0, (t - 0.8) / 1.8)))
    return a + (b - a) * q
  }
  let enterAt = null
  function enterTime() {
    if (enterAt != null) return enterAt
    const keep = scrollY
    for (let t = 0; t <= LENGTH; t += 1 / 60) {
      scrollTo(0, scrollAt(t))
      if (visibleEnough()) { enterAt = Math.round(t * 1000) / 1000; break }
    }
    scrollTo(0, keep)
    return enterAt ?? 0
  }

  function layoutAll() { perforate(); fitFigure(); placeStamp(); if (form) for (const c of $$('select, input', form)) sizeBlank(c) }
  const ready = document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => {
    layoutAll()
    if (reduce) { settle() }
    else if (RECORD) apply(0)
    else {
      apply(0)
      const go = () => { if (started == null) { started = performance.now(); requestAnimationFrame(tick) } }
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(() => { if (visibleEnough()) { io.disconnect(); go() } }, { threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] })
        io.observe(root)
        addEventListener('scroll', function on() { if (started != null) return removeEventListener('scroll', on); if (visibleEnough()) { io.disconnect(); go() } }, { passive: true })
      } else go()
    }
    r()
  })))
  let rw = innerWidth
  addEventListener('resize', () => { if (innerWidth !== rw) { rw = innerWidth; layoutAll() } })

  window.ClosingCTA = {
    ready,
    length: LENGTH,
    closed,
    daysLeft,
    settleMs: SETTLE,
    seek(t) {
      scrollTo(0, scrollAt(t))
      if (reduce) return apply(1e9)
      const at = enterTime()
      apply(t < at ? 0 : (t - at) * 1000)
    },
    moments() {
      const at = enterTime()
      return { enter: at, settled: reduce ? 0 : Math.round((at + SETTLE / 1000) * 100) / 100, end: LENGTH }
    },
    form(state, value) { setState(state, value) },
    get settled() { return settled },
  }
})()
