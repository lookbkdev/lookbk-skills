// Shop Collection Kit's still-life studio, adapted from Lookbk's Studio
// Product Shot (the same author): a seamless backdrop, softbox lighting, soft shadows and a
// long-lens camera, around products built by shapes.js. render.mjs opens
// studio.html in headless Chrome and calls window.studio.render(job) once
// per image; it returns the PNG as a data URL and what it measured.
/* global THREE, Shapes */
window.studio = (() => {
  const T = THREE
  const D2R = Math.PI / 180

  let renderer = null
  function getRenderer() {
    if (renderer) return renderer
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(1)
    renderer.toneMapping = T.NeutralToneMapping
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = T.VSMShadowMap
    return renderer
  }

  // ---------- lighting ----------
  // Each look is a set of softboxes reflected in the product (an
  // environment map), plus one key light that casts the soft shadow.
  // Softboxes stand around the product: az is degrees around from the
  // camera (negative is camera left), el degrees up, size [w, h] and power
  // their brightness. Tall strips matter most: a bottle or can only
  // reflects what is near the horizon.
  const LOOKS = {
    soft: {
      exposure: 0.9,
      wall: 0.1,
      floor: 0.75,
      boxes: [
        { az: -52, el: 8, size: [5, 18], power: 7 },
        { az: 68, el: 5, size: [4, 16], power: 2.2 },
        { az: -122, el: 5, size: [1.3, 18], power: 12 },
        { az: 122, el: 5, size: [1.3, 18], power: 12 },
        { az: 0, el: 75, size: [9, 9], power: 3 },
        { az: 180, el: 14, size: [14, 5], power: 2.4 },
      ],
      key: { dir: [-0.55, 1.5, 0.6], power: 1.2, shadow: 0.34, soft: 24 },
      contact: 0.85,
      pool: 0.12,
      fall: 0.3,
    },
    crisp: {
      exposure: 1.02,
      wall: 0.22,
      boxes: [
        { az: -38, el: 6, size: [1.8, 16], power: 6 },
        { az: 38, el: 6, size: [1.8, 16], power: 6 },
        { az: -122, el: 5, size: [2.2, 16], power: 4 },
        { az: 122, el: 5, size: [2.2, 16], power: 4 },
        { az: 0, el: 70, size: [10, 10], power: 2.2 },
        { az: 0, el: 10, size: [8, 5], power: 0.9 },
        { az: 180, el: 30, size: [16, 8], power: 1.6 },
      ],
      key: { dir: [0.25, 1.0, 0.45], power: 1.4, shadow: 0.34, soft: 22 },
      contact: 0.75,
      pool: 0.1,
      fall: 0.16,
    },
    dramatic: {
      exposure: 1.0,
      wall: 0.03,
      boxes: [
        { az: -112, el: 4, size: [1.1, 16], power: 9 },
        { az: 112, el: 4, size: [1.1, 16], power: 9 },
        { az: -30, el: 55, size: [4, 4], power: 3 },
        { az: 45, el: 6, size: [3, 10], power: 0.45 },
      ],
      key: { dir: [-0.3, 1.0, 0.25], power: 2.4, shadow: 0.7, soft: 12 },
      contact: 0.9,
      pool: 0.22,
      fall: 0.62,
    },
    sunlit: {
      exposure: 1.0,
      wall: 0.24,
      boxes: [
        { az: -80, el: 25, size: [8, 10], power: 4.5, warm: true },
        { az: 60, el: 6, size: [6, 12], power: 1.0 },
        { az: 135, el: 5, size: [1.6, 14], power: 2.5 },
        { az: 0, el: 70, size: [10, 10], power: 0.8 },
      ],
      key: { dir: [-1.0, 0.75, 0.2], power: 3.2, shadow: 0.6, soft: 4, warm: true },
      contact: 0.75,
      pool: 0.08,
      fall: 0.2,
    },
  }
  const WARM = new T.Color().setRGB(1.0, 0.86, 0.68)

  function quad(w, h) {
    const g = new T.BufferGeometry()
    g.setAttribute(
      'position',
      new T.BufferAttribute(new Float32Array([-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0]), 3),
    )
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3))
    g.setAttribute('uv', new T.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
    g.setIndex([0, 1, 2, 0, 2, 3])
    return g
  }

  /** The environment map: a room in the backdrop's colour with the look's softboxes. */
  function environment(r, look, backdrop) {
    const scene = new T.Scene()
    const base = new T.Color(backdrop)
    const room = new T.Mesh(
      Shapes.roundedBox(24, 24, 24, 0.5, 4),
      new T.MeshBasicMaterial({ color: base.clone().multiplyScalar(look.wall), side: T.BackSide }),
    )
    room.position.y = -12
    scene.add(room)
    // The floor and the sweep below the horizon, lit, so the product picks
    // up the backdrop's colour in its lower half the way it would on set.
    const floor = new T.Mesh(quad(24, 24), new T.MeshBasicMaterial({ color: base.clone().multiplyScalar(look.floor ?? 0.6) }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.5
    scene.add(floor)
    for (const b of look.boxes) {
      const c = new T.Color().setRGB(b.power, b.power, b.power)
      if (b.warm) c.multiply(WARM)
      const m = new T.Mesh(quad(b.size[0], b.size[1]), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }))
      const az = b.az * D2R
      const el = b.el * D2R
      m.position.set(Math.sin(az) * Math.cos(el) * 10, Math.sin(el) * 10, Math.cos(az) * Math.cos(el) * 10)
      m.lookAt(0, 0, 0)
      scene.add(m)
    }
    const pmrem = new T.PMREMGenerator(r)
    const rt = pmrem.fromScene(scene, 0.02, 0.1, 100, { size: 256 })
    pmrem.dispose()
    scene.traverse((o) => {
      o.geometry?.dispose()
      o.material?.dispose()
    })
    return rt
  }

  // ---------- materials ----------
  const GLASS = {
    clear: { tint: '#ffffff', dist: 0, rough: 0.02 },
    frosted: { tint: '#ffffff', dist: 0, rough: 0.32 },
    amber: { tint: '#9a4512', dist: 0.6, rough: 0.03 },
    green: { tint: '#3f7d4c', dist: 1.4, rough: 0.03 },
    blue: { tint: '#2f5fb8', dist: 1.3, rough: 0.03 },
    smoke: { tint: '#55514d', dist: 0.9, rough: 0.04 },
    rose: { tint: '#e8a3a0', dist: 2.2, rough: 0.03 },
  }
  const FINISH = {
    matte: { roughness: 0.82 },
    satin: { roughness: 0.52, clearcoat: 0.3, clearcoatRoughness: 0.32 },
    gloss: { roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.05 },
    metallic: { roughness: 0.32, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.06 },
  }

  function physical(p) {
    const m = new T.MeshPhysicalMaterial({ envMapIntensity: 1, ...p })
    return m
  }

  /** A surface material by name: glass, metal, plastic... with a colour. */
  function surface(kind, color, finish) {
    const c = new T.Color(color || '#ffffff')
    if (kind.endsWith('glass')) {
      const g = GLASS[kind.replace(/-?glass$/, '') || 'clear'] || GLASS.clear
      const tint = new T.Color(g.tint)
      return physical({
        color: new T.Color('#ffffff').lerp(tint, 0.25),
        transmission: 1,
        roughness: g.rough,
        metalness: 0,
        ior: 1.5,
        thickness: 0.6,
        attenuationColor: tint,
        attenuationDistance: g.dist || Infinity,
        specularIntensity: 1,
        side: T.FrontSide,
      })
    }
    switch (kind) {
      case 'aluminium':
        return physical({ color: c, metalness: 1, roughness: 0.24 })
      case 'metal':
        return physical({ color: c, metalness: 1, roughness: finish === 'matte' ? 0.42 : 0.2 })
      case 'ceramic':
        return physical({ color: c, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 })
      case 'rubber':
        return physical({ color: c, roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.5 })
      case 'wood':
        return physical({ color: c, roughness: 0.86 })
      case 'paper':
        return physical({ color: c, ...(FINISH[finish] || FINISH.matte) })
      case 'matte-plastic':
        return physical({ color: c, roughness: 0.66, clearcoat: 0.1, clearcoatRoughness: 0.6 })
      default:
        // plastic
        return physical({ color: c, roughness: finish === 'matte' ? 0.6 : 0.28, clearcoat: finish === 'matte' ? 0.1 : 0.7, clearcoatRoughness: 0.12 })
    }
  }

  // ---------- label art ----------
  async function loadImage(src) {
    const img = new Image()
    img.decoding = 'sync'
    img.src = src
    await img.decode()
    return img
  }

  /**
   * Draws label art into a canvas the shape of the printed area (w×h cm),
   * fitted as asked: stretch (the art was made at these proportions),
   * cover (crop) or contain (pad with `bg`).
   */
  async function art(src, w, h, fit = 'stretch', bg = null) {
    const img = await loadImage(src)
    const aspect = w / h
    const max = 4096
    const cw = aspect >= 1 ? max : Math.round(max * aspect)
    const ch = aspect >= 1 ? Math.round(max / aspect) : max
    const c = document.createElement('canvas')
    c.width = cw
    c.height = ch
    const x = c.getContext('2d', { willReadFrequently: true })
    if (bg) {
      x.fillStyle = bg
      x.fillRect(0, 0, cw, ch)
    }
    const iw = img.naturalWidth || img.width || cw
    const ih = img.naturalHeight || img.height || ch
    if (fit === 'stretch') x.drawImage(img, 0, 0, cw, ch)
    else {
      const s = fit === 'cover' ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih)
      x.drawImage(img, (cw - iw * s) / 2, (ch - ih * s) / 2, iw * s, ih * s)
    }
    const data = x.getImageData(0, 0, cw, ch).data
    let clear = 0
    for (let i = 3; i < data.length; i += 4 * 97) if (data[i] < 250) clear++
    const tex = new T.CanvasTexture(c)
    tex.colorSpace = T.SRGBColorSpace
    tex.anisotropy = getRenderer().capabilities.getMaxAnisotropy()
    // Average colour of a strip: [x0, y0, x1, y1] in 0-1.
    const avg = (x0, y0, x1, y1) => {
      const d = x.getImageData(Math.floor(x0 * cw), Math.floor(y0 * ch), Math.max(1, Math.floor((x1 - x0) * cw)), Math.max(1, Math.floor((y1 - y0) * ch))).data
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let i = 0; i < d.length; i += 16) {
        if (d[i + 3] < 128) continue
        r += d[i]
        g += d[i + 1]
        b += d[i + 2]
        n++
      }
      if (!n) return null
      return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`
    }
    return { tex, transparent: clear > 0, avg }
  }

  // ---------- products ----------
  async function product(spec, disposables) {
    const built = (window.Objects && Objects[spec.shape]) ? Objects[spec.shape](spec.dims || {}) : Shapes.build(spec.shape, spec.dims)
    const group = new T.Group()
    const mats = {}
    const keep = (m) => (disposables.push(m), m)
    let label = null
    // Where the art is the whole surface (a tube, pouch, can or carton),
    // clear parts of it show the body colour, as ink printed on the pack.
    const under = ['tube', 'pouch', 'can', 'box'].includes(spec.shape) ? spec.color || (spec.shape === 'can' ? '#cfd3d8' : '#f4f2ee') : null
    if (spec.label && built.label) {
      label = await art(spec.label.src, built.label.width, built.label.height, spec.label.fit, spec.label.bg ?? under)
      disposables.push(label.tex)
    }
    const finish = FINISH[spec.labelFinish] || FINISH.satin
    const printed = (a) =>
      keep(
        physical({
          map: a.tex,
          ...finish,
          transparent: a.transparent,
          side: T.FrontSide,
        }),
      )
    const bodyKind = spec.material
    const edge = label ? label.avg(0, 0.97, 1, 1) : null
    const top = label ? label.avg(0, 0, 1, 0.03) : null
    for (const part of built.parts) {
      let m
      if (part.mat) {
        m = keep(physical(part.mat))
        if (part.normalScale) m.normalScale.set(part.normalScale, -part.normalScale)
      }
      else switch (part.role) {
        case 'glass':
          m = mats.glass ??= keep(surface(bodyKind, spec.color))
          break
        case 'filled': {
          // Glass with the liquid behind it: tinted by the liquid, deeper
          // through the middle than at the edges.
          const g = GLASS[(bodyKind || '').replace(/-?glass$/, '') || 'clear'] || GLASS.clear
          const liquid = new T.Color(spec.liquid)
          const R = built.size[0] / 2
          m = mats.filled ??= keep(
            physical({
              color: new T.Color('#ffffff').lerp(liquid, 0.4),
              transmission: 1,
              roughness: g.rough,
              ior: 1.42,
              thickness: R * 1.6,
              attenuationColor: liquid,
              attenuationDistance: R * 1.4,
              specularIntensity: 1,
            }),
          )
          break
        }
        case 'metal':
          m = mats.metal ??= keep(surface('aluminium', spec.color || '#dcdfe3'))
          break
        case 'label':
          if (label) m = mats.label ??= printed(label)
          else m = mats.body ??= keep(surface(bodyKind === 'glass' ? 'plastic' : bodyKind, spec.color, spec.finish))
          break
        case 'label-back':
          m = mats.back ??= keep(
            label?.transparent
              ? physical({ map: label.tex, roughness: 0.7, transparent: true, side: T.BackSide })
              : physical({ color: new T.Color('#efece6'), roughness: 0.85, side: T.BackSide }),
          )
          break
        case 'cap':
          m = mats.cap ??= keep(surface(spec.capMaterial, spec.capColor, spec.capFinish))
          break
        case 'cork':
          m = mats.cork ??= keep(surface('wood', spec.capColor || '#b9895c'))
          break
        case 'rubber':
          m = mats.rubber ??= keep(surface('rubber', spec.bulbColor || '#2b2725'))
          break
        case 'pipette':
          m = mats.pipette ??= keep(physical({ color: new T.Color('#e9eef0'), roughness: 0.1, transparent: true, opacity: 0.35 }))
          break
        case 'lid':
          m = mats.lid ??= keep(surface(spec.capMaterial, spec.capColor, spec.capFinish))
          break
        case 'top': {
          const a = await art(spec.top.src, built.top.width, built.top.height, spec.top.fit || 'contain', null)
          disposables.push(a.tex)
          m = keep(physical({ map: a.tex, ...finish, transparent: true }))
          break
        }
        case 'body':
          // Tube shoulders and opaque jars: the label's edge colour, or the body colour.
          m = mats.body ??= keep(surface(bodyKind, spec.color || edge || '#f4f2ee', spec.finish))
          break
        case 'crimp':
          m = mats.crimp ??= keep(surface(bodyKind, spec.color || top || edge || '#f4f2ee', spec.finish))
          break
        case 'back': {
          if (!mats.packBack) {
            if (spec.back) {
              const a = await art(spec.back.src, built.back.width, built.back.height, spec.back.fit, spec.back.bg ?? under)
              disposables.push(a.tex)
              mats.packBack = keep(physical({ map: a.tex, ...finish, side: T.FrontSide }))
            } else mats.packBack = keep(physical({ color: new T.Color(spec.color || (label && label.avg(0.1, 0.4, 0.9, 0.6)) || '#eeeeee'), ...finish }))
          }
          m = mats.packBack
          break
        }
        case 'zip':
          m = mats.zip ??= keep(physical({ color: new T.Color(spec.color || (label && label.avg(0.1, 0.06, 0.9, 0.1)) || '#dddddd'), roughness: 0.4, clearcoat: 0.6 }))
          break
        case 'box': {
          const names = ['front', 'back', 'left', 'right', 'top', 'bottom']
          const list = []
          for (const n of names) {
            const f = spec.faces?.[n]
            if (f) {
              const [w, h] = built.faces[n]
              const a = await art(f.src, w, h, f.fit, f.bg ?? under)
              disposables.push(a.tex)
              list.push(keep(physical({ map: a.tex, ...(FINISH[spec.finish] || FINISH.satin) })))
            } else list.push(keep(surface('paper', spec.color || '#f1efe9', spec.finish || 'satin')))
          }
          m = list
          break
        }
        default:
          m = mats.body ??= keep(surface(bodyKind, spec.color, spec.finish))
      }
      const mesh = new T.Mesh(part.geo, m)
      disposables.push(part.geo)
      mesh.castShadow = part.role !== 'label-back' && part.role !== 'pipette'
      mesh.receiveShadow = true
      mesh.userData.role = part.role
      if (part.role === 'label' || part.role === 'top') mesh.renderOrder = 2
      if (part.noShadow) mesh.castShadow = false
      if (part.noFit) mesh.userData.noFit = true
      group.add(mesh)
    }
    group.userData.size = built.size
    return group
  }

  // ---------- backdrop and props ----------

  /** A seamless sweep: floor curving up into a back wall, x from -w/2 to w/2. */
  // view: { cx, cy, hw, hh } the centre of the products and the half width
  // and half height the camera sees there, so the light pool and fall-off
  // read the same in every framing.
  function sweep(w, front, back, radius, height, color, look, view) {
    const nx = 96
    const prof = []
    // Profile in (z, y): floor from the front to where the curve starts,
    // a quarter circle, then the wall.
    const zc = -back + radius
    for (let i = 0; i <= 40; i++) prof.push([front - ((front - zc) * i) / 40, 0, 0, 1])
    for (let i = 1; i <= 24; i++) {
      const a = (i / 24) * (Math.PI / 2)
      prof.push([zc - Math.sin(a) * radius, radius - Math.cos(a) * radius, Math.sin(a), Math.cos(a)])
    }
    for (let i = 1; i <= 60; i++) prof.push([-back, radius + ((height - radius) * Math.pow(i / 60, 1.6)), 1, 0])
    const base = new T.Color(color)
    const white = new T.Color(1, 1, 1)
    const dark = base.clone().multiplyScalar(0.5)
    const L = Math.min(1, Math.max(0.05, 0.2126 * base.r + 0.7152 * base.g + 0.0722 * base.b))
    const v = view || { cx: 0, cy: radius, hw: w / 4, hh: height / 4 }
    const pos = []
    const nrm = []
    const col = []
    const idx = []
    for (let i = 0; i <= nx; i++) {
      const t = i / nx
      const x = -w / 2 + w * (0.5 + 0.5 * Math.sign(t - 0.5) * Math.pow(Math.abs(2 * t - 1), 1.8))
      for (const [z, y, nz, ny] of prof) {
        pos.push(x, y, z)
        nrm.push(0, ny, nz)
        // A pool of light behind the products, falling off toward the top
        // and sides of the frame.
        const dx = (x - v.cx) / (v.hw * 1.05)
        const dy = (y - v.cy * 0.9) / (v.hh * 1.1)
        const r2 = dx * dx + dy * dy
        const pool = Math.exp(-r2 * 1.2)
        const up = Math.min(1, Math.max(0, (y - v.cy) / (v.hh * 1.6)))
        const side = Math.min(1, Math.abs(dx) / 1.4)
        const c = base.clone()
        // Light adds to a pale backdrop and multiplies a dark one, so a dark
        // sweep stays dark with a glow behind the products.
        c.lerp(white, look.pool * pool * L)
        c.multiplyScalar(1 + look.pool * pool * (1 - L) * 2)
        c.lerp(dark, look.fall * Math.min(1, 0.6 * up * up + 0.55 * side * side))
        col.push(c.r, c.g, c.b)
      }
    }
    const rows = prof.length
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < rows - 1; j++) {
        const a = i * rows + j
        const b = (i + 1) * rows + j
        idx.push(a, b, b + 1, a, b + 1, a + 1)
      }
    const g = new T.BufferGeometry()
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3))
    g.setAttribute('color', new T.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    return g
  }

  function prop(p, box, disposables) {
    const S = Math.max(box.max.y, box.max.x - box.min.x)
    const color = new T.Color(p.color)
    const mat = physical({ color, roughness: p.finish === 'gloss' ? 0.25 : 0.72, clearcoat: p.finish === 'gloss' ? 0.6 : 0 })
    disposables.push(mat)
    let geo
    let at = [0, 0, 0]
    const place = (where, r) => {
      const gap = r + S * 0.06
      const xs = { left: box.min.x - gap, right: box.max.x + gap }
      const zs = { back: box.min.z - r * 0.6, front: box.max.z + r * 1.2 }
      const [a, b] = where.split('-')
      const x = xs[b] ?? xs[a] ?? 0
      const z = zs[a] ?? (box.min.z + box.max.z) / 2
      return [x, z]
    }
    switch (p.type) {
      case 'sphere': {
        const r = (p.size ?? 40) / 20
        const prof = []
        for (let i = 0; i <= 48; i++) {
          const a = -Math.PI / 2 + (Math.PI * i) / 48
          prof.push([Math.cos(a) * r, r + Math.sin(a) * r, 0, true])
        }
        prof[0][0] = 0
        prof[48][0] = 0
        geo = Shapes.lathe(Shapes.profile(prof), { seg: 96 })
        const [x, z] = Array.isArray(p.at) ? p.at.map((v) => v / 10) : place(p.at || 'front-right', r)
        at = [x, 0, z]
        break
      }
      case 'block': {
        const s = (p.size ?? 60) / 10
        geo = Shapes.roundedBox(s, s * 0.8, s, s * 0.05, 8)
        const [x, z] = Array.isArray(p.at) ? p.at.map((v) => v / 10) : place(p.at || 'back-left', s / 2)
        at = [x, 0, z]
        break
      }
      case 'arch': {
        const h = Math.max(box.max.y * 1.4, (box.max.x - box.min.x) * 0.85)
        const w = Math.max((box.max.x - box.min.x) * 1.45, h * 0.6)
        const pts = []
        pts.push([w / 2, 0])
        for (let i = 0; i <= 32; i++) {
          const a = (Math.PI * i) / 32
          pts.push([Math.cos(a) * (w / 2), h - w / 2 + Math.sin(a) * (w / 2)])
        }
        pts.push([-w / 2, 0])
        geo = Shapes.slab(pts, 1.2)
        at = [0, 0, box.min.z - Math.max(6, S * 0.45)]
        break
      }
      default:
        return null
    }
    disposables.push(geo)
    const mesh = new T.Mesh(geo, mat)
    mesh.position.set(...at)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.role = 'prop'
    mesh.userData.fit = p.type !== 'arch'
    return mesh
  }

  /** A plinth the products stand on: round (podium) or square (plinth). */
  function stage(kind, color, width, depth, height, disposables) {
    const mat = physical({ color: new T.Color(color), roughness: 0.7 })
    disposables.push(mat)
    let geo
    if (kind === 'podium') {
      const r = Math.max(width, depth) / 2
      geo = Shapes.lathe(Shapes.profile([[0, 0], [r, 0, 0.1], [r, height, 0.18], [0, height]]), { seg: 160 })
    } else geo = Shapes.roundedBox(width, height, depth, 0.15, 8)
    disposables.push(geo)
    const m = new T.Mesh(geo, mat)
    m.castShadow = true
    m.receiveShadow = true
    m.userData.role = 'stage'
    m.userData.fit = true
    return m
  }

  // ---------- shadows ----------
  const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }'

  /**
   * Contact shadow: `casters` seen from below, darker the closer they come
   * to the surface at height `base`, blurred, and laid on that surface.
   * `maxPad` keeps it from hanging off the edge of a podium.
   */
  function contactShadow(r, scene, casters, base, strength, tint, disposables, maxPad = Infinity) {
    const box = new T.Box3()
    for (const m of casters) box.expandByObject(m)
    const pad = Math.min(maxPad, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.35 + 2)
    const x0 = box.min.x - pad
    const x1 = box.max.x + pad
    const z0 = box.min.z - pad
    const z1 = box.max.z + pad
    const w = x1 - x0
    const d = z1 - z0
    const res = 1024
    const rw = w >= d ? res : Math.round((res * w) / d)
    const rh = w >= d ? Math.round((res * d) / w) : res
    const rtA = new T.WebGLRenderTarget(rw, rh)
    const rtB = new T.WebGLRenderTarget(rw, rh)
    disposables.push(rtA, rtB)
    const falloff = Math.max(1.5, (box.max.y - base) * 0.22)
    const cam = new T.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 0, box.max.y - base + 5)
    cam.position.set((x0 + x1) / 2, base - 0.01, (z0 + z1) / 2)
    cam.rotation.x = Math.PI / 2
    const depth = new T.ShaderMaterial({
      uniforms: { falloff: { value: falloff } },
      vertexShader: `varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y - ${base.toFixed(4)}; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader:
        'uniform float falloff; varying float vY; void main(){ float a = 1.0 - clamp(vY / falloff, 0.0, 1.0); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * a); }',
      side: T.DoubleSide,
    })
    const blur = new T.ShaderMaterial({
      uniforms: { tex: { value: null }, step: { value: new T.Vector3() } },
      vertexShader: FS_VERT,
      fragmentShader: `uniform sampler2D tex; uniform vec3 step; varying vec2 vUv;
        void main(){
          vec4 s = texture2D(tex, vUv) * 0.1964825501511404;
          s += texture2D(tex, vUv + step.xy * 1.411764705882353) * 0.2969069646728344;
          s += texture2D(tex, vUv - step.xy * 1.411764705882353) * 0.2969069646728344;
          s += texture2D(tex, vUv + step.xy * 3.2941176470588234) * 0.09447039785044732;
          s += texture2D(tex, vUv - step.xy * 3.2941176470588234) * 0.09447039785044732;
          s += texture2D(tex, vUv + step.xy * 5.176470588235294) * 0.010381362401148057;
          s += texture2D(tex, vUv - step.xy * 5.176470588235294) * 0.010381362401148057;
          gl_FragColor = s;
        }`,
      depthTest: false,
      depthWrite: false,
      blending: T.NoBlending,
    })
    disposables.push(depth, blur)
    const fsScene = new T.Scene()
    const fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const fsQuad = new T.Mesh(quad(1, 1), blur)
    fsQuad.frustumCulled = false
    fsScene.add(fsQuad)

    const hidden = []
    const keep = new Set(casters)
    scene.traverse((o) => {
      if (o.isMesh && o.visible && !keep.has(o)) {
        hidden.push(o)
        o.visible = false
      }
    })
    const bg = scene.background
    scene.background = null
    scene.overrideMaterial = depth
    const prevClear = r.getClearAlpha()
    r.setClearColor(0x000000, 0)
    r.setRenderTarget(rtA)
    r.clear()
    r.render(scene, cam)
    scene.overrideMaterial = null
    scene.background = bg
    for (const o of hidden) o.visible = true
    // Blur: wide, then narrower, so the shadow is soft at its edges and
    // still dense right under each product.
    for (const k of [2.2, 1.4, 0.8]) {
      blur.uniforms.tex.value = rtA.texture
      blur.uniforms.step.value.set(k / rw, 0, 0)
      r.setRenderTarget(rtB)
      r.render(fsScene, fsCam)
      blur.uniforms.tex.value = rtB.texture
      blur.uniforms.step.value.set(0, k / rh, 0)
      r.setRenderTarget(rtA)
      r.render(fsScene, fsCam)
    }
    r.setRenderTarget(null)
    r.setClearAlpha(prevClear)

    const mat = new T.ShaderMaterial({
      uniforms: { tex: { value: rtA.texture }, tint: { value: new T.Color(tint) }, strength: { value: strength } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tex; uniform vec3 tint; uniform float strength; varying vec2 vUv;
        void main(){ float a = texture2D(tex, vec2(vUv.x, 1.0 - vUv.y)).a * strength; gl_FragColor = vec4(tint, a);
        #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    disposables.push(mat)
    const plane = new T.Mesh(quad(w, d), mat)
    disposables.push(plane.geometry)
    plane.rotation.x = -Math.PI / 2
    plane.position.set((x0 + x1) / 2, base + 0.003, (z0 + z1) / 2)
    plane.userData.role = 'floor'
    plane.renderOrder = 1
    return plane
  }

  // ---------- camera ----------
  const _v = new T.Vector3()

  /** Projected extent of the meshes marked for fitting, in NDC. */
  function extent(meshes, camera) {
    camera.updateMatrixWorld()
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const m of meshes) {
      m.updateWorldMatrix(true, false)
      const p = m.geometry.attributes.position
      const step = Math.max(1, Math.floor(p.count / 4000))
      for (let i = 0; i < p.count; i += step) {
        _v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).project(camera)
        if (_v.x < x0) x0 = _v.x
        if (_v.x > x1) x1 = _v.x
        if (_v.y < y0) y0 = _v.y
        if (_v.y > y1) y1 = _v.y
      }
    }
    return { x0, x1, y0, y1 }
  }

  /**
   * Places the camera at `elevation` degrees, aimed so the products fill
   * `fill` of the frame (as [width, height] fractions) with their centre at
   * `cy` (NDC, -1 bottom to 1 top), and everything else (stage, props) still
   * fits inside the frame.
   */
  /**
   * True-scale framing (Shop Collection Kit): every product in a collection
   * is shot from the same distance, so the frame is `frameCm` wide at the
   * products and a 14 mm hoop really is half the size of a 26 mm one. A piece
   * that would fill less than `minFill` of the frame is brought closer until
   * it does; `mag` says by how much, so the page can say so under the plate.
   */
  function scaleFrame(camera, subject, box, { elevation, frameCm, minFill = 0, aim = 0.22, mag: forceMag = null }) {
    const el = elevation * D2R
    const dir = new T.Vector3(0, Math.sin(el), Math.cos(el))
    const frameH = frameCm / camera.aspect
    const target = new T.Vector3((box.min.x + box.max.x) / 2, frameH * aim, (box.min.z + box.max.z) / 2)
    let dist = frameH / 2 / Math.tan((camera.fov * D2R) / 2)
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    const e = extent(subject, camera)
    const fill = Math.max((e.x1 - e.x0) / 2, (e.y1 - e.y0) / 2)
    // A product keeps one scale across all its photographs (`mag` given), and
    // a piece only a little under the minimum stays at true scale.
    let mag = forceMag ?? (minFill && fill < minFill ? minFill / fill : 1)
    if (forceMag == null && mag < 1.1) mag = 1
    if (mag > 1) {
      dist /= mag
      target.y /= mag
    }
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.lookAt(target)
    camera.near = dist * 0.05
    camera.far = dist * 10
    camera.updateProjectionMatrix()
    return { dist, target, mag, fill: fill * mag }
  }

  function frame(camera, subject, everything, box, { elevation, fill, cy }) {
    const el = elevation * D2R
    const dir = new T.Vector3(0, Math.sin(el), Math.cos(el))
    const target = new T.Vector3((box.min.x + box.max.x) / 2, box.max.y * 0.45, (box.min.z + box.max.z) / 2)
    let dist = Math.max(box.max.y, box.max.x - box.min.x) * 4
    const room = 0.9
    for (let i = 0; i < 14; i++) {
      camera.position.copy(target).addScaledVector(dir, dist)
      camera.lookAt(target)
      const e = extent(subject, camera)
      const a = extent(everything, camera)
      const k = Math.max(
        (e.x1 - e.x0) / 2 / fill[0],
        (e.y1 - e.y0) / 2 / fill[1],
        (a.x1 - a.x0) / 2 / room,
        (a.y1 - a.y0) / 2 / room,
      )
      dist *= k
      // Aim so the products' centre lands at cy, then nudge so nothing
      // else spills over the top or bottom.
      const half = dist * Math.tan((camera.fov * D2R) / 2)
      let shift = (e.y0 + e.y1) / 2 / k - cy
      const lo = a.y0 / k - shift
      const hi = a.y1 / k - shift
      if (lo < -room) shift -= -room - lo
      if (hi > room) shift += hi - room
      target.y += (shift * half) / Math.cos(el)
      target.x += ((a.x0 + a.x1) / 2 / k) * half * camera.aspect
    }
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.lookAt(target)
    camera.near = dist * 0.05
    camera.far = dist * 10
    camera.updateProjectionMatrix()
    return { dist, target }
  }

  // ---------- one image ----------
  async function render(job) {
    const t0 = performance.now()
    const r = getRenderer()
    const disposables = []
    const look = job.look ? { ...(LOOKS[job.light] || LOOKS.soft), ...job.look } : (LOOKS[job.light] || LOOKS.soft)
    r.setSize(job.width, job.height, false)
    r.toneMappingExposure = look.exposure * (job.exposure ?? 1)
    const scene = new T.Scene()
    const env = environment(r, look, job.backdrop.color)
    disposables.push(env)
    scene.environment = env.texture
    scene.environmentIntensity = 1

    // Products, arranged in a row (or staggered), turned as asked.
    const items = []
    for (const spec of job.products) items.push(await product(spec, disposables))
    const gap = job.gap != null ? job.gap / 10 : null
    let x = 0
    const widths = items.map((g) => g.userData.size[0])
    const gaps = items.map((g, i) => (gap ?? Math.max(0.6, Math.min(widths[i], widths[i + 1] ?? widths[i]) * 0.28)))
    const total = widths.reduce((a, b) => a + b, 0) + gaps.slice(0, -1).reduce((a, b) => a + b, 0)
    x = -total / 2
    const lift = job.stage ? job.stage.height / 10 : 0
    items.forEach((g, i) => {
      const spec = job.products[i]
      g.position.x = x + widths[i] / 2
      x += widths[i] + gaps[i]
      if (job.arrange === 'stagger' && items.length > 1) {
        const mid = (items.length - 1) / 2
        g.position.z = -Math.abs(i - mid) * g.userData.size[2] * 0.75
        if (i === Math.round(mid)) g.position.z += g.userData.size[2] * 0.25
      }
      g.position.y = lift
      g.rotation.y = ((spec.turn ?? 0) + (job.turn ?? 0)) * D2R
      scene.add(g)
    })
    if (job.arrange === 'stagger' && items.length > 1) {
      // Pull the row in: staggered products can stand closer side by side.
      const pull = 0.9
      items.forEach((g) => (g.position.x *= pull))
    }

    const box = new T.Box3()
    for (const g of items) box.expandByObject(g)

    // Stage (a podium or plinth under all the products), then props.
    if (job.stage) {
      const w = box.max.x - box.min.x + Math.max(3, (box.max.x - box.min.x) * 0.3)
      const d = box.max.z - box.min.z + Math.max(3, (box.max.z - box.min.z) * 0.6)
      const st = stage(job.stage.type, job.stage.color, w, d, lift, disposables)
      st.position.set((box.min.x + box.max.x) / 2, 0, (box.min.z + box.max.z) / 2)
      st.userData.margin = Math.min(w - (box.max.x - box.min.x), d - (box.max.z - box.min.z)) / 2
      scene.add(st)
      box.expandByObject(st)
    }
    const subject = []
    for (const g of items) g.traverse((o) => o.isMesh && !o.userData.noFit && subject.push(o))
    const fitted = []
    scene.traverse((o) => o.isMesh && !o.userData.noFit && fitted.push(o))
    for (const p of job.props || []) {
      const m = prop(p, box, disposables)
      if (!m) continue
      if (p.type === 'arch') m.userData.role = 'arch'
      scene.add(m)
      if (m.userData.fit) fitted.push(m)
    }
    const all = new T.Box3()
    for (const m of fitted) all.expandByObject(m)

    // Camera: a long lens, so packaging keeps its proportions.
    const shortSide = Math.min(job.width, job.height)
    const fovShort = 2 * Math.atan(12 / (job.camera.focal || 70))
    const fovV = job.height <= job.width ? fovShort : 2 * Math.atan(Math.tan(fovShort / 2) * (job.height / shortSide))
    const camera = new T.PerspectiveCamera(fovV / D2R, job.width / job.height, 0.1, 5000)
    const placed = job.camera.frameCm ? scaleFrame(camera, subject, all, job.camera) : frame(camera, subject, fitted, all, job.camera)

    // Backdrop: a sweep far enough behind that it fills the frame.
    const S = Math.max(all.max.y, all.max.x - all.min.x, all.max.z - all.min.z)
    const back = -all.min.z + Math.max(S * 1.6, 12)
    const sweepW = Math.max(S * 14, placed.dist * 3)
    const front = placed.dist * 1.2
    const radius = Math.max(S * 1.1, 10)
    const wallH = Math.max(S * 10, placed.dist * 2.5)
    const hh = placed.dist * Math.tan((camera.fov * D2R) / 2)
    const view = { cx: placed.target.x, cy: Math.max(placed.target.y, all.max.y * 0.5), hw: hh * camera.aspect, hh }
    if (!job.transparent) {
      const bg = new T.Mesh(
        sweep(sweepW, front, back, radius, wallH, job.backdrop.color, look, view),
        new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false, dithering: true }),
      )
      bg.userData.role = 'backdrop'
      bg.receiveShadow = false
      disposables.push(bg.geometry, bg.material)
      scene.add(bg)
    }
    const shade = new T.Color(job.backdrop.color).multiplyScalar(0.18)
    const catcher = new T.Mesh(
      sweep(sweepW, front, back, radius, wallH, '#ffffff', { pool: 0, fall: 0 }),
      new T.ShadowMaterial({ color: shade, opacity: look.key.shadow * (job.shadow ?? 1), depthWrite: false, transparent: true }),
    )
    catcher.userData.role = 'floor'
    catcher.receiveShadow = true
    catcher.renderOrder = 1
    disposables.push(catcher.geometry, catcher.material)
    scene.add(catcher)

    // Key light: casts the soft shadow.
    const key = new T.DirectionalLight(look.key.warm ? WARM : 0xffffff, look.key.power)
    const kd = new T.Vector3(...look.key.dir).normalize()
    const centre = new T.Vector3((all.min.x + all.max.x) / 2, 0, (all.min.z + all.max.z) / 2)
    key.position.copy(centre).addScaledVector(kd, S * 6)
    key.target.position.copy(centre)
    key.castShadow = true
    const sc = key.shadow.camera
    const span = S * 2.4
    Object.assign(sc, { left: -span, right: span, top: span, bottom: -span, near: S * 0.5, far: S * 14 })
    sc.updateProjectionMatrix()
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.radius = look.key.soft
    key.shadow.blurSamples = 24
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    scene.add(key, key.target)

    // Contact shadows: under whatever stands on the floor, and under the
    // products on top of the stage when there is one.
    const tint = new T.Color(job.backdrop.color).multiplyScalar(0.12)
    const strength = look.contact * (job.shadow ?? 1)
    const onFloor = fitted.filter((m) => (job.stage ? !subject.includes(m) : true))
    scene.add(contactShadow(r, scene, onFloor, 0, strength, tint, disposables))
    if (job.stage) {
      const st = scene.children.find((o) => o.userData.role === 'stage')
      const margin = Math.min(st.userData.margin, 6)
      scene.add(contactShadow(r, scene, subject, lift, strength, new T.Color(job.stage.color).multiplyScalar(0.12), disposables, margin))
    }

    if (job.transparent) r.setClearColor(0x000000, 0)
    else r.setClearColor(new T.Color(job.backdrop.color), 1)
    r.setRenderTarget(null)
    r.render(scene, camera)

    // What the checks need: where the products ended up in the frame.
    const products = []
    scene.traverse((o) => o.isMesh && o.userData.role && !['backdrop', 'floor', 'arch'].includes(o.userData.role) && products.push(o))
    const e = extent(products, camera)
    const png = r.domElement.toDataURL(job.format === 'webp' ? 'image/webp' : 'image/png', job.quality ?? 0.88)
    for (const d of disposables) d.dispose?.()
    r.renderLists.dispose()
    return {
      png,
      mag: placed.mag ?? 1,
      fill: placed.fill,
      frame: { left: (e.x0 + 1) / 2, right: (1 - e.x1) / 2, top: (1 - e.y1) / 2, bottom: (e.y0 + 1) / 2 },
      ms: Math.round(performance.now() - t0),
      gl: (() => {
        const gl = r.getContext()
        const d = gl.getExtension('WEBGL_debug_renderer_info')
        return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl2'
      })(),
    }
  }

  return { render, looks: Object.keys(LOOKS), presets: Shapes.PRESETS }
})()
