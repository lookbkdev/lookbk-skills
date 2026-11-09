// Signal Glitch (browser), Motion Heroes kit v2. Raw WebGL1, no libraries.
//
// The programme frame (the picture, cropped to the field, with the
// headline burned in from view.type, and a title-safe grade under the
// letters) is drawn once per size into a 2D canvas and uploaded as a
// texture. One fragment shader shows it the way a receiver shows a channel
// it is acquiring, through two chains with their own locks:
//
// The cable (analog link). Vertical sync: the frame rolls, the blanking
// bar between frames passing through, slowing to a stop (vertical hold).
// Horizontal sync: until the line oscillator locks the lines shear (the
// frequency error), the top of the frame flags, the lines jitter, then the
// oscillator rings once and settles. Colour: the colour killer keeps the
// picture monochrome until the colour burst locks; colour then arrives a
// little off in hue, swings into place, and sits to the right of the edges
// by a chroma delay that settles to zero. Chroma is low bandwidth, so it is
// sampled wide and soft, as on a real composite signal.
//
// The stream (compressed picture, joined mid-group). With no key frame the
// decoder has only an empty reference (effect.buffer): motion vectors drag
// blocks of it, residuals paint the picture in coarsely (detailed blocks
// first), some blocks take a wrong vector and copy their neighbours. A
// rolling intra refresh then sweeps across (columns left to right, or rows
// top to bottom), and every block it passes is clean. In the held frame one burst error slips a band of
// blocks for 0.2 s; at the end of the cycle blocks freeze and drift, colour
// is lost, the lines start to slip and the frame falls back to the empty
// reference, which is where the next acquisition starts: the loop closes.
//
// Every value is a function of the time (schedule()), so recordings are
// frame exact; a live pointer adds interference that decays.
const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`
const FRAG = `precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform sampler2D uTex;
uniform float uB;
uniform vec3 uBuf, uBlank, uPulse, uData, uPlateC, uEdgeC;
uniform vec4 uPlates[6];
uniform float uNPlates, uLight, uKey;
uniform float uRoll, uShear, uFlag, uRing, uRingPh, uJit, uScan, uFrame;
uniform float uSat, uHue, uCDel;
uniform float uAcq, uResid, uSweep, uMosh, uRows;
uniform float uLoss, uLossAge, uFadeOut;
uniform float uBurst, uBurstRow;
uniform vec2 uPtr, uPV;
uniform float uPE, uPR;
uniform float uGrain;
const vec3 LUMA = vec3(0.299, 0.587, 0.114);
float h1(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
float h2(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 pic(vec2 p){ vec2 uv = clamp(p / uRes, vec2(0.0), vec2(1.0)); uv.y = 1.0 - uv.y; return texture2D(uTex, uv).rgb; }
vec2 sub(vec2 p){ float s = uB * 0.25; return (floor(p / s) + 0.5) * s; }
vec2 flow(vec2 bi){
  // coherent motion vectors, mostly downward: the smear melts the picture down the frame
  float n = vn(bi * 0.075 + 3.7);
  float a = 1.5708 + (n - 0.5) * 1.9;
  return vec2(cos(a), sin(a)) * (0.3 + 1.2 * vn(bi * 0.06 + 11.0));
}
float detail(vec2 bi){
  vec2 c = (bi + 0.5) * uB; float o = uB * 0.3;
  float a = dot(pic(c + vec2(-o, -o)), LUMA), b = dot(pic(c + vec2(o, -o)), LUMA);
  float d = dot(pic(c + vec2(-o, o)), LUMA), e = dot(pic(c + vec2(o, o)), LUMA);
  return clamp((max(max(a, b), max(d, e)) - min(min(a, b), min(d, e))) * 2.5, 0.0, 1.0);
}
vec3 mosh(vec2 p, vec2 bi, float hb, float age, float resid){
  // the block's motion vector, accumulated since the stream was joined (no key frame to reset it)
  vec2 f = flow(bi);
  vec2 mv = f * age * uB * 4.5 * uMosh;
  vec2 dir = normalize(f);
  // the smear: each P-frame copies the block from upstream, so its content stretches back along the vector
  vec2 o = (bi + 0.5) * uB - dir * uB * 0.5;
  float along = dot(p - o, dir);
  float st = clamp(age * 0.9 * uMosh, 0.0, 0.92);
  vec2 sp = p - mv - dir * along * st;
  // a wrong vector: the block copies a neighbour
  if (hb > 0.86) sp += floor(vec2(h2(bi + 3.1) * 7.0 - 3.0, h2(bi + 9.7) * 3.0 - 1.0)) * uB;
  // the residual paints the picture back in, detailed blocks first, coarse (DC only) before fine
  float r = clamp(resid * (0.3 + 1.9 * detail(bi)) * (0.55 + 0.9 * h2(bi + 5.3)), 0.0, 1.0);
  vec3 fine = pic(sp);
  vec3 c = r < 0.3 ? mix(pic(sub(sp)), fine, r / 0.3) : fine;
  c = mix(uBuf, c, smoothstep(0.0, 0.7, r));
  // no deblocking: the block's edges show
  vec2 fr = fract(p / uB);
  float edge = step(fr.x, 1.0 / uB) + step(fr.y, 1.0 / uB);
  return c * (1.0 - 0.08 * min(edge, 1.0) * r);
}
vec3 stream(vec2 p){
  vec2 bi = floor(p / uB);
  float hb = h2(bi + 17.0);
  vec3 c = pic(p);
  if (uPE > 0.002){
    // interference: the blocks near the pointer are dragged along its motion
    float d = length((bi + 0.5) * uB - uPtr) / uPR;
    float w = uPE * (1.0 - smoothstep(0.3, 1.0, d)) * step(0.2, hb);
    if (w > 0.01){ vec2 sp = p - uPV * w * (0.5 + hb); c = mix(c, pic(sub(sp)), smoothstep(0.0, 0.25, w)); }
  }
  if (uBurst > 0.5 && bi.y >= uBurstRow && bi.y < uBurstRow + 2.0 && hb > 0.15)
    c = pic(sub(p + vec2(floor(h2(bi + 31.0) * 5.0 - 2.0) * uB, 0.0)));
  if (uAcq >= 0.0){
    float front = uSweep - hb * uB * 2.5;
    if ((uRows > 0.5 ? bi.y : bi.x) * uB + 0.5 * uB > front) c = mosh(p, bi, hb, uAcq, uResid);
  }
  if (uLoss > 0.0 && hb > 1.0 - uLoss) c = mosh(p, bi, hb, uLossAge, 1.0);
  if (uFadeOut > 0.0) c = mix(c, uBuf, step(h2(bi + 41.0), uFadeOut));
  return c;
}
void main(){
  vec2 q = gl_FragCoord.xy / uDpr;
  q.y = uRes.y - q.y;
  float Hf = uRes.y * 1.07;
  float yy = mod(q.y + uRoll * Hf, Hf);
  vec3 col;
  if (yy > uRes.y){
    // the vertical blanking bar: the sync pulse and a data line in it
    float b = (yy - uRes.y) / (Hf - uRes.y);
    col = uBlank;
    col = mix(col, uPulse, step(abs(b - 0.64), 0.04));
    col = mix(col, uData, step(abs(b - 0.3), 0.03) * step(0.45, fract(q.x / 11.0)) * step(h1(floor(q.x / 11.0) + 3.0), 0.6));
  } else {
    float ln = floor(yy / 2.0);
    float dx = uShear * (yy - uRes.y * 0.5) + uFlag * exp(-yy / (uRes.y * 0.09)) + uRing * sin(yy * 0.011 + uRingPh)
      + uJit * (h1(ln + uFrame * 7.13) - 0.5) * 2.0;
    dx += uPE * uPV.x * 0.6 * exp(-pow((yy - uPtr.y) / (uPR * 0.28), 2.0)) * (0.3 + h1(ln * 1.7 + uFrame));
    float Wf = uRes.x * 1.06;
    // sub-pixel and small slips stay inside the line; larger ones expose the horizontal blanking
    float xx = abs(dx) < 2.0 ? clamp(q.x - dx, 0.0, uRes.x) : mod(q.x - dx, Wf);
    if (xx > uRes.x){
      col = uBlank;
    } else {
      vec2 p = vec2(xx, yy);
      vec3 y3 = stream(p);
      if (uSat < 0.999 || uCDel > 0.05 || abs(uHue) > 0.002){
        // composite colour: luma sharp, chroma soft, delayed, rotated, or killed
        float Y = dot(y3, LUMA);
        vec2 pc = p - vec2(uCDel, 0.0);
        vec3 cc = (stream(pc) * 2.0 + stream(pc - vec2(6.0, 0.0)) + stream(pc + vec2(6.0, 0.0))) * 0.25;
        float I = dot(cc, vec3(0.596, -0.274, -0.322));
        float Q = dot(cc, vec3(0.211, -0.523, 0.312));
        float cs = cos(uHue), sn = sin(uHue);
        vec2 iq = vec2(I * cs - Q * sn, I * sn + Q * cs) * uSat;
        col = clamp(vec3(Y + 0.956 * iq.x + 0.621 * iq.y, Y - 0.272 * iq.x - 0.647 * iq.y, Y - 1.106 * iq.x + 1.703 * iq.y), 0.0, 1.0);
        // on a light page the killed colour is not grey: the monochrome takes the paper's white point
        if (uLight > 0.5) col = clamp(col + (1.0 - uSat) * (Y * uBuf / max(dot(uBuf, LUMA), 0.05) - Y), 0.0, 1.0);
      } else col = y3;
      // the raster: dark lines on a dark page, paper-coloured lines on a light one
      float rl = uScan * 0.32 * step(1.5, mod(yy, 3.0));
      col = uLight > 0.5 ? mix(col, uBuf, rl) : col * (1.0 - rl);
      col *= 1.0 + uScan * 0.08 * (h1(uFrame + 0.37) - 0.5);
    }
  }
  // the plates are the receiver's own on-screen display, keyed over the picture after the decoder:
  // they never tear. Their key edge is a clean margin in the plate colour, and while the signal is
  // unlocked a hairline and a soft shadow show the overlay sitting on top of the broken picture.
  for (int i = 0; i < 6; i++){
    if (float(i) >= uNPlates) break;
    vec4 r = uPlates[i];
    vec2 dd = max(max(r.xy - q, q - r.xy - r.zw), 0.0);
    float d = max(dd.x, dd.y); // square corners: a keyed panel, not a card
    if (d > 0.0 && d < 24.0){
      float sh = (1.0 - smoothstep(8.0, 24.0, d)) * uKey * (uLight > 0.5 ? 0.18 : 0.5);
      col = mix(col, uLight > 0.5 ? col * 0.8 : vec3(0.0), sh);
      col = mix(col, uPlateC, step(d, 8.0));
      col = mix(col, uEdgeC, uKey * (1.0 - smoothstep(0.0, 1.2, abs(d - 8.0))));
    }
  }
  col += (h2(gl_FragCoord.xy) - 0.5) * 0.04 * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`

const TAU = Math.PI * 2
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const cl = (x) => Math.max(0, Math.min(1, x))
const ss = (a, b, x) => {
  const k = cl((x - a) / (b - a))
  return k * k * (3 - 2 * k)
}
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))

/** Every uniform of the signal at scene time t. Pure. */
function schedule(t, p, v) {
  const T = p.cycle
  const A = p.acquire
  const F = p.fade
  const s = ((t % T) + T) % T
  const B = v.mobile ? Math.round(p.block * 0.75) : p.block
  const o = {
    roll: 0, shear: 0, flag: 0, ring: 0, ringPh: 0, jit: 0, scan: 0, frame: Math.floor(t * 30),
    sat: 1, hue: 0, cdel: 0, acq: -1, resid: 1, sweep: 0, loss: 0, lossAge: 0, fadeOut: 0, burst: 0, burstRow: 0, B,
  }
  const tear = p.tear
  const cdMax = 18 * p.chroma * (v.mobile ? 0.7 : 1)
  // vertical hold: two frames of roll, slowing to a stop at 55% of the acquisition
  const tv = 0.55 * A
  const V0 = (6 / tv) // frames per second at s = 0
  const te = 2 / V0 // the fade's roll accelerates from rest to V0 over te, covering one frame
  const burstLock = 0.72 * A
  if (s < A) {
    const u = s / A
    if (p.roll) o.roll = 2 * (1 - Math.pow(1 - Math.min(1, s / tv), 3))
    o.shear = 0.2 * tear * (1 - ss(0, 0.6, u))
    o.flag = 70 * tear * Math.exp(-s / (0.22 * A)) * Math.cos(TAU * 3 * s) * (1 - ss(0.5, 0.65, u))
    if (s > 0.35 * A) o.ring = 12 * tear * Math.exp(-(s - 0.35 * A) / (0.16 * A)) * Math.sin(TAU * 4 * (s - 0.35 * A))
    o.ringPh = s * 9
    o.jit = 5 * tear * Math.pow(1 - u, 3)
    o.scan = Math.pow(1 - u, 1.5)
    o.sat = ss(burstLock, burstLock + 0.14, s)
    o.hue = s > burstLock ? 0.6 * Math.exp(-(s - burstLock) / 0.12) * Math.cos(TAU * 2.2 * (s - burstLock)) : 0
    o.cdel = s < burstLock ? cdMax : cdMax * Math.exp(-(s - burstLock) / (0.11 * A))
    o.acq = s
    o.resid = ss(0.03, 0.72, u)
    o.sweep = -3 * B + ((p.refresh === 'rows' ? v.height : v.width) + 6 * B) * ss(0.45, 0.95, u)
  } else if (s >= T - F) {
    const tau = s - (T - F)
    const w = tau / F
    o.loss = Math.pow(ss(0, 1, w), 1.2)
    o.lossAge = tau
    o.fadeOut = ss(0.55, 0.94, w)
    o.sat = 1 - ss(0.45, 0.7, w)
    o.hue = 0.7 * w * w
    o.cdel = cdMax * ss(0.3, 0.75, w)
    o.jit = 5 * tear * Math.pow(ss(0.4, 1, w), 2)
    o.shear = 0.2 * tear * ss(0.6, 1, w)
    o.flag = 70 * tear * ss(0.7, 1, w) * Math.cos(TAU * 3 * (s - T))
    o.scan = Math.pow(ss(0.5, 1, w), 1.5)
    if (p.roll && s > T - te) o.roll = (V0 / (2 * te)) * Math.pow(s - (T - te), 2)
  } else if (p.burst) {
    const tb = A + (T - F - A) * 0.55
    if (s >= tb && s < tb + 0.2) {
      o.burst = 1
      o.burstRow = Math.floor((v.height / B) * 0.42)
    }
  }
  return o
}

export default {
  schedule,

  async init(c) {
    this.ctx = c
    this.p = c.params
    const img = new Image()
    img.decoding = 'async'
    img.src = c.asset(String(this.p.picture).split('/').pop().replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-') + '.jpg')
    await img.decode()
    this.img = img
    const gl = c.canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: !!c.recording })
    if (!gl) throw new Error('WebGL is not available')
    this.gl = gl
    const sh = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s))
      return s
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
    gl.useProgram(prog)
    const U = {}
    for (const k of ['uRes', 'uDpr', 'uTex', 'uB', 'uBuf', 'uBlank', 'uRoll', 'uShear', 'uFlag', 'uRing', 'uRingPh', 'uJit', 'uScan', 'uFrame', 'uSat', 'uHue', 'uCDel', 'uAcq', 'uResid', 'uSweep', 'uMosh', 'uRows', 'uLoss', 'uLossAge', 'uFadeOut', 'uBurst', 'uBurstRow', 'uPtr', 'uPV', 'uPE', 'uPR', 'uGrain', 'uPulse', 'uData', 'uPlateC', 'uEdgeC', 'uPlates', 'uNPlates', 'uLight', 'uKey'])
      U[k] = gl.getUniformLocation(prog, k)
    this.U = U
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    this.tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
    gl.uniform1i(U.uTex, 0)
    const p = this.p
    gl.uniform3fv(U.uBuf, hex(p.buffer))
    gl.uniform3fv(U.uBlank, hex(p.blanking))
    const th = c.theme
    const light = th.mode === 'light'
    const mixc = (a, b, k) => hex(a).map((x, i) => x + (hex(b)[i] - x) * k)
    // the sync pulse and the data line inside the blanking bar: lighter than the bar on a dark page, darker on a light one
    gl.uniform3fv(U.uPulse, mixc(p.blanking, light ? th.ink : '#ffffff', light ? 0.14 : 0.3))
    gl.uniform3fv(U.uData, mixc(p.blanking, light ? th.ink : '#ffffff', light ? 0.38 : 0.55))
    gl.uniform3fv(U.uPlateC, hex(th.plate || th.background))
    gl.uniform3fv(U.uEdgeC, mixc(th.plate || th.background, th.ink, 0.45))
    gl.uniform1f(U.uLight, light ? 1 : 0)
    gl.uniform1f(U.uMosh, p.mosh)
    gl.uniform1f(U.uRows, p.refresh === 'rows' ? 1 : 0)
    gl.uniform1f(U.uGrain, p.grain)
    this.frame = document.createElement('canvas')
    // live interference from the pointer
    this.live = { ptr: null, prev: null, last: null, vx: 0, vy: 0, e: 0, x: 0, y: 0 }
    c.root.addEventListener('pointermove', (e) => {
      const r = c.root.getBoundingClientRect()
      this.live.ptr = { x: e.clientX - r.left, y: e.clientY - r.top, at: performance.now() }
    })
    c.root.addEventListener('pointerleave', () => (this.live.ptr = null))
  },

  resize(view) {
    this.view = view
    const gl = this.gl
    const W = Math.max(1, Math.round(view.width * view.dpr))
    const H = Math.max(1, Math.round(view.height * view.dpr))
    this.ctx.canvas.width = W
    this.ctx.canvas.height = H
    gl.viewport(0, 0, W, H)
    gl.uniform2f(this.U.uRes, view.width, view.height)
    gl.uniform1f(this.U.uDpr, view.dpr)
    // the plates in the field (not the bar), for their key edge
    const top = view.bar.y + view.bar.h
    const pl = view.plates.filter((r) => r.y >= top - 1).slice(0, 6)
    const arr = new Float32Array(24)
    pl.forEach((r, i) => arr.set([r.x, r.y, r.w, r.h], i * 4))
    gl.uniform4fv(this.U.uPlates, arr)
    gl.uniform1f(this.U.uNPlates, pl.length)
    this.drawFrame()
  },

  /** The programme frame: the picture in the field, graded under the letters, with the headline burned in. */
  drawFrame() {
    const v = this.view
    const p = this.p
    const th = this.ctx.theme
    const d = Math.min(v.dpr, 2)
    const W = Math.max(1, Math.round(v.width * d))
    const H = Math.max(1, Math.round(v.height * d))
    const cv = this.frame
    cv.width = W
    cv.height = H
    const g = cv.getContext('2d', { willReadFrequently: true })
    g.setTransform(d, 0, 0, d, 0, 0)
    g.fillStyle = th.background
    g.fillRect(0, 0, v.width, v.height)
    // the field: the stage, under the bar
    const top = v.bar.y + v.bar.h
    const s = v.stage
    const fy = Math.max(s.y, top)
    const F = { x: s.x, y: fy, w: s.w, h: s.y + s.h - fy }
    const img = this.img
    const k = Math.max(F.w / img.naturalWidth, F.h / img.naturalHeight)
    const dw = img.naturalWidth * k
    const dh = img.naturalHeight * k
    const fx = v.mobile ? p.phoneFocusX : p.focusX
    g.save()
    g.beginPath()
    g.rect(F.x, F.y, F.w, F.h)
    g.clip()
    g.drawImage(img, F.x + (F.w - dw) * fx, F.y + (F.h - dh) * p.focusY, dw, dh)
    g.restore()
    // the title-safe grade: a soft area under the letters only, held to a luminance limit
    const type = v.type
    const letters = (cx, fill, strokeW) => {
      cx.save()
      cx.textBaseline = 'alphabetic'
      cx.textAlign = 'left'
      if ('letterSpacing' in cx) cx.letterSpacing = `${type.letterSpacing}px`
      cx.fillStyle = fill
      cx.strokeStyle = fill
      cx.lineJoin = 'round'
      cx.lineWidth = strokeW
      for (const line of type.lines)
        for (const part of line.parts) {
          cx.font = type.font(part.italic)
          if (strokeW) cx.strokeText(part.text, part.x, line.baseline)
          cx.fillText(part.text, part.x, line.baseline)
        }
      cx.restore()
    }
    const m1 = document.createElement('canvas')
    m1.width = W
    m1.height = H
    const a = m1.getContext('2d')
    a.setTransform(d, 0, 0, d, 0, 0)
    // the safe-title area: each line's box, padded and heavily feathered, so the grade reads as light falling off, not as a glow around the letters
    a.fillStyle = '#fff'
    for (const line of type.lines) {
      const px0 = type.size * 0.3
      const py0 = type.size * 0.12
      a.fillRect(line.x - px0, line.y - py0, line.w + px0 * 2, line.h + py0 * 2)
    }
    const m2 = document.createElement('canvas')
    m2.width = W
    m2.height = H
    const b = m2.getContext('2d', { willReadFrequently: true })
    b.filter = `blur(${Math.round(type.size * 0.45 * d)}px)`
    b.drawImage(m1, 0, 0)
    b.drawImage(m1, 0, 0)
    const mask = b.getImageData(0, 0, W, H).data
    const im = g.getImageData(0, 0, W, H)
    const px = im.data
    const Li = (() => {
      const [r, gg, bb] = hex(th.ink).map(lin)
      return 0.2126 * r + 0.7152 * gg + 0.0722 * bb
    })()
    const dark = th.mode === 'dark'
    const cap = dark ? Math.max(0, (Li + 0.05) / p.grade - 0.05) : 0
    const floor = dark ? 0 : Math.min(1, p.grade * (Li + 0.05) - 0.05)
    const bg = hex(th.background).map(lin)
    const Lbg = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]
    const LUT = new Float32Array(256)
    for (let i = 0; i < 256; i++) LUT[i] = lin(i / 255)
    const enc = (x) => {
      const c = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
      return Math.round(cl(c) * 255)
    }
    for (let i = 0; i < px.length; i += 4) {
      const m = mask[i + 3] / 255
      if (m < 0.004) continue
      const r = LUT[px[i]]
      const gg = LUT[px[i + 1]]
      const bb = LUT[px[i + 2]]
      const L = 0.2126 * r + 0.7152 * gg + 0.0722 * bb
      let nr = r
      let ng = gg
      let nb = bb
      if (dark && L > cap) {
        const f = cap / L
        nr *= f
        ng *= f
        nb *= f
      } else if (!dark && L < floor) {
        // a fill light: the shadows opened up, half in their own colour and half neutral (so a warm shadow doesn't turn orange), topped up with the paper only where they are near black
        const f = floor / Math.max(L, 0.02)
        const gL = floor
        nr = Math.min(1, nr * f) * 0.5 + gL * 0.5
        ng = Math.min(1, ng * f) * 0.5 + gL * 0.5
        nb = Math.min(1, nb * f) * 0.5 + gL * 0.5
        const L2 = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb
        if (L2 < floor) {
          const k = Math.min(1, (floor - L2) / Math.max(1e-4, Lbg - L2))
          nr += (bg[0] - nr) * k
          ng += (bg[1] - ng) * k
          nb += (bg[2] - nb) * k
        }
      } else continue
      // full strength at the letters, feathering out (the mask's core is solid where the strokes are)
      const w = Math.min(1, m * 1.35)
      px[i] = enc(r + (nr - r) * w)
      px[i + 1] = enc(gg + (ng - gg) * w)
      px[i + 2] = enc(bb + (nb - bb) * w)
    }
    g.putImageData(im, 0, 0)
    letters(g, th.ink, 0)
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, cv)
  },

  seek(t, state) {
    const { gl, U, view: v, p } = this
    if (!v) return
    const o = schedule(t, p, v)
    // the pointer's interference (live pages only): energy from its speed, decaying as the stream repairs
    let pe = 0
    let pv = [0, 0]
    let pp = [0, 0]
    const R = v.mobile ? v.width * 0.32 : Math.min(v.width, v.height) * 0.17
    if (!this.ctx.recording && !state.still && p.follow) {
      const L = this.live
      const now = state.time
      const dt = L.last === null ? 0 : Math.min(0.05, Math.max(0, now - L.last))
      L.last = now
      if (L.ptr) {
        if (L.prev && dt > 0) {
          const vx = (L.ptr.x - L.prev.x) / dt
          const vy = (L.ptr.y - L.prev.y) / dt
          L.vx += (vx - L.vx) * 0.35
          L.vy += (vy - L.vy) * 0.35
          L.e = Math.min(1, L.e + (Math.hypot(vx, vy) * dt) / 260)
        }
        L.prev = { x: L.ptr.x, y: L.ptr.y }
        L.x = L.ptr.x
        L.y = L.ptr.y
      } else L.prev = null
      L.e *= Math.exp(-dt / 0.55)
      pe = L.e
      const sc = 0.09
      const mx = o.B * 3
      pv = [Math.max(-mx, Math.min(mx, L.vx * sc)), Math.max(-mx, Math.min(mx, L.vy * sc))]
      pp = [L.x, L.y]
    }
    gl.uniform1f(U.uB, o.B)
    // how unlocked the signal is: the key edge shows while it is
    gl.uniform1f(U.uKey, Math.min(1, Math.max(o.scan * 1.4, 1 - o.sat, o.acq >= 0 ? 1 - ss(0.85, 1, o.acq / p.acquire) : 0, o.loss)))
    gl.uniform1f(U.uRoll, o.roll)
    gl.uniform1f(U.uShear, o.shear)
    gl.uniform1f(U.uFlag, o.flag)
    gl.uniform1f(U.uRing, o.ring)
    gl.uniform1f(U.uRingPh, o.ringPh)
    gl.uniform1f(U.uJit, o.jit)
    gl.uniform1f(U.uScan, o.scan)
    gl.uniform1f(U.uFrame, o.frame)
    gl.uniform1f(U.uSat, o.sat)
    gl.uniform1f(U.uHue, o.hue)
    gl.uniform1f(U.uCDel, o.cdel)
    gl.uniform1f(U.uAcq, o.acq)
    gl.uniform1f(U.uResid, o.resid)
    gl.uniform1f(U.uSweep, o.sweep)
    gl.uniform1f(U.uLoss, o.loss)
    gl.uniform1f(U.uLossAge, o.lossAge)
    gl.uniform1f(U.uFadeOut, o.fadeOut)
    gl.uniform1f(U.uBurst, o.burst)
    gl.uniform1f(U.uBurstRow, o.burstRow)
    gl.uniform2f(U.uPtr, pp[0], pp[1])
    gl.uniform2f(U.uPV, pv[0], pv[1])
    gl.uniform1f(U.uPE, pe)
    gl.uniform1f(U.uPR, R)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  },
}
