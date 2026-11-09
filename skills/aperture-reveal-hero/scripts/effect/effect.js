// Aperture Reveal (browser), Motion Heroes kit v2: lockup and editorial
// compositions, typeMode "scene". Raw WebGL2, no libraries.
//
// The iris is built the way a real one is. Nine stamped blades; each blade's
// cutting edge is an arc of one fixed radius; each blade turns about its own
// pin on a circle around the optical axis. For an opening of inscribed radius
// a, the turn of every blade is solved in closed form, and the opening is the
// intersection of the nine edge discs: nearly round wide open, a nearly
// straight-sided nine-gon stopped down, and it turns a few degrees as it
// closes. Blade i lies over blade i+1; the seams are the blades' own edge
// arcs, each blade casts a soft shadow on the one under it and has a thin
// bevel that catches one key light.
//
// The iris sits in the counter of an O in the headline (measured from the
// glyph itself) and its size follows the f-number exactly: the opening's
// diameter is k / N, with k chosen so that at f/22 it is 0.86 of the
// counter's width.
//
// The scene behind is painted in code (a pier at night, or a stone courtyard
// with a fountain at noon) and rendered for the current f-number: a circle of
// confusion per depth, point lights drawn as bokeh in the opening's own
// current shape (a polar table rebuilt from the blades every frame), cat's
// eyes toward the edges wide open, 18 diffraction spikes per light stopped
// down (two per straight edge, nine edges), exposure that grows as the iris
// opens. Behind the letters a guard holds the scene down (dark themes) or up
// (light themes) so the headline reads on every frame.
//
// Two passes: the scene (the costly part) into a texture, at full resolution
// at rest and in recordings, at a fixed pixel budget while the iris moves;
// then the iris, the letters, the scale and the grain at full resolution.
// The ring clicks from stop to stop and holds; when nothing changes nothing
// is drawn. Everything drawn is a function of t (and of the pointer, live).

const TAU = Math.PI * 2
const STOPS = [1.2, 1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22]
const CYCLE = 12
const CLICK = 0.24 // seconds per full stop: a 0.14 s click and a short rest
const MOVE = 0.14
/** f-number to stops from f/1.4, and back. */
const evOf = (N) => 2 * Math.log2(N / 1.4)
const fOf = (e) => 1.4 * Math.pow(2, e / 2)

/** The points a move clicks through: every whole stop between a and b, then b. */
function clicks(a, b) {
  const pts = [a]
  if (b > a) for (let k = Math.floor(a + 1e-6) + 1; k < b - 1e-6; k++) pts.push(k)
  else for (let k = Math.ceil(a - 1e-6) - 1; k > b + 1e-6; k--) pts.push(k)
  pts.push(b)
  return pts
}
/** A click: quick out, a 2% overshoot, settled by MOVE. */
function clickEase(x) {
  if (x >= 1) return 1
  const c = 1.2
  const y = x - 1
  return 1 + (c + 1) * y * y * y + c * y * y
}
/** The loop: hold, click to stop 2, hold, click to stop 3, hold, click back. Pure. */
function plan(loop) {
  const s = String(loop).trim().split(/[\s,]+/).map(Number).map(evOf)
  const starts = [2.4, 7.0, 10.0]
  const moves = [
    [s[0], s[1]],
    [s[1], s[2]],
    [s[2], s[0]],
  ].map(([a, b], i) => {
    const pts = clicks(a, b)
    return { t0: starts[i], pts, t1: starts[i] + (pts.length - 1) * CLICK }
  })
  const holds = [[0, starts[0]]]
  moves.forEach((m, i) => holds.push([m.t1, i < 2 ? starts[i + 1] : CYCLE]))
  return { stops: s, moves, holds }
}
/** The aperture, in stops from f/1.4, at loop time t. Pure. */
function evAt(pl, t) {
  t = ((t % CYCLE) + CYCLE) % CYCLE
  let e = pl.stops[0]
  for (const m of pl.moves) {
    if (t < m.t0) break
    const u = t - m.t0
    const k = Math.min(m.pts.length - 2, Math.floor(u / CLICK))
    if (u >= (m.pts.length - 1) * CLICK) e = m.pts[m.pts.length - 1]
    else {
      const a = m.pts[k]
      const b = m.pts[k + 1]
      e = a + (b - a) * clickEase((u - k * CLICK) / MOVE)
    }
  }
  return e
}

/* ---------------------------------------------------------------- shaders */

const VERT = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`

const COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes;            // device px of the full frame
uniform float uDpr;
uniform vec2 uC;              // iris centre (device px, y down)
uniform float uA;             // opening's inscribed radius
uniform float uRb;            // blade edge radius
uniform vec2 uBC[9];          // blade edge centres, relative to uC
uniform vec2 uPin[9];
uniform float uHouse;
uniform float uN;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 hash2(vec2 p){ return vec2(hash(p), hash(p + 19.19)); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s; }
float aperture(){ return 1.4 / uN; }
// the opening: negative inside (device px)
float sdOpening(vec2 v){ float m = -1e9; for(int i=0;i<9;i++) m = max(m, length(v - uBC[i]) - uRb); return m; }
vec3 tone(vec3 c){ c = 1. - exp(-c * 2.6); return pow(c, vec3(1./2.2)); }
`

