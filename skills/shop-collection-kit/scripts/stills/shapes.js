// Product shapes, built from code. Units are centimetres; every product
// stands on y = 0, centred on the y axis, with its front facing +z (the
// camera). Each builder returns the meshes' geometry and where the label
// art goes; studio.js gives them materials.
/* global THREE */
window.Shapes = (() => {
  const T = THREE
  const TAU = Math.PI * 2

  // ---------- profiles ----------
  // A profile is the right half of a silhouette, as [r, y] points from the
  // bottom of the axis to the top. Corners are rounded by `f` (a radius in
  // cm) so highlights roll over them the way they do on real packaging.

  /** Cubic Bézier from a to b, n points, without a. */
  function bez(a, c1, c2, b, n = 16) {
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

  /**
   * Turns [[r, y, fillet, smooth?], ...] into a dense profile with normals and
   * arc length: [{ r, y, nr, ny, s }]. Points with a fillet become arcs.
   */
  function profile(pts) {
    const P = pts.map((p) => ({ r: p[0], y: p[1], f: p[2] || 0, smooth: !!p[3] }))
    const dense = []
    for (let i = 0; i < P.length; i++) {
      const p = P[i]
      const a = P[i - 1]
      const b = P[i + 1]
      if (!a || !b || !p.f) {
        dense.push({ r: p.r, y: p.y, hard: !p.smooth && !!a && !!b })
        continue
      }
      const d1 = norm2(p.r - a.r, p.y - a.y)
      const d2 = norm2(b.r - p.r, b.y - p.y)
      const cos = Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1]))
      const turn = Math.acos(cos)
      if (turn < 1e-3) {
        dense.push({ r: p.r, y: p.y })
        continue
      }
      const la = Math.hypot(p.r - a.r, p.y - a.y)
      const lb = Math.hypot(b.r - p.r, b.y - p.y)
      const L = Math.min(p.f * Math.tan(turn / 2), la * 0.5, lb * 0.5)
      const rad = L / Math.tan(turn / 2)
      const A = [p.r - d1[0] * L, p.y - d1[1] * L]
      const B = [p.r + d2[0] * L, p.y + d2[1] * L]
      // Centre: from A, perpendicular to d1, toward the inside of the turn.
      const cross = d1[0] * d2[1] - d1[1] * d2[0]
      const side = cross > 0 ? 1 : -1
      const n1 = [-d1[1] * side, d1[0] * side]
      const C = [A[0] + n1[0] * rad, A[1] + n1[1] * rad]
      const a0 = Math.atan2(A[1] - C[1], A[0] - C[0])
      let a1 = Math.atan2(B[1] - C[1], B[0] - C[0])
      let da = a1 - a0
      while (da > Math.PI) da -= TAU
      while (da < -Math.PI) da += TAU
      const n = Math.max(3, Math.ceil(Math.abs(da) / (Math.PI / 20)))
      for (let k = 0; k <= n; k++) {
        const ang = a0 + (da * k) / n
        dense.push({ r: C[0] + Math.cos(ang) * rad, y: C[1] + Math.sin(ang) * rad })
      }
    }
    // Normals: outward, from the neighbouring segments; hard corners get two
    // copies of the point, one per side.
    const out = []
    const segN = (p, q) => {
      const d = norm2(q.r - p.r, q.y - p.y)
      return [d[1], -d[0]]
    }
    for (let i = 0; i < dense.length; i++) {
      const p = dense[i]
      const a = dense[i - 1]
      const b = dense[i + 1]
      if (p.hard) {
        const na = segN(a, p)
        const nb = segN(p, b)
        out.push({ r: p.r, y: p.y, nr: na[0], ny: na[1] })
        out.push({ r: p.r, y: p.y, nr: nb[0], ny: nb[1] })
        continue
      }
      let n
      if (!a) n = b.r > p.r + 1e-6 && Math.abs(p.r) < 1e-6 ? [0, -1] : segN(p, b)
      else if (!b) n = Math.abs(p.r) < 1e-6 ? [0, 1] : segN(a, p)
      else {
        const na = segN(a, p)
        const nb = segN(p, b)
        n = norm2(na[0] + nb[0], na[1] + nb[1])
      }
      out.push({ r: p.r, y: p.y, nr: n[0], ny: n[1] })
    }
    // Ends on the axis point straight down / up.
    if (Math.abs(out[0].r) < 1e-6) Object.assign(out[0], { nr: 0, ny: -1 })
    const last = out.at(-1)
    if (Math.abs(last.r) < 1e-6) Object.assign(last, { nr: 0, ny: 1 })
    let s = 0
    out.forEach((p, i) => {
      if (i) s += Math.hypot(p.r - out[i - 1].r, p.y - out[i - 1].y)
      p.s = s
    })
    return out
  }

  function norm2(x, y) {
    const l = Math.hypot(x, y) || 1
    return [x / l, y / l]
  }

  /** The part of a profile between heights y0 and y1, pushed out by `by`. */
  function band(prof, y0, y1, by = 0.012) {
    // The first stretch of the outside wall that climbs from y0 to y1.
    const cross = (y, from) => {
      for (let i = Math.max(1, from); i < prof.length; i++) {
        const a = prof[i - 1]
        const b = prof[i]
        if (b.y > a.y && a.y <= y && b.y >= y && a.r > 0.01) {
          const t = (y - a.y) / (b.y - a.y)
          return { i, p: { r: a.r + (b.r - a.r) * t, y, nr: a.nr + (b.nr - a.nr) * t, ny: a.ny + (b.ny - a.ny) * t } }
        }
      }
      return null
    }
    const start = cross(y0, 1)
    const end = start && cross(y1, start.i)
    if (!start || !end) throw new Error(`the label band ${(y0 * 10).toFixed(0)}-${(y1 * 10).toFixed(0)} mm is off the product`)
    const out = [start.p, ...prof.slice(start.i, end.i).map((p) => ({ ...p })), end.p]
    let s = 0
    return out.map((p, i) => {
      if (i) s += Math.hypot(p.r - out[i - 1].r, p.y - out[i - 1].y)
      const l = Math.hypot(p.nr, p.ny) || 1
      return { r: p.r + (p.nr / l) * by, y: p.y + (p.ny / l) * by, nr: p.nr / l, ny: p.ny / l, s }
    })
  }

  // ---------- geometry ----------

  /**
   * Revolves a profile around y. `wrap` (radians) and the label's u run
   * left to right across the front; `ripple(phi, y)` scales the radius for
   * fluted caps and ribbed lids.
   */
  function lathe(prof, { seg = 160, wrap = TAU, ripple = null } = {}) {
    const rows = prof.length
    const cols = seg + 1
    const pos = new Float32Array(rows * cols * 3)
    const nrm = new Float32Array(rows * cols * 3)
    const uv = new Float32Array(rows * cols * 2)
    const total = prof.at(-1).s || 1
    const from = -wrap / 2
    for (let j = 0; j < cols; j++) {
      const phi = from + (wrap * j) / seg
      const sn = Math.sin(phi)
      const cs = Math.cos(phi)
      for (let i = 0; i < rows; i++) {
        const p = prof[i]
        const m = ripple ? ripple(phi, p.y) : 1
        const k = (j * rows + i) * 3
        pos[k] = p.r * m * sn
        pos[k + 1] = p.y
        pos[k + 2] = p.r * m * cs
        let nx = p.nr * sn
        let ny = p.ny
        let nz = p.nr * cs
        if (ripple && m !== 1) {
          // Tilt the normal by the ripple's slope around the axis.
          const e = 1e-3
          const dm = (ripple(phi + e, p.y) - ripple(phi - e, p.y)) / (2 * e) / m
          nx -= dm * p.nr * cs
          nz += dm * p.nr * sn
          const l = Math.hypot(nx, ny, nz)
          nx /= l
          ny /= l
          nz /= l
        }
        nrm[k] = nx
        nrm[k + 1] = ny
        nrm[k + 2] = nz
        const q = (j * rows + i) * 2
        uv[q] = j / seg
        uv[q + 1] = p.s / total
      }
    }
    const idx = []
    for (let j = 0; j < seg; j++)
      for (let i = 0; i < rows - 1; i++) {
        const a = j * rows + i
        const b = (j + 1) * rows + i
        idx.push(a, b, b + 1, a, b + 1, a + 1)
      }
    return geometry(pos, nrm, uv, idx)
  }

  function geometry(pos, nrm, uv, idx) {
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.BufferAttribute(pos, 3))
    g.setAttribute('normal', new T.BufferAttribute(nrm, 3))
    if (uv) g.setAttribute('uv', new T.BufferAttribute(uv, 2))
    g.setIndex(idx)
    return g
  }

  /**
   * A parametric surface f(u, v) -> [x, y, z] on an (nu+1)×(nv+1) grid,
   * with normals from the grid. uvOf(u, v) gives texture coordinates.
   */
  function surface(f, nu, nv, { uvOf = (u, v) => [u, v], flip = false } = {}) {
    const cols = nu + 1
    const rows = nv + 1
    const pos = new Float32Array(cols * rows * 3)
    const nrm = new Float32Array(cols * rows * 3)
    const uv = new Float32Array(cols * rows * 2)
    const e = 1e-4
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = i / nu
        const v = j / nv
        const p = f(u, v)
        const k = (j * cols + i) * 3
        pos.set(p, k)
        const pu = sub(f(Math.min(1, u + e), v), f(Math.max(0, u - e), v))
        const pv = sub(f(u, Math.min(1, v + e)), f(u, Math.max(0, v - e)))
        let n = cross(pu, pv)
        let l = Math.hypot(...n)
        if (l < 1e-12) {
          // Degenerate edge (the surface pinches to a line): look a step in.
          const vi = v < 0.5 ? v + 0.01 : v - 0.01
          n = cross(
            sub(f(Math.min(1, u + e), vi), f(Math.max(0, u - e), vi)),
            sub(f(u, vi + e), f(u, vi - e)),
          )
          l = Math.hypot(...n) || 1
        }
        const sgn = flip ? -1 : 1
        nrm[k] = (n[0] / l) * sgn
        nrm[k + 1] = (n[1] / l) * sgn
        nrm[k + 2] = (n[2] / l) * sgn
        const t = uvOf(u, v)
        uv[(j * cols + i) * 2] = t[0]
        uv[(j * cols + i) * 2 + 1] = t[1]
      }
    const idx = []
    for (let j = 0; j < nv; j++)
      for (let i = 0; i < nu; i++) {
        const a = j * cols + i
        const b = a + 1
        const c = a + cols + 1
        const d = a + cols
        if (flip) idx.push(a, c, b, a, d, c)
        else idx.push(a, b, c, a, c, d)
      }
    return geometry(pos, nrm, uv, idx)
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]

  /**
   * A box w×h×d (centred, bottom at y = 0) with edges rounded by r. Six
   * groups, one per face, in the order front, back, left, right, top,
   * bottom, each with its own 0-1 uv, upright as you look at that face.
   */
  function roundedBox(w, h, d, r, n = 24) {
    r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)
    const hw = w / 2
    const hh = h / 2
    const hd = d / 2
    const inner = [hw - r, hh - r, hd - r]
    // Grid coordinates that bunch up near the edges, where the rounding is.
    const ticks = (half, rad) => {
      const out = []
      const m = Math.ceil(n / 3)
      for (let i = 0; i <= m; i++) out.push(-half + (rad * i) / m)
      const mid = Math.max(2, Math.ceil(((half - rad) / half) * n))
      for (let i = 1; i < mid; i++) out.push(-half + rad + ((2 * (half - rad)) * i) / mid)
      for (let i = 0; i <= m; i++) out.push(half - rad + (rad * i) / m)
      return out
    }
    const faces = [
      // [normal axis, sign, u axis, u sign, v axis, v sign]
      [2, 1, 0, 1, 1, 1], // front +z
      [2, -1, 0, -1, 1, 1], // back -z
      [0, -1, 2, 1, 1, 1], // left -x
      [0, 1, 2, -1, 1, 1], // right +x
      [1, 1, 0, 1, 2, -1], // top +y
      [1, -1, 0, 1, 2, 1], // bottom -y
    ]
    const half = [hw, hh, hd]
    const pos = []
    const nrm = []
    const uv = []
    const idx = []
    const g = new T.BufferGeometry()
    for (const [fi, [na, ns, ua, us, va, vs]] of faces.entries()) {
      const tu = ticks(half[ua], r)
      const tv = ticks(half[va], r)
      const start = pos.length / 3
      const istart = idx.length
      for (let j = 0; j < tv.length; j++)
        for (let i = 0; i < tu.length; i++) {
          const p = [0, 0, 0]
          p[na] = ns * half[na]
          p[ua] = us * tu[i]
          p[va] = vs * tv[j]
          const c = p.map((x, k) => Math.max(-inner[k], Math.min(inner[k], x)))
          const dv = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
          const l = Math.hypot(...dv) || 1
          const nn = dv.map((x) => x / l)
          const q = c.map((x, k) => x + nn[k] * r)
          pos.push(q[0], q[1] + hh, q[2])
          nrm.push(...nn)
          uv.push((tu[i] + half[ua]) / (2 * half[ua]), (tv[j] + half[va]) / (2 * half[va]))
        }
      const cols = tu.length
      for (let j = 0; j < tv.length - 1; j++)
        for (let i = 0; i < cols - 1; i++) {
          const a = start + j * cols + i
          const b = a + 1
          const c = a + cols + 1
          const d = a + cols
          idx.push(a, b, c, a, c, d)
        }
      g.addGroup(istart, idx.length - istart, fi)
    }
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3))
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    return g
  }

  /** A convex outline [[x, y], ...] (counter-clockwise) extruded to depth d, front at z = d/2. */
  function slab(outline, d) {
    const pos = []
    const nrm = []
    const idx = []
    const n = outline.length
    const add = (p, nn) => {
      pos.push(...p)
      nrm.push(...nn)
      return pos.length / 3 - 1
    }
    for (const [z, nz] of [
      [d / 2, 1],
      [-d / 2, -1],
    ]) {
      const c = add([0, outline.reduce((s, p) => s + p[1], 0) / n, z], [0, 0, nz])
      const ids = outline.map(([x, y]) => add([x, y, z], [0, 0, nz]))
      for (let i = 0; i < n; i++) {
        const a = ids[i]
        const b = ids[(i + 1) % n]
        if (nz > 0) idx.push(c, a, b)
        else idx.push(c, b, a)
      }
    }
    for (let i = 0; i < n; i++) {
      const p = outline[i]
      const q = outline[(i + 1) % n]
      const e = norm2(q[1] - p[1], -(q[0] - p[0]))
      const a = add([p[0], p[1], d / 2], [e[0], e[1], 0])
      const b = add([q[0], q[1], d / 2], [e[0], e[1], 0])
      const c = add([q[0], q[1], -d / 2], [e[0], e[1], 0])
      const dd = add([p[0], p[1], -d / 2], [e[0], e[1], 0])
      idx.push(a, dd, c, a, c, b)
    }
    return geometry(new Float32Array(pos), new Float32Array(nrm), null, idx)
  }

  // ---------- products ----------
  // Each returns { parts: [{ geo, role, ... }], label: {...} | null, size }.
  // Roles: body, glass, liquid, label, label-back, cap, lid, metal, rubber,
  // face-<n> (box). `label` says how big the printed area is, for the label
  // art's proportions: { width, height } in cm, as it lies flat.

  const PRESETS = {
    can: {
      standard: { diameter: 66, height: 122 },
      sleek: { diameter: 58, height: 146 },
      slim: { diameter: 53, height: 168 },
      tall: { diameter: 66, height: 168 },
      mini: { diameter: 58, height: 92 },
    },
    bottle: {
      tonic: { diameter: 62, height: 205 },
      boston: { diameter: 46, height: 104 },
      dropper: { diameter: 36, height: 82 },
      pump: { diameter: 56, height: 150 },
    },
    jar: {
      standard: { diameter: 72, height: 62 },
      wide: { diameter: 88, height: 52 },
      tall: { diameter: 64, height: 92 },
    },
    tube: {
      standard: { diameter: 36, height: 160 },
      small: { diameter: 28, height: 110 },
      large: { diameter: 45, height: 190 },
    },
    box: {
      carton: { width: 70, height: 110, depth: 36 },
      cube: { width: 80, height: 80, depth: 80 },
      bar: { width: 80, height: 160, depth: 14 },
      tall: { width: 60, height: 170, depth: 60 },
    },
    pouch: {
      standard: { width: 140, height: 210, depth: 75 },
      small: { width: 110, height: 170, depth: 60 },
      large: { width: 180, height: 280, depth: 100 },
    },
  }

  function can(o) {
    const R = o.diameter / 20
    const H = o.height / 10
    const k = R / 3.3
    const prof = profile([
      [0, 0.62 * k],
      [R * 0.62, 0.34 * k, 0.25 * k],
      [R * 0.76, 0.02, 0.1 * k],
      [R * 0.86, 0.05, 0.12 * k],
      [R * 0.985, 0.55 * k, 0.45 * k],
      [R, 1.0 * k, 0.6 * k],
      [R, H - 1.25 * k, 0.9 * k],
      [R * 0.84, H - 0.32 * k, 0.12 * k],
      [R * 0.85, H - 0.06 * k, 0.06 * k],
      [R * 0.82, H, 0.05 * k],
      [R * 0.795, H - 0.05 * k, 0.03 * k],
      [R * 0.79, H - 0.33 * k, 0.05 * k],
      [R * 0.7, H - 0.36 * k, 0.05 * k],
      [R * 0.66, H - 0.3 * k, 0.05 * k],
      [0, H - 0.3 * k],
    ])
    const y0 = 0.75 * k
    const y1 = H - 0.45 * k
    const lab = band(prof, y0, y1, 0.006)
    const wrap = TAU
    const tab = roundedBox(1.15 * k, 0.07 * k, 2.1 * k, 0.03 * k, 6)
    tab.translate(0, H - 0.3 * k, 0.32 * k)
    const rivet = lathe(profile([[0, 0], [0.22 * k, 0, 0.05 * k], [0.2 * k, 0.09 * k, 0.04 * k], [0, 0.1 * k]]), { seg: 32 })
    rivet.translate(0, H - 0.3 * k, 0)
    return {
      parts: [
        { geo: lathe(prof), role: 'metal' },
        { geo: lathe(lab, { wrap }), role: 'label' },
        { geo: tab, role: 'metal' },
        { geo: rivet, role: 'metal' },
      ],
      label: { width: R * wrap, height: lab.at(-1).s, wrap: 360 },
      size: [2 * R, H, 2 * R],
    }
  }

  function bottleProfile(style, R, H) {
    if (style === 'tonic') {
      const rn = R * 0.4
      const ys = H * 0.5
      const yn = H * 0.78
      return {
        glass: [
          [0, 0.35],
          [R * 0.6, 0.18, 0.4],
          [R * 0.9, 0, 0.3],
          [R, 0.7, 0.6],
          [R, ys],
          ...bez([R, ys], [R, ys + (yn - ys) * 0.55], [rn, yn - (yn - ys) * 0.4], [rn, yn], 24),
          [rn, H * 0.9, 0.05],
          [rn * 1.14, H * 0.905, 0.12],
          [rn * 1.14, H * 0.935, 0.12],
          [rn * 0.8, H * 0.94, 0.05],
          [0, H * 0.94],
        ],
        neck: [rn, H * 0.94],
        body: [0.9, ys],
      }
    }
    if (style === 'pump') {
      const rn = R * 0.36
      const ys = H * 0.66
      const yn = H * 0.78
      return {
        glass: [
          [0, 0.3],
          [R * 0.7, 0.12, 0.3],
          [R * 0.95, 0, 0.4],
          [R, 0.6, 0.5],
          [R, ys],
          ...bez([R, ys], [R, ys + (yn - ys) * 0.75], [rn + (R - rn) * 0.35, yn], [rn, yn], 18),
          [rn, H * 0.8],
          [0, H * 0.8],
        ],
        neck: [rn, H * 0.8],
        body: [0.7, ys],
      }
    }
    // boston round and dropper: a rounded shoulder and a short neck
    const rn = R * (style === 'dropper' ? 0.42 : 0.44)
    const ys = H * 0.6
    const yn = H * 0.76
    return {
      glass: [
        [0, 0.28],
        [R * 0.7, 0.1, 0.3],
        [R * 0.95, 0, 0.35],
        [R, 0.5, 0.4],
        [R, ys],
        ...bez([R, ys], [R, ys + (yn - ys) * 0.9], [rn + (R - rn) * 0.45, yn], [rn, yn], 20),
        [rn, H * 0.86],
        [0, H * 0.86],
      ],
      neck: [rn, H * 0.86],
      body: [0.6, ys],
    }
  }

  function bottle(o) {
    const R = o.diameter / 20
    const H = o.height / 10
    const style = o.style
    const shape = bottleProfile(style, R, H)
    const prof = profile(shape.glass)
    const parts = []
    // A filled bottle is drawn as two pieces of the same glass: below the
    // fill line it is tinted by the liquid, above it plain glass.
    if (o.liquid) {
      const neckY = shape.neck[1]
      const fillY = Math.min(o.fill * neckY, neckY - 0.6)
      const [lower, upper] = split(prof, fillY)
      parts.push({ geo: lathe(lower), role: 'filled', fill: fillY }, { geo: lathe(upper), role: 'glass' })
    } else parts.push({ geo: lathe(prof), role: 'glass' })
    // Label band
    let label = null
    if (o.label !== false) {
      const [b0, b1] = o.band ?? defaultBand(style, H, shape)
      const lab = band(prof, b0, b1, 0.01)
      const wrap = (o.wrap / 360) * TAU
      parts.push({ geo: lathe(lab, { wrap }), role: 'label' })
      parts.push({ geo: lathe(band(prof, b0, b1, 0.009), { wrap }), role: 'label-back' })
      label = { width: R * wrap, height: lab.at(-1).s, wrap: o.wrap }
    }
    // Closure
    const [rn, yTop] = shape.neck
    parts.push(...closure(o.cap, rn, yTop, H, R))
    return { parts, label, size: [2 * R, partsTop(parts), 2 * R] }
  }

  /** A profile cut at height y (on its way up) into the part below and the part above. */
  function split(prof, y) {
    for (let i = 1; i < prof.length; i++) {
      const a = prof[i - 1]
      const b = prof[i]
      if (b.y > a.y && a.y <= y && b.y >= y && a.r > 0.01) {
        const t = (y - a.y) / (b.y - a.y)
        const m = { r: a.r + (b.r - a.r) * t, y, nr: a.nr + (b.nr - a.nr) * t, ny: a.ny + (b.ny - a.ny) * t }
        const lower = [...prof.slice(0, i), m]
        const upper = [{ ...m }, ...prof.slice(i)]
        const arc = (list) => {
          let s = 0
          return list.map((p, k) => {
            if (k) s += Math.hypot(p.r - list[k - 1].r, p.y - list[k - 1].y)
            return { ...p, s }
          })
        }
        return [arc(lower), arc(upper)]
      }
    }
    return [prof, []]
  }

  function rAt(prof, y) {
    for (let i = 1; i < prof.length; i++) {
      const a = prof[i - 1]
      const b = prof[i]
      if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.r + ((b.r - a.r) * (y - a.y)) / (b.y - a.y)
    }
    return prof[0].r
  }

  function defaultBand(style, H, shape) {
    const top = shape.body[1]
    if (style === 'tonic') return [H * 0.12, H * 0.44]
    if (style === 'pump') return [H * 0.1, top - 0.6]
    return [H * 0.1, top - 0.35]
  }

  function partsTop(parts) {
    let top = 0
    for (const p of parts) {
      p.geo.computeBoundingBox()
      top = Math.max(top, p.geo.boundingBox.max.y)
    }
    return top
  }

  /** Caps and closures sitting on a neck of radius rn whose top is at y. */
  function closure(kind, rn, y, H, R) {
    const out = []
    if (kind === 'crown') {
      const rc = rn * 1.22
      const h = Math.max(0.6, rn * 0.55)
      const prof = profile([
        [0, y + h],
        [rc * 0.92, y + h, 0.12],
        [rc, y + h * 0.75, 0.1],
        [rc * 1.04, y - h * 0.35, 0.05],
        [rn * 0.95, y - h * 0.4],
      ])
      out.push({ geo: lathe(prof, { seg: 210, ripple: (phi, yy) => (yy < y + h * 0.78 ? 1 + 0.035 * Math.cos(21 * phi) : 1) }), role: 'cap' })
      return out
    }
    if (kind === 'cork') {
      const h = rn * 2.2
      out.push({ geo: lathe(profile([[0, y - 0.5], [rn * 0.98, y - 0.5], [rn * 1.0, y + h * 0.5, 0.2], [rn * 1.18, y + h * 0.55, 0.15], [rn * 1.18, y + h, 0.3], [0, y + h]]), { seg: 96 }), role: 'cork' })
      return out
    }
    if (kind === 'dropper') {
      // Collar, then a rubber bulb, and the glass pipette inside.
      const rc = rn * 1.32
      const hc = Math.max(1.1, rn * 1.15)
      out.push({ geo: lathe(profile([[0, y - 0.6], [rc * 0.98, y - 0.6, 0.08], [rc, y + hc, 0.15], [rn * 0.7, y + hc + 0.05, 0.05], [0, y + hc + 0.05]]), { seg: 120, ripple: (phi, yy) => (yy > y - 0.4 && yy < y + hc - 0.2 ? 1 + 0.008 * Math.cos(60 * phi) : 1) }), role: 'cap' })
      const rb = rn * 0.82
      const hb = rn * 3.6
      const yb = y + hc
      out.push({ geo: lathe(profile([[0, yb], [rb * 1.1, yb, 0.1], [rb * 1.1, yb + 0.35, 0.1], [rb * 0.88, yb + 0.5, 0.15], [rb * 0.92, yb + hb * 0.55, 0.4], [rb * 1.02, yb + hb * 0.78, 0.5], [rb * 0.7, yb + hb, 0.6], [0, yb + hb]]), { seg: 96 }), role: 'rubber' })
      out.push({ geo: lathe(profile([[0, H * 0.12], [rn * 0.28, H * 0.12, 0.08], [rn * 0.3, y, 0.02], [0, y]]), { seg: 32 }), role: 'pipette' })
      return out
    }
    if (kind === 'pump') {
      const rc = rn * 1.35
      const hc = rn * 1.1
      out.push({ geo: lathe(profile([[0, y - 0.4], [rc, y - 0.4, 0.1], [rc, y + hc, 0.15], [rn * 0.5, y + hc, 0.05], [0, y + hc]]), { seg: 120, ripple: (phi, yy) => (yy < y + hc - 0.15 ? 1 + 0.012 * Math.cos(48 * phi) : 1) }), role: 'cap' })
      const rs = rn * 0.32
      const ys = y + hc
      out.push({ geo: lathe(profile([[0, ys], [rs, ys], [rs, ys + rn * 1.2], [0, ys + rn * 1.2]]), { seg: 48 }), role: 'cap' })
      const head = roundedBox(rn * 1.8, rn * 0.9, rn * 1.6, rn * 0.25, 10)
      head.translate(0, ys + rn * 1.15, 0)
      out.push({ geo: head, role: 'cap' })
      const nozzle = roundedBox(rn * 0.55, rn * 0.42, rn * 2.4, rn * 0.15, 8)
      nozzle.translate(0, ys + rn * 1.45, rn * 1.5)
      out.push({ geo: nozzle, role: 'cap' })
      return out
    }
    // screw cap (default)
    const rc = rn * 1.28
    const hc = Math.max(1.2, rn * 1.5)
    const prof = profile([
      [0, y + hc],
      [rc * 0.94, y + hc, 0.15],
      [rc, y + hc - 0.2, 0.1],
      [rc, y - hc * 0.55, 0.08],
      [rn * 0.98, y - hc * 0.55],
    ])
    out.push({ geo: lathe(prof, { seg: 220, ripple: (phi, yy) => (yy < y + hc - 0.3 && yy > y - hc * 0.5 ? 1 + 0.01 * Math.cos(72 * phi) : 1) }), role: 'cap' })
    return out
  }

  function jar(o) {
    const R = o.diameter / 20
    const H = o.height / 10
    const hl = Math.min(H * 0.32, R * 0.5)
    const yb = H - hl
    const prof = profile([
      [0, 0.32],
      [R * 0.75, 0.14, 0.3],
      [R * 0.96, 0, 0.35],
      [R, 0.55, 0.5],
      [R, yb - 0.55, 0.45],
      [R * 0.9, yb - 0.1, 0.15],
      [R * 0.9, yb + 0.3],
      [0, yb + 0.3],
    ])
    const parts = []
    if (o.liquid && o.glass) {
      const [lower, upper] = split(prof, Math.max(0.6, (yb - 0.2) * Math.min(1, o.fill)))
      parts.push({ geo: lathe(lower), role: 'filled' }, { geo: lathe(upper), role: 'glass' })
    } else parts.push({ geo: lathe(prof), role: o.glass ? 'glass' : 'body' })
    const rl = R * 1.025
    const lid = profile([
      [R * 0.86, yb - 0.02],
      [rl, yb - 0.02, 0.06],
      [rl, H - 0.12, 0.2],
      [rl * 0.97, H, 0.12],
      [0, H],
    ])
    parts.push({ geo: lathe(lid, { seg: 200, ripple: o.ribbed ? (phi, yy) => (yy < H - 0.35 && yy > yb + 0.15 ? 1 + 0.008 * Math.cos(90 * phi) : 1) : null }), role: 'lid' })
    let label = null
    if (o.label !== false) {
      const [b0, b1] = o.band ?? [0.75, yb - 0.75]
      const lab = band(prof, b0, b1, 0.01)
      const wrap = (o.wrap / 360) * TAU
      parts.push({ geo: lathe(lab, { wrap }), role: 'label' })
      if (o.glass) parts.push({ geo: lathe(band(prof, b0, b1, 0.009), { wrap }), role: 'label-back' })
      label = { width: R * wrap, height: lab.at(-1).s, wrap: o.wrap }
    }
    if (o.top) {
      const disc = lathe(profile([[rl * 0.8, H + 0.004], [0, H + 0.004]]), { seg: 96 })
      // Planar uv over the top, so the art reads from the front.
      const p = disc.attributes.position
      const uv = disc.attributes.uv
      for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (rl * 1.6), 0.5 - p.getZ(i) / (rl * 1.6))
      parts.push({ geo: disc, role: 'top' })
    }
    return { parts, label, top: o.top ? { width: rl * 1.6, height: rl * 1.6 } : null, size: [2 * rl, H, 2 * rl] }
  }

  function tube(o) {
    const R = o.diameter / 20
    const H = o.height / 10
    const hc = Math.max(1.4, R * 1.15)
    const rc = R * 0.92
    const parts = []
    // Cap, standing on the table.
    parts.push({ geo: lathe(profile([[0, 0], [rc * 0.95, 0, 0.12], [rc, hc, 0.12], [R * 0.6, hc + 0.02, 0.04], [0, hc + 0.02]]), { seg: 160, ripple: o.cap === 'ribbed' ? (phi, y) => (y > 0.15 && y < hc - 0.15 ? 1 + 0.01 * Math.cos(70 * phi) : 1) : null }), role: 'cap' })
    // Shoulder: a short cone from the neck to the body.
    const y0 = hc
    const ys = hc + Math.max(0.5, R * 0.4)
    parts.push({ geo: lathe(profile([[0, y0], [R * 0.55, y0, 0.05], [R * 0.98, ys - 0.12, 0.2], [R, ys]]), { seg: 160 }), role: 'body' })
    // Body: round at the shoulder, flattening to the crimp at the top.
    const yc = H - Math.max(0.9, R * 0.7) // where the crimp starts
    const flatW = (Math.PI * R) / 2
    const shapeAt = (v) => {
      const t = Math.pow(v, 1.25)
      const e = t * t * (3 - 2 * t)
      return [R + (flatW - R) * e, R * (1 - e) + 0.035 * e]
    }
    const body = (u, v, sgn = 1) => {
      // u around the tube 0..1 (0.5 is the front), v up the body 0..1.
      const [a, b] = shapeAt(v)
      const th = (u - 0.5) * TAU
      const y = ys + (yc - ys) * v
      return [a * Math.sin(th), y, b * Math.cos(th) * sgn]
    }
    parts.push({ geo: surface((u, v) => body(u, v), 128, 96), role: 'label' })
    // The crimp: a flat sealed strip with fine ridges.
    const crimp = surface(
      (u, v) => {
        const x = (u - 0.5) * 2 * flatW
        const y = yc + (H - yc) * v
        const ridge = 0.012 * Math.sin(v * Math.PI * 2 * 7)
        return [x, y, 0.035 + ridge]
      },
      24,
      48,
    )
    parts.push({ geo: crimp, role: 'crimp' })
    const crimpBack = surface(
      (u, v) => {
        const x = (u - 0.5) * 2 * flatW
        const y = yc + (H - yc) * v
        return [x, y, -0.035 - 0.012 * Math.sin(v * Math.PI * 2 * 7)]
      },
      24,
      48,
      { flip: true },
    )
    parts.push({ geo: crimpBack, role: 'crimp' })
    const edge = roundedBox(2 * flatW, 0.06, 0.08, 0.02, 4)
    edge.translate(0, H - 0.03, 0)
    parts.push({ geo: edge, role: 'crimp' })
    return {
      parts,
      label: { width: TAU * R, height: yc - ys, wrap: 360 },
      size: [2 * flatW, H, 2 * R],
    }
  }

  function box(o) {
    const w = o.width / 10
    const h = o.height / 10
    const d = o.depth / 10
    const r = Math.min(0.12, Math.min(w, h, d) * 0.03)
    return {
      parts: [{ geo: roundedBox(w, h, d, r), role: 'box' }],
      faces: {
        front: [w, h],
        back: [w, h],
        left: [d, h],
        right: [d, h],
        top: [w, d],
        bottom: [w, d],
      },
      label: { width: w, height: h },
      size: [w, h, d],
    }
  }

  function pouch(o) {
    const W = o.width / 10
    const H = o.height / 10
    const G = o.depth / 10
    const seal = Math.min(0.7, W * 0.045) // side seals
    const topSeal = Math.min(2.6, H * 0.12)
    const us = 1 - (2 * seal) / W // where the side seals start, in u
    const vs = 1 - topSeal / H
    const half = (u, v) => {
      // Half-thickness at (u, v): full gusset at the bottom, sealed flat at
      // the top and sides, puffed in between.
      const x = Math.abs(u * 2 - 1)
      const across = x >= us ? 0 : Math.pow(1 - Math.pow(x / us, 2.2), 0.55)
      const vv = Math.min(1, v / vs)
      const up = v >= vs ? 0 : Math.pow(1 - Math.pow(vv, 2.4), 0.8) * (0.62 + 0.38 * (1 - vv))
      return (G / 2) * across * up + 0.03
    }
    const pinch = (u, v) => {
      const vv = Math.min(1, v / vs)
      const fullness = v >= vs ? 0 : Math.pow(1 - Math.pow(vv, 2.4), 0.8)
      return 1 - 0.055 * fullness * (1 - Math.abs(u * 2 - 1))
    }
    const f = (sgn) => (u, v) => {
      const x = (u - 0.5) * W * pinch(u, v) * (1 - 0.035 * Math.min(1, v / vs))
      return [x, v * H, sgn * half(u, v)]
    }
    const parts = [
      { geo: surface(f(1), 120, 160), role: 'label' },
      { geo: surface(f(-1), 120, 160, { flip: true, uvOf: (u, v) => [1 - u, v] }), role: 'back' },
    ]
    // Bottom: the gusset's oval footprint.
    const n = 120
    const pos = []
    const nrm = []
    const idx = []
    for (let i = 0; i <= n; i++) {
      const u = i / n
      const p1 = f(1)(u, 0)
      const p2 = f(-1)(u, 0)
      pos.push(p1[0], 0.001, p1[2], p2[0], 0.001, p2[2])
      nrm.push(0, -1, 0, 0, -1, 0)
      if (i < n) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    parts.push({ geo: geometry(new Float32Array(pos), new Float32Array(nrm), null, idx), role: 'back' })
    // Zip: a ridge across the front, under the top seal.
    const zy = H * (vs - 0.035)
    const zip = surface((u, v) => {
      const x = (u - 0.5) * W * 0.985 * pinch(u, zy / H)
      const t = (v - 0.5) * 2
      const base = half(u, zy / H)
      return [x, zy + t * 0.12, base + 0.05 * Math.sqrt(Math.max(0, 1 - t * t)) * (Math.abs(u * 2 - 1) < us ? 1 : 0.3)]
    }, 80, 8)
    parts.push({ geo: zip, role: 'zip' })
    return { parts, label: { width: W, height: H }, back: { width: W, height: H }, size: [W, H, G] }
  }

  const BUILD = { can, bottle, jar, tube, box, pouch }
  return { PRESETS, build: (shape, o) => BUILD[shape](o), roundedBox, lathe, profile, slab, surface }
})()
