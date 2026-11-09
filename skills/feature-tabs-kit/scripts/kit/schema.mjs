// Feature Tabs Kit: reads features.json, lists every problem at once, and
// works out the numbers the page shows (totals, matched counts, the selected
// rate) so a page can't say one thing in one view and another in the next.

export const DISPLAYS = {
  newsreader: { family: "'Newsreader', Georgia, serif", weight: 400, track: '-0.015em', turn: 'italic', google: 'family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400' },
  fraunces: { family: "'Fraunces', Georgia, serif", weight: 400, track: '-0.02em', turn: 'italic', google: 'family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400' },
  schibsted: { family: "'Schibsted Grotesk', system-ui, sans-serif", weight: 700, track: '-0.035em', turn: 'colour', google: 'family=Schibsted+Grotesk:wght@400;500;600;700' },
  bricolage: { family: "'Bricolage Grotesque', system-ui, sans-serif", weight: 700, track: '-0.03em', turn: 'colour', google: 'family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700' },
}
export const TEXTS = {
  'public-sans': { family: "'Public Sans', system-ui, sans-serif", google: 'family=Public+Sans:wght@400;500;600' },
  schibsted: { family: "'Schibsted Grotesk', system-ui, sans-serif", google: 'family=Schibsted+Grotesk:wght@400;500;600;700' },
  hanken: { family: "'Hanken Grotesk', system-ui, sans-serif", google: 'family=Hanken+Grotesk:wght@400;500;600' },
}
export const MONOS = {
  jetbrains: { family: "'JetBrains Mono', ui-monospace, monospace", google: 'family=JetBrains+Mono:wght@400;500' },
  plex: { family: "'IBM Plex Mono', ui-monospace, monospace", google: 'family=IBM+Plex+Mono:wght@400;500' },
}
export const VIEW_TYPES = ['list', 'compare', 'chart', 'message', 'form', 'choice', 'code', 'timeline']