const SCENE = COMMON + `
out vec4 o;
uniform float uScale;         // this pass's pixels per device px
uniform int uScene;           // 0 pier, 1 court
uniform vec2 uVP; uniform float uF; uniform float uZf; uniform float uK;
uniform float uGain;
uniform vec4 uL[48]; uniform vec4 uLC[48]; uniform int uNL;
uniform sampler2D uPolar;     // the opening's outline, radius by angle (units of the inscribed radius)
uniform sampler2D uMask;      // b: the guard around the letters
uniform float uDark;
uniform float uExempt;        // the O's own counter is the window: not guarded
uniform int uBake;
float coc(float z){ return uK * aperture() * abs(1. - uZf / z); }
float soft(float d, float w){ return smoothstep(-w, w, d); }
// a bar of half-width w (px) at offset x (px), seen through a blur of radius c: the exact box average
float bar(float x, float w, float c){ c = max(c, .5); return clamp(min(x + c, w) - max(x - c, -w), 0., 2.*c) / (2.*c); }
float polar(vec2 u){
  float t = (atan(u.y, u.x) / 6.2831853 + .5) * 256.;
  float i0 = floor(t), f = t - i0;
  float a = texelFetch(uPolar, ivec2(int(mod(i0, 256.)), 0), 0).r;
  float b = texelFetch(uPolar, ivec2(int(mod(i0 + 1., 256.)), 0), 0).r;
  return mix(a, b, f);
}

// ------------------------------------------------ the pier at night
float bendX(float z){ return .0016 * z * z; }
vec3 pier(vec2 p, out float zOut){
  vec2 d = (p - uVP) / uF; float px = 1. / uF;
  vec3 col = mix(vec3(.004,.007,.018), vec3(.016,.020,.036), smoothstep(-.6, 0., d.y));
  col += vec3(.020,.010,.004) * exp(-max(-d.y,0.)*20.);
  col += vec3(.005,.006,.010) * smoothstep(.55,.8, fbm(vec2(d.x*2.2, d.y*9.))) * smoothstep(0.,-.3,d.y);
  float z = 4000.;
  float cf = max(coc(1800.), uDpr);
  float shore = .006 + .006*fbm(vec2(d.x*9., 3.)) + .010*smoothstep(.2,.9,fbm(vec2(d.x*2.5,7.)));
  col = mix(col, vec3(.004,.004,.007), soft((d.y + shore)/px, cf) * soft(-d.y/px + 2., cf));
  if(d.y > 0.){
    float zs = 2.6 / d.y, xs = d.x * zs; float cs = max(coc(zs), uDpr);
    float sw = fbm(vec2(xs*.35, zs*1.4));
    vec3 sea = mix(vec3(.002,.003,.006), vec3(.016,.016,.024), smoothstep(10., 600., zs)) * (.7 + .6*sw);
    sea += vec3(.03,.016,.006) * exp(-abs(xs - bendX(zs)) * .35) * smoothstep(8., 40., zs) * (.5 + sw);   // the lanterns' light on the water
    col = mix(col, sea, soft(d.y/px, cs)); z = zs;
    float zd = 1.6 / d.y, xd = d.x * zd - bendX(zd); float cd = max(coc(zd), uDpr);
    float onDeck = soft((2.5 - abs(xd)) / zd / px, cd);
    float seam = smoothstep(.8, .97, abs(fract(xd/.16) - .5)*2.);
    seam = mix(seam, .15, clamp(cd / (.16/zd/px) * .5, 0., 1.));
    vec3 wood = vec3(.020,.013,.009) * (.75 + .5*fbm(vec2(xd*6., zd*.35))) * (1. - .55*seam);
    float zi = floor((zd - 2.) / 8. + .5) * 8. + 6.;
    float pool = exp(-((abs(xd)-2.1)*(abs(xd)-2.1) + (zd-zi)*(zd-zi)) / 6.) * exp(-zd/80.);
    wood += vec3(.16,.085,.032) * pool * (1. - .4*seam);
    col = mix(col, wood, onDeck); if(onDeck > .5) z = zd;
    float side = sign(d.x - bendX(8.)/8.);
    float zr = 2.5 / max(abs(d.x), 1e-4);
    for(int it=0; it<3; it++) zr = max((side*2.5 + bendX(zr)) / (abs(d.x) < 1e-4 ? 1e-4 : d.x), .5);
    float yr = -d.y * zr;
    float cr = max(coc(zr), uDpr);
    float band = soft((yr + 1.58) / zr / px, cr) * soft((-.55 - yr) / zr / px, cr) * smoothstep(1.2, 2., zr) * (1. - smoothstep(40., 70., zr)) * smoothstep(.02, .04, abs(d.x)) * step(0., zr * d.x * side);
    float spacing = 1.2 / zr / px, bw = .035 / zr / px;
    float bal = bar((fract(zr/1.2) - .5) * spacing, bw, cr * .5);
    bal = mix(bal, (2.*bw) / max(spacing, 1e-3), clamp(cr / max(spacing, 1.), 0., 1.));
    float rail = bar((yr + .6) / zr / px, .06 / zr / px, cr);
    float m = max(bal, rail) * band;
    float poolR = exp(-pow(zr - (floor((zr-2.)/8.+.5)*8.+6.), 2.) / 6.) * exp(-zr/80.);
    if(m > 0.){ col = mix(col, vec3(.004,.003,.003) + vec3(.07,.038,.016) * poolR, m); if(m > .5) z = min(z, zr); }
  }
  // lamp posts: out of focus a thin post spreads its darkness over its blur, so near posts turn to veils
  for(int i=0;i<15;i++){
    float zp = 6. + 8.*float(i); float c = coc(zp);
    for(int s=0;s<2;s++){
      float x0 = ((s==0 ? -2.3 : 2.3) + bendX(zp)) / zp;
      float xpx = (d.x - x0) / px;
      float yTop = -1.80/zp, yBot = 1.6/zp;
      float vert = bar((d.y - (yTop+yBot)*.5)/px, (yBot-yTop)*.5/px, c);
      float post = bar(xpx, .055/zp/px, c) * vert;
      float head = bar(xpx, .085/zp/px, c) * bar((d.y + 1.98/zp)/px, .15/zp/px, c);
      float cap = bar(xpx, .13/zp/px, c) * bar((d.y + 2.18/zp)/px, .04/zp/px, c);
      float lit = exp(-zp/80.);
      vec3 iron = vec3(.005,.004,.0035) + vec3(.07,.038,.016) * lit * smoothstep(yTop + .5/zp, yTop, d.y);
      col = mix(col, iron, max(post, cap));
      col += vec3(1.0,.62,.30) * 1.6 * lit * head * smoothstep(8.*uDpr, 2.*uDpr, c);
      if(max(post, head) > .5) z = min(z, zp);
    }
  }
  zOut = z; return col;
}

// ------------------------------------------------ the courtyard at noon
// A cloister: limestone paving in 0.9 m flags, a round stone fountain basin
// (centre at uFont), an arcade along the back wall (z = 14) with a sunlit
// wall and shuttered windows above, a strip of sky, and the leaves of a
// climbing vine across the top-left corner, near the lens.
uniform vec3 uFont;           // fountain centre x, z, and basin radius (m)
vec3 sky2(vec2 d){ return mix(vec3(.50,.68,.90), vec3(.16,.34,.72), smoothstep(-.05, -.7, d.y)); }
vec3 limestone(vec2 uv, float sharp){
  float n = fbm(uv * 2.6);
  vec3 c = mix(vec3(.50,.43,.33), vec3(.66,.58,.45), n);
  float pit = smoothstep(.60, .70, fbm(uv * 13. + 3.)) * sharp;   // travertine pits, lost in the blur
  float vein = smoothstep(.47, .5, abs(fbm(uv * vec2(1.2, 7.) + 9.) - .5) + .47) * .0;
  return c * (1. - .30 * pit) * (1. - .1 * vein);
}
vec3 court(vec2 p, out float zOut){
  vec2 d = (p - uVP) / uF; float px = 1. / uF;
  vec3 col = sky2(d); float z = 5000.;
  // the back wall (z = 14): roof eave, sunlit wall, windows, the arcade
  float zw = 14.; float cw = max(coc(zw), uDpr);
  float wx = d.x * zw, wy = -d.y * zw;
  float wallM = soft((4.35 - wy) / zw / px, cw);
  vec3 wall = mix(vec3(.86,.70,.48), vec3(.95,.80,.58), fbm(vec2(wx*.6, wy*.6))) * (.86 + .14*vnoise(vec2(wx*9., wy*9.)) * clamp(1. - cw/(4.*uDpr), 0., 1.));
  // the eave: terracotta tiles in a band, with a deep shadow under it
  float eave = soft((wy - 4.05)/zw/px, cw);
  vec3 tile = vec3(.55,.24,.14) * (.75 + .3*smoothstep(.3,.7, abs(fract(wx*4.)-.5)*2.) * clamp(1. - cw/(5.*uDpr), .3, 1.));
  wall = mix(wall, tile, eave);
  wall *= 1. - .45 * soft((wy - 3.80)/zw/px, cw) * (1. - eave);
  // shuttered windows above the arcade, one over every arch
  float bay = 3.2;
  float fx = (fract(wx / bay) - .5) * bay;               // 0 in the middle of an arch, +-bay/2 at a column
  float win = bar(fx / zw / px, .42 / zw / px, cw) * bar((wy - 2.95) / zw / px, .55 / zw / px, cw);
  wall = mix(wall, vec3(.13,.22,.18), win * .9);
  // the arcade: columns, round arches, deep shade behind
  float colW = .2;
  float inArch = 1. - bar((bay * .5 - abs(fx)) / zw / px, colW / zw / px, cw);
  float R = bay * .5 - colW;
  float archTop = 1.15;
  float archM = soft(-(length(vec2(fx, max(wy - archTop, 0.))) - R) / zw / px, cw) * soft((archTop + R - wy)/zw/px, cw);
  archM *= inArch;
  vec3 shade = mix(vec3(.035,.032,.034), vec3(.085,.075,.065), smoothstep(-1.6, 2.2, wy)) * (.85 + .15*fbm(vec2(wx*.8, wy)));
  col = mix(col, wall, wallM);
  col = mix(col, shade, archM * wallM);
  if(wallM > .5) z = zw;
  if(d.y > 0.){
    // the paving (y = -1.6): flags, joints, pits; the arcade's shadow near the wall; the fountain's shadow
    float zg = 1.6 / d.y, xg = d.x * zg; float cg = max(coc(zg), uDpr);
    float onG = soft((zw - zg) / zg / px * .02, cg) ;
    onG = soft(zw - zg, .02 * zg);
    float sharp = clamp(1. - cg / (3.*uDpr), 0., 1.);
    vec2 uv = vec2(xg, zg);
    // flags in courses 0.7 m deep, each course's joints offset, each flag 0.6 to 1.3 m long
    float row = floor(uv.y / .7);
    float rx = uv.x + hash(vec2(row, 3.)) * 3.;
    float cell = 0., x0 = floor(rx / .95);
    float len = .6 + .7 * hash(vec2(x0, row));
    float fxp = fract(rx / .95) * .95;
    vec2 jd = vec2(min(fxp, .95 - fxp), min(fract(uv.y / .7), 1. - fract(uv.y / .7)) * .7);
    vec3 stone = limestone(uv + vec2(x0 * 3.7, row * 5.1), sharp) * (.9 + .16 * hash(vec2(x0, row + 7.)));
    float jpx = min(jd.x, jd.y) / zg / px;
    float joint = 1. - smoothstep(0., .9 + cg, jpx);
    joint = mix(joint, .05, clamp(cg / (.7/zg/px) * 2., 0., 1.));
    stone *= 1. - .30 * joint;
    // the arcade's shadow on the paving in front of the wall, broken by the light between the columns
    float por = smoothstep(11.2, 11.6, zg);
    float gap = smoothstep(.25, .45, abs(fract((xg - (zg - 11.4) * .55) / bay + .5) - .5) * 2.);
    float shadowK = .55 * por * (1. - .7 * gap * smoothstep(13.6, 11.6, zg));
    stone = mix(stone * vec3(1.08, 1.0, .9), stone * vec3(.42, .48, .62), shadowK / .55);
    // the fountain's shadow, cast back and to the left
    vec2 fs = (uv - vec2(uFont.x - .7, uFont.y - .5)) / vec2(uFont.z * 1.15, uFont.z * .9);
    float fsh = 1. - smoothstep(.85, 1.15 + cg/(uFont.z/zg/px), length(fs));
    stone = mix(stone, stone * vec3(.45, .52, .66), fsh * .9);
    // wet stone around the basin: darker, a little sky in it
    float wet = smoothstep(uFont.z + .6, uFont.z + .15, length(uv - uFont.xy));
    stone = mix(stone, stone * .62 + sky2(vec2(d.x, -d.y)) * .08, wet);
    col = mix(col, stone, onG);
    if(onG > .5) z = zg;
    // the fountain: a stone cylinder (rim top y = -1.05), water inside at y = -1.15
    vec2 f = uFont.xy; float r0 = uFont.z, rim = .2;
    float zc = 1e4;
    {
      float a = d.x*d.x + 1., b = -2.*(d.x*f.x + f.y), c = f.x*f.x + f.y*f.y - r0*r0;
      float disc = b*b - 4.*a*c;
      if(disc > 0.){
        float zh = (-b - sqrt(disc)) / (2.*a);
        float yh = -d.y * zh;
        if(yh > -1.6 && yh < -1.05) zc = zh;
      }
    }
    float zt = 1.05 / d.y; vec2 tp = vec2(d.x*zt, zt) - f; float rt = length(tp);
    float zwat = 1.15 / d.y; vec2 wp = vec2(d.x*zwat, zwat) - f; float rw = length(wp);
    float cF = max(coc(f.y), uDpr);
    // the basin's outer face (sunlit from the upper right, the curve darkening to the left)
    float face = zc < 1e3 ? 1. : 0.;
    float nx = face > 0. ? (d.x*zc - f.x) / r0 : 0.;
    vec3 fcol = limestone(vec2(d.x*zc*3., -d.y*zc*3.), clamp(1. - cF/(3.*uDpr), 0., 1.)) * (.55 + .5*smoothstep(-1., .8, nx));
    fcol *= 1. - .35 * smoothstep(-1.2, -1.55, -d.y*zc);
    // the rim's top, bright in the sun, and the water inside it
    float rimTop = soft((r0 - rt)/zt/px, cF) * soft((rt - (r0 - rim))/zt/px, cF);
    float water = soft(((r0 - rim) - rw)/zwat/px, cF);
    vec2 rip = vec2(fbm(wp * 3. + 2.), fbm(wp * 3. + 7.)) - .5;
    float fres = .25 + .6 * pow(1. - clamp(d.y * 3., 0., 1.), 3.);
    vec3 wcol = mix(vec3(.10,.20,.18), sky2(vec2(d.x + rip.x*.04, -d.y*.7 + rip.y*.05)) * .95, fres);
    wcol += vec3(1.,.97,.9) * smoothstep(.62, .78, fbm(wp * 9. + rip * 3.)) * .5 * clamp(1. - cF/(5.*uDpr), .2, 1.);
    float rings = .5 + .5 * sin(rw * 38. - 4.);
    wcol *= .92 + .1 * rings * clamp(1. - cF/(4.*uDpr), 0., 1.);
    vec3 bcol = col;
    if(water > 0. && zwat < zg + .01) { bcol = mix(bcol, wcol, water); if(water > .5) z = zwat; }
    if(rimTop > 0.) { bcol = mix(bcol, limestone(tp * 3., 1.) * 1.12, rimTop); if(rimTop > .5) z = zt; }
    if(face > 0.) { bcol = fcol; z = zc; }
    col = bcol;
    // the column and its bowl in the middle of the basin, the jet falling back into the water
    float zf = f.y; vec2 cpos = vec2(f.x / zf, 0.);
    float cxp = (d.x - cpos.x) / px;
    float colm = bar(cxp, .11 / zf / px, cF) * bar((d.y - (1.15 + .38)*.5/zf)/px, (1.15 - .38)*.5/zf/px, cF);
    vec2 be = vec2(cxp * px * zf / .42, (d.y * zf - .36) / .085);
    float bowl = soft((1. - length(be)) * .42 / zf / px, cF) * step(-.2, be.y) + bar(cxp, (.30 - .18 * clamp((d.y*zf - .36)/.12, 0., 1.)) / zf / px, cF) * bar((d.y - .40/zf)/px, .06/zf/px, cF);
    vec3 ccol = limestone(vec2(d.x*zf*4., d.y*zf*4.), 1.) * (.6 + .5*smoothstep(-.1, .1, cxp / (.11/zf/px)));
    col = mix(col, ccol, max(colm, bowl));
    if(max(colm, bowl) > .5) z = min(z, zf);
    // the jet: a thin rising column of water, then two arcs falling into the bowl and the basin
    float jet = bar(cxp, .016 / zf / px, cF) * bar((d.y + .05/zf)/px, .36/zf/px, cF);
    float arcs = 0.;
    for(int s=0;s<2;s++){
      float sg = s==0 ? -1. : 1.;
      float xx = (d.x - cpos.x) * zf * sg;              // metres out from the axis
      float yy = .30 - 2.2 * xx * xx;                   // a parabola from the top of the jet
      float dd = abs(-d.y * zf - yy) / zf / px;
      arcs = max(arcs, (1. - smoothstep(0., 1.4 + cF, dd)) * step(0., xx) * step(xx, .42));
    }
    col = mix(col, vec3(.92,.96,1.), max(jet, arcs * .7) * .75);
  }
  // the vine across the top-left corner, near the lens: leaves, sun through them
  float zn = 1.3; float cn = max(coc(zn), uDpr);
  vec2 lv = d * 6.;
  float leaves = fbm(lv + vec2(3.1, 1.7)) + .55 * smoothstep(.0, -.9, d.x + d.y * .9) - .5;
  float lm = soft(leaves / (.6 * px * 6.) , cn * 1.0) * smoothstep(.15, -.35, d.x + d.y);
  vec3 leaf = mix(vec3(.04,.08,.03), vec3(.20,.30,.08), smoothstep(.55, .8, fbm(lv * 2.3)));
  col = mix(col, leaf, lm);
  if(lm > .5) z = zn;
  zOut = z; return col;
}

vec3 lights(vec2 p, float zHere, vec3 behind){
  vec3 acc = vec3(0.);
  float star = smoothstep(4., 16., uN);
  vec2 ctr = uRes * .5; float half_ = length(uRes * .5);
  float cat = smoothstep(5.6, 1.4, uN);
  float ex = uScene == 0 ? 1.5 : 1.45;
  // in daylight a disc takes on some of the colour of what it sits on
  vec3 tint = uScene == 0 ? vec3(1.) : mix(vec3(1.), behind / max(.05, max(behind.r, max(behind.g, behind.b))), .35);
  for(int i=0;i<48;i++){
    if(i >= uNL) break;
    vec4 L = uL[i];
    float z = L.z;
    float c = coc(z);
    bool starL = uLC[i].a > 5.; float sz = starL ? uLC[i].a - 10. : uLC[i].a;
    float r = max(c, max(1.1*uDpr, sz / z * uF));
    vec2 q = p - L.xy;
    float reach = r * 1.2 + 40. * uDpr + (starL ? 12. * sqrt(L.w) * uDpr : 0.);
    if(dot(q,q) > reach * reach) continue;
    float vis = smoothstep(z*.02, z*.06, zHere + 0.001);
    vec2 u = q / r;
    vec2 off = (L.xy - ctr) / half_ * .35 * cat;
    float sd = max(length(u) - polar(u), length(u + off) - 1.15);
    float w = 1.2*uDpr / r;
    float body = 1. - smoothstep(-w, w, sd);
    float rim = exp(-max(-sd,0.) / (w*2.5 + .05)) * body;
    float peak = L.w * pow(1.4*uDpr / r, ex);
    vec3 lc = uLC[i].rgb * tint;
    vec3 b = lc * peak * (body * (.74 + .14*vnoise(u*5. + L.xy*.01)) + .30 * rim);
    float s = 0.;
    if(starL){
      float ss = star * smoothstep(7.*uDpr, 1.5*uDpr, c);
      if(ss > 0.){
        for(int k=0;k<9;k++){
          vec2 dir = normalize(uBC[k]);
          float a = dot(q, dir); float bb = dot(q, vec2(-dir.y, dir.x));
          s += exp(-bb*bb/(.4*uDpr*uDpr)) * exp(-abs(a) / (1.7*sqrt(L.w)*uDpr));
        }
        s *= ss * L.w * .22;
      }
    }
    float glow = L.w * .0011 * exp(-length(q) / (30.*uDpr));
    acc += (b + lc * (s + glow)) * vis;
  }
  return acc;
}

void main(){
  vec2 p = vec2(gl_FragCoord.x, (uRes.y * uScale) - gl_FragCoord.y) / uScale;
  // where the blades cover everything, the scene isn't needed
  if(uBake == 0 && sdOpening(p - uC) > 3. * uDpr){ o = vec4(0., 0., 0., 1.); return; }
  float z;
  vec3 sc = uScene == 0 ? pier(p, z) : court(p, z);
  sc = (sc + lights(p, z, sc)) * uGain;
  // the lens's own falloff toward the corners, strongest wide open
  vec2 sv = (p - uC) / length(uRes);
  sc *= 1. - mix(.12, .45, smoothstep(4., 1.4, uN)) * smoothstep(.1, .8, length(sv));
  if(uBake == 0){
    // the guard: under and around the letters the scene is compressed toward the dark (dark themes)
    // or toward the light (light themes), smoothly, so bokeh behind a letter fade instead of being cut
    float g = smoothstep(.04, .55, texture(uMask, vec2(p.x / uRes.x, 1. - p.y / uRes.y)).b);
    g *= smoothstep(uExempt * .80, uExempt * .95, length(p - uC));
    // in display terms: a soft ceiling of 0.36 (dark themes) or a soft floor of 0.60 (light themes)
    vec3 dsp = tone(sc);
    vec3 lim = uDark > .5 ? .5 * (dsp + .36 - sqrt((dsp - .36) * (dsp - .36) + .004)) : .5 * (dsp + .60 + sqrt((dsp - .60) * (dsp - .60) + .004));
    o = vec4(mix(dsp, lim, g), 1.);
    return;
  }
  o = vec4(tone(sc), 1.);
}`

