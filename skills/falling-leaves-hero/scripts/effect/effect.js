// Falling Leaves (browser), Motion Heroes kit v2, lockup and editorial
// compositions. three.js r180 (the kit's pin), loaded with ctx.load.
//
// One frame from a long lens at a quarter speed. The headline is a sign
// standing in the focal plane (typeMode "scene": the letters are drawn here,
// from view.type), the only sharp thing in the picture apart from the leaves
// that reach it. Leaves are instanced, bent quads cut from a leaf atlas
// painted in code at start (outline, serration or nicks, veins, mottling, six
// pre-blurred focus levels); each is lit by one light, with light transmitted
// through it when it is backlit, and blurred by a thin-lens circle of
// confusion from its distance to the focal plane.
//
// Paths follow the regimes of falling plates: flutter (a pendulum zigzag,
// stalling at each turn), spiral (a banked helix) and tumble (end over end,
// drifting). Every falling leaf lives an integer number of times per cycle,
// so the loop closes. Landings are solved from the glyph outlines: a few
// leaves per cycle come down onto flat stretches of the letters' top edges,
// rest, then slide along the edge's slope, tip over its end and fall again.
// A scripted gust crosses the frame once per cycle; its push on every leaf is
// integrated once at start into a table that has died away before the cycle
// ends. On a live page the pointer is a gust too (a spring per leaf).
//
// Everything drawn is a function of t (plus the live pointer springs).

const TAU = Math.PI * 2
const S = 256
const NS = 4
const SIG = [0, 1, 2.5, 5, 9, 15]
const NL = SIG.length
const FILL = 0.6
const FOV = 26
const K_COC = 34 // circle of confusion at infinity, CSS px at 900 px tall
const GUST = [8, 10.6] // the scripted gust's window, seconds into the cycle

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const lerp = (a, b, k) => a + (b - a) * k
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d }
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] }
const mixHex = (a, b, k) => '#' + hex(a).map((x, i) => Math.round(255 * lerp(x, hex(b)[i], k)).toString(16).padStart(2, '0')).join('')
const mod = (x, m) => ((x % m) + m) % m

/* ------------------------------------------------------------------ the leaf atlas */
function mapleShape(r) {
  const lobes = [
    { a: 0, L: 1.0, w: 0.6 },
    { a: 1.05, L: 0.9, w: 0.58 }, { a: -1.05, L: 0.9, w: 0.58 },
    { a: 2.12, L: 0.46, w: 0.46 }, { a: -2.12, L: 0.46, w: 0.46 },
  ].map((l) => ({ a: l.a + (r() - 0.5) * 0.12, L: l.L * (0.92 + r() * 0.14), w: l.w }))
  const pts = []
  const N = 900
  for (let i = 0; i < N; i++) {
    const al = -Math.PI + (TAU * i) / N
    const base = 0.33 + 0.06 * Math.cos(al)
    const back = Math.abs(angDiff(al, Math.PI))
    let rad = base - (back < 0.25 ? 0.08 * (1 - back / 0.25) : 0)
    for (const l of lobes) {
      const d = Math.abs(angDiff(al, l.a)) / l.w
      if (d >= 1) continue
      const g = 0.86 * (1 - Math.pow(d, 2.3)) + 0.14 * Math.pow(Math.max(0, 1 - d / 0.14), 1.2)
      let rr = base + (l.L - base) * Math.max(0, g)
      for (const dt of [0.42, 0.7]) {
        const k = Math.max(0, 1 - Math.abs(d - dt) / 0.09)
        rr += 0.12 * l.L * Math.pow(k, 1.5) * (dt > 0.6 ? 0.6 : 1)
      }
      rad = Math.max(rad, rr)
    }
    // fine serration along the lobes' margins (not in the sinuses)
    if (rad > base + 0.06) rad += 0.022 * Math.pow(Math.abs(Math.sin(al * 52 + 0.4)), 4) - 0.006
    rad *= 1 + (r() - 0.5) * 0.008
    pts.push([rad * Math.sin(al), rad * Math.cos(al)])
  }
  const veins = lobes.map((l) => {
    const tip = [l.L * 0.94 * Math.sin(l.a), l.L * 0.94 * Math.cos(l.a)]
    const side = []
    for (const f of [0.32, 0.55, 0.74])
      for (const s of [-1, 1]) {
        const p = [tip[0] * f, tip[1] * f]
        const a2 = l.a + s * (0.62 - f * 0.25)
        const len = l.L * (0.34 - f * 0.18)
        side.push([p, [p[0] + len * Math.sin(a2), p[1] + len * Math.cos(a2)]])
      }
    return { tip, side }
  })
  return { pts, veins, petiole: [[0, 0], [0.07, -0.3], [0.03, -0.66]], kind: 'maple' }
}
function ginkgoShape(r) {
  const half = 0.95 + r() * 0.22
  const notch = 0.16 + r() * 0.22
  const gph = r() * 6
  // small splits and nicks in the margin, as ginkgo fans tear along their veins
  const nicks = [0, 1, 2].map(() => [(r() * 2 - 1) * half * 0.85, 0.02 + r() * 0.02, 0.05 + r() * 0.1])
  const pts = [[0, -0.12]]
  const N = 400
  for (let i = 0; i <= N; i++) {
    const al = -half + (2 * half * i) / N
    let rad = 0.98 + 0.035 * Math.sin(al * 11 + gph) + 0.02 * Math.sin(al * 23 + gph * 2) + 0.012 * Math.sin(al * 61)
    for (const nk of nicks) { const dd = Math.abs(al - nk[0]) / nk[1]; if (dd < 1) rad -= nk[2] * (1 - dd) }
    const dn = Math.abs(al) / 0.07
    if (dn < 1) rad -= notch * (1 - dn * dn)
    const edge = (half - Math.abs(al)) / 0.22
    if (edge < 1) rad *= 0.8 + 0.2 * Math.sqrt(Math.max(0, edge))
    pts.push([rad * Math.sin(al) * 1.05, rad * Math.cos(al) * 1.05 - 0.12])
  }
  pts.push([0, -0.12])
  // dichotomous veins: from the stalk, each forks once on the way out
  const fine = []
  const n = 34
  for (let i = 0; i < n; i++) {
    const al = -half * 0.93 + (2 * half * 0.93 * i) / (n - 1)
    const mid = [0.45 * Math.sin(al), 0.45 * Math.cos(al) - 0.12]
    fine.push([[0, -0.12], mid])
    for (const sd of [-0.022, 0.022]) fine.push([mid, [Math.sin(al + sd), Math.cos(al + sd) - 0.12]])
  }
  return { pts, fine, petiole: [[0, -0.12], [0.03, -0.45], [-0.02, -0.82]], kind: 'ginkgo' }
}
const PALETTES = {
  maple: [
    { c0: '#5e1a14', c1: '#8a2a1e', c2: '#a2402a', vein: '#9a5040', mot: ['#4a1a12', '#7a3a22', '#93502c'], spots: 1 },
    { c0: '#7a3418', c1: '#a2522a', c2: '#b8763a', vein: '#b88a5a', mot: ['#6a2a14', '#8a6a34', '#c08848'], spots: 0 },
    { c0: '#7a7032', c1: '#b0903e', c2: '#c4a650', vein: '#c8b47a', mot: ['#8a6a2a', '#6e6a30', '#a87a34'], spots: 2 },
    { c0: '#5c5e2a', c1: '#8e5a2c', c2: '#903424', vein: '#a07a54', mot: ['#4e5424', '#7a3020', '#a06a34'], spots: 0 },
  ],
  ginkgo: [
    { c0: '#c99a1c', c1: '#e8c234', c2: '#f3dd6a', vein: '#f7e9a0', spots: 0 },
    { c0: '#a9a52c', c1: '#d8c53a', c2: '#ecd85e', vein: '#f2e6a0', spots: 0 },
    { c0: '#b8861a', c1: '#ddb12c', c2: '#e9c74a', vein: '#f3dc8c', spots: 0 },
    { c0: '#8f9a30', c1: '#c3c03c', c2: '#e2d566', vein: '#eee59c', spots: 0 },
  ],
}

