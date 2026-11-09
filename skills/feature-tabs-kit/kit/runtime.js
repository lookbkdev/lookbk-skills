/* Feature Tabs Kit runtime. No dependencies. One instance per .ftk section.
   - turns the stacked features (the no-JS page) into a tablist and one stage
   - a switch keeps the objects both views share and moves them from where
     they were to where they go (FLIP); bars grow out of the amount they came
     from; the rest leaves (180 ms) or arrives after the travellers (300 ms)
   - the stage is as tall as its tallest view at this width, so the page
     never moves when the tab changes
   - the tour advances on a visible clock, pauses off screen, in a hidden tab
     and while the pointer is on the rail, and stops for good on any input
   - ?ftk-record=1: nothing runs on its own; FeatureTabs.seek(t) draws the
     tour's fixed script at time t, for the recorder */
(function () {
  var root = document.currentScript && document.currentScript.closest('.ftk')
  if (!root || root.__ftk) return
  root.__ftk = true
  root.classList.add('ftk-js')
  var cfg = JSON.parse(root.getAttribute('data-ftk'))
  var record = /[?&#]ftk-record=1/.test(location.href)
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  var narrow = matchMedia('(max-width: 880px)')
  var $ = function (s, el) { return (el || root).querySelector(s) }
  var $$ = function (s, el) { return [].slice.call((el || root).querySelectorAll(s)) }

  var tablist = $('[role="tablist"]')
  var tabs = $$('[role="tab"]', tablist)
  var rail = $('.ftk-rail')
  var panel = $('.ftk-panel')
  var stage = $('.ftk-panel .ftk-stage')
  var sbody = $('.ftk-panel .ftk-sbody')
  var items = $$('.ftk-stack > .ftk-item')
  var views = items.map(function (it) { return $('.ftk-v', it).outerHTML })
  var data = items.map(function (it) {
    return {
      title: $('h3 .ftk-tt', it).textContent, claim: $('.ftk-claim', it).textContent,
      proof: $('.ftk-proof', it).innerHTML, cap: $('.ftk-cap', it).innerHTML,
      state: it.getAttribute('data-state'), tone: it.getAttribute('data-tone')
    }
  })
  var crumbs = $$('.ftk-crumbs .ftk-label')
  var cu = $('.ftk-cu')
  var copy = $('.ftk-copy')
  var cap = $('.ftk-panel .ftk-cap')
  var stateEl = $('.ftk-panel .ftk-state')
  var tourLabel = $('.ftk-tour span')
  var ui = $('.ftk-ui')
  var n = tabs.length
  var cur = -1, measuring = false

  /* ---------- the stage's height: its tallest view, at this width ---------- */
  function measure() {
    var m = sbody.cloneNode(false)
    m.className = 'ftk-sbody ftk-measure'
    m.style.cssText = 'position:absolute;visibility:hidden;left:0;right:0;top:0;height:auto'
    stage.appendChild(m)
    var h = 0
    views.forEach(function (v) { m.innerHTML = v; h = Math.max(h, m.offsetHeight) })
    stage.removeChild(m)
    sbody.style.setProperty('--ftk-h', Math.ceil(h) + 'px')
    // the rail's open claim, the caption and the copy under the stage differ
    // from tab to tab: hold the whole block at its tallest too
    if (cur >= 0) {
      var keep = cur, uh = 0
      root.classList.add('ftk-measuring')
      measuring = true
      ui.style.minHeight = ''
      for (var i = 0; i < n; i++) { chrome(i); uh = Math.max(uh, ui.offsetHeight) }
      chrome(keep)
      measuring = false
      ui.style.minHeight = Math.ceil(uh) + 'px'
      root.offsetHeight
      root.classList.remove('ftk-measuring')
    }
    return h
  }

  /* ---------- a switch ---------- */
  function finishAll() {
    root.getAnimations ? root.getAnimations({ subtree: true }).forEach(function (a) { try { a.finish() } catch (e) { a.cancel() } }) : 0
    $$('.ftk-ghost', sbody).forEach(function (g) { g.remove() })
  }
  function crumbTo(i) {
    crumbs.forEach(function (c, j) { c.classList.toggle('ftk-on', j === i) })
    var c = crumbs[i]
    if (c && cu) { cu.style.left = c.offsetLeft + 'px'; cu.style.width = c.offsetWidth + 'px' }
  }
  function chrome(i) {
    tabs.forEach(function (t, j) {
      t.setAttribute('aria-selected', j === i ? 'true' : 'false')
      t.tabIndex = j === i ? 0 : -1
      if (j !== i) t.style.removeProperty('--t')
    })
    panel.setAttribute('aria-labelledby', tabs[i].id)
    var d = data[i]
    copy.querySelector('h3').textContent = d.title
    copy.querySelector('p').textContent = d.claim
    copy.querySelector('.ftk-proof').innerHTML = d.proof
    cap.innerHTML = d.cap
    if (stateEl) {
      stateEl.textContent = d.state ? '· ' + d.state : ''
      stateEl.className = 'ftk-state' + (d.tone ? ' ftk-tone-' + d.tone : '')
    }
    crumbTo(i)
    if (narrow.matches && !measuring) {
      var t = tabs[i], r = rail
      var left = t.offsetLeft - parseFloat(getComputedStyle(r).paddingLeft)
      if (t.offsetLeft < r.scrollLeft || t.offsetLeft + t.offsetWidth > r.scrollLeft + r.clientWidth)
        r.scrollTo({ left: left, behavior: record || reduced ? 'auto' : 'smooth' })
    }
  }
  var EASE_MOVE = 'cubic-bezier(.65,0,.25,1)', EASE_IN = 'cubic-bezier(.2,.7,.2,1)'
  function show(i, animate) {
    finishAll()
    var sr = sbody.getBoundingClientRect()
    var old = {}
    $$('[data-k]', sbody).forEach(function (el) {
      old[el.getAttribute('data-k')] = { r: el.getBoundingClientRect(), fs: parseFloat(getComputedStyle(el).fontSize) }
    })
    var had = cur >= 0
    var snap = had ? sbody.cloneNode(true) : null
    cur = i
    chrome(i)
    sbody.innerHTML = views[i]
    root.setAttribute('data-tab', String(i))
    if (!animate || !had) return settle(0)
    if (reduced) {
      sbody.firstElementChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' })
      return settle(120)
    }
    var nv = sbody.firstElementChild
    var keep = {}
    $$('[data-k]', nv).forEach(function (el) { keep[el.getAttribute('data-k')] = 1 })
    // what leaves: the old view, minus what stays, fading out on top
    snap.className = 'ftk-ghost'
    snap.removeAttribute('style')
    snap.style.padding = getComputedStyle(sbody).padding
    snap.setAttribute('aria-hidden', 'true')
    $$('[data-k]', snap).forEach(function (el) { if (keep[el.getAttribute('data-k')]) el.style.visibility = 'hidden' })
    sbody.appendChild(snap)
    snap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = function () { snap.remove() }
    // what stays: travels from its old box, in reading order
    var step = 0, longest = 0
    $$('[data-k]', nv).forEach(function (el) {
      var o = old[el.getAttribute('data-k')]
      if (!o) { arrive(el); return }
      var r = el.getBoundingClientRect()
      var s = o.fs / parseFloat(getComputedStyle(el).fontSize)
      var d = Math.min(step++ * 22, 160)
      longest = Math.max(longest, d + 560)
      el.animate([{ transform: 'translate(' + (o.r.left - r.left) + 'px,' + (o.r.top - r.top) + 'px) scale(' + s + ')' }, { transform: 'none' }],
        { duration: 560, delay: d, easing: EASE_MOVE, fill: 'backwards' })
    })
    // bars grow out of the amount they came from
    $$('[data-from]', nv).forEach(function (el) {
      var o = old[el.getAttribute('data-from')]
      if (!o) { arrive(el); return }
      var r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      el.animate([{ transform: 'translate(' + (o.r.left - r.left) + 'px,' + (o.r.top - r.top) + 'px) scale(' + (o.r.width / r.width) + ',' + (o.r.height / r.height) + ')', opacity: 0.25 },
        { transform: 'translate(' + (o.r.left - r.left) * 0.15 + 'px,0) scale(' + Math.max(o.r.width / r.width, 0.35) + ',1)', opacity: 1, offset: 0.45 },
        { transform: 'none', opacity: 1 }], { duration: 680, delay: 60, easing: EASE_MOVE, fill: 'backwards' })
      longest = Math.max(longest, 740)
    })
    $$('.ftk-e', nv).forEach(arrive)
    return settle(Math.max(longest, 560))
  }
  function arrive(el) {
    el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 260, easing: EASE_IN, fill: 'backwards' })
  }
  var settledAt = 0
  function settle(ms) {
    settledAt = performance.now() + ms
    window.FeatureTabs && (window.FeatureTabs.settled = ms === 0)
    if (ms && !record) setTimeout(function () { window.FeatureTabs.settled = true }, ms + 40)
  }

  /* ---------- the tour ---------- */
  var seconds = cfg.seconds || 7
  var touring = cfg.auto !== false && !reduced && !record
  var stopped = false, progress = 0, visible = false, hovering = false, lastT = 0
  var labels = cfg.labels
  if (!touring && !record) root.classList.add('ftk-notour')
  function stop() {
    if (stopped || !touring) return
    stopped = true
    root.classList.add('ftk-stopped')
    root.classList.remove('ftk-paused')
    tabs[cur].style.removeProperty('--t')
    tourLabel.textContent = labels.stopped
  }
  function running() { return touring && !stopped && visible && !document.hidden && !hovering }
  function tick(now) {
    var dt = lastT ? Math.min(now - lastT, 100) : 0
    lastT = now
    if (touring && !stopped) {
      var go = running()
      root.classList.toggle('ftk-paused', !go)
      tourLabel.textContent = go || !hovering ? labels.running : labels.paused
      if (go) {
        progress += dt / (seconds * 1000)
        if (progress >= 1) { progress = 0; show((cur + 1) % n, true) }
        tabs[cur].style.setProperty('--t', progress.toFixed(4))
      }
    }
    if (!stopped && touring) requestAnimationFrame(tick)
  }
  if ('IntersectionObserver' in window)
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting }, { threshold: 0.35 }).observe(stage)
  else visible = true

  /* ---------- input: click, keys, swipe ---------- */
  function go(i, focus) {
    stop()
    if (i !== cur) show(i, true)
    if (focus) tabs[i].focus()
  }
  tabs.forEach(function (t, i) { t.addEventListener('click', function () { go(i) }) })
  tablist.addEventListener('keydown', function (e) {
    var j = null
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (cur + 1) % n
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (cur - 1 + n) % n
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = n - 1
    if (j === null) return
    e.preventDefault()
    go(j, true)
  })
  tablist.addEventListener('focusin', stop)
  rail.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hovering = true })
  rail.addEventListener('pointerleave', function () { hovering = false })
  var down = null
  stage.addEventListener('pointerdown', function (e) { stop(); down = { x: e.clientX, y: e.clientY } })
  stage.addEventListener('pointerup', function (e) {
    if (!down) return
    var dx = e.clientX - down.x, dy = e.clientY - down.y
    down = null
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? Math.min(cur + 1, n - 1) : Math.max(cur - 1, 0))
  })
  stage.addEventListener('pointercancel', function () { down = null })
  function orient() { tablist.setAttribute('aria-orientation', narrow.matches ? 'horizontal' : 'vertical') }
  narrow.addEventListener ? narrow.addEventListener('change', orient) : narrow.addListener(orient)
  orient()
  var rz = 0
  addEventListener('resize', function () {
    cancelAnimationFrame(rz)
    rz = requestAnimationFrame(function () { finishAll(); measure(); crumbTo(cur) })
  })

  /* ---------- the recorder's script: hold each tab, then switch ---------- */
  var HOLD = 2.1, SWITCH = 0.9, SEG = HOLD + SWITCH
  function seek(t) {
    var len = n * SEG
    t = ((t % len) + len) % len
    var i = Math.floor(t / SEG), local = t - i * SEG
    finishAll()
    show(i, false)
    finishAll()
    if (local < HOLD) {
      tabs[i].style.setProperty('--t', (local / HOLD).toFixed(4))
      return { tab: i, settled: true }
    }
    tabs[i].style.setProperty('--t', '1')
    show((i + 1) % n, true)
    var ms = (local - HOLD) * 1000
    root.getAnimations({ subtree: true }).forEach(function (a) { a.pause(); a.currentTime = ms })
    if (window.getComputedStyle) getComputedStyle(sbody).height
    return { tab: (i + 1) % n, settled: false }
  }
  function moments() {
    var settled = [], switches = []
    for (var i = 0; i < n; i++) {
      settled.push([i * SEG + 0.15, i * SEG + HOLD - 0.05, i])
      switches.push([i * SEG + HOLD, (i + 1) * SEG, i, (i + 1) % n])
    }
    return { length: n * SEG, settled: settled, switches: switches }
  }
  function place() {
    // the recorder frames the section: on a phone the chips at the top, elsewhere the whole section
    root.style.marginTop = ''
    var r = root.getBoundingClientRect(), y = r.top + scrollY
    if (narrow.matches && innerWidth < 600) y = rail.getBoundingClientRect().top + scrollY - 12
    else if (r.height > innerHeight) y = y + r.height - innerHeight
    else { root.style.marginTop = Math.floor((innerHeight - r.height) / 2) + 'px'; y = 0 }
    scrollTo(0, Math.max(0, y))
  }

  /* ---------- start ---------- */
  show(0, false)
  measure()
  window.FeatureTabs = window.FeatureTabs || {
    root: root, show: function (i, a) { return show(i, a !== false) }, go: go, stop: stop, measure: measure, seek: seek, moments: moments, place: place,
    length: n * SEG, settled: true,
    state: function () { return { tab: cur, stopped: stopped, touring: touring, progress: progress, visible: visible, orientation: tablist.getAttribute('aria-orientation') } },
    ready: null
  }
  var ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    measure(); crumbTo(cur)
    if (record) { document.documentElement.classList.add('ftk-recording'); place() }
  })
  window.FeatureTabs.ready = ready
  if (touring) requestAnimationFrame(tick)
})()
