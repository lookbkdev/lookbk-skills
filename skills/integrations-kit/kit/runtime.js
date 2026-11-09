/* Integrations kit runtime. Draws the wiring for the chosen app from the
   section's data-ik, runs the packets, and drives the directory's search and
   filters. Everything that moves is computed from one clock, so the recorder
   (?ik-record=1) can step it frame by frame and get the same picture every
   time. Without this script the page still reads: every app's wiring is a
   static table, and the directory is a plain table. */
(() => {
  const root = document.querySelector('.ik')
  if (!root || root.dataset.ikOn) return
  root.dataset.ikOn = '1'
  const D = JSON.parse(root.dataset.ik)
  const byId = Object.fromEntries(D.apps.map((a) => [a.id, a]))
  const REC = new URLSearchParams(location.search).has('ik-record')
  const NS = 'http://www.w3.org/2000/svg'
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  let clock = 0
  const now = () => (REC ? clock : performance.now() / 1000)
  const ease = (p) => { p = Math.min(Math.max(p, 0), 1); return 1 - Math.pow(1 - p, 3) }
  const STATUS = { native: 'Native', webhook: 'Via webhook', community: 'Community', coming: 'Coming' }
  const chip = (s) => `<span class="ik-chip ik-s-${s}"><i aria-hidden="true"></i>${STATUS[s]}</span>`

  root.classList.add('ik-on')
  if (REC) root.classList.add('ik-rec')
  for (const el of root.querySelectorAll('.ik-search, .ik-filters, .ik-live')) el.hidden = false
  const stage = root.querySelector('.ik-stage')
  const panel = root.querySelector('.ik-panel')
  const rail = root.querySelector('.ik-rail')
  const railcol = root.querySelector('.ik-railcol')

  /* ---------- measuring text ---------- */
  const meas = document.createElementNS(NS, 'svg')
  meas.setAttribute('class', 'ik-measure'); meas.setAttribute('aria-hidden', 'true')
  root.appendChild(meas)
  const mt = document.createElementNS(NS, 'text')
  meas.appendChild(mt)
  let cache = new Map()
  const textW = (s, cls) => {
    const k = cls + '|' + s
    if (!cache.has(k)) { mt.setAttribute('class', cls); mt.textContent = s; cache.set(k, mt.getComputedTextLength()) }
    return cache.get(k)
  }
  const wrap = (s, cls, max) => {
    if (textW(s, cls) <= max) return [s]
    const out = []; let line = ''
    for (const w of s.split(' ')) {
      const t = line ? line + ' ' + w : w
      if (line && textW(t, cls) > max) { out.push(line); line = w } else line = t
    }
    if (line) out.push(line)
    return out
  }
  const whenLines = (s, max) => (textW(s, 't-when') <= max ? [s] : s.split(' · ').flatMap((part) => wrap(part, 't-when', max)))
  const T = (x, y, cls, s, extra = '') => `<text class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}"${extra}>${esc(s)}</text>`

  /* ---------- the diagram, desk and tablet ---------- */
  function deskDiagram(app, W) {
    const pad = 20
    const recMax = Math.max(...app.flows.flatMap((f) => [textW(f.ours, 't-rec'), textW(f.theirs, 't-rec')]), ...app.stays.map((s) => textW(s.record, 't-recm')))
    const nameW = (n) => 18 + 26 + 14 + textW(n, 't-node') + 18
    let nodeW = Math.max(150, Math.min(recMax + 2 * pad, 220), Math.min(Math.max(nameW(D.brand), nameW(app.name)), 250))
    nodeW = Math.min(nodeW, Math.floor(W * 0.27))
    // node names wrap onto a second line rather than leave their node
    const room = nodeW - 58 - 14
    const nameFit = (n) => { const lines = wrap(n, 't-node', room); const wide = Math.max(...lines.map((l) => textW(l, 't-node'))); return { lines, size: wide > room ? Math.max(16, Math.floor(21 * room / wide)) : 21 } }
    const nmL = nameFit(D.brand), nmR = nameFit(app.name)
    const headH = 64 + (Math.max(nmL.lines.length, nmR.lines.length) - 1) * 24
    const L1 = nodeW, R0 = W - nodeW, mx = (L1 + R0) / 2
    const avail = R0 - L1 - 44
    const inner = nodeW - 2 * pad
    const top = 26
    let y = top + headH
    const rows = app.flows.map((f) => {
      const name = wrap(f.record, 't-obj', avail), when = whenLines(f.when, avail)
      const ours = wrap(f.ours, 't-rec', inner), theirs = wrap(f.theirs, 't-rec', inner)
      const wy = y + 14 + name.length * 20 + 4
      const bottom = Math.max(wy + 22 + when.length * 17 + 12, wy + Math.max(ours.length, theirs.length) * 10 + 22)
      const r = { f, name, when, ours, theirs, top: y, wy, bottom }
      y = bottom
      return r
    })
    const flowEnd = y
    const leftH = flowEnd - top + 8
    let stays = []
    let sy = flowEnd + 20
    const sepY = sy
    sy += 18
    const stub = 46, sw = 22
    const whyMax = R0 - stub - sw - 14 - L1 - 24
    stays = app.stays.map((s) => {
      const why = wrap(s.why, 't-why', whyMax), rec = wrap(s.record, 't-recm', inner)
      const h = Math.max(46, why.length * 18 + 22, rec.length * 19 + 20)
      const r = { s, why, rec, top: sy, cy: sy + h / 2 }
      sy += h
      return r
    })
    const rightH = (app.stays.length ? sy + 6 : flowEnd + 8) - top
    const H = top + Math.max(leftH, rightH) + 4
    const coming = app.status === 'coming'
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`
    s += T(0, 12, 't-sec', `${D.brand} · where it lands`) + T(W, 12, 't-sec', `${app.name} · what it is there`, ' text-anchor="end"')
    const node = (x, h, nm, mk) => `<g class="d-nd"><rect class="d-node" x="${x + 0.5}" y="${top + 0.5}" width="${nodeW - 1}" height="${h - 1}" rx="3"/>
      <g transform="translate(${x + 18},${top + 19})">${mk}</g>${nm.lines.map((l, k) => T(x + 58, top + 40 + k * 24, 't-node', l, nm.size !== 21 ? ` style="font-size:${nm.size}px"` : '')).join('')}
      <line class="d-div" x1="${x}" x2="${x + nodeW}" y1="${top + headH}" y2="${top + headH}"/></g>`
    s += node(0, leftH, nmL, D.mark) + node(R0, rightH, nmR, app.mkS)
    const wires = []
    rows.forEach((r, i) => {
      if (i) s += `<line class="d-div" x1="12" x2="${nodeW - 12}" y1="${r.top}" y2="${r.top}"/><line class="d-div" x1="${R0 + 12}" x2="${W - 12}" y1="${r.top}" y2="${r.top}"/>`
      const lines = (arr, x, anchor) => arr.map((t, k) => T(x, r.wy + 5 + (k - (arr.length - 1) / 2) * 19, 't-rec', t, anchor)).join('')
      s += lines(r.ours, nodeW - pad, ' text-anchor="end"') + lines(r.theirs, R0 + pad, '')
      const out = r.f.dir === 'out'
      const x1 = out ? L1 : R0, x2 = out ? R0 : L1
      const len = R0 - L1
      s += `<line class="d-wire" data-i="${i}" x1="${x1}" x2="${x2}" y1="${r.wy}" y2="${r.wy}"${coming ? ' stroke-dasharray="6 5"' : ` stroke-dasharray="${len}" stroke-dashoffset="${len}"`}/>`
      s += `<circle class="d-pin" cx="${L1}" cy="${r.wy}" r="4.5"/><circle class="d-pin" cx="${R0}" cy="${r.wy}" r="4.5"/>`
      const arrow = (x, d) => `<path class="d-arrow" d="M${x - 7 * d} ${r.wy - 6}L${x + 6 * d} ${r.wy}L${x - 7 * d} ${r.wy + 6}z"/>`
      let lab = r.f.dir === 'both' ? arrow(mx - 14, 1) + arrow(mx + 14, -1) : arrow(mx, out ? 1 : -1)
      lab += r.name.map((t, k) => T(mx, r.wy - 12 - (r.name.length - 1 - k) * 20, 't-obj', t, ' text-anchor="middle"')).join('')
      lab += r.when.map((t, k) => T(mx, r.wy + 24 + k * 17, 't-when', t, ' text-anchor="middle"')).join('')
      s += `<g class="d-lab" data-i="${i}">${lab}</g>`
      wires.push({ i, y: r.wy, x1, x2, len, dir: r.f.dir, interval: r.f.interval, seconds: r.f.seconds, record: r.f.record, axis: 'x' })
    })
    if (app.stays.length) {
      const cap = `Stays in ${app.name}`
      const cw = textW(cap, 't-sec')
      s += `<line class="d-dash" x1="${R0 + 12}" x2="${W - 12}" y1="${sepY}" y2="${sepY}"/>`
      s += T(R0 - 26, sepY + 4, 't-sec', cap, ' text-anchor="end"')
      s += `<line class="d-dash" x1="${L1 + 26}" x2="${R0 - 26 - cw - 14}" y1="${sepY}" y2="${sepY}"/>`
      stays.forEach((r, j) => {
        const y0 = r.cy, x1 = R0 - stub, x2 = x1 - sw
        s += r.rec.map((t, k) => T(R0 + pad, y0 + 5 + (k - (r.rec.length - 1) / 2) * 19, 't-recm', t)).join('')
        s += `<line class="d-open" x1="${R0}" x2="${x1}" y1="${y0}" y2="${y0}"/>`
        s += `<g class="d-sw" data-j="${j}" data-cx="${x1}" data-cy="${y0}"><line class="d-open" x1="${x1}" x2="${x2 + 1}" y1="${y0}" y2="${y0}"/></g>`
        s += `<circle class="d-openf" cx="${x1}" cy="${y0}" r="2.6"/><circle class="d-openo" cx="${x2}" cy="${y0}" r="2.6"/>`
        s += `<circle class="d-pin" cx="${R0}" cy="${y0}" r="4.5" style="stroke:var(--ik-line)"/>`
        s += r.why.map((t, k) => T(x2 - 14, y0 + 5 + (k - (r.why.length - 1) / 2) * 18, 't-why', t, ' text-anchor="end"')).join('')
      })
    }
    s += '<g class="d-pks"></g></svg>'
    return { svg: s, wires, H, kind: 'desk' }
  }

  /* ---------- the diagram, phone: a harness of vertical wires ---------- */
  const CAP = 3
  function phoneDiagram(app, W, all) {
    const flows = all ? app.flows : app.flows.slice(0, CAP)
    const n = flows.length
    const barH = 52, pitch = 16, x0 = 14
    const lx = (i) => x0 + i * pitch
    const tx = lx(n - 1) + 28
    const avail = W - tx
    const tag = (f) => f.dir === 'in' ? `↑ into ${D.brand}` : f.dir === 'out' ? `↓ out to ${app.name}` : '↕ both ways'
    let y = barH + 30
    const rows = flows.map((f, i) => {
      const name = wrap(f.record, 't-obj', avail), when = whenLines(f.when, avail)
      const pair = wrap(f.dir === 'out' ? `${f.ours} → ${f.theirs}` : `${f.theirs} → ${f.ours}`, 't-recm', avail)
      const r = { f, i, name, when, pair, top: y }
      y += 20 + name.length * 21 + when.length * 18 + 6 + pair.length * 21 + 22
      return r
    })
    let sepY = y - 4
    const stays = []
    if (app.stays.length) {
      let sy = sepY + 40
      for (const st of app.stays) { const why = wrap(st.why, 't-why', avail); stays.push({ st, why, y: sy }); sy += 26 + why.length * 19 + 10 }
      y = sy
    }
    const yB = y + 6
    const H = yB + barH
    const coming = app.status === 'coming'
    const bar = (yy, name, mk, cap) => `<rect class="d-node" x="0.5" y="${yy + 0.5}" width="${W - 1}" height="${barH - 1}" rx="3"/>
      <g transform="translate(12,${yy + 13})">${mk}</g>${T(48, yy + 33, 't-node', name)}${T(W - 12, yy + 31, 't-sec', cap, ' text-anchor="end"')}`
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`
    const wires = []
    rows.forEach((r) => {
      const x = lx(r.i), len = yB - barH
      const down = r.f.dir === 'out'
      const y1 = down ? barH : yB, y2 = down ? yB : barH
      s += `<line class="d-wire" data-i="${r.i}" x1="${x}" x2="${x}" y1="${y1}" y2="${y2}"${coming ? ' stroke-dasharray="6 5"' : ` stroke-dasharray="${len}" stroke-dashoffset="${len}"`}/>`
      s += `<circle class="d-pin" cx="${x}" cy="${barH}" r="3.5"/><circle class="d-pin" cx="${x}" cy="${yB}" r="3.5"/>`
      wires.push({ i: r.i, x, y1, y2, len, dir: r.f.dir, interval: r.f.interval, seconds: r.f.seconds, record: r.f.record, axis: 'y' })
    })
    rows.forEach((r) => {
      const x = lx(r.i)
      let ty = r.top
      let lab = T(tx, ty, 't-dir', tag(r.f))
      // two stacked chevrons on the record's own wire, beside its tag
      const ch = (cy, d) => `<path class="d-arrow" d="M${x - 5.5} ${cy - 4 * d}L${x} ${cy + 4 * d}L${x + 5.5} ${cy - 4 * d}z"/>`
      const d = r.f.dir === 'in' ? -1 : 1
      lab += r.f.dir === 'both' ? ch(ty - 9, -1) + ch(ty + 3, 1) : ch(ty - 10, d) + ch(ty + 1, d)
      ty += 23
      const tickY = ty - 5
      lab += `<line class="d-tick" x1="${x}" x2="${tx - 10}" y1="${tickY}" y2="${tickY}"/><circle class="d-dot" cx="${x}" cy="${tickY}" r="3"/>`
      lab += r.name.map((t, k) => T(tx, ty + k * 21, 't-obj', t)).join('')
      ty += (r.name.length - 1) * 21 + 22
      lab += r.when.map((t, k) => T(tx, ty + k * 18, 't-when', t)).join('')
      ty += (r.when.length - 1) * 18 + 24
      lab += r.pair.map((t, k) => T(tx, ty + k * 21, 't-recm', t)).join('')
      s += `<g class="d-lab" data-i="${r.i}">${lab}</g>`
    })
    if (stays.length) {
      s += `<line class="d-dash" x1="${tx}" x2="${W}" y1="${sepY}" y2="${sepY}"/>` + T(tx, sepY + 24, 't-sec', `Stays in ${app.name}`)
      const xs = tx - 13
      const topY = stays[0].y + 4
      s += `<line class="d-open" x1="${xs}" x2="${xs}" y1="${yB}" y2="${topY + 14}"/>`
      stays.forEach((r, j) => {
        const cy = r.y + 4
        s += `<g class="d-sw" data-j="${j}" data-cx="${xs}" data-cy="${cy + 14}"><line class="d-open" x1="${xs}" x2="${xs}" y1="${cy + 14}" y2="${cy + 1}"/></g>`
        s += `<circle class="d-openf" cx="${xs}" cy="${cy + 14}" r="2.4"/><circle class="d-openo" cx="${xs}" cy="${cy}" r="2.4"/>`
        s += T(tx, r.y + 6, 't-stay', r.st.record) + r.why.map((t, k) => T(tx, r.y + 28 + k * 19, 't-why', t)).join('')
      })
    }
    s += bar(0, D.brand, D.mark, 'lands as') + bar(yB, app.name, app.mkS, 'starts as')
    s += '<g class="d-pks"></g></svg>'
    return { svg: s, wires, H, kind: 'phone', hidden: app.flows.length - n }
  }

  /* ---------- the stage ---------- */
  let mode = '', sel = D.selected, extra = null, all = false
  let geo = null, drawAt = Infinity, drawn = false
  const DRAW = 0.52, STAG = 0.08, SWING = 0.2
  const drawEnd = () => drawAt + STAG * Math.max(0, geo.wires.length - 1) + DRAW + (geo.swings ? SWING : 0)
  const wiresDone = () => drawAt + STAG * Math.max(0, geo.wires.length - 1) + DRAW
  const modeNow = () => (innerWidth < 700 ? 'phone' : innerWidth < 1100 ? 'tab' : 'desk')

  function srTable(app) {
    const dw = (d) => d === 'in' ? `${app.name} to ${D.brand}` : d === 'out' ? `${D.brand} to ${app.name}` : 'both ways'
    return `<div class="ik-sr"><table><caption>What crosses between ${esc(D.brand)} and ${esc(app.name)}</caption><tbody>${app.flows.map((f) => `<tr><th scope="row">${esc(f.record)}</th><td>${esc(dw(f.dir))}</td><td>${esc(f.when)}</td><td>${esc(f.theirs)} in ${esc(app.name)}, ${esc(f.ours)} in ${esc(D.brand)}</td></tr>`).join('')}</tbody></table>${app.stays.length ? `<p>Stays in ${esc(app.name)}: ${app.stays.map((s) => `${esc(s.record)}, ${esc(s.why)}`).join('; ')}.</p>` : ''}</div>`
  }
  function stageHTML(app) {
    const cta = app.status === 'coming'
      ? `<span class="ik-btn ik-later">${esc(app.eta)}</span>`
      : `<a class="ik-btn" href="${esc(D.cta.href.replace(/\/$/, ''))}/${esc(app.id)}">${esc(D.cta.label.replace('{app}', app.name))}<span aria-hidden="true"> →</span></a>`
    const setup = app.status === 'coming'
      ? `<p class="ik-soon"><b>Not connectable yet · ${esc(app.eta)}.</b> The wiring above is the plan, drawn dashed until it ships.</p>`
      : `<h4><b>Setup · about ${app.you} min of your time</b>${app.us ? `<span class="ik-lbl">then ${app.us} min on our side</span>` : ''}</h4>
         <div class="ik-time" aria-hidden="true">${app.setup.map((s) => `<i class="${s.who}" style="flex:${s.minutes}"></i>`).join('')}</div>
         <ol class="ik-steps">${app.setup.map((s, i) => `<li class="${s.who}"><span class="ik-lbl"><span class="ik-n">${String(i + 1).padStart(2, '0')} · </span><b>${s.minutes} min</b> · ${s.who === 'you' ? 'you' : 'us'}</span><span>${esc(s.step)}</span></li>`).join('')}</ol>`
    return `<div class="ik-sh">${app.mkL}<div><h3>${esc(D.brand)} + ${esc(app.name)}</h3><p>${esc(app.summary)}</p></div><div class="ik-sh-r">${chip(app.status)}${mode === 'phone' ? '' : cta}</div></div>
<div class="ik-diag"></div>${srTable(app)}
<div class="ik-setup"><div>${setup}</div>
<dl class="ik-terms"><div><dt class="ik-lbl">Built by</dt><dd>${esc(app.by)}</dd></div><div><dt class="ik-lbl">Plans</dt><dd>${esc(app.plans)}</dd></div><div><dt class="ik-lbl">If both change</dt><dd>${esc(app.conflict)}</dd></div><div><dt class="ik-lbl">Sync log</dt><dd>${esc(app.log)}</dd></div></dl></div>
${mode === 'phone' ? cta : ''}`
  }

  function drawDiagram(animate) {
    const app = byId[sel]
    const host = stage.querySelector('.ik-diag')
    const W = Math.floor(host.clientWidth)
    if (!W) return
    geo = mode === 'phone' ? phoneDiagram(app, W, all) : deskDiagram(app, W)
    host.innerHTML = geo.svg
    if (mode === 'phone' && app.flows.length > CAP) {
      const b = document.createElement('button')
      b.type = 'button'; b.className = 'ik-more-btn'
      b.setAttribute('aria-expanded', String(all))
      b.textContent = all ? 'Show fewer records' : `+${app.flows.length - CAP} more record${app.flows.length - CAP > 1 ? 's' : ''}`
      b.addEventListener('click', () => { all = !all; drawDiagram(false); stage.querySelector('.ik-more-btn')?.focus() })
      host.appendChild(b)
    }
    geo.svgEl = host.querySelector('svg')
    geo.pk = host.querySelector('.d-pks')
    geo.wireEls = [...host.querySelectorAll('.d-wire')]
    geo.labEls = [...host.querySelectorAll('.d-lab')]
    geo.swEls = [...host.querySelectorAll('.d-sw')]
    geo.swings = geo.swEls.length > 0
    geo.coming = app.status === 'coming'
    geo.pool = []
    if (animate && !reduce()) { drawAt = now(); drawn = true }
    else if (animate === null) { drawAt = Infinity; drawn = false } // waits to be seen
    else { drawAt = now() - 10; drawn = true }
    paint(now())
  }

  function render(animate) {
    const m = modeNow()
    if (m !== mode) { mode = m; place() }
    stage.innerHTML = stageHTML(byId[sel])
    stage.setAttribute('aria-labelledby', mode === 'phone' ? `ik-pb-${sel}` : `ik-tab-${sel}`)
    cache = new Map()
    drawDiagram(animate)
    for (const r of root.querySelectorAll('.ik-row')) r.classList.toggle('ik-cur', r.dataset.id === sel)
    settled(now())
  }

  /* ---------- tabs, the phone list and where the stage sits ---------- */
  const tabs = () => [...rail.querySelectorAll('.ik-tab')]
  function syncTabs() {
    for (const t of tabs()) { const on = t.dataset.app === sel; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1 }
    for (const b of root.querySelectorAll('.ik-pb')) { const on = b.dataset.app === sel; b.setAttribute('aria-expanded', String(on)); b.querySelector('.ik-tab-ct').textContent = on ? sub(byId[b.dataset.app]) : byId[b.dataset.app].category }
  }
  const sub = (a) => a.status === 'coming' ? a.eta : `← ${a.nIn} in · → ${a.nOut} out · ${a.you} min setup`
  let plist = null
  function buildPlist() {
    plist = document.createElement('div')
    plist.className = 'ik-plist'
    const ids = [...D.featured, ...(extra ? [extra] : [])]
    plist.innerHTML = ids.map((id) => { const a = byId[id]; return `<div class="ik-pi" data-app="${esc(id)}"><button type="button" class="ik-pb" id="ik-pb-${esc(id)}" data-app="${esc(id)}" aria-expanded="false" aria-controls="ik-stage">${a.mk}<span><span class="ik-tab-nm">${esc(a.name)}</span><span class="ik-tab-ct">${esc(a.category)}</span></span>${chip(a.status)}</button></div>` }).join('')
    railcol.after(plist)
    for (const b of plist.querySelectorAll('.ik-pb')) b.addEventListener('click', () => { if (b.dataset.app !== sel) choose(b.dataset.app, { focus: false }) })
  }
  function place() {
    if (mode === 'phone') {
      if (!plist) buildPlist()
      const pi = plist.querySelector(`.ik-pi[data-app="${sel}"]`) ?? plist.firstElementChild
      pi.appendChild(stage)
    } else if (stage.parentElement !== panel) railcol.after(stage)
    syncTabs()
  }
  function setExtra(id) {
    rail.querySelector('.ik-extra')?.remove()
    extra = D.featured.includes(id) ? null : id
    if (extra) {
      const a = byId[id]
      const b = document.createElement('button')
      b.type = 'button'; b.className = 'ik-tab ik-extra'; b.setAttribute('role', 'tab'); b.id = `ik-tab-${id}`; b.dataset.app = id; b.setAttribute('aria-controls', 'ik-stage')
      b.innerHTML = `<span class="ik-tab-mk">${a.mk}</span><span class="ik-tab-nm">${esc(a.name)}</span><span class="ik-tab-ct">From the directory</span>`
      rail.appendChild(b)
    }
    if (plist) { plist.remove(); plist = null; if (mode === 'phone') buildPlist() }
  }
  function choose(id, { focus = false, scroll = false } = {}) {
    if (!byId[id]) return
    if (!D.featured.includes(id) && extra !== id) setExtra(id)
    sel = id; all = false
    if (mode === 'phone') place()
    syncTabs()
    render(true)
    if (focus) rail.querySelector(`.ik-tab[data-app="${id}"]`)?.focus()
    if (scroll) (mode === 'phone' ? stage.parentElement : panel).scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' })
  }
  rail.addEventListener('click', (e) => { const t = e.target.closest('.ik-tab'); if (t && t.dataset.app !== sel) choose(t.dataset.app) })
  rail.addEventListener('keydown', (e) => {
    const list = tabs(), i = list.findIndex((t) => t.dataset.app === sel)
    const go = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key]
    if (go === undefined) return
    e.preventDefault()
    const t = list[(go + list.length) % list.length]
    choose(t.dataset.app, { focus: true })
  })
  root.addEventListener('click', (e) => {
    const a = e.target.closest('.ik-go')
    if (!a) return
    e.preventDefault()
    choose(a.dataset.app, { scroll: true })
    stage.focus({ preventScroll: true })
  })

  /* ---------- painting: draw-in, switches, packets ---------- */
  const packetPositions = (w, e) => {
    // emissions every w.interval s since the wires finished drawing; constant speed
    const cross = w.len / D.speed
    const out = []
    if (e < 0) return out
    // each wire starts a little later than the one above, so packets never march in step
    const o = (w.i * 0.37) % w.interval
    const kMax = Math.floor((e - o) / w.interval), kMin = Math.max(0, Math.ceil((e - o - cross) / w.interval))
    for (let k = kMin; k <= kMax; k++) {
      const u = (e - o - k * w.interval) / cross
      if (u >= 0 && u <= 1) out.push({ u, k, rev: w.dir === 'both' && k % 2 === 1 })
    }
    return out
  }
  let visible = REC
  function paint(t) {
    if (!geo || !geo.svgEl) return
    const r = reduce()
    geo.wireEls.forEach((el, i) => {
      if (geo.coming) return
      const p = r ? 1 : ease((t - drawAt - i * STAG) / DRAW)
      el.setAttribute('stroke-dashoffset', String(geo.wires[i].len * (1 - p)))
    })
    geo.labEls.forEach((el, i) => { const p = r ? 1 : Math.min(Math.max((t - drawAt - i * STAG - DRAW * 0.45) / 0.22, 0), 1); el.style.opacity = String(p) })
    const sw0 = wiresDone()
    geo.swEls.forEach((el) => {
      const p = r ? 1 : ease((t - sw0) / SWING)
      const a = (mode === 'phone' ? -32 : 30) * p
      el.setAttribute('transform', `rotate(${a.toFixed(2)} ${el.dataset.cx} ${el.dataset.cy})`)
    })
    // packets
    let html = ''
    if (!geo.coming) for (const w of geo.wires) {
      const list = r ? (drawn ? [{ u: 1 / 3, rev: false }] : []) : packetPositions(w, t - sw0)
      for (const { u, rev } of list) {
        const f = rev ? 1 - u : u
        if (w.axis === 'x') { const x = w.x1 + (w.x2 - w.x1) * f; html += `<rect class="d-pk" data-i="${w.i}" x="${(x - 8).toFixed(1)}" y="${w.y - 3.5}" width="16" height="7" rx="3.5"/>` }
        else { const y = w.y1 + (w.y2 - w.y1) * f; html += `<rect class="d-pk" data-i="${w.i}" x="${w.x - 3.5}" y="${(y - 8).toFixed(1)}" width="7" height="16" rx="3.5"/>` }
      }
    }
    if (geo.pk.innerHTML !== html) geo.pk.innerHTML = html
  }

  /* ---------- directory: search, filters, FLIP ---------- */
  const rows = [...root.querySelectorAll('.ik-row')]
  const q = root.querySelector('#ik-q')
  const live = root.querySelector('.ik-live')
  const empty = root.querySelector('.ik-empty')
  const noItems = [...root.querySelectorAll('.ik-no li')]
  const F = { cat: '', status: '', q: '' }
  const anims = new Map()
  const match = (r, f) => (!f.cat || r.dataset.cat === f.cat) && (!f.status || r.dataset.status === f.status) && (!f.q || f.q.split(/\s+/).every((w) => r.dataset.q.includes(w)))
  function filter(animate = true) {
    const before = new Map()
    const anim = animate && !reduce()
    if (anim) for (const r of rows) if (!r.hidden) before.set(r, r.getBoundingClientRect().top)
    let n = 0
    for (const r of rows) { const on = match(r, F); r.hidden = !on; if (on) n++ }
    // counts follow the other filters, so each chip says what pressing it gives
    for (const b of root.querySelectorAll('.ik-f[data-cat]')) {
      const k = b.dataset.cat
      b.querySelector('[data-n]').textContent = rows.filter((r) => match(r, { ...F, cat: k })).length
      b.setAttribute('aria-pressed', String(F.cat === k))
    }
    for (const b of root.querySelectorAll('.ik-f[data-status]')) {
      b.querySelector('[data-n]').textContent = rows.filter((r) => match(r, { ...F, status: b.dataset.status })).length
      b.setAttribute('aria-pressed', String(F.status === b.dataset.status))
    }
    const total = rows.length
    const bits = [F.cat, F.status && STATUS[F.status], F.q && `“${F.q}”`].filter(Boolean)
    live.textContent = bits.length ? `Showing ${n} of ${total} · ${bits.join(' · ')}` : `Showing all ${total}`
    noItems.forEach((li) => li.classList.remove('ik-hit'))
    if (!n) {
      const qq = F.q.trim()
      const hit = qq && D.unsupported.findIndex((u) => u.k.includes(qq) || u.k.split(/\s+/).some((w) => w.length > 2 && qq.includes(w)))
      let h = qq ? `<p>Nothing here matches “${esc(qq)}”.</p>` : `<p>No ${esc(F.status ? STATUS[F.status].toLowerCase() : '')} integrations${F.cat ? ` in ${esc(F.cat)}` : ''} yet.</p>`
      if (qq && hit >= 0) {
        const u = D.unsupported[hit]
        h = `<p><strong>We don’t support ${esc(u.what.charAt(0).toLowerCase() + u.what.slice(1))}.</strong> ${esc(u.why)}</p><p class="ik-instead">${esc(u.instead)}</p>`
        noItems[hit]?.classList.add('ik-hit')
      }
      empty.innerHTML = `<div>${h}</div><div class="ik-acts"><button type="button" class="ik-clear">Clear ${qq ? 'search' : 'filters'}</button><a href="${esc(D.request.href)}">${esc(D.request.label)}</a></div>`
      empty.querySelector('.ik-clear').addEventListener('click', () => { F.q = ''; F.cat = ''; F.status = ''; q.value = ''; filter(); q.focus() })
      empty.hidden = false
    } else empty.hidden = true
    if (anim) {
      const t = now()
      for (const r of rows) {
        if (r.hidden) { anims.delete(r); r.style.transform = ''; r.style.opacity = ''; continue }
        const b = before.get(r)
        if (b === undefined) anims.set(r, { t, dy: 0, fade: true })
        else { const dy = b - r.getBoundingClientRect().top; if (Math.abs(dy) > 0.5) anims.set(r, { t, dy, fade: false }) }
      }
      tickRows(t)
    }
    settled(now())
  }
  const FLIP = 0.26, FADE = 0.2
  function tickRows(t) {
    for (const [r, a] of anims) {
      const p = ease((t - a.t) / FLIP)
      if (a.fade) { const o = Math.min(Math.max((t - a.t - 0.06) / FADE, 0), 1); r.style.opacity = String(o); if (o >= 1) { r.style.opacity = ''; anims.delete(r) } }
      else { r.style.transform = p >= 1 ? '' : `translateY(${(a.dy * (1 - p)).toFixed(2)}px)`; if (p >= 1) anims.delete(r) }
    }
  }
  q.addEventListener('input', () => { F.q = q.value.trim().toLowerCase(); filter() })
  q.addEventListener('keydown', (e) => { if (e.key === 'Escape' && q.value) { q.value = ''; F.q = ''; filter() } })
  for (const b of root.querySelectorAll('.ik-f[data-cat]')) b.addEventListener('click', () => { F.cat = b.dataset.cat; filter() })
  for (const b of root.querySelectorAll('.ik-f[data-status]')) b.addEventListener('click', () => { F.status = F.status === b.dataset.status ? '' : b.dataset.status; filter() })

  /* ---------- the loop ---------- */
  function settled(t) {
    const busy = (geo && drawn && t < drawEnd()) || anims.size > 0 || (geo && !drawn && visible)
    if (busy) root.removeAttribute('data-settled'); else root.setAttribute('data-settled', '')
  }
  function frame() {
    const t = now()
    if (visible) paint(t)
    tickRows(t)
    settled(t)
    if (!REC) requestAnimationFrame(frame)
  }

  /* ---------- the recorder's script ---------- */
  const F0 = D.featured[0], F1 = D.featured[1], F2 = D.featured[2]
  const nW = (id) => byId[id].flows.length
  const dEnd = (at, id) => at + STAG * (nW(id) - 1) + DRAW + (byId[id].stays.length ? SWING : 0)
  const S = {
    events: [
      { at: 0.4, sel: F0 }, { at: 5.0, sel: F1 }, { at: 9.6, sel: F2 },
      { at: 14.9, status: 'native' }, { at: 16.7, status: '', q: 'p' }, { at: 16.85, q: 'pa' }, { at: 17.0, q: 'pay' }, { at: 19.0, q: 'crypto' },
    ],
    moves: [[1.6, 2.6, 'panel'], [13.6, 14.6, 'dir'], [21.0, 22.0, 'no']],
    length: 23.5,
  }
  // the last search asks for something the product does not do, in the words a person would type
  S.events[7].q = (D.unsupported.find((u) => !rows.some((r) => r.dataset.q.includes(u.kw))) ?? D.unsupported[0]).kw
  // the typed search: a category word, typed in three keystrokes
  const typed = (byId[D.featured[3]] ?? D.apps[0]).category.toLowerCase().split(' ').find((w) => w.length > 3) ?? 'stock'
  S.events[4].q = typed.slice(0, 2); S.events[5].q = typed.slice(0, 4); S.events[6].q = typed
  const targets = () => {
    const top = (el) => el.getBoundingClientRect().top + scrollY
    const max = document.documentElement.scrollHeight - innerHeight
    const at = (el, off) => Math.max(0, Math.min(max, Math.round(top(el) - off)))
    return { top: 0, panel: at(mode === 'phone' ? root.querySelector('.ik-plist') : panel, mode === 'phone' ? 12 : 24), dir: at(root.querySelector('.ik-dir'), 24), no: at(root.querySelector('.ik-no'), 40) }
  }
  function scrollAt(t) {
    const tg = targets()
    let from = 'top'
    for (const [a, b, to] of S.moves) {
      if (t < a) return tg[from]
      if (t < b) return tg[from] + (tg[to] - tg[from]) * (0.5 - Math.cos(Math.PI * (t - a) / (b - a)) / 2)
      from = to
    }
    return tg[from]
  }
  let applied = 0
  function seek(t) {
    while (applied < S.events.length && S.events[applied].at <= t) {
      const ev = S.events[applied++]
      clock = ev.at
      if (ev.sel) { if (ev.sel === sel && !drawn) { drawAt = ev.at; drawn = true } else choose(ev.sel) }
      if (ev.status !== undefined) F.status = ev.status
      if (ev.q !== undefined) { F.q = ev.q; q.value = ev.q }
      if (ev.status !== undefined || ev.q !== undefined) filter()
    }
    clock = t
    scrollTo(0, scrollAt(t))
    paint(t); tickRows(t); settled(t)
  }
  function moments() {
    const f = (id, at) => dEnd(at, id)
    const st = [
      { what: `${byId[F0].name} wired`, from: Math.max(f(F0, 0.4), 2.6), to: 5.0 },
      { what: `${byId[F1].name} wired`, from: f(F1, 5.0), to: 9.6 },
      { what: `${byId[F2].name} wired`, from: f(F2, 9.6), to: 13.6 },
      { what: 'Directory, Native only', from: 14.9 + FLIP + 0.1, to: 16.7 },
      { what: `Directory, search "${S.events[6].q}"`, from: 17.0 + FLIP + 0.1, to: 19.0 },
      { what: 'Directory, an unsupported search', from: 19.0 + FLIP + 0.1, to: 21.0 },
      { what: 'Not supported list', from: 22.0, to: S.length },
    ].map((x) => ({ ...x, from: Math.round(x.from * 100) / 100 }))
    return { stretches: st, end: S.length }
  }

  /* ---------- start ---------- */
  let started = false
  function start() {
    if (started) return
    started = true
    mode = modeNow(); place()
    render(REC ? null : null)
    if (!REC) {
      const io = new IntersectionObserver((es) => {
        for (const e of es) {
          visible = e.isIntersecting
          if (visible && !drawn) { drawAt = reduce() ? now() - 10 : now(); drawn = true }
        }
      }, { threshold: 0.2 })
      io.observe(stage.parentElement === panel ? panel : root.querySelector('.ik-panel'))
      requestAnimationFrame(frame)
    } else { visible = true; settled(0) }
    let w = innerWidth
    addEventListener('resize', () => {
      if (Math.abs(innerWidth - w) < 1) return
      w = innerWidth
      const m = modeNow()
      if (m !== mode) { mode = m; place(); render(false) } else { cache = new Map(); drawDiagram(false) }
    })
    filter(false)
  }
  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { start(); return true })

  window.IntegrationsKit = {
    ready,
    get length() { return S.length },
    seek, moments,
    select: (id) => choose(id),
    selected: () => sel,
    mode: () => mode,
    layout: () => { cache = new Map(); drawDiagram(false) },
    packets: () => (geo ? geo.wires.map((w) => ({ record: w.record, seconds: w.seconds, interval: w.interval, len: w.len, crossing: w.len / D.speed })) : []),
    positions: (i, e) => packetPositions(geo.wires[i], e).map((p) => ({ k: p.k, u: p.u })),
    rules: () => ({ speed: D.speed, tiers: D.tiers }),
    filter: (f) => { Object.assign(F, f); if (f.q !== undefined) q.value = f.q; filter() },
    state: () => ({ ...F }),
  }
})()
