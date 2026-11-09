/* Services Menu Kit runtime. Without it the menu reads as printed; with it
   the "help me choose" form appears: two radio groups (a budget cap and a
   deadline) judge every service and set, mark it (fits, a stretch, not now),
   write one sentence of why under it, count the result in a polite live
   region and keep the choice in the address (?sm-budget=&sm-within=) so it
   can be shared. ?sm-record=1 hands the clock to the recorder
   (window.ServicesMenu.seek), which plays a fixed script. */
(() => {
  const root = document.querySelector('.sm[data-sm]')
  if (!root) return
  const D = JSON.parse(root.dataset.sm)
  const T = D.text
  const params = new URLSearchParams(location.search)
  const REC = params.has('sm-record')
  const nf = new Intl.NumberFormat(D.money.locale, { style: 'currency', currency: D.money.currency, maximumFractionDigits: 0, minimumFractionDigits: 0 })
  const fmt = (n) => nf.format(n)
  /*JUDGE*/

  const form = root.querySelector('.sm-choose')
  const tally = root.querySelector('#sm-tally')
  const clear = root.querySelector('.sm-clear')
  const stick = root.querySelector('.sm-stick')
  const stickT = root.querySelector('.sm-stick-t')
  const rows = D.services.map((s) => ({ s, el: root.querySelector(`#svc-${CSS.escape(s.id)}`) }))
  const setRows = D.sets.map((s, k) => ({ s, el: root.querySelector(`.sm-set[data-set="${k}"]`) }))
  const all = [...rows, ...setRows]
  root.classList.add('sm-js')
  if (REC) root.classList.add('sm-rec')
  form.hidden = false

  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // the same no-break rule as the build: a figure stays with its word
  /*NB*/

  const radios = (name) => [...form.querySelectorAll(`input[name="${name}"]`)]
  const read = (name) => { const v = radios(name).find((r) => r.checked)?.value; return v ? Number(v) : null }
  const pick = (name, v) => { for (const r of radios(name)) r.checked = r.value === (v == null ? '' : String(v)) }

  /** The marks each state draws: bar 0..1, tag 0..1. */
  const LOOK = { none: { bar: 0, tag: 0 }, fit: { bar: 1, tag: 1 }, stretch: { bar: 1, tag: 1 }, out: { bar: 0, tag: 1 } }
  const state = new Map()

  function verdicts(B, W) {
    const on = B != null || W != null
    return all.map(({ s }) => (on ? judge(s, B, W, fmt, T) : null))
  }

  function paint(B, W) {
    const on = B != null || W != null
    root.classList.toggle('sm-filtering', on)
    const v = verdicts(B, W)
    const n = { fit: 0, stretch: 0, out: 0 }
    all.forEach(({ el }, k) => {
      const j = v[k]
      const st = j ? j.st : 'none'
      if (k < rows.length && j) n[st]++
      el.classList.remove('is-fit', 'is-stretch', 'is-out')
      if (j) el.classList.add('is-' + st)
      el.querySelector('.sm-tag > span').textContent = j ? T[st] : ''
      const why = el.querySelector('.sm-why')
      why.hidden = !j
      why.innerHTML = j ? `<b>${esc(j.lead)}</b> ${nb(j.txt)}` : ''
      state.set(el, st)
    })
    const total = rows.length
    tally.innerHTML = on
      ? nb(`With ${B == null ? 'any budget' : 'up to ' + fmt(B)} and ${W == null ? 'no deadline' : W + ' weeks'}: ${n.fit} of ${total} services fit, ${n.stretch} ${n.stretch === 1 ? 'is a stretch' : 'are a stretch'}, ${n.out} ${n.out === 1 ? 'does not' : 'do not'}.`)
      : nb(T.idle)
    clear.hidden = !on
    stickT.innerHTML = on ? `<span class="sm-nb"><b>${esc(B == null ? 'Any budget' : 'Up to ' + fmt(B))}</b></span> <span class="sm-nb">· <b>${esc(W == null ? 'any time' : W + ' weeks')}</b></span> <span class="sm-nb sm-stick-n"><span class="sm-dot">· </span>${n.fit} of ${total} fit</span>` : ''
    keep()
    return n
  }

  function choose(B, W, { url = true } = {}) {
    pick('sm-b', B)
    pick('sm-w', W)
    paint(B, W)
    if (url && !REC) {
      const q = new URLSearchParams(location.search)
      B == null ? q.delete('sm-budget') : q.set('sm-budget', String(B))
      W == null ? q.delete('sm-within') : q.set('sm-within', String(W))
      const s = q.toString()
      history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash)
    }
  }

  /** The choice stays in sight once the form has scrolled away, until the section ends. */
  function keep() {
    const on = root.classList.contains('sm-filtering') && form.getBoundingClientRect().bottom < 0 && root.getBoundingClientRect().bottom > 160
    stick.classList.toggle('sm-on', on)
  }
  stick.hidden = false
  if (!REC) addEventListener('scroll', () => requestAnimationFrame(keep), { passive: true })
  root.querySelector('.sm-change').addEventListener('click', () => {
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches
    form.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
    ;(form.querySelector('input:checked') ?? form.querySelector('input')).focus({ preventScroll: true })
  })

  form.addEventListener('change', () => choose(read('sm-b'), read('sm-w')))
  form.addEventListener('submit', (e) => e.preventDefault())
  clear.addEventListener('click', () => {
    choose(null, null)
    form.querySelector('input[name="sm-b"]').focus()
  })

  // a shared address opens on its choice; a value that isn't on the form is ignored
  const fromUrl = (key, list) => { const v = Number(params.get(key)); return params.has(key) && list.includes(v) ? v : null }
  const budgets = radios('sm-b').map((r) => Number(r.value)).filter(Boolean)
  const weeks = radios('sm-w').map((r) => Number(r.value)).filter(Boolean)
  if (!REC) choose(fromUrl('sm-budget', budgets), fromUrl('sm-within', weeks), { url: false })
  else paint(null, null)

  /* ---------- the recorder's clock: a fixed script, a pure function of time ----------
     0 to 1.4 the menu at rest; scroll to the chooser; the first choice is made
     (budget, then deadline) and the marks draw; it holds; the budget changes
     and some verdicts change; it holds; scroll to the main course; scroll to
     the set menus. Every mark is drawn from the time since its own change. */
  const P = D.preview
  const S = { scroll1: [1.4, 2.6], pickB: 3.0, pickW: 3.5, scroll2: [7.0, 8.4], pickB2: 10.2, scroll3: [13.6, 15.0] }
  const DRAW = 0.42
  const length = 18
  // where nothing moves: each starts after the last change has drawn (DRAW) or the last scroll has ended
  const moments = [['top', 0.2, 1.3], ['chosen', S.pickW + DRAW + 0.1, S.scroll2[0] - 0.05], ['main', S.scroll2[1] + 0.15, S.pickB2 - 0.05], ['changed', S.pickB2 + DRAW + 0.1, S.scroll3[0] - 0.05], ['sets', S.scroll3[1] + 0.15, length - 0.05]].map(([n, a, b]) => [n, Math.round(a * 100) / 100, Math.round(b * 100) / 100])
  const clamp = (x) => Math.max(0, Math.min(1, x))
  const ramp = (t, [a, b]) => clamp((t - a) / (b - a))
  const out3 = (p) => 1 - Math.pow(1 - p, 3)
  const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
  const docTop = (el) => el.getBoundingClientRect().top + scrollY
  const maxY = () => document.documentElement.scrollHeight - innerHeight
  const choiceAt = (t) => {
    if (t < S.pickB) return [null, null]
    if (t < S.pickW) return [P.first.budget, null]
    if (t < S.pickB2) return [P.first.budget, P.first.weeks]
    return [P.second.budget, P.second.weeks]
  }
  const CHANGES = [S.pickB, S.pickW, S.pickB2]
  function seek(t) {
    const [B, W] = choiceAt(t)
    pick('sm-b', B)
    pick('sm-w', W)
    paint(B, W)
    // each element's look eases from what it was before the last change to what it is now
    const last = CHANGES.filter((c) => c <= t).pop()
    const before = last === undefined ? null : choiceAt(last - 0.001)
    const prev = before ? (before[0] == null && before[1] == null ? all.map(() => null) : verdicts(before[0], before[1])) : null
    const p = last === undefined ? 1 : out3(clamp((t - last) / DRAW))
    all.forEach(({ el }, k) => {
      const now = LOOK[state.get(el)]
      const was = prev ? LOOK[prev[k] ? prev[k].st : 'none'] : now
      el.style.setProperty('--sm-bar', (was.bar + (now.bar - was.bar) * p).toFixed(4))
      el.style.setProperty('--sm-tag', (was.tag + (now.tag - was.tag) * p).toFixed(4))
    })
    // the option underline draws with the choice
    for (const r of form.querySelectorAll('input')) {
      const lab = r.closest('.sm-opt')
      const since = r.name === 'sm-b' ? (t >= S.pickB2 ? S.pickB2 : S.pickB) : S.pickW
      lab.style.setProperty('--sm-u', r.checked && r.value ? String(out3(clamp((t - since) / 0.32))) : r.checked ? '1' : '0')
    }
    const yC = () => Math.max(0, docTop(form) - 28)
    const barH = () => stick.querySelector('.sm-stick-in').offsetHeight
    // the course's own rule sits under the bar; its heading lands 24 px below it
    const yM = () => Math.min(maxY(), docTop(root.querySelectorAll('.sm-course')[1]) + parseFloat(getComputedStyle(root.querySelectorAll('.sm-course')[1]).paddingTop) - 24 - barH())
    const ySet = () => Math.min(maxY(), docTop(root.querySelector('.sm-sets') ?? root.querySelector('.sm-foot')) - 24 - barH())
    let y = 0
    if (t >= S.scroll3[0]) y = yM() + (ySet() - yM()) * inOut(ramp(t, S.scroll3))
    else if (t >= S.scroll2[0]) y = yC() + (yM() - yC()) * inOut(ramp(t, S.scroll2))
    else if (t >= S.scroll1[0]) y = yC() * inOut(ramp(t, S.scroll1))
    scrollTo(0, Math.round(y))
    keep()
  }

  const ready = document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  window.ServicesMenu = { ready, seek, length, moments, choose, verdicts: () => all.map(({ el }) => state.get(el)) }
})()
