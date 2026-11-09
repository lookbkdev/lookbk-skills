/* Testimonial Wall runtime (Lookbk). No library: one clock drives the lead
   letter, the wall and the histogram, and every speed comes from reading
   time. With ?tw-record=1 nothing moves on its own: the recorder calls
   TestimonialWall.seek(t) for each frame. */
(() => {
  'use strict'
  const REC = /[?&]tw-record=1\b/.test(location.search)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  // cubic-bezier easing, solved by Newton steps then bisection
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const X = (t) => ((ax * t + bx) * t + cx) * t
    const Y = (t) => ((ay * t + by) * t + cy) * t
    const dX = (t) => (3 * ax * t + 2 * bx) * t + cx
    return (x) => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      let t = x
      for (let i = 0; i < 6; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-5) return Y(t); if (Math.abs(d) < 1e-6) break; t -= e / d }
      let lo = 0, hi = 1; t = x
      for (let i = 0; i < 24; i++) { const v = X(t); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2 }
      return Y(t)
    }
  }
  const E = { in: bezier(0.16, 1, 0.3, 1), out: bezier(0.5, 0, 0.75, 0), meta: bezier(0.2, 0.7, 0.1, 1), io: bezier(0.65, 0, 0.35, 1), bar: bezier(0.22, 1, 0.36, 1) }
  const words = (s) => s.trim().split(/\s+/).filter(Boolean).length
  const store = {
    get: () => { try { return sessionStorage.getItem('tw-paused') === '1' } catch (e) { return false } },
    set: (v) => { try { sessionStorage.setItem('tw-paused', v ? '1' : '0') } catch (e) { /* storage blocked: fine */ } },
  }

  function setup(sec) {
    const still = reduce.matches && !REC
    sec.classList.toggle('tw-still', still)
    const phone = () => innerWidth < 760
    const tablet = () => innerWidth < 1100
    const beside = sec.classList.contains('tw--below') === false

    // ---------- pause ----------
    const pauseBtn = sec.querySelector('.tw-pause')
    let paused = !REC && store.get()
    if (still) pauseBtn.hidden = true
    pauseBtn.setAttribute('aria-pressed', String(paused))
    pauseBtn.addEventListener('click', () => {
      paused = !paused
      pauseBtn.setAttribute('aria-pressed', String(paused))
      store.set(paused)
    })

    // ---------- histogram ----------
    const bars = [...sec.querySelectorAll('.tw-hist b')]
    let histT = still ? 1e9 : null
    const paintHist = (t) => bars.forEach((b, i) => b.style.setProperty('--k', E.bar(clamp((t - 0.3 - i * 0.08) / 0.9)).toFixed(4)))
    if (!still) paintHist(0)

    // ---------- lead letter ----------
    const lead = sec.querySelector('.tw-lead')
    const slots = [...sec.querySelectorAll('.tw-slot')]
    const tabs = [...sec.querySelectorAll('.tw-tab')]
    const S = slots.map((el) => {
      const p = el.querySelector('.tw-q p')
      p.dataset.text = p.textContent
      return { el, p, meta: [...el.querySelectorAll('.tw-no, .tw-att, .tw-res')], read: Number(el.dataset.read) * 1000, lines: [] }
    })
    const split = (s) => {
      const text = s.p.dataset.text
      s.p.textContent = ''
      const spans = text.split(' ').map((w) => { const sp = document.createElement('span'); sp.textContent = w + ' '; sp.style.display = 'inline'; s.p.appendChild(sp); return sp })
      const rows = []
      let top = null
      for (const sp of spans) {
        const y = sp.offsetTop
        if (top === null || y > top + 2) rows.push([]), (top = y)
        rows[rows.length - 1].push(sp.textContent)
      }
      s.p.textContent = ''
      s.lines = rows.map((r) => {
        const ln = document.createElement('span'); ln.className = 'tw-ln'
        const inner = document.createElement('span'); inner.textContent = r.join('').trim()
        ln.appendChild(inner); s.p.appendChild(ln)
        return inner
      })
      const n = s.lines.length
      s.IN = (n - 1) * 70 + 700
      s.OUT = (n - 1) * 50 + 420
      s.total = s.IN + s.read + s.OUT
    }
    let cur = 0, local = 0, next = null, shown = -1
    const show = (i) => {
      if (shown === i) return
      shown = i
      S.forEach((s, j) => {
        s.el.hidden = j !== i
        tabs[j].setAttribute('aria-selected', String(j === i))
        tabs[j].tabIndex = j === i ? 0 : -1
        tabs[j].style.setProperty('--p', '0')
      })
    }
    const paintLead = (i, t) => {
      show(i)
      const s = S[i]
      const n = s.lines.length
      let prog = 0
      if (t < s.IN) {
        s.lines.forEach((ln, j) => { ln.style.transform = `translateY(${((1 - E.in(clamp((t - j * 70) / 640))) * 105).toFixed(2)}%)` })
        const k = E.meta(clamp((t - ((n - 1) * 70 + 200)) / 500))
        s.meta.forEach((m) => { m.style.opacity = k.toFixed(3); m.style.transform = `translateY(${((1 - k) * 12).toFixed(2)}px)` })
      } else if (t < s.IN + s.read) {
        s.lines.forEach((ln) => { ln.style.transform = '' })
        s.meta.forEach((m) => { m.style.opacity = ''; m.style.transform = '' })
        prog = (t - s.IN) / s.read
      } else {
        const o = t - s.IN - s.read
        s.lines.forEach((ln, j) => { ln.style.transform = `translateY(${(-E.out(clamp((o - j * 50) / 420)) * 105).toFixed(2)}%)` })
        const k = clamp(o / 300)
        s.meta.forEach((m) => { m.style.opacity = (1 - k).toFixed(3); m.style.transform = '' })
        prog = 1
      }
      tabs[i].style.setProperty('--p', still ? '1' : prog.toFixed(4))
    }
    const select = (j) => {
      if (j === cur && next === null) return
      if (still) { cur = j; local = S[j].IN; paintLead(cur, local); return }
      if (local < S[cur].IN + S[cur].read) { local = S[cur].IN + S[cur].read; next = j } else next = j
    }
    tabs.forEach((tab, j) => {
      tab.addEventListener('click', () => select(j))
      tab.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1, Home: -j, End: tabs.length - 1 - j }[e.key]
        if (d === undefined) return
        e.preventDefault()
        const k = (j + d + tabs.length) % tabs.length
        tabs[k].focus()
        select(k)
      })
    })
    let leadHover = false, leadFocus = false
    lead.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') leadHover = true })
    lead.addEventListener('pointerleave', () => { leadHover = false })
    lead.addEventListener('focusin', () => { leadFocus = true })
    lead.addEventListener('focusout', () => { leadFocus = false })

    // ---------- wall ----------
    const wall = sec.querySelector('.tw-wall')
    const colsEl = wall.querySelector('.tw-cols')
    const want = Number(wall.dataset.columns) || 1
    const notes = [...colsEl.querySelectorAll('.tw-note')].sort((a, b) => a.dataset.i - b.dataset.i)
    let cols = [], H = 0, v = 0, wallW = -1
    const cap = () => (phone() ? 1 : tablet() ? Math.min(want, 2) : want)
    const build = (c, copies) => {
      colsEl.textContent = ''
      colsEl.style.setProperty('--cols', c)
      return Array.from({ length: c }, (_, i) => {
        const col = document.createElement('div'); col.className = 'tw-col'
        const track = document.createElement('ul'); track.className = 'tw-track'
        const mine = notes.filter((_, k) => k % c === i)
        for (let r = 0; r < copies; r++) for (const nt of mine) track.appendChild(r ? nt.cloneNode(true) : nt)
        col.appendChild(track); colsEl.appendChild(col)
        return { col, track, items: [...track.children], hover: false, off: 0, dir: i % 2 ? 1 : -1 }
      })
    }
    const layoutWall = () => {
      if (still) { cols = build(cap(), 1); return }
      wall.classList.add('tw-moving')
      wall.style.height = ''
      H = wall.clientHeight
      let c = cap(), got
      for (; c >= 1; c--) {
        got = build(c, 1)
        const sets = got.map((k) => k.track.offsetHeight)
        const tallest = Math.max(...notes.map((nt) => nt.offsetHeight))
        if (Math.min(...sets) >= H + tallest || c === 1) {
          if (Math.min(...sets) < H + tallest) { H = Math.max(240, Math.min(...sets) - tallest); wall.style.height = H + 'px' }
          break
        }
      }
      const phase = [0, 0.47, 0.21, 0.66]
      cols = build(c, 2)
      cols.forEach((k, i) => {
        k.set = k.items.slice(0, k.items.length / 2).reduce((a, it) => a + it.offsetHeight, 0)
        k.tops = k.items.map((it) => it.offsetTop)
        k.hs = k.items.map((it) => it.offsetHeight)
        k.off0 = k.set * phase[i % 4]
        k.col.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') k.hover = true })
        k.col.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') k.hover = false })
        k.col.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') k.hover = !k.hover })
      })
      // the slowest reader sets the pace: every note stays on screen at least twice its reading time
      let lim = Infinity
      for (const k of cols) k.items.slice(0, k.items.length / 2).forEach((it, j) => {
        const T = 1 + words(it.querySelector('p').textContent) / 3.8
        lim = Math.min(lim, (H + k.hs[j]) / T)
      })
      v = Math.min(24, lim / 2)
    }
    const F = () => (phone() ? 56 : 72)
    const paintWall = () => {
      const f = F()
      for (const k of cols) {
        const m = ((k.off0 + k.off) % k.set + k.set) % k.set
        const y = k.dir < 0 ? -m : -k.set + m
        k.track.style.transform = `translate3d(0,${y.toFixed(2)}px,0)`
        k.items.forEach((it, j) => {
          const top = k.tops[j] + y, bot = top + k.hs[j]
          if (bot < -2 || top > H + 2) { if (it.style.opacity !== '0') it.style.opacity = '0'; return }
          it.style.opacity = clamp(Math.min(top, H - bot) / f).toFixed(3)
        })
      }
    }

    // ---------- cases rail ----------
    const rail = sec.querySelector('.tw-rail')
    const arrows = [...sec.querySelectorAll('.tw-arrow')]
    const count = sec.querySelector('.tw-count')
    const step = () => { const c = rail.children; return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : rail.clientWidth }
    const railState = () => {
      if (!rail) return
      const st = step(), n = rail.children.length
      const first = Math.round(rail.scrollLeft / st)
      const gap = st - rail.children[0].offsetWidth
      const vis = Math.max(1, Math.floor((rail.clientWidth + gap + 2) / st))
      const max = rail.scrollWidth - rail.clientWidth
      const two = (x) => String(x).padStart(2, '0')
      count.textContent = vis > 1 ? `${two(first + 1)}–${two(Math.min(n, first + vis))} / ${two(n)}` : `${two(first + 1)} / ${two(n)}`
      arrows[0].setAttribute('aria-disabled', String(rail.scrollLeft <= 2))
      arrows[1].setAttribute('aria-disabled', String(rail.scrollLeft >= max - 2))
    }
    if (rail) {
      arrows.forEach((a) => a.addEventListener('click', () => {
        if (a.getAttribute('aria-disabled') === 'true') return
        rail.scrollBy({ left: Number(a.dataset.dir) * step(), behavior: still ? 'auto' : 'smooth' })
      }))
      rail.addEventListener('scroll', railState, { passive: true })
      if (REC) rail.style.scrollSnapType = 'none'
    }

    // ---------- layout ----------
    const layout = () => {
      wallW = innerWidth
      S.forEach(split)
      layoutWall()
      if (!REC) {
        if (still) S.forEach((s, j) => { if (j === cur) { local = s.IN } })
        shown = -1
        paintLead(cur, Math.min(local, S[cur].total - 1))
        if (!still) paintWall()
      }
      railState()
    }

    // ---------- live clock ----------
    let inLead = true, inWall = true
    if (!REC && !still) {
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => es.forEach((e) => {
          if (e.target === lead) inLead = e.isIntersecting
          else if (e.target === wall) inWall = e.isIntersecting
          else if (e.isIntersecting && histT === null) histT = performance.now()
        }), { threshold: 0 })
        io.observe(lead)
        io.observe(wall)
        const hist = sec.querySelector('.tw-hist')
        if (hist) io.observe(hist)
      } else histT = performance.now()
      let last = performance.now()
      const tick = (now) => {
        const dt = Math.min(100, now - last); last = now
        if (histT !== null) paintHist((now - histT) / 1000)
        const hold = paused || document.hidden
        if (!(hold || leadHover || leadFocus || !inLead)) {
          local += dt
          if (local >= S[cur].total) { cur = next !== null ? next : (cur + 1) % S.length; next = null; local = 0 }
        }
        paintLead(cur, local)
        if (inWall) {
          for (const k of cols) if (!(hold || k.hover)) k.off += (v * dt) / 1000
          paintWall()
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
    if (still) paintHist(1e9)
    let rs = 0
    addEventListener('resize', () => { clearTimeout(rs); rs = setTimeout(() => { if (innerWidth !== wallW) layout() }, 150) })

    // ---------- record timeline ----------
    const timeline = () => {
      const vh = innerHeight
      const maxY = document.documentElement.scrollHeight - vh
      const top = (el) => el.getBoundingClientRect().top + scrollY
      const pad = phone() ? 20 : 48
      const parts = [['head', sec.querySelector('.tw-head'), 0], ['lead', lead, pad], ['wall', wall, pad],
        ['cases', sec.querySelector('.tw-cases'), pad], ['press', sec.querySelector('.tw-press'), pad]]
        .filter(([, el]) => el).map(([name, el, p]) => [name, name === 'head' ? 0 : clamp(top(el) - p, 0, maxY)])
        .sort((a, b) => a[1] - b[1])
      const stops = []
      for (const [name, y] of parts) {
        const last = stops[stops.length - 1]
        if (last && Math.abs(y - last.y) < vh * 0.3) last.names.push(name)
        else stops.push({ y, names: [name] })
      }
      let t = 0
      const HOLD = { head: 2.4, lead: 7.6, wall: 3.4, cases: 4.4, press: 3 }
      stops.forEach((s, i) => {
        if (i) { s.moveFrom = t; t += 1.5 }
        s.from = t
        s.hold = Math.max(...s.names.map((n) => HOLD[n]))
        t += s.hold
        s.to = t
      })
      return { stops, length: Math.round(t * 100) / 100 }
    }
    let TL = null
    const scrollAt = (t) => {
      const st = TL.stops
      let y = st[0].y
      for (let i = 0; i < st.length; i++) {
        const s = st[i]
        if (t >= s.from) y = s.y
        else if (i && t >= s.moveFrom) { y = st[i - 1].y + (s.y - st[i - 1].y) * E.io((t - s.moveFrom) / 1.5); break }
        else break
      }
      return y
    }
    const seek = (t) => {
      scrollTo(0, Math.round(scrollAt(t)))
      paintHist(t)
      const ls = TL.stops.find((s) => s.names.includes('lead'))
      const s0 = S[0]
      let c = Math.max(s0.IN, s0.IN + s0.read - 2600 + (t - ls.from) * 1000), i = 0
      for (let g = 0; g < 50 && c >= S[i].total; g++) { c -= S[i].total; i = (i + 1) % S.length }
      paintLead(i, c)
      for (const k of cols) k.off = v * t
      paintWall()
      const cs = TL.stops.find((s) => s.names.includes('cases'))
      if (rail && cs) rail.scrollLeft = step() * E.io(clamp((t - cs.from - 1.4) / 0.7))
      railState()
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    }
    const moments = () => {
      const out = []
      const r = (x) => Math.round(x * 100) / 100
      for (const s of TL.stops) {
        const name = s.names.includes('lead') ? (s.names.includes('wall') ? 'spread' : 'lead') : ['cases', 'wall', 'press', 'head'].find((n) => s.names.includes(n))
        let a = s.from + 0.15, b = s.to - 0.1
        if (s.names.includes('head')) a = Math.max(a, 1.7)
        if (s.names.includes('lead')) b = s.from + 2.5
        if (s.names.includes('cases')) a = s.from + 2.3
        out.push([name, r(a), r(b)])
      }
      return { length: TL.length, moments: out }
    }

    const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      layout()
      if (REC) {
        TL = timeline()
        api.length = TL.length
      }
    })
    const api = { ready, seek: (t) => seek(t), moments: () => moments(), length: 0 }
    return api
  }

  const all = [...document.querySelectorAll('[data-tw]:not([data-tw-on])')].map((sec) => { sec.setAttribute('data-tw-on', ''); return setup(sec) })
  if (all.length) window.TestimonialWall = all[0]
})()