const COMP = COMMON + `
out vec4 o;
uniform sampler2D uScene;
uniform sampler2D uMask;      // r: headline, g: scale
uniform vec3 uInk, uBladeInk;
uniform vec4 uTick;           // the scale's index mark (device px: x, y, w, h)
uniform float uGrain;
uniform int uCheck;           // 1: the picture without the letters, blade weight in alpha
uniform int uBake;
uniform float uIU;            // the iris's detail unit (device px)
vec4 iris(vec2 p){
  vec2 v = p - uC; float U = uIU;
  float dist[9]; float sdOpen = -1e9;
  for(int i=0;i<9;i++){ dist[i] = length(v - uBC[i]) - uRb; sdOpen = max(sdOpen, dist[i]); }
  float r = length(v);
  if(sdOpen < -1.5*uDpr) return vec4(0.);
  int top = 0; float dTop = 1e9; float dOver = 0.;
  for(int i=0;i<9;i++){
    int j = i == 0 ? 8 : i - 1;
    if(dist[i] > 0. && dist[j] <= 0.){ top = i; dTop = dist[i]; dOver = -dist[j]; }
  }
  vec2 bc = uBC[top];
  vec2 nrm = normalize(v - bc);
  vec2 Ld = normalize(vec2(-.62, -.78));
  float ang = atan(bc.y, bc.x);
  float tilt = .5 + .5*cos(ang - 2.25);
  float along = length(v - bc) - uRb;
  vec3 steel = vec3(.0016,.0016,.0018) + vec3(.0060,.0058,.0055) * tilt * (.6 + .4*smoothstep(0., uRb*.9, along));
  steel *= .85 + .15*vnoise(vec2(length(v - bc) / (1.6*U), ang*3.));
  steel += vec3(.0008) * vnoise(v / (40.*U));
  vec2 hl = vec2(-.42, -.55) * uRb;
  steel += vec3(.010,.0095,.009) * exp(-dot(v-hl, v-hl) / (uRb*uRb*.35)) * (.4 + .6*tilt);
  steel *= 1. - .62 * exp(-dOver / (7.*U));
  float bev = exp(-max(dTop,0.) / (1.1*U)) * (.25 + .75*max(dot(-nrm, Ld), 0.));
  steel += vec3(.20,.19,.17) * bev * .22;
  vec2 pp = uPin[top];
  float pd = length(v - pp) - 7.*U * (uRb/(900.*uDpr)+.6);
  float pin = 1. - smoothstep(-1.*U, 1.*U, pd);
  vec3 pinc = vec3(.004,.004,.0045) + vec3(.05) * pow(max(dot(normalize(v-pp+1e-4), -Ld)*.5+.5, 0.), 8.) * (1.-smoothstep(-6.*U,0.,pd));
  steel = mix(steel, pinc, pin);
  float hd = r - uHouse;
  vec3 barrel = vec3(.0012) * (.8 + .4*vnoise(v/(2.*U)));
  barrel += vec3(.006) * smoothstep(.75, 1., abs(fract(r/(14.*U))-.5)*2.) * (.5 + .5*dot(normalize(v), -Ld));
  barrel += vec3(.10,.095,.09) * exp(-abs(hd) / (1.5*U)) * (.4 + .6*max(dot(normalize(v), -Ld),0.));
  vec3 c = mix(steel, barrel, smoothstep(-1.*U, 1.*U, hd));
  float a = smoothstep(-.8*uDpr, .8*uDpr, sdOpen);
  return vec4(c, a);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = vec2(p.x / uRes.x, 1. - p.y / uRes.y);
  vec3 col = texture(uScene, uv).rgb;
  vec4 ir = uBake == 2 ? vec4(0.) : iris(p);
  col = mix(col, tone(ir.rgb), ir.a);
  if(uCheck == 1){ o = vec4(col, ir.a); return; }
  if(uBake == 0){
    vec4 m = texture(uMask, uv);
    float tick = step(abs(p.x - uTick.x - uTick.z * .5), uTick.z * .5) * step(abs(p.y - uTick.y - uTick.w * .5), uTick.w * .5);
    float t = max(max(m.r, m.g), tick);
    col = mix(col, mix(uInk, uBladeInk, ir.a), t);
  }
  col += (hash(gl_FragCoord.xy) - .5) * .045 * uGrain;
  o = vec4(col, 1.);
}`

