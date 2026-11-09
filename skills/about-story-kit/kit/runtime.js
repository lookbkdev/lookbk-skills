/* About Story Kit runtime, inlined into every build. It:
   - draws the record as you scroll: the spine (or the rail's line) follows
     the scroll exactly, and each milestone's dot fills as the line reaches it;
   - places the rail's axis and its projection lines from each true date to
     its entry;
   - runs the index viewer (hover or focus a row and the viewer shows that
     person's decision);
   - fades each section up once as it comes into view;
   - and, with ?ab-record=1, hands the clock to the recorder: window.AboutKit
     .seek(t) scrolls a fixed script and sets every hover by hand, so each
     frame is the same on any machine. moments() lists the still holds. */
(() => {
  const root = document.querySelector('.ab')
  if (!root) return
  const q = new URLSearchParams(location.search)
  const REC = q.get('ab-record') === '1'
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  root.classList.add('ab-js')
  if (REC) root.classList.add('ab-rec')

  const tl = root.querySelector('.ab-tl')
  const ents = [...root.querySelectorAll('.ab-ent')]
  const pins = [...root.querySelectorAll('.ab-pin')]
  const leads = root.querySelector('.ab-leads')

  /* ---------- the rail's geometry ----------
     The axis is a true time scale. Each entry is placed as close to its own
     date as the entries beside it allow (even entries above the axis, odd
     below), and an L-shaped leader runs from the date's pin to the foot of
     the entry's rule. If the entries cannot fit, the record falls back to the
     spine. */
  function layoutRail() {
    if (!tl || !tl.classList.contains('ab-rail')) return
    tl.classList.remove('ab-railjs')
    ents.forEach((e) => { e.style.left = e.style.top = e.style.width = '' })
    tl.style.height = ''
    if (!leads || getComputedStyle(root.querySelector('.ab-axis')).display === 'none') { if (leads) leads.innerHTML = ''; return }
    const W = tl.clientWidth, n = ents.length, GAP = 24, LEAD = 44
    const w = Math.round(Math.min(380, Math.max(236, (2 * W) / (n + 1) - GAP)))
    const pinX = pins.map((p) => (parseFloat(p.style.left) / 100) * W)
    const xs = []
    let ok = true
    for (const row of [0, 1]) {
      const idx = ents.map((_, i) => i).filter((i) => i % 2 === row)
      let end = -Infinity
      for (const i of idx) { xs[i] = Math.min(Math.max(pinX[i], end + GAP), W - w); end = xs[i] + w }
      let next = Infinity
      for (const i of [...idx].reverse()) { xs[i] = Math.min(xs[i], next - GAP - w); next = xs[i] }
      for (const i of idx) if (xs[i] < -0.5) ok = false
    }
    if (!ok) { leads.innerHTML = ''; tl.classList.add('ab-railfall'); return }
    tl.classList.add('ab-railjs')
    ents.forEach((e, i) => { e.style.width = w + 'px'; e.style.left = xs[i].toFixed(1) + 'px' })
    const hs = ents.map((e) => e.offsetHeight)
    const topH = Math.max(...hs.filter((_, i) => i % 2 === 0))
    const botH = Math.max(0, ...hs.filter((_, i) => i % 2 === 1))
    const axisY = topH + LEAD
    ents.forEach((e, i) => { e.style.top = (i % 2 === 0 ? topH - hs[i] : axisY + LEAD) + 'px' })
    const H = axisY + LEAD + botH
    tl.style.height = H + 'px'
    tl.style.setProperty('--axis-y', axisY + 'px')
    let d = ''
    pins.forEach((pin, i) => {
      const x1 = pinX[i], x2 = xs[i] + 0.5
      const y1 = i % 2 === 0 ? axisY - 8 : axisY + 8
      const y2 = i % 2 === 0 ? axisY - LEAD : axisY + LEAD
      d += `<path data-i="${i}" d="M${x1.toFixed(1)} ${y1}V${y2}${Math.abs(x2 - x1) > 1 ? `H${x2.toFixed(1)}` : ''}"/>`
    })
    leads.setAttribute('viewBox', `0 0 ${W} ${H}`)
    leads.style.height = H + 'px'
    leads.innerHTML = d
  }
  const railOn = () => tl && tl.classList.contains('ab-railjs')

  /* ---------- drawing the record ---------- */
  let progress = 0
  function draw() {
    if (!tl) return
    const r = tl.getBoundingClientRect()
    let p
    if (reduce.matches) p = 1
    else if (railOn()) {
      // the rail draws while its axis travels from 85 % to 35 % of the viewport
      const ax = r.top + parseFloat(getComputedStyle(tl).getPropertyValue('--axis-y') || '0')
      p = (innerHeight * 0.85 - ax) / (innerHeight * 0.5)
    } else p = (innerHeight * 0.62 - r.top) / r.height
    p = Math.min(1, Math.max(0, p))
    progress = p
    tl.style.setProperty('--p', p.toFixed(4))
    if (railOn()) {
      pins.forEach((pin, i) => {
        const on = Number(pin.dataset.at) <= p + 1e-4
        pin.classList.toggle('ab-on', on)
        ents[i].classList.toggle('ab-on', on)
        leads?.querySelector(`[data-i="${i}"]`)?.classList.toggle('ab-on', on)
      })
    } else {
      for (const e of ents) {
        const at = (e.getBoundingClientRect().top - r.top + 20) / r.height
        e.classList.toggle('ab-on', at <= p + 1e-4)
      }
    }
  }

  /* ---------- index viewer ---------- */
  const rows = [...root.querySelectorAll('.ab-row')]
  const panels = [...root.querySelectorAll('.ab-vp')]
  function pick(i) {
    rows.forEach((r, k) => r.classList.toggle('ab-cur', k === i))
    panels.forEach((v, k) => { v.hidden = k !== i })
  }
  rows.forEach((r, i) => {
    r.addEventListener('mouseenter', () => pick(i))
    r.addEventListener('focus', () => pick(i))
    r.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus()
    })
  })

  /* ---------- entrance ---------- */
  const rises = [...root.querySelectorAll('.ab-rise')]
  if (REC || reduce.matches || !('IntersectionObserver' in window)) rises.forEach((s) => s.classList.add('ab-in'))
  else {
    const io = new IntersectionObserver((list) => {
      for (const e of list) if (e.isIntersecting) { e.target.classList.add('ab-in'); io.unobserve(e.target) }
    }, { threshold: 0.12 })
    rises.forEach((s) => io.observe(s))
  }

  /* ---------- the recorder's script ---------- */
  const tiles = [...root.querySelectorAll('.ab-pp')]
  const hoverI = Number(root.dataset.hover || 0)
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
  const absTop = (el) => el.getBoundingClientRect().top + scrollY
  const maxY = () => document.documentElement.scrollHeight - innerHeight
  function marks() {
    const vh = innerHeight
    const rec = root.querySelector('#ab-record'), ppl = root.querySelector('#ab-people'), num = root.querySelector('#ab-numbers')
    const tlTop = absTop(tl), tlH = tl.offsetHeight
    let mid, end
    if (railOn()) {
      const ax = tlTop + parseFloat(getComputedStyle(tl).getPropertyValue('--axis-y') || '0')
      // p = (0.85 vh - (ax - y)) / 0.5 vh
      mid = ax - vh * 0.85 + vh * 0.5 * 0.55
      end = Math.max(mid + 1, ax - vh * 0.85 + vh * 0.5 * 1.0)
      const fit = absTop(rec) - vh * 0.03
      mid = Math.min(Math.max(mid, fit), end)
    } else {
      mid = tlTop + tlH * 0.45 - vh * 0.62
      end = tlTop + tlH - vh * 0.62
    }
    const c = (y) => Math.round(Math.min(maxY(), Math.max(0, y)))
    return {
      hero: 0,
      rec: c(absTop(rec) - vh * 0.04),
      mid: c(mid),
      end: c(end),
      people: c(absTop(ppl) - vh * 0.04),
      numbers: c(absTop(num) - vh * 0.06),
      close: c(maxY()),
    }
  }
  // [time, mark] keyframes; between two keyframes with the same mark the page holds
  const SCRIPT = [
    [0, 'hero'], [1.6, 'hero'], [3.0, 'rec'], [4.6, 'mid'], [5.6, 'mid'], [7.6, 'end'], [8.4, 'end'],
    [9.6, 'people'], [12.6, 'people'], [13.8, 'numbers'], [14.8, 'numbers'], [15.8, 'close'], [17, 'close'],
  ]
  const HOVER_AT = 10.0
  const LENGTH = 17
  let M = null
  function seek(t) {
    if (!M) M = marks()
    let y = 0
    for (let k = 0; k < SCRIPT.length - 1; k++) {
      const [t0, a] = SCRIPT[k], [t1, b] = SCRIPT[k + 1]
      if (t >= t0 && t <= t1) { y = M[a] + (M[b] - M[a]) * ease((t - t0) / (t1 - t0)); break }
      if (t > t1) y = M[b]
    }
    scrollTo(0, Math.round(y))
    // the hover: the strip rises over 280 ms, the colour comes up over 320 ms
    const h = Math.min(1, Math.max(0, (t - HOVER_AT) / 0.32))
    const on = t >= HOVER_AT && t < 12.6 + 0.6
    tiles.forEach((el, i) => el.style.setProperty('--h', on && i === hoverI ? String(ease(h)) : '0'))
    if (rows.length) pick(on ? hoverI : 0)
    draw()
    layoutRail()
    draw()
  }
  /** Still holds: stretches where nothing on screen moves. */
  function moments() {
    return {
      length: LENGTH,
      holds: [
        { name: 'hero', from: 0.1, to: 1.5 },
        { name: 'record', from: 4.7, to: 5.5 },
        { name: 'record-end', from: 7.7, to: 8.3 },
        { name: 'people', from: HOVER_AT + 0.4, to: 12.5 },
        { name: 'numbers', from: 13.9, to: 14.7 },
        { name: 'close', from: 15.9, to: 16.9 },
      ],
    }
  }

  const fonts = document.fonts ? document.fonts.ready : Promise.resolve()
  const imgs = Promise.all([...root.querySelectorAll('img')].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r }))))
  const ready = Promise.all([fonts, imgs]).then(() => new Promise((r) => requestAnimationFrame(() => r()))).then(() => { layoutRail(); draw(); root.setAttribute('data-ready', '') })

  if (!REC) {
    let raf = 0
    const tick = () => { raf = 0; draw() }
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(tick) }, { passive: true })
    addEventListener('resize', () => { layoutRail(); draw() })
    reduce.addEventListener?.('change', draw)
  } else {
    addEventListener('resize', () => { M = null })
  }
  layoutRail(); draw()

  window.AboutKit = { ready, seek: (t) => { seek(t) }, moments, length: LENGTH, progress: () => progress, pick, layout: () => { M = null; layoutRail(); draw() } }
})()
