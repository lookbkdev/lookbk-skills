// Pricing Kit: the section's motion. Every frame is a pure function of the
// time and of what the visitor changed (billing period, the comparison, the
// slider, the open questions), each change stamped with the moment it
// happened. So the live page and the recorder (?pk-record=1, which steps
// time itself through PricingKit.seek) draw exactly the same frames.
//
// Motion only where money changes: digits roll in their columns, each plan's
// dot slides along the price scale and the hatched saving trails it, the
// arithmetic line retypes, the comparison opens out of the cards, the slider
// re-lights the cheapest plan. With reduced motion every change is instant.
;(() => {
  for (const root of document.querySelectorAll('.pk:not([data-pk-on])')) start(root)

  function start(root) {
    root.setAttribute('data-pk-on', '')
    const D = JSON.parse(root.querySelector('.pk-data').textContent)
    const recording = /[?&]pk-record=1/.test(location.search)
    const reduced = !recording && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || recording) root.classList.add('pk-still')
    const shell = root.parentElement
    const $ = (s, r = root) => r.querySelector(s)
    const $$ = (s, r = root) => [...r.querySelectorAll(s)]
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
    const lerp = (a, b, k) => a + (b - a) * k
    const R = reduced ? 0 : 1 // durations collapse to 0 with reduced motion
    let clock = 0
    const now = () => (recording ? clock : performance.now() / 1000)
    const NEVER = -1e9

    // cubic-bezier easing
    const bezier = (x1, y1, x2, y2) => (x) => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      let t = x
      for (let i = 0; i < 8; i++) {
        const cx = 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3 - x
        const d = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t
        if (Math.abs(cx) < 1e-5 || !d) break
        t -= cx / d
      }
      return 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3
    }
    const travel = bezier(0.2, 0.7, 0.2, 1)
    const roll = bezier(0.3, 0.9, 0.2, 1)
    const inOut = bezier(0.65, 0, 0.35, 1)
    const prog = (t, at, delay, dur) => (dur <= 0 ? (t >= at + delay ? 1 : 0) : clamp((t - at - delay) / dur))

    const T = { thumb: 0.24 * R, dig: 0.52 * R, digStag: 0.04 * R, planStag: 0.06 * R, dot: 0.6 * R, sumDelay: 0.2 * R, sum: 0.36 * R, panel: 0.52 * R, row: 0.3 * R, rowStag: 0.024 * R, only: 0.36 * R, hl: 0.32 * R, faq: 0.36 * R, axis: 0.7 * R, card: 0.6 * R }
    const cur = D.currency
    const money = (v) => cur + (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    const round2 = (v) => Math.round(v * 100) / 100

    // ------------------------------------------------------------ state
    const S = { bill: D.billing ? D.billing.start : 'm', billAt: NEVER, thumbFrom: 0, arriveAt: recording ? 0.15 : reduced ? NEVER : null, only: false, onlyAt: NEVER, hl: null, idx: 0, mode: '' }
    let busyUntil = 0
    const poke = (t = now()) => (busyUntil = Math.max(busyUntil, t + 2.5))

    // ------------------------------------------------------------ panels (height in and out)
    function panel(el, open, dur) {
      return { el, open, at: NEVER, from: 0, to: 0, dur }
    }
    const heightAt = (p, t) => {
      if (p.at === NEVER) return p.open ? null : 0
      const k = travel(prog(t, p.at, 0, p.dur))
      return k >= 1 ? (p.open ? null : 0) : lerp(p.from, p.to, k)
    }
    function setPanel(p, open, t) {
      if (p.open === open && p.at === NEVER) return
      const was = heightAt(p, t)
      p.el.hidden = false
      const natural = p.el.scrollHeight
      p.from = was === null ? natural : was
      p.to = open ? natural : 0
      p.open = open
      p.at = t
    }
    function drawPanel(p, t) {
      if (p.at === NEVER) {
        p.el.hidden = !p.open
        p.el.style.height = ''
        return
      }
      const k = travel(prog(t, p.at, 0, p.dur))
      if (k >= 1) {
        p.el.style.height = ''
        p.el.hidden = !p.open
        return
      }
      p.el.hidden = false
      if (p.open) p.to = Math.max(p.to, 1)
      p.el.style.height = `${lerp(p.from, p.open ? p.el.scrollHeight : 0, k)}px`
    }

    // ------------------------------------------------------------ prices: digits that roll
    const fmt = (v) => (Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    const plans = $$('.pk-card').map((el, i) => {
      const P = D.plans[i]
      const digits = $('.pk-digits', el)
      const cols = []
      if (digits) {
        const sm = fmt(P.m), sy = fmt(P.y)
        const len = Math.max(sm.length, sy.length)
        const a = sm.padStart(len, ' '), b = sy.padStart(len, ' ')
        for (let k = 0; k < len; k++) {
          const span = document.createElement('span')
          span.className = 'pk-col'
          const rolls = /\d/.test(a[k]) && /\d/.test(b[k])
          const col = { el: span, rolls, m: a[k], y: b[k], from: 0, to: 0, at: NEVER, delay: (len - 1 - k) * T.digStag + i * T.planStag }
          if (rolls) {
            const strip = document.createElement('span')
            strip.className = 'pk-strip'
            strip.innerHTML = '0123456789'.split('').map((n) => `<span>${n}</span>`).join('')
            span.append(strip)
            col.strip = strip
          } else span.classList.add('is-static')
          digits.append(span)
          cols.push(col)
        }
      }
      const sum = $('.pk-sum', el)
      return {
        el, P, i, cols, sum,
        lines: sum && { m: JSON.parse(sum.dataset.m), y: JSON.parse(sum.dataset.y) },
        shown: null,
        sr: $('.pk-price-sr', el),
        dot: { from: P.m ?? 0, to: P.m ?? 0, at: NEVER, delay: i * T.planStag },
        rec: el.classList.contains('pk-rec'),
        fold: $('.pk-fold', el),
        body: panel($('.pk-body', el), true, T.faq),
      }
    })
    const digitOf = (c, bill) => Number(bill === 'y' ? c.y : c.m)
    const colPos = (c, t) => (c.at === NEVER ? c.to : lerp(c.from, c.to, roll(prog(t, c.at, c.delay, T.dig))))
    const priceOf = (P, bill) => (bill === 'y' ? P.y : P.m)
    const dotAt = (d, t) => (d.at === NEVER ? d.to : lerp(d.from, d.to, travel(prog(t, d.at, d.delay, T.dot))))
    for (const p of plans) for (const c of p.cols) if (c.rolls) c.from = c.to = digitOf(c, S.bill)
    for (const p of plans) if (!p.P.custom) p.dot.from = p.dot.to = priceOf(p.P, S.bill)

    // ------------------------------------------------------------ billing switch
    const radios = $$('.pk-switch [role=radio]')
    const live = $('.pk-live')
    function setBill(bill, t = now()) {
      if (!D.billing || bill === S.bill) return
      S.thumbFrom = thumbAt(t)
      for (const p of plans) {
        for (const c of p.cols) if (c.rolls) { c.from = colPos(c, t); c.to = digitOf(c, bill); c.at = t }
        if (!p.P.custom) { p.dot.from = dotAt(p.dot, t); p.dot.to = priceOf(p.P, bill); p.dot.at = t }
        if (p.sr) p.sr.textContent = p.sr.dataset[bill]
      }
      S.prevBill = S.bill
      S.bill = bill
      S.billAt = t
      root.dataset.bill = bill
      for (const r of radios) {
        const on = r.dataset.bill === bill
        r.setAttribute('aria-checked', String(on))
        r.tabIndex = on ? 0 : -1
      }
      if (live && !recording) live.textContent = bill === 'y' ? `Showing yearly prices. ${$('.pk-save b').textContent}.` : 'Showing monthly prices.'
      calcChanged(t, true)
      poke(t)
    }
    const thumbAt = (t) => {
      const to = S.bill === 'y' ? 1 : 0
      if (S.billAt === NEVER) return to
      return lerp(S.thumbFrom, to, travel(prog(t, S.billAt, 0, T.thumb)))
    }
    radios.forEach((r) => {
      r.addEventListener('click', () => setBill(r.dataset.bill))
      r.addEventListener('keydown', (e) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
        e.preventDefault()
        const next = radios.find((x) => x !== r) ?? r
        const target = e.key === 'Home' ? radios[0] : e.key === 'End' ? radios.at(-1) : next
        setBill(target.dataset.bill)
        target.focus()
      })
    })

    // ------------------------------------------------------------ the price scale
    const svg = $('.pk-svg')
    const NS = 'http://www.w3.org/2000/svg'
    const el = (tag, attrs = {}, parent = svg) => {
      const n = document.createElementNS(NS, tag)
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
      parent.append(n)
      return n
    }
    let G = null // geometry, rebuilt on resize
    function layoutScale() {
      svg.textContent = ''
      const box = svg.getBoundingClientRect()
      const W = box.width, H = box.height
      const narrow = S.mode === 'narrow'
      const hasC = D.plans.some((p) => p.custom)
      const pad = 6
      const span = W - pad * 2 - (hasC ? (narrow ? 44 : 110) : 0)
      const max = D.scale.max
      const x = (v) => pad + (span * v) / max
      const ay = narrow ? 24 : 34
      const id = `pkh${Math.random().toString(36).slice(2, 7)}`
      const defs = el('defs')
      const pat = el('pattern', { id, width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs)
      el('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: 'var(--hatch)', 'stroke-width': 2 }, pat)
      const g = { W, H, x, ay, narrow, hasC, pad, plans: [] }
      g.axis = el('line', { x1: 0, x2: hasC ? x(max) + 10 : W, y1: ay, y2: ay, stroke: 'var(--ink)', 'stroke-width': 1 })
      g.axisLen = hasC ? x(max) + 10 : W
      g.marks = el('g')
      const steps = Math.round(max / D.scale.step)
      for (let s = 0; s <= steps * 2; s++) {
        const v = (s * D.scale.step) / 2
        if (v > max + 1e-9) break
        const major = s % 2 === 0
        if (narrow && !major) continue
        el('line', { x1: x(v), x2: x(v), y1: ay, y2: ay - (major ? 8 : 4), stroke: 'var(--ink)', 'stroke-width': 1 }, g.marks)
        if (major && !narrow) el('text', { x: x(v), y: ay - 14, 'text-anchor': 'middle', class: 't-muted' }, g.marks).textContent = money(v)
      }
      if (narrow) {
        el('text', { x: 0, y: ay - 10, class: 't-muted' }, g.marks).textContent = money(0)
        el('text', { x: x(max), y: ay - 10, 'text-anchor': hasC ? 'middle' : 'end', class: 't-muted' }, g.marks).textContent = money(max)
      }
      if (hasC) {
        el('path', { d: `M${x(max) + 18} ${ay + 6} l6 -12 M${x(max) + 26} ${ay + 6} l6 -12`, stroke: 'var(--ink)', fill: 'none' }, g.marks)
        el('line', { x1: x(max) + 40, x2: W, y1: ay, y2: ay, stroke: 'var(--ink)', 'stroke-dasharray': '2 4' }, g.marks)
        if (!narrow) el('text', { x: W - pad, y: ay - 14, 'text-anchor': 'end', class: 't-muted' }, g.marks).textContent = 'Custom'
      }
      // the cards, where the leaders land
      const tops = plans.map((p) => p.el.getBoundingClientRect())
      const minTop = Math.min(...tops.map((r) => r.top - box.top))
      const base = ay + 24
      const gap = Math.max(3, Math.min(9, (minTop - 6 - base) / Math.max(1, plans.length - 1)))
      plans.forEach((p, i) => {
        const r = tops[i]
        const q = { p, cx: r.left + r.width / 2 - box.left, top: r.top - box.top, elbow: base + gap * i }
        if (!p.P.custom && p.P.m !== p.P.y && D.billing) {
          q.hatch = el('rect', { y: ay - 5, height: 10, fill: `url(#${id})`, stroke: 'var(--save)', 'stroke-width': 1 })
          if (!narrow) {
            q.save = el('text', { y: ay + 18, class: 't-save' })
            q.save.textContent = `−${money(round2(p.P.m - p.P.y))}`
          }
        }
        if (!narrow) q.leader = el('path', { fill: 'none', stroke: p.rec ? 'var(--accent)' : 'var(--rule2)', 'stroke-width': p.rec ? 2 : 1 })
        q.dot = el('circle', { cy: ay, r: p.rec ? 6 : 4.5, fill: p.rec ? 'var(--accent)' : 'var(--bg)', stroke: p.rec ? 'var(--accent)' : 'var(--ink)', 'stroke-width': 1.5 })
        if (narrow) {
          q.name = el('text', { y: ay + 22, 'text-anchor': 'middle', class: p.rec ? 't-ink' : 't-muted' })
          q.name.textContent = p.P.name
        }
        g.plans.push(q)
      })
      G = g
    }
    const charW = 7.3 // IBM Plex Mono at 12px
    function drawScale(t) {
      if (!G) return
      const arrive = S.arriveAt === null ? 0 : S.arriveAt === NEVER ? 1 : 1
      const a = S.arriveAt === null ? 0 : S.arriveAt === NEVER ? 1 : travel(prog(t, S.arriveAt, 0, T.axis))
      G.axis.setAttribute('stroke-dasharray', `${G.axisLen * a} ${G.axisLen}`)
      G.marks.style.opacity = String(clamp(a * 1.4 - 0.3))
      const leadersIn = S.arriveAt === null ? 0 : S.arriveAt === NEVER ? 1 : travel(prog(t, S.arriveAt, 0.35 * R, 0.6 * R))
      const placed = [] // label boxes, so they never sit on each other or on a leader
      const xs = []
      G.plans.forEach((q) => {
        const P = q.p.P
        const v = P.custom ? null : dotAt(q.p.dot, t)
        const px = P.custom ? G.W - G.pad : G.x(v)
        xs.push(px)
        q.dot.setAttribute('cx', px)
        q.dot.setAttribute('r', String((q.p.rec ? 6 : 4.5) * clamp(leadersIn * 1.6)))
        if (q.hatch) {
          const xm = G.x(P.m)
          const w = Math.max(0, xm - px)
          q.hatch.setAttribute('x', px)
          q.hatch.setAttribute('width', w)
          q.hatch.style.opacity = w < 0.5 ? '0' : '1'
        }
        if (q.leader) {
          const len = Math.abs(q.elbow - G.ay) + Math.abs(q.cx - px) + Math.abs(q.top - q.elbow)
          q.leader.setAttribute('d', `M${px} ${G.ay} V${q.elbow} H${q.cx} V${q.top}`)
          q.leader.setAttribute('stroke-dasharray', `${len * leadersIn} ${len + 10}`)
        }
      })
      // saving labels: right of the stretch, else left of the dot, else hidden
      G.plans.forEach((q, i) => {
        if (!q.save) return
        const P = q.p.P
        const kept = (P.m - dotAt(q.p.dot, t)) / (P.m - P.y)
        const op = clamp((kept - 0.85) / 0.15)
        const w = q.save.textContent.length * charW
        const xm = G.x(P.m)
        const tries = [[xm + 6, 'start', xm + 6, xm + 6 + w], [xs[i] - 6, 'end', xs[i] - 6 - w, xs[i] - 6]]
        let ok = null
        for (const [x, anchor, l, r] of tries) {
          const hitLeader = xs.some((lx, j) => j !== i && lx > l - 4 && lx < r + 4)
          const hitLabel = placed.some(([a, b]) => l < b + 6 && r > a - 6)
          const brk = G.hasC ? G.x(D.scale.max) + 8 : Infinity
          if (r > brk - 2 && l < brk + 40) continue
          if (!hitLeader && !hitLabel && l >= 0 && r <= G.W) { ok = [x, anchor, l, r]; break }
        }
        if (ok) {
          q.save.setAttribute('x', ok[0])
          q.save.setAttribute('text-anchor', ok[1])
          placed.push([ok[2], ok[3]])
        }
        q.save.style.opacity = ok ? String(op) : '0'
      })
      // phone: plan names under their dots, nudged apart
      if (G.narrow) {
        let lastRight = -Infinity
        G.plans.forEach((q, i) => {
          const w = q.p.P.name.length * charW
          let x = clamp(xs[i], w / 2, G.W - w / 2)
          if (x - w / 2 < lastRight + 8) x = lastRight + 8 + w / 2
          q.name.setAttribute('x', Math.min(x, G.W - w / 2))
          lastRight = x + w / 2
        })
      }
      void arrive
    }

    // ------------------------------------------------------------ cards
    function drawCards(t) {
      const thumb = $('.pk-switch')
      if (thumb) thumb.style.setProperty('--sw', thumbAt(t).toFixed(4))
      for (const p of plans) {
        // arrival
        const k = S.arriveAt === null ? 0 : S.arriveAt === NEVER ? 1 : travel(prog(t, S.arriveAt, 0.2 * R + p.i * 0.07 * R, T.card))
        p.el.style.setProperty('--in', k.toFixed(4))
        for (const c of p.cols) {
          if (c.rolls) c.strip.style.transform = `translateY(${(-colPos(c, t) * 1.4).toFixed(4)}em)`
          else {
            const half = c.at === NEVER || prog(t, S.billAt, c.delay + T.dig / 2, 0.0001) >= 1
            const ch = half ? (S.bill === 'y' ? c.y : c.m) : S.prevBill === 'y' ? c.y : c.m
            c.el.textContent = ch.trim()
          }
        }
        if (p.lines) {
          let which = S.bill, r = 1
          if (S.billAt !== NEVER) {
            r = prog(t, S.billAt, T.sumDelay + p.i * T.planStag, T.sum)
            if (r <= 0) which = S.prevBill
          }
          if (p.shown !== which) {
            const L = p.lines[which]
            p.sum.innerHTML = L.map((v, k) => {
              const e = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              if (k === 1 && which === 'm' && v) return `<span class="l2"><s>${e(v)}</s></span>`
              if (k === 2 && p.rec) return `<span class="l3">${v ? `<em>${e(v)}</em>` : ''}</span>`
              return `<span class="l${k + 1}">${e(v)}</span>`
            }).join('')
            p.shown = which
          }
          const e = travel(r)
          p.sum.style.clipPath = e >= 1 ? '' : `inset(0 ${((1 - e) * 100).toFixed(2)}% 0 0)`
        }
        drawPanel(p.body, t)
      }
    }

    // phone and tablet: the plans other than the recommended one fold to a row
    function setFold(p, open, t = now()) {
      if (!p.fold) return
      p.fold.setAttribute('aria-expanded', String(open))
      p.fold.querySelector('.pk-sr').textContent = `${open ? 'Hide' : 'Show'} the ${p.P.name} plan`
      if (open) p.el.classList.remove('is-folded')
      setPanel(p.body, open, t)
      if (!open) p.foldAt = t
      poke(t)
    }
    for (const p of plans)
      p.fold?.addEventListener('click', () => {
        setFold(p, p.fold.getAttribute('aria-expanded') !== 'true')
      })
    function drawFolds(t) {
      for (const p of plans) {
        if (!p.fold) continue
        const closed = p.fold.getAttribute('aria-expanded') === 'false'
        if (closed && heightAt(p.body, t) === 0) p.el.classList.add('is-folded')
      }
    }

    // ------------------------------------------------------------ comparison
    const wrap = $('.pk-cmpwrap')
    const cmp = wrap && {
      panel: panel(wrap, false, T.panel),
      rows: $$('.pk-grp, .pk-r', wrap),
      same: $$('.pk-r[data-same]', wrap).map((r) => ({ r, nat: 0 })),
      ring: $('.pk-colring', wrap),
      band: $('.pk-band', wrap),
      heads: $$('.pk-colh', wrap),
      tabs: $$('.pk-tab', wrap),
      only: $('.pk-only', wrap),
      title: $('.pk-cmp-head h3', wrap),
      opener: null,
    }
    function openCompare(i, t = now(), scroll = true) {
      if (!cmp) return
      if (!cmp.panel.open) setPanel(cmp.panel, true, t)
      S.hl = { i, at: t + (scroll && !recording ? 0.5 * R : 0) }
      selectTab(i)
      for (const b of $$('.pk-open')) b.setAttribute('aria-expanded', 'true')
      poke(t + 3)
      if (scroll && !recording) {
        const bar = S.mode === 'narrow' ? $('.pk-bar').getBoundingClientRect().height : 0
        const y = wrap.getBoundingClientRect().top + scrollY - bar - 12
        scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' })
        cmp.title.focus({ preventScroll: true })
      }
    }
    function closeCompare(t = now()) {
      if (!cmp || !cmp.panel.open) return
      setPanel(cmp.panel, false, t)
      for (const b of $$('.pk-open')) b.setAttribute('aria-expanded', 'false')
      poke(t)
      if (cmp.opener && !recording) cmp.opener.focus({ preventScroll: false })
    }
    function selectTab(i) {
      if (!cmp) return
      cmp.tabs.forEach((b) => {
        const on = Number(b.dataset.c) === i
        b.setAttribute('aria-checked', String(on))
        b.tabIndex = on ? 0 : -1
      })
      for (const c of $$('.pk-v', wrap)) c.classList.toggle('sel', Number(c.dataset.c) === i)
    }
    function setOnly(on, t = now()) {
      if (!cmp) return
      for (const s of cmp.same) if (!s.r.hidden) s.nat = s.r.scrollHeight || s.nat
      S.onlyFrom = S.onlyAt === NEVER ? (S.only ? 1 : 0) : onlyAt(t)
      S.only = on
      S.onlyAt = t
      cmp.only.setAttribute('aria-checked', String(on))
      poke(t)
    }
    const onlyAt = (t) => (S.onlyAt === NEVER ? (S.only ? 1 : 0) : lerp(S.onlyFrom, S.only ? 1 : 0, travel(prog(t, S.onlyAt, 0, T.only))))
    if (cmp) {
      for (const b of $$('.pk-open'))
        b.addEventListener('click', () => {
          cmp.opener = b
          openCompare(Number(b.dataset.plan))
        })
      $('.pk-close', wrap).addEventListener('click', () => closeCompare())
      cmp.only.addEventListener('click', () => setOnly(!S.only))
      cmp.tabs.forEach((b, k) => {
        b.addEventListener('click', () => selectTab(Number(b.dataset.c)))
        b.addEventListener('keydown', (e) => {
          const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
          if (!d) return
          e.preventDefault()
          const n = cmp.tabs[(k + d + cmp.tabs.length) % cmp.tabs.length]
          selectTab(Number(n.dataset.c))
          n.focus()
        })
      })
    }
    function drawCompare(t) {
      if (!cmp) return
      drawPanel(cmp.panel, t)
      if (wrap.hidden) return
      const at = cmp.panel.at
      cmp.rows.forEach((r, k) => {
        const v = at === NEVER || !cmp.panel.open ? 1 : prog(t, at, 0.12 * R + k * T.rowStag, T.row)
        r.style.setProperty('--rin', v.toFixed(3))
        if (r.classList.contains('pk-r'))
          for (const c of r.querySelectorAll('.pk-v.new')) {
            const d = at === NEVER || !cmp.panel.open ? 1 : roll(prog(t, at, 0.3 * R + k * T.rowStag + Number(c.dataset.c) * 0.08 * R, 0.22 * R))
            c.style.setProperty('--dot', d.toFixed(3))
          }
      })
      const f = onlyAt(t)
      for (const s of cmp.same) {
        if (f <= 0) { s.r.hidden = false; s.r.style.height = ''; continue }
        if (f >= 1) { s.r.hidden = true; continue }
        s.r.hidden = false
        s.r.style.height = `${(s.nat * (1 - f)).toFixed(2)}px`
      }
      // the recommended column's tint and the ring on the plan you came from
      const box = wrap.querySelector('.pk-cmp').getBoundingClientRect()
      const head = cmp.heads[D.rec]
      if (S.mode !== 'narrow' && head) {
        const hb = head.getBoundingClientRect()
        cmp.band.style.left = `${hb.left - box.left}px`
        cmp.band.style.width = `${hb.width}px`
      }
      let ring = 0
      if (S.hl && S.mode !== 'narrow') {
        const h = cmp.heads[S.hl.i].getBoundingClientRect()
        cmp.ring.style.left = `${h.left - box.left - 7}px`
        cmp.ring.style.width = `${h.width + 14}px`
        cmp.ring.style.top = `${h.top - box.top - 10}px`
        const e = t - S.hl.at
        ring = e < 0 ? 0 : R ? clamp(e / 0.2) * (1 - clamp((e - 1.6) / 0.4)) : e < 2 ? 1 : 0
      }
      cmp.ring.style.opacity = ring.toFixed(3)
    }

    // ------------------------------------------------------------ calculator
    const C = D.calc
    const calc = C && {
      range: $('.pk-range'),
      segs: $('.pk-segs'),
      cells: $$('.pk-cell'),
      hl: $('.pk-hl'),
      res: $('.pk-res'),
      say: $('.pk-say'),
      readv: $('.pk-readv'),
      readu: $('.pk-readu'),
      billed: $('.pk-billed'),
      best: -1,
      hlFrom: null, hlTo: null, hlAt: NEVER,
      segBill: null,
    }
    const fmtV = (v) => (C.log || v >= 10000 ? compact(v) : v.toLocaleString('en-US'))
    function compact(v) {
      const f = (x, s) => `${Number.isInteger(x) ? x : Number(x.toFixed(x < 10 ? 1 : 0))}${s}`
      if (v >= 1e9) return f(v / 1e9, 'B')
      if (v >= 1e6) return f(v / 1e6, 'M')
      if (v >= 1e3) return f(v / 1e3, 'k')
      return String(Math.round(v))
    }
    const word = (v) => (v === 1 ? C.one : C.many)
    function costOf(i, v, bill) {
      const cp = C.plans[i], P = D.plans[i]
      if (cp.quote) return 'quote'
      if (cp.limit !== undefined && v > cp.limit) return null
      const base = bill === 'y' ? P.y : P.m
      const extra = cp.includes !== undefined ? Math.max(0, v - cp.includes) : 0
      const each = bill === 'y' && cp.each_yearly !== undefined ? cp.each_yearly : cp.each ?? 0
      return round2(base + Math.ceil(extra / (cp.per ?? 1) - 1e-9) * each)
    }
    function cheapest(v, bill) {
      let b = -1
      C.plans.forEach((_, i) => {
        const c = costOf(i, v, bill)
        if (typeof c === 'number' && (b < 0 || c < costOf(b, v, bill))) b = i
      })
      return b
    }
    /** The exact value where the cheapest plan changes, between two stops. */
    function crossing(lo, hi, bill) {
      const want = cheapest(hi, bill)
      if (!C.log) return hi
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2
        if (cheapest(mid, bill) === want) hi = mid
        else lo = mid
      }
      const p = 10 ** (Math.floor(Math.log10(hi)) - 1)
      return Math.ceil(hi / p) * p
    }
    function drawSegments(bill) {
      if (calc.segBill === bill && calc.segW === calc.segs.clientWidth) return
      calc.segBill = bill
      calc.segW = calc.segs.clientWidth
      calc.segs.textContent = ''
      const N = C.values.length
      const runs = []
      C.values.forEach((v, k) => {
        const b = cheapest(v, bill)
        if (!runs.length || runs.at(-1).b !== b) runs.push({ b, from: k })
      })
      runs.forEach((r, k) => {
        const to = k + 1 < runs.length ? runs[k + 1].from : N - 1
        const a = N > 1 ? r.from / (N - 1) : 0, b = N > 1 ? to / (N - 1) : 1
        const s = document.createElement('span')
        s.className = 'pk-seg'
        s.style.left = `${(a * 100).toFixed(3)}%`
        s.style.width = `${((b - a) * 100).toFixed(3)}%`
        s.dataset.b = r.b
        calc.segs.append(s)
        const name = r.b >= 0 ? D.plans[r.b].name : ''
        const w = (b - a) * calc.segW
        if (name && w > name.length * 7.6 + 14) {
          const l = document.createElement('span')
          l.className = 'pk-seg-l'
          l.dataset.b = r.b
          l.textContent = name
          l.style.left = `calc(${(a * 100).toFixed(3)}% + 6px)`
          calc.segs.append(l)
        }
      })
      calc.runs = runs
    }
    function calcChanged(t = now(), billing = false) {
      if (!calc) return
      const v = C.values[S.idx]
      const bill = S.bill
      const best = cheapest(v, bill)
      const P = best >= 0 ? D.plans[best] : null
      const price = best >= 0 ? costOf(best, v, bill) : null
      calc.readv.textContent = fmtV(v)
      calc.readu.textContent = `${word(v)}${C.suffix ? ` ${C.suffix}` : ''}`
      if (calc.billed) calc.billed.textContent = D.billing ? `Billed ${bill === 'y' ? 'yearly' : 'monthly'}` : ''
      // the next change above this value
      let next = ''
      const runs = (() => {
        const out = []
        C.values.forEach((x, k) => {
          const b = cheapest(x, bill)
          if (!out.length || out.at(-1).b !== b) out.push({ b, from: k })
        })
        return out
      })()
      const here = runs.findLastIndex((r) => r.from <= S.idx)
      const up = runs[here + 1]
      if (up && up.b >= 0) {
        const x = crossing(C.values[up.from - 1], C.values[up.from], bill)
        next = ` From ${fmtV(x)} ${word(x)}, ${D.plans[up.b].name} costs less.`
      }
      const quote = C.plans.findIndex((p) => p.quote)
      calc.say.innerHTML = P
        ? `At ${fmtV(v)} ${word(v)}, ${esc(P.name)} is <b>${money(price)} a month</b>${D.billing ? `, billed ${bill === 'y' ? 'yearly' : 'monthly'}` : ''}.${esc(next)}`
        : quote >= 0
          ? `At ${fmtV(v)} ${word(v)}, ask for a ${esc(D.plans[quote].name)} quote.`
          : ''
      calc.cells.forEach((cell, i) => {
        const c = costOf(i, v, bill)
        const cp = C.plans[i]
        cell.classList.toggle('on', i === best)
        cell.querySelector('.p').textContent = c === 'quote' ? 'Quote' : c === null ? 'Outgrown' : money(c)
        cell.querySelector('.n').textContent =
          i === best ? 'costs least at your size' : c === 'quote' ? 'custom contract' : c === null ? `over its ${fmtV(cp.limit)}-${C.one} limit` : 'a month'
      })
      const label = P ? `${fmtV(v)} ${word(v)}${C.suffix ? ` ${C.suffix}` : ''}: ${P.name} costs least, ${money(price)} a month` : `${fmtV(v)} ${word(v)}`
      calc.range.setAttribute('aria-valuetext', label)
      if (String(calc.range.value) !== String(S.idx)) calc.range.value = String(S.idx)
      if (best !== calc.best || billing) {
        calc.hlFrom = hlRect(t)
        calc.hlAt = t
        calc.best = best
      }
      poke(t)
    }
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    function cellRect(i) {
      const c = calc.cells[i]
      if (!c) return null
      return { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight }
    }
    function hlRect(t) {
      const to = cellRect(calc.best)
      if (!to) return null
      if (calc.hlAt === NEVER || !calc.hlFrom) return to
      const k = travel(prog(t, calc.hlAt, 0, T.hl))
      const f = calc.hlFrom
      return { x: lerp(f.x, to.x, k), y: lerp(f.y, to.y, k), w: lerp(f.w, to.w, k), h: lerp(f.h, to.h, k) }
    }
    function drawCalc(t) {
      if (!calc) return
      drawSegments(S.bill)
      for (const s of calc.segs.children) s.classList.toggle('on', Number(s.dataset.b) === calc.best)
      const r = hlRect(t)
      if (r) {
        calc.hl.style.transform = `translate(${r.x.toFixed(2)}px, ${r.y.toFixed(2)}px)`
        calc.hl.style.width = `${r.w.toFixed(2)}px`
        calc.hl.style.height = `${r.h.toFixed(2)}px`
        calc.hl.style.left = '0px'
        calc.hl.style.top = '0px'
        calc.hl.style.opacity = '1'
      } else calc.hl.style.opacity = '0'
    }
    if (calc) {
      calc.readv.style.minWidth = `${Math.max(...C.values.map((v) => fmtV(v).length)) * 0.6 + 0.2}em`
      S.idx = Math.max(0, C.values.indexOf(Number(calc.range.value) >= 0 ? C.values[Number(calc.range.value)] : C.values[0]))
      S.idx = Number(calc.range.value)
      calc.range.addEventListener('input', () => {
        S.idx = Number(calc.range.value)
        calcChanged()
      })
    }

    // ------------------------------------------------------------ questions
    const qs = $$('.pk-q').map((q) => ({ b: $('button', q), p: panel($('.pk-a', q), false, T.faq) }))
    function setQ(q, open, t = now()) {
      q.b.setAttribute('aria-expanded', String(open))
      q.b.querySelector('i').textContent = open ? '−' : '+'
      setPanel(q.p, open, t)
      poke(t)
    }
    for (const q of qs) q.b.addEventListener('click', () => setQ(q, q.b.getAttribute('aria-expanded') !== 'true'))

    // ------------------------------------------------------------ layout modes
    function mode() {
      const w = shell.clientWidth
      return w < 1000 ? 'narrow' : w < 1180 ? 'mid' : 'wide'
    }
    function relayout(force) {
      const m = mode()
      if (m !== S.mode || force) {
        const was = S.mode
        S.mode = m
        if (m === 'narrow' && was !== 'narrow') for (const p of plans) if (p.fold) { setFold(p, false, NEVER); p.body.at = NEVER; p.body.open = false; p.el.classList.add('is-folded') }
        if (m !== 'narrow' && was === 'narrow') for (const p of plans) if (p.fold) { p.body.open = true; p.body.at = NEVER; p.el.classList.remove('is-folded'); p.fold.setAttribute('aria-expanded', 'true') }
      }
      drawCards(now())
      drawCompare(now())
      layoutScale()
      if (calc) { calc.segW = -1; calcChanged(now(), true); calc.hlAt = NEVER }
      draw(now())
      poke()
    }

    function draw(t) {
      drawCards(t)
      drawFolds(t)
      drawScale(t)
      drawCompare(t)
      drawCalc(t)
      for (const q of qs) drawPanel(q.p, t)
    }

    // ------------------------------------------------------------ live
    const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      relayout(true)
      if (calc) calcChanged(now())
    })
    let lastW = shell.clientWidth
    new ResizeObserver(() => {
      if (shell.clientWidth === lastW) return
      lastW = shell.clientWidth
      ready.then(() => relayout())
    }).observe(shell)
    if (!recording) {
      if (S.arriveAt === null)
        new IntersectionObserver((es, io) => {
          if (es.some((e) => e.isIntersecting)) {
            S.arriveAt = now()
            poke()
            io.disconnect()
          }
        }, { threshold: 0.12 }).observe(root)
      const loop = () => {
        const t = now()
        if (t < busyUntil) draw(t)
        requestAnimationFrame(loop)
      }
      ready.then(() => { poke(); requestAnimationFrame(loop) })
      // layout can move when fonts or the page around the section change
      addEventListener('load', () => ready.then(() => relayout(true)))
      return
    }

    // ------------------------------------------------------------ recording
    // A fixed script: rest on the plans, switch to yearly, open the comparison
    // from the recommended card, show only what changes, slide the calculator
    // across the next crossover, open a question.
    const AT = { bill: 2.0, cmp: 4.6, cmpScroll: [4.6, 5.8], only: 7.6, calcScroll: [9.0, 10.0], slide: [10.4, 13.0], faqScroll: [14.0, 14.8], faq: 15.0, end: 16.6 }
    const initial = {}
    function reset() {
      S.bill = D.billing ? D.billing.start : 'm'
      S.billAt = NEVER
      S.thumbFrom = S.bill === 'y' ? 1 : 0
      for (const p of plans) {
        for (const c of p.cols) if (c.rolls) { c.from = c.to = digitOf(c, S.bill); c.at = NEVER }
        if (!p.P.custom) { p.dot.from = p.dot.to = priceOf(p.P, S.bill); p.dot.at = NEVER }
        if (p.sr) p.sr.textContent = p.sr.dataset[S.bill]
      }
      for (const r of radios) r.setAttribute('aria-checked', String(r.dataset.bill === S.bill))
      if (cmp) {
        cmp.panel.open = false
        cmp.panel.at = NEVER
        S.hl = null
        S.only = false
        S.onlyAt = NEVER
        cmp.only.setAttribute('aria-checked', 'false')
        for (const s of cmp.same) { s.r.hidden = false; s.r.style.height = '' }
      }
      for (const q of qs) { q.p.open = false; q.p.at = NEVER; q.b.setAttribute('aria-expanded', 'false'); q.b.querySelector('i').textContent = '+' }
      if (calc) { S.idx = initial.idx; calc.best = -1; calc.hlAt = NEVER; calc.hlFrom = null }
    }
    function scrollTarget(name) {
      const bar = S.mode === 'narrow' ? $('.pk-bar').getBoundingClientRect().height : 0
      const top = (e) => e.getBoundingClientRect().top + scrollY
      if (name === 'cmp') return top(wrap) - bar - (S.mode === 'narrow' ? 12 : 40)
      if (name === 'calc') return top($('.pk-calc')) - bar - (S.mode === 'narrow' ? 12 : 60)
      if (name === 'faq') return Math.min(top($('.pk-faq')) - bar - 60, document.documentElement.scrollHeight - innerHeight)
      return 0
    }
    function slideEnds() {
      const bill = D.billing ? 'y' : 'm'
      const i0 = initial.idx
      const N = C.values.length
      let i1 = N - 1
      const b0 = cheapest(C.values[i0], bill)
      for (let k = i0 + 1; k < N; k++) if (cheapest(C.values[k], bill) !== b0) { i1 = Math.min(N - 1, k + Math.max(2, Math.round(N * 0.08))); break }
      return [i0, i1]
    }
    function seek(t) {
      clock = t
      reset()
      const plain = (k) => clamp(k)
      if (D.billing && t >= AT.bill) { clock = AT.bill; setBill(S.bill === 'y' ? 'm' : 'y', AT.bill); clock = t }
      if (cmp && t >= AT.cmp) {
        clock = AT.cmp
        openCompare(D.rec, AT.cmp, false)
        S.hl = { i: D.rec, at: AT.cmpScroll[1] }
        clock = t
      }
      if (cmp && t >= AT.only) {
        clock = AT.only
        drawCompare(AT.only)
        setOnly(true, AT.only)
        clock = t
      }
      if (calc) {
        const [i0, i1] = slideEnds()
        const k = inOut(plain((t - AT.slide[0]) / (AT.slide[1] - AT.slide[0])))
        // when did the cheapest plan last change on the way here?
        let changedAt = NEVER, b = cheapest(C.values[i0], S.bill)
        for (let s = AT.slide[0]; s <= Math.min(t, AT.slide[1]); s += 1 / 60) {
          const kk = inOut(plain((s - AT.slide[0]) / (AT.slide[1] - AT.slide[0])))
          const bb = cheapest(C.values[Math.round(lerp(i0, i1, kk))], S.bill)
          if (bb !== b) { b = bb; changedAt = s }
        }
        S.idx = Math.round(lerp(i0, i1, k))
        calcChanged(t, true)
        calc.hlAt = NEVER
        if (changedAt !== NEVER && t - changedAt < T.hl) {
          // re-run the move from the previous plan's cell
          const prev = cheapest(C.values[Math.round(lerp(i0, i1, inOut(plain((changedAt - 1 / 60 - AT.slide[0]) / (AT.slide[1] - AT.slide[0])))))], S.bill)
          calc.hlFrom = cellRect(prev)
          calc.hlAt = changedAt
        }
      }
      if (qs[1] && t >= AT.faq) setQ(qs[1], true, AT.faq)
      else if (qs[0] && !qs[1] && t >= AT.faq) setQ(qs[0], true, AT.faq)
      draw(t)
      // the camera: scroll along the script, measured on the page as it stands now
      const segs = [['cmp', AT.cmpScroll], ['calc', AT.calcScroll], ['faq', AT.faqScroll]].filter(([n]) => (n === 'cmp' ? !!cmp : n === 'calc' ? !!calc : qs.length))
      let y = 0, from = 0
      for (const [n, [a, b]] of segs) {
        if (t < a) break
        const to = scrollTarget(n)
        y = lerp(from, to, inOut(plain((t - a) / (b - a))))
        from = to
      }
      scrollTo(0, Math.max(0, y))
      draw(t)
    }
    const quiet = [
      ['plans', 1.3, 1.95],
      D.billing && ['yearly', 3.4, 4.55],
      cmp && ['compare', 6.3, 7.5],
      cmp && ['only', 8.1, 8.95],
      calc && ['calculator', 13.4, 13.95],
      qs.length && ['faq', 15.5, 16.55],
    ].filter(Boolean)
    window.PricingKit = {
      length: AT.end,
      ready: ready.then(() => {
        if (calc) initial.idx = S.idx
        seek(0)
        return true
      }),
      seek,
      moments: () => quiet,
    }
  }
})()