/* ---------------------------------------------------------------- scenes */

const hex = (h) => {
  const s = h.length === 4 ? h.replace(/[0-9a-f]/gi, '$&$&').slice(1) : h.slice(1)
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
}
const linHex = (h) => hex(h)
const lumOf = (c) => {
  const l = c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
}

/** A seeded random stream, so every machine draws the same lights. */
function seeded(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/** The camera and the point lights of a scene, for the frame's layout (device px). Pure. */
function sceneFor(name, W, H, C) {
  const rnd = seeded(7)
  const L = []
  if (name === 'pier') {
    const F = H
    const VP = [C[0], C[1] + 0.035 * H]
    const add = (x, y, z, I, c, star) => L.push({ x: VP[0] + (x / z) * F, y: VP[1] - (y / z) * F, z, I, c, star })
    const bend = (z) => 0.0016 * z * z
    for (let i = 0; i < 15; i++) {
      const z = 6 + 8 * i
      for (const sx of [-2.3, 2.3]) add(sx + bend(z), 1.98, z, 26 * Math.exp(-z / 80), [1.0, 0.7, 0.4], false)
    }
    add(-0.25 + bend(126), 0.9, 126, 14, [1.0, 0.18, 0.08], false)
    add(0.3 + bend(127), 0.9, 127, 11, [0.25, 1.0, 0.55], false)
    for (let i = 0; i < 10; i++) {
      const x = (rnd() - 0.5) * 2600
      const y = 4 + rnd() * 24
      add(x, y, 1800, 1.5 + Math.pow(rnd(), 2) * 4, rnd() < 0.7 ? [1.0, 0.66, 0.33] : [0.82, 0.9, 1.0], false)
    }
    return { VP, F, Zf: 14, K: 0.05 * H, lights: L, font: [0, 0, 0] }
  }
  // the courtyard: the fountain sits in the iris, the vanishing point above and to the right
  const F = 1.05 * H
  const VP = [C[0] + 0.1 * W, Math.max(0.3 * H, C[1] - 0.3 * H)]
  // the water under the iris is 0.8 m in front of the fountain's centre
  const zw = (1.15 * F) / Math.max(40, C[1] - VP[1])
  const fz = zw + 0.8
  const fx = ((C[0] - VP[0]) / F) * zw
  const font = [fx, fz, 1.35]
  const add = (x, y, z, I, c, star, size = 0.03) => L.push({ x: VP[0] + (x / z) * F, y: VP[1] - (y / z) * F, z, I, c, star, size })
  // sun on the water right under the iris: what the window shows stopped down
  for (let i = 0; i < 3; i++) add(fx + (i - 1) * 0.07 + (rnd() - 0.5) * 0.04, -1.15, zw + (rnd() - 0.5) * 0.12, 10 + rnd() * 6, [1.0, 0.97, 0.9], true, 0.004)
  // sun on the water in the basin (in focus) and on the falling jet
  for (let i = 0; i < 11; i++) {
    const a = rnd() * TAU
    const r = Math.sqrt(rnd()) * 1.05
    add(fx + Math.cos(a) * r, -1.15, fz + Math.sin(a) * r * 0.9, 3 + Math.pow(rnd(), 2) * 9, [1.0, 0.97, 0.88], true, 0.006)
  }
  for (let i = 0; i < 6; i++) {
    const xx = (i % 2 ? 1 : -1) * (0.1 + rnd() * 0.3)
    add(fx + xx, 0.3 - 2.2 * xx * xx, fz, 4 + rnd() * 6, [1, 0.99, 0.95], true, 0.006)
  }
  // sun through the vine at the top left, near the lens: big soft discs wide open
  for (let i = 0; i < 7; i++) {
    const sx = 0.02 + rnd() * 0.3
    const sy = 0.02 + rnd() * 0.24
    L.push({ x: sx * W, y: sy * H, z: 1.3, I: 2 + rnd() * 3.5, c: [1.0, 0.96, 0.78], star: false, size: 0.01 })
  }
  // brass lanterns in the arcade and the glass of the windows above it, far
  for (let k = -6; k <= 6; k++) {
    const x = k * 3.2
    add(x, 0.95, 14, 1.4 + rnd() * 1.2, [1.0, 0.8, 0.5], false)
    if (rnd() < 0.5) add(x + 0.2, 3.1, 14, 0.8 + rnd(), [0.9, 0.95, 1.0], false)
  }
  // wet stone around the basin
  for (let i = 0; i < 5; i++) {
    const a = rnd() * TAU
    add(fx + Math.cos(a) * 1.7, -1.6, fz + Math.sin(a) * 1.4, 1.5 + rnd() * 2, [1, 0.97, 0.9], true, 0.006)
  }
  for (const l of L) l.I *= 0.6
  const keep = L.filter((l) => l.x > -200 && l.x < W + 200 && l.y > -200 && l.y < H + 200)
  return { VP, F, Zf: fz - 0.6, K: 0.045 * H, lights: keep.slice(0, 48), font }
}

/* ---------------------------------------------------------------- the effect */

export default {
  plan,
  evAt,
  fOf,
  evOf,

  async init(c) {
    this.ctx = c
    this.p = c.params
    this.pl = plan(this.p.loop)
    this.bake = /[?&]ap-bake\b/.test(location.search) ? (this.p.scene === 'pier' ? 1 : 2) : 0
    const q = /[?&]ap-quality=(rest|moving)/.exec(location.search)
    this.forceQuality = q ? q[1] : null
    this.sync = /[?&]ap-sync\b/.test(location.search)
    const gl = c.canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: !!c.recording || this.sync || !!this.bake })
    if (!gl) throw new Error('WebGL2 is not available')
    this.gl = gl
    const sh = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s))
      return s
    }
    const prog = (frag) => {
      const pr = gl.createProgram()
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT))
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag))
      gl.bindAttribLocation(pr, 0, 'aPos')
      gl.linkProgram(pr)
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr))
      const U = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (o[k] = gl.getUniformLocation(pr, k))) })
      return { pr, U }
    }
    this.scene = prog(SCENE)
    this.comp = prog(COMP)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    const tex = (filter) => {
      const t = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, t)
      for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
      return t
    }
    this.sceneTex = tex(gl.LINEAR)
    this.maskTex = tex(gl.LINEAR)
    this.polarTex = tex(gl.NEAREST)
    this.fbo = gl.createFramebuffer()
    this.polar = new Float32Array(256)
    this.paint = document.createElement('canvas')
    this.halo = document.createElement('canvas')
    // the pointer turns the ring
    this.live = { mode: 'script', e: null, from: 0, to: 0, t0: 0, target: null, rest: -1e9, ptr: null }
    c.root.addEventListener('pointermove', (e) => {
      const r = c.root.getBoundingClientRect()
      this.live.ptr = { x: e.clientX - r.left, y: e.clientY - r.top }
      this.live.rest = performance.now()
    })
    c.root.addEventListener('pointerleave', () => (this.live.ptr = null))
    window.__apertureHolds = this.pl.holds
    window.__apertureCheck = () => this.check()
    // timing (?ap-sync): draw the given loop times at a quality, each followed by a GPU sync, and report the times
    if (this.sync)
      window.__apertureBench = (times, quality) =>
        times.map((t) => {
          const t0 = performance.now()
          this.draw(evAt(this.pl, t), quality)
          return performance.now() - t0
        })
  },

  resize(view) {
    this.view = view
    const gl = this.gl
    const dpr = view.dpr
    const W = Math.max(1, Math.round(view.width * dpr))
    const H = Math.max(1, Math.round(view.height * dpr))
    this.W = W
    this.H = H
    this.ctx.canvas.width = W
    this.ctx.canvas.height = H
    this.layout()
    this.drawMask()
    this.refineCounter()
    // baking the still: the pier's iris in the middle of the frame
    if (this.bake === 1) this.C = [W / 2, H * 0.5]
    this.sc = sceneFor(this.p.scene, W, H, this.C)
    this.last = null
  },

  /** Finds the O, sizes the iris from its counter, and lays out the scale. */
  layout() {
    const view = this.view
    const v = view
    const dpr = view.dpr
    const type = view.type
    const g = document.createElement('canvas').getContext('2d')
    // the O: in effect.word, else the one nearest the middle of the headline
    let best = null
    const mid = { x: type.box.x + type.box.w / 2, y: type.box.y + type.box.h / 2 }
    const want = (this.p.word || '').trim().toLowerCase()
    for (const line of type.lines)
      for (const part of line.parts) {
        const i = part.text.search(/[Oo]/)
        if (i < 0) continue
        if (want && part.text.replace(/[^\p{L}]/gu, '').toLowerCase() !== want.replace(/[^\p{L}]/gu, '')) continue
        g.font = type.font(part.italic)
        if ('letterSpacing' in g) g.letterSpacing = `${type.letterSpacing}px`
        const x0 = part.x + g.measureText(part.text.slice(0, i)).width
        const cand = { x0, base: line.baseline, letter: part.text[i], font: type.font(part.italic) }
        const cx = x0 + g.measureText(cand.letter).width / 2
        const d = Math.hypot(cx - mid.x, line.baseline - type.size * 0.35 - mid.y)
        if (!best || d < best.d) best = { ...cand, d }
      }
    let cx, cy, cw
    if (best) {
      // the counter: scan the glyph at a large size for its hole
      const t = document.createElement('canvas')
      t.width = 900
      t.height = 800
      const tc = t.getContext('2d')
      const big = best.font.replace(/[\d.]+px/, '500px')
      tc.font = big
      tc.fillStyle = '#000'
      tc.fillText(best.letter, 100, 600)
      const mm = tc.measureText(best.letter)
      const yMid = Math.round(600 - (mm.actualBoundingBoxAscent - mm.actualBoundingBoxDescent) / 2)
      const row = tc.getImageData(0, yMid, 900, 1).data
      const ed = []
      for (let i = 1; i < 900; i++) if (row[i * 4 + 3] > 127 !== row[(i - 1) * 4 + 3] > 127) ed.push(i)
      const k = type.size / 500
      if (ed.length >= 4) {
        const xm = Math.round((ed[1] + ed[2]) / 2)
        const cd = tc.getImageData(xm, 0, 1, 800).data
        const col = []
        for (let j = 1; j < 800; j++) if (cd[j * 4 + 3] > 127 !== cd[(j - 1) * 4 + 3] > 127) col.push(j)
        cx = best.x0 + (xm - 100) * k
        cy = col.length >= 4 ? best.base + ((col[1] + col[2]) / 2 - 600) * k : best.base - type.size * 0.35
        cw = Math.min(ed[2] - ed[1], col.length >= 4 ? col[2] - col[1] : 1e9) * k
      }
    }
    if (!cw) {
      cx = mid.x
      cy = mid.y
      cw = type.size * 0.4
    }
    this.counter = { x: cx, y: cy, w: cw }
    this.C = [cx * dpr, cy * dpr]
    this.a22 = 0.38 * cw * dpr
    const amax = (this.a22 * 22) / 1.2
    this.amax = amax
    this.Rb = 1.25 * amax
    this.Rpin = 1.25 * amax
    this.Lp = 1.05 * amax
    this.house = 2.2 * amax
    this.scaleLayout()
  },

  /** Where the aperture ring's scale is printed, in its own place. */
  scaleLayout() {
    const v = this.view
    const widest = Number(this.p.widest)
    const stops = STOPS.filter((s) => s >= widest)
    const plates = v.plates.filter((pl) => pl.y > v.bar.y + v.bar.h + 1)
    const copy = plates.length ? plates[plates.length - 1] : null
    const top = v.bar.y + v.bar.h
    let s
    if (v.composition === 'lockup' && !v.mobile) {
      // a column at the right edge, like the ring seen edge-on
      const y0 = top + 82
      const y1 = (copy ? copy.y : v.height) - 70
      s = { dir: 'col', x: v.width - 52, y0, step: (y1 - y0) / (stops.length - 1), size: 14 }
    } else if (v.composition === 'editorial' && !v.mobile && copy) {
      // a row over the copy column, clear of it
      const x0 = copy.x + 44
      s = { dir: 'row', x0, y: copy.y - 30, step: (copy.w - 58) / (stops.length - 1), size: 14 }
    } else if (v.composition === 'editorial') {
      s = { dir: 'row', x0: 62, y: top + 40 + 16, step: (v.width - 80) / (stops.length - 1), size: 16 }
    } else {
      s = { dir: 'row', x0: 62, y: v.height - 24, step: (v.width - 80) / (stops.length - 1), size: 15 }
    }
    s.stops = stops
    this.scaleAt = s
  },

  /** The letters (r), the scale (g) and the guard around both (b), at device resolution. */
  drawMask() {
    const v = this.view
    const type = v.type
    const dpr = v.dpr
    const cv = this.paint
    cv.width = this.W
    cv.height = this.H
    const g = cv.getContext('2d')
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = '#000'
    g.fillRect(0, 0, this.W, this.H)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.textBaseline = 'alphabetic'
    g.globalCompositeOperation = 'lighter'
    const letters = (fill, stroke) => {
      if ('letterSpacing' in g) g.letterSpacing = `${type.letterSpacing}px`
      for (const line of type.lines)
        for (const part of line.parts) {
          g.font = type.font(part.italic)
          if (stroke) g.strokeText(part.text, part.x, line.baseline)
          g.fillText(part.text, part.x, line.baseline)
        }
      if ('letterSpacing' in g) g.letterSpacing = '0px'
    }
    const scale = (fill) => {
      if (!this.p.scale || this.bake) return
      const s = this.scaleAt
      const fam = getComputedStyle(this.ctx.root).fontFamily
      g.font = `500 ${s.size}px ${fam}`
      if ('letterSpacing' in g) g.letterSpacing = '0.04em'
      g.textAlign = s.dir === 'col' ? 'right' : 'center'
      g.textBaseline = s.dir === 'col' ? 'middle' : 'alphabetic'
      s.stops.forEach((n, i) => {
        const x = s.dir === 'col' ? s.x : s.x0 + i * s.step
        const y = s.dir === 'col' ? s.y0 + i * s.step : s.y
        g.fillText(String(n), x, y)
      })
      g.textAlign = 'right'
      const fx = s.dir === 'col' ? s.x : s.x0 - 26
      const fy = s.dir === 'col' ? s.y0 - 38 : s.y
      g.fillText('f /', fx, fy)
      // third-stop ticks
      for (let i = 0; i < (s.stops.length - 1) * 3 + 1; i++) {
        const k = i / 3
        if (s.dir === 'col') g.fillRect(s.x + 12, s.y0 + k * s.step - 0.5, i % 3 ? 3 : 6, 1)
        else g.fillRect(s.x0 + k * s.step - 0.5, s.y - s.size - 12, 1, i % 3 ? 3 : 6)
      }
      g.textAlign = 'left'
      g.textBaseline = 'alphabetic'
      if ('letterSpacing' in g) g.letterSpacing = '0px'
    }
    if (!this.bake) {
      g.fillStyle = '#f00'
      letters()
      g.fillStyle = '#0f0'
      scale()
    }
    // the guard: the same marks, dilated and blurred, in blue
    const h = this.halo
    h.width = this.W
    h.height = this.H
    const hg = h.getContext('2d')
    hg.setTransform(1, 0, 0, 1, 0, 0)
    hg.fillStyle = '#000'
    hg.fillRect(0, 0, this.W, this.H)
    hg.setTransform(dpr, 0, 0, dpr, 0, 0)
    hg.filter = `blur(${type.size * 0.2}px)`
    hg.fillStyle = '#00f'
    hg.strokeStyle = '#00f'
    hg.lineJoin = 'round'
    hg.lineWidth = type.size * 0.16
    if (!this.bake) {
      if ('letterSpacing' in hg) hg.letterSpacing = `${type.letterSpacing}px`
      for (const line of type.lines)
        for (const part of line.parts) {
          hg.font = type.font(part.italic)
          hg.strokeText(part.text, part.x, line.baseline)
          hg.fillText(part.text, part.x, line.baseline)
        }
      if ('letterSpacing' in hg) hg.letterSpacing = '0px'
      if (this.p.scale) {
        hg.filter = 'blur(6px)'
        const s = this.scaleAt
        if (s.dir === 'col') hg.fillRect(s.x - 46, s.y0 - 56, 70, s.step * (s.stops.length - 1) + 74)
        else hg.fillRect(s.x0 - s.step - 10, s.y - s.size - 22, s.step * s.stops.length + 22, s.size + 32)
      }
    }
    hg.filter = 'none'
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalCompositeOperation = 'lighter'
    g.drawImage(h, 0, 0)
    g.globalCompositeOperation = 'source-over'
    this.maskData = this.ctx.recording ? g.getImageData(0, 0, this.W, this.H).data : null
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  },

  /** The counter as actually drawn: the hole around the estimate in the letters' mask (device px). */
  refineCounter() {
    const W = this.W
    const H = this.H
    const g = this.paint.getContext('2d')
    const [cx, cy] = this.C.map(Math.round)
    const R = Math.round(this.counter.w * this.view.dpr)
    const x0 = Math.max(0, cx - R)
    const y0 = Math.max(0, cy - R)
    const w = Math.min(W - x0, 2 * R + 1)
    const h = Math.min(H - y0, 2 * R + 1)
    if (w < 3 || h < 3) return
    const d = g.getImageData(x0, y0, w, h).data
    const ink = (x, y) => d[((y - y0) * w + (x - x0)) * 4] > 127
    const walk = (dx, dy) => {
      let x = cx
      let y = cy
      for (let i = 0; i < R; i++) {
        if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return null
        if (ink(x, y)) return i
        x += dx
        y += dy
      }
      return null
    }
    if (ink(cx, cy)) return
    const l = walk(-1, 0)
    const r = walk(1, 0)
    const t = walk(0, -1)
    const b = walk(0, 1)
    if ([l, r, t, b].some((v) => v === null)) return
    this.C = [cx + (r - l) / 2, cy + (b - t) / 2]
    this.counter.w = Math.min(l + r, t + b) / this.view.dpr
    this.counter.x = this.C[0] / this.view.dpr
    this.counter.y = this.C[1] / this.view.dpr
    this.a22 = 0.38 * this.counter.w * this.view.dpr
    const amax = (this.a22 * 22) / 1.2
    this.amax = amax
    this.Rb = 1.25 * amax
    this.Rpin = 1.25 * amax
    this.Lp = 1.05 * amax
    this.house = 2.2 * amax
  },

  /** The blades for an opening of inscribed radius a (closed form), and the opening's outline by angle. */
  blades(a) {
    const { Rb, Rpin, Lp } = this
    const c = Rb - a
    const beta = Math.acos(Math.max(-1, Math.min(1, (c * c - Rpin * Rpin - Lp * Lp) / (2 * Rpin * Lp))))
    const bc = new Float32Array(18)
    const pin = new Float32Array(18)
    for (let i = 0; i < 9; i++) {
      const ph = (i / 9) * TAU + 0.31
      const px = Rpin * Math.cos(ph)
      const py = Rpin * Math.sin(ph)
      pin[2 * i] = px
      pin[2 * i + 1] = py
      bc[2 * i] = px + Lp * Math.cos(ph + beta)
      bc[2 * i + 1] = py + Lp * Math.sin(ph + beta)
    }
    // the outline: along each direction, the nearest edge circle's boundary (units of a)
    for (let k = 0; k < 256; k++) {
      const th = ((k + 0.5) / 256 - 0.5) * TAU
      const ux = Math.cos(th)
      const uy = Math.sin(th)
      let r = 1e9
      for (let i = 0; i < 9; i++) {
        const cx = bc[2 * i]
        const cy = bc[2 * i + 1]
        const b = ux * cx + uy * cy
        const disc = b * b - (cx * cx + cy * cy - Rb * Rb)
        if (disc > 0) r = Math.min(r, b + Math.sqrt(disc))
      }
      this.polar[k] = r / a
    }
    return { bc, pin }
  },

  /** The aperture now: the loop, or the ring under the pointer (live). */
  aperture(t, state) {
    const scripted = evAt(this.pl, t)
    const live = !this.ctx.recording && !state.still && this.p.follow
    if (!live) return scripted
    const L = this.live
    const now = performance.now() / 1000
    const v = this.view
    const eMin = evOf(Number(this.p.widest))
    const pointing = L.ptr && performance.now() - L.rest < 2500
    if (L.e === null) L.e = scripted
    let target
    if (pointing) {
      const k = Math.min(1, Math.max(0, (L.ptr.x - v.width * 0.08) / (v.width * 0.84)))
      target = Math.round(eMin + (8 - eMin) * k)
      target = Math.max(eMin, Math.min(8, target))
      L.mode = 'pointer'
    } else if (L.mode !== 'script') {
      target = scripted
      if (Math.abs(L.e - scripted) < 1e-3 && L.to === L.from) L.mode = 'script'
    }
    if (L.mode === 'script') {
      L.e = scripted
      L.from = L.to = scripted
      return scripted
    }
    // the ring clicks one stop at a time toward the target
    const u = now - L.t0
    if (u >= CLICK || L.from === L.to) {
      L.e = L.to
      if (Math.abs(target - L.e) > 1e-3) {
        L.from = L.e
        const step = target > L.e ? Math.min(target, Math.floor(L.e + 1e-6) + 1) : Math.max(target, Math.ceil(L.e - 1e-6) - 1)
        L.to = step
        L.t0 = now
      } else L.from = L.to
    }
    const x = L.from === L.to ? 1 : clickEase((now - L.t0) / MOVE)
    L.e = L.from + (L.to - L.from) * x
    return L.e
  },

  seek(t, state) {
    const v = this.view
    if (!v) return
    const e = this.bake === 1 ? evOf(2.8) : this.aperture(t, state)
    const moving = this.last !== null && Math.abs(e - this.last.e) > 1e-5
    let quality = this.ctx.recording || state.still || this.bake ? 'rest' : moving ? 'moving' : 'rest'
    if (this.forceQuality) quality = this.forceQuality
    if (this.last && this.last.e === e && this.last.quality === 'rest' && quality === 'rest' && !this.forceQuality) return
    this.last = { e, quality }
    this.draw(e, quality)
  },

  draw(e, quality, check) {
    const gl = this.gl
    const v = this.view
    const p = this.p
    const N = fOf(e)
    const a = (this.a22 * 22) / N
    const { bc, pin } = this.blades(a)
    const W = this.W
    const H = this.H
    // the scene pass: full resolution at rest, a fixed budget while moving
    const budget = v.mobile ? 0.5e6 : 1.1e6
    const s = quality === 'rest' ? 1 : Math.min(1, Math.sqrt(budget / (W * H)))
    const sw = Math.max(1, Math.round(W * s))
    const shh = Math.max(1, Math.round(H * s))
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex)
    if (this.sceneSize !== sw + 'x' + shh) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, shh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      this.sceneSize = sw + 'x' + shh
    }
    gl.bindTexture(gl.TEXTURE_2D, this.polarTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 256, 1, 0, gl.RED, gl.FLOAT, this.polar)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0)
    gl.viewport(0, 0, sw, shh)
    const S = this.scene
    gl.useProgram(S.pr)
    const iris = (U) => {
      gl.uniform2f(U.uRes, W, H)
      gl.uniform1f(U.uDpr, v.dpr)
      gl.uniform2f(U.uC, this.C[0], this.C[1])
      gl.uniform1f(U.uA, a)
      gl.uniform1f(U.uRb, this.Rb)
      gl.uniform2fv(U.uBC, bc)
      gl.uniform2fv(U.uPin, pin)
      gl.uniform1f(U.uHouse, this.house)
      gl.uniform1f(U.uN, N)
    }
    iris(S.U)
    const sc = this.sc
    gl.uniform1f(S.U.uScale, sw / W)
    gl.uniform1i(S.U.uScene, p.scene === 'pier' ? 0 : 1)
    gl.uniform2f(S.U.uVP, sc.VP[0], sc.VP[1])
    gl.uniform1f(S.U.uF, sc.F)
    gl.uniform1f(S.U.uZf, sc.Zf)
    gl.uniform1f(S.U.uK, sc.K)
    gl.uniform3f(S.U.uFont, sc.font[0], sc.font[1], sc.font[2])
    // exposure: it grows as the iris opens (about 3 stops from f/22 to f/1.4 on the pier, 2 in the court)
    const A = 1.4 / N
    const gain = p.exposure * (p.scene === 'pier' ? 2.3 * Math.pow(A, 0.8) : 1.0 * Math.pow(A, 0.45))
    gl.uniform1f(S.U.uGain, gain)
    const Ls = sc.lights
    const L4 = new Float32Array(48 * 4)
    const C4 = new Float32Array(48 * 4)
    // the 12 brightest lights carry diffraction spikes
    const bright = [...Ls].sort((x, y) => y.I - x.I).slice(0, 12)
    Ls.forEach((l, i) => {
      L4.set([l.x, l.y, l.z, l.I], i * 4)
      C4.set([...l.c, (l.size ?? 0.07) + (bright.includes(l) && (l.star !== false || p.scene === 'pier') ? 10 : 0)], i * 4)
    })
    gl.uniform4fv(S.U.uL, L4)
    gl.uniform4fv(S.U.uLC, C4)
    gl.uniform1i(S.U.uNL, Ls.length)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.polarTex)
    gl.uniform1i(S.U.uPolar, 1)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex)
    gl.uniform1i(S.U.uMask, 2)
    gl.uniform1f(S.U.uDark, this.ctx.theme.mode === 'dark' ? 1 : 0)
    gl.uniform1f(S.U.uExempt, (this.counter.w * v.dpr) / 2)
    gl.uniform1i(S.U.uBake, this.bake ? 1 : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    // the composite: the iris, the letters, the scale, the grain
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, W, H)
    const Cp = this.comp
    gl.useProgram(Cp.pr)
    iris(Cp.U)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex)
    gl.uniform1i(Cp.U.uScene, 0)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex)
    gl.uniform1i(Cp.U.uMask, 2)
    gl.uniform3fv(Cp.U.uInk, linHex(this.ctx.theme.ink))
    gl.uniform3fv(Cp.U.uBladeInk, linHex(p.bladeInk))
    gl.uniform1f(Cp.U.uGrain, p.grain)
    gl.uniform1i(Cp.U.uCheck, check ? 1 : 0)
    gl.uniform1i(Cp.U.uBake, this.bake)
    gl.uniform1f(Cp.U.uIU, v.dpr)
    // the scale's index mark, beside the stop in use (between stops while the ring moves)
    const s2 = this.scaleAt
    if (p.scale && !this.bake) {
      const pos = s2.stops.map(evOf)
      let k = 0
      while (k < pos.length - 2 && e > pos[k + 1]) k++
      const f = Math.max(0, Math.min(1, (e - pos[k]) / (pos[k + 1] - pos[k])))
      const at = k + f
      const d = v.dpr
      if (s2.dir === 'col') gl.uniform4f(Cp.U.uTick, (s2.x + 10) * d, (s2.y0 + at * s2.step - 0.9) * d, 16 * d, 1.8 * d)
      else gl.uniform4f(Cp.U.uTick, (s2.x0 + at * s2.step - 0.9) * d, (s2.y - s2.size - 20) * d, 1.8 * d, 13 * d)
    } else gl.uniform4f(Cp.U.uTick, -10, -10, 0, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    if (this.sync) {
      const px = new Uint8Array(4)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    }
    this.lastE = e
  },

  /**
   * The legibility check on the frame drawn last: the picture without the
   * letters, under every pixel of the headline and the scale, against the
   * colour each letter is drawn in there. Recordings only.
   */
  check() {
    const gl = this.gl
    const W = this.W
    const H = this.H
    if (!this.maskData) return null
    this.draw(this.lastE, 'rest', true)
    const px = new Uint8Array(W * H * 4)
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
    this.draw(this.lastE, 'rest')
    const lin = (x) => {
      x /= 255
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
    }
    const inkA = hex(this.ctx.theme.ink)
    const inkB = hex(this.p.bladeInk)
    const md = this.maskData
    let worst = 1e9
    let at = null
    let n = 0
    let edge = 0
    const all = []
    for (let y = 0; y < H; y += 2)
      for (let x = 0; x < W; x += 2) {
        const mi = (y * W + x) * 4
        if (md[mi] < 128 && md[mi + 1] < 128) continue
        const k = ((H - 1 - y) * W + x) * 4
        const bl = 0.2126 * lin(px[k]) + 0.7152 * lin(px[k + 1]) + 0.0722 * lin(px[k + 2])
        const w = px[k + 3] / 255
        // the one-pixel antialiased band where the iris's edge crosses a letter is counted apart
        if (w > 0.08 && w < 0.92) {
          edge++
          continue
        }
        const ink = inkA.map((c, i) => c + (inkB[i] - c) * w)
        const il = lumOf(ink)
        const r = (Math.max(il, bl) + 0.05) / (Math.min(il, bl) + 0.05)
        all.push(r)
        n++
        if (r < worst) {
          worst = r
          at = { x: Math.round(x / this.view.dpr), y: Math.round(y / this.view.dpr) }
        }
      }
    all.sort((x, y) => x - y)
    return { n, edge, min: +worst.toFixed(2), p01: +(all[Math.floor(all.length * 0.01)] || 0).toFixed(2), at, f: +fOf(this.lastE).toFixed(2) }
  },
}
