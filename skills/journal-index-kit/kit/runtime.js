/* Journal Index Kit runtime, inlined into every page. Everything it does is
   an improvement on a page that already works without it:
   - index: section filters in place (the links still go to the section
     pages), the preview slot following the pointer or keyboard focus, the
     register rising once into view, room reserved so filtering never moves
     what is below
   - article: sidenotes placed beside their reference and pushed down so
     none overlap, the progress bar, the contents rail and "N min left of M",
     all from the same per-block reading times the build wrote (data-t)
   - ?ji-record=1: a fixed script the recorder steps frame by frame */
(function () {
  'use strict'
  var doc = document, root = doc.documentElement
  var body = doc.querySelector('.ji[data-view]') || doc.body
  var view = body.getAttribute('data-view')
  var params = new URLSearchParams(location.search)
  var RECORD = params.has('ji-record')
  var reduce = matchMedia('(prefers-reduced-motion: reduce)')
  var $ = function (s, el) { return (el || doc).querySelector(s) }
  var $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)) }
  var api = { view: view, record: RECORD }
  window.JournalIndex = api

  /* ---------------- index ---------------- */
  var reg = $('.ji-reg'), plate = $('.ji-plate'), rows = $$('.ji-reg .ji-row')
  var filterLinks = $$('.ji-filters a[data-filter]')
  var countEl = $('.ji-count'), countText = $('.ji-count-t')
  var fullRegister = !!(reg && countEl && rows.length === Number(countEl.getAttribute('data-total')))
  var active = 'All'
  var currentNo = plate ? plate.getAttribute('data-no') : null

  function rowLink(li) { return li.querySelector('a') }
  function setPlate(li, mark) {
    if (!plate || !li) return null
    var a = rowLink(li), no = a.getAttribute('data-no')
    rows.forEach(function (r) { r.classList.toggle('ji-on', mark && r === li) })
    if (no === currentNo) return null
    currentNo = no
    var tpl = li.querySelector('template.ji-pl-t')
    var frag = tpl.content.cloneNode(true)
    var cap = frag.querySelector('.ji-pl-cap')
    var frame = plate.querySelector('.ji-pl-frame')
    var layers = frame.querySelectorAll('.ji-pl-layer')
    for (var i = 0; i < layers.length - 1; i++) layers[i].remove()
    var layer = doc.createElement('span')
    layer.className = 'ji-pl-layer ji-enter'
    if (cap) cap.remove()
    layer.appendChild(frag)
    frame.appendChild(layer)
    plate.querySelector('.ji-pl-cap').innerHTML = cap ? cap.innerHTML : ''
    plate.setAttribute('href', a.getAttribute('href'))
    plate.setAttribute('data-no', no)
    var img = layer.querySelector('img')
    if (img) img.loading = 'eager'
    layer.getBoundingClientRect()
    layer.classList.remove('ji-enter')
    return img && img.decode ? img.decode().catch(function () {}) : null
  }

  function matches(li, name) {
    return name === 'All' ? !li.classList.contains('ji-extra') : li.getAttribute('data-section') === name
  }
  function applyFilter(name, instant, keepPlate) {
    active = name
    if (instant) reg.classList.add('ji-instant')
    var shown = 0, first = null
    rows.forEach(function (li) {
      var on = matches(li, name)
      if (on) {
        shown++
        if (!first) first = li
        if (li.hidden) { li.hidden = false; li.classList.add('ji-out'); li.getBoundingClientRect() }
        li.classList.remove('ji-out')
      } else li.classList.add('ji-out')
    })
    $$('.ji-reg .ji-year').forEach(function (y) {
      var any = $$('.ji-row', y).some(function (li) { return matches(li, name) })
      if (any && y.hidden) { y.hidden = false; y.classList.add('ji-out'); y.getBoundingClientRect() }
      y.classList.toggle('ji-out', !any)
    })
    var empty = $('.ji-empty', reg)
    if (!shown) {
      if (!empty) { empty = doc.createElement('p'); empty.className = 'ji-empty'; reg.insertBefore(empty, countEl) }
      empty.textContent = 'Nothing in ' + name + ' yet.'
    } else if (empty) empty.remove()
    if (countText) countText.textContent = name === 'All' ? 'Showing ' + shown + ' of ' + rows.length : shown + ' in ' + name
    filterLinks.forEach(function (a) {
      if (a.getAttribute('data-filter') === name) a.setAttribute('aria-current', 'page')
      else a.removeAttribute('aria-current')
    })
    var p = first && !keepPlate ? setPlate(first, false) : null
    if (instant) { reg.getBoundingClientRect(); reg.classList.remove('ji-instant') }
    return p
  }
  // the register keeps the height of its tallest filter, so nothing below moves
  function reserve() {
    if (!fullRegister) return
    reg.style.minHeight = ''
    var keep = active, tallest = 0
    var names = filterLinks.map(function (a) { return a.getAttribute('data-filter') })
    reg.classList.add('ji-instant')
    names.forEach(function (n) { applyFilter(n, true, true); tallest = Math.max(tallest, reg.getBoundingClientRect().height) })
    applyFilter(keep, true, true)
    reg.classList.remove('ji-instant')
    reg.style.minHeight = Math.ceil(tallest) + 'px'
  }
  api.filter = function (name) { return applyFilter(name, false) }
  api.plate = function (i) { return setPlate(rows.filter(function (r) { return !r.classList.contains('ji-out') && !r.hidden })[i], true) }
  api.reserve = reserve

  if (reg) {
    var style = doc.createElement('style')
    style.textContent = '.ji-instant,.ji-instant *{transition:none!important}'
    doc.head.appendChild(style)
    if (fullRegister) {
      filterLinks.forEach(function (a) {
        a.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return
          e.preventDefault()
          var name = a.getAttribute('data-filter')
          applyFilter(name, reduce.matches)
          var u = new URL(location.href)
          if (name === 'All') u.searchParams.delete('section'); else u.searchParams.set('section', name)
          history.replaceState(null, '', u.pathname + u.search + '#index')
        })
      })
      var want = params.get('section')
      if (want && filterLinks.some(function (a) { return a.getAttribute('data-filter') === want })) applyFilter(want, true)
    }
    // the preview slot follows the pointer (after a short pause, so crossing
    // rows doesn't flicker) and the keyboard (at once)
    var timer = 0
    rows.forEach(function (li) {
      var a = rowLink(li)
      a.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return
        clearTimeout(timer)
        timer = setTimeout(function () { setPlate(li, true) }, 60)
      })
      a.addEventListener('pointerleave', function () { clearTimeout(timer) })
      a.addEventListener('focus', function () { setPlate(li, true) })
    })
    // warm the preview images once someone reaches the register
    var warmed = false
    function warm() {
      if (warmed) return
      warmed = true
      return Promise.all(rows.map(function (li) {
        var img = li.querySelector('template.ji-pl-t').content.querySelector('img')
        if (!img) return null
        var i = new Image()
        var src = img.parentNode.querySelector('source[type="image/webp"]')
        i.src = new URL(src ? src.getAttribute('srcset') : img.getAttribute('src'), location.href).href
        return i.decode ? i.decode().catch(function () {}) : null
      }))
    }
    reg.addEventListener('pointerenter', warm, { once: true })
    reg.addEventListener('focusin', warm, { once: true })
    api.warm = warm
    // the entrance, once, when the register comes into view
    if (!reduce.matches && !RECORD && 'IntersectionObserver' in window) {
      var r0 = reg.getBoundingClientRect()
      if (r0.top > innerHeight * 0.9) {
        reg.classList.add('ji-waiting')
        var io = new IntersectionObserver(function (es) {
          if (!es.some(function (e) { return e.isIntersecting })) return
          io.disconnect()
          enter()
        }, { threshold: 0.08 })
        io.observe(reg)
      }
    }
    function enter() {
      var k = 0
      rows.forEach(function (li) { if (!li.hidden && !li.classList.contains('ji-out')) li.style.setProperty('--i', Math.min(k++, 12)) })
      reg.classList.remove('ji-waiting')
      reg.classList.add('ji-rising')
    }
    api.enter = enter
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(reserve)
    addEventListener('load', reserve)
    var rw = innerWidth
    addEventListener('resize', function () { if (innerWidth !== rw) { rw = innerWidth; clearTimeout(api._rs); api._rs = setTimeout(reserve, 150) } })
  }

  /* ---------------- article ---------------- */
  var art = $('.ji-art')
  var measure = $('.ji-measure'), notesBox = $('.ji-notes')
  var blocks = measure ? $$('[data-t]', measure) : []
  var total = blocks.reduce(function (s, b) { return s + Number(b.getAttribute('data-t')) }, 0)
  var heads = measure ? $$('h2[id]', measure) : []
  var bar = $('.ji-progress i'), fill = $('.ji-fill')
  var lefts = $$('.ji-left')
  var minutes = art ? Number(art.getAttribute('data-minutes')) : 0
  var railItems = $$('.ji-rail li:not(.ji-rail-notes)'), tocItems = $$('.ji-tocm li:not(.ji-rail-notes)')
  var LINE = 0.3 // the reading line: 30% down the window

  function docTop(el) { return el.getBoundingClientRect().top + scrollY }
  // seconds read so far: blocks above the reading line count in full, the
  // block under it in proportion; at the very end of the page, all of it
  function readSeconds() {
    var line = scrollY + innerHeight * LINE
    if (scrollY + innerHeight >= root.scrollHeight - 2) return total
    var s = 0
    for (var i = 0; i < blocks.length; i++) {
      var r = blocks[i].getBoundingClientRect(), top = r.top + scrollY, h = r.height
      var t = Number(blocks[i].getAttribute('data-t'))
      if (line >= top + h) s += t
      else if (line > top && h > 0) s += t * (line - top) / h
    }
    return Math.min(s, total)
  }
  function progress() {
    if (!art) return
    var read = readSeconds()
    var f = total ? read / total : 0
    var left = Math.max(0, total - read)
    var n = Math.ceil(left / 60 - 1e-9)
    if (bar) bar.style.width = (f * 100).toFixed(3) + '%'
    if (fill) fill.style.transform = 'scaleY(' + f.toFixed(4) + ')'
    var html = n > 0 ? '<strong>' + n + ' min</strong> left of ' + minutes : '<strong>Finished</strong> · ' + minutes + ' min'
    lefts.forEach(function (el) { if (el.getAttribute('data-n') !== String(n)) { el.innerHTML = html; el.setAttribute('data-n', n) } })
    var line = scrollY + innerHeight * LINE, cur = -1
    heads.forEach(function (h, i) { if (docTop(h) <= line) cur = i })
    railItems.forEach(function (li, i) { li.classList.toggle('ji-cur', i === cur) })
    tocItems.forEach(function (li, i) { li.classList.toggle('ji-cur', i === cur) })
    api.reading = { read: read, total: total, fraction: f, left: left, minutesLeft: n }
  }
  // sidenotes: each at its reference's baseline, pushed below the note above
  // it and below any figure that reaches into the margin
  function layoutNotes() {
    if (!art || !notesBox) return
    var wide = innerWidth >= 1180 && notesBox.children.length > 0
    body.classList.toggle('ji-sidenotes', wide)
    $$('.ji-ref').forEach(function (a) {
      var n = a.id.slice(2)
      a.setAttribute('href', wide ? '#sn-' + n : '#n-' + n)
    })
    if (!wide) { notesBox.style.height = ''; return }
    var box = notesBox.getBoundingClientRect()
    var blocksWide = $$('.ji-wide, .ji-tall, .ji-pull', measure).map(function (el) {
      var r = el.getBoundingClientRect()
      return { top: r.top - box.top, bottom: r.bottom - box.top, reaches: r.right > box.left + 1 }
    }).filter(function (b) { return b.reaches })
    var prev = -Infinity, last = 0
    $$('.ji-sn', notesBox).forEach(function (sn) {
      var ref = doc.getElementById(sn.getAttribute('data-ref'))
      var anchor = ref.querySelector('.ji-anchor')
      sn.style.top = '0px'
      var base = anchor.getBoundingClientRect().top - box.top
      var b = sn.querySelector('b')
      var own = b.getBoundingClientRect()
      var ascent = (own.bottom - sn.getBoundingClientRect().top) - (own.height * 0.22)
      var top = Math.max(base - ascent, prev + 16)
      var h = sn.getBoundingClientRect().height
      for (var k = 0; k < 4; k++) blocksWide.forEach(function (w) { if (top < w.bottom + 16 && top + h > w.top - 8) top = w.bottom + 16 })
      sn.style.top = Math.round(top) + 'px'
      prev = top + h
      last = prev
    })
    notesBox.style.height = Math.ceil(last) + 'px'
  }
  api.layoutNotes = layoutNotes
  api.update = function () { layoutNotes(); progress() }
  if (art) {
    // reference and note light up together
    $$('.ji-ref').forEach(function (a) {
      var sn = doc.getElementById('sn-' + a.id.slice(2))
      if (!sn) return
      var on = function () { a.classList.add('ji-hl'); sn.classList.add('ji-hl') }
      var off = function () { a.classList.remove('ji-hl'); sn.classList.remove('ji-hl') }
      a.addEventListener('pointerenter', on); a.addEventListener('pointerleave', off)
      a.addEventListener('focus', on); a.addEventListener('blur', off)
      sn.addEventListener('pointerenter', on); sn.addEventListener('pointerleave', off)
      a.addEventListener('click', function (e) {
        if (!body.classList.contains('ji-sidenotes')) return
        e.preventDefault(); on(); setTimeout(off, 1400)
      })
    })
    $$('.ji-tocm a').forEach(function (a) { a.addEventListener('click', function () { a.closest('details').open = false }) })
    var raf = 0
    var tick = function () { raf = 0; progress() }
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(tick) }, { passive: true })
    var aw = innerWidth
    addEventListener('resize', function () { if (innerWidth !== aw) { aw = innerWidth; api.update() } })
    $$('img', measure).forEach(function (img) { if (!img.complete) img.addEventListener('load', function () { api.update() }) })
    api.update()
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(api.update)
    addEventListener('load', api.update)
  }

  /* ---------------- recording ---------------- */
  // A fixed script, stepped by the recorder: nothing moves on its own, and
  // every animation is paused and set to its exact time for each frame.
  var events = [], scrolls = [], length = 2, tagged = new Map(), applied = 0, clock = -1
  if (RECORD) {
    $$('img').forEach(function (img) { img.loading = 'eager' })
    root.style.scrollBehavior = 'auto'
  }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
  function script() {
    if (view === 'index' && reg) {
      var y = Math.max(0, Math.round(docTop($('.ji-index')) - 16))
      var phone = innerWidth < 760
      length = 10
      scrolls = [{ from: 0.7, to: 2.1, y0: 0, y1: y }]
      if (!reduce.matches) {
        reg.classList.add('ji-waiting')
        events.push({ at: 2.0, fn: function () { api.enter() } })
      }
      events.push({ at: 3.4, fn: function () { return api.plate(2) } })
      events.push({ at: 4.7, fn: function () { return api.plate(3) } })
      events.push({ at: 6.0, fn: function () { return api.plate(Math.min(5, rows.length - 1)) } })
      var pick = filterLinks.map(function (a) { return a.getAttribute('data-filter') }).filter(function (n) {
        var c = rows.filter(function (li) { return li.getAttribute('data-section') === n }).length
        return n !== 'All' && c >= 2 && c < rows.length
      })[0]
      if (pick && fullRegister) events.push({ at: 7.3, fn: function () { return applyFilter(pick, false) } })
    } else {
      length = 2
    }
  }
  function capture(at) {
    doc.getAnimations().forEach(function (a) {
      if (tagged.has(a)) return
      tagged.set(a, at)
      a.pause()
    })
  }
  function scrollAt(t) {
    var y = null
    scrolls.forEach(function (s) {
      if (t <= s.from) { if (y === null) y = s.y0 }
      else if (t >= s.to) y = s.y1
      else y = s.y0 + (s.y1 - s.y0) * ease((t - s.from) / (s.to - s.from))
    })
    return y
  }
  api.seek = async function (t) {
    if (t < clock) throw new Error('seek only goes forward (asked ' + t + ' after ' + clock + ')')
    clock = t
    var y = scrollAt(t)
    if (y !== null) { scrollTo(0, Math.round(y)); progress() }
    while (applied < events.length && events[applied].at <= t + 1e-6) {
      var ev = events[applied++]
      var p = ev.fn()
      capture(ev.at)
      if (p && p.then) await p
    }
    capture(t)
    tagged.forEach(function (start, a) {
      var end = a.effect ? a.effect.getComputedTiming().endTime : 0
      a.currentTime = Math.max(0, Math.min((t - start) * 1000, end))
    })
    return t
  }
  api.busy = function () {
    var t = clock, moving = false
    scrolls.forEach(function (s) { if (t > s.from - 1e-6 && t < s.to + 1e-6) moving = true })
    tagged.forEach(function (start, a) {
      var end = a.effect ? a.effect.getComputedTiming().endTime : 0
      if (a.currentTime < end - 0.5 && a.currentTime > 0) moving = true
      if (a.currentTime <= 0 && end > 0 && start <= t) moving = true
    })
    return moving
  }
  api.ready = (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(function () {
    var imgs = $$('img').filter(function (i) { return !i.complete && i.loading !== 'lazy' })
    return Promise.all(imgs.map(function (i) { return new Promise(function (r) { i.addEventListener('load', r); i.addEventListener('error', r) }) }))
  }).then(function () {
    if (reg) reserve()
    if (art) api.update()
    if (RECORD) { script(); return api.warm ? api.warm() : null }
  }).then(function () {
    api.length = length
    root.setAttribute('data-ji-ready', '')
    return true
  })
})()