function buildAtlas(species, seed) {
  const r = rng(seed * 31 + 5)
  const alb = document.createElement('canvas')
  alb.width = S * NS
  alb.height = S * NL
  const vei = document.createElement('canvas')
  vei.width = S * NS
  vei.height = S * NL
  const A = alb.getContext('2d')
  const V = vei.getContext('2d')
  const outlines = []
  V.fillStyle = '#000'
  V.fillRect(0, 0, vei.width, vei.height)
  for (let c = 0; c < NS; c++) {
    const shape = species === 'maple' ? mapleShape(r) : ginkgoShape(r)
    const pal = PALETTES[species][c]
    const cellA = document.createElement('canvas')
    cellA.width = cellA.height = S
    const cellV = document.createElement('canvas')
    cellV.width = cellV.height = S
    const a = cellA.getContext('2d')
    const w = cellV.getContext('2d')
    const k = (S * FILL) / 2.0
    const tf = (g) => g.setTransform(k, 0, 0, -k, S / 2, S / 2 + 0.02 * k)
    const path = new Path2D()
    shape.pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])))
    path.closePath()
    tf(a)
    a.save()
    a.clip(path)
    const gr = a.createRadialGradient(0, 0.05, 0.02, 0, 0.2, 1.05)
    gr.addColorStop(0, pal.c0)
    gr.addColorStop(0.45, pal.c1)
    gr.addColorStop(1, pal.c2)
    a.fillStyle = gr
    a.fillRect(-1.3, -1.3, 2.6, 2.6)
    a.filter = 'blur(3px)'
    for (let i = 0; i < 110; i++) {
      const x = r() * 2 - 1
      const y = r() * 2 - 1
      const rad = 0.03 + r() * 0.18
      a.globalAlpha = 0.15 + r() * 0.3
      a.fillStyle = (pal.mot || [pal.c0, pal.c1, pal.c2])[Math.floor(r() * 3)]
      a.beginPath()
      a.arc(x, y, rad, 0, 7)
      a.fill()
    }
    a.filter = 'none'
    a.globalAlpha = 1
    for (let i = 0; i < 5 * pal.spots; i++) {
      const x = (r() * 2 - 1) * 0.7
      const y = r() * 0.9 - 0.1
      const rad = 0.025 + r() * 0.05
      a.filter = 'blur(1.5px)'
      a.globalAlpha = 0.5
      a.fillStyle = '#e8c45a'
      a.beginPath()
      a.arc(x, y, rad * 1.7, 0, 7)
      a.fill()
      a.filter = 'blur(0.6px)'
      a.globalAlpha = 0.85
      a.fillStyle = '#2a140a'
      a.beginPath()
      a.arc(x, y, rad * (0.6 + r() * 0.5), 0, 7)
      a.fill()
    }
    a.filter = 'none'
    a.globalAlpha = 1
    const drawVeins = (g, col, scale) => {
      g.strokeStyle = col
      g.lineCap = 'round'
      if (shape.kind === 'maple') {
        for (const vv of shape.veins) {
          g.lineWidth = (2.6 * scale) / k
          g.beginPath()
          g.moveTo(0, 0)
          g.quadraticCurveTo(vv.tip[0] * 0.5 + vv.tip[1] * 0.04, vv.tip[1] * 0.5 - vv.tip[0] * 0.04, vv.tip[0], vv.tip[1])
          g.stroke()
          g.lineWidth = (1.1 * scale) / k
          for (const s of vv.side) {
            g.beginPath()
            g.moveTo(s[0][0], s[0][1])
            g.lineTo(s[1][0], s[1][1])
            g.stroke()
          }
        }
      } else {
        g.lineWidth = (0.9 * scale) / k
        for (const f of shape.fine) {
          g.beginPath()
          g.moveTo(f[0][0], f[0][1])
          g.lineTo(f[1][0], f[1][1])
          g.stroke()
        }
      }
    }
    a.globalAlpha = shape.kind === 'maple' ? 0.22 : 0.4
    drawVeins(a, pal.vein, 1)
    for (let i = 0; i < 1400; i++) {
      a.globalAlpha = 0.06
      a.fillStyle = r() < 0.5 ? '#000' : '#fff'
      a.fillRect(r() * 2 - 1, r() * 2 - 1, 1.4 / k, 1.4 / k)
    }
    a.globalAlpha = 0.5
    a.filter = 'blur(2px)'
    a.strokeStyle = species === 'maple' ? '#3a1408' : '#6b4a12'
    a.lineWidth = 0.07
    a.stroke(path)
    a.filter = 'none'
    a.globalAlpha = 1
    a.restore()
    const pt = shape.petiole
    a.strokeStyle = mixHex(pal.c0, '#3a2210', 0.35)
    a.lineCap = 'round'
    a.lineWidth = (4 / k) * (species === 'maple' ? 1 : 0.9)
    a.beginPath()
    a.moveTo(pt[0][0], pt[0][1])
    a.quadraticCurveTo(pt[1][0], pt[1][1], pt[2][0], pt[2][1])
    a.stroke()
    tf(w)
    w.save()
    w.clip(path)
    w.fillStyle = '#1a1a1a'
    w.fillRect(-1.3, -1.3, 2.6, 2.6)
    drawVeins(w, '#ffffff', 1.6)
    w.restore()
    w.strokeStyle = '#ffffff'
    w.lineWidth = 3.4 / k
    w.beginPath()
    w.moveTo(pt[0][0], pt[0][1])
    w.quadraticCurveTo(pt[1][0], pt[1][1], pt[2][0], pt[2][1])
    w.stroke()
    // the blade's outline in the quad's own units, for the landing solver
    outlines[c] = shape.pts.filter((p, i) => i % 6 === 0).map((p) => [(k * p[0]) / S, (k * p[1] - 0.02 * k) / S])
    for (let l = 0; l < NL; l++) {
      A.filter = SIG[l] ? `blur(${SIG[l]}px)` : 'none'
      A.drawImage(cellA, c * S, l * S)
      V.filter = SIG[l] ? `blur(${SIG[l]}px)` : 'none'
      V.drawImage(cellV, c * S, l * S)
    }
    A.filter = 'none'
    V.filter = 'none'
  }
  return { alb, vei, outlines }
}

/* ------------------------------------------------------------------ shaders */
const LEAF_VS = `
attribute vec4 aA; // atlas cell, focus level, alpha, brightness
attribute vec4 aB; // cup, droop, aerial fog, twist
varying vec2 vU0; varying vec2 vU1; varying float vF; varying vec3 vN; varying vec3 vW; varying vec4 vA; varying float vFog;
void main(){
  vec3 p = position;
  p.z = aB.x * p.x * p.x + aB.y * p.y * p.y + aB.w * p.x * p.y;
  vec3 n = normalize(vec3(-(2.0 * aB.x * p.x + aB.w * p.y), -(2.0 * aB.y * p.y + aB.w * p.x), 1.0));
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(p, 1.0);
  vN = normalize(mat3(m) * n);
  vW = w.xyz;
  float l0 = floor(aA.y); vF = aA.y - l0; float l1 = min(l0 + 1.0, ${NL - 1}.0);
  vU0 = vec2((aA.x + uv.x) / ${NS}.0, (${NL}.0 - l0 - 1.0 + uv.y) / ${NL}.0);
  vU1 = vec2((aA.x + uv.x) / ${NS}.0, (${NL}.0 - l1 - 1.0 + uv.y) / ${NL}.0);
  vA = aA; vFog = aB.z;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const LEAF_FS = `
