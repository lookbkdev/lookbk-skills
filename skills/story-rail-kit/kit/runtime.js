/* Story Rail runtime. Inlined into every built page and embed; no libraries.
   It adds the controls on top of a rail that already scrolls and snaps in
   CSS: previous/next by exactly one card, the scale and its bracket, the
   counter, the edge fades, mouse drag with coasting (a drag never clicks),
   the keyboard, loops that play only in view, optional autoplay, and a
   recording clock (?sr-record=1) that steps everything frame by frame. */
(() => {
  const REC = /[?&]sr-record=1/.test(location.search)
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const pad2 = (n) => String(n).padStart(2, '0')

  function loopFrame(el, t) {
    const kind = el.dataset.srLoop
    if (kind === 'broth') {
      el.setAttribute('transform', `rotate(${((t / 8) * 360 * 0.125).toFixed(3)} 725 500)`)
    } else if (kind === 'library') {
      const off = 60 + (0.5 - 0.5 * Math.cos((t / 12) * Math.PI * 2)) * 140
      for (const p of el.children) {
        const x = Number(p.dataset.x)
        p.setAttribute('points', `${x + 26},250 ${(x + 26 + off).toFixed(1)},${(250 + off * 0.55).toFixed(1)} ${(x + 26 + off).toFixed(1)},810 ${x + 26},810`)
      }
    }
  }

  function Rail(root) {
    const vp = root.querySelector('.sr-vp')
    const rail = root.querySelector('.sr-rail')
    const cards = [...rail.children]
    const ctrl = root.querySelector('.sr-ctrl')
    const prevB = root.querySelector('.sr-prev')
    const nextB = root.querySelector('.sr-next')
    const count = root.querySelector('.sr-count')
    const scale = root.querySelector('.sr-scale')
    const mm = root.querySelector('.sr-mm')
    const segsBox = root.querySelector('.sr-segs')
    const win = root.querySelector('.sr-win')
    const nums = root.querySelector('.sr-nums')
    const N = cards.length
    let segs = [], marks = []
    ctrl.hidden = false
    scale.hidden = false

    const G = () => parseFloat(getComputedStyle(rail).paddingLeft) || 0
    const pos = (i) => cards[i].offsetLeft - G()
    const max = () => vp.scrollWidth - vp.clientWidth
    /** The length of the rail's content, first card to last. */
    const lastEnd = () => cards[N - 1].offsetLeft + cards[N - 1].offsetWidth - cards[0].offsetLeft
    const target = (i) => clamp(pos(clamp(i, 0, N - 1)), 0, max())
    /** The card at the snap edge. */
    function cur() {
      const L = vp.scrollLeft
      let best = 0
      for (let i = 0; i < N; i++) if (pos(i) <= L + 2) best = i
      return best
    }
    function fades(L) {
      const g = G()
      const fl = Math.min(g, L)
      const fr = Math.min(g, Math.max(0, max() - L))
      return [fl, fr]
    }
    /** How much of each card is clear of the fades, 0 to 1. */
    function shown(L = vp.scrollLeft) {
      const [fl, fr] = fades(L)
      const a = L + fl, b = L + vp.clientWidth - fr
      return cards.map((c) => {
        const l = c.offsetLeft, r = l + c.offsetWidth
        return Math.max(0, Math.min(r, b) - Math.max(l, a)) / c.offsetWidth
      })
    }

    // trailing room so the last stop lines a card up with the margin, like every other stop
    function tail() {
      rail.style.paddingRight = ''
      const g = G(), gap = parseFloat(getComputedStyle(rail).columnGap) || 0, room = vp.clientWidth - 2 * g
      let k = N - 1, used = cards[N - 1].offsetWidth
      while (k > 0 && used + gap + cards[k - 1].offsetWidth <= room) { k--; used += gap + cards[k].offsetWidth }
      rail.style.paddingRight = g + Math.max(0, room - used) + 'px'
    }
    function layout() {
      tail()
      segsBox.textContent = ''
      nums.textContent = ''
      const g = G(), gap = parseFloat(getComputedStyle(rail).columnGap) || 0
      const span = lastEnd(), W = mm.clientWidth
      segs = cards.map((c, i) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'sr-seg ' + c.dataset.kind
        b.setAttribute('aria-label', `Go to card ${i + 1} of ${N}: ${c.dataset.label}`)
        b.style.width = ((c.offsetWidth + (i < N - 1 ? gap : 0)) / span) * W + 'px'
        b.addEventListener('click', () => go(i))
        segsBox.appendChild(b)
        return b
      })
      marks = cards.map((c, i) => {
        const s = document.createElement('span')
        s.textContent = pad2(i + 1)
        s.style.left = ((c.offsetLeft - g) / span) * W + 'px'
        s.setAttribute('aria-hidden', 'true')
        nums.appendChild(s)
        return s
      })
      update()
    }

    let lastCount = ''
    function update() {
      const L = vp.scrollLeft, M = max()
      const [fl, fr] = fades(L)
      vp.style.setProperty('--fl', fl + 'px')
      vp.style.setProperty('--fr', fr + 'px')
      const g = G(), span = lastEnd(), W = mm.clientWidth
      const a = clamp(L - g, 0, span), b = clamp(L + vp.clientWidth - g, 0, span)
      win.style.left = (a / span) * W + 'px'
      win.style.width = ((b - a) / span) * W + 7 + 'px'
      const v = shown(L).map((x) => x >= 0.6)
      segs.forEach((s, i) => s.classList.toggle('is-on', v[i]))
      marks.forEach((s, i) => s.classList.toggle('is-on', v[i]))
      cards.forEach((c) => c.classList.toggle('is-past', c.offsetLeft < L + g - 2 || c.offsetLeft > L + vp.clientWidth - g - 2))
      const on = v.map((x, i) => (x ? i : -1)).filter((i) => i >= 0)
      if (on.length) {
        const f = on[0] + 1, l = on[on.length - 1] + 1
        const html = `${pad2(f)}${l > f ? '–' + pad2(l) : ''} <i>of ${pad2(N)}</i>`
        if (html !== lastCount) { count.innerHTML = html; lastCount = html }
      }
      prevB.disabled = L < 2
      nextB.disabled = L > M - 2
    }

    function go(i, instant) {
      vp.scrollTo({ left: target(i), behavior: instant || reduced() ? 'auto' : 'smooth' })
    }
    const next = () => { if (vp.scrollLeft < max() - 2) go(cur() + 1) }
    const prev = () => {
      const c = cur()
      go(vp.scrollLeft > pos(c) + 2 && vp.scrollLeft < max() - 2 ? c : c - 1)
    }
    prevB.addEventListener('click', prev)
    nextB.addEventListener('click', next)

    let raf = 0
    vp.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update() }) }, { passive: true })
    new ResizeObserver(() => layout()).observe(root)

    // keyboard: the rail is a focusable region; links are one tab stop each
    vp.addEventListener('keydown', (e) => {
      if (e.target !== vp && !e.target.closest('.sr-card')) return
      const k = e.key
      if (k === 'ArrowRight') { e.preventDefault(); next() }
      else if (k === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (k === 'Home') { e.preventDefault(); go(0) }
      else if (k === 'End') { e.preventDefault(); go(N - 1) }
    })
    rail.addEventListener('focusin', (e) => {
      const c = e.target.closest('.sr-card')
      if (!c) return
      const i = cards.indexOf(c), L = vp.scrollLeft
      const l = c.offsetLeft, r = l + c.offsetWidth
      // already fully on screen and clear of the fades: leave it
      const [fl, fr] = fades(L)
      if (l >= L + fl - 1 && r <= L + vp.clientWidth - fr + 1) return
      go(i)
    })

    // mouse drag, with coasting; a drag never ends in a click
    let drag = null
    vp.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || REC) return
      drag = { x: e.clientX, l: vp.scrollLeft, moved: false, v: 0, px: e.clientX, t: performance.now() }
    })
    addEventListener('pointermove', (e) => {
      if (!drag) return
      const dx = e.clientX - drag.x
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; vp.classList.add('is-drag') }
      if (!drag.moved) return
      vp.scrollLeft = drag.l - dx
      const now = performance.now()
      drag.v = (e.clientX - drag.px) / Math.max(1, now - drag.t)
      drag.px = e.clientX
      drag.t = now
    })
    const swallow = (e) => { e.preventDefault(); e.stopPropagation() }
    addEventListener('pointerup', () => {
      if (!drag) return
      const d = drag
      drag = null
      if (!d.moved) return
      vp.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => vp.removeEventListener('click', swallow, { capture: true }), 60)
      let v = reduced() ? 0 : -d.v * 16
      const dir = Math.sign(d.x - d.px) // +1 when the rail moved forward
      const settle = () => {
        const L = vp.scrollLeft
        let best = 0
        for (let i = 0; i < N; i++) if (Math.abs(target(i) - L) < Math.abs(target(best) - L)) best = i
        // a deliberate drag (over 60 px) always moves at least one card its way
        const from = cards.findIndex((c, i) => Math.abs(target(i) - d.l) <= 2)
        if (from >= 0 && Math.abs(L - d.l) > 60 && best === from) best = clamp(from + dir, 0, N - 1)
        vp.classList.remove('is-drag')
        vp.scrollLeft = L
        go(best)
      }
      const step = () => {
        v *= 0.92
        vp.scrollLeft += v
        if (Math.abs(v) > 0.5) requestAnimationFrame(step)
        else settle()
      }
      requestAnimationFrame(step)
    })
    vp.addEventListener('dragstart', (e) => e.preventDefault())

    // loops play only while on screen
    const loops = [...root.querySelectorAll('[data-sr-loop], .sr-media video')]
    const inView = new Set()
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const el = e.target
        if (e.isIntersecting && e.intersectionRatio >= 0.35) inView.add(el)
        else inView.delete(el)
        if (el.tagName === 'VIDEO' && !REC) {
          if (inView.has(el) && !reduced()) el.play().catch(() => {})
          else el.pause()
        }
      }
    }, { threshold: [0, 0.35, 0.6] })
    loops.forEach((l) => io.observe(l.closest('.sr-media') ? l : l))
    if (!REC) {
      const t0 = performance.now()
      const tick = (now) => {
        if (!reduced()) for (const el of inView) if (el.dataset?.srLoop) loopFrame(el, (now - t0) / 1000)
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }

    // autoplay, only when the buyer asks for it
    const auto = Number(root.dataset.autoplay || 0)
    const pauseB = root.querySelector('.sr-pause')
    if (auto && !REC) {
      let paused = false, hold = false
      pauseB.hidden = false
      const label = () => { pauseB.textContent = paused ? 'Play' : 'Pause'; pauseB.setAttribute('aria-pressed', String(paused)) }
      pauseB.addEventListener('click', () => { paused = !paused; label() })
      label()
      for (const [ev, v] of [['pointerenter', true], ['pointerleave', false], ['focusin', true], ['focusout', false], ['touchstart', true]]) root.addEventListener(ev, () => { hold = v }, { passive: true })
      setInterval(() => {
        if (paused || hold || document.hidden || reduced()) return
        if (vp.scrollLeft > max() - 2) go(0)
        else next()
      }, auto * 1000)
    }

    layout()
    return { root, vp, cards, lastEnd, go, next, prev, cur, max, pos, target, shown, fades, update, layout, loops }
  }

  /* ---------- the recording clock ---------- */
  function Recorder(R) {
    const { root, vp, cards } = R
    root.classList.add('sr-rec')
    const phone = innerWidth < 761
    const cursor = document.createElement('div')
    cursor.className = 'sr-cursor' + (phone ? ' is-touch' : '')
    if (!phone) cursor.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M5 2.5 L5 19.5 L9.6 15.3 L12.6 22 L15.6 20.7 L12.7 14.1 L19 13.6 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.body.appendChild(cursor)
    const N = cards.length
        // where things are on screen, in page coordinates at the recording scroll
    const rectOf = (el) => el.getBoundingClientRect()
    const centre = (el) => { const r = rectOf(el); return [r.left + r.width / 2, r.top + r.height / 2] }
    const s0 = () => R.target(0)
    // the script: [from, to, what]
        const T = {
      length: 19,
      moments: [['rest', 0.1, 0.75], ['step-1', 2.6, 4.2], ['step-2', 5.2, 6.5], ['hover', 8.1, 9.4], ['drag', 11.5, 12.7], ['end', 14.7, 15.9], ['start', 17.8, 18.9]],
    }
    // the drag moves one card: 60 % by hand, the rest by coasting, then it settles
    const dragSpan = () => Math.max(120, R.target(3) - R.target(2))
    function scrollAt(t) {
      const A = R.target(1), B = R.target(2), C = R.target(3), D = dragSpan()
      const E = R.max()
      const seg = (a, b, x, y) => x + (y - x) * ease(clamp((t - a) / (b - a), 0, 1))
      if (t < 1.8) return s0()
      if (t < 4.4) return seg(1.8, 2.5, s0(), A)
      if (t < 9.6) return seg(4.4, 5.1, A, B)
      if (t < 10.4) return Math.min(E, B + D * 0.6 * clamp((t - 9.6) / 0.8, 0, 1))
      if (t < 10.9) { const k = clamp((t - 10.4) / 0.5, 0, 1); return Math.min(E, B + D * (0.6 + 0.3 * (1 - Math.pow(1 - k, 3)))) }
      if (t < 13.6) return seg(10.9, 11.4, Math.min(E, B + D * 0.9), C)
      if (t < 16.7) return seg(13.6, 14.6, C, E)
      return seg(16.7, 17.7, E, s0())
    }
    function seek(t) {
      // pose: cursor positions are computed with the rail at its resting scroll
      const L = scrollAt(t)
      vp.scrollLeft = L
      R.update()
      const nb = root.querySelector('.sr-next'), segs = [...root.querySelectorAll('.sr-seg')]
      const hovCard = cards.find((c, i) => i >= 2 && /wide|tall/.test(c.dataset.kind)) ?? cards[Math.min(3, N - 1)]
      const media = hovCard.querySelector('.sr-media, .sr-qbox, .sr-nbox, .sr-ebox')
      const vr = vp.getBoundingClientRect()
      const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
      const mv = (a, b, from, to) => lerp(a, b, ease(clamp((t - from) / (to - from), 0, 1)))
      const home = [vr.left + vr.width * 0.72, vr.top + vr.height * 0.42]
      const btn = ((c) => [c[0] + 9, c[1] + 11])(centre(nb))
      const mediaC = media ? centre(media) : home
      const dragStart = [vr.left + vr.width * 0.66, vr.top + vr.height * 0.35]
      const dragEnd = [dragStart[0] - dragSpan() * 0.6, dragStart[1]]
      const segEnd = centre(segs[N - 1])
      const seg0 = centre(segs[0])
      let p, show = true, hov = false, pressed = false
      if (phone) {
        // touch: the finger appears only while it swipes or taps
        const swipe = (from, to) => mv([vr.left + vr.width * 0.75, vr.top + vr.height * 0.4], [vr.left + vr.width * 0.2, vr.top + vr.height * 0.4], from, to)
        show = false
        if (t >= 1.7 && t < 2.4) { p = swipe(1.7, 2.4); show = true }
        else if (t >= 4.3 && t < 5.0) { p = swipe(4.3, 5.0); show = true }
        else if (t >= 9.5 && t < 10.4) { p = lerp(dragStart, dragEnd, clamp((t - 9.6) / 0.8, 0, 1)); show = true }
        else if (t >= 13.3 && t < 13.7) { p = segEnd; show = true }
        else if (t >= 16.4 && t < 16.8) { p = seg0; show = true }
        p ??= home
      } else {
        if (t < 0.8) { p = home; show = false }
        else if (t < 6.6) p = mv(home, btn, 0.8, 1.6)
        else if (t < 7.3) p = mv(btn, mediaC, 6.6, 7.3)
        else if (t < 9.5) p = mediaC
        else if (t < 9.6) p = dragStart
        else if (t < 10.4) p = lerp(dragStart, dragEnd, clamp((t - 9.6) / 0.8, 0, 1))
        else if (t < 12.8) p = mv(dragEnd, segEnd, 10.6, 11.4)
        else if (t < 16.0) p = segEnd
        else p = mv(segEnd, seg0, 16.0, 16.6)
        if (t >= 1.6 && t < 6.6) nb.classList.add('is-hov'); else nb.classList.remove('is-hov')
        hov = t >= 7.3 && t < 9.5
        pressed = (t > 1.7 && t < 1.85) || (t > 4.3 && t < 4.45) || (t > 9.5 && t < 10.4) || (t > 13.5 && t < 13.65) || (t > 16.6 && t < 16.75)
      }
      // hover on the card: zoom and arrow, eased over 0.7 s
      const hk = hov ? ease(clamp((t - 7.3) / 0.7, 0, 1)) : 0
      for (const c of cards) {
        const z = c === hovCard ? hk : 0
        c.style.setProperty('--z', String(1 + 0.025 * z))
        c.style.setProperty('--nx', 5 * z + 'px')
      }
      cursor.style.display = show ? 'block' : 'none'
      cursor.style.transform = `translate(${p[0]}px, ${p[1]}px) scale(${pressed ? 0.8 : 1})`
      for (const el of R.loops) if (el.dataset?.srLoop) loopFrame(el, t)
      for (const v of root.querySelectorAll('.sr-media video')) { try { v.pause(); v.currentTime = t % (v.duration || 1) } catch {} }
    }
    return {
      length: T.length,
      moments: () => T.moments,
      seek,
    }
  }

  const roots = [...document.querySelectorAll('.sr')]
  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    const rails = roots.map(Rail)
    const api = { rails }
    if (rails[0]) {
      const R = rails[0]
      Object.assign(api, R)
      if (REC) {
        // the section in view, the same way at every size
        const head = R.root.querySelector(innerWidth < 761 ? '.sr-ctrl' : '.sr-head')
        scrollTo(0, Math.max(0, head.getBoundingClientRect().top + scrollY - (innerWidth < 761 ? 24 : 40)))
        const rec = Recorder(R)
        Object.assign(api, rec)
        rec.seek(0)
      }
    }
    window.StoryRail = api
    return api
  })
  window.StoryRailReady = ready
})()
