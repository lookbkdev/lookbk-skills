// Feature Tabs Kit: draws each feature's view as real HTML from the config.
// Every object the views share is written as an atom,
//   <span class="ftk-k" data-k="flour.amount">£412.80</span>
// with the same text everywhere it appears, so the runtime can move it from
// where it was to where it goes when the tab changes. Anything else in a view
// (a bank line, a bar, a total) is new to that view and fades in.
import { fmt, raw } from './schema.mjs'

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function views(c, numbers) {
  const objs = new Map(c.objects.map((o) => [o.id, o]))
  const O = (id) => objs.get(id)
  const k = (id, part, cls = '') => {
    const o = O(id)
    const text = part === 'amount' ? fmt(o, c.money) : part === 'label' ? o.label : part === 'tag' ? o.tag : o.text
    const tone = part === 'amount' && o.flow === 'in' ? ' ftk-pos' : ''
    return `<span class="ftk-k${tone}${cls ? ' ' + cls : ''}" data-k="${esc(id)}.${part}">${esc(text)}</span>`
  }
  const fill = (s, n) => String(s).replace(/\{(in|out|net|share)\}/g, (_, x) => n[x] ?? '')
  const L = (s, cls = '') => `<span class="ftk-label${cls ? ' ' + cls : ''}">${esc(s)}</span>`

  const draw = {
    list(v) {
      const [a, b, d] = v.columns ?? ['Item', 'Tag', 'Amount']
      return `<div class="ftk-hd ftk-e">${L('')}${L(a)}${L(b, 'ftk-hide-phone')}${L(d, 'ftk-end')}</div><div class="ftk-fill">` +
        v.rows.map((r) => `<div class="ftk-row${r.live ? ' ftk-live' : ''}"><span class="ftk-rcpt ftk-e" aria-hidden="true"></span><span class="ftk-who">${k(r.obj, 'label', 'ftk-name')}${r.sub ? `<span class="ftk-sub ftk-mono ftk-e">${esc(r.sub)}</span>` : ''}</span><span class="ftk-tagc ftk-hide-phone">${O(r.obj).tag ? k(r.obj, 'tag', 'ftk-chip') : ''}</span><span class="ftk-end">${k(r.obj, 'amount', 'ftk-num')}</span></div>`).join('') + `</div>`
    },
    compare(v, f) {
      return `<div class="ftk-sum ftk-e"><b class="ftk-big">${esc(f._n.matched)}</b><span>${esc(v.summary)}</span></div>
<div class="ftk-cols ftk-e">${L(v.left)}<span></span>${L(v.right)}</div><div class="ftk-fill">` +
        v.rows.map((r) => `<div class="ftk-pair${r.open ? ' ftk-open' : ''}"><span class="ftk-bank ftk-e"><span class="ftk-mono">${esc(r.raw)}</span><span class="ftk-mono ftk-bamt ftk-hide-phone">${raw(O(r.obj))}</span></span><span class="ftk-link ftk-e" aria-hidden="true"></span><span class="ftk-rec">${r.open ? `<span class="ftk-chip ftk-warn ftk-e">${esc(r.open)}</span>` : k(r.obj, 'label', 'ftk-name')}${k(r.obj, 'amount', 'ftk-num')}</span></div>`).join('') + `</div>`
    },
    chart(v, f) {
      const n = f._n
      const all = v.groups.flatMap((g) => g.objects.map(O))
      const max = Math.max(...all.map((o) => o.amount))
      const bar = (o) => `<div class="ftk-br"><span class="ftk-who">${k(o.id, 'label', 'ftk-name')}</span><span class="ftk-track"><span class="ftk-bar${o.flow === 'in' ? ' ftk-inc' : ''}" data-from="${esc(o.id)}.amount" style="width:${((o.amount / max) * 100).toFixed(2)}%"></span></span><span class="ftk-end">${k(o.id, 'amount', 'ftk-num')}</span></div>`
      const netAmt = all.reduce((t, o) => t + (o.flow === 'in' ? o.amount : -o.amount), 0) // the bar's width; the text is the formatted net
      return `<div class="ftk-tot ftk-e"><div>${L(v.total.label)}<b class="ftk-big ftk-huge">${esc(n.net)}</b></div>${v.total.note ? L(fill(v.total.note, n), 'ftk-note') : ''}</div><div class="ftk-fill">` +
        v.groups.map((g, i) => `<div class="ftk-gl ftk-e${i ? '' : ' ftk-first'}">${L(g.label)}</div>${g.objects.map((id) => bar(O(id))).join('')}`).join('') +
        `<div class="ftk-br ftk-net ftk-e"><span class="ftk-who">${esc(v.net ?? 'Net')}</span><span class="ftk-track"><span class="ftk-bar ftk-hatch" style="width:${((Math.abs(netAmt) / max) * 100).toFixed(2)}%"></span></span><span class="ftk-end ftk-num">${esc(n.net)}</span></div></div>`
    },
    message(v) {
      return `<div class="ftk-msg"><div class="ftk-mail"><div class="ftk-mh ftk-e">${L('To')}<span>${esc(v.to)}</span>${L('Subject')}<span>${esc(v.subject)}</span></div>
<div class="ftk-mb"><p class="ftk-e">${esc(v.body)}</p><div class="ftk-lines ftk-fill">${v.lines.map((id) => `<div class="ftk-ln">${k(id, 'label', 'ftk-name')}${k(id, 'amount', 'ftk-num')}</div>`).join('')}</div>
${v.attachment ? `<span class="ftk-att ftk-e"><span class="ftk-kind">${esc(v.attachment.kind)}</span><span class="ftk-mono">${esc(v.attachment.name)}</span></span>` : ''}</div></div>
${v.steps?.length ? `<ol class="ftk-steps ftk-e">${v.steps.map((s) => `<li class="${s.done ? 'ftk-done' : ''}"><b>${esc(s.title)}</b><span class="ftk-mono">${esc(s.meta)}</span></li>`).join('')}</ol>` : ''}</div>`
    },
    form(v) {
      return `<div class="ftk-form ftk-fill">${v.fields.map((f) => `<div class="ftk-field${f.half ? ' ftk-half' : ''}">${L(f.label, 'ftk-e')}<span class="ftk-input${f.focus ? ' ftk-focus' : ''}">${k(f.obj, 'text')}${f.status ? L(f.status, 'ftk-e ftk-hide-phone') : ''}${f.focus ? '<span class="ftk-caret ftk-e" aria-hidden="true"></span>' : ''}</span></div>`).join('')}
${v.segment ? `<div class="ftk-field">${L(v.segment.label, 'ftk-e')}<span class="ftk-seg ftk-e">${v.segment.options.map((o, i) => `<span class="${i === v.segment.selected ? 'ftk-on' : ''}">${esc(o)}</span>`).join('')}</span></div>` : ''}</div>
<div class="ftk-go ftk-e">${v.note ? L(v.note) : '<span></span>'}<span class="ftk-btn">${esc(v.button)} <span aria-hidden="true">→</span></span></div>`
    },
    choice(v) {
      const s = v.scale
      return `<div class="ftk-route">${v.route.chip ? k(v.route.chip, 'text', 'ftk-chip ftk-chip-lg') : ''}<span class="ftk-e">${esc(v.route.from)}</span><span class="ftk-arrow ftk-e" aria-hidden="true"></span><span class="ftk-e">${esc(v.route.to)}</span></div>
<div class="ftk-axis ftk-e ftk-hide-phone"><span></span>${L('Service')}<span class="ftk-ends">${L(s.min)}${L(s.max)}</span>${L('Price', 'ftk-end')}</div><div class="ftk-fill">` +
        v.options.map((o) => `<div class="ftk-opt${o.selected ? ' ftk-on' : ''}"><span class="ftk-radio ftk-e" aria-hidden="true"></span><span class="ftk-svc">${o.obj ? k(o.obj, 'text', 'ftk-name') : `<span class="ftk-name ftk-e">${esc(o.label)}</span>`}<span class="ftk-sub ftk-mono ftk-e">${esc(o.sub)}</span></span><span class="ftk-days ftk-e" aria-hidden="true">${Array.from({ length: s.steps }, (_, d) => `<i class="${d < o.days ? 'ftk-f' : ''}"></i>`).join('')}</span><span class="ftk-end ftk-price">${o.selected ? k(o.priceObj, 'amount', 'ftk-num') : `<span class="ftk-num ftk-e">${esc(fmt({ amount: o.price, currency: O(v.options.find((x) => x.selected).priceObj).currency, locale: O(v.options.find((x) => x.selected).priceObj).locale }, c.money))}</span>`}</span></div>`).join('') +
        `</div><div class="ftk-go ftk-e">${v.note ? L(v.note) : '<span></span>'}<span class="ftk-btn">${esc(v.button)} <span aria-hidden="true">→</span></span></div>`
    },
    code(v) {
      const val = (f) => {
        if (!f.obj) return `<span class="ftk-s">"${esc(f.value)}"</span>`
        const o = O(f.obj)
        return `<span class="ftk-s">"${k(f.obj, o.amount !== undefined ? 'amount' : 'text')}"</span>`
      }
      const req = v.request.fields
      const lines = [
        `<span class="ftk-verb">${esc(v.request.method)}</span> <span class="ftk-key">${esc(v.request.path)}</span>`,
        `{`,
        ...req.map((f, i) => `  <span class="ftk-key">"${esc(f.key)}"</span>: ${val(f)}${i < req.length - 1 ? ',' : ''}`),
        `}`,
      ]
      const res = v.response.fields
      return `${v.tabs?.length ? `<div class="ftk-langs ftk-e" aria-hidden="true">${v.tabs.map((t, i) => `<span class="${i ? '' : 'ftk-on'}">${esc(t)}</span>`).join('')}</div>` : ''}<div class="ftk-code ftk-fill">${lines.map((l, i) => `<span class="ftk-cl${i === 0 || i === 1 || i === lines.length - 1 ? ' ftk-e' : ''}"><span class="ftk-lnum" aria-hidden="true">${i + 1}</span><span class="ftk-ct">${l}</span></span>`).join('')}</div>
<div class="ftk-code ftk-res"><span class="ftk-cl ftk-e"><span class="ftk-lnum" aria-hidden="true"></span><span class="ftk-ct ftk-okc">${esc(v.response.status)}</span></span>${res.map((f) => `<span class="ftk-cl${f.obj ? '' : ' ftk-e'}${f.phone === false ? ' ftk-hide-phone' : ''}"><span class="ftk-lnum" aria-hidden="true"></span><span class="ftk-ct"><span class="ftk-key">"${esc(f.key)}"</span>: ${val(f)}</span></span>`).join('')}</div>`
    },
    timeline(v) {
      const h = v.head
      return `<div class="ftk-thead"><div>${L(h.label, 'ftk-e')}<div class="ftk-tn">${k(h.obj, 'text')}</div>${h.sub ? `<div class="ftk-tsub">${k(h.sub, 'text', 'ftk-mono')}</div>` : ''}</div><div class="ftk-eta">${L(h.asideLabel, 'ftk-e')}<b class="ftk-big ftk-e">${esc(h.aside)}</b>${h.paid ? `<span class="ftk-paid"><span class="ftk-label ftk-e">Paid </span>${k(h.paid, 'amount', 'ftk-num')}</span>` : ''}</div></div>
<ol class="ftk-events ftk-fill">${v.events.map((e) => `<li class="ftk-ev ftk-${e.state}"><span class="ftk-dot ftk-e" aria-hidden="true"></span><span class="ftk-evn ftk-mono ftk-e">${esc(e.event)}</span><span class="ftk-pl">${e.obj ? k(e.obj, 'text') : `<span class="ftk-e">${esc(e.place)}</span>`}</span><span class="ftk-tm ftk-mono ftk-e">${esc(e.time ?? '')}</span></li>`).join('')}</ol>`
    },
  }
  return c.features.map((f) => `<div class="ftk-v ftk-v-${f.view.type}">${draw[f.view.type](f.view, f)}</div>`)
}