uniform sampler2D uAlb; uniform sampler2D uVein; uniform vec3 uL; uniform vec3 uLamp; uniform int uMode;
uniform vec3 uSun; uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uFog; uniform float uTrans; uniform float uGrain;
uniform vec4 uPlates[6]; uniform int uNPlates; uniform vec2 uView; uniform float uDpr;
varying vec2 vU0; varying vec2 vU1; varying float vF; varying vec3 vN; varying vec3 vW; varying vec4 vA; varying float vFog;
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 shoulder(vec3 c){ return mix(c, 0.8 + 0.2 * (1.0 - exp(-(c - 0.8) * 5.0)), step(0.8, c)); }
void main(){
  vec4 a = mix(texture2D(uAlb, vU0), texture2D(uAlb, vU1), vF);
  if (a.a < 0.004) discard;
  // leaves dissolve into the ground (or the dark) before they reach a plate, so no plate edge cuts one
  vec2 css = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  float keep = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uNPlates) break;
    vec4 r = uPlates[i];
    vec2 d = max(max(r.xy - css, css - (r.xy + r.zw)), 0.0);
    keep *= smoothstep(0.0, 60.0, length(d));
  }
  if (keep < 0.003) discard;
  float vein = mix(texture2D(uVein, vU0).r, texture2D(uVein, vU1).r, vF);
  vec3 col = a.rgb * vA.w;
  vec3 V = normalize(cameraPosition - vW);
  vec3 n = normalize(vN); if (dot(n, V) < 0.0) n = -n;
  if (!gl_FrontFacing) col = mix(col, vec3(dot(col, vec3(0.3, 0.55, 0.15))) * 1.12, 0.3);
  vec3 L = uL; float amt = 1.0;
  if (uMode == 1) {
    vec3 d = uLamp - vW; float dist = length(d); L = d / dist;
    float cone = smoothstep(-0.25, 0.55, dot(-L, vec3(0.0, -1.0, 0.0)));
    amt = 2.6 / (1.0 + pow(dist / 1700.0, 2.0)) * (0.06 + 0.94 * cone);
  }
  float ndl = dot(n, L);
  float front = max(ndl, 0.0), back = max(-ndl, 0.0);
  float fwd = pow(max(dot(-V, L), 0.0), 3.0);
  vec3 amb = mix(uBot, uTop, n.y * 0.5 + 0.5);
  vec3 refl = col * (amb + uSun * front * amt * 0.95);
  vec3 tcol = mix(pow(col, vec3(0.8)), vec3(dot(col, vec3(0.3, 0.55, 0.15))), 0.2) * vec3(1.05, 1.0, 0.82);
  vec3 trans = tcol * uSun * back * amt * (0.2 + 1.5 * fwd) * (1.0 - 0.5 * vein) * uTrans;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(n, H), 0.0), 42.0) * 0.34 * front * amt + pow(1.0 - max(dot(n, V), 0.0), 4.0) * 0.08 * amt;
  vec3 c = refl + trans + spec * uSun;
  c = mix(c, uFog, vFog);
  c += (h21(floor(gl_FragCoord.xy)) - 0.5) * uGrain;
  gl_FragColor = vec4(shoulder(c), a.a * vA.z * keep);
}`

/* ------------------------------------------------------------------ the effect */
export default {
  async init(c) {
    this.ctx = c
    this.p = c.params
    const THREE = (this.THREE = await c.load('three'))
    const renderer = new THREE.WebGLRenderer({ canvas: c.canvas, antialias: true, alpha: false, preserveDrawingBuffer: !!c.recording })
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    renderer.autoClear = true
    this.renderer = renderer
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 40000)
    const p = this.p
    this.species = p.leaf
    this.night = p.scene === 'lamp-night'
    const atlas = buildAtlas(p.leaf, p.seed)
    this.atlas = atlas
    const tex = (cv) => {
      const t = new THREE.CanvasTexture(cv)
      t.colorSpace = THREE.NoColorSpace
      t.anisotropy = 4
      return t
    }
    this.albTex = tex(atlas.alb)
    this.veiTex = tex(atlas.vei)
    // the backdrop and the sign, painted per size
    this.bgCanvas = document.createElement('canvas')
    this.bgTex = tex(this.bgCanvas)
    this.bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.bgTex, depthTest: false, depthWrite: false }))
    this.bgMesh.renderOrder = 0
    this.letCanvas = document.createElement('canvas')
    this.letTex = tex(this.letCanvas)
    this.letMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.letTex, transparent: true, depthTest: false, depthWrite: false }))
    this.letMesh.renderOrder = 2
    this.scene.add(this.bgMesh, this.letMesh)
    // contact shadows under resting leaves (painted letters only: on dark steel they would not show)
    const sh = document.createElement('canvas')
    sh.width = sh.height = 64
    const sg = sh.getContext('2d')
    const rg = sg.createRadialGradient(32, 32, 0, 32, 32, 32)
    rg.addColorStop(0, 'rgba(20,14,8,0.85)')
    rg.addColorStop(1, 'rgba(20,14,8,0)')
    sg.fillStyle = rg
    sg.fillRect(0, 0, 64, 64)
    const shTex = tex(sh)
    this.shadows = [0, 1, 2, 3].map(() => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0 }))
      m.renderOrder = 2.5
      m.visible = false
      this.scene.add(m)
      return m
    })
    const night = this.night
    this.look = night
      ? { mode: 1, sun: [1.55, 1.3, 0.92], top: [0.06, 0.07, 0.1], bot: [0.03, 0.03, 0.04], fog: hex(p.air), fogAmt: 0.55, trans: 1.5 }
      : { mode: 0, sun: [1.18, 1.0, 0.84], top: [0.42, 0.38, 0.3], bot: [0.26, 0.2, 0.13], fog: hex(p.air), fogAmt: 0.5, trans: 1.0 }
    const plates = []
    for (let i = 0; i < 6; i++) plates.push(new THREE.Vector4())
    this.uniforms = {
      uAlb: { value: this.albTex }, uVein: { value: this.veiTex }, uL: { value: new THREE.Vector3(0, 1, 0) }, uLamp: { value: new THREE.Vector3() }, uMode: { value: this.look.mode },
      uSun: { value: new THREE.Vector3(...this.look.sun) }, uTop: { value: new THREE.Vector3(...this.look.top) }, uBot: { value: new THREE.Vector3(...this.look.bot) },
      uFog: { value: new THREE.Vector3(...this.look.fog) }, uTrans: { value: this.look.trans }, uGrain: { value: 0.045 * p.grain },
      uPlates: { value: plates }, uNPlates: { value: 0 }, uView: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 },
    }
    const mesh = () => {
      const max = 140
      const geo = new THREE.PlaneGeometry(1, 1, 8, 8)
      const aA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4)
      const aB = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4)
      geo.setAttribute('aA', aA)
      geo.setAttribute('aB', aB)
      const mat = new THREE.ShaderMaterial({
        vertexShader: LEAF_VS, fragmentShader: LEAF_FS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, uniforms: this.uniforms,
        // straight colour, and coverage in the alpha channel (the coverage check reads it)
        blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      })
      const m = new THREE.InstancedMesh(geo, mat, max)
      m.frustumCulled = false
      return { mesh: m, aA, aB }
    }
    this.back = mesh()
    this.front = mesh()
    this.back.mesh.renderOrder = 1
    this.front.mesh.renderOrder = 3
    this.scene.add(this.back.mesh, this.front.mesh)
    this._q = new THREE.Quaternion()
    this._q2 = new THREE.Quaternion()
    this._m = new THREE.Matrix4()
    this._p = new THREE.Vector3()
    this._s = new THREE.Vector3()
    this.X = new THREE.Vector3(1, 0, 0)
    this.Y = new THREE.Vector3(0, 1, 0)
    this.Z = new THREE.Vector3(0, 0, 1)
    this.flat = new THREE.Quaternion().setFromAxisAngle(this.X, -Math.PI / 2)
    // the live gust: the pointer's velocity, smoothed, pushes the leaves near it
    this.live = { last: null, px: null, py: null, vx: 0, vy: 0 }
    // the scripts (coverage, still, bench) reach the effect here
    c.root.flh = this
  },

  resize(view) {
    const THREE = this.THREE
    this.view = view
    const W = view.width
    const H = view.height
    this.W = W
    this.H = H
    // DPR capped at 1.5: a soft photograph gains nothing from more pixels
    this.rdpr = Math.min(view.dpr, 1.5)
    this.renderer.setPixelRatio(this.rdpr)
    this.renderer.setSize(W, H, false)
    this.D = H / 2 / Math.tan((FOV / 2) * (Math.PI / 180))
    const cam = this.camera
    cam.aspect = W / H
    cam.position.set(0, 0, this.D)
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
    this.bgMesh.scale.set(W, H, 1)
    this.letMesh.scale.set(W, H, 1)
    this.uniforms.uView.value.set(W, H)
    this.uniforms.uDpr.value = this.rdpr
    const pl = view.plates.slice(0, 6)
    pl.forEach((r, i) => this.uniforms.uPlates.value[i].set(r.x, r.y, r.w, r.h))
    this.uniforms.uNPlates.value = pl.length
    this.measureType()
    this.paintBackdrop()
    const sunW = new THREE.Vector3(this.sun[0] - W / 2, H / 2 - this.sun[1], 0)
    if (this.night) {
      this.uniforms.uLamp.value.set(sunW.x * 1.3, sunW.y * 1.3, -700)
    } else this.uniforms.uL.value.set(sunW.x, sunW.y, -this.D * 1.1).normalize()
    this.paintLetters()
    this.bgTex.needsUpdate = true
    this.letTex.needsUpdate = true
    this.makeLeaves()
    this.planLandings()
    this.planGust()
    this.liveOff = this.leaves.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }))
    // phones, golden hour: three just-settled leaves lie in the carpet on the forest floor
    this.groundLeaves = null
    if (!this.night && view.mobile) {
      const gr = rng(77)
      const copy = view.plates.filter((pl) => pl.y > view.bar.y + view.bar.h + 1).sort((a, b) => b.w * b.h - a.w * a.h)[0]
      const fl = clamp((copy ? copy.y + copy.h : view.type.box.y + view.type.box.h) / H + 0.02, 0.7, 0.95)
      this.groundLeaves = [[0.27, 0.45, 0, 1.15], [0.72, 0.75, 2, 1.3], [0.55, 0.2, 3, 0.9]].map(([fx, k, cell, sc]) => {
        const fy = fl + (1 - fl) * (0.15 + 0.8 * k)
        const z = 60 + fy * 120
        const f = this.D / (this.D - z)
        const q = new THREE.Quaternion().setFromAxisAngle(this.X, -1.25).multiply(new THREE.Quaternion().setFromAxisAngle(this.Z, gr() * TAU))
        return { x: (fx * W - W / 2) / f, y: (H / 2 - fy * H) / f, z, q, size: this.leafBase * sc, cell, curl: [0.5, 0.2, 0.2], bright: 0.75 }
      })
    }
  },

  /* ---------------- the headline, from view.type */
  measureType() {
    const v = this.view
    const type = v.type
    const W = this.W
    const H = this.H
    const g = document.createElement('canvas').getContext('2d')
    g.font = type.font(false)
    this.capH = g.measureText('H').actualBoundingBoxAscent
    this.fontSize = type.size
    // skyline: each line's top and bottom edge, column by column (CSS px)
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const cg = c.getContext('2d', { willReadFrequently: true })
    if ('letterSpacing' in cg) cg.letterSpacing = `${type.letterSpacing}px`
    cg.fillStyle = '#fff'
    cg.textBaseline = 'alphabetic'
    this.sky = []
    for (const line of type.lines) {
      cg.clearRect(0, 0, W, H)
      for (const part of line.parts) {
        cg.font = type.font(part.italic)
        cg.fillText(part.text, part.x, line.baseline)
      }
      const y0 = Math.max(0, Math.floor(line.baseline - type.size * 1.05))
      const y1 = Math.min(H, Math.ceil(line.baseline + type.size * 0.3))
      const img = cg.getImageData(0, y0, W, y1 - y0).data
      const tops = new Float32Array(W).fill(NaN)
      const bots = new Float32Array(W).fill(NaN)
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < y1 - y0; y++) if (img[(y * W + x) * 4 + 3] > 140) { tops[x] = y0 + y; break }
        for (let y = y1 - y0 - 1; y >= 0; y--) if (img[(y * W + x) * 4 + 3] > 60) { bots[x] = y0 + y; break }
      }
      const xs = [...line.parts.map((pp) => pp.x)]
      this.sky.push({ line, tops, bots, x0: Math.min(...xs), x1: Math.max(...line.parts.map((pp) => pp.x + pp.w)) })
    }
    // one mask per letter, for the coverage check
    this.letters = []
    const lg = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    for (const line of type.lines)
      for (const part of line.parts) {
        const font = type.font(part.italic)
        lg.font = font
        if ('letterSpacing' in lg) lg.letterSpacing = `${type.letterSpacing}px`
        for (let i = 0; i < part.text.length; i++) {
          const ch = part.text[i]
          if (!ch.trim()) continue
          const x = part.x + (i ? lg.measureText(part.text.slice(0, i)).width : 0)
          const m = lg.measureText(ch)
          const bx = Math.floor(x - m.actualBoundingBoxLeft - 1)
          const by = Math.floor(line.baseline - m.actualBoundingBoxAscent - 1)
          const bw = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight + 3)
          const bh = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + 3)
          if (bw < 2 || bh < 2) continue
          const mc = document.createElement('canvas')
          mc.width = bw
          mc.height = bh
          const mg = mc.getContext('2d', { willReadFrequently: true })
          mg.font = font
          mg.fillStyle = '#fff'
          mg.textBaseline = 'alphabetic'
          mg.fillText(ch, x - bx, line.baseline - by)
          const d = mg.getImageData(0, 0, bw, bh).data
          const mask = new Uint8Array(bw * bh)
          for (let k = 0; k < bw * bh; k++) mask[k] = d[k * 4 + 3]
          this.letters.push({ ch, bx, by, bw, bh, mask })
        }
      }
  },

  /* ---------------- the backdrop: a defocused photographic plate */
  paintBackdrop() {
    const v = this.view
    const p = this.p
    const W = this.W
    const H = this.H
    const PHONE = v.mobile
    const bw = 720
    const bh = Math.max(1, Math.round((720 * H) / W))
    const c = this.bgCanvas
    c.width = bw
    c.height = bh
    const g = c.getContext('2d', { willReadFrequently: true })
    const r = rng(p.seed * 7 + 1)
    const blob = (x, y, rx, ry, col, a) => { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill() }
    const box = v.type.box
    const hz = { cx: ((box.x + box.w / 2) / W) * bw, cy: ((box.y + box.h / 2) / H) * bh, rx: (box.w / W) * bw * 0.75, ry: (box.h / H) * bh * 0.9 }
    const copy = v.plates.filter((pl) => pl.y > v.bar.y + v.bar.h + 1).sort((a, b) => b.w * b.h - a.w * a.h)[0]
    // phones: the wood continues below the copy as a forest floor, with the sun low among the trunks just above it
    const below = copy ? (copy.y + copy.h) / H : (box.y + box.h) / H
    const floor = clamp(below + 0.02, 0.7, 0.95)
    let sun
    if (!this.night) {
      sun = [bw * (PHONE ? 0.64 : p.light), bh * (PHONE ? floor - 0.07 : 0.2)]
      const base = g.createLinearGradient(0, 0, 0, bh)
      base.addColorStop(0, '#d9c48e')
      base.addColorStop(0.4, '#f0e0b4')
      base.addColorStop(0.62, '#ecd9a6')
      base.addColorStop(1, '#bba86c')
      g.fillStyle = base
      g.fillRect(0, 0, bw, bh)
      g.filter = 'blur(10px)'
      for (let i = 0; i < 260; i++) {
        const x = r() * bw
        const y = Math.pow(r(), 1.4) * bh * 0.55
        const ds = Math.hypot(x - sun[0], y - sun[1]) / bw
        if (ds < 0.12 && r() < 0.8) continue
        blob(x, y, 14 + r() * 40, 10 + r() * 26, ['#4a3420', '#6a2a16', '#3e3a22', '#7a4422', '#8a3a1c', '#33281a'][Math.floor(r() * 6)], (0.3 + r() * 0.45) * clamp(ds * 3, 0.25, 1))
      }
      for (let i = 0; i < 90; i++) {
        const x = r() * bw
        const y = Math.pow(r(), 1.2) * bh * 0.5
        const ds = Math.hypot(x - sun[0], y - sun[1]) / bw
        if (ds < 0.1) continue
        blob(x, y, 10 + r() * 34, 8 + r() * 22, ['#c8501e', '#e07a2a', '#b83a1a', '#e9a03c', '#d4b048'][Math.floor(r() * 5)], (0.2 + r() * 0.35) * clamp(1.4 - ds * 1.6, 0.25, 1))
      }
      for (let i = 0; i < 70; i++) blob(sun[0] + (r() - 0.5) * bw * 0.7, sun[1] + (r() - 0.5) * bh * 0.45, 6 + r() * 22, 5 + r() * 16, '#fff2d2', 0.25 + r() * 0.4)
      const trunks = PHONE ? [[0.08, 26, 0.95], [0.88, 34, 0.95], [0.44, 10, 0.8], [0.74, 7, 0.7]] : [[0.05, 10, 0.75], [0.36, 6, 0.55], [0.58, 4, 0.45], [0.74, 8, 0.6], [0.95, 26, 0.92]]
      for (const [fx, wdt, a] of trunks) {
        const x = fx * bw
        g.globalAlpha = Math.min(1, a * 1.1)
        g.fillStyle = '#2a2219'
        const foot = PHONE ? bh * Math.min(0.98, floor + 0.2) : bh * 0.8
        g.beginPath()
        g.moveTo(x - wdt * 0.8, 0)
        g.lineTo(x + wdt * 0.8, 0)
        g.lineTo(x + wdt * 1.1, foot)
        g.lineTo(x - wdt * 1.1, foot)
        g.fill()
      }
      for (let i = 0; i < (PHONE ? 30 : 120); i++) {
        const y = bh * (PHONE ? floor + r() * (1 - floor) : 0.64 + r() * 0.36)
        blob(r() * bw, y, 30 + r() * 80, 4 + r() * 10, ['#f4e3b0', '#c9b072', '#a99858', '#e8cf8a'][Math.floor(r() * 4)], 0.18 + r() * 0.25)
      }
      g.filter = 'blur(16px)'
      g.globalAlpha = 1
      g.drawImage(c, 0, 0)
      g.filter = `blur(${Math.round(bw * 0.04)}px)`
      g.globalAlpha = PHONE ? 0.62 : 0.4
      g.fillStyle = '#f2e0b4'
      g.beginPath()
      g.ellipse(hz.cx, hz.cy, hz.rx, hz.ry, 0, 0, 7)
      g.fill()
      g.filter = 'none'
      g.globalAlpha = 1
      const sg = g.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], bw * 0.75)
      sg.addColorStop(0, 'rgba(255,238,196,1)')
      sg.addColorStop(0.05, 'rgba(255,230,180,0.95)')
      sg.addColorStop(0.2, 'rgba(255,232,180,0.45)')
      sg.addColorStop(0.55, 'rgba(250,224,170,0.12)')
      sg.addColorStop(1, 'rgba(250,224,170,0)')
      g.fillStyle = sg
      g.fillRect(0, 0, bw, bh)
      if (PHONE) {
        g.globalCompositeOperation = 'screen'
        g.globalAlpha = 0.7
        g.fillRect(0, 0, bw, bh)
        g.globalCompositeOperation = 'source-over'
        g.globalAlpha = 1
      }
      // the sun reads as a source: a hot core behind soft branches, shafts through the haze away from it
      const coreR = bw * 0.016
      const cg = g.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], coreR * 3)
      cg.addColorStop(0, 'rgba(255,252,240,1)')
      cg.addColorStop(0.33, 'rgba(255,246,222,1)')
      cg.addColorStop(1, 'rgba(255,236,190,0)')
      g.fillStyle = cg
      g.fillRect(sun[0] - coreR * 4, sun[1] - coreR * 4, coreR * 8, coreR * 8)
      g.save()
      g.filter = 'blur(3.5px)'
      g.strokeStyle = 'rgba(52,36,22,0.42)'
      g.lineCap = 'round'
      for (let i = 0; i < 2; i++) {
        const a0 = 2.4 + r() * 0.8
        const L0 = bw * (0.06 + r() * 0.06)
        g.lineWidth = 1 + r() * 1.6
        g.beginPath()
        g.moveTo(sun[0] + Math.cos(a0) * L0, sun[1] + Math.sin(a0) * L0 * 0.6)
        g.quadraticCurveTo(sun[0] + (r() - 0.5) * coreR * 6, sun[1] + (r() - 0.5) * coreR * 6, sun[0] - Math.cos(a0 + 0.4) * L0, sun[1] - Math.sin(a0 + 0.4) * L0 * 0.6)
        g.stroke()
      }
      g.restore()
      const toC = Math.atan2(bh * (PHONE ? floor - 0.45 : 0.62) - sun[1], bw * 0.62 - sun[0])
      g.save()
      g.globalCompositeOperation = 'screen'
      g.filter = 'blur(7px)'
      for (let i = 0; i < 9; i++) {
        const ang = toC + (r() - 0.5) * 1.5
        const len = bw * (0.5 + r() * 0.7)
        const wd = 0.012 + r() * 0.04
        const lg = g.createLinearGradient(sun[0], sun[1], sun[0] + Math.cos(ang) * len, sun[1] + Math.sin(ang) * len)
        lg.addColorStop(0, `rgba(255,226,170,${0.14 + r() * 0.14})`)
        lg.addColorStop(1, 'rgba(255,226,170,0)')
        g.fillStyle = lg
        g.beginPath()
        g.moveTo(sun[0], sun[1])
        g.lineTo(sun[0] + Math.cos(ang - wd) * len, sun[1] + Math.sin(ang - wd) * len)
        g.lineTo(sun[0] + Math.cos(ang + wd) * len, sun[1] + Math.sin(ang + wd) * len)
        g.fill()
      }
      g.restore()
      // bokeh: out-of-focus highlights where light comes through the crowns; a 7-blade aperture, the
      // scene's own colour pushed up, a faint rim, cat's-eyes towards the frame edges
      {
        const src = g.getImageData(0, 0, bw, bh).data
        const poly = (x, y, rad, rot) => { g.beginPath(); for (let k = 0; k < 7; k++) { const a = rot + (k * TAU) / 7; const px = x + rad * Math.cos(a); const py = y + rad * Math.sin(a); k ? g.lineTo(px, py) : g.moveTo(px, py) } g.closePath() }
        let placed = 0
        for (let i = 0; i < 900 && placed < (PHONE ? 34 : 60); i++) {
          const x = r() * bw
          const y = Math.pow(r(), 1.2) * bh * (PHONE ? 0.95 : 0.62)
          if (((x - hz.cx) / hz.rx) ** 2 + ((y - hz.cy) / hz.ry) ** 2 < 1) continue
          const ds = Math.hypot(x - sun[0], y - sun[1]) / bw
          if (r() > 0.12 + Math.exp(-ds * 4)) continue
          placed++
          const rad = 2.5 + Math.pow(r(), 2.2) * (PHONE ? 26 : 20)
          const idx = (Math.floor(y) * bw + Math.floor(x)) * 4
          const col = `rgb(${Math.min(255, src[idx] * 1.15 + 45)},${Math.min(255, src[idx + 1] * 1.1 + 32)},${Math.min(255, src[idx + 2] + 14)})`
          const a = 0.14 + r() * 0.36
          const ex = x / bw - 0.5
          const ey = y / bh - 0.5
          g.save()
          g.beginPath()
          g.arc(x - ex * rad * 1.1, y - ey * rad * 1.1, rad * 1.04, 0, 7)
          g.clip()
          g.filter = 'blur(1.1px)'
          g.globalCompositeOperation = 'screen'
          g.globalAlpha = a * 0.6
          g.fillStyle = col
          poly(x, y, rad, 0.35)
          g.fill()
          g.globalAlpha = a * 0.35
          g.strokeStyle = col
          g.lineWidth = Math.max(0.6, rad * 0.07)
          g.stroke()
          g.restore()
        }
      }
      g.filter = 'none'
      g.globalAlpha = 1
      if (PHONE) {
        // the forest floor: fallen leaves in perspective, sharpest near the focus distance
        const hy = bh * floor
        const gg = g.createLinearGradient(0, hy - bh * 0.06, 0, bh)
        gg.addColorStop(0, 'rgba(150,110,60,0)')
        gg.addColorStop(0.3, 'rgba(118,82,44,0.8)')
        gg.addColorStop(1, 'rgba(58,36,20,1)')
        g.filter = 'blur(10px)'
        g.fillStyle = gg
        g.fillRect(-20, hy - bh * 0.06, bw + 40, bh)
        g.filter = 'none'
        for (let i = 0; i < 380; i++) {
          const y = hy + Math.pow(r(), 1.6) * (bh - hy)
          const depth = (y - hy) / (bh - hy)
          const sz = (9 + 70 * depth * depth) * (0.7 + r() * 0.6)
          const blur = depth < 0.3 ? 0.6 + (0.3 - depth) * 8 : (depth - 0.3) * 7
          g.save()
          g.translate(r() * bw, y)
          g.scale(1, 0.22 + 0.4 * depth)
          g.rotate(r() * TAU)
          g.filter = `blur(${blur.toFixed(1)}px) brightness(${(0.45 + 0.35 * r() + 0.2 * (1 - depth)).toFixed(2)}) saturate(0.75)`
          g.globalAlpha = 0.9
          const cell = Math.floor(r() * NS)
          g.drawImage(this.atlas.alb, cell * S, 0, S, S, -sz, -sz, sz * 2, sz * 2)
          g.restore()
        }
        const rimg = g.createLinearGradient(0, hy - bh * 0.05, 0, hy + (bh - hy) * 0.5)
        rimg.addColorStop(0, 'rgba(255,214,150,0)')
        rimg.addColorStop(0.2, 'rgba(255,214,150,0.3)')
        rimg.addColorStop(1, 'rgba(255,214,150,0)')
        g.save()
        g.globalCompositeOperation = 'screen'
        g.filter = 'blur(6px)'
        g.fillStyle = rimg
        g.fillRect(0, hy - bh * 0.05, bw, (bh - hy) * 0.6)
        g.restore()
        g.filter = 'none'
        g.globalAlpha = 1
      }
    } else {
      sun = [bw * (PHONE ? 0.7 : p.light), bh * (PHONE ? 0.17 : 0.2)]
      const base = g.createLinearGradient(0, 0, 0, bh)
      base.addColorStop(0, '#0a0e16')
      base.addColorStop(0.6, '#080b11')
      base.addColorStop(1, '#0b0d12')
      g.fillStyle = base
      g.fillRect(0, 0, bw, bh)
      const cone = g.createLinearGradient(sun[0], sun[1], sun[0], bh)
      cone.addColorStop(0, 'rgba(255,226,170,0.20)')
      cone.addColorStop(1, 'rgba(255,226,170,0.04)')
      g.filter = 'blur(22px)'
      g.fillStyle = cone
      g.beginPath()
      g.moveTo(sun[0] - 10, sun[1])
      g.lineTo(sun[0] + 10, sun[1])
      g.lineTo(sun[0] + bw * 0.3, bh)
      g.lineTo(sun[0] - bw * 0.36, bh)
      g.fill()
      g.filter = 'blur(9px)'
      for (let i = 0; i < 240; i++) {
        const ang = r() * TAU
        const dist = Math.pow(r(), 0.7) * bw * 0.36
        const x = sun[0] + Math.cos(ang) * dist * 1.3
        const y = sun[1] + Math.sin(ang) * dist * 0.62 - bh * 0.02
        if (y > bh * 0.55) continue
        const near = 1 - clamp(dist / (bw * 0.3), 0, 1)
        const col = near > 0.45 ? (r() < 0.5 ? p.crown : mixHex(p.crown, '#000000', 0.18)) : near > 0.2 ? '#5a5420' : '#0d1009'
        blob(x, y, 8 + r() * 24, 6 + r() * 16, col, (0.25 + r() * 0.35) * (near > 0.2 ? 0.9 : 1))
      }
      g.filter = 'blur(1px)'
      const vp = [bw * 0.3, bh * 0.5]
      for (const side of [-1, 1])
        for (let i = 0; i < 9; i++) {
          const k = Math.pow(0.72, i)
          const x = vp[0] + side * bw * 0.55 * k + (side < 0 ? -bw * 0.05 : bw * 0.1) * k
          const y = vp[1] - bh * 0.32 * k * (side < 0 ? 0.9 : 0.6)
          g.globalAlpha = 0.25 + 0.3 * k
          g.fillStyle = i % 3 === 2 ? '#e9eef8' : '#f2a54a'
          g.beginPath()
          g.arc(x, y, 3 + 16 * k, 0, 7)
          g.fill()
        }
      g.filter = 'blur(14px)'
      const refl = g.createLinearGradient(0, bh * 0.75, 0, bh)
      refl.addColorStop(0, 'rgba(255,214,150,0)')
      refl.addColorStop(1, 'rgba(255,214,150,0.22)')
      g.globalAlpha = 1
      g.fillStyle = refl
      g.fillRect(sun[0] - 24, bh * 0.72, 48, bh * 0.3)
      g.filter = 'none'
      const sg = g.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], bw * 0.32)
      sg.addColorStop(0, 'rgba(255,250,236,1)')
      sg.addColorStop(0.035, 'rgba(255,238,200,0.95)')
      sg.addColorStop(0.15, 'rgba(255,214,140,0.35)')
      sg.addColorStop(0.5, 'rgba(255,200,120,0.07)')
      sg.addColorStop(1, 'rgba(255,200,120,0)')
      g.fillStyle = sg
      g.fillRect(0, 0, bw, bh)
    }
    // the print: a little more contrast and colour than the scan
    const t2 = document.createElement('canvas')
    t2.width = bw
    t2.height = bh
    t2.getContext('2d').drawImage(c, 0, 0)
    g.globalAlpha = 1
    g.filter = this.night ? 'contrast(1.1) saturate(1.1)' : 'contrast(1.28) saturate(1.2) brightness(0.97)'
    g.drawImage(t2, 0, 0)
    g.filter = 'none'
    // the lens's falloff
    const vg = g.createRadialGradient(bw / 2, bh * 0.45, Math.min(bw, bh) * 0.35, bw / 2, bh / 2, Math.hypot(bw, bh) * 0.62)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, this.night ? 'rgba(0,0,0,0.5)' : 'rgba(50,26,8,0.42)')
    g.fillStyle = vg
    g.fillRect(0, 0, bw, bh)
    if (!this.night && !PHONE && copy) {
      // below the headline the wood opens onto a sunlit meadow under ground mist, in the copy plate's own
      // colour: opaque before the plate's top edge, so the plate has no edge to see
      const y0 = (copy.y / H) * bh
      const ys = y0 - bh * 0.075
      const ye = y0 - bh * 0.012
      const mg2 = g.createLinearGradient(0, ys, 0, bh)
      mg2.addColorStop(0, 'rgba(0,0,0,0)')
      mg2.addColorStop(clamp((ye - ys) / (bh - ys), 0.01, 0.99), '#000')
      mg2.addColorStop(1, '#000')
      const mc = document.createElement('canvas')
      mc.width = bw
      mc.height = bh
      const mx = mc.getContext('2d')
      mx.fillStyle = mg2
      mx.fillRect(0, 0, bw, bh)
      mx.globalCompositeOperation = 'source-in'
      mx.fillStyle = this.ctx.theme.plate
      mx.fillRect(0, 0, bw, bh)
      mx.globalCompositeOperation = 'source-atop'
      mx.filter = 'blur(5px)'
      for (let i = 0; i < 60; i++) {
        mx.globalAlpha = 0.04 + r() * 0.05
        mx.fillStyle = r() < 0.5 ? '#fff6dc' : '#d8c08a'
        mx.beginPath()
        mx.ellipse(r() * bw, y0 + r() * (bh - y0), 20 + r() * 60, 3 + r() * 6, 0, 0, 7)
        mx.fill()
      }
      g.drawImage(mc, 0, 0)
    }
    // fixed grain, centred on neutral so it never shifts a tone
    const img = g.getImageData(0, 0, bw, bh)
    const gr = rng(5)
    const amt = 7 * p.grain
    for (let i = 0; i < img.data.length; i += 4) {
      const n = ((gr() + gr() + gr()) / 3 - 0.5) * 2 * amt
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    g.putImageData(img, 0, 0)
    this.sun = [(sun[0] / bw) * W, (sun[1] / bh) * H]
  },

  /* ---------------- the sign: the headline drawn in the focal plane */
  paintLetters() {
    const v = this.view
    const type = v.type
    const W = this.W
    const H = this.H
    const dpr = this.rdpr
    const c = this.letCanvas
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
    const g = c.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, W, H)
    const p = this.p
    const pr = rng(91)
    const layer = () => {
      const l = document.createElement('canvas')
      l.width = c.width
      l.height = c.height
      const x = l.getContext('2d')
      x.setTransform(dpr, 0, 0, dpr, 0, 0)
      return [l, x]
    }
    const drawText = (x, dx, dy) => {
      x.textBaseline = 'alphabetic'
      if ('letterSpacing' in x) x.letterSpacing = `${type.letterSpacing}px`
      for (const line of type.lines)
        for (const part of line.parts) {
          x.font = type.font(part.italic)
          x.fillText(part.text, part.x + dx, line.baseline + dy)
        }
    }
    const [face, f] = layer()
    const fs = type.size
    if (p.sign === 'steel') {
      // flat, dark, crisp: weathering steel in shade, face on against the light. No bevel: the scene does the work
      f.fillStyle = p.letters
      drawText(f, 0, 0)
      f.globalCompositeOperation = 'source-atop'
      f.filter = `blur(${Math.max(1, fs * 0.012)}px)`
      for (let i = 0; i < 700; i++) {
        f.globalAlpha = 0.05 + pr() * 0.09
        f.fillStyle = ['#4a2412', '#5a2c14', '#2c180c', '#3e2414'][Math.floor(pr() * 4)]
        f.beginPath()
        f.arc(pr() * W, pr() * H, fs * (0.01 + pr() * 0.04), 0, 7)
        f.fill()
      }
      f.filter = 'none'
      f.globalAlpha = 1
      g.drawImage(face, 0, 0, W, H)
    } else {
      // painted letters under the lamp: a thin top face lit brightest, the face falling off away from the lamp
      const [top, q] = layer()
      const depth = Math.max(1.6, fs * 0.02)
      const n = Math.ceil(depth * 2)
      for (let i = n; i >= 1; i--) {
        q.fillStyle = mixHex('#fffaf0', mixHex(p.letters, '#000000', 0.12), i / n)
        drawText(q, 0, (-depth * i) / n)
      }
      f.fillStyle = p.letters
      drawText(f, 0, 0)
      f.globalCompositeOperation = 'source-atop'
      const lx = this.sun[0]
      const ly = -H * 0.1
      const rg = f.createRadialGradient(lx, ly, 10, lx, ly, Math.hypot(W, H) * 0.95)
      rg.addColorStop(0, 'rgba(255,236,190,0)')
      rg.addColorStop(0.55, 'rgba(60,50,40,0.04)')
      rg.addColorStop(1, 'rgba(30,30,40,0.16)')
      f.fillStyle = rg
      f.fillRect(0, 0, W, H)
      for (const line of type.lines) {
        const t0 = line.baseline - this.capH
        const lg = f.createLinearGradient(0, t0, 0, line.baseline)
        lg.addColorStop(0, 'rgba(255,240,205,0.1)')
        lg.addColorStop(0.6, 'rgba(0,0,0,0)')
        lg.addColorStop(1, 'rgba(30,26,30,0.04)')
        f.fillStyle = lg
        f.fillRect(line.x - 20, t0 - 10, line.w + 40, this.capH + 20)
      }
      for (let i = 0; i < 2500; i++) {
        f.globalAlpha = 0.05
        f.fillStyle = pr() < 0.5 ? '#fff' : '#000'
        f.fillRect(pr() * W, pr() * H, 1.5, 1.5)
      }
      f.globalAlpha = 1
      g.drawImage(top, 0, 0, W, H)
      g.drawImage(face, 0, 0, W, H)
    }
  },

  /* ---------------- falling leaves */
  makeLeaves() {
    const v = this.view
    const p = this.p
    const W = this.W
    const H = this.H
    const D = this.D
    const PHONE = v.mobile
    const R = rng(p.seed)
    const T = p.cycle
    const capH = this.capH
    this.leafBase = PHONE ? Math.max(capH * 1.15, H * 0.072) : Math.max(capH * 0.92, H * 0.08)
    const box = v.type.box
    const leaves = []
    const make = (zMin, zMax, opts = {}) => {
      const z = lerp(zMin, zMax, R())
      const size = this.leafBase * (0.78 + R() * 0.5) * (this.species === 'ginkgo' ? 0.8 : 1) * (opts.big || 1)
      const mr = R()
      const mode = this.species === 'maple' ? (mr < 0.5 ? 'flutter' : mr < 0.82 ? 'spiral' : 'tumble') : mr < 0.35 ? 'flutter' : mr < 0.7 ? 'spiral' : 'tumble'
      const halfH = ((H / 2) * (D - z)) / D
      const halfW = ((W / 2) * (D - z)) / D
      const margin = size * 1.6
      const travel = 2 * halfH + 2 * margin
      const vWant = H * (0.17 + R() * 0.08)
      const m = Math.max(1, Math.round(T / (travel / vWant)))
      let x0 = (R() * 2 - 1) * halfW * 1.05
      if (this.night) x0 = ((this.sun[0] / W - 0.5) * 2 + (R() * 2 - 1) * 0.55) * halfW
      if (opts.lane) x0 = ((opts.lane(R()) / W) - 0.5) * 2 * halfW
      leaves.push({
        z, size, mode, cell: Math.floor(R() * NS), halfH, halfW, margin, m, vel: (travel * m) / T,
        x0, off: R(), phi: R() * TAU, bias: 0.45 + R() * 0.5,
        amp: size * (1.2 + R() * 1.4), per: 2.4 + R() * 1.2, th0: 0.55 + R() * 0.35, k: 0.85 + R() * 0.25,
        bank: 0.6 + R() * 0.45, rad: size * (0.7 + R() * 1.0), sper: 3.0 + R() * 1.8, dir: R() < 0.5 ? -1 : 1,
        tper: 1.3 + R() * 0.8, drift: 0.3 + R() * 0.25, yaw0: R() * TAU, yawRate: (R() - 0.5) * 0.8, roll: (R() - 0.5) * 0.5,
        curl: [(R() - 0.3) * 1.5, (R() - 0.5) * 0.9, (R() - 0.5) * 0.8], bright: 0.9 + R() * 0.2,
      })
    }
    const dens = p.density
    const nFar = Math.round((PHONE ? 12 : 24) * dens)
    const nMid = Math.round((this.night ? (PHONE ? 4 : 9) : PHONE ? 2 : 4) * dens)
    const nNear = PHONE ? 2 : 3
    for (let i = 0; i < nFar; i++) make(-2600, -700)
    for (let i = 0; i < nMid; i++) make(-90, 90, { big: this.night ? 1.25 : 1.4 })
    // near leaves keep to lanes either side of the headline: they frame it, and cross it only in a gust
    // ...and clear of the copy plate, so none dissolves into it
    const pad = this.leafBase * 1.4
    const busy = [[box.x - pad, box.x + box.w + pad], ...v.plates.filter((pl) => pl.y > v.bar.y + v.bar.h + 1).map((pl) => [pl.x - pad, pl.x + pl.w + pad])]
    let open = [[0, W]]
    for (const [a, b] of busy) open = open.flatMap(([c, d]) => [[c, Math.min(d, a)], [Math.max(c, b), d]]).filter(([c, d]) => d - c > 8)
    if (!open.length) open = [[0, W * 0.08], [W * 0.92, W]]
    const total = open.reduce((s2, [c, d]) => s2 + d - c, 0)
    const lane = (u) => {
      let k = u * total
      for (const [c, d] of open) { if (k <= d - c) return c + k; k -= d - c }
      return W
    }
    for (let i = 0; i < nNear; i++) make(560, 980, { lane })
    this.leaves = leaves
  },

  /** A falling leaf's pose at cycle time t, before the gust. */
  basePose(l, t) {
    const THREE = this.THREE
    const T = this.p.cycle
    const s = mod((t * l.m) / T + l.off, 1) * (T / l.m)
    let x = l.x0
    let y = l.halfH + l.margin - l.vel * s
    let z = l.z
    const q = new THREE.Quaternion()
    const yaw = l.yaw0 + l.yawRate * s
    const { X, Y } = this
    if (l.mode === 'flutter') {
      // a planar pendulum: glide, stall and turn at the ends, fastest and flattest mid-swing
      const w = TAU / l.per
      const ex = Math.cos(l.phi)
      const ez = Math.sin(l.phi)
      const lat = l.amp * Math.sin(w * s)
      x += ex * lat
      z += ez * lat
      y += (-l.vel * l.k * Math.sin(2 * w * s)) / (2 * w)
      const axis = new THREE.Vector3(ez, 0, -ex).normalize()
      q.setFromAxisAngle(axis, l.th0 * Math.sin(w * s))
      q.multiply(this._q2.setFromAxisAngle(Y, yaw)).multiply(this._q.setFromAxisAngle(X, l.roll)).multiply(this.flat)
    } else if (l.mode === 'spiral') {
      // a helical glide, banked into the turn
      const w = (TAU / l.sper) * l.dir
      const a = w * s + l.phi
      x += l.rad * Math.cos(a)
      z += l.rad * Math.sin(a) * 0.8
      const tang = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(l.dir)
      q.setFromAxisAngle(tang, l.bank)
      q.multiply(this._q2.setFromAxisAngle(Y, -a + l.yaw0)).multiply(this.flat)
    } else {
      // tumbling end over end about the span, drifting sideways
      const w = (TAU / l.tper) * l.dir
      const ex = Math.cos(l.phi)
      const ez = Math.sin(l.phi)
      x += ex * l.vel * l.drift * s * l.dir
      z += ez * l.vel * l.drift * s * l.dir
      y += (0.12 * l.vel * Math.sin(2 * w * s)) / (2 * Math.abs(w))
      q.setFromAxisAngle(new THREE.Vector3(ez, 0, -ex), w * s + l.phi)
      q.multiply(this._q2.setFromAxisAngle(Y, l.yaw0)).multiply(this.flat)
    }
    // turbulence keeps a falling leaf off the horizontal: a steady pitch towards the lens
    q.premultiply(this._q.setFromAxisAngle(X, l.bias))
    // a light breeze from the left
    x += 0.06 * this.H * Math.sin(0.5 + s * 0.4) + s * this.H * 0.012
    return { x, y, z, q }
  },

  /** The scripted gust's force on a point, px/s², at cycle time t. */
  gustAt(x, y, t) {
    const [g0, g1] = GUST
    if (t < g0 || t > g1) return 0
    const u = (t - g0) / (g1 - g0)
    const W = this.W
    const front = lerp(-0.75 * W, 0.75 * W, u)
    const env = Math.sin(Math.PI * u)
    const a = (x - front) / (0.28 * W)
    return this.p.gust * this.H * 6.5 * env * Math.exp(-a * a) * (1 - 0.3 * Math.abs(y) / this.H)
  },

  /** Each falling leaf's push from the scripted gust, integrated once per size over two cycles (a spring), so it has died away by the cycle's end. */
  planGust() {
    const T = this.p.cycle
    const dt = 1 / 60
    const N = Math.round(T * 30)
    const k = (TAU / 2.4) ** 2
    const c = 2 * 0.7 * Math.sqrt(k)
    this.gustTab = this.leaves.map((l) => {
      const tab = new Float32Array(N * 2)
      let o = 0
      let ov = 0
      for (let pass = 0; pass < 2; pass++)
        for (let i = 0; i < T / dt; i++) {
          const t = i * dt
          const bp = this.basePose(l, t)
          const sc = this.D / (this.D - bp.z)
          const F = this.gustAt(bp.x * sc, bp.y * sc, t) / sc
          ov += (F - k * o - c * ov) * dt
          o += ov * dt
          if (pass === 1 && i % 2 === 0) {
            const j = i / 2
            if (j < N) {
              tab[j * 2] = o
              tab[j * 2 + 1] = ov
            }
          }
        }
      return tab
    })
  },

  gustOffset(i, t) {
    const tab = this.gustTab[i]
    const N = tab.length / 2
    const f = mod(t, this.p.cycle) * 30
    const j0 = Math.floor(f) % N
    const j1 = (j0 + 1) % N
    const k = f - Math.floor(f)
    return [lerp(tab[j0 * 2], tab[j1 * 2], k), lerp(tab[j0 * 2 + 1], tab[j1 * 2 + 1], k)]
  },

  /* ---------------- landings, solved from the glyph outlines */

  /** Drops a posed leaf's real outline onto the line's top edge at screen x: the world y where it first touches, and where. */
  settle(r, x, q) {
    const THREE = this.THREE
    const W = this.W
    const H = this.H
    const D = this.D
    const quad = r.size / FILL
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x - W / 2, 0, 6), q, new THREE.Vector3(quad, quad, quad))
    const c = r.curl
    let Y = -Infinity
    const needs = []
    for (const [lx, ly] of this.atlas.outlines[r.cell]) {
      const vv = new THREE.Vector3(lx, ly, c[0] * lx * lx + c[1] * ly * ly + c[2] * lx * ly).applyMatrix4(m)
      const f = D / (D - vv.z)
      const sx = Math.round(W / 2 + vv.x * f)
      const top = r.sky.tops[sx]
      if (isNaN(top)) continue
      const need = (H / 2 - top) / f - vv.y
      needs.push([need, sx, top])
      if (need > Y) Y = need
    }
    if (!needs.length) return null
    const touch = needs.filter((n) => n[0] > Y - 1.2)
    return { Y, contact: [Math.min(...touch.map((n) => n[1])), Math.max(...touch.map((n) => n[1]))], topY: Math.min(...touch.map((n) => n[2])) }
  },

  /** Where a posed leaf's outline falls on screen (CSS px): its bounding box. */
  leafBounds(it) {
    const THREE = this.THREE
    const D = this.D
    const quad = it.size / FILL
    const m = new THREE.Matrix4().compose(new THREE.Vector3(it.x, it.y, it.z), it.q, new THREE.Vector3(quad, quad, quad))
    const c = it.curl
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const [lx, ly] of this.atlas.outlines[it.cell]) {
      const vv = new THREE.Vector3(lx, ly, c[0] * lx * lx + c[1] * ly * ly + (c[2] || 0) * lx * ly).applyMatrix4(m)
      const f = D / (D - vv.z)
      const sx = this.W / 2 + vv.x * f
      const sy = this.H / 2 - vv.y * f
      x0 = Math.min(x0, sx)
      x1 = Math.max(x1, sx)
      y0 = Math.min(y0, sy)
      y1 = Math.max(y1, sy)
    }
    return { x0, x1, y0, y1 }
  },

  /** Is a resting or sliding leaf wholly inside the frame (clear of its edges and under the bar)? */
  inFrame(b) {
    const v = this.view
    return b.x0 >= 2 && b.x1 <= this.W - 2 && b.y0 >= v.bar.y + v.bar.h + 2
  },

  /** The landed leaves (resting or sliding) at cycle time t that are not wholly inside the frame. */
  outside(t) {
    const out = []
    for (const r of this.events || []) {
      const e = this.eventPose(r, mod(t, this.p.cycle))
      if (!e || (e.phase !== 'rest' && e.phase !== 'slide')) continue
      const b = this.leafBounds({ ...e, size: r.size, cell: r.cell, curl: r.curl })
      if (!this.inFrame(b)) out.push({ x: Math.round(r.x), bounds: [b.x0, b.y0, b.x1, b.y1].map(Math.round) })
    }
    return out
  },

  planLandings() {
    const THREE = this.THREE
    const v = this.view
    const p = this.p
    const T = p.cycle
    const sky = this.sky
    const lb = this.leafBase
    const pr = rng(p.seed * 13 + 3)
    const span = lb * 0.16
    const room = lb * 0.55
    const free = (li, x, top) => {
      for (let j = 0; j < sky.length; j++) {
        if (j === li) continue
        for (let k = Math.floor(x - lb * 0.5); k <= x + lb * 0.5; k++) {
          const b = sky[j].bots[k]
          const t = sky[j].tops[k]
          if (!isNaN(b) && b > top - room && t < top) return false
        }
      }
      return true
    }
    // the schedule (seconds into the cycle): when each leaf lands and how long it rests before it slides
    // the first one is blown off by the scripted gust; the others slide off by the slope of their edge
    const plan = v.mobile
      ? [{ at: [0, 0.6], land: 17.5, slide: GUST[0] + 0.1, gust: true }, { at: [0, 0.2], land: 14, slide: 3 }]
      : [{ at: [0, 0.52], land: 17.5, slide: GUST[0] + 0.1, gust: true }, { at: [1, 0.7], land: 14, slide: 3 }, { at: [2, 0.2], land: 3.5, slide: 12.5 }]
    const used = []
    this.events = []
    for (const ev of plan.slice(0, p.landings)) {
      const cands = []
      const want = sky[Math.min(ev.at[0], sky.length - 1)]
      const wantX = want.x0 + (want.x1 - want.x0) * ev.at[1]
      for (let li = 0; li < sky.length; li++) {
        const s = sky[li]
        for (let x = Math.floor(s.x0 + span); x < s.x1 - span; x++) {
          let lo = Infinity
          let hi = -Infinity
          let ok = true
          for (let k = Math.floor(x - span); k <= x + span; k++) {
            const vv = s.tops[k]
            if (isNaN(vv)) { ok = false; break }
            lo = Math.min(lo, vv)
            hi = Math.max(hi, vv)
          }
          if (!ok || hi - lo > 6) continue
          if (used.some((u) => Math.abs(u[0] - x) < lb * 1.3 && u[1] === li)) continue
          if (!free(li, x, lo)) continue
          const score = Math.abs(x - wantX) + (hi - lo) * 6 + (li === ev.at[0] ? 0 : 160)
          cands.push({ x, top: lo, score, li })
        }
      }
      cands.sort((a, b) => a.score - b.score)
      const r0 = { size: lb * (1.05 + pr() * 0.2), cell: Math.floor(pr() * NS), curl: [0.5 + pr() * 0.3, 0.15, (pr() - 0.5) * 0.4], yaw: (pr() - 0.5) * 2.4, lean: 0.95 + pr() * 0.25 }
      r0.q = new THREE.Quaternion().setFromAxisAngle(this.X, -r0.lean).multiply(new THREE.Quaternion().setFromAxisAngle(this.Z, r0.yaw))
      // the best spot whose landed leaf stays wholly inside the frame
      let best = null
      let st = null
      for (const c of cands) {
        const s2 = this.settle({ ...r0, sky: sky[c.li] }, c.x, r0.q)
        if (!s2) continue
        if (!this.inFrame(this.leafBounds({ x: c.x - this.W / 2, y: s2.Y, z: 6, q: r0.q, size: r0.size, cell: r0.cell, curl: r0.curl }))) continue
        best = c
        st = s2
        break
      }
      if (!best) continue
      const r = { ...r0, sky: sky[best.li] }
      used.push([best.x, best.li])
      Object.assign(r, { x: best.x, land: ev.land, gust: !!ev.gust, Y: st.Y, contact: st.contact, topY: st.topY })
      // the approach: a flutter that arrives at the slow end of a swing
      r.amp = r.size * (1.1 + pr() * 0.5)
      r.per = 2.6 + pr() * 0.8
      r.th0 = 0.5 + pr() * 0.3
      r.vel = this.H * 0.2
      r.phi = pr() * TAU
      r.fallIn = (this.H / 2 + r.size * 1.6 - r.Y) / r.vel + 0.4
      this.simulateSlide(r)
      // one life per cycle: falling in, resting, sliding and falling out must fit in it (land later if not)
      r.rest = mod(ev.slide - r.land, T)
      const spare = T - 0.25 - r.fallIn - r.slideDur
      if (r.rest > spare) {
        r.land = mod(ev.slide - spare, T)
        r.rest = spare
      }
      this.events.push(r)
    }
  },

  /**
   * After the rest: the leaf slides along the edge, downhill by the edge's own slope (or with the gust),
   * re-solving its contact on the glyph outline every frame; past the end of the edge it tips over and
   * falls. Sampled at 60 Hz once per size.
   */
  simulateSlide(r) {
    const THREE = this.THREE
    const W = this.W
    const H = this.H
    const s = r.sky
    const dt = 1 / 60
    const frames = []
    // which way is downhill under the leaf: the mean slope of the edge across its footprint
    const slope = (x) => {
      const h = Math.max(3, r.size * 0.25)
      const a = s.tops[Math.round(x - h)]
      const b = s.tops[Math.round(x + h)]
      if (isNaN(a) || isNaN(b)) return 0
      return (b - a) / (2 * h) // screen y grows downward: positive means it falls to the right
    }
    const sl = slope(r.x)
    // the scripted gust blows left to right; otherwise the leaf goes downhill (or, on a flat edge, the breeze's way)
    const dir = r.gust ? 1 : Math.abs(sl) > 0.03 ? Math.sign(sl) : 1
    let x = r.x
    let vx = 0
    let Y = r.Y
    const q = r.q.clone()
    // slide along the edge
    for (let i = 0; i < 600; i++) {
      const m = slope(x) * dir
      const acc = (r.gust ? 260 : 50) + 1100 * Math.max(-0.2, m) // px/s² at a quarter speed: the slope, and the wind
      vx = Math.max(6, vx + acc * dt)
      x += dir * vx * dt
      const st = this.settle(r, x, q)
      const edgeEnd = isNaN(s.tops[Math.round(x)]) || s.tops[Math.round(x)] > r.topY + this.capH * 0.22
      if (!st || edgeEnd) break
      if (!this.inFrame(this.leafBounds({ x: x - W / 2, y: st.Y, z: 6, q, size: r.size, cell: r.cell, curl: r.curl }))) break
      Y = st.Y
      frames.push({ x: x - W / 2, y: Y, z: 6, q: q.clone() })
    }
    // tip over the end of the edge, then fall, drifting the way it slid, until it leaves the frame
    const tipQ = q.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(this.Z, -dir * 0.9)).premultiply(new THREE.Quaternion().setFromAxisAngle(this.X, 0.7))
    let px = x - W / 2
    let py = Y
    let vy = 0
    let svx = dir * vx
    const ax = new THREE.Vector3(Math.sin(r.phi), 0, Math.cos(r.phi))
    for (let i = 0; i < 900; i++) {
      const tt = i * dt
      const tip = sstep(0, 0.45, tt)
      vy = Math.min(r.vel, vy + 520 * dt)
      svx *= Math.exp(-dt * 1.4)
      px += svx * dt
      py -= vy * dt
      const qq = q.clone().slerp(tipQ, tip)
      // once free it starts to flutter again
      const fl = sstep(0.4, 1.4, tt)
      qq.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, fl * r.th0 * Math.sin((TAU / r.per) * tt)))
      frames.push({ x: px + fl * r.amp * 0.5 * Math.sin((TAU / r.per) * tt), y: py, z: 6 + fl * 40, q: qq, falling: true })
      if (py < -H / 2 - r.size * 2) break
    }
    r.slide = frames
    r.slideDur = frames.length * dt
    r.slideOnly = frames.findIndex((f) => f.falling) * dt
  },

  /** A landing leaf's pose at cycle time t, or null when it is out of the frame. */
  eventPose(r, t) {
    const THREE = this.THREE
    const T = this.p.cycle
    const u = mod(t - r.land, T)
    const tau = T - u
    if (tau < r.fallIn) {
      // falling in, arriving at the slow end of a swing
      const w = TAU / r.per
      const lat = r.amp * (1 - Math.cos(w * tau))
      const x = r.x - this.W / 2 + Math.cos(r.phi) * lat
      const z = 6 + Math.sin(r.phi) * lat * 0.3
      const y = r.Y + r.vel * (tau - (0.85 * Math.sin(2 * w * tau)) / (2 * w))
      const fq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(r.phi), 0, -Math.cos(r.phi)), r.th0 * Math.sin(w * tau))
      fq.multiply(this.flat).premultiply(new THREE.Quaternion().setFromAxisAngle(this.X, 0.7))
      const q = fq.slerp(r.q, sstep(0.7, 0, tau))
      return { x, y, z, q, phase: 'in', k: tau }
    }
    if (u < r.rest) {
      // resting: a small settle on landing, then the tip trembles in the air (more in the gust)
      const gust = sstep(GUST[0] - 0.3, GUST[0] + 0.6, t) * (1 - sstep(GUST[1], GUST[1] + 1, t))
      const tr = (0.035 + 0.08 * gust) * Math.sin(u * 3.7 + r.phi) + 0.02 * Math.sin(u * 7.1)
      const q = r.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(this.X, tr))
      const bounce = 3 * Math.exp(-u * 7) * Math.sin(u * 22)
      return { x: r.x - this.W / 2, y: r.Y + bounce, z: 6, q, phase: 'rest', k: u }
    }
    const i = Math.floor((u - r.rest) * 60)
    if (i < r.slide.length) {
      const f = r.slide[i]
      return { ...f, phase: f.falling ? 'fall' : 'slide', k: u - r.rest }
    }
    return null
  },

  /** Seconds of the cycle with no landing, slide or gust in progress: where stills may be taken. */
  settled() {
    const T = this.p.cycle
    const busy = [[GUST[0] - 0.2, GUST[1] + 1.2]]
    for (const r of this.events || []) {
      busy.push([r.land - 0.9, r.land + 0.5])
      busy.push([r.land + r.rest - 0.2, r.land + r.rest + r.slideOnly + 0.6])
    }
    const free = []
    for (let t = 0; t < T; t += 0.1) {
      const ok = busy.every(([a, b]) => { const u = mod(t - a, T); return u > b - a })
      if (ok) {
        const last = free[free.length - 1]
        if (last && Math.abs(last[1] - t) < 0.15) last[1] = +(t + 0.1).toFixed(2)
        else free.push([+t.toFixed(2), +(t + 0.1).toFixed(2)])
      }
    }
    return free
  },

  /* ---------------- drawing */
  coc(z) {
    return (K_COC * (this.H / 900) * Math.abs(z)) / (this.D - z)
  },
  levelFor(z, quad) {
    const quadPx = (quad * this.D) / (this.D - z)
    const sig = ((this.coc(z) / 2.4) * S) / Math.max(quadPx, 1)
    if (sig <= 0) return 0
    for (let i = 0; i < NL - 1; i++) if (sig < SIG[i + 1]) return i + (sig - SIG[i]) / (SIG[i + 1] - SIG[i])
    return NL - 1 - 1e-3
  },

  seek(t, state) {
    if (!this.view) return
    const THREE = this.THREE
    const T = this.p.cycle
    const tt = mod(t, T)
    const live = !this.ctx.recording && !state.still && this.p.follow
    // the live gust: the pointer's velocity pushes leaves near it, each on its own spring
    if (live) this.stepLive(state)
    const items = []
    this.leaves.forEach((l, i) => {
      const bp = this.basePose(l, tt)
      const [o, ov] = this.gustOffset(i, tt)
      let x = bp.x + o
      let y = bp.y - 0.25 * o
      if (live) {
        x += this.liveOff[i].x
        y += this.liveOff[i].y
      }
      // a gust flips a leaf about its span as it pushes it
      const spin = clamp(ov * 0.004, -1.2, 1.2) + (live ? clamp(this.liveOff[i].vx * 0.003, -1, 1) : 0)
      const q = bp.q.clone().premultiply(this._q.setFromAxisAngle(this.Z, -spin))
      items.push({ x, y, z: bp.z, q, size: l.size, cell: l.cell, curl: l.curl, bright: l.bright })
    })
    const night = this.night
    const shadowsOn = this.p.sign === 'painted'
    this.shadows.forEach((m) => (m.visible = false))
    ;(this.events || []).forEach((r, i) => {
      const e = this.eventPose(r, tt)
      if (!e) return
      items.push({ x: e.x, y: e.y, z: e.z, q: e.q, size: r.size, cell: r.cell, curl: r.curl, bright: night ? 2.4 : 1, sharp: e.phase !== 'fall' })
      if (shadowsOn && (e.phase === 'rest' || e.phase === 'slide') && this.shadows[i]) {
        const m = this.shadows[i]
        const cx = e.x
        m.visible = true
        m.position.set(cx, this.H / 2 - r.topY - this.fontSize * 0.03, 1)
        m.scale.set(r.size * 0.9, this.fontSize * 0.09, 1)
        m.material.opacity = 0.55
      }
    })
    if (this.groundLeaves) items.push(...this.groundLeaves)
    items.sort((a, b) => a.z - b.z)
    const fill = (dst, list) => {
      list.forEach((it, i) => {
        const quad = it.size / FILL
        this._m.compose(this._p.set(it.x, it.y, it.z), it.q, this._s.set(quad, quad, quad))
        dst.mesh.setMatrixAt(i, this._m)
        const lev = it.sharp ? 0 : this.levelFor(it.z, quad)
        const fog = it.z < -300 ? clamp((-it.z - 300) / 2600, 0, 1) * this.look.fogAmt : 0
        dst.aA.setXYZW(i, it.cell, lev, 1, it.bright)
        dst.aB.setXYZW(i, it.curl[0], it.curl[1], fog, it.curl[2] || 0)
      })
      dst.mesh.count = list.length
      dst.mesh.instanceMatrix.needsUpdate = true
      dst.aA.needsUpdate = true
      dst.aB.needsUpdate = true
    }
    fill(this.back, items.filter((i) => i.z < 0))
    fill(this.front, items.filter((i) => i.z >= 0))
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.camera)
  },

  stepLive(state) {
    const L = this.live
    const now = performance.now() / 1000
    const dt = L.last === null ? 0 : Math.min(0.05, Math.max(0, now - L.last))
    L.last = now
    const ptr = state.pointer || { x: 0, y: 0 }
    const px = ((ptr.x + 1) / 2) * this.W - this.W / 2
    const py = ptr.y * (this.H / 2)
    if (L.px !== null && dt > 0) {
      L.vx = lerp(L.vx, (px - L.px) / dt, 0.1)
      L.vy = lerp(L.vy, (py - L.py) / dt, 0.1)
    }
    L.px = px
    L.py = py
    if (!dt) return
    const k = 6
    const c = 2 * 0.75 * Math.sqrt(k)
    const R = 0.22 * this.W
    this.leaves.forEach((l, i) => {
      const o = this.liveOff[i]
      const bp = this.basePose(l, mod(state.time, this.p.cycle))
      const sc = this.D / (this.D - bp.z)
      const d2 = ((bp.x * sc - px) ** 2 + (bp.y * sc - py) ** 2) / (R * R)
      const f = Math.exp(-d2) * 2.2
      o.vx += (f * L.vx - k * o.x - c * o.vx) * dt
      o.vy += (f * L.vy * 0.6 - k * o.y - c * o.vy) * dt
      o.x += o.vx * dt
      o.y += o.vy * dt
    })
  },

  /* ---------------- tools for the package's scripts */

  /** Hides the sign (for the baked still: the page shows the real headline over it when WebGL is off). */
  bake(on) {
    this.letMesh.visible = !on
  },

  /** The share of each letter's ink the leaves in front of the sign cover now (alpha-weighted). */
  coverage(t) {
    const THREE = this.THREE
    const W = this.W
    const H = this.H
    if (t !== undefined) this.seek(t, { still: true, time: t })
    const rt = (this._rt ||= new THREE.WebGLRenderTarget(W, H))
    if (rt.width !== W || rt.height !== H) rt.setSize(W, H)
    const vis = [this.bgMesh.visible, this.letMesh.visible, this.back.mesh.visible]
    this.bgMesh.visible = false
    this.letMesh.visible = false
    this.back.mesh.visible = false
    this.shadows.forEach((m) => (m.visible = false))
    const dpr = this.uniforms.uDpr.value
    this.uniforms.uDpr.value = 1
    this.renderer.setRenderTarget(rt)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    const px = new Uint8Array(W * H * 4)
    this.renderer.readRenderTargetPixels(rt, 0, 0, W, H, px)
    this.renderer.setRenderTarget(null)
    this.renderer.setClearColor(0x000000, 1)
    this.uniforms.uDpr.value = dpr
    ;[this.bgMesh.visible, this.letMesh.visible, this.back.mesh.visible] = vis
    const out = []
    for (const L of this.letters) {
      let ink = 0
      let hid = 0
      for (let yy = 0; yy < L.bh; yy++)
        for (let xx = 0; xx < L.bw; xx++) {
          const m = L.mask[yy * L.bw + xx]
          if (!m) continue
          const sx = L.bx + xx
          const sy = L.by + yy
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue
          ink += m
          hid += m * (px[((H - 1 - sy) * W + sx) * 4 + 3] / 255)
        }
      out.push({ ch: L.ch, share: ink ? hid / ink : 0 })
    }
    const worst = out.reduce((a, b) => (b.share > a.share ? b : a), { ch: '', share: 0 })
    return { worst, letters: out.length }
  },

  /** Draws n frames back to back, waiting for the GPU each time: milliseconds per frame (median, p95). */
  bench(n = 120) {
    const gl = this.renderer.getContext()
    const ms = []
    const px = new Uint8Array(4)
    for (let i = 0; i < n; i++) {
      const t0 = performance.now()
      this.seek(i / 30, { still: false, time: i / 30, pointer: { x: Math.sin(i * 0.1), y: Math.cos(i * 0.07) } })
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      ms.push(performance.now() - t0)
    }
    ms.sort((a, b) => a - b)
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    return { median: ms[n >> 1], p95: ms[Math.floor(n * 0.95)], dpr: this.view.dpr, drawn: this.rdpr, size: [gl.drawingBufferWidth, gl.drawingBufferHeight], renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) }
  },
}