// ---------- colour ----------
export const hex = (c) => /^#[0-9a-f]{6}$/i.test(c ?? '')
const ch = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
export const rgb = (c) => ch(c).join(',')
export function lum(c) {
  const [r, g, b] = ch(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
export const mix = (a, b, t) => '#' + ch(a).map((v, i) => Math.round(v + (ch(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')

// ---------- money ----------
export function moneyOf(o, money) {
  const currency = o.currency ?? money?.currency ?? 'USD'
  const locale = o.locale ?? money?.locale ?? 'en-US'
  return new Intl.NumberFormat(locale, { style: 'currency', currency })
}
/** The amount as the page writes it: "+£6,214.35" for money in, "£1,850.00" for money out. */
export function fmt(o, money, signed = true) {
  const s = moneyOf(o, money).format(Math.abs(o.amount))
  return signed && o.flow === 'in' ? '+' + s : s
}
/** A bank line's raw amount: "+6214.35" or "−1850.00" (a real minus). */
export const raw = (o) => (o.flow === 'in' ? '+' : '−') + Math.abs(o.amount).toFixed(2)
const cents = (n) => Math.round(n * 100)

// ---------- validation ----------
const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && (!max || v.length <= max)

export function validate(c) {
  const P = []
  const W = []
  const need = (ok, path, msg) => { if (!ok) P.push(`${path}: ${msg}`) }
  if (!c || typeof c !== 'object') return { problems: ['the file is not a JSON object'], warnings: [] }

  // theme
  const t = c.theme ?? {}
  need(['light', 'dark'].includes(t.mode), 'theme.mode', 'must be "light" or "dark"')
  for (const k of ['bg', 'ink', 'mute', 'rule', 'sheet', 'sheetInk', 'sheetMute', 'sheetRule', 'accent', 'onAccent', 'accent2', 'ok'])
    need(hex(t[k]), `theme.${k}`, `must be a #rrggbb colour (got ${JSON.stringify(t[k])})`)
  need(DISPLAYS[t.display], 'theme.display', `one of ${Object.keys(DISPLAYS).join(', ')}`)
  need(TEXTS[t.text], 'theme.text', `one of ${Object.keys(TEXTS).join(', ')}`)
  need(MONOS[t.mono], 'theme.mono', `one of ${Object.keys(MONOS).join(', ')}`)
  if (t.radius !== undefined) need(Number.isFinite(t.radius) && t.radius >= 0 && t.radius <= 14, 'theme.radius', '0 to 14')
  if (t.railSide !== undefined) need(['left', 'right'].includes(t.railSide), 'theme.railSide', '"left" or "right"')
  if (t.stage !== undefined) need(['plate', 'shadow'].includes(t.stage), 'theme.stage', '"plate" or "shadow"')
  if (P.length === 0) {
    const pairs = [['ink', 'bg', 4.5], ['mute', 'bg', 4.5], ['sheetInk', 'sheet', 4.5], ['sheetMute', 'sheet', 4.5], ['onAccent', 'accent', 4.5], ['accent', 'sheet', 4.5], ['ok', 'sheet', 4.5], ['accent', 'bg', 3]]
    for (const [a, b, n] of pairs) {
      const r = contrast(t[a], t[b])
      need(r >= n, `theme.${a}`, `${r.toFixed(2)}:1 on theme.${b}, needs ${n}:1`)
    }
  }
  if (c.money !== undefined) {
    need(/^[A-Z]{3}$/.test(c.money.currency ?? ''), 'money.currency', 'a 3-letter ISO code such as GBP or EUR')
    need(str(c.money.locale), 'money.locale', 'a locale such as en-GB')
  }

  // header
  const h = c.header ?? {}
  need(str(h.eyebrow, 48), 'header.eyebrow', '1 to 48 characters')
  need(str(h.headline, 72), 'header.headline', '1 to 72 characters ("\\n" breaks the line, _one turn_ in the accent)')
  if (str(h.headline)) need((h.headline.match(/_/g) ?? []).length <= 2, 'header.headline', 'at most one _turn_')
  need(str(h.lede, 200), 'header.lede', '1 to 200 characters')

  // objects
  const objs = new Map()
  need(Array.isArray(c.objects) && c.objects.length >= 2 && c.objects.length <= 12, 'objects', '2 to 12 shared objects')
  for (const [i, o] of (c.objects ?? []).entries()) {
    const p = `objects[${i}]`
    need(/^[a-z][a-z0-9-]{0,23}$/.test(o.id ?? ''), `${p}.id`, 'lowercase letters, digits and dashes, starting with a letter')
    if (objs.has(o.id)) P.push(`${p}.id: "${o.id}" is used twice`)
    objs.set(o.id, o)
    const isMoney = o.amount !== undefined
    need(isMoney || str(o.text, 64), p, 'needs "amount" (a number) or "text" (1 to 64 characters)')
    if (isMoney) {
      need(Number.isFinite(o.amount) && o.amount >= 0, `${p}.amount`, 'a number, 0 or more (direction goes in "flow")')
      if (o.flow !== undefined) need(['in', 'out'].includes(o.flow), `${p}.flow`, '"in" or "out"')
      if (o.label !== undefined) need(str(o.label, 32), `${p}.label`, '1 to 32 characters')
      if (o.tag !== undefined) need(str(o.tag, 16), `${p}.tag`, '1 to 16 characters')
      if (o.currency !== undefined) need(/^[A-Z]{3}$/.test(o.currency), `${p}.currency`, 'a 3-letter ISO code')
    }
  }
  const ref = (id, path, kind) => {
    const o = objs.get(id)
    if (!o) { P.push(`${path}: no object with id "${id}"`); return null }
    if (kind === 'money' && o.amount === undefined) { P.push(`${path}: "${id}" has no amount`); return null }
    if (kind === 'label' && !o.label) { P.push(`${path}: "${id}" needs a label`); return null }
    return o
  }

  // stage
  const s = c.stage ?? {}
  need(str(s.name, 44), 'stage.name', 'the document name in the stage bar, 1 to 44 characters')

  // features
  const F = c.features ?? []
  need(Array.isArray(F) && F.length >= 3 && F.length <= 6, 'features', '3 to 6 features')
  const numbers = {}
  if (s.states !== undefined) need(Array.isArray(s.states) && s.states.length === F.length && s.states.every((x) => str(x?.text ?? x, 24)), 'stage.states', `one state (1 to 24 characters) per feature (${F.length})`)
  for (const [i, f] of F.entries()) {
    const p = `features[${i}]`
    need(str(f.title, 20), `${p}.title`, '1 to 20 characters')
    need(str(f.claim, 150), `${p}.claim`, '1 to 150 characters')
    need(str(f.caption, 130), `${p}.caption`, '1 to 130 characters: what the stage shows, as a figure caption')
    if (f.crumb !== undefined) need(str(f.crumb, 12), `${p}.crumb`, '1 to 12 characters')
    need(f.proof && str(f.proof.label, 34) && (str(f.proof.value, 10) || f.proof.from), `${p}.proof`, '{ "value" (1 to 10) or "from", "label" (1 to 34) }')
    const v = f.view ?? {}
    need(VIEW_TYPES.includes(v.type), `${p}.view.type`, `one of ${VIEW_TYPES.join(', ')}`)
    const n = viewChecks(v, `${p}.view`, { need, ref, P, W, objs, money: c.money })
    f._n = n
    if (f.proof?.from) {
      const got = n?.[f.proof.from]
      if (got === undefined) P.push(`${p}.proof.from: "${f.proof.from}" is not something the ${v.type} view counts (it has: ${Object.keys(n ?? {}).join(', ') || 'nothing'})`)
      else if (f.proof.value !== undefined && f.proof.value !== got) P.push(`${p}.proof.value: says "${f.proof.value}" but the ${v.type} view works out "${got}"`)
      else f.proof.value = got
    }
    Object.assign(numbers, n)
  }
  // neighbours that share nothing cross-fade instead of morphing
  if (P.length === 0)
    F.forEach((f, i) => {
      const g = F[(i + 1) % F.length]
      const a = new Set(keysOf(f.view)), b = keysOf(g.view)
      if (!b.some((k) => a.has(k))) W.push(`features[${i}] → features[${(i + 1) % F.length}]: the two views share no object, so this switch will fade instead of moving the same things`)
    })

  const tour = c.tour ?? {}
  if (tour.seconds !== undefined) need(Number.isFinite(tour.seconds) && tour.seconds >= 4 && tour.seconds <= 15, 'tour.seconds', '4 to 15')
  if (tour.auto !== undefined) need(typeof tour.auto === 'boolean', 'tour.auto', 'true or false')
  for (const k of ['running', 'stopped', 'paused']) if (tour[k] !== undefined) need(str(tour[k], 40), `tour.${k}`, '1 to 40 characters')

  // every link in the config stays on an example domain or the buyer's own
  const links = JSON.stringify(c).match(/https?:\/\/[^"\s]+/g) ?? []
  for (const u of links) if (/https?:\/\/(www\.)?(google|apple|maps|play)\./.test(u)) P.push(`a link to ${u}: use your own domain or <brand>.example`)
  return { problems: P, warnings: W, numbers }
}

/** The object keys a view shows ("pay.label", "price.amount", …), for the shared-atom warning. */
export function keysOf(v) {
  const out = []
  const add = (id, part) => id && out.push(`${id}.${part}`)
  const m = (id) => { add(id, 'label'); add(id, 'amount') }
  switch (v.type) {
    case 'list': v.rows?.forEach((r) => { m(r.obj); add(r.obj, 'tag') }); break
    case 'compare': v.rows?.forEach((r) => { if (!r.open) add(r.obj, 'label'); add(r.obj, 'amount') }); break
    case 'chart': v.groups?.forEach((g) => g.objects?.forEach(m)); break
    case 'message': v.lines?.forEach(m); break
    case 'form': v.fields?.forEach((f) => add(f.obj, 'text')); break
    case 'choice': add(v.route?.chip, 'text'); v.options?.forEach((o) => { add(o.obj, 'text'); add(o.priceObj, 'amount') }); break
    case 'code': [...(v.request?.fields ?? []), ...(v.response?.fields ?? [])].forEach((f) => f.obj && add(f.obj, partOf(f.obj, v._objs))); break
    case 'timeline': add(v.head?.obj, 'text'); add(v.head?.sub, 'text'); add(v.head?.paid, 'amount'); v.events?.forEach((e) => add(e.obj, 'text')); break
  }
  return out
}
const partOf = (id, objs) => (objs?.get(id)?.amount !== undefined ? 'amount' : 'text')

function viewChecks(v, p, { need, ref, P, W, objs, money }) {
  v._objs = objs
  const arr = (x, lo, hi, path) => { const ok = Array.isArray(x) && x.length >= lo && x.length <= hi; need(ok, path, `${lo} to ${hi} items`); return ok ? x : [] }
  const n = {}
  switch (v.type) {
    case 'list': {
      if (v.columns !== undefined) need(Array.isArray(v.columns) && v.columns.length === 3 && v.columns.every((x) => str(x, 16)), `${p}.columns`, '3 headings (item, tag, amount), 1 to 16 characters each')
      for (const [i, r] of arr(v.rows, 2, 7, `${p}.rows`).entries()) {
        ref(r.obj, `${p}.rows[${i}].obj`, 'label') && ref(r.obj, `${p}.rows[${i}].obj`, 'money')
        if (r.sub !== undefined) need(str(r.sub, 32), `${p}.rows[${i}].sub`, '1 to 32 characters')
      }
      n.rows = String(v.rows?.length ?? 0)
      break
    }
    case 'compare': {
      need(str(v.left, 18) && str(v.right, 18), p, '"left" and "right" column headings, 1 to 18 characters')
      const rows = arr(v.rows, 2, 7, `${p}.rows`)
      for (const [i, r] of rows.entries()) {
        ref(r.obj, `${p}.rows[${i}].obj`, 'money')
        need(str(r.raw, 22), `${p}.rows[${i}].raw`, 'the raw bank line, 1 to 22 characters')
        if (r.open !== undefined) need(str(r.open, 20), `${p}.rows[${i}].open`, 'the unmatched label, 1 to 20 characters')
      }
      const matched = rows.filter((r) => !r.open).length
      n.matched = `${matched} of ${rows.length}`
      need(str(v.summary, 60), `${p}.summary`, 'the line beside the count, 1 to 60 characters')
      break
    }
    case 'chart': {
      need(v.total && str(v.total.label, 28), `${p}.total.label`, '1 to 28 characters')
      const groups = arr(v.groups, 1, 3, `${p}.groups`)
      let inn = 0, out = 0, cur = null
      for (const [i, g] of groups.entries()) {
        need(str(g.label, 18), `${p}.groups[${i}].label`, '1 to 18 characters')
        for (const [j, id] of arr(g.objects, 1, 6, `${p}.groups[${i}].objects`).entries()) {
          const o = ref(id, `${p}.groups[${i}].objects[${j}]`, 'money')
          if (!o) continue
          if (o.flow === 'in') inn += cents(o.amount); else out += cents(o.amount)
          cur ??= o
        }
      }
      if (cur) {
        const f = moneyOf(cur, money)
        const net = (inn - out) / 100
        n.net = f.format(net)
        n.in = f.format(inn / 100)
        n.out = f.format(out / 100)
        n.netWhole = new Intl.NumberFormat(f.resolvedOptions().locale, { style: 'currency', currency: f.resolvedOptions().currency, maximumFractionDigits: 0 }).format(Math.trunc(net))
        n.share = inn ? String(Math.round(((inn - out) / inn) * 100)) : '0'
        if (v.total?.expect !== undefined && v.total.expect !== n.net) P.push(`${p}.total.expect: says ${v.total.expect} but the objects add up to ${n.net} (in ${n.in}, out ${n.out})`)
      }
      if (v.total?.note !== undefined) need(str(v.total.note, 60), `${p}.total.note`, '1 to 60 characters; {in}, {out}, {net} and {share} are filled in')
      if (v.net !== undefined) need(str(v.net, 14), `${p}.net`, 'the label of the net row, 1 to 14 characters')
      break
    }
    case 'message': {
      need(str(v.to, 48) && str(v.subject, 60) && str(v.body, 200), p, '"to" (1 to 48), "subject" (1 to 60) and "body" (1 to 200)')
      for (const [i, id] of arr(v.lines, 1, 7, `${p}.lines`).entries()) ref(id, `${p}.lines[${i}]`, 'label') && ref(id, `${p}.lines[${i}]`, 'money')
      if (v.attachment !== undefined) need(str(v.attachment.name, 32) && str(v.attachment.kind, 4), `${p}.attachment`, '{ "name" (1 to 32), "kind" (1 to 4, e.g. CSV) }')
      for (const [i, s] of (v.steps ?? []).entries()) need(str(s.title, 24) && str(s.meta, 24), `${p}.steps[${i}]`, '{ "title", "meta" }, 1 to 24 characters each')
      break
    }
    case 'form': {
      for (const [i, f] of arr(v.fields, 1, 6, `${p}.fields`).entries()) {
        need(str(f.label, 20), `${p}.fields[${i}].label`, '1 to 20 characters')
        const o = ref(f.obj, `${p}.fields[${i}].obj`)
        if (o && o.text === undefined) P.push(`${p}.fields[${i}].obj: "${f.obj}" needs "text"`)
      }
      if (v.segment) {
        need(Array.isArray(v.segment.options) && v.segment.options.length >= 2 && v.segment.options.length <= 4, `${p}.segment.options`, '2 to 4 options')
        need(Number.isInteger(v.segment.selected) && v.segment.selected >= 0 && v.segment.selected < (v.segment.options?.length ?? 0), `${p}.segment.selected`, 'the index of the selected option')
      }
      need(str(v.button, 20), `${p}.button`, '1 to 20 characters')
      break
    }
    case 'choice': {
      const opts = arr(v.options, 2, 5, `${p}.options`)
      const sel = opts.filter((o) => o.selected)
      need(sel.length === 1, `${p}.options`, 'exactly one option has "selected": true')
      need(Number.isInteger(v.scale?.steps) && v.scale.steps >= 2 && v.scale.steps <= 10 && str(v.scale.min, 10) && str(v.scale.max, 10), `${p}.scale`, '{ "steps" 2 to 10, "min", "max" labels }')
      for (const [i, o] of opts.entries()) {
        need(Number.isFinite(o.price) && o.price >= 0, `${p}.options[${i}].price`, 'a number')
        need(Number.isInteger(o.days) && o.days >= 1 && o.days <= (v.scale?.steps ?? 10), `${p}.options[${i}].days`, `a whole number from 1 to scale.steps`)
        need(str(o.sub, 34), `${p}.options[${i}].sub`, '1 to 34 characters')
        if (o.obj) { const x = ref(o.obj, `${p}.options[${i}].obj`); if (x && x.text === undefined) P.push(`${p}.options[${i}].obj: "${o.obj}" needs "text"`) }
        else need(str(o.label, 24), `${p}.options[${i}].label`, '1 to 24 characters (or "obj")')
      }
      if (sel.length === 1) {
        const s = sel[0]
        const po = s.priceObj ? ref(s.priceObj, `${p}.options (selected).priceObj`, 'money') : null
        if (!s.priceObj) P.push(`${p}.options: the selected option needs "priceObj", the object the other views show its price with`)
        if (po && cents(po.amount) !== cents(s.price)) P.push(`${p}.options: the selected option costs ${s.price} but "${s.priceObj}" is ${po.amount}; the code and tracking views would disagree with the rates`)
        if (po) n.selected = moneyOf(po, money).format(s.price)
      }
      n.options = String(opts.length)
      if (v.route?.chip) { const x = ref(v.route.chip, `${p}.route.chip`); if (x && x.text === undefined) P.push(`${p}.route.chip: "${v.route.chip}" needs "text" (value and unit together, e.g. "2.4 kg")`) }
      need(str(v.route?.from, 20) && str(v.route?.to, 24), `${p}.route`, '{ "from", "to", "chip"? }')
      need(str(v.button, 20), `${p}.button`, '1 to 20 characters')
      break
    }
    case 'code': {
      need(str(v.request?.method, 7) && str(v.request?.path, 40), `${p}.request`, '{ "method", "path", "fields" }')
      for (const [i, f] of arr(v.request?.fields, 1, 8, `${p}.request.fields`).entries()) {
        need(/^[a-z_][a-z0-9_]{0,15}$/.test(f.key ?? ''), `${p}.request.fields[${i}].key`, 'a JSON key, lowercase')
        if (f.obj) ref(f.obj, `${p}.request.fields[${i}].obj`); else need(str(f.value, 48), `${p}.request.fields[${i}]`, '"obj" or "value"')
      }
      need(str(v.response?.status, 20), `${p}.response.status`, 'e.g. "201 Created"')
      for (const [i, f] of arr(v.response?.fields, 1, 5, `${p}.response.fields`).entries()) {
        need(/^[a-z_][a-z0-9_]{0,15}$/.test(f.key ?? ''), `${p}.response.fields[${i}].key`, 'a JSON key, lowercase')
        if (f.obj) ref(f.obj, `${p}.response.fields[${i}].obj`); else need(str(f.value, 56), `${p}.response.fields[${i}]`, '"obj" or "value"')
      }
      if (v.tabs !== undefined) need(Array.isArray(v.tabs) && v.tabs.length <= 5 && v.tabs.every((x) => str(x, 10)), `${p}.tabs`, 'up to 5 language names')
      break
    }
    case 'timeline': {
      const hd = v.head ?? {}
      need(str(hd.label, 16), `${p}.head.label`, '1 to 16 characters')
      ref(hd.obj, `${p}.head.obj`)
      if (hd.sub) ref(hd.sub, `${p}.head.sub`)
      if (hd.paid) ref(hd.paid, `${p}.head.paid`, 'money')
      need(str(hd.asideLabel, 16) && str(hd.aside, 16), `${p}.head`, '"asideLabel" and "aside" (e.g. Arrives / Thu 10 Apr), 1 to 16 characters each')
      const ev = arr(v.events, 2, 7, `${p}.events`)
      for (const [i, e] of ev.entries()) {
        need(/^[a-z_.]{1,24}$/.test(e.event ?? ''), `${p}.events[${i}].event`, 'an event name such as in_transit')
        need(['done', 'now', 'next'].includes(e.state), `${p}.events[${i}].state`, '"done", "now" or "next"')
        if (e.obj) ref(e.obj, `${p}.events[${i}].obj`); else need(str(e.place, 34), `${p}.events[${i}].place`, '1 to 34 characters (or "obj")')
      }
      need(ev.filter((e) => e.state === 'now').length <= 1, `${p}.events`, 'at most one "now"')
      n.events = String(ev.length)
      break
    }
  }
  return n
}
