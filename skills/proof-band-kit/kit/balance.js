// Proof Band Kit: optical balance for customer marks. One file, used twice:
// the page runs it to size every mark, and scripts/check.mjs loads the same
// file into the built page a second time to re-measure what was drawn and
// fail the run if the marks differ in weight or leave the shared baseline.
//
// measure(svgText) draws the SVG on a canvas 320 px tall and returns its
// real ink box (the whitespace inside the file's viewBox is cropped away),
// its aspect ratio, its ink density (inked area over ink box area) and its
// baseline, all in the file's own viewBox units.
//
// plan(metrics, options) gives every mark the same visual weight,
//   weight = width x height x density ^ densityWeight
// so a dense black slab is set smaller and a thin serif larger. The weight
// is the config's `area` at the median density, raised if any mark would
// fall under minHeight, and lowered if any mark would outgrow its cell
// (maxWidth, maxHeight). When no single weight fits every mark, plan()
// says which mark is the cause.
var ProofBalance = (function () {
  var RASTER = 320

  function viewBoxOf(svg) {
    var m = /viewBox\s*=\s*"([^"]+)"/.exec(svg)
    if (!m) return null
    var v = m[1].trim().split(/[\s,]+/).map(Number)
    return v.length === 4 && v.every(isFinite) && v[2] > 0 && v[3] > 0 ? v : null
  }

  function measure(svg) {
    var vb = viewBoxOf(svg)
    if (!vb) return Promise.reject(new Error('the SVG has no usable viewBox'))
    var bm = /data-baseline\s*=\s*"([^"]+)"/.exec(svg)
    var baseFrac = bm ? Number(bm[1]) : 1
    var bab = /data-base\s*=\s*"([^"]+)"/.exec(svg)
    var S = RASTER / vb[3]
    var W = Math.max(1, Math.ceil(vb[2] * S))
    var H = RASTER
    // draw black ink whatever the file's own colours or currentColor
    var text = svg.replace(/<svg\b/, '<svg width="' + W + '" height="' + H + '" fill="#000"')
    if (!/xmlns=/.test(text)) text = text.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"')
    return new Promise(function (resolve, reject) {
      var img = new Image()
      var url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
      img.onload = function () {
        try {
          var c = document.createElement('canvas')
          c.width = W
          c.height = H
          var g = c.getContext('2d', { willReadFrequently: true })
          g.drawImage(img, 0, 0, W, H)
          var d = g.getImageData(0, 0, W, H).data
          var x0 = W, y0 = H, x1 = -1, y1 = -1, ink = 0
          for (var y = 0; y < H; y++) {
            for (var x = 0; x < W; x++) {
              var a = d[(y * W + x) * 4 + 3]
              if (a > 24) {
                ink += a / 255
                if (x < x0) x0 = x
                if (x > x1) x1 = x
                if (y < y0) y0 = y
                if (y > y1) y1 = y
              }
            }
          }
          URL.revokeObjectURL(url)
          if (x1 < 0) return reject(new Error('the SVG draws nothing'))
          var w = x1 - x0 + 1, h = y1 - y0 + 1, p = 2
          var base = bab ? Number(bab[1]) : vb[1] + baseFrac * vb[3]
          resolve({
            vb: vb,
            // the ink box with 2 raster px of air, in viewBox units
            box: [vb[0] + (x0 - p) / S, vb[1] + (y0 - p) / S, (w + 2 * p) / S, (h + 2 * p) / S],
            ink: [vb[0] + x0 / S, vb[1] + y0 / S, w / S, h / S],
            aspect: w / h,
            density: ink / (w * h),
            base: base,
          })
        } catch (e) {
          reject(e)
        }
      }
      img.onerror = function () {
        URL.revokeObjectURL(url)
        reject(new Error('the SVG could not be drawn'))
      }
      img.src = url
    })
  }

  function weight(m, inkW, inkH, dw) {
    return inkW * inkH * Math.pow(m.density, dw == null ? 0.5 : dw)
  }

  function plan(ms, o) {
    var dw = o.densityWeight == null ? 0.5 : o.densityWeight
    var ds = ms.map(function (m) { return m.density }).sort(function (a, b) { return a - b })
    var dRef = ds[ds.length >> 1]
    var want = o.area * Math.pow(dRef, dw)
    var ceil = Infinity, floor = 0, ceilBy = -1, floorBy = -1
    ms.forEach(function (m, i) {
      var maxH = Math.min(o.maxHeight, o.maxWidth / m.aspect)
      var c = m.aspect * maxH * maxH * Math.pow(m.density, dw)
      var f = m.aspect * o.minHeight * o.minHeight * Math.pow(m.density, dw)
      if (c < ceil) { ceil = c; ceilBy = i }
      if (f > floor) { floor = f; floorBy = i }
    })
    var W = Math.min(Math.max(want, floor), ceil)
    var problems = []
    if (floor > ceil * 1.0001)
      problems.push({ mark: floorBy, other: ceilBy, why: 'cannot be ' + o.minHeight + ' px tall and still match the weight the widest mark can reach' })
    var sizes = ms.map(function (m) {
      var A = W / Math.pow(m.density, dw)
      var h = Math.sqrt(A / m.aspect)
      return { w: h * m.aspect, h: h }
    })
    return { sizes: sizes, weight: W, wanted: want, floor: floor, ceil: ceil, shrunk: W < want * 0.92, problems: problems }
  }

  return { RASTER: RASTER, measure: measure, plan: plan, weight: weight, viewBoxOf: viewBoxOf }
})()
