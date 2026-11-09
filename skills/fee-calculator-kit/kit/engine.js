/* Fee Calculator Kit: the engine. Exact money, the amount parser, cut-offs
   across time zones, and the section's markup. Plain JavaScript with no
   dependencies; the build runs it in Node to write the page's starting
   state, and the same file is inlined into the page, so the first paint and
   every later update come from one implementation.

   Money is never a float. Amounts are BigInt in minor units (cents, or whole
   dong for a currency without them), rates and percentages are decimal
   strings scaled to fixed precision, and every division rounds by a named
   rule: "down", "half-up" or "half-even". */
var FeeEngine = (function () {
  'use strict'

  /* ---------------- exact money ---------------- */
  var RP = 8 // rate precision: rates are held as integers x 10^8
  var PP = 4 // percent precision: "0.35" percent is held as 3500
  function T(n) { return BigInt(10) ** BigInt(n) }
  /** "2.10" at 2 places -> 210n. Accepts "12", "12.5", "0.0045". */
  function scaled(s, dp) {
    var str = String(s).trim()
    var neg = str.charAt(0) === '-'
    if (neg) str = str.slice(1)
    var bits = str.split('.')
    var frac = ((bits[1] || '') + '0'.repeat(dp)).slice(0, dp)
    var v = BigInt((bits[0] || '0') + frac)
    return neg ? -v : v
  }
  /** n / d, both BigInt and d > 0, rounded by mode. */
  function rdiv(n, d, mode) {
    if (n < 0n) return -rdiv(-n, d, mode === 'down' ? 'down' : mode)
    var q = n / d, r = n % d
    if (r === 0n || mode === 'down') return q
    if (mode === 'half-up') return 2n * r >= d ? q + 1n : q
    if (2n * r > d) return q + 1n
    if (2n * r === d) return q % 2n === 1n ? q + 1n : q
    return q
  }
  /** percent (a string such as "0.35") of an amount in minor units */
  function pctOf(minor, percent, mode) { return rdiv(minor * scaled(percent, PP), 100n * T(PP), mode) }

  function caseFor(row, toggles) {
    var cs = row.cases || []
    for (var i = 0; i < cs.length; i++) {
      var w = cs[i].when || {}, ok = true
      for (var k in w) if (Object.prototype.hasOwnProperty.call(w, k) && toggles[k] !== w[k]) ok = false
      if (ok) return cs[i]
    }
    return null
  }
  function fromCur(c) { return c.from }
  function toCur(c) { return c.to }

  /** One side of the sum: ours, or the comparison's. */
  function side(c, amount, toggles, rows, marginPct) {
    var F = fromCur(c), To = toCur(c)
    var fd = F.decimals, td = To.decimals
    var fees = [], feeTotal = 0n
    for (var i = 0; i < rows.length; i++) {
      var k = caseFor(rows[i], toggles)
      var v = 0n
      if (k) {
        if (k.fixed) v += scaled(k.fixed, fd)
        if (k.percent) v += pctOf(amount, k.percent, c.rounding)
      }
      fees.push({ value: v, applies: !!k, kase: k })
      feeTotal += v
    }
    var net = amount - feeTotal
    if (net < 0n) net = 0n
    var same = F.code === To.code
    var mid = same ? T(RP) : scaled(c.rate.mid, RP)
    var m = same ? '0' : marginPct
    var keep = 100n * T(PP) - scaled(m, PP)
    // the rate applied: mid x (1 - margin), cut to the rate's shown places
    var rate = same ? T(RP) : rdiv(mid * keep, 100n * T(PP) * T(RP - c.rate.decimals), 'down') * T(RP - c.rate.decimals)
    var recv = rdiv(net * rate * T(td), T(fd) * T(RP), c.receiveRounding)
    // what the margin costs, as money in the sending currency
    var margin = same ? 0n : rdiv(net * (mid - rate), mid, c.rounding)
    var total = feeTotal + margin
    return { fees: fees, feeTotal: feeTotal, net: net, rate: rate, recv: recv, margin: margin, total: total }
  }

  /** Everything the section shows for one amount. */
  function compute(c, amount, toggles) {
    var us = side(c, amount, toggles, c.fees, c.rate.margin)
    var bk = c.compare ? side(c, amount, toggles, c.compare.fees, c.compare.margin) : null
    var F = fromCur(c)
    var hundred = 100n * T(F.decimals)
    var pf = amount > 0n ? rdiv(us.feeTotal * hundred, amount, 'half-up') : 0n
    var pm = amount > 0n ? rdiv(us.margin * hundred, amount, 'half-up') : 0n
    var pa = hundred - pf - pm
    // the enlarged strip shows the last whole per cent above the costs, plus one
    var zoom = Number((pf + pm + T(F.decimals) - 1n) / T(F.decimals)) + 1
    var totalBp = amount > 0n ? rdiv(us.total * 10000n, amount, 'half-up') : 0n
    var r = { amount: amount, us: us, bk: bk, per100: { arrive: pa, fees: pf, margin: pm, zoom: zoom, hundred: hundred }, totalBp: totalBp }
    if (bk) {
      r.bkTotalBp = amount > 0n ? rdiv(bk.total * 10000n, amount, 'half-up') : 0n
      var diff = us.recv - bk.recv
      r.diff = diff
      // the difference in the sending currency, at our rate
      var To = toCur(c)
      var mag = diff < 0n ? -diff : diff
      r.diffSend = F.code === To.code ? null : (us.rate > 0n ? rdiv(mag * T(F.decimals) * T(RP), us.rate * T(To.decimals), 'half-up') : 0n)
    }
    return r
  }

  /* ---------------- formatting ---------------- */
  var NF = {}
  function nf(locale, o) {
    var key = locale + JSON.stringify(o)
    return NF[key] || (NF[key] = new Intl.NumberFormat(locale, o))
  }
  /** Formats BigInt minor units exactly, through Intl's string formatting. */
  function money(c, minor, cur) {
    var neg = minor < 0n
    var v = neg ? -minor : minor
    var s = v.toString().padStart(cur.decimals + 1, '0')
    var str = cur.decimals ? s.slice(0, -cur.decimals) + '.' + s.slice(-cur.decimals) : s
    var out = nf(c.locale, { style: 'currency', currency: cur.code, minimumFractionDigits: cur.decimals, maximumFractionDigits: cur.decimals }).format(str)
    return neg ? '−' + out : out
  }
  function plain(c, minor, dp) {
    var s = minor.toString().padStart(dp + 1, '0')
    var str = dp ? s.slice(0, -dp) + '.' + s.slice(-dp) : s
    return nf(c.locale, { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(str)
  }
  function rateText(c, r) { return plain(c, rdiv(r, T(RP - c.rate.decimals), 'down'), c.rate.decimals) }
  /** basis points (hundredths of a per cent) as a percentage */
  function pctBp(c, bp) {
    var s = bp.toString().padStart(5, '0')
    return nf(c.locale, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(s.slice(0, -4) + '.' + s.slice(-4))
  }
  /** a configured percent string such as "2.90" as "2.9%" */
  function pctStr(c, p) { return nf(c.locale, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(String(Number(p) / 100)) }

  /* ---------------- the amount parser ---------------- */
  function seps(locale) {
    var parts = nf(locale, { useGrouping: true }).formatToParts(12345.6)
    var g = ',', d = '.'
    for (var i = 0; i < parts.length; i++) { if (parts[i].type === 'group') g = parts[i].value; if (parts[i].type === 'decimal') d = parts[i].value }
    return { group: g, decimal: d }
  }
  /**
   * Reads what a visitor typed or pasted, in either convention:
   * "1.250,00", "1,250.00", "1 250,00 €", "EUR 1250", "€1,250". The last
   * separator is the decimal one when both kinds appear; a lone separator
   * followed by exactly three digits is grouping unless it is the page's
   * own decimal mark. Groups after the first must be three digits.
   * Returns { minor } or { error: empty | nonnumeric | negative | decimals }.
   */
  function parse(c, text) {
    var F = fromCur(c)
    var s = String(text == null ? '' : text)
    s = s.replace(/[\s  '’]/g, '')
    if (!s) return { error: 'empty' }
    if (/^\(.*\)$/.test(s) || /[-−‒–]/.test(s)) return /\d/.test(s) ? { error: 'negative' } : { error: 'nonnumeric' }
    // currency codes and symbols around the number
    var sym = '[\u00a3\u20ac$\u00a5\u20ab\u20b9\u20a9\u0e3f\u20b1]'
    var code = '(?:' + F.code + '|' + toCur(c).code + ')'
    s = s.replace(new RegExp('^(?:' + code + sym + '?|' + sym + ')', 'i'), '').replace(new RegExp('(?:' + code + '|' + sym + ')$', 'i'), '')
    if (!s) return { error: 'nonnumeric' }
    if (/[^\d.,]/.test(s) || !/\d/.test(s)) return { error: 'nonnumeric' }
    var own = seps(c.locale).decimal
    var dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length
    var dec = null, grp = null
    if (dots && commas) {
      dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ','
      grp = dec === '.' ? ',' : '.'
      if ((dec === '.' ? dots : commas) > 1) return { error: 'nonnumeric' }
    } else if (dots || commas) {
      var ch = dots ? '.' : ','
      var count = dots || commas
      var after = s.length - s.lastIndexOf(ch) - 1
      if (count > 1) grp = ch
      else if (ch === own) dec = ch
      else if (after === 3) grp = ch
      else dec = ch
    }
    var ip = s, fp = ''
    if (dec) { var k = s.lastIndexOf(dec); ip = s.slice(0, k); fp = s.slice(k + 1) }
    if (grp) {
      var g = ip.split(grp)
      if (!/^\d{1,3}$/.test(g[0])) return { error: 'nonnumeric' }
      for (var i = 1; i < g.length; i++) if (!/^\d{3}$/.test(g[i])) return { error: 'nonnumeric' }
      ip = g.join('')
    }
    if (!/^\d*$/.test(ip) || !/^\d*$/.test(fp) || (!ip && !fp)) return { error: 'nonnumeric' }
    if (fp.length > F.decimals && /[1-9]/.test(fp.slice(F.decimals))) return { error: 'decimals' }
    fp = (fp + '0'.repeat(F.decimals)).slice(0, F.decimals)
    return { minor: BigInt((ip || '0') + fp) }
  }
  /** the problem with an amount, or null */
  function problem(c, r) {
    if (r.error) return r.error
    var F = fromCur(c)
    if (r.minor < scaled(c.amount.min, F.decimals)) return 'min'
    if (r.minor > scaled(c.amount.max, F.decimals)) return 'max'
    return null
  }
  function message(c, code) {
    var F = fromCur(c)
    var m = {
      empty: 'Enter an amount to see the breakdown.',
      nonnumeric: 'That is not an amount. Use digits, like ' + plain(c, scaled('1250', F.decimals), F.decimals) + '.',
      negative: 'Enter a positive amount.',
      decimals: F.decimals ? 'Use at most ' + F.decimals + ' decimal places.' : 'Use whole amounts only.',
      min: 'The smallest amount is ' + money(c, scaled(c.amount.min, F.decimals), F) + '.',
      max: 'The largest amount is ' + money(c, scaled(c.amount.max, F.decimals), F) + '.',
    }
    return (c.messages && c.messages[code]) || m[code]
  }

  /* ---------------- time ---------------- */
  var DF = {}
  function df(zone, o) { var k = zone + JSON.stringify(o); return DF[k] || (DF[k] = new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: zone }, o))) }
  function parts(ms, zone) {
    var o = {}
    var ps = df(zone, { hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(new Date(ms))
    for (var i = 0; i < ps.length; i++) o[ps[i].type] = ps[i].value
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, wd: o.weekday }
  }
  /** wall-clock time in a zone -> epoch ms */
  function zoned(y, m, d, hh, mm, zone) {
    var want = Date.UTC(y, m - 1, d, hh, mm), t = want
    for (var i = 0; i < 4; i++) { var p = parts(t, zone); t += want - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi) }
    return t
  }
  /** "2026-11-10T12:20" read in a zone */
  function local(str, zone) {
    var a = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(String(str))
    if (!a) return NaN
    return zoned(+a[1], +a[2], +a[3], +(a[4] || 0), +(a[5] || 0), zone)
  }
  var pad = function (n) { return String(n).padStart(2, '0') }
  function ymd(p) { return p.y + '-' + pad(p.m) + '-' + pad(p.d) }
  function isBiz(c, p) { return p.wd !== 'Sat' && p.wd !== 'Sun' && (c.arrival.holidays || []).indexOf(ymd(p)) < 0 }
  function nextDay(p, zone) { return parts(zoned(p.y, p.m, p.d, 12, 0, zone) + 864e5, zone) }
  function hm(s) { var a = s.split(':'); return [+a[0], +a[1]] }
  /** When it leaves and when it lands, from `now` (epoch ms). */
  function arrival(c, now) {
    var A = c.arrival, ch = hm(A.cutoff)
    var p = parts(now, A.cutoffZone)
    var cut = zoned(p.y, p.m, p.d, ch[0], ch[1], A.cutoffZone)
    var state = 'before', passed = 0
    if (!isBiz(c, p)) state = 'closed'
    else if (now >= cut) { state = 'missed'; passed = now - cut }
    if (state !== 'before') {
      do { p = nextDay(p, A.cutoffZone) } while (!isBiz(c, p))
      cut = zoned(p.y, p.m, p.d, ch[0], ch[1], A.cutoffZone)
    }
    var a = parts(cut, A.zone), n = A.businessDays
    while (n > 0) { a = nextDay(a, A.zone); if (isBiz(c, a)) n-- }
    var by = hm(A.by)
    var arrive = zoned(a.y, a.m, a.d, by[0], by[1], A.zone)
    return { now: now, cut: cut, arrive: arrive, state: state, passed: passed, left: cut - now }
  }
  function clock(ms, zone) { return df(zone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)) }
  function dur(ms) {
    var m = Math.max(1, Math.round(Math.abs(ms) / 6e4)), h = Math.floor(m / 60)
    return (h ? h + ' h ' : '') + (m % 60 ? (m % 60) + ' min' : '').trim()
  }

  /* ---------------- markup ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function rich(s) { return esc(s).replace(/_([^_]+)_/g, '<em>$1</em>') }
  function W(c) { return Object.assign({}, DEFAULT_WORDS, c.words || {}) }
  var DEFAULT_WORDS = {
    send: 'You send', receive: 'They receive', onThis: 'On this transfer', ours: '', margin: 'Exchange margin',
    marginNote: '{pct} under the mid-market rate, as money', rate: 'Rate applied', total: 'Total cost, all in',
    arrives: 'Arrives', arrivesShort: 'Arrives', per100: 'you send', reach: 'Arrives', fees: 'Fees',
    who: 'They get', more: 'more', less: 'less', unit: 'transfer', difference: 'Difference', sameCurrency: 'Same currency, nothing to convert',
  }
  function values(c, r) {
    var F = fromCur(c), To = toCur(c)
    var v = {}
    for (var i = 0; i < r.us.fees.length; i++) v['f' + i] = money(c, r.us.fees[i].value, F)
    v.m = money(c, r.us.margin, F)
    v.r = rateText(c, r.us.rate)
    v.recv = money(c, r.us.recv, To)
    v.tot = money(c, r.us.total, F) + ' · ' + pctBp(c, r.totalBp)
    v.mrecv = v.recv
    v.rr = v.r
    v.pa = money(c, r.per100.arrive, F)
    v.pf = money(c, r.per100.fees, F)
    v.pm = money(c, r.per100.margin, F)
    v.pz = String(r.per100.zoom)
    if (r.bk) {
      for (var j = 0; j < r.bk.fees.length; j++) v['b' + j] = money(c, r.bk.fees[j].value, F)
      v.bm = money(c, r.bk.margin, F)
      v.br = rateText(c, r.bk.rate)
      v.brecv = money(c, r.bk.recv, To)
      v.btot = money(c, r.bk.total, F) + ' · ' + pctBp(c, r.bkTotalBp)
      v.rb = v.br
      v.diff = money(c, r.diff < 0n ? -r.diff : r.diff, To)
      if (r.diffSend != null) v.diffs = money(c, r.diffSend, F)
    }
    return v
  }
  /** A figure: plain text in the HTML; the runtime turns its digits into rolling columns. */
  function N(k, v, cls) { return '<span class="fk-n' + (cls ? ' ' + cls : '') + '" data-k="' + k + '" data-v="' + esc(v[k]) + '">' + esc(v[k]) + '</span>' }

  function feeDetail(c, k) {
    if (!k) return ''
    if (k.detail) return k.detail
    var F = fromCur(c), bits = []
    if (k.percent) bits.push(pctStr(c, k.percent))
    if (k.fixed) bits.push(money(c, scaled(k.fixed, F.decimals), F))
    return bits.join(' + ')
  }

  function field(c, state) {
    var w = W(c), F = fromCur(c)
    var togg = (c.toggles || []).map(function (t) {
      var on = state.toggles[t.id]
      return '<div class="fk-seg" role="group" aria-labelledby="fk-t-' + esc(t.id) + '"><span class="fk-lbl" id="fk-t-' + esc(t.id) + '">' + esc(t.label) + '</span><div>' +
        t.options.map(function (o) { return '<button type="button" data-t="' + esc(t.id) + '" data-o="' + esc(o.value) + '" aria-pressed="' + (on === o.value) + '">' + esc(o.label) + '</button>' }).join('') + '</div></div>'
    }).join('')
    var range = money(c, scaled(c.amount.min, F.decimals), F) + ' to ' + money(c, scaled(c.amount.max, F.decimals), F)
    return '<div class="fk-field-wrap"><div class="fk-field">' +
      '<label class="fk-lbl" for="fk-amt">' + esc(w.send) + '</label>' +
      '<input id="fk-amt" class="fk-num" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" enterkeyhint="done" value="' + esc(plain(c, state.amount, F.decimals)) + '" aria-describedby="fk-hint fk-msg">' +
      '<span class="fk-cur"><span class="fk-sym" aria-hidden="true">' + esc(F.symbol || F.code.slice(0, 1)) + '</span>' + esc(F.code) + '</span></div>' +
      '<p class="fk-msg" id="fk-msg" role="alert"></p>' +
      '<div class="fk-hint" id="fk-hint"><span>' + esc(c.amount.hint || ('Type or paste: ' + plain(c, scaled('1250', F.decimals), F.decimals) + ' or ' + plainOther(c, F) + ' both work')) + '</span><span class="fk-num">' + esc(range) + '</span></div>' +
      (togg ? '<div class="fk-opts">' + togg + '</div>' : '') + '</div>'
  }
  function plainOther(c, F) {
    var own = seps(c.locale).decimal
    var other = own === ',' ? 'en-US' : 'de-DE'
    return plain({ locale: other }, scaled('1250', F.decimals), F.decimals)
  }

  function ledger(c, r, v) {
    var w = W(c), F = fromCur(c), To = toCur(c), bk = !!r.bk
    var BN = bk ? ' data-name="' + esc(c.compare.label) + '"' : ''
    var rows = c.fees.map(function (row, i) {
      var k = r.us.fees[i].kase
      var sub = k ? feeDetail(c, k) : (row.none || 'Not charged here')
      return '<tr><td class="fk-op">−</td><td class="fk-lab">' + esc(row.label) + '<span class="fk-sub" data-sub="' + i + '">' + esc(sub) + '</span></td>' +
        '<td class="fk-us">' + N('f' + i, v, 'fk-v fk-c') + '</td>' + (bk ? '<td class="fk-bk"' + BN + '>' + N('b' + i, v, 'fk-v') + '</td>' : '') + '</tr>'
    }).join('')
    var same = F.code === To.code
    var msub = same ? w.sameCurrency : w.marginNote.replace('{pct}', pctStr(c, c.rate.margin))
    return '<table class="fk-ledger"><caption class="fk-sr">' + esc(w.onThis) + '</caption>' +
      '<thead><tr><th class="fk-op" scope="col"><span class="fk-sr">Operation</span></th><th class="fk-lbl fk-lab" scope="col">' + esc(w.onThis) + '</th><th class="fk-lbl fk-us" scope="col">' + esc(w.ours || c.brand) + '</th>' + (bk ? '<th class="fk-lbl fk-bk" scope="col">' + esc(c.compare.label) + '<sup><a href="#fk-note-1" aria-label="note 1">1</a></sup></th>' : '') + '</tr></thead><tbody>' +
      rows +
      '<tr><td class="fk-op">−</td><td class="fk-lab">' + esc(w.margin) + '<sup><a href="#fk-note-2" aria-label="note 2">2</a></sup><span class="fk-sub">' + esc(msub) + '</span></td><td class="fk-us">' + N('m', v, 'fk-v fk-c') + '</td>' + (bk ? '<td class="fk-bk"' + BN + '>' + N('bm', v, 'fk-v') + '</td>' : '') + '</tr>' +
      '<tr><td class="fk-op">×</td><td class="fk-lab">' + esc(w.rate) + '<span class="fk-sub">' + esc(To.code + ' per 1 ' + F.code) + '</span></td><td class="fk-us">' + N('r', v, 'fk-v') + '</td>' + (bk ? '<td class="fk-bk"' + BN + '>' + N('br', v, 'fk-v') + '</td>' : '') + '</tr>' +
      '<tr class="fk-rule" aria-hidden="true"><td colspan="' + (bk ? 4 : 3) + '"><div></div></td></tr>' +
      '<tr class="fk-total"><td class="fk-op">=</td><td class="fk-lab fk-tcell" colspan="2"><div class="fk-tline"><span class="fk-tlab">' + esc(w.receive) + '</span>' + N('recv', v, 'fk-result') + '</div></td>' + (bk ? '<td class="fk-bk"' + BN + '>' + N('brecv', v, 'fk-v') + '</td>' : '') + '</tr>' +
      '<tr class="fk-cost"><td class="fk-op"></td><td class="fk-lab">' + esc(w.total) + '</td><td class="fk-us">' + N('tot', v) + '</td>' + (bk ? '<td class="fk-bk"' + BN + '>' + N('btot', v) + '</td>' : '') + '</tr>' +
      '</tbody></table>'
  }
  function keep(c, r, v, big) {
    if (!r.bk) return ''
    var w = W(c)
    var word = r.diff < 0n ? w.less : w.more
    return '<p class="fk-keep' + (big ? ' fk-big' : '') + '"><span class="fk-lbl">' + esc(w.difference) + '</span><span class="fk-say">' + esc(w.who) + ' <b>' + N('diff', v) + ' <span data-w="diffw">' + esc(word) + '</span></b> than with ' + esc(c.compare.inText || (c.compare.label.charAt(0).toLowerCase() + c.compare.label.slice(1))) +
      (v.diffs != null ? ', about ' + N('diffs', v) : ' on this ' + esc(w.unit)) + '.</span></p>'
  }
  function rateBlock(c, r, v, now) {
    var F = fromCur(c), To = toCur(c)
    var same = F.code === To.code
    var asOf = local(c.rate.asOf, c.arrival.cutoffZone)
    var day = df(c.arrival.cutoffZone, { day: 'numeric', month: 'short' }).format(new Date(asOf))
    return '<div class="fk-blk fk-rate"><h3><span class="fk-lbl">Exchange rate</span><span class="fk-lbl">' + esc(To.code + ' per 1 ' + F.code) + '</span></h3>' +
      '<dl class="fk-dl"><dt>Mid-market<sup><a href="#fk-note-2" aria-label="note 2">2</a></sup></dt><dd class="fk-num" data-k="mid" data-v="' + esc(same ? '1' : rateText(c, scaled(c.rate.mid, RP))) + '">' + esc(same ? '1' : rateText(c, scaled(c.rate.mid, RP))) + '</dd>' +
      '<dt>' + esc(c.brand) + '</dt><dd class="fk-ours">' + N('rr', v) + '</dd>' +
      (r.bk ? '<dt>' + esc(c.compare.label) + '<sup><a href="#fk-note-1" aria-label="note 1">1</a></sup></dt><dd class="fk-bkr">' + N('rb', v) + '</dd>' : '') + '</dl>' +
      '<div class="fk-asof"><span>Rate as of <b data-asof="' + asOf + '">' + esc(clock(asOf, c.arrival.cutoffZone)) + '</b>, <span class="fk-nw">' + esc(day) + '</span><br>' + esc(c.arrival.cutoffCity) + ' time</span>' +
      '<button type="button" class="fk-refresh"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3"/></svg>Refresh rate</button></div>' +
      '<p class="fk-rstat" role="status"></p></div>'
  }
  function split(c, r, v) {
    var w = W(c), F = fromCur(c), p = r.per100
    var z = BigInt(p.zoom) * T(F.decimals)
    var rest = z - p.fees - p.margin
    return '<div class="fk-blk fk-split"><h3><span class="fk-lbl">Of every ' + esc(money(c, p.hundred, F)) + ' ' + esc(w.per100) + '</span></h3>' +
      '<div class="fk-bar" aria-hidden="true"><span class="fk-a" data-b="a" style="flex-grow:' + p.arrive + '"></span><span class="fk-f" data-b="f" style="flex-grow:' + p.fees + '"></span><span class="fk-m" data-b="m" style="flex-grow:' + p.margin + '"></span></div>' +
      '<div class="fk-zoom" aria-hidden="true"><span class="fk-lbl">The last ' + N('pz', v) + ' %, enlarged</span><div class="fk-bar"><span class="fk-a" data-b="za" style="flex-grow:' + rest + '"></span><span class="fk-f" data-b="zf" style="flex-grow:' + p.fees + '"></span><span class="fk-m" data-b="zm" style="flex-grow:' + p.margin + '"></span></div></div>' +
      '<ul class="fk-leg"><li><i class="fk-a" aria-hidden="true"></i><span>' + esc(w.reach) + '</span>' + N('pa', v) + '</li><li><i class="fk-f" aria-hidden="true"></i><span>' + esc(w.fees) + '</span>' + N('pf', v) + '</li><li><i class="fk-m" aria-hidden="true"></i><span>' + esc(w.margin) + '</span>' + N('pm', v) + '</li></ul></div>'
  }

  function strip(c, now) {
    var A = c.arrival, w = W(c)
    var a = arrival(c, now)
    var two = A.zone !== A.cutoffZone
    var long = (a.arrive - now) > 40 * 36e5
    var padMs = long ? 10 * 36e5 : 3 * 36e5
    var t0 = now - padMs, t1 = a.arrive + padMs
    var X = function (t) { return ((t - t0) / (t1 - t0) * 100).toFixed(3) + '%' }
    var Wd = function (s, e) { s = Math.max(s, t0); e = Math.min(e, t1); return 'left:' + X(s) + ';width:calc(' + X(e) + ' - ' + X(s) + ')' }
    var marks = [now, a.cut, a.arrive]
    var near = function (t) { for (var i = 0; i < marks.length; i++) if (Math.abs(marks[i] - t) < (t1 - t0) * 0.035) return true; return false }
    function row(zone, label, n) {
      var h = '', t, p
      for (t = Math.floor(t0 / 36e5) * 36e5 - 864e5; t < t1; t += 36e5) {
        p = parts(t, zone)
        if (p.mi !== 0) continue
        if (long) { if (p.h === 0 && !isBiz(c, p)) h += '<span class="fk-wkd" style="' + Wd(t, t + 864e5) + '"></span>' }
        else if (p.h === 22) h += '<span class="fk-night" style="' + Wd(t, t + 9 * 36e5) + '"></span>'
      }
      for (t = Math.ceil(t0 / 36e5) * 36e5 - (long ? 864e5 : 0); t < t1; t += 36e5) {
        p = parts(t, zone)
        if (p.mi !== 0) continue
        if (long) {
          if (p.h !== 0) continue
          if (t >= t0) h += '<span class="fk-tk fk-day" style="left:' + X(t) + '"></span>'
          var mid = t + 432e5
          if (mid > t0 + 36e5 && mid < t1 - 36e5 && !near(mid)) h += '<span class="fk-tx" style="left:' + X(mid) + '">' + '<i>' + esc(df(zone, { weekday: 'short' }).format(new Date(t))) + ' </i>' + esc(df(zone, { day: 'numeric' }).format(new Date(t))) + '</span>'
          continue
        }
        if (t < t0) continue
        if (p.h % 3) { h += '<span class="fk-tk fk-sm" style="left:' + X(t) + '"></span>'; continue }
        h += '<span class="fk-tk" style="left:' + X(t) + '"></span>'
        if (t - t0 < 9e5 || t1 - t < 9e5 || near(t)) continue
        h += '<span class="fk-tx" style="left:' + X(t) + '">' + (p.h === 0 ? esc(df(zone, { weekday: 'short' }).format(new Date(t))) : pad(p.h)) + '</span>'
      }
      return '<div class="fk-zl" style="grid-row:' + n + '"><b>' + esc(label) + '</b><span>' + esc(clock(now, zone)) + ' now</span></div><div class="fk-row" style="grid-row:' + n + '">' + h + '</div>'
    }
    var leaves = df(A.cutoffZone, { weekday: 'long' }).format(new Date(a.cut))
    var cutText = a.state === 'before'
      ? 'Send in the next <b>' + dur(a.left) + '</b> to make today’s <b>' + esc(A.cutoff) + '</b> cut-off in ' + esc(A.cutoffCity) + '.'
      : a.state === 'missed'
        ? 'Today’s <b>' + esc(A.cutoff) + '</b> cut-off in ' + esc(A.cutoffCity) + ' passed ' + dur(a.passed) + ' ago, so it leaves on ' + esc(leaves) + '. Weekends and bank holidays do not count.'
        : 'Today is not a business day in ' + esc(A.cutoffCity) + ', so it leaves on ' + esc(leaves) + ' at the <b>' + esc(A.cutoff) + '</b> cut-off.'
    var bd = A.businessDays + ' business day' + (A.businessDays > 1 ? 's' : '')
    return '<div class="fk-strip"><div class="fk-sx"><h3 class="fk-lbl">' + esc(w.arrives) + ' · ' + esc(bd) + '</h3>' +
      '<p class="fk-when" data-arrive="' + a.arrive + '">' + esc(df(A.zone, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(a.arrive))) + ', by ' + esc(A.by) + '</p>' +
      '<p class="fk-where">' + esc(A.city) + ' time, ' + esc(A.where) + '.</p>' +
      '<p class="fk-cutline' + (a.state !== 'before' ? ' fk-missed' : '') + '" data-state="' + a.state + '">' + cutText + '</p></div>' +
      '<div class="fk-tl" aria-hidden="true" data-now="' + now + '"><div class="fk-track"><span class="fk-pre" style="' + Wd(now, a.cut) + '"></span><span class="fk-go" style="' + Wd(a.cut, a.arrive) + '"></span></div>' +
      row(A.cutoffZone, A.cutoffCity, 2) + (two ? row(A.zone, A.city, 3) : '') +
      '<div class="fk-mks" style="grid-row:1/span ' + (two ? 3 : 2) + '"><span class="fk-mk" style="left:' + X(now) + '"><b class="fk-pin fk-l">Now</b></span>' +
      '<span class="fk-mk fk-cutm" style="left:' + X(a.cut) + '"><b class="fk-pin">Cut-off ' + esc(A.cutoff) + '</b></span>' +
      '<span class="fk-mk fk-arrm" style="left:' + X(a.arrive) + '"><b class="fk-pin fk-l">' + esc(w.arrivesShort) + ' ' + esc(A.by) + '</b></span></div></div></div>'
  }
  function mbar(c, v, now) {
    var w = W(c), a = arrival(c, now)
    return '<div class="fk-mbar" aria-hidden="true"><div><span class="fk-lbl">' + esc(w.receive) + '</span><b>' + N('mrecv', v) + '</b></div><div><span class="fk-lbl">' + esc(w.arrivesShort) + '</span><b class="fk-mwhen">' + esc(df(c.arrival.zone, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(a.arrive))) + ', ' + esc(c.arrival.by) + '</b></div></div>'
  }
  function notes(c) {
    var out = []
    var F = fromCur(c), To = toCur(c)
    if (c.compare) {
      var when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(c.compare.collected + 'T12:00:00Z'))
      out.push({ title: c.compare.label, text: c.compare.source + ' Collected on ' + when + '.', link: c.compare.link })
    }
    for (var i = 0; i < (c.notes || []).length; i++) out.push(c.notes[i])
    var mode = function (m) { return m === 'half-even' ? 'half to even' : m === 'down' ? 'down' : 'half-up' }
    var unit = function (cur) { return cur.decimals === 2 ? 'the cent' : cur.decimals === 0 ? 'a whole ' + (cur.unit || cur.code) : cur.decimals + ' decimal places' }
    var rnd = 'Fees and the exchange margin round ' + mode(c.rounding) + ' to ' + unit(F) + '. The amount received rounds ' + mode(c.receiveRounding) + ' to ' + unit(To) + '.'
    out.push({ title: 'Rounding and timing', text: rnd + (c.arrival.note ? ' ' + c.arrival.note : '') })
    return '<div class="fk-notes" style="--n:' + out.length + '">' + out.map(function (n, i) {
      return '<div id="fk-note-' + (i + 1) + '"><p class="fk-nh"><b>' + (i + 1) + '</b><span class="fk-lbl">' + esc(n.title) + '</span></p><p>' + esc(n.text) + (n.link ? ' <a href="' + esc(n.link.href) + '">' + esc(n.link.label) + '</a>' : '') + '</p></div>'
    }).join('') + '</div>' + (c.legal && c.legal.length ? '<div class="fk-legal">' + c.legal.map(function (l) { return '<span>' + esc(l) + '</span>' }).join('') + '</div>' : '')
  }

  /** The section's inner markup for a state { amount, toggles, now }. */
  function markup(c, state) {
    var r = compute(c, state.amount, state.toggles)
    var v = values(c, r)
    var head = '<header class="fk-head"><div><p class="fk-lbl fk-eb">' + esc(c.eyebrow) + '</p><h2 id="fk-h">' + rich(c.headline) + '</h2></div><p class="fk-lede">' + rich(c.lede) + '</p></header>'
    var live = '<p class="fk-sr" aria-live="polite" data-live></p>'
    var body
    if (c.layout === 'receipt') {
      var stamp = df(c.arrival.cutoffZone, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(state.now)) + ' ' + clock(state.now, c.arrival.cutoffZone)
      body = '<div class="fk-sheet fk-receiptL"><div class="fk-ctl">' + field(c, state) + rateBlock(c, r, v, state.now) + split(c, r, v) + '</div>' +
        '<div class="fk-receipt"><p class="fk-rhead fk-lbl"><span>' + esc(c.brand) + ' · ' + esc(c.receiptTitle || 'preview') + '</span><span>' + esc(stamp) + '</span></p>' + ledger(c, r, v) + keep(c, r, v, false) + '</div>' +
        '<div class="fk-stripwrap">' + strip(c, state.now) + '</div>' + mbar(c, v, state.now) + '</div>'
    } else {
      body = '<div class="fk-sheet fk-statement"><div class="fk-sum">' + field(c, state) + ledger(c, r, v) + '</div><aside class="fk-rail">' + rateBlock(c, r, v, state.now) + split(c, r, v) + keep(c, r, v, true) + '</aside>' +
        '<div class="fk-stripwrap">' + strip(c, state.now) + '</div>' + mbar(c, v, state.now) + '</div>'
    }
    return head + body + notes(c) + live
  }

  function initialToggles(c) {
    var t = {}
    ;(c.toggles || []).forEach(function (x) { t[x.id] = x.default })
    return t
  }

  return {
    RP: RP, T: T, scaled: scaled, rdiv: rdiv, compute: compute, values: values, money: money, plain: plain, rateText: rateText,
    pctBp: pctBp, parse: parse, problem: problem, message: message, arrival: arrival, local: local, clock: clock, zoned: zoned,
    markup: markup, strip: strip, initialToggles: initialToggles, words: W, esc: esc, df: df, caseFor: caseFor, feeDetail: feeDetail,
  }
})()
if (typeof module !== 'undefined') module.exports = FeeEngine;
