// Still-life objects for the Shop Collection Kit's example photographs: thrown ceramics
// and small jewellery, built from code. Units are centimetres, products stand
// on y = 0 facing +z. studio.js gives each part its `mat` (physical params).
/* global THREE, Shapes */
window.Objects = (() => {
  const T = THREE
  const TAU = Math.PI * 2
  const { profile, lathe, surface } = Shapes

  function rng(seed) {
    let s = seed >>> 0 || 1
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
  }
  function bez(a, c1, c2, b, n = 18) {
    const out = []
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      out.push([
        u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
        u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
        0,
        true,
      ])
    }
    return out
  }
  // Throwing lines: a faint ridge every `pitch` cm up the outer wall.
  function throwing(pts, amp, pitch, from, to) {
    return pts.map((p) => {
      if (p[1] < from || p[1] > to) return p
      const k = Math.sin((p[1] / pitch) * TAU) * amp * Math.sin(((p[1] - from) / (to - from)) * Math.PI)
      return [p[0] + k, p[1], p[2], p[3]]
    })
  }
  function dense(pts, step = 0.08) {
    // Splits long straight runs so throwing lines and normals stay smooth.
    const out = [pts[0]]
    for (let i = 1; i < pts.length; i++) {
      const a = out.at(-1)
      const b = pts[i]
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step))
      if (b[2] || n === 1) {
        out.push(b)
        continue
      }
      for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, k === n ? b[2] : 0, true])
    }
    return out
  }

  const hex = (c) => {
    const x = new T.Color(c)
    return [x.r * 255, x.g * 255, x.b * 255]
  }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

  /**
   * Glaze over clay on a thrown pot. v runs along the profile (0 at the
   * underside centre, 1 inside at the bottom); the glaze stops at footY on
   * the outside with a wavy edge and a drip or two, breaks lighter over the
   * rim and pools darker inside.
   */
  function potMaterial(prof, o, stampR = 0) {
    const total = prof.at(-1).s
    let rimI = 0
    prof.forEach((p, i) => p.y > prof[rimI].y && (rimI = i))
    const vRim = prof[rimI].s / total
    let footI = prof.findIndex((p, i) => i < rimI && p.y >= o.footY && p.r > 0.5)
    const vFoot = prof[footI].s / total
    // inner bottom: points after the rim lower than poolY
    let poolI = prof.findIndex((p, i) => i > rimI && p.y < (o.poolY ?? 0))
    const vPool = poolI > 0 ? prof[poolI].s / total : 2
    const W = 2048
    const H = 2048
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const x = c.getContext('2d')
    const img = x.createImageData(W, H)
    const r = document.createElement('canvas')
    r.width = W
    r.height = H
    const rx = r.getContext('2d')
    const rimg = rx.createImageData(W, H)
    const rand = rng(o.seed || 7)
    // periodic-in-u value noise for glaze mottling
    const lat = Array.from({ length: 64 * 64 }, rand)
    const noise = (a, b, pa) => {
      const i = Math.floor(a)
      const j = Math.floor(b)
      const fa = a - i
      const fb = b - j
      const L = (x, y) => lat[(((x % pa) + pa) % pa) * 64 + (((y % 64) + 64) % 64)]
      const sa = fa * fa * (3 - 2 * fa)
      const sb = fb * fb * (3 - 2 * fb)
      const top = L(i, j) + (L(i + 1, j) - L(i, j)) * sa
      const bot = L(i, j + 1) + (L(i + 1, j + 1) - L(i, j + 1)) * sa
      return top + (bot - top) * sb
    }
    const glaze = hex(o.glaze)
    const brk = hex(o.rim || o.glaze)
    const pool = hex(o.pool || o.glaze)
    const clay = hex(o.clay || '#c9b49a')
    // drips along the glaze edge
    const drips = Array.from({ length: o.drips ?? 3 }, () => ({ u: rand(), w: 0.01 + rand() * 0.025, d: 0.01 + rand() * 0.03 }))
    const wav = (u) => {
      let e = 0.004 * Math.sin(u * TAU * 3 + 1.3) + 0.003 * Math.sin(u * TAU * 7 + 0.2)
      for (const d of drips) {
        let du = Math.abs(u - d.u)
        du = Math.min(du, 1 - du)
        if (du < d.w) e -= d.d * Math.cos((du / d.w) * Math.PI * 0.5) ** 2
      }
      return e
    }
    const edges = new Float32Array(W)
    for (let i = 0; i < W; i++) edges[i] = vFoot + wav(i / W)
    for (let yy = 0; yy < H; yy++) {
      const v = 1 - (yy + 0.5) / H
      for (let xx = 0; xx < W; xx++) {
        const u = xx / W
        const k = (yy * W + xx) * 4
        let col
        let rough
        const e = edges[xx]
        if (v < e && v < vRim) {
          col = clay
          const n = 0.94 + 0.06 * Math.sin(u * 300 + v * 900) * Math.sin(u * 130)
          col = [col[0] * n, col[1] * n, col[2] * n]
          rough = 230
        } else {
          col = glaze
          // thinner glaze just above the edge and over the rim: breaks to the rim colour
          const nearEdge = Math.max(0, 1 - (v - e) / 0.035)
          const nearRim = Math.max(0, 1 - Math.abs(v - vRim) / (o.rimW ?? 0.03))
          col = mix(col, brk, Math.min(1, nearEdge * 0.7 + nearRim * 0.85))
          if (v > vPool) col = mix(col, pool, Math.min(1, (v - vPool) / 0.05) * 0.85)
          const mott = 1 + (o.mottle ?? 0.035) * 2 * (noise(u * 9, v * 14, 9) - 0.5 + 0.5 * (noise(u * 23 + 23, v * 40, 23) - 0.5))
          col = [col[0] * mott, col[1] * mott, col[2] * mott]
          rough = o.satin ? 120 : 50
        }
        img.data[k] = col[0]
        img.data[k + 1] = col[1]
        img.data[k + 2] = col[2]
        img.data[k + 3] = 255
        rimg.data[k] = rough > 200 ? 0 : 255
        rimg.data[k + 1] = rough
        rimg.data[k + 2] = rough > 200 ? 0 : 255 // clearcoat map uses red? (we use blue via separate)
        rimg.data[k + 3] = 255
      }
    }
    x.putImageData(img, 0, 0)
    rx.putImageData(rimg, 0, 0)
    // iron speckle
    const speck = (o.speck ?? 900) * 2.2
    for (let i = 0; i < speck; i++) {
      const u = rand()
      const v = rand()
      const q = rand()
      const rr = (0.35 + q * q * q * 2.2) * (o.speckSize ?? 1) * (W / 1024)
      x.fillStyle = `rgba(${o.speckColor || '60,40,28'},${0.35 + rand() * 0.5})`
      x.beginPath()
      // squash horizontally less near the axis is not worth it; small dots
      x.ellipse(u * W, (1 - v) * H, rr * 1.4, rr, 0, 0, TAU)
      x.fill()
    }
    // the maker's stamp, pressed into the clay at the centre of the foot: drawn
    // flat, then carried onto the profile's polar (u, v) so it can be cut in
    let normalMap = null
    if (o.stamp && stampR) {
      const flat = heights(512, 512, (x) => {
        x.lineWidth = 16
        x.beginPath()
        x.arc(256, 256, 150, 0, TAU)
        x.stroke()
        x.font = '600 170px Georgia, "Times New Roman", serif'
        x.textAlign = 'center'
        x.textBaseline = 'middle'
        x.fillText(o.stamp, 256, 268)
      }, 3)
      const fd = flat.getContext('2d').getImageData(0, 0, 512, 512).data
      const hc = document.createElement('canvas')
      hc.width = W
      hc.height = H
      const hx = hc.getContext('2d')
      const hi = hx.createImageData(W, H)
      hi.data.fill(255)
      const rows = Math.ceil((stampR / total) * H) + 2
      for (let yy = H - rows; yy < H; yy++) {
        const sArc = (1 - (yy + 0.5) / H) * total
        if (sArc > stampR) continue
        for (let xx = 0; xx < W; xx++) {
          const phi = -Math.PI + ((xx + 0.5) / W) * TAU
          const px = sArc * Math.sin(phi)
          const pz = sArc * Math.cos(phi)
          const fx = Math.min(511, Math.max(0, Math.round((0.5 + px / (2 * stampR)) * 511)))
          const fy = Math.min(511, Math.max(0, Math.round((0.5 - pz / (2 * stampR)) * 511)))
          const k = (yy * W + xx) * 4
          const vv = fd[(fy * 512 + fx) * 4]
          hi.data[k] = hi.data[k + 1] = hi.data[k + 2] = vv
        }
      }
      hx.putImageData(hi, 0, 0)
      x.save()
      x.globalCompositeOperation = 'multiply'
      x.globalAlpha = 0.3
      x.drawImage(hc, 0, 0)
      x.restore()
      normalMap = engrave(hc, 5)
    }
    const map = new T.CanvasTexture(c)
    map.colorSpace = T.SRGBColorSpace
    map.anisotropy = 8
    const rmap = new T.CanvasTexture(r)
    return {
      ...(normalMap ? { normalMap } : {}),
      map,
      roughness: 1,
      roughnessMap: rmap,
      clearcoatMap: rmap,
      clearcoat: o.satin ? 0.25 : 0.7,
      clearcoatRoughness: o.satin ? 0.35 : 0.08,
      envMapIntensity: o.env ?? 0.9,
    }
  }

  /**
   * Engraving: turns a height canvas (white = surface, black = cut) into a
   * normal map, so a stamp or hallmark is a recess with a lit edge rather
   * than a printed mark. `k` is how steep the walls are.
   */
  function engrave(hc, k = 6) {
    const w = hc.width
    const h = hc.height
    const src = hc.getContext('2d').getImageData(0, 0, w, h).data
    const H = (x, y) => src[((Math.min(h - 1, Math.max(0, y)) * w + ((x + w) % w)) * 4)] / 255
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d')
    const img = x.createImageData(w, h)
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const dx = (H(xx - 1, yy) - H(xx + 1, yy)) * k
        const dy = (H(xx, yy - 1) - H(xx, yy + 1)) * k
        const l = Math.hypot(dx, dy, 1)
        const i = (yy * w + xx) * 4
        img.data[i] = (dx / l) * 127.5 + 127.5
        img.data[i + 1] = (-dy / l) * 127.5 + 127.5
        img.data[i + 2] = (1 / l) * 127.5 + 127.5
        img.data[i + 3] = 255
      }
    x.putImageData(img, 0, 0)
    return new T.CanvasTexture(c)
  }

  /** A canvas of `w`×`h` with `draw(ctx)` cut into it, blurred to a bevel. */
  function heights(w, h, draw, blur = 1.6) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d')
    x.fillStyle = '#fff'
    x.fillRect(0, 0, w, h)
    x.filter = `blur(${blur}px)`
    x.fillStyle = '#000'
    x.strokeStyle = '#000'
    draw(x)
    return c
  }

  function finishPot(prof, o, H, Rmax, stampY, stampR) {
    const geo = lathe(prof, { seg: 220 })
    const parts = [{ geo, role: 'pot', mat: potMaterial(prof, o, o.stamp ? stampR : 0), normalScale: o.stamp ? 1.4 : undefined }]
    if (o.flip) {
      for (const p of parts) {
        p.geo.rotateX(Math.PI)
        p.geo.translate(0, H, 0)
      }
    }
    if (o.lay) {
      // on its side, foot toward the camera's left
      for (const p of parts) {
        p.geo.rotateZ(Math.PI / 2)
        p.geo.translate(H * 0.5, o.layR ?? Rmax, 0)
        p.geo.rotateY(o.lay)
      }
      return { parts, size: [H, Rmax * 2, H] }
    }
    return { parts, size: [Rmax * 2, H, Rmax * 2] }
  }

  // ---------- ceramics ----------
  function bowl(o) {
    const s = o.scale || 1
    const R = 7.5 * s
    const H = (o.h || 7) * s
    const fr = R * 0.42
    const outer = [
      [0, 0.3 * s],
      [fr - 0.25 * s, 0.3 * s, 0.1 * s],
      [fr - 0.15 * s, 0, 0.06 * s],
      [fr + 0.45 * s, 0, 0.08 * s],
      [fr + 0.65 * s, 0.55 * s, 0.12 * s],
      ...bez([fr + 0.65 * s, 0.55 * s], [R * 0.86, 0.75 * s], [R * 0.99, H * 0.55], [R, H], 30),
    ]
    const inner = [
      ...bez([R - 0.32 * s, H - 0.08 * s], [R * 0.95, H * 0.5], [R * 0.7, 1.0 * s], [0, 0.95 * s], 30),
    ]
    let pts = [...outer, ...inner]
    pts = throwing(pts, 0.025 * s, 0.9 * s, 1.2 * s, H - 0.6 * s)
    pts[outer.length - 1][2] = 0.16 * s // rim fillet
    const prof = profile(pts)
    return finishPot(prof, { footY: o.footY ?? 0.9 * s, poolY: 2.2 * s, ...o }, H, R, 0.3 * s, fr * 0.6)
  }

  function plate(o) {
    const s = o.scale || 1
    const R = 12 * s
    const H = 2.6 * s
    const fr = R * 0.6
    const pts = [
      [0, 0.28 * s],
      [fr - 0.3 * s, 0.28 * s, 0.1 * s],
      [fr - 0.2 * s, 0, 0.05 * s],
      [fr + 0.5 * s, 0, 0.08 * s],
      [fr + 0.8 * s, 0.45 * s, 0.2 * s],
      ...bez([fr + 0.8 * s, 0.45 * s], [R * 0.86, 0.6 * s], [R * 0.97, H * 0.7], [R, H], 22),
      ...bez([R - 0.35 * s, H - 0.05 * s], [R * 0.93, H * 0.6], [R * 0.8, 0.95 * s], [fr + 0.4 * s, 0.82 * s], 18),
      [0, 0.8 * s],
    ]
    pts[5 + 21][2] = 0.15 * s
    const prof = profile(dense(pts, 0.25 * s))
    return finishPot(prof, { footY: 0.5 * s, poolY: 0.9 * s, rimW: 0.02, ...o }, H, R, 0.28 * s, fr * 0.5)
  }

  function cup(o) {
    const s = o.scale || 1
    const R = 4.0 * s
    const H = (o.h || 9.5) * s
    const pts = [
      [0, 0.25 * s],
      [2.55 * s, 0.25 * s, 0.08 * s],
      [2.65 * s, 0, 0.05 * s],
      [3.15 * s, 0, 0.06 * s],
      [3.35 * s, 0.5 * s, 0.1 * s],
      ...bez([3.35 * s, 0.5 * s], [3.9 * s, 1.6 * s], [3.85 * s, H * 0.7], [R, H], 30),
      ...bez([R - 0.33 * s, H - 0.06 * s], [3.55 * s, H * 0.7], [3.45 * s, 1.8 * s], [2.4 * s, 1.05 * s], 24),
      [0, 1.0 * s],
    ]
    let p2 = throwing(pts, 0.03 * s, 0.75 * s, 1.0 * s, H - 0.5 * s)
    p2[5 + 29][2] = 0.15 * s
    const prof = profile(p2)
    return finishPot(prof, { footY: 1.6 * s, poolY: 1.6 * s, ...o }, H, R, 0.25 * s, 1.7 * s)
  }

  function vase(o) {
    const s = o.scale || 1
    const H = (o.h || 16) * s
    const pts = [
      [0, 0.22 * s],
      [2.6 * s, 0.22 * s, 0.08 * s],
      [2.7 * s, 0, 0.05 * s],
      [3.25 * s, 0, 0.08 * s],
      ...bez([3.25 * s, 0], [4.9 * s, 1.4 * s], [5.0 * s, H * 0.42], [3.0 * s, H * 0.66], 26),
      ...bez([3.0 * s, H * 0.66], [1.3 * s, H * 0.8], [1.25 * s, H * 0.9], [1.75 * s, H], 20),
      [1.45 * s, H - 0.05 * s, 0.1 * s],
      [1.0 * s, H * 0.86],
      [0, H * 0.84],
    ]
    pts[4 + 25 + 19][2] = 0.12 * s
    const prof = profile(throwing(pts, 0.03 * s, 0.85 * s, 1.0 * s, H * 0.66))
    return finishPot(prof, { footY: 1.3 * s, poolY: -1, rimW: 0.025, ...o }, H, 5.0 * s, 0.22 * s, 1.6 * s)
  }

  function carafe(o) {
    const s = o.scale || 1
    const H = 22 * s
    const pts = [
      [0, 0.25 * s],
      [3.4 * s, 0.25 * s, 0.08 * s],
      [3.5 * s, 0, 0.05 * s],
      [4.4 * s, 0, 0.1 * s],
      ...bez([4.4 * s, 0], [5.6 * s, 0.6 * s], [5.7 * s, H * 0.45], [4.8 * s, H * 0.62], 28),
      ...bez([4.8 * s, H * 0.62], [3.0 * s, H * 0.78], [2.1 * s, H * 0.84], [2.2 * s, H], 22),
      [1.85 * s, H - 0.05 * s, 0.1 * s],
      [1.7 * s, H * 0.86],
      [0, H * 0.8],
    ]
    pts[4 + 27 + 21][2] = 0.12 * s
    const prof = profile(throwing(pts, 0.035 * s, 0.95 * s, 1.0 * s, H * 0.9))
    return finishPot(prof, { footY: 1.6 * s, poolY: -1, ...o }, H, 5.7 * s, 0.25 * s, 2.2 * s)
  }

  // ---------- jewellery ----------
  const METALS = {
    gold: { color: '#f2cd94', metalness: 1, roughness: 0.2 },
    'gold-satin': { color: '#ecc690', metalness: 1, roughness: 0.34 },
    silver: { color: '#efeeeb', metalness: 1, roughness: 0.24 },
  }
  function metal(name, extra = {}) {
    return { ...(METALS[name] || METALS.gold), envMapIntensity: 1.25, ...extra }
  }

  /** Ring cross-section (comfort fit): domed outside, nearly flat inside. */
  function bandProfile(R, w, t, dome = 1) {
    const pts = []
    const n = 56
    const cx = R + t / 2
    for (let i = 0; i <= n; i++) {
      const th = -Math.PI / 2 + (i / n) * TAU
      const c = Math.cos(th)
      const sn = Math.sin(th)
      const out = c > 0
      const rr = cx + (t / 2) * (out ? Math.pow(Math.abs(c), 1 / (1 + dome)) : -Math.pow(Math.abs(c), 0.25)) * Math.sign(c || 1) * (out ? 1 : -1)
      const yy = (w / 2) * Math.sign(sn) * Math.pow(Math.abs(sn), out ? 0.9 : 0.35)
      pts.push([rr, yy, 0, true])
    }
    return profile(pts)
  }

  /** A band's colour and engraving: the hallmark cut inside, on the back face the camera sees. */
  function hallmark(text) {
    const W = 2048
    const H = 256
    const cut = (x) => {
      // u = 0 and 1 (across the seam) is the back of the ring; v ~ 0.75 is the inside face
      x.font = '500 46px Georgia, "Times New Roman", serif'
      x.textAlign = 'center'
      x.textBaseline = 'middle'
      for (const cx of [0, W]) {
        x.save()
        x.translate(cx, H * 0.25)
        x.scale(1, 1.25)
        x.rotate(Math.PI)
        x.fillText(text, 0, 2)
        x.restore()
      }
    }
    const hc = heights(W, H, cut, 1.2)
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const x = c.getContext('2d')
    x.fillStyle = '#fff'
    x.fillRect(0, 0, W, H)
    x.globalCompositeOperation = 'multiply'
    x.globalAlpha = 0.45
    x.drawImage(hc, 0, 0)
    const map = new T.CanvasTexture(c)
    map.colorSpace = T.SRGBColorSpace
    map.anisotropy = 8
    const normalMap = engrave(hc, 4)
    normalMap.anisotropy = 8
    return { map, normalMap }
  }

  function ring(o) {
    const R = (o.size || 54) / TAU / 10 // inner radius from EU size (circumference mm)
    const w = (o.width || 3) / 10
    const t = (o.thick || 1.6) / 10
    const prof = bandProfile(R, w, t, o.dome ?? 1)
    const geo = lathe(prof, { seg: 200 })
    const parts = [{ geo, role: 'band', mat: metal(o.metal, o.hallmark ? hallmark(o.hallmark) : {}), normalScale: o.hallmark ? 1.6 : undefined }]
    const Rout = R + t
    if (o.stone) {
      const sr = (o.stone.size || 6) / 20
      const sh = sr * (o.stone.dome || 0.8)
      const cup = lathe(profile([[0, -t * 0.6], [sr * 1.18, -t * 0.6, 0.02], [sr * 1.18, sh * 0.35, 0.02], [sr * 1.02, sh * 0.38, 0.01], [sr * 1.02, sh * 0.2], [0, sh * 0.2]]), { seg: 96 })
      const gem = lathe(profile([[0, sh * 0.18], [sr, sh * 0.18, 0.01], ...bez([sr, sh * 0.18], [sr, sh * 0.8], [sr * 0.55, sh * 1.05], [0, sh * 1.05], 20)]), { seg: 96 })
      for (const g of [cup, gem]) g.translate(0, Rout + t * 0.45, 0)
      cup.userData.stone = gem.userData.stone = true
      parts.push({ geo: cup, role: 'bezel', mat: metal(o.metal) })
      parts.push({ geo: gem, role: 'gem', mat: o.stone.mat })
    }
    // stand the ring up: axis toward the camera, sitting on the floor
    const lie = !!o.lie
    for (const p of parts) {
      if (!lie) {
        if (p.role === 'band') p.geo.rotateX(Math.PI / 2)
        p.geo.translate(0, Rout, 0)
      } else {
        // lying flat: the stone (if any) turned to the side
        if (p.role !== 'band') {
          p.geo.translate(0, -(Rout + t * 0.45), 0)
          p.geo.rotateZ(-Math.PI / 2)
          p.geo.translate(Rout + t * 0.45, 0, 0)
        }
        p.geo.translate(0, w / 2, 0)
      }
      if (o.spin) p.geo.rotateY(o.spin)
    }
    const S = (Rout + 0.4) * 2
    return { parts, size: [S, lie ? w : S, lie ? S : w] }
  }

  // Several pieces as one product (a pair of hoops, a stack of rings).
  function group(o) {
    const parts = []
    let size = [0, 0, 0]
    for (const it of o.items) {
      const b = Objects[it.shape](it)
      if (it.offset) for (const p of b.parts) p.geo.translate(...it.offset)
      parts.push(...b.parts)
      size = [Math.max(size[0], b.size[0] + Math.abs(it.offset?.[0] || 0) * 2), Math.max(size[1], b.size[1] + (it.offset?.[1] || 0)), Math.max(size[2], b.size[2])]
    }
    return { parts, size }
  }

  /** A bead: a small sphere (caps the ends of wires). */
  function bead(r, at) {
    const g = lathe(profile([[0, -r], ...bez([0, -r], [r * 1.33, -r], [r * 1.33, r], [0, r], 16)]), { seg: 24 })
    g.translate(...at)
    return g
  }

  /**
   * Hinged hoop: a circle of round wire standing up, open at the top. A hinge
   * knuckle sits at one end and the post swings across the gap into the
   * other, the way a hinged hoop closes.
   */
  function hoop(o) {
    const R = (o.diameter || 20) / 20
    const r = (o.wire || 1.6) / 20
    const gap = 0.16 // radians open at the top
    const ring = []
    for (let i = 0; i <= 40; i++) {
      const th = -Math.PI / 2 + (i / 40) * TAU
      ring.push([R + r * Math.cos(th), r * Math.sin(th), 0, true])
    }
    const wrap = TAU - gap * 2
    const geo = lathe(profile(ring), { seg: 160, wrap })
    geo.rotateX(Math.PI / 2)
    geo.translate(0, R + r, 0)
    // a point on the wire's centre line at lathe angle phi (0 = bottom, pi = top)
    const at = (phi, rad = R) => [rad * Math.sin(phi), R + r - rad * Math.cos(phi), 0]
    const arc = (a, b, rad = R, n = 16) => Array.from({ length: n + 1 }, (_, i) => at(a + ((b - a) * i) / n, rad))
    const end = wrap / 2
    const gold = metal(o.metal)
    const parts = [{ geo, role: 'hoop', mat: gold }]
    // knuckle: a thicker short sleeve at one end
    const kn = tube(arc(end - 0.09, end + 0.03), r * 1.3)
    parts.push({ geo: kn, role: 'knuckle', mat: gold })
    parts.push({ geo: bead(r * 1.3, at(end + 0.03)), role: 'knuckle', mat: gold })
    parts.push({ geo: bead(r * 1.3, at(end - 0.09)), role: 'knuckle', mat: gold })
    // post: a fine wire across the gap, into the far end
    const post = tube(arc(end, TAU - end + 0.05), r * 0.42)
    parts.push({ geo: post, role: 'post', mat: gold })
    parts.push({ geo: bead(r, at(-end)), role: 'end', mat: gold })
    if (o.lie) for (const p of parts) {
      p.geo.translate(0, -(R + r), 0)
      p.geo.rotateX(-Math.PI / 2)
      p.geo.translate(0, r * 1.3, 0)
    }
    for (const p of parts) {
      if (o.tilt) p.geo.rotateZ(o.tilt)
      if (o.spin) p.geo.rotateY(o.spin)
    }
    const S = (R + r) * 2
    return { parts, size: [S, o.lie ? r * 2.6 : S, o.lie ? S : r * 2.6] }
  }

  /** A tube of radius r along points (a chain, an ear wire). */
  function tube(points, r, closed = false) {
    const curve = points.map((p) => new T.Vector3(...p))
    const n = curve.length
    const at = (t) => {
      const f = t * (n - 1)
      const i = Math.min(n - 2, Math.floor(f))
      const k = f - i
      // Catmull-Rom
      const p0 = curve[Math.max(0, i - 1)]
      const p1 = curve[i]
      const p2 = curve[i + 1]
      const p3 = curve[Math.min(n - 1, i + 2)]
      const k2 = k * k
      const k3 = k2 * k
      const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * k + (2 * a - 5 * b + 4 * cc - d) * k2 + (-a + 3 * b - 3 * cc + d) * k3)
      return new T.Vector3(c(p0.x, p1.x, p2.x, p3.x), c(p0.y, p1.y, p2.y, p3.y), c(p0.z, p1.z, p2.z, p3.z))
    }
    return surface(
      (u, v) => {
        const p = at(v)
        const q = at(Math.min(1, v + 0.002))
        const pr = at(Math.max(0, v - 0.002))
        const tg = q.clone().sub(pr).normalize()
        let nrm = new T.Vector3(0, 1, 0)
        if (Math.abs(tg.y) > 0.9) nrm.set(1, 0, 0)
        const b = new T.Vector3().crossVectors(tg, nrm).normalize()
        nrm = new T.Vector3().crossVectors(b, tg).normalize()
        const a = u * TAU
        return [p.x + r * (Math.cos(a) * nrm.x + Math.sin(a) * b.x), p.y + r * (Math.cos(a) * nrm.y + Math.sin(a) * b.y), p.z + r * (Math.cos(a) * nrm.z + Math.sin(a) * b.z)]
      },
      24,
      Math.max(60, n * 14),
    )
  }

  /** Merges geometries (position, normal, uv, index) into one. */
  function merge(list) {
    let n = 0
    let m = 0
    for (const g of list) {
      n += g.getAttribute('position').count
      m += g.getIndex().count
    }
    const pos = new Float32Array(n * 3)
    const nrm = new Float32Array(n * 3)
    const uv = new Float32Array(n * 2)
    const idx = new Uint32Array(m)
    let o = 0
    let q = 0
    for (const g of list) {
      const P = g.getAttribute('position')
      const N = g.getAttribute('normal')
      const U = g.getAttribute('uv')
      pos.set(P.array, o * 3)
      nrm.set(N.array, o * 3)
      if (U) uv.set(U.array, o * 2)
      const I = g.getIndex().array
      for (let i = 0; i < I.length; i++) idx[q + i] = I[i] + o
      q += I.length
      o += P.count
      g.dispose()
    }
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.BufferAttribute(pos, 3))
    g.setAttribute('normal', new T.BufferAttribute(nrm, 3))
    g.setAttribute('uv', new T.BufferAttribute(uv, 2))
    g.setIndex(new T.BufferAttribute(idx, 1))
    return g
  }

  /**
   * A cable chain lying on the floor along `pts` ([x, z] in cm): oval links
   * of round wire, every other one standing up, as a real chain falls.
   */
  function chain(pts, { link = 0.19, wire = 0.018 } = {}) {
    const Rr = link / 2 / 1.35 - wire
    const ring = []
    for (let i = 0; i <= 12; i++) {
      const th = -Math.PI / 2 + (i / 12) * TAU
      ring.push([Rr + wire * Math.cos(th), wire * Math.sin(th), 0, true])
    }
    const prof = profile(ring)
    // walk the polyline at link spacing
    const step = link - wire * 3.2
    const out = []
    let k = 0
    let carry = 0
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1]
      const [x1, z1] = pts[i]
      const L = Math.hypot(x1 - x0, z1 - z0)
      const ang = Math.atan2(z1 - z0, x1 - x0)
      let d = carry
      while (d <= L) {
        const t = d / L
        const g = lathe(prof, { seg: 20 })
        g.scale(1.35, 1, 1)
        const up = k % 2 === 1
        if (up) g.rotateX(Math.PI / 2)
        g.rotateY(-ang)
        g.translate(x0 + (x1 - x0) * t, up ? Rr + wire : wire, z0 + (z1 - z0) * t)
        out.push(g)
        k++
        d += step
      }
      carry = d - L
    }
    return merge(out)
  }

  /** A domed disc pendant lying on the floor, its chain running away in a V. */
  function pendant(o) {
    const R = (o.diameter || 16) / 20
    const th = (o.thick || 1.2) / 10
    const disc = lathe(profile([[0, 0], [R - th * 0.4, 0, 0.02], [R, th * 0.5, th * 0.45], [R - th * 0.4, th, 0.02], ...bez([R - th * 0.4, th], [R * 0.6, th * 1.9], [R * 0.3, th * 2.2], [0, th * 2.2], 24)]), { seg: 160 })
    // planar UVs for an engraved mark
    const pos = disc.getAttribute('position')
    const uv = disc.getAttribute('uv')
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * R), 0.5 - pos.getZ(i) / (2 * R))
    let mark = {}
    if (o.mark) {
      const hc = heights(1024, 1024, (x) => {
        x.font = 'italic 300px Georgia, "Times New Roman", serif'
        x.textAlign = 'center'
        x.textBaseline = 'middle'
        x.fillText(o.mark, 512, 530)
      }, 4)
      const c = document.createElement('canvas')
      c.width = c.height = 1024
      const x = c.getContext('2d')
      x.fillStyle = '#fff'
      x.fillRect(0, 0, 1024, 1024)
      x.globalCompositeOperation = 'multiply'
      x.globalAlpha = 0.35
      x.drawImage(hc, 0, 0)
      const map = new T.CanvasTexture(c)
      map.colorSpace = T.SRGBColorSpace
      mark = { map, normalMap: engrave(hc, 3) }
    }
    const parts = [{ geo: disc, role: 'disc', mat: metal(o.metal || 'gold-satin', mark), normalScale: o.mark ? 1.5 : undefined }]
    // bail: a small ring standing at the edge
    const bail = lathe(profile(Array.from({ length: 17 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 16) * TAU
      return [0.13 + 0.032 * Math.cos(a), 0.032 * Math.sin(a), 0, true]
    })), { seg: 40 })
    bail.rotateZ(Math.PI / 2)
    bail.translate(0, 0.16, -R - 0.08)
    parts.push({ geo: bail, role: 'bail', mat: metal(o.metal) })
    // the chain: through the bail, then two strands opening into a V, out of frame
    const strand = (side) => {
      const pts = []
      for (let i = 0; i <= 40; i++) {
        const t = i / 40
        pts.push([side * (0.05 + t * 2.4 + Math.sin(t * 2.6) * 0.3), -R - 0.22 - t * 8.5])
      }
      return pts
    }
    const links = [...strand(-1).reverse(), ...strand(1)]
    parts.push({ geo: chain(links, o.chain), role: 'chain', mat: metal(o.metal, { roughness: 0.22 }), noFit: true })
    for (const p of parts) if (o.spin) p.geo.rotateY(o.spin)
    return { parts, size: [R * 2.4, 0.4, R * 2.4] }
  }

  /**
   * A pearl stud: the pearl resting on the floor, its post running back to a
   * butterfly scroll, seen from the side so the post and back read.
   */
  function stud(o) {
    const pr = (o.size || 8) / 20
    const gold = metal(o.metal)
    const ball = lathe(profile([[0, -pr], ...bez([0, -pr], [pr * 1.33, -pr], [pr * 1.33, pr], [0, pr], 40)]), { seg: 96 })
    ball.translate(0, pr, 0)
    const parts = [{ geo: ball, role: 'pearl', mat: o.mat }]
    // cup the pearl sits in, the post, and the butterfly back
    const cup = lathe(profile([[0, 0], [0.13, 0, 0.02], [0.17, 0.07, 0.02], [0, 0.07]]), { seg: 32 })
    cup.rotateX(-Math.PI / 2)
    cup.translate(0, pr, -pr * 0.93)
    parts.push({ geo: cup, role: 'cup', mat: gold })
    const len = o.post || 1.05
    const post = lathe(profile([[0, 0], [0.036, 0, 0.01], [0.036, len, 0.02], [0, len]]), { seg: 20 })
    post.rotateX(-Math.PI / 2)
    post.translate(0, pr, -pr * 0.9)
    parts.push({ geo: post, role: 'post', mat: gold })
    // butterfly: a small plate with two scrolls curled against it
    const z = -pr - len * 0.55
    const plate = lathe(profile([[0, -0.03], [0.24, -0.03, 0.03], [0.26, 0.0, 0.02], [0.24, 0.03, 0.03], [0, 0.03]]), { seg: 48 })
    plate.scale(1, 1, 0.62)
    plate.rotateX(-Math.PI / 2)
    plate.translate(0, pr, z)
    parts.push({ geo: plate, role: 'back', mat: gold })
    for (const side of [-1, 1]) {
      const prof = Array.from({ length: 17 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 16) * TAU
        return [0.075 + 0.035 * Math.cos(a), 0.035 * Math.sin(a), 0, true]
      })
      const curl = lathe(profile(prof), { seg: 32 })
      curl.rotateZ(Math.PI / 2)
      curl.translate(side * 0.11, pr, z + 0.07)
      parts.push({ geo: curl, role: 'scroll', mat: gold })
    }
    for (const p of parts) if (o.spin) p.geo.rotateY(o.spin)
    return { parts, size: [pr * 2.2, pr * 2, pr * 2 + len] }
  }

  return { stud, bowl, plate, cup, vase, carafe, ring, hoop, pendant, group, METALS }
})()
