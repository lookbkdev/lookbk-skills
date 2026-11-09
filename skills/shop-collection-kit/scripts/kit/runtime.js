// Shop Collection Kit: the page's behaviour. Plain JavaScript, no libraries.
//
// - Turn over: hover (mouse), keyboard focus or the turn button (touch)
//   crossfades a plate to the reverse of the piece and rolls its caption.
// - Filters and sort re-lay the grid with FLIP: leaving plates fade where
//   they stood, the rest glide from their old place to their new one,
//   arriving plates rise in after them. Plate numbers never change.
// - Quick view: a sheet (from the right, or from the bottom on a phone) with
//   both photographs, the options and their stock, and Add to bag, which
//   turns into the bag slip.
// - With ?sck-record=1 nothing moves on its own: the recorder calls
//   ShopCollectionKit.seek(t) for every frame and the page plays its tour by
//   stepping every animation to exactly that time.
;(() => {
  for (const root of document.querySelectorAll('.sck:not([data-sck-on])')) start(root)

  function start(root) {
    root.setAttribute('data-sck-on', '')
    const D = JSON.parse(root.querySelector('.sck-data').textContent)
    const recording = /[?&]sck-record=1/.test(location.search)
    const reduced = !recording && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) root.classList.add('sck-still')
    const $ = (s, r = root) => r.querySelector(s)
    const $$ = (s, r = root) => [...r.querySelectorAll(s)]
    const grid = $('.sck-grid')
    const cards = $$('.sck-card')
    const band = $('.sck-ed')
    const end = $('.sck-end')
    const empty = $('.sck-empty')
    const byId = Object.fromEntries(D.products.map((p) => [p.id, p]))
    const S = { cat: 'all', opts: new Set(), inStock: false, sort: D.sort[0]?.id ?? 'list', chosen: {} }
    for (const p of D.products) S.chosen[p.id] = p.options[0].id
    const money = (n) => {
      const v = D.money.decimals ? n.toFixed(D.money.decimals) : String(Math.round(n))
      return D.money.symbol + v.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }
    const priceOf = (p, opt) => p.optionPrices?.[opt] ?? p.price
    const stockOf = (p, opt) => p.optionStock?.[opt] ?? p.stock

    // ---------- the clock (only the recorder steps it) ----------
    let clock = 0
    const born = (t) => {
      if (!recording) return
      void root.offsetHeight
      for (const a of document.getAnimations()) if (a.sckAt == null) { a.sckAt = t; a.pause() }
    }
    const advance = (t) => {
      for (const a of document.getAnimations()) if (a.sckAt != null) a.currentTime = Math.max(0, (t - a.sckAt) * 1000)
    }
    const act = (fn) => (...a) => { const r = fn(...a); born(clock); return r }

    // ---------- turn over ----------
    const turn = act((card, on) => {
      card.classList.toggle('turned', on)
      const b = $('.sck-turnbtn', card)
      if (b) b.setAttribute('aria-pressed', String(on))
    })
    for (const c of cards) {
      c.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && turn(c, true))
      c.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && turn(c, false))
      c.addEventListener('focusin', () => turn(c, true))
      c.addEventListener('focusout', (e) => !c.contains(e.relatedTarget) && turn(c, false))
      $('.sck-turnbtn', c)?.addEventListener('click', (e) => { e.stopPropagation(); turn(c, !c.classList.contains('turned')) })
      for (const s of $$('.sck-sw[data-v]', c)) s.addEventListener('click', () => pick(c, s.dataset.v))
      $('.sck-q', c)?.addEventListener('click', (e) => { e.stopPropagation(); openQV(c.dataset.id, e.currentTarget) })
      $('.sck-name', c)?.addEventListener('click', (e) => openQV(c.dataset.id, e.currentTarget))
      $('.sck-ph', c)?.addEventListener('click', (e) => { if (matchMedia('(min-width: 760px)').matches) openQV(c.dataset.id, $('.sck-name', c)) })
    }

    // a swatch: the plate's photograph crossfades to that option
    const pick = act((card, v) => {
      const p = byId[card.dataset.id]
      const o = p.options.find((x) => x.id === v)
      if (!o || S.chosen[p.id] === v) return
      S.chosen[p.id] = v
      for (const s of $$('.sck-sw[data-v]', card)) s.setAttribute('aria-pressed', String(s.dataset.v === v))
      // every option's photographs are already in the plate; the chosen pair
      // crossfades in (the opacity transition in style.css)
      for (const img of $$('.sck-ph img', card)) {
        const on = img.dataset.v === v
        img.classList.toggle('on', on)
        img.alt = on ? `${p.name}, ${img.classList.contains('back') ? `${p.turn.label.toLowerCase()}: ${o.caption}` : o.label}` : ''
      }
      const mat = $$('.sck-mat span', card)
      mat[0].textContent = `${o.label} · ${p.size}`
      mat[1].textContent = o.caption
      $('.sck-price', card).textContent = money(priceOf(p, v))
    })

    // ---------- filters, sort and the FLIP ----------
    const visible = () =>
      cards.filter((c) => {
        const p = byId[c.dataset.id]
        if (S.cat !== 'all' && p.category !== S.cat) return false
        if (S.opts.size && !p.options.some((o) => S.opts.has(o.id))) return false
        if (S.inStock && (p.stock.state === 'out' || p.stock.state === 'soon')) return false
        return true
      })
    const ordered = (list) => {
      const k = (c) => byId[c.dataset.id]
      if (S.sort === 'price-low') return [...list].sort((a, b) => k(a).price - k(b).price || k(a).i - k(b).i)
      if (S.sort === 'price-high') return [...list].sort((a, b) => k(b).price - k(a).price || k(a).i - k(b).i)
      return [...list].sort((a, b) => k(a).i - k(b).i)
    }
    const cols = () => getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
    const rel = (el) => {
      const g = grid.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return { x: r.left - g.left, y: r.top - g.top, w: r.width, h: r.height, vx: r.left, vy: r.top }
    }
    const shown = (el) => el && !el.classList.contains('gone') && !el.classList.contains('leaving') && !el.hidden
    function place(list) {
      const n = cols()
      list.forEach((c, i) => (c.style.order = String(2 * i + 2)))
      const L = list.length
      // the band goes after a full row; with no full row, after the end note
      const m = Math.floor(Math.min(D.after, L) / n) * n
      if (band) {
        band.style.order = String(m ? 2 * m + 1 : 2 * L + 3)
        band.classList.toggle('gone', L === 0)
      }
      if (end) {
        // the end note fills the gap the last row leaves, so the grid never ends in a hole
        const holes = (n - (L % n)) % n
        end.classList.toggle('gone', holes === 0 || L === 0)
        end.style.gridColumn = holes ? `span ${holes}` : ''
        end.style.order = String(2 * L + 1)
        const every = L === D.products.length
        $('.sck-end-t', end).textContent = every ? D.endText : D.words.showing.replace('{n}', L).replace('{of}', D.products.length)
        $('.sck-end-all', end).hidden = every
      }
      if (empty) empty.hidden = list.length > 0
      const count = $('.sck-shown')
      if (count) count.textContent = `${list.length} of ${D.products.length}`
      for (const b of $$('.sck-filterbtn .n, .sck-fs-show-n')) b.textContent = String(list.length)
    }
    const apply = act(() => {
      for (const c of cards)
        if (c.classList.contains('leaving')) {
          c.getAnimations().forEach((a) => a.cancel())
          c.classList.remove('leaving')
          c.classList.add('gone')
          c.style.left = c.style.top = c.style.width = ''
        }
      const moving = [...cards, band, end].filter(shown)
      const before = new Map(moving.map((el) => [el, rel(el)]))
      const vis = new Set(visible())
      const leaving = cards.filter((c) => shown(c) && !vis.has(c))
      const entering = cards.filter((c) => c.classList.contains('gone') && vis.has(c))
      const endWas = shown(end)
      for (const c of leaving) {
        const r = before.get(c)
        c.classList.add('leaving')
        Object.assign(c.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px` })
      }
      for (const c of entering) c.classList.remove('gone')
      place(ordered([...vis]))
      if (reduced) {
        for (const c of leaving) { c.classList.remove('leaving'); c.classList.add('gone'); c.style.left = c.style.top = c.style.width = '' }
        return
      }
      for (const c of leaving) c.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
      for (const el of moving) {
        if (!shown(el)) continue
        const a = before.get(el)
        const b = rel(el)
        const dx = a.vx - b.vx
        const dy = a.vy - b.vy
        if (Math.abs(dx) + Math.abs(dy) > 0.5) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 560, delay: 60, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' })
      }
      const arrivals = [...entering, ...(end && shown(end) && !endWas ? [end] : [])]
      arrivals.sort((a, b) => rel(a).y - rel(b).y || rel(a).x - rel(b).x)
      arrivals.forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 380 + i * 40, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }))
    })
    const sync = () => {
      for (const b of $$('[data-f]')) b.setAttribute('aria-pressed', String(b.dataset.f === S.cat))
      for (const b of $$('[data-o]')) b.setAttribute('aria-pressed', String(S.opts.has(b.dataset.o)))
      for (const b of $$('[data-stock]')) b.setAttribute('aria-checked', String(S.inStock))
      for (const b of $$('[data-sort]')) b.setAttribute('aria-pressed', String(b.dataset.sort === S.sort))
      for (const s of $$('select[data-sortsel]')) s.value = S.sort
      const n = (S.cat !== 'all' ? 1 : 0) + S.opts.size + (S.inStock ? 1 : 0)
      for (const b of $$('.sck-filterbtn .k')) b.textContent = n ? ` (${n})` : ''
    }
    const setCat = act((id) => { S.cat = id; sync(); apply() })
    root.addEventListener('click', (e) => {
      const f = e.target.closest('[data-f]')
      if (f) return setCat(f.dataset.f)
      const o = e.target.closest('[data-o]')
      if (o) {
        S.opts.has(o.dataset.o) ? S.opts.delete(o.dataset.o) : S.opts.add(o.dataset.o)
        sync()
        return apply()
      }
      if (e.target.closest('.sck-end-all')) { S.cat = 'all'; S.opts.clear(); S.inStock = false; sync(); return apply() }
      const st = e.target.closest('[data-stock]')
      if (st) { S.inStock = !S.inStock; sync(); return apply() }
      const so = e.target.closest('[data-sort]')
      if (so) { S.sort = so.dataset.sort; sync(); return apply() }
    })
    for (const s of $$('select[data-sortsel]')) s.addEventListener('change', () => { S.sort = s.value; sync(); apply() })

    // ---------- sheets ----------
    const scrim = $('.sck-scrim')
    const qv = $('.sck-qv')
    const fs = $('.sck-fs')
    let opener = null
    let openSheet = null
    const show = act((sheet, on) => {
      sheet.classList.toggle('on', on)
      sheet.setAttribute('aria-hidden', String(!on))
      scrim.classList.toggle('on', on)
      openSheet = on ? sheet : null
    })
    function close() {
      if (!openSheet) return
      const s = openSheet
      show(s, false)
      s.classList.remove('added')
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true })
    }
    scrim.addEventListener('click', close)
    document.addEventListener('keydown', (e) => {
      if (!openSheet) return
      if (e.key === 'Escape') return close()
      if (e.key !== 'Tab') return
      const f = $$('a[href], button:not([disabled]), select, [tabindex="0"]', openSheet).filter((el) => el.getClientRects().length)
      if (!f.length) return
      const first = f[0]
      const last = f.at(-1)
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    })
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
    const Q = { id: null, opt: null, choice: 0 }
    function stockLine(st) {
      if (!st || st.state === 'in') return `<span class="sck-stock in">${esc(D.words.inStock)}</span>`
      return `<span class="sck-stock ${st.state}">${esc(st.note)}${st.action ? ` · <a href="${esc(D.notifyHref)}">${esc(st.action)}</a>` : ''}</span>`
    }
    function qvPrice() {
      const p = byId[Q.id]
      const c = p.choices?.items?.[Q.choice]
      return c?.price ?? priceOf(p, Q.opt)
    }
    function drawQV() {
      const p = byId[Q.id]
      const o = p.options.find((x) => x.id === Q.opt)
      const st = stockOf(p, Q.opt)
      const ch = p.choices
      const c = ch?.items?.[Q.choice]
      const blocked = st.state === 'out' || st.state === 'soon' || c?.soldOut
      $('.sck-qv-front', qv).src = o.src
      $('.sck-qv-front', qv).alt = `${p.name}, ${o.label}`
      $('.sck-qv-back', qv).src = o.turnSrc
      $('.sck-qv-back', qv).alt = `${p.name}, ${o.caption}`
      $('.sck-qv-opt', qv).innerHTML =
        p.options.length > 1 || D.optionLabel
          ? `<p class="sck-opt-h" id="sck-qv-o"><span>${esc(D.optionLabel)}: ${esc(o.label)}</span><span class="sck-lab">${p.options.length} ${p.options.length > 1 ? esc(D.words.options) : esc(D.words.option)}</span></p>
        <div class="sck-opts" role="radiogroup" aria-labelledby="sck-qv-o">${p.options
          .map((x) => `<button type="button" class="sck-o" role="radio" aria-checked="${x.id === Q.opt}" data-qo="${x.id}"><span class="dot" style="background:${x.swatch}"></span><span class="t">${esc(x.label)}</span>${p.optionPrices?.[x.id] != null ? `<span class="p">${money(p.optionPrices[x.id])}</span>` : ''}${stockOf(p, x.id).state === 'out' ? `<span class="sck-lab">${esc(D.words.soldOut)}</span>` : ''}</button>`)
          .join('')}</div>`
          : ''
      $('.sck-qv-ch', qv).innerHTML = ch
        ? `<p class="sck-opt-h" id="sck-qv-c"><span>${esc(ch.label)}</span>${ch.note ? (ch.noteHref ? `<a class="sck-lab" href="${esc(ch.noteHref)}">${esc(ch.note)}</a>` : `<span class="sck-lab">${esc(ch.note)}</span>`) : ''}</p>
        <div class="sck-opts" role="radiogroup" aria-labelledby="sck-qv-c">${ch.items
          .map((x, i) => `<button type="button" class="sck-o" role="radio" aria-checked="${i === Q.choice}" ${x.soldOut ? 'aria-disabled="true"' : ''} data-qc="${i}"><span class="t">${esc(x.label)}</span>${x.price != null ? `<span class="p">${money(x.price)}</span>` : ''}${x.note ? `<span class="sck-lab">${esc(x.note)}</span>` : ''}${x.soldOut ? `<span class="sck-lab">${esc(D.words.soldOut)}</span>` : ''}</button>`)
          .join('')}</div>`
        : ''
      $('.sck-qv-stock', qv).innerHTML = stockLine(st)
      $('.sck-qv-price', qv).textContent = money(qvPrice())
      const add = $('.sck-add', qv)
      add.disabled = !!blocked
      add.innerHTML = blocked ? `<span>${esc(st.state === 'soon' ? st.note : D.words.soldOut)}</span><span></span>` : `<span>${esc(D.words.add)}</span><span>${money(qvPrice())}</span>`
    }
    const openQV = act((id, from) => {
      const p = byId[id]
      Q.id = id
      Q.opt = S.chosen[id]
      Q.choice = p.choices?.default ?? 0
      opener = from ?? null
      $('.sck-qv-no', qv).textContent = `${D.words.no} ${p.no} · ${D.crumb}`
      $('.sck-qv-name', qv).textContent = p.name
      $('.sck-qv-desc', qv).textContent = p.desc ?? ''
      $('.sck-qv-backlab', qv).textContent = p.turn.label
      qv.classList.remove('added')
      drawQV()
      qv.scrollTop = 0
      show(qv, true)
      if (!recording) setTimeout(() => $('.sck-close', qv).focus({ preventScroll: true }), 60)
    })
    qv.addEventListener('click', (e) => {
      const o = e.target.closest('[data-qo]')
      if (o) { Q.opt = o.dataset.qo; drawQV(); return }
      const c = e.target.closest('[data-qc]')
      if (c && c.getAttribute('aria-disabled') !== 'true') { Q.choice = Number(c.dataset.qc); drawQV() }
    })
    const choose = act((i) => { Q.choice = i; drawQV() })
    let bag = { ...D.bag }
    const add = act(() => {
      const p = byId[Q.id]
      const o = p.options.find((x) => x.id === Q.opt)
      const c = p.choices?.items?.[Q.choice]
      const price = qvPrice()
      bag = { ...bag, items: bag.items + 1, total: bag.total + price }
      $('.sck-slip-img', qv).src = o.src
      $('.sck-slip-name', qv).textContent = p.name
      $('.sck-slip-what', qv).textContent = [o.label, c?.label].filter(Boolean).join(' · ')
      $('.sck-slip-price', qv).textContent = money(price)
      $('.sck-slip-n', qv).textContent = `${bag.items} ${bag.items === 1 ? D.words.piece : D.words.pieces}`
      $('.sck-slip-total', qv).textContent = money(bag.total)
      qv.classList.add('added')
      const count = $('.sck-count')
      $('.sck-count-next', count).textContent = String(bag.items)
      count.classList.add('on')
      count.setAttribute('aria-label', `${bag.items} in bag`)
      // bring the slip into view on short screens
      const slip = $('.sck-slip', qv)
      const want = slip.offsetTop - 72
      if (want > qv.scrollTop) recording || reduced ? (qv.scrollTop = want) : qv.scrollTo({ top: want, behavior: 'smooth' })
      if (!recording) setTimeout(() => $('.sck-slip-h', qv).focus({ preventScroll: true }), 80)
    })
    $('.sck-add', qv).addEventListener('click', add)
    $('.sck-keep', qv).addEventListener('click', close)
    $('.sck-close', qv).addEventListener('click', close)
    if (fs) {
      for (const b of $$('.sck-filterbtn')) b.addEventListener('click', () => { opener = b; show(fs, true); if (!recording) setTimeout(() => $('.sck-close', fs).focus({ preventScroll: true }), 60) })
      $('.sck-close', fs).addEventListener('click', close)
      $('.sck-fs-show', fs).addEventListener('click', close)
      $('.sck-fs-clear', fs).addEventListener('click', () => { S.cat = 'all'; S.opts.clear(); S.inStock = false; S.sort = D.sort[0]?.id ?? 'list'; sync(); apply() })
    }

    // ---------- start ----------
    place(ordered(visible()))
    sync()
    addEventListener('resize', () => place(ordered(visible())))
    // the recorder needs every photograph now, not when it scrolls into view
    const imgs = $$('img[src]')
    if (recording) for (const i of imgs) i.loading = 'eager'
    const loadedAll = Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }) }))))
    // and decoded, so a still taken the moment a hidden photograph fades in is never blank
    const decodedAll = loadedAll.then(() => Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : null))))
    const ready = Promise.race([decodedAll, new Promise((r) => setTimeout(r, 15000))]).then(() => (document.fonts ? document.fonts.ready : null)).then(() => true)

    // ---------- the recorded tour ----------
    const multi = cards.find((c) => byId[c.dataset.id].options.length > 1) ?? cards[0]
    const second = cards.find((c) => c.dataset.id === D.tourTurn) ?? cards[1] ?? cards[0]
    const qvCard = cards.find((c) => byId[c.dataset.id].choices) ?? cards[0]
    const qp = byId[qvCard.dataset.id]
    const qd = qp.choices?.default ?? 0
    const altChoice = qp.choices ? qp.choices.items.findIndex((x, i) => i > qd && !x.soldOut) : -1
    // the category whose pieces sit furthest down the list, so filtering visibly moves them up
    const firstOf = (c) => D.products.findIndex((p) => p.category === c.id)
    const cat1 = [...D.categories].filter((c) => firstOf(c) >= 0 && D.products.filter((p) => p.category === c.id).length < D.products.length).sort((a, b) => firstOf(b) - firstOf(a))[0]?.id ?? 'all'
    const STEPS = [
      [3.0, () => turn(second, true)],
      [5.0, () => turn(second, false)],
      [5.2, () => pick(multi, byId[multi.dataset.id].options[1]?.id)],
      [6.8, () => setCat(cat1)],
      [9.2, () => setCat('all')],
      [11.2, () => openQV(qvCard.dataset.id)],
      [12.9, () => altChoice >= 0 && choose(altChoice)],
      [13.4, () => add()],
    ]
    const LENGTH = 15.6
    const quiet = [
      ['header', 0.6, 1.6],
      ['turned', 3.9, 4.9],
      ['swatch', 5.9, 6.7],
      ['filtered', 8.2, 9.1],
      ['all', 10.4, 11.1],
      ['quickview', 12.0, 12.8],
      ['added', 14.2, 15.5],
    ]
    const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)
    const gridY = () => {
      const bar = $('.sck-bar').getBoundingClientRect().height
      return Math.max(0, grid.getBoundingClientRect().top + scrollY - bar + (innerWidth < 760 ? 4 : 16))
    }
    let done = 0
    let target = null
    function seek(t) {
      if (t < clock) throw new Error('seek only goes forward')
      while (done < STEPS.length && STEPS[done][0] <= t) {
        const [at, fn] = STEPS[done]
        advance(at)
        clock = at
        if (target == null) target = gridY()
        scrollTo(0, target)
        fn()
        done++
      }
      clock = t
      if (t >= 1.8 && target == null && t >= 2.8) target = gridY()
      const k = ease(Math.min(1, Math.max(0, (t - 1.8) / 1.0)))
      scrollTo(0, (target ?? gridY()) * k)
      advance(t)
    }
    window.ShopCollectionKit = { length: LENGTH, ready, seek, moments: () => quiet }
  }
})()
