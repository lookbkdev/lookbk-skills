// Motion Heroes kit v2: the browser runtime. The build inlines this file into
// the page, followed by the effect, and calls MotionHeroRun(effect, id).
//
// It owns everything that isn't the picture itself:
// - the clock. The effect is drawn as a pure function of time, seek(t), so
//   the same t always gives the same frame and a recording can step it.
// - pausing when the hero is off-screen or the tab is hidden,
// - the device pixel ratio (capped at 2, lowered on slow machines),
// - prefers-reduced-motion: one still frame, no loop,
// - the fallback: a still picture (SVG) shows until the first frame is
//   drawn, and stays if WebGL, the CDN or the effect fails. Never a blank hero.
// - the layout's measurements for the effect: its field (view.stage), the
//   bar, the plates and the headline's lines (view.type), so it can set the
//   headline in the scene, light it (ctx.light) or pass in front of it (ctx.front),
// - fitting the headline to the width (the type-effect composition),
// - the pointer, smoothed, or on a slow made-up path when recording,
// - an effect's story (cfg.story): the scene played as 0–1 progress, by the
//   clock (drive "time") or by the visitor scrolling through the section,
//   pinned for a few screen heights (drive "scroll"; a recording scrolls
//   the page itself on a scripted path, so it is the same on every machine),
// - window.MotionHero, which scripts/record.mjs drives frame by frame.
function MotionHeroRun(effect, id) {
  const root = document.getElementById(id)
  if (!root) return
  const cfg = JSON.parse(document.getElementById(id + '-config').textContent)
  const recording = /[?&]mh-record\b/.test(location.search)
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = reducedQuery.matches && !recording
  const canvas = root.querySelector('.mh-canvas')
  const front = root.querySelector('.mh-front')
  const bar = root.querySelector('.mh-bar')
  const field = root.querySelector('.mh-field')
  const title = root.querySelector('.mh-title')
  const comp = cfg.composition
  const steps = [...root.querySelectorAll('.mh-step')]
  const story = cfg.story || null
  const speed = cfg.motion.speed
  const MAX_DPR = 2
  let dprCap = MAX_DPR
  let view = null
  let started = false
  let failed = false
  let raf = 0
  let last = null
  let time = 0 // real seconds the hero has been on screen
  let inView = true
  const pointer = { x: 0, y: 0 }
  const smooth = { x: 0, y: 0 }
  let slow = 0
  let frames = 0
  let resolveReady
  // the story, when the effect has one: progress 0–1 (sp smoothed toward target)
  let pin = null
  let target = 0
  let sp = 0
  const ready = new Promise((r) => (resolveReady = r))

  root.classList.add('mh-live')
  if (recording) root.classList.add('mh-record')

  const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3)
  // The pointer path used in recordings: a slow figure, starting at rest.
  const path = (t) => {
    const k = ease(t / 1.8)
    return { x: (Math.sin(t * 0.7) * 0.55 + 0.18) * k, y: Math.sin(t * 1.13 + 0.6) * 0.38 * k }
  }

  const rel = (r, o) => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height })
  /** The headline's lines, as laid out: boxes, baselines and the font, in hero pixels. */
  function measureType(o) {
    // a turned headline (data-rot) is measured upright about its centre; view.type.rotate says how to turn it back
    const rot = root.dataset.rot === '1'
    const keep = title.style.transform
    if (rot) title.style.transform = 'translate(-50%, -50%)'
    const t = measureLines(o)
    if (rot) {
      title.style.transform = keep
      t.rotate = -Math.PI / 2
      t.center = { x: t.box.x + t.box.w / 2, y: t.box.y + t.box.h / 2 }
      const w = t.box.w
      t.box = { x: t.center.x - t.box.h / 2, y: t.center.y - w / 2, w: t.box.h, h: w }
    }
    return t
  }
  function measureLines(o) {
    const cs = getComputedStyle(title)
    const size = parseFloat(cs.fontSize)
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0
    // each word where the browser set it; words on the same baseline make a line
    const g = document.createElement('canvas').getContext('2d')
    g.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`
    const m = g.measureText('Hg')
    const fa = m.fontBoundingBoxAscent ?? size * 0.9
    const fd = m.fontBoundingBoxDescent ?? size * 0.25
    const words = [...title.querySelectorAll('.mh-part')].map((p) => {
      const r = document.createRange()
      r.selectNodeContents(p)
      const b = r.getBoundingClientRect()
      return { text: p.textContent, x: b.left - o.left, y: b.top - o.top, w: b.width, h: b.height, baseline: b.top - o.top + (b.height * fa) / (fa + fd), italic: getComputedStyle(p).fontStyle !== 'normal' }
    })
    const lines = []
    for (const wd of words) {
      let line = lines.find((l) => Math.abs(l.baseline - wd.baseline) < size * 0.3)
      if (!line) lines.push((line = { parts: [], baseline: wd.baseline }))
      line.parts.push({ text: wd.text, x: wd.x, w: wd.w, italic: wd.italic, y: wd.y, h: wd.h })
    }
    for (const l of lines) {
      l.parts.sort((a, b) => a.x - b.x)
      l.x = Math.min(...l.parts.map((p) => p.x))
      l.w = Math.max(...l.parts.map((p) => p.x + p.w)) - l.x
      l.y = Math.min(...l.parts.map((p) => p.y))
      l.h = Math.max(...l.parts.map((p) => p.y + p.h)) - l.y
      l.text = l.parts.map((p) => p.text).join(' ')
    }
    lines.sort((a, b) => a.baseline - b.baseline)
    const font = (italic) => `${italic ? 'italic ' : ''}${cs.fontWeight} ${size}px ${cs.fontFamily}`
    return { lines, size, letterSpacing: ls, family: cs.fontFamily, weight: cs.fontWeight, font, box: rel(title.getBoundingClientRect(), o), align: cs.textAlign, rotate: 0, center: null }
  }
  // the letters' real ink box (cap top to descender), as shares of the font size
  function glyphMetrics(cs, lines) {
    const g = document.createElement('canvas').getContext('2d')
    g.font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`
    let asc = 0
    let desc = 0
    let fa = 0
    let fd = 0
    for (const t of lines) {
      const m = g.measureText(t)
      asc = Math.max(asc, m.actualBoundingBoxAscent / 100)
      desc = Math.max(desc, m.actualBoundingBoxDescent / 100)
      fa = Math.max(fa, (m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent) / 100)
      fd = Math.max(fd, (m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent) / 100)
    }
    return { asc, desc, fa, fd }
  }
  // type-effect: each line of the headline fitted to the width (never under
  // 7.2% of the height), its line box trimmed to the capitals so the 40px
  // under the bar is measured from the tops of the letters. On a portrait
  // screen the word turns to run up the screen (data-rot), which sets it far
  // larger than across a phone's width. lockup: the headline fitted to 85% of
  // the width, at most 20% of the height.
  function fit() {
    if (comp !== 'type-effect' && comp !== 'lockup') return
    root.style.removeProperty('--mh-fit')
    root.style.removeProperty('--mh-band')
    delete root.dataset.rot
    root.removeAttribute('data-clip-ok')
    title.style.lineHeight = ''
    title.style.margin = ''
    title.style.fontSize = '100px'
    let widest = 1
    const texts = []
    for (const line of title.querySelectorAll('.mh-line')) {
      const r = document.createRange()
      r.selectNodeContents(line)
      widest = Math.max(widest, r.getBoundingClientRect().width)
      texts.push(line.textContent)
    }
    title.style.fontSize = ''
    const cs = getComputedStyle(title)
    const W = root.clientWidth
    const H = root.clientHeight
    const vh = innerHeight
    const n = texts.length
    const copy = root.querySelector('.mh-copy')
    const copyH = copy ? copy.offsetHeight : 0
    const barH = bar.offsetHeight
    if (comp === 'lockup') {
      if (W < 760) {
        // phones: the lines wrap; the longest word is fitted to 92% of the width
        title.style.fontSize = '100px'
        let word = 1
        for (const p of title.querySelectorAll('.mh-part')) {
          const r = document.createRange()
          r.selectNodeContents(p)
          word = Math.max(word, r.getBoundingClientRect().width)
        }
        title.style.fontSize = ''
        const size = Math.max(0.072 * vh, Math.min((100 * W * 0.92) / word, 0.24 * vh))
        root.style.setProperty('--mh-fit', size.toFixed(2) + 'px')
        return
      }
      const room = (H - barH - copyH - 2 * 40 - 36) / (n * 0.86)
      const size = Math.max(0.072 * vh, Math.min((100 * W * 0.8) / widest, 0.25 * vh, room))
      root.style.setProperty('--mh-fit', size.toFixed(2) + 'px')
      return
    }
    const { asc, desc, fa, fd } = glyphMetrics(cs, texts)
    const lh = (asc + desc) * 1.04
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    const across = (100 * (W - pad)) / widest
    // portrait: the word runs up the screen, in a band a screen tall (the copy follows below)
    if (W / vh < 0.8) {
      const band = vh - barH - 2 * 40
      const along = (100 * (band - 8)) / widest
      const thick = (W - 32) / (n * lh)
      const up = Math.min(along, thick)
      if (up > across * 1.15) {
        root.dataset.rot = '1'
        // the turned word's glyphs may reach past the sides of its line box: the section clips them, on purpose
        root.setAttribute('data-clip-ok', '')
        root.style.setProperty('--mh-band', band.toFixed(0) + 'px')
        root.style.setProperty('--mh-fit', Math.max(0.072 * vh, up).toFixed(2) + 'px')
        title.style.lineHeight = lh.toFixed(4)
        return
      }
    }
    const room = (H - barH - copyH - 2 * 40 - 8) / (n * lh)
    const size = Math.max(0.072 * vh, Math.min(across, room))
    // where the capitals start inside the trimmed line box
    const shift = ((fa - fd - asc + desc) / 2 - (lh - asc - desc) / 2) * size
    root.style.setProperty('--mh-fit', size.toFixed(2) + 'px')
    title.style.lineHeight = lh.toFixed(4)
    title.style.margin = `${(-shift).toFixed(1)}px 0 ${shift.toFixed(1)}px`
  }
  /** The layout, measured: the effect's field (the stage), the bar, the plates and the headline. */
  function measure() {
    fit()
    const o = root.getBoundingClientRect()
    const W = root.clientWidth
    const H = root.clientHeight
    const stage = rel(field.getBoundingClientRect(), o)
    const plates = [...root.querySelectorAll('.mh-plate')].filter((p) => p.offsetWidth).map((p) => rel(p.getBoundingClientRect(), o))
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
    const mobile = W < 760
    return { width: W, height: H, dpr, stage, mobile, stacked: mobile, composition: comp, typeMode: cfg.typeMode, bar: rel(bar.getBoundingClientRect(), o), plates, type: measureType(o) }
  }

  // ctx.light(x, y, r): where the effect's light falls (hero pixels), so the
  // headline (typeMode "lit") brightens there too; ctx.light(null) turns it off.
  function light(x, y, r) {
    if (x === null || x === undefined || !view) {
      title.style.setProperty('--mh-lr', '1px')
      title.style.setProperty('--mh-lx', '-9999px')
      return
    }
    const b = view.type.box
    title.style.setProperty('--mh-lx', (x - b.x).toFixed(1) + 'px')
    title.style.setProperty('--mh-ly', (y - b.y).toFixed(1) + 'px')
    title.style.setProperty('--mh-lr', Math.max(1, r).toFixed(1) + 'px')
  }

  /* ---- the story ---- */
  const clamp01 = (x) => Math.min(Math.max(x, 0), 1)
  const smoothstep = (x) => ((x = clamp01(x)), x * x * (3 - 2 * x))
  // The scripted scroll of a recording (and the reduced-motion still of a
  // scroll story): rest for `lead`, glide through the story, rest. Real
  // seconds in, progress out. The effect may give its own: script(seconds, story).
  function script(seconds) {
    if (effect.script) {
      try {
        return clamp01(Number(effect.script(seconds, story)) || 0)
      } catch (e) {
        console.warn('[motion hero] script():', e)
      }
    }
    return smoothstep((seconds * speed - story.lead) / story.length)
  }
  // drive "time": the clock (scene seconds) → progress, looping after `hold`
  function timed(seconds) {
    let c = seconds * speed
    if (story.loop) {
      const period = story.lead + story.length + story.hold
      c = ((c % period) + period) % period
    }
    return clamp01((c - story.lead) / story.length)
  }
  // drive "scroll": wrap the section in a box `pin` screen heights taller
  // and make it sticky, so it holds still while the page scrolls past.
  function setupPin() {
    const wrap = document.createElement('div')
    wrap.className = 'mh-pin'
    wrap.style.position = 'relative'
    root.parentNode.insertBefore(wrap, root)
    wrap.appendChild(root)
    root.style.position = 'sticky'
    const p = {
      wrap,
      layout() {
        const vh = innerHeight
        const rh = root.offsetHeight
        root.style.top = Math.min(0, vh - rh) + 'px'
        wrap.style.height = Math.round(rh + story.pin * vh) + 'px'
        p.read()
      },
      // scroll position → progress (exact: no smoothing here)
      read() {
        const vh = innerHeight
        const pre = Math.max(0, root.offsetHeight - vh)
        target = clamp01((-wrap.getBoundingClientRect().top - pre) / (story.pin * vh))
        return target
      },
      // the page scroll at which progress is `k`
      scrollFor(k) {
        const vh = innerHeight
        const pre = Math.max(0, root.offsetHeight - vh)
        return wrap.getBoundingClientRect().top + scrollY + pre + k * story.pin * vh
      },
    }
    addEventListener('scroll', () => p.read(), { passive: true })
    addEventListener('resize', () => p.layout())
    p.layout()
    return p
  }
  /** The progress of the frame on screen (0 without a story). */
  function progressNow() {
    if (!story) return 0
    return reduced ? progressAt(cfg.stillTime, true) : progressAt(time)
  }
  /** Progress 0–1 for the frame at real seconds t. */
  function progressAt(t, still) {
    if (story.drive === 'scroll') return pin && !still ? sp : script(t)
    return still ? clamp01((t * speed - story.lead) / story.length) : timed(t)
  }

  // Places the still picture's object: where the effect says (its optional
  // place(view, params), which must not need init), or the stage's middle.
  function place(v) {
    const s = v.stage
    let at = { x: s.x + s.w / 2, y: s.y + s.h / 2, size: Math.min(s.w, s.h) * (cfg.stillScale || 0.8) }
    try {
      if (effect.place) at = effect.place(v, cfg.params) || at
    } catch (e) {
      console.warn('[motion hero] place():', e)
    }
    root.style.setProperty('--mh-sx', at.x + 'px')
    root.style.setProperty('--mh-sy', at.y + 'px')
    root.style.setProperty('--mh-ss', at.size + 'px')
  }

  function fail(err) {
    if (failed) return
    failed = true
    cancelAnimationFrame(raf)
    root.classList.remove('mh-ready')
    root.classList.add('mh-fallback')
    const reason = String((err && err.message) || err)
    console.warn('[motion hero] showing the still picture:', reason)
    resolveReady({ ok: false, reason })
  }

  function draw(t, still) {
    try {
      const state = { pointer: still ? { x: 0, y: 0 } : smooth, time: t, still: !!still }
      if (!story) effect.seek(t * speed, state)
      else {
        // with a story, seek gets story time: progress × length
        state.progress = progressAt(t, still)
        state.drive = story.drive
        root.style.setProperty('--mh-p', state.progress.toFixed(3))
        effect.seek(state.progress * story.length, state)
      }
      if (steps.length) {
        const k = Math.min(steps.length - 1, Math.floor((state.progress || 0) * steps.length * 0.999 + (still ? 0 : 0)))
        steps.forEach((li, i) => li.classList.toggle('mh-on', i === k))
      }
      if (!root.classList.contains('mh-ready')) root.classList.add('mh-ready')
    } catch (e) {
      fail(e)
    }
  }

  function resize() {
    if (pin) pin.layout()
    if (!started || failed) {
      place(measure())
      return
    }
    view = measure()
    place(view)
    try {
      effect.resize(view)
    } catch (e) {
      return fail(e)
    }
    if (reduced) draw(cfg.stillTime, true)
    else if (!raf && !recording) draw(time)
  }

  function tick(now) {
    raf = 0
    if (failed || reduced || recording) return
    if (!inView || document.hidden) {
      last = null
      return // the observers start it again
    }
    raf = requestAnimationFrame(tick)
    const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1)
    last = now
    time += dt
    const k = 1 - Math.exp(-dt * 5)
    const aim = cfg.motion.pointer ? pointer : { x: 0, y: 0 }
    smooth.x += (aim.x - smooth.x) * k
    smooth.y += (aim.y - smooth.y) * k
    if (pin) {
      sp += (target - sp) * (1 - Math.exp(-dt * 9))
      if (Math.abs(target - sp) < 0.0005) sp = target
    }
    draw(time)
    // Slow machine: draw fewer pixels rather than drop frames.
    if (dt > 0) {
      frames++
      if (dt > 1 / 40) slow++
      if (frames >= 60) {
        if (slow > 30 && dprCap > 1) {
          dprCap = Math.max(1, dprCap - 0.5)
          resize()
        }
        frames = 0
        slow = 0
      }
    }
  }
  const run = () => {
    if (!raf && started && !failed && !reduced && !recording) raf = requestAnimationFrame(tick)
  }

  function hasWebGL() {
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      if (!gl) return false
      const lose = gl.getExtension('WEBGL_lose_context')
      if (lose) lose.loseContext()
      return true
    } catch {
      return false
    }
  }

  async function start() {
    // the headline is measured (and fitted) with its real font
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))])
    view = measure()
    place(view)
    if (cfg.needs === 'webgl' && !hasWebGL()) return fail(new Error('WebGL is not available'))
    const ctx = {
      root,
      canvas,
      front,
      composition: comp,
      typeMode: cfg.typeMode,
      light,
      /** A file the effect ships (effect.mjs assets), as a URL next to the page. */
      asset: (name) => {
        if (!cfg.assets || !cfg.assets[name]) throw new Error('unknown asset ' + name)
        return new URL(cfg.assets[name], document.baseURI).href
      },
      params: cfg.params,
      theme: cfg.theme,
      recording,
      reduced,
      view,
      load: (name) => {
        if (cfg.libs[name]) return import(cfg.libs[name])
        // three.js add-ons through the import map (declared in effect.mjs addons, so they carry SRI)
        if (cfg.three && name.startsWith('three/addons/')) {
          if (!cfg.three.addons.includes(name.slice(13))) throw new Error(name + ' is not in the effect\'s addons')
          return import(name)
        }
        throw new Error('unknown library ' + name)
      },
      // An effect's own controls (a finish picker, say) call this so a
      // reduced-motion page still redraws when they're used.
      redraw: () => {
        if (reduced) draw(cfg.stillTime, true)
      },
      now: () => (reduced ? cfg.stillTime : time) * speed,
      story,
      /** The story's progress now (0–1); 0 without a story. */
      progress: () => progressNow(),
    }
    let timer
    const timeout = new Promise((_, no) => {
      timer = setTimeout(() => no(new Error('the effect took too long to load')), recording ? 45000 : 12000)
    })
    try {
      await Promise.race([effect.init(ctx), timeout])
    } catch (e) {
      return fail(e)
    } finally {
      clearTimeout(timer)
    }
    started = true
    view = measure()
    place(view)
    try {
      effect.resize(view)
    } catch (e) {
      return fail(e)
    }
    if (reduced) draw(cfg.stillTime, true)
    else draw(recording ? 0 : time)
    if (!failed) resolveReady({ ok: true })
    run()
  }

  // pin first, before the copy's intro starts; not in reduced motion (the page scrolls normally)
  if (story && story.drive === 'scroll' && !reduced) pin = setupPin()

  addEventListener('pointermove', (e) => {
    if (recording) return
    const r = root.getBoundingClientRect()
    pointer.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
    pointer.y = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)))
  })
  new ResizeObserver(() => resize()).observe(root)
  if ('IntersectionObserver' in window)
    new IntersectionObserver((es) => {
      inView = es[es.length - 1].isIntersecting
      run()
    }).observe(root)
  document.addEventListener('visibilitychange', run)
  reducedQuery.addEventListener?.('change', (e) => {
    reduced = e.matches && !recording
    if (reduced) {
      cancelAnimationFrame(raf)
      raf = 0
      if (started && !failed) draw(cfg.stillTime, true)
    } else run()
  })

  // Driven by scripts/record.mjs: seek(seconds) draws that moment of the
  // intro and the effect, and resolves once it is on screen.
  const api = {
    ready,
    posterTime: cfg.posterTime,
    stillTime: cfg.stillTime,
    /** The effect's story ({ drive, pin, length, lead, hold, loop }) or null. */
    story,
    /** Real seconds until a recording reaches the end of the story (lead + length, at motion.speed). */
    storySeconds: story ? (story.lead + story.length) / speed : 0,
    /** The story's progress (0–1) in the last frame drawn by seek, or the live one. */
    progress: () => progressNow(),
    /** Seconds the hero has run (it doesn't advance off-screen or in a hidden tab). */
    time: () => time,
    state: () => (failed ? 'fallback' : !started ? 'loading' : reduced ? 'still' : recording ? 'recording' : raf ? 'running' : 'paused'),
    async seek(seconds) {
      if (failed) return Promise.reject(new Error('the effect failed; the still picture is showing'))
      // an effect that shows footage seeks it first (effect.prepare), so the frame is exact
      if (effect.prepare) {
        const st = story ? (story.drive === 'scroll' ? script(seconds) : timed(seconds)) * story.length : seconds * speed
        try {
          await effect.prepare(st)
        } catch (e) {
          fail(e)
          throw e
        }
      }
      for (const a of root.getAnimations({ subtree: true })) {
        a.pause()
        a.currentTime = seconds * 1000
      }
      const p = cfg.motion.pointer ? path(seconds) : { x: 0, y: 0 }
      smooth.x = p.x
      smooth.y = p.y
      if (pin) {
        // scroll the page itself along the script, then read progress back from it
        scrollTo(0, pin.scrollFor(script(seconds)))
        sp = pin.read()
      }
      time = seconds
      draw(seconds)
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))
    },
  }
  window.MotionHeroes = Object.assign(window.MotionHeroes || {}, { [id]: api })
  window.MotionHero = api
  start()
}
