/* Phone Screen Showcase runtime (Lookbk). No dependencies.
   One phone walks through the app: on each step a fingertip ring lands next to
   the thing to tap, the thing dips, and the next screen arrives the way the
   app itself moves (push, sheet, tab or fade). The chapters beside it follow.
   Everything drawn is a pure function of the story position, so scrolling
   back plays the steps backwards and the recorder can seek any moment.
   ?pss-record=1 stops the clock and exposes window.PSS.seek(t). */
(() => {
  'use strict'
  const TAP_END = 0.36 // the part of a step change spent on the tap
  const SWAP = 0.28 // the part spent crossfading the copy, after the tap
  const BOUNDARY = 1.3 // seconds per step change in timed play
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  // cubic-bezier(.32,.72,0,1), the shape of a native navigation spring
  const bez = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
    const sx = (t) => ((ax * t + bx) * t + cx) * t
    const sy = (t) => ((ay * t + by) * t + cy) * t
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx
    return (x) => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      let t = x
      for (let i = 0; i < 8; i++) {
        const d = dx(t)
        if (Math.abs(d) < 1e-6) break
        t -= (sx(t) - x) / d
      }
      return sy(clamp(t))
    }
  }
  const nav = bez(0.32, 0.72, 0, 1)
  const out3 = (x) => 1 - Math.pow(1 - clamp(x), 3)

  function init(sec) {
    if (sec.dataset.pssInit) return
    sec.dataset.pssInit = '1'
    const data = JSON.parse(sec.querySelector('.pss-data').textContent)
    const q = new URLSearchParams(location.search)
    const record = q.get('pss-record') === '1'
    const rm = !record && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (record) sec.dataset.play = 'timed'
    const play = sec.dataset.play
    const n = data.n
    const hold = data.hold
    const per = hold + BOUNDARY
    const STACK = matchMedia('(max-width:759px), (max-width:1100px) and (max-aspect-ratio:9/10)')
    const stacked = () => STACK.matches
    const $ = (s, r = sec) => r.querySelector(s)
    const $$ = (s, r = sec) => [...r.querySelectorAll(s)]
    const pin = $('.pss-pin')
    const stage = $('.pss-stage')
    const copy = $('.pss-copy')
    const rig = $('.pss-pin .pss-rig')
    const tilt = $('.pss-tilt', rig)
    const app = $('.pss-app', rig)
    const glass = $('.pss-glass', rig)
    const note = $('.pss-note', rig)
    const cap = $('.pss-cap')
    const lis = $$('.pss-ch')
    const caps = $$('.pss-caps > div')
    const segs = $$('.pss-segs button')
    const light = $('.pss-light')
    const gobo = $('.pss-gobo')
    const cast = $('.pss-cast')
    const beam = $('.pss-beam')
    const dust = $('.pss-dust')

    function makeView(appEl) {
      const S = [...appEl.querySelectorAll('.pss-scr')]
      return {
        app: appEl,
        S,
        ring: appEl.querySelector('.pss-tap'),
        dim: S.map((s) => s.querySelector(':scope > .pss-dim')),
        panel: S.map((s) => s.querySelector('.pss-sheetp')),
        blocks: S.map((s) => [...s.querySelectorAll('.pss-body > *:not(.pss-grab)')]),
        targets: S.map((s, i) => (data.tap[i]?.id ? s.querySelector(`[data-id="${CSS.escape(data.tap[i].id)}"]`) : null)),
        rings: [],
        arriving: -1,
        pressed: null,
      }
    }
    const view = makeView(app)
    const darkApp = getComputedStyle(sec).getPropertyValue('--a-status').trim() === '#ffffff'
    const DIM = darkApp ? 0.45 : 0.2

    /* ------------------------------------------------ the screens at a moment */
    function blank() {
      return { vis: 0, x: 0, y: 0, s: 1, r: 0, o: 1, dim: 0, sy: 0, zi: 1 }
    }
    function setBase(st, k) {
      if (data.via[k] === 'sheet') {
        const bd = st[k - 1]
        Object.assign(bd, { vis: 1, s: 0.94, y: 10, r: 40, dim: DIM, zi: 1 })
        Object.assign(st[k], { vis: 1, sy: 0, zi: 2 })
        return [k - 1, k]
      }
      Object.assign(st[k], { vis: 1, zi: 1 })
      return [k]
    }
    /** from, to: steps; f: 0..1 through the change (0 = resting on `from`). */
    function layout(from, to, f) {
      const st = view.S.map(blank)
      const e = nav(clamp((f - TAP_END) / (1 - TAP_END)))
      const group = setBase(st, from)
      let arrive = -1
      if (f > TAP_END && to !== from) {
        const via = to === 0 ? 'fade' : data.via[to]
        arrive = to
        if (via === 'sheet') {
          const b = st[from]
          b.s = 1 - 0.06 * e
          b.y = 10 * e
          b.r = 40 * e
          b.dim = DIM * e
          Object.assign(st[to], { vis: 1, sy: (1 - e) * 100, zi: 3 })
        } else if (via === 'push') {
          for (const g of group) {
            st[g].x = -28 * e
            st[g].dim = st[g].dim + (0.35 - st[g].dim) * e * 0.6
          }
          Object.assign(st[to], { vis: 1, x: (1 - e) * 100, zi: 5 })
        } else {
          for (const g of group) st[g].o = 1 - e
          const nb = setBase(st, to)
          for (const g of nb) {
            st[g].o = e
            st[g].y += 12 * (1 - e)
            st[g].zi += 4
          }
        }
      }
      return { st, e, arrive }
    }
    function paint(v, st, e, arrive) {
      st.forEach((s, i) => {
        const el = v.S[i]
        el.style.visibility = s.vis ? 'visible' : 'hidden'
        if (!s.vis) return
        el.style.transform = `translate(${s.x.toFixed(3)}%,${s.y.toFixed(2)}px) scale(${s.s.toFixed(4)})`
        el.style.borderRadius = s.r ? `${s.r.toFixed(1)}px` : ''
        el.style.opacity = s.o >= 0.999 ? '' : s.o.toFixed(3)
        el.style.zIndex = s.zi
        el.style.boxShadow = s.x > 0.5 ? '-12px 0 30px rgba(0,0,0,.18)' : ''
        if (v.dim[i]) v.dim[i].style.opacity = s.dim.toFixed(3)
        if (v.panel[i]) v.panel[i].style.transform = s.sy ? `translateY(${s.sy.toFixed(3)}%)` : ''
      })
      // the arriving screen's blocks settle in order
      if (v.arriving !== arrive && v.arriving >= 0) for (const b of v.blocks[v.arriving]) (b.style.transform = ''), (b.style.opacity = '')
      v.arriving = arrive
      if (arrive >= 0) {
        const fade = !(data.via[arrive] === 'push')
        v.blocks[arrive].forEach((b, j) => {
          const qq = out3((e - 0.18 - j * 0.07) / 0.5)
          b.style.transform = qq >= 1 ? '' : `translateY(${((1 - qq) * 12).toFixed(2)}px)`
          b.style.opacity = !fade || qq >= 1 ? '' : (0.2 + 0.8 * qq).toFixed(3)
        })
      }
    }

    /* ------------------------------------------------------- tap positions */
    function measureTargets(v, z) {
      const saved = v.S.map((s) => [s.style.cssText, v.panel[v.S.indexOf(s)]?.style.cssText])
      v.S.forEach((s, i) => {
        s.style.transform = 'none'
        s.style.visibility = 'visible'
        if (v.panel[i]) v.panel[i].style.transform = 'none'
      })
      for (const bs of v.blocks) for (const b of bs) b.style.transform = ''
      const a = v.app.getBoundingClientRect()
      const loc = (r) => ({ left: (r.left - a.left) / z, right: (r.right - a.left) / z, top: (r.top - a.top) / z, bottom: (r.bottom - a.top) / z })
      v.rings = data.tap.map((t, i) => {
        if (!t) return null
        if (t.at) return { x: (t.at[0] / 100) * 390, y: (t.at[1] / 100) * 844 }
        const el = v.targets[i]
        if (!el) return null
        const r = loc(el.getBoundingClientRect())
        const texts = []
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        for (let nd = walk.nextNode(); nd; nd = walk.nextNode()) {
          if (!nd.textContent.trim()) continue
          const pe = nd.parentElement
          const bg = getComputedStyle(pe).backgroundColor
          // a pill or a chip keeps its whole shape clear, not just its letters
          if (pe !== el && bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
            texts.push(loc(pe.getBoundingClientRect()))
            continue
          }
          const rg = document.createRange()
          rg.selectNodeContents(nd)
          for (const cr of rg.getClientRects()) texts.push(loc(cr))
        }
        const R = 26
        const y = (r.top + r.bottom) / 2
        const want = r.left + (r.right - r.left) * 0.8
        // the clear stretches beside the words; the fingertip goes to the middle
        // of the widest one (on a tie, the one nearer the right, where thumbs land)
        const runs = []
        for (let x = r.left + 22; x <= r.right - 22; x += 2) {
          const hit = texts.some((tr) => x + R > tr.left && x - R < tr.right && y + R > tr.top && y - R < tr.bottom)
          if (hit) continue
          const last = runs[runs.length - 1]
          if (last && x - last[1] <= 2) last[1] = x
          else runs.push([x, x])
        }
        let best = null
        let bestScore = -1
        for (const [a0, a1] of runs) {
          const score = a1 - a0 - Math.abs((a0 + a1) / 2 - want) * 0.05
          if (score > bestScore) (bestScore = score), (best = (a0 + a1) / 2)
        }
        if (best !== null) return { x: best, y }
        // no room beside the words (a small chip): the fingertip lands just under them,
        // and the press itself (the chip fills) is the cue
        const tb = Math.max(...texts.map((tr) => tr.bottom), y)
        return { x: Math.min(r.right - 2, 368), y: tb + 23 }
      })
      v.S.forEach((s, i) => {
        s.style.cssText = saved[i][0]
        if (v.panel[i]) v.panel[i].style.cssText = saved[i][1] ?? ''
      })
    }
    function paintTap(v, from, f, st, hint) {
      if (v.pressed && v.pressed.k !== from) release(v)
      const pos = v.rings[from]
      const el = v.targets[from]
      let a = 0, sc = 1, p = 0
      if (pos && f > 0) {
        a = f < 0.06 ? f / 0.06 : f < TAP_END ? 1 : Math.max(0, 1 - (f - TAP_END) / 0.1)
        sc = 0.6 + 0.4 * out3(f / 0.12)
        p = f < 0.12 ? 0 : f < 0.18 ? (f - 0.12) / 0.06 : f < 0.33 ? 1 : f < 0.4 ? 1 - (f - 0.33) / 0.07 : 0
      } else if (pos && hint > 0) {
        a = hint
        sc = 0.85 + 0.15 * hint
      }
      v.ring.style.opacity = a ? a.toFixed(3) : '0'
      if (pos && a) {
        const x = pos.x + ((st[from]?.x ?? 0) / 100) * 390
        v.ring.style.transform = `translate(${x.toFixed(1)}px,${pos.y.toFixed(1)}px) scale(${sc.toFixed(3)})`
      }
      if (el) {
        if (p > 0) {
          el.style.transform = `scale(${(1 - 0.04 * p).toFixed(4)})`
          el.style.filter = `brightness(${(1 - 0.12 * p).toFixed(3)})`
          el.classList.toggle('is-press', p > 0.5)
          v.pressed = { k: from, el }
        } else if (v.pressed?.el === el) release(v)
      }
    }
    function release(v) {
      const el = v.pressed.el
      el.style.transform = ''
      el.style.filter = ''
      el.classList.remove('is-press')
      v.pressed = null
    }

    /* ------------------------------------------------------------- the page */
    let geo = { pw: 300, z: 0.7 }
    let current = { from: 0, to: 0, f: 0, pr: 0 }
    let pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    let lastOpen = -1

    function draw(from, to, f, pr, t = 0, hint = 0) {
      current = { from, to, f, pr }
      const { st, e, arrive } = layout(from, to, f)
      paint(view, st, e, arrive)
      paintTap(view, from, f, st, hint)
      const c = clamp((f - TAP_END) / SWAP)
      const moving = to !== from && f > TAP_END
      const open = moving && c >= 0.5 ? to : from
      const w = moving ? (c >= 0.5 ? (c - 0.5) * 2 : 1 - c * 2) : 1
      const prOpen = open === from ? pr : 0
      lis.forEach((li, i) => {
        const on = i === open
        if (on !== li.classList.contains('on')) li.classList.toggle('on', on)
        li.style.setProperty('--w', on ? w.toFixed(3) : '0')
        li.style.setProperty('--p', on ? prOpen.toFixed(4) : '0')
        const b = li.querySelector('.pss-chb')
        if (on) b.setAttribute('aria-current', 'step')
        else b.removeAttribute('aria-current')
      })
      caps.forEach((cp, i) => {
        cp.style.setProperty('--w', i === open ? w.toFixed(3) : '0')
        if (open !== lastOpen) {
          if (i === open) cp.removeAttribute('aria-hidden')
          else cp.setAttribute('aria-hidden', 'true')
        }
      })
      segs.forEach((s, i) => s.style.setProperty('--p', i < open ? '1' : i === open ? prOpen.toFixed(4) : '0'))
      if (open !== lastOpen) {
        const [l1, l2] = data.notes[open]
        note.firstElementChild.textContent = l1
        note.lastElementChild.textContent = l2
        const pos = view.rings[open]
        note.style.setProperty('--ny', pos ? `${(geo.pw * 0.037 + pos.y * geo.z).toFixed(1)}px` : '30%')
        lastOpen = open
      }
      note.style.setProperty('--no', w.toFixed(3))
      // the phone turns a little toward the light while the screen changes
      const swing = moving ? Math.sin(Math.PI * e) : 0
      const side = data.light === 'beam' ? 1 : -1
      tilt.style.setProperty('--ry', `${(side * 2.2 * swing + pointer.x * 3).toFixed(3)}deg`)
      tilt.style.setProperty('--rx', `${(-pointer.y * 2).toFixed(3)}deg`)
      glass.style.setProperty('--gs', `${(side * 6 * swing - pointer.x * 4).toFixed(2)}%`)
      if (dust) drawDust(t)
    }

    /* --------------------------------------------------------------- sizing */
    function fit() {
      const vw = sec.clientWidth
      const pr = pin.getBoundingClientRect()
      let pw
      if (stacked()) {
        const top = copy.getBoundingClientRect().bottom - pr.top
        const capH = cap.offsetHeight
        pw = clamp((pr.height - top - capH - 18 - 14) / 2.078, 150, vw < 760 ? 250 : 330)
      } else {
        const cs = getComputedStyle(stage)
        const h = stage.clientHeight - parseFloat(cs.paddingBottom) - 52
        const colW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - copy.offsetWidth - parseFloat(cs.columnGap)
        pw = Math.min(440, h / 2.078, colW * 0.8)
      }
      pw = Math.floor(pw)
      geo.pw = pw
      geo.z = (pw * 0.926) / 390
      sec.style.setProperty('--pw', `${pw}px`)
      app.style.setProperty('--z', geo.z.toFixed(5))
      measureTargets(view, geo.z)
      // the note beside the phone only shows when it has room before the edge
      rig.style.left = '0px'
      note.style.display = ''
      if (!stacked()) {
        const rr = rig.getBoundingClientRect()
        const cr = copy.getBoundingClientRect().right
        const need = rr.right + 24 + 184 - (sec.clientWidth - 20)
        const room = rr.left - (cr + 40)
        if (need > 0 && need <= room) rig.style.left = `${-Math.ceil(need)}px`
        else if (need > 0) note.style.display = 'none'
      }
      placeLight()
      lastOpen = -1
      const { from, to, f, pr: p } = current
      draw(from, to, f, p)
    }

    let beamGeo = null
    function placeLight() {
      const P = pin.getBoundingClientRect()
      const R = rig.getBoundingClientRect()
      const pw = geo.pw
      const rx = R.left - P.left
      const ry = R.top - P.top
      const phone = stacked()
      if (phone) {
        const a = ry - pw * 0.15, b = ry + pw * 0.2, c = ry + R.height - pw * 0.1, d = ry + R.height + pw * 0.06
        light.style.setProperty('--lmask', `linear-gradient(180deg,transparent ${a}px,#000 ${b}px,#000 ${c}px,transparent ${d}px)`)
      } else {
        const cr = copy.getBoundingClientRect().right - P.left
        const bar = sec.querySelector('.pss-bar').getBoundingClientRect().bottom - P.top
        const left = `linear-gradient(90deg,transparent ${cr + 12}px,#000 ${cr + 12 + pw * 0.45}px)`
        const top = `linear-gradient(180deg,transparent ${bar}px,#000 ${bar + pw * 0.3}px)`
        light.style.setProperty('--lmask', data.light === 'beam'
          ? `${left},${top},radial-gradient(${(pw * 2.6).toFixed(0)}px ${(R.height * 0.85).toFixed(0)}px at ${(rx + pw * 1.1).toFixed(0)}px ${(ry + R.height * 0.42).toFixed(0)}px,#000 55%,transparent 100%)`
          : `${left},${top}`)
      }
      if (cast) {
        const fromRight = data.light === 'beam'
        cast.style.setProperty('--cx', `${rx + pw * (fromRight ? -0.16 : 0.2)}px`)
        cast.style.setProperty('--cy', `${ry + pw * 0.12}px`)
        cast.style.setProperty('--csk', fromRight ? '9deg' : '-10deg')
      }
      if (gobo) {
        const gw = pw * 2.05, gh = pw * 2.8
        gobo.style.setProperty('--gw', `${gw}px`)
        gobo.style.setProperty('--gh', `${gh}px`)
        gobo.style.setProperty('--mull', `${pw * 0.075}px`)
        gobo.style.setProperty('--gb', `${Math.max(2, pw * 0.009)}px`)
        gobo.style.setProperty('--gx', `${rx + pw / 2 - gw / 2 - pw * 0.18}px`)
        gobo.style.setProperty('--gy', `${ry + R.height / 2 - gh / 2 - pw * 0.22}px`)
      }
      if (beam) {
        // off-frame, up and to the right: the beam enters under the bar
        const sx = P.width * 1.25, sy = phone ? -P.height * 0.12 : -P.height * 0.05
        const tx = rx + pw * 0.3, ty = ry + R.height * 0.55
        const dist = Math.hypot(tx - sx, ty - sy)
        const L = dist * 1.5, H = L * 0.6
        const ang = Math.atan2(ty - sy, tx - sx)
        beam.style.width = `${L}px`
        beam.style.height = `${H}px`
        beam.style.transform = `translate(${sx}px,${sy - H / 2}px) rotate(${ang}rad)`
        beamGeo = { sx, sy, L, H, ang, w: P.width, h: P.height }
        const dpr = Math.min(2, devicePixelRatio || 1)
        dust.width = Math.round(P.width * dpr)
        dust.height = Math.round(P.height * dpr)
        dust.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
        glass.style.setProperty('--streak-a', `${(ang * 180) / Math.PI + 90}deg`)
      }
    }

    // dust motes: seeded, drifting slowly inside the beam, a pure function of t
    const motes = []
    {
      let s = 1234567
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      for (let i = 0; i < 170; i++) motes.push([0.12 + rnd() * 0.7, rnd() * 2 - 1, 0.5 + rnd() * 1.4, rnd() * 6.283, rnd() * 6.283, 0.3 + rnd() * 0.7])
    }
    const motesColor = getComputedStyle(sec).getPropertyValue('--beam').replace(/[\d.]+\)$/, '')
    function drawDust(t) {
      if (!beamGeo) return
      const g = dust.getContext('2d')
      const { sx, sy, L, H, ang, w, h } = beamGeo
      g.clearRect(0, 0, w, h)
      const ca = Math.cos(ang), sa = Math.sin(ang)
      for (const [a0, b0, r, p1, p2, sp] of motes) {
        const a = a0 + 0.012 * Math.sin(t * 0.21 * sp + p1)
        const half = (0.02 + 0.3 * a) * H * 0.62
        const b = b0 * 0.85 + 0.06 * Math.sin(t * 0.37 * sp + p2)
        const x = sx + ca * a * L - sa * b * half
        const y = sy + sa * a * L + ca * b * half
        const fall = Math.min(1, a / 0.25) * (1 - clamp((a - 0.55) / 0.3)) * (1 - b * b)
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.1 * sp + p1 * 3))
        const alpha = 0.55 * fall * tw
        if (alpha < 0.02) continue
        g.fillStyle = `${motesColor}${alpha.toFixed(3)})`
        g.beginPath()
        g.arc(x, y, r, 0, 6.283)
        g.fill()
      }
    }

    /* --------------------------------------------------------------- clocks */
    function timeline(t) {
      const L = n * per
      const tt = ((t % L) + L) % L
      const seg = Math.floor(tt / per)
      const lt = tt - seg * per
      if (lt < hold) return [seg, seg, 0, lt / hold]
      return [seg, (seg + 1) % n, (lt - hold) / BOUNDARY, 1]
    }
    function scrollTarget() {
      const range = sec.offsetHeight - pin.offsetHeight
      const top = sec.getBoundingClientRect().top
      let P = clamp(-top / Math.max(1, range)) * (n - 1)
      if (P - Math.floor(P) > 0.992) P = Math.ceil(P)
      const k = Math.min(n - 1, Math.floor(P))
      const frac = k === n - 1 ? 1 : P - k
      return { u: k + (k === n - 1 ? 0 : clamp((frac - 0.4) / 0.6)), k, frac }
    }
    function goTo(i) {
      i = clamp(i, 0, n - 1)
      if (rm) return draw(i, i, 0, 1)
      if (sec.dataset.play === 'scroll') {
        const range = sec.offsetHeight - pin.offsetHeight
        const top = sec.getBoundingClientRect().top + scrollY
        const y = top + (i / (n - 1)) * range + (i === n - 1 ? 0 : range / (n - 1) * 0.04)
        scrollTo({ top: y, behavior: 'smooth' })
      } else clockT = i * per
    }

    let clockT = 0
    let lastNow = 0
    let u = 0
    let paused = false
    let inView = true
    let lastScroll = performance.now()
    function frame(now) {
      const dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0
      lastNow = now
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 8)
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 8)
      if (sec.dataset.play === 'timed') {
        if (!paused && inView && !document.hidden) clockT += dt
        const [a, b, f, p] = timeline(clockT)
        draw(a, b, f, p, now / 1000)
      } else {
        const tg = scrollTarget()
        const diff = tg.u - u
        u = Math.abs(diff) < 0.0008 ? tg.u : u + diff * Math.min(1, dt * 9)
        const from = Math.min(n - 1, Math.floor(u + 1e-6))
        const f = from === n - 1 ? 0 : u - from
        const pr = from === tg.k ? tg.frac : from < tg.k ? 1 : 0
        // a hint: while the page rests at the top, the ring breathes on the first tap
        const idle = (now - lastScroll) / 1000
        const hint = f === 0 && idle > 2.2 ? Math.max(0, Math.sin(((idle - 2.2) / 2.6) * Math.PI)) * 0.85 : 0
        draw(from, Math.min(n - 1, from + 1), f, pr, now / 1000, hint)
      }
      requestAnimationFrame(frame)
    }

    /* ----------------------------------------------------- reduced motion stack */
    function buildStack() {
      const stack = $('.pss-stack')
      stack.textContent = ''
      for (let i = 0; i < n; i++) {
        const item = document.createElement('div')
        item.className = 'item'
        const r = rig.cloneNode(true)
        r.removeAttribute('id')
        r.querySelector('.pss-note')?.remove()
        r.style.setProperty('--pw', '220px')
        const a = r.querySelector('.pss-app')
        a.style.setProperty('--z', ((220 * 0.926) / 390).toFixed(5))
        const v = makeView(a)
        const { st } = layout(i, i, 0)
        paint(v, st, 0, -1)
        v.ring.style.opacity = '0'
        item.appendChild(r)
        const c = caps[i].cloneNode(true)
        c.removeAttribute('aria-hidden')
        c.className = 'cap'
        c.style.removeProperty('--w')
        item.appendChild(c)
        stack.appendChild(item)
      }
      stack.removeAttribute('aria-hidden')
    }

    /* --------------------------------------------------------------- events */
    lis.forEach((li, i) => li.querySelector('.pss-chb').addEventListener('click', () => goTo(i)))
    segs.forEach((b, i) => b.addEventListener('click', () => goTo(i)))
    const openNow = () => lis.findIndex((li) => li.classList.contains('on'))
    $('.pss-chap')?.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return
      ev.preventDefault()
      const i = clamp(openNow() + (ev.key === 'ArrowDown' ? 1 : -1), 0, n - 1)
      goTo(i)
      lis[i].querySelector('.pss-chb').focus({ preventScroll: true })
    })
    let sx0 = null
    rig.style.touchAction = 'pan-y'
    rig.addEventListener('pointerdown', (ev) => (sx0 = ev.clientX))
    rig.addEventListener('pointerup', (ev) => {
      if (sx0 === null) return
      const dx = ev.clientX - sx0
      sx0 = null
      if (Math.abs(dx) > 40) goTo(openNow() + (dx < 0 ? 1 : -1))
    })
    if (!rm && !record) {
      pin.addEventListener('pointermove', (ev) => {
        if (ev.pointerType !== 'mouse') return
        const r = rig.getBoundingClientRect()
        pointer.tx = clamp((ev.clientX - (r.left + r.width / 2)) / (innerWidth / 2), -1, 1)
        pointer.ty = clamp((ev.clientY - (r.top + r.height / 2)) / (innerHeight / 2), -1, 1)
      })
      pin.addEventListener('pointerleave', () => (pointer.tx = pointer.ty = 0))
      pin.addEventListener('mouseenter', () => (paused = true))
      pin.addEventListener('mouseleave', () => (paused = false))
      pin.addEventListener('focusin', () => (paused = true))
      pin.addEventListener('focusout', () => (paused = false))
      addEventListener('scroll', () => (lastScroll = performance.now()), { passive: true })
      new IntersectionObserver(([en]) => (inView = en.isIntersecting)).observe(sec)
    }
    let rt = 0
    addEventListener('resize', () => {
      cancelAnimationFrame(rt)
      rt = requestAnimationFrame(() => {
        fit()
        if (rm && stacked()) buildStack()
      })
    })

    fit()
    const ready = (document.fonts?.ready ?? Promise.resolve()).then(() => {
      fit()
      if (rm && stacked()) buildStack()
      sec.dataset.ready = '1'
    })
    if (record) {
      const L = n * per
      window.PSS = {
        ready,
        length: L,
        steps: n,
        // the poster: step 1, the fingertip down and the thing pressed, the screen still
        rest: hold + BOUNDARY * 0.245,
        stepAt: (i) => i * per + hold * 0.5,
        tapAt: (i) => i * per + hold + BOUNDARY * 0.22,
        seek(t) {
          const [a, b, f, p] = timeline(t)
          draw(a, b, f, p, t)
          return { from: a, to: b, f }
        },
        state: () => ({ ...current }),
        // the stretches where nothing on the phone is moving, with a margin
        // after the last change ends and before the next tap starts:
        // rest = the step alone; tap = the fingertip down, the thing pressed,
        // the screen itself still (the change starts after it)
        moments(margin = 0.3) {
          const out = []
          for (let i = 0; i < n; i++) {
            out.push(['rest', i, +(i * per + margin).toFixed(3), +(i * per + hold - margin).toFixed(3)])
            if (i < n - 1) out.push(['tap', i, +(i * per + hold + BOUNDARY * 0.19).toFixed(3), +(i * per + hold + BOUNDARY * 0.3).toFixed(3)])
          }
          return out
        },
        // what is on the phone right now, read from the page itself: every
        // visible screen, where it sits and how see-through it is
        settled() {
          const shown = view.S.map((el, i) => ({ el, i })).filter(({ el }) => getComputedStyle(el).visibility === 'visible')
          const bad = []
          const full = shown.filter(({ el }) => !el.classList.contains('sheet'))
          const sheets = shown.filter(({ el }) => el.classList.contains('sheet'))
          for (const { el, i } of shown) {
            const m = new DOMMatrix(getComputedStyle(el).transform)
            if (Math.abs(m.e) > 0.01) bad.push(`screen ${i + 1} is ${m.e.toFixed(1)}px off sideways`)
            if (Number(getComputedStyle(el).opacity) < 0.999) bad.push(`screen ${i + 1} is half faded`)
            const pnl = el.querySelector('.pss-sheetp')
            if (pnl && Math.abs(new DOMMatrix(getComputedStyle(pnl).transform).f) > 0.01) bad.push(`the sheet on screen ${i + 1} is still rising`)
          }
          if (sheets.length > 1) bad.push(`${sheets.length} sheets are showing`)
          // two screens on show is only right for a resting sheet over the screen it opened from
          if (full.length !== 1) bad.push(`${full.length} full screens are showing`)
          else if (sheets.length === 1 && (sheets[0].i !== full[0].i + 1 || data.via[sheets[0].i] !== 'sheet')) bad.push('a sheet is showing over a screen it did not open from')
          else if (sheets.length === 1) {
            const m = new DOMMatrix(getComputedStyle(full[0].el).transform)
            if (Math.abs(m.a - 0.94) > 0.001) bad.push('the screen behind the sheet is still scaling')
          } else {
            const m = new DOMMatrix(getComputedStyle(full[0].el).transform)
            if (Math.abs(m.a - 1) > 0.001 || Math.abs(m.f) > 0.01) bad.push('the screen is still moving')
          }
          return { ok: !bad.length, shown: shown.map(({ i }) => i + 1), bad }
        },
      }
    } else if (rm) {
      draw(0, 0, 0, 1)
      window.PSS = { ready, goTo, state: () => ({ ...current }) }
    } else {
      window.PSS = { ready, goTo, state: () => ({ ...current }), seekTimed: (t) => { const [a, b, f, p] = timeline(t); draw(a, b, f, p, t) } }
      requestAnimationFrame(frame)
    }
  }
  document.querySelectorAll('.pss').forEach(init)
})()
