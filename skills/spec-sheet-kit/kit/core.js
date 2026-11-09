/* Spec Sheet Kit core: the drawing, the schedule and the unit maths.
 * One file, used twice: the build runs it in Node to write the page as it
 * first loads (and to check the geometry), and the page runs the same code
 * when the reader changes model, units or compare mode. No DOM in here. */
var SpecSheetCore = (function () {
  'use strict'

  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  var isObj = function (v) { return v && typeof v === 'object' && !Array.isArray(v) }
  /** A value that is either the same for every model or { modelId: value }. */
  var per = function (v, m) { return isObj(v) ? v[m] : v }
  var decimals = function (step) { var s = String(step); return s.indexOf('.') < 0 ? 0 : s.length - s.indexOf('.') - 1 }
  /** Rounds half away from zero to `step` (1, 0.5, 0.1, 0.01 ...) and prints it with the step's decimals. */
  function round(v, step) {
    var d = decimals(step), q = Math.round(Math.abs(v) / step + 1e-9) * step
    return (v < 0 ? '-' : '') + q.toFixed(d)
  }
  var MM_IN = 25.4, KG_LB = 2.2046226218

  /* ------------------------------------------------------------ quantities */

  function rows(spec) { var out = []; spec.groups.forEach(function (g) { (g.rows || []).forEach(function (r) { out.push(r) }) }); return out }
  function row(spec, key) { return rows(spec).filter(function (r) { return r.key === key })[0] }

  /** { n, u, alt } for a number, { t } for words. Metric is the source; the
   *  other unit is converted from it and rounded to the config's step. */
  function qty(spec, r, m, st) {
    var U = spec.units
    if (r.length !== undefined) {
      var mm = per(r.length, m), sm = round(mm, U.length.step.mm) + ' mm', si = round(mm / MM_IN, U.length.step.in) + ' in'
      return st.len === 'in' ? { n: si.split(' ')[0], u: 'in', alt: sm } : { n: sm.split(' ')[0], u: 'mm', alt: si }
    }
    if (r.mass !== undefined) {
      var kg = per(r.mass, m), sk = round(kg, U.mass.step.kg) + ' kg', sl = round(kg * KG_LB, U.mass.step.lb) + ' lb'
      return st.mass === 'lb' ? { n: sl.split(' ')[0], u: 'lb', alt: sk } : { n: sk.split(' ')[0], u: 'kg', alt: sl }
    }
    if (r.number !== undefined) return { n: String(per(r.number, m)), u: r.unit || '', alt: r.extra ? per(r.extra, m) : '' }
    return { t: per(r.text, m) }
  }
  var same = function (a, b) { return JSON.stringify(a) === JSON.stringify(b) }

  /* ------------------------------------------------------------- geometry */

  /** Path data for a shape: { d }, { circle: [cx, cy, r] }, { rect: [x, y, w, h], r? } or { poly: [[x, y] ...] }. */
  function shapeD(s) {
    if (s.d) return s.d
    if (s.circle) { var c = s.circle; return 'M' + (c[0] - c[2]) + ' ' + c[1] + 'A' + c[2] + ' ' + c[2] + ' 0 1 0 ' + (c[0] + c[2]) + ' ' + c[1] + 'A' + c[2] + ' ' + c[2] + ' 0 1 0 ' + (c[0] - c[2]) + ' ' + c[1] + 'Z' }
    if (s.rect) {
      var x = s.rect[0], y = s.rect[1], w = s.rect[2], h = s.rect[3], r = Math.min(s.r || 0, w / 2, h / 2)
      if (!r) return 'M' + x + ' ' + y + 'H' + (x + w) + 'V' + (y + h) + 'H' + x + 'Z'
      return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + (x + r) + 'Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - r) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Z'
    }
    if (s.poly) return s.poly.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1] }).join('') + (s.open ? '' : 'Z')
    return ''
  }

  /** The points a path passes through (curves sampled). Absolute M L H V C Q Z only. */
  function pathPoints(d) {
    var tok = String(d).match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [], i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, pts = [], bad = null
    var num = function () { return parseFloat(tok[i++]) }
    while (i < tok.length) {
      if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++]
      if (cmd === 'M') { x = num(); y = num(); sx = x; sy = y; pts.push([x, y]); cmd = 'L' }
      else if (cmd === 'L') { x = num(); y = num(); pts.push([x, y]) }
      else if (cmd === 'H') { x = num(); pts.push([x, y]) }
      else if (cmd === 'V') { y = num(); pts.push([x, y]) }
      else if (cmd === 'C' || cmd === 'Q') {
        var c = cmd === 'C' ? [num(), num(), num(), num()] : [num(), num()], ex = num(), ey = num()
        for (var t = 0.1; t <= 1.0001; t += 0.1) {
          var u = 1 - t, px, py
          if (cmd === 'C') { px = u * u * u * x + 3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t * t * t * ex; py = u * u * u * y + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * ey }
          else { px = u * u * x + 2 * u * t * c[0] + t * t * ex; py = u * u * y + 2 * u * t * c[1] + t * t * ey }
          pts.push([px, py])
        }
        x = ex; y = ey
      } else if (cmd === 'Z') { x = sx; y = sy }
      else { bad = cmd; break }
    }
    return bad ? { error: 'path command "' + bad + '" is not supported (use absolute M L H V C Q Z; for circles use "circle")' } : pts
  }

  /** [minX, minY, maxX, maxY] of a shape in product millimetres. */
  function shapeExt(s) {
    if (s.circle) return [s.circle[0] - s.circle[2], s.circle[1] - s.circle[2], s.circle[0] + s.circle[2], s.circle[1] + s.circle[2]]
    if (s.rect) return [s.rect[0], s.rect[1], s.rect[0] + s.rect[2], s.rect[1] + s.rect[3]]
    var pts = s.poly || pathPoints(s.d)
    if (pts.error) return null
    var e = [Infinity, Infinity, -Infinity, -Infinity]
    pts.forEach(function (p) { e[0] = Math.min(e[0], p[0]); e[1] = Math.min(e[1], p[1]); e[2] = Math.max(e[2], p[0]); e[3] = Math.max(e[3], p[1]) })
    return e
  }
  /** A shape moved onto the sheet: origin + p * scale, with y turned to point down. */
  function onSheet(s, v) {
    var o = v.origin, k = v.scale, X = function (x) { return Math.round((o[0] + x * k) * 1000) / 1000 }, Y = function (y) { return Math.round((o[1] - y * k) * 1000) / 1000 }
    if (s.circle) return { circle: [X(s.circle[0]), Y(s.circle[1]), Math.round(s.circle[2] * k * 1000) / 1000] }
    if (s.rect) return { rect: [X(s.rect[0]), Y(s.rect[1] + s.rect[3]), s.rect[2] * k, s.rect[3] * k], r: (s.r || 0) * k }
    if (s.poly) return { poly: s.poly.map(function (p) { return [X(p[0]), Y(p[1])] }), open: s.open }
    var tok = String(s.d).match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [], out = [], i = 0, cmd = ''
    while (i < tok.length) {
      if (/[A-Za-z]/.test(tok[i])) { cmd = tok[i++]; out.push(cmd); if (cmd === 'Z') continue }
      if (cmd === 'H') out.push(X(+tok[i++]))
      else if (cmd === 'V') out.push(Y(+tok[i++]))
      else { out.push(X(+tok[i++]) + ' ' + Y(+tok[i++])) }
    }
    return { d: out.join(' ').replace(/ ([A-Za-z])/g, '$1') }
  }
  var union = function (a, b) { return !a ? b : !b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] }

  /** A view as drawn for model m: the view, with that model's overrides on top. */
  function view(spec, v, m) {
    var o = (v.models && v.models[m]) || {}, out = {}
    for (var k in v) if (k !== 'models') out[k] = v[k]
    for (var j in o) out[j] = o[j]
    return out
  }
  function dim(d, m) {
    var o = (d.models && d.models[m]) || {}, out = {}
    for (var k in d) if (k !== 'models') out[k] = d[k]
    for (var j in o) out[j] = o[j]
    return out
  }
  /** What a dimension measures, in product mm. */
  function measure(d) { return d.kind === 'v' ? Math.abs(d.b[1] - d.a[1]) : Math.abs(d.b[0] - d.a[0]) }

  /** Links between the schedule and the drawing. */
  function links(spec, r) {
    var dims = spec.drawing.dims.filter(function (d) { return d.row === r.key }).map(function (d) { return d.row })
    return { parts: r.parts || [], dims: dims.length ? [r.key] : [] }
  }
  function partNo(spec, id) { var p = spec.drawing.parts.filter(function (x) { return x.id === id })[0]; return p ? p.no : '' }

  /** The view that shows a line best on a phone: its dimension's view, else the first that draws its part. */
  function viewForRow(spec, key, m) {
    var r = row(spec, key); if (!r) return null
    var d = spec.drawing.dims.filter(function (x) { return x.row === key })[0]
    if (d) return d.view
    var parts = r.parts || []
    var vs = spec.drawing.views.map(function (v) { return view(spec, v, m) })
    for (var i = 0; i < vs.length; i++) if (vs[i].shapes.some(function (s) { return parts.indexOf(s.part) >= 0 })) return vs[i].id
    return null
  }

  /* ------------------------------------------------------------- drawing */

  var LET = 'ABC'
  /** The figure a dimension shows: the value, or its letter when compared models differ. */
  function dimFig(spec, d, st) {
    var m = st.compare ? spec.drawn : st.model, r = row(spec, d.row)
    var differs = st.compare && spec.models.some(function (mm) { return !same(qty(spec, r, mm.id, st), qty(spec, r, m, st)) })
    if (differs && d.symbol) return d.symbol
    return (d.dia ? 'Ø' : '') + qty(spec, r, m, st).n
  }
  /**
   * The drawing as an SVG string.
   * st: { model, compare, len, mass }
   * o:  { k: sheet units per CSS px (screen), print: printed mm per sheet unit,
   *       only: a view id (the phone shows one view, cropped to it) }
   */
  function svg(spec, st, o) {
    var D = spec.drawing, W = 420, H = 297
    var m = st.compare ? spec.drawn : st.model
    var all = D.views.map(function (v) { return view(spec, v, m) })
    var views = all.filter(function (v) { return !o.only || v.id === o.only })
    var crop = o.only ? views[0].crop : null
    var vb = crop ? [crop[0], crop[1], crop[2] - crop[0], crop[3] - crop[1]] : [0, 0, W, H]
    var k = o.print ? 2.4 / 12 / o.print : o.k
    var pre = 'ss-' + (o.print ? 'p' : 's') + '-'
    var fs = 12 * k
    // line weights: drafting's 0.5 / 0.25 / 0.18 mm, held to a legible minimum on screen
    var wv, wt, wd
    if (o.print) { wv = 0.5 / o.print; wt = 0.25 / o.print; wd = 0.18 / o.print }
    else { wv = Math.max(0.5, 1.75 * k); wt = Math.max(0.25, 0.9 * k); wd = Math.max(0.18, 0.75 * k) }
    var P = function (v, p) { return [v.origin[0] + p[0] * v.scale, v.origin[1] - p[1] * v.scale] }
    var n = function (x) { return Math.round(x * 100) / 100 }
    var g = []
    g.push('<defs><pattern id="' + pre + 'hatch" width="' + n(fs * 0.5) + '" height="' + n(fs * 0.5) + '" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="ss-hb" width="' + n(fs * 0.5) + '" height="' + n(fs * 0.5) + '"/><line class="ss-hl" x1="0" y1="0" x2="0" y2="' + n(fs * 0.5) + '" stroke-width="' + n(wt * 1.1) + '"/></pattern>' +
      '<pattern id="' + pre + 'section" width="' + n(fs * 0.36) + '" height="' + n(fs * 0.36) + '" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="ss-sl" x1="0" y1="0" x2="0" y2="' + n(fs * 0.36) + '" stroke-width="' + n(wd) + '"/></pattern>' +
      views.filter(function (v) { return v.ring }).map(function (v) { return '<clipPath id="' + pre + 'clip-' + esc(v.id) + '"><circle cx="' + v.origin[0] + '" cy="' + v.origin[1] + '" r="' + v.ring + '"/></clipPath>' }).join('') + '</defs>')

    if (!crop) {
      g.push('<rect class="ss-frame" x="10" y="10" width="400" height="277"/>')
      for (var i = 0; i < 8; i++) {
        var zx = 10 + (i + 0.5) * 50
        g.push('<text class="ss-zone" x="' + zx + '" y="' + n(5 + fs * 0.35) + '" text-anchor="middle">' + (i + 1) + '</text><text class="ss-zone" x="' + zx + '" y="' + n(292 + fs * 0.35) + '" text-anchor="middle">' + (i + 1) + '</text>')
        if (i) g.push('<path class="ss-frame" d="M' + (10 + i * 50) + ' 10V6M' + (10 + i * 50) + ' 287V291"/>')
      }
      for (var j = 0; j < 6; j++) {
        var zy = 10 + (j + 0.5) * (277 / 6)
        g.push('<text class="ss-zone" x="5" y="' + n(zy + fs * 0.35) + '" text-anchor="middle">' + 'ABCDEF'[j] + '</text><text class="ss-zone" x="415" y="' + n(zy + fs * 0.35) + '" text-anchor="middle">' + 'ABCDEF'[j] + '</text>')
        if (j) g.push('<path class="ss-frame" d="M10 ' + n(10 + j * 277 / 6) + 'H6M410 ' + n(10 + j * 277 / 6) + 'H414"/>')
      }
    }

    views.forEach(function (v) {
      var clip = v.ring ? ' clip-path="url(#' + pre + 'clip-' + esc(v.id) + ')"' : ''
      if (v.ring) g.push('<circle class="ss-ring" cx="' + v.origin[0] + '" cy="' + v.origin[1] + '" r="' + v.ring + '"/>')
      // a detail view is clipped to its ring: the clip sits on an untransformed group
      if (clip) g.push('<g' + clip + '>')
      v.shapes.forEach(function (s) {
        var cls = 'ss-part' + (s.open ? ' ss-open' : '') + (s.section ? ' ss-sec' : '') + (s.line === 'hidden' ? ' ss-hid' : '')
        g.push('<path class="' + cls + '" data-part="' + esc(s.part) + '" d="' + shapeD(onSheet(s, v)) + '"' + (s.section ? ' fill-rule="evenodd"' : '') + '/>')
      })
      ;(v.centers || []).forEach(function (c) {
        var p = P(v, c), R = c[2] * v.scale + fs * 0.45
        g.push('<path class="ss-ctr" d="M' + n(p[0] - R) + ' ' + n(p[1]) + 'H' + n(p[0] + R) + 'M' + n(p[0]) + ' ' + n(p[1] - R) + 'V' + n(p[1] + R) + '"/>')
      })
      if (clip) g.push('</g>')
      // other models as phantom lines, with A B C at their ends
      if (st.compare && v.outline) {
        spec.models.forEach(function (mm, ix) {
          var vo = view(spec, D.views.filter(function (x) { return x.id === v.id })[0], mm.id)
          if (mm.id !== m) g.push('<path class="ss-ph" d="' + shapeD(onSheet(vo.outline, v)) + '"/>')
          if (v.tags) {
            var e = shapeExt(vo.outline), q = P(v, [e[2], e[3]])
            g.push('<path class="ss-ext" d="M' + n(q[0]) + ' ' + n(q[1] - fs * 0.2) + 'V' + n(q[1] - fs * 0.9) + '"/><text class="' + (mm.id === m ? 'ss-vl' : 'ss-vs') + '" x="' + n(q[0]) + '" y="' + n(q[1] - fs * 1.15) + '" text-anchor="middle">' + LET[ix] + '</text>')
          }
        })
      }
      if (v.detail) {
        var dp = P(v, v.detail.at)
        g.push('<circle class="ss-ring" cx="' + n(dp[0]) + '" cy="' + n(dp[1]) + '" r="' + v.detail.r + '"/><text class="ss-vl" x="' + n(dp[0] - v.detail.r - fs * 0.25) + '" y="' + n(dp[1] - v.detail.r) + '" text-anchor="end">' + esc(v.detail.letter) + '</text>')
      }
      if (v.cut) {
        var top = P(v, [v.cut.x, v.cut.from]), bot = P(v, [v.cut.x, v.cut.to])
        g.push('<path class="ss-cut" d="M' + n(top[0]) + ' ' + n(top[1]) + 'V' + n(bot[1]) + '"/>')
        ;[top[1], bot[1]].forEach(function (yy) {
          g.push('<path class="ss-cutar" d="M' + n(top[0]) + ' ' + n(yy) + 'h' + n(fs * 0.7) + '"/><path class="ss-arr" d="M' + n(top[0] + fs * 0.9) + ' ' + n(yy) + 'l' + n(-fs * 0.42) + ' ' + n(-fs * 0.15) + 'v' + n(fs * 0.3) + 'z"/><text class="ss-vl" x="' + n(top[0] + fs * 1.05) + '" y="' + n(yy + fs * 0.35) + '">' + esc(v.cut.letter) + '</text>')
        })
      }
      if (!crop) {
        var la = v.label_at || [v.origin[0], v.origin[1] + 10, 'middle']
        g.push('<text class="ss-vl" x="' + la[0] + '" y="' + la[1] + '" text-anchor="' + (la[2] || 'middle') + '">' + esc(v.label.toUpperCase()) + '</text>' +
          (v.sub ? '<text class="ss-vs" x="' + la[0] + '" y="' + n(la[1] + fs * 1.35) + '" text-anchor="' + (la[2] || 'middle') + '">' + esc(v.sub.toUpperCase()) + '</text>' : ''))
      }
    })

    // dimensions
    var V = {}; views.forEach(function (v) { V[v.id] = v })
    var di = 0
    D.dims.forEach(function (d0) {
      var d = dim(d0, m), v = V[d.view]; if (!v) return
      var fig = dimFig(spec, d0, st)
      var A = P(v, d.a), B = P(v, d.b), ah = fs * 0.46, aw = fs * 0.14, gap = fs * 0.2, over = fs * 0.32
      var s = '<g class="ss-dim" data-dim="' + esc(d.row) + '" data-fig="' + esc(fig) + '" data-i="' + di++ + '">'
      if (d.kind === 'h') {
        var sg = d.offset < 0 ? -1 : 1, yd = (sg < 0 ? Math.min(A[1], B[1]) : Math.max(A[1], B[1])) + d.offset, mx = (A[0] + B[0]) / 2
        ;[A, B].forEach(function (p) { s += '<path class="ss-ext" pathLength="1" d="M' + n(p[0]) + ' ' + n(p[1] + gap * sg) + 'V' + n(yd + over * sg) + '"/>' })
        s += '<path class="ss-dl" pathLength="1" d="M' + n(mx) + ' ' + n(yd) + 'H' + n(A[0]) + '"/><path class="ss-dl" pathLength="1" d="M' + n(mx) + ' ' + n(yd) + 'H' + n(B[0]) + '"/>'
        var l = Math.min(A[0], B[0]), rr = Math.max(A[0], B[0])
        s += '<path class="ss-arr" d="M' + n(l) + ' ' + n(yd) + 'l' + n(ah) + ' ' + n(-aw) + 'v' + n(2 * aw) + 'z"/><path class="ss-arr" d="M' + n(rr) + ' ' + n(yd) + 'l' + n(-ah) + ' ' + n(-aw) + 'v' + n(2 * aw) + 'z"/>'
        s += '<text class="ss-fig" x="' + n(mx) + '" y="' + n(yd - fs * 0.32) + '" text-anchor="middle">' + esc(fig) + '</text>'
      } else {
        var sv = d.offset < 0 ? -1 : 1, xd = (sv < 0 ? Math.min(A[0], B[0]) : Math.max(A[0], B[0])) + d.offset, my = (A[1] + B[1]) / 2
        ;[A, B].forEach(function (p) { s += '<path class="ss-ext" pathLength="1" d="M' + n(p[0] + gap * sv) + ' ' + n(p[1]) + 'H' + n(xd + over * sv) + '"/>' })
        s += '<path class="ss-dl" pathLength="1" d="M' + n(xd) + ' ' + n(my) + 'V' + n(A[1]) + '"/><path class="ss-dl" pathLength="1" d="M' + n(xd) + ' ' + n(my) + 'V' + n(B[1]) + '"/>'
        var tp = Math.min(A[1], B[1]), bt = Math.max(A[1], B[1])
        s += '<path class="ss-arr" d="M' + n(xd) + ' ' + n(tp) + 'l' + n(-aw) + ' ' + n(ah) + 'h' + n(2 * aw) + 'z"/><path class="ss-arr" d="M' + n(xd) + ' ' + n(bt) + 'l' + n(-aw) + ' ' + n(-ah) + 'h' + n(2 * aw) + 'z"/>'
        s += '<text class="ss-fig" transform="translate(' + n(xd - fs * 0.32) + ' ' + n(my) + ') rotate(-90)" text-anchor="middle">' + esc(fig) + '</text>'
      }
      g.push(s + '</g>')
    })

    // balloons
    var br = fs * 0.95
    views.forEach(function (v) {
      ;(v.balloons || []).forEach(function (b) {
        var a = P(v, b.at), cx = a[0] + b.offset[0], cy = a[1] + b.offset[1], dx = a[0] - cx, dy = a[1] - cy, dl = Math.hypot(dx, dy) || 1
        g.push('<g class="ss-bal" data-part="' + esc(b.part) + '"><path class="ss-lead" d="M' + n(cx + dx / dl * br) + ' ' + n(cy + dy / dl * br) + 'L' + n(a[0]) + ' ' + n(a[1]) + '"/><circle class="ss-dot" cx="' + n(a[0]) + '" cy="' + n(a[1]) + '" r="' + n(fs * 0.17) + '"/><circle class="ss-bc" cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(br) + '"/><text x="' + n(cx) + '" y="' + n(cy + fs * 0.35) + '" text-anchor="middle">' + partNo(spec, b.part) + '</text></g>')
      })
    })

    if (!crop) {
      // tabulation block: dimensions that change between models, by letter
      if (st.compare && D.tab) {
        var tabbed = D.dims.filter(function (d) { var r = row(spec, d.row); return d.symbol && spec.models.some(function (mm) { return !same(qty(spec, r, mm.id, st), qty(spec, r, m, st)) }) })
        if (tabbed.length) {
          var x0 = D.tab[0], y0 = D.tab[1], cw = fs * 4.6, rh = fs * 2, cols = spec.models.length + 1
          var tb = '<g class="ss-tb"><rect x="' + x0 + '" y="' + y0 + '" width="' + n(cw * cols) + '" height="' + n(rh * (tabbed.length + 1)) + '"/>'
          tb += '<text class="ss-tl" x="' + n(x0 + fs * 0.4) + '" y="' + n(y0 + rh * 0.68) + '">DIM</text>'
          spec.models.forEach(function (mm, ix) { tb += '<path d="M' + n(x0 + cw * (ix + 1)) + ' ' + y0 + 'V' + n(y0 + rh * (tabbed.length + 1)) + '"/><text class="ss-tl" x="' + n(x0 + cw * (ix + 1) + fs * 0.4) + '" y="' + n(y0 + rh * 0.68) + '">' + LET[ix] + '</text>' })
          tabbed.forEach(function (d, r) {
            var yy = y0 + rh * (r + 1)
            tb += '<path d="M' + x0 + ' ' + n(yy) + 'H' + n(x0 + cw * cols) + '"/><text class="ss-tv" x="' + n(x0 + fs * 0.4) + '" y="' + n(yy + rh * 0.68) + '">' + esc(d.symbol) + '</text>'
            spec.models.forEach(function (mm, ix) { tb += '<text x="' + n(x0 + cw * (ix + 1) + fs * 0.4) + '" y="' + n(yy + rh * 0.68) + '">' + esc(qty(spec, row(spec, d.row), mm.id, st).n) + '</text>' })
          })
          g.push(tb + '<text class="ss-note" x="' + x0 + '" y="' + n(y0 + rh * (tabbed.length + 1) + fs * 1.4) + '">' + esc(D.tabNote || (function () { var me = spec.models.map(function (x) { return x.id }).indexOf(m), o = spec.models.map(function (x, i) { return LET[i] }).filter(function (l, i) { return i !== me }); return LET[me] + ' solid; ' + o.join(' and ') + ' phantom.' })()) + '</text></g>')
        }
      }
      // notes, written from the config's units, rounding and tolerance
      var nt = D.notes_at, notes = ['NOTES', '1. Dimensions in ' + (st.len === 'in' ? 'inches' : 'mm') + '.',
        '2. Inches rounded to ' + spec.units.length.step.in + ' in.', '3. Pounds rounded to ' + spec.units.mass.step.lb + ' lb.', '4. ' + D.toleranceNote]
      notes.forEach(function (t, ix) { g.push('<text class="' + (ix ? 'ss-note' : 'ss-vl') + '" x="' + nt[0] + '" y="' + n(nt[1] + ix * fs * 1.45) + '">' + esc(t) + '</text>') })
      // title block
      var T = D.title_block, tx = T[0], ty = T[1], tw = T[2], th = T[3], r1 = ty + th / 3, r2 = ty + 2 * th / 3
      var c1 = tx + T[4][0], c2 = tx + T[4][1], c3 = tx + T[4][2]
      var tbk = '<g class="ss-tb"><rect x="' + tx + '" y="' + ty + '" width="' + tw + '" height="' + th + '"/><path d="M' + tx + ' ' + n(r1) + 'H' + (tx + tw) + 'M' + tx + ' ' + n(r2) + 'H' + (tx + tw) + 'M' + c1 + ' ' + n(r2) + 'V' + (ty + th) + 'M' + c2 + ' ' + n(r2) + 'V' + (ty + th) + 'M' + c3 + ' ' + ty + 'V' + (ty + th) + '"/>'
      var cell = function (x, y, lab, val) { return '<text class="ss-tl" x="' + n(x + fs * 0.35) + '" y="' + n(y + fs * 1.0) + '">' + esc(lab) + '</text><text class="ss-tv" x="' + n(x + fs * 0.35) + '" y="' + n(y + th / 3 - fs * 0.3) + '">' + esc(val) + '</text>' }
      var title = st.compare ? spec.models.map(function (x) { return x.name }).join(' / ') : spec.models.filter(function (x) { return x.id === m })[0].name
      tbk += '<text class="ss-tbrand" x="' + n(tx + fs * 0.35) + '" y="' + n(ty + th / 6 + fs * 0.4) + '">' + esc(spec.brand.toUpperCase()) + '</text>'
      tbk += cell(tx, r1, 'TITLE', title) + cell(tx, r2, 'DWG NO', D.number) + cell(c1, r2, 'SCALE', D.scale) + cell(c2, r2, 'UNITS', st.len.toUpperCase())
      tbk += cell(c3, ty, 'REV', D.rev) + cell(c3, r1, 'SHEET', '1 / 1')
      // projection symbol: a truncated cone in elevation and end view
      var sh = Math.min(th / 3 - fs * 1.0, (tx + tw - c3 - fs * 1.2) / 3.1), sy = r2 + (th / 3 - sh) / 2, sx = c3 + fs * 0.6, cone = 'M' + n(sx) + ' ' + n(sy + sh * 0.18) + 'L' + n(sx + sh * 1.15) + ' ' + n(sy) + 'V' + n(sy + sh) + 'L' + n(sx) + ' ' + n(sy + sh * 0.82) + 'Z'
      var ex = sx + sh * 2.5, ends = '<circle cx="' + n(ex) + '" cy="' + n(sy + sh / 2) + '" r="' + n(sh / 2) + '"/><circle cx="' + n(ex) + '" cy="' + n(sy + sh / 2) + '" r="' + n(sh * 0.2) + '"/>'
      if (D.projection === 'first') { var ex2 = sx + sh * 0.5; ends = '<circle cx="' + n(ex2) + '" cy="' + n(sy + sh / 2) + '" r="' + n(sh / 2) + '"/><circle cx="' + n(ex2) + '" cy="' + n(sy + sh / 2) + '" r="' + n(sh * 0.2) + '"/>'; cone = cone.replace(/M[\d.]+ /, 'M' + n(sx + sh * 1.4) + ' ').replace(/L[\d.]+ /, 'L' + n(sx + sh * 2.55) + ' ').replace(/L[\d.]+ ([\d.]+)Z/, 'L' + n(sx + sh * 1.4) + ' $1Z') }
      tbk += '<path class="ss-sym" d="' + cone + '"/><g class="ss-sym">' + ends + '</g></g>'
      g.push(tbk)
    }
    var style = '--w-vis:' + n(wv * 1000) / 1000 + 'px;--w-thin:' + n(wt * 1000) / 1000 + 'px;--w-dim:' + n(wd * 1000) / 1000 + 'px;--fs:' + n(fs) + 'px'
    return { viewBox: vb.map(n).join(' '), style: style, body: g.join('') }
  }

  /* ------------------------------------------------------------- schedule */

  var GLYPH = '<svg viewBox="0 0 22 10" aria-hidden="true"><path d="M1 1v8M21 1v8M2 5h18" fill="none" stroke-width="1.2"/><path d="M2 5l4-2v4zM20 5l-4-2v4z" stroke="none"/></svg>'

  function mark(spec, r) {
    var l = links(spec, r)
    if (l.dims.length) return '<td class="ss-mk"><span class="ss-dg" title="Dimension on the drawing">' + GLYPH + '<span class="ss-sr">dimension</span></span></td>'
    if (l.parts.length) return '<td class="ss-mk"><span class="ss-bn"><span class="ss-sr">part </span>' + partNo(spec, l.parts[0]) + '</span></td>'
    return '<td class="ss-mk"></td>'
  }
  function cellHTML(q) {
    return q.t !== undefined ? esc(q.t) : '<span class="ss-n">' + esc(q.n) + '</span>' + (q.u ? '<span class="ss-u">' + esc(q.u) + '</span>' : '')
  }

  /** The schedule's tables (groups with rows), as HTML. */
  function schedule(spec, st) {
    var ms = st.compare ? spec.models : spec.models.filter(function (x) { return x.id === st.model })
    var out = [], first = true
    spec.groups.forEach(function (g, gi) {
      if (!g.rows) return
      var id = 'ss-g' + gi
      var h = '<section class="ss-grp" aria-labelledby="' + id + '"><h3 id="' + id + '"><span>' + 'ABCDEFGH'[gi] + '</span><span>' + esc(g.title) + '</span><span>' + g.rows.length + ' lines</span></h3>'
      h += '<table class="ss-t' + (st.compare ? ' ss-cmp' : '') + '" style="--n:' + ms.length + '" aria-labelledby="' + id + '">'
      if (st.compare) h += '<thead class="' + (first ? '' : 'ss-sr') + '"><tr><td></td><th scope="col">Compared</th>' + ms.map(function (x, ix) { return '<th scope="col"><span>' + LET[ix] + ', ' + (x.id === spec.drawn ? 'drawn' : 'phantom') + '</span>' + esc(x.name) + '</th>' }).join('') + '</tr></thead>'
      else h += '<thead class="ss-sr"><tr><td></td><th scope="col">Specification</th><th scope="col">' + esc(ms[0].name) + '</th><th scope="col">Converted</th></tr></thead>'
      h += '<tbody>'
      g.rows.forEach(function (r) {
        var l = links(spec, r), linked = l.parts.length || l.dims.length
        var attrs = ' data-k="' + esc(r.key) + '"' + (linked ? ' tabindex="0" class="ss-r ss-link" data-parts="' + esc(l.parts.join(' ')) + '"' : ' class="ss-r"')
        var lab = function (delta) { return '<th scope="row" class="ss-lb">' + (delta ? '<i class="ss-delta" aria-label="differs between models"></i>' : '') + esc(r.label) + (r.note ? '<small>' + esc(r.note) + '</small>' : '') + '</th>' }
        if (st.compare) {
          var qs = ms.map(function (x) { return qty(spec, r, x.id, st) }), all = qs.every(function (q) { return same(q, qs[0]) })
          h += '<tr' + attrs.replace('class="ss-r', 'class="ss-r' + (all ? '' : ' ss-diff')) + '>' + mark(spec, r) + lab(!all) +
            (all ? '<td class="ss-v ss-same" colspan="' + ms.length + '"><span class="ss-tw">' + cellHTML(qs[0]) + '</span></td>' : qs.map(function (q) { return '<td class="ss-v">' + cellHTML(q) + '</td>' }).join('')) + '</tr>'
        } else {
          var q = qty(spec, r, st.model, st)
          h += '<tr' + attrs + '>' + mark(spec, r) + lab(false) + (q.t !== undefined ? '<td class="ss-v ss-tx" colspan="2">' + cellHTML(q) + '</td>' : '<td class="ss-v">' + cellHTML(q) + '</td><td class="ss-al">' + esc(q.alt || '') + '</td>') + '</tr>'
        }
      })
      out.push(h + '</tbody></table></section>')
      first = false
    })
    return out.join('')
  }

  /** The groups that are lists (in the box) or marks (compliance). */
  function aside(spec) {
    return spec.groups.map(function (g, gi) {
      if (g.rows) return ''
      var id = 'ss-g' + gi, head = '<h3 id="' + id + '"><span>' + 'ABCDEFGH'[gi] + '</span><span>' + esc(g.title) + '</span><span>' + (g.list ? g.list.length + ' items' : g.marks.length + ' marks') + '</span></h3>'
      if (g.list) return '<section class="ss-grp" aria-labelledby="' + id + '">' + head + '<ol class="ss-box">' + g.list.map(function (x, i) { return '<li><span>' + (i < 9 ? '0' : '') + (i + 1) + '</span>' + esc(x) + '</li>' }).join('') + '</ol></section>'
      return '<section class="ss-grp" aria-labelledby="' + id + '">' + head + '<ul class="ss-marks">' + g.marks.map(function (x) { return '<li>' + esc(x) + '</li>' }).join('') + '</ul></section>'
    }).join('')
  }

  return { esc: esc, per: per, round: round, rows: rows, row: row, qty: qty, same: same, shapeD: shapeD, pathPoints: pathPoints, shapeExt: shapeExt, onSheet: onSheet, union: union, view: view, dim: dim, measure: measure, links: links, viewForRow: viewForRow, dimFig: dimFig, svg: svg, schedule: schedule, aside: aside }
})()
if (typeof module !== "undefined" && module.exports) module.exports = SpecSheetCore;
