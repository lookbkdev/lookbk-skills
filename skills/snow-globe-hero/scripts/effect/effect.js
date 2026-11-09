// Snow Globe (browser), Motion Heroes kit v2, editorial composition. Raw
// WebGL1, no libraries.
//
// One still-life photograph that moves. A glass snow globe on a turned base
// stands on a stone plinth by a side window; the headline is cut into the
// plinth's front face (a V-cut filled with paint, built from the kit's own
// measurements of the headline, view.type) and lit by the same sun that
// throws the globe's shadow, its caustic and the window bars across the room.
//
// The set is solved from the layout: the plinth's front face is the z = 0
// plane, mapped 1:1 to the page, so the cut letters sit exactly on the real
// h1; the camera height, the ledge's depth and the globe's size come from
// the headline's and the bar's positions.
//
// Passes:
//   room    once per size: wall, ledge and face (with the inscription and the
//           brass label frame), as two textures: the fill light and the sun
//           (the globe's and the base's shadows are applied per frame).
//   object  once per size: the globe and the base, fully ray traced (thick
//           glass, Fresnel, dispersion, total internal reflection, the
//           miniature ray marched inside), into a colour texture and a depth
//           texture (how far each liquid ray gets before it meets the scene).
//   height  once: the miniature seen from above, read back as a height map so
//           the flakes can land on roofs, branches and the mound.
//   frame   every frame: the room with the analytic shadow and caustic of the
//           object where the shake has moved it, the cached object, the air
//           cap and its meniscus (the liquid's surface sloshes), and on the
//           polished stone the reflection of the object; then the flakes.
//
// Flakes: a particle system in the globe's own units (drag, a vortex that
// spins down, curl, flutter, landing on the height map), integrated once at
// a fixed step for one whole loop and steered home in the late settle, so
// frame T is frame 0. Each frame every flake is put on screen through the
// glass by solving the refraction for the pixel whose ray passes through it,
// then drawn as a flat irregular flake that tumbles and glints, stretched
// along its motion and blurred when it is near the glass.

const TAU = Math.PI * 2
const hex = (h) => {
  const s = h.length === 4 ? h.replace(/[0-9a-f]/gi, '$&$&').slice(1) : h.slice(1)
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
}
const lin = (h) => hex(h).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// ---------------------------------------------------------------- shaders
const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`

const HEAD = `precision highp float;
uniform vec2 uView; uniform float uDpr; uniform vec2 uOrg;
uniform vec3 uCam; uniform float uF; uniform float uDepth; uniform float uWallZ;
uniform vec3 uG; uniform float uR; uniform vec3 uBase;
uniform vec3 uL; uniform float uWinX; uniform vec4 uWin; uniform vec2 uMul;
uniform vec3 uWall, uStone, uTop, uPaint, uSun, uAmb, uWood, uBrass, uTint, uSnow;
uniform float uEx, uTyaw, uLip, uPolish, uScene;
uniform vec4 uCopy;
#define PI 3.14159265
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s; }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
`

// the room: window, shadows, caustic, environment, the analytic background
const ROOM = `
float winMask(vec3 P){
  // the window the key comes through: project P along the light onto the plane x = uWinX
  float sd = (uWinX - P.x) / uL.x; if (sd < 0.) return 0.;
  vec3 Q = P + uL * sd; float pen = 4. + sd * .022;
  float m = smoothstep(uWin.x - pen, uWin.x + pen, Q.y) * smoothstep(uWin.y + pen, uWin.y - pen, Q.y)
          * smoothstep(uWin.z - pen, uWin.z + pen, Q.z) * smoothstep(uWin.w + pen, uWin.w - pen, Q.z);
  float bar = 9. + pen * .6;
  m *= smoothstep(bar*.5, bar*.5 + pen, abs(Q.z - uMul.x)) * smoothstep(bar*.5, bar*.5 + pen, abs(Q.y - uMul.y));
  return m;
}
// the glass ball between P and the light: a pale shadow with a darker rim, and the focused light inside it
float sphereShadow(vec3 P, vec3 G, out vec3 caus){
  vec3 v = G - P; float b = dot(v, uL); caus = vec3(0.);
  if (b < 0.) return 1.;
  float d = length(v - uL * b);
  float pen = uR * (.06 + .10 * b / uR);
  float occ = smoothstep(uR + pen, uR - pen, d);
  float rim = smoothstep(uR * .55, uR * .98, d) * occ;
  float f = 1.95 * uR;
  vec3 fo = vec3(1.025, 1., .975) * f;
  for (int k = 0; k < 3; k++){
    float w = uR * (abs(1. - b / fo[k]) * .50) + uR * .05;
    caus[k] = min(uR * uR / (w * w) * .10, 3.6) * exp(-(d * d) / (w * w)) + .35 * occ * exp(-(d * d) / (uR * uR * .25));
  }
  return 1. - occ * (.50 + .42 * rim);
}
float baseShadow(vec3 P, vec3 G){
  float m = 1e9;
  for (int i = 0; i < 4; i++){
    float y = uF + uBase.z * (float(i) + .5) / 4.; float s = (y - P.y) / uL.y; if (s < 0.) continue;
    vec2 q = P.xz + uL.xz * s - G.xz; m = min(m, length(q) - mix(uBase.x, uBase.y, (float(i) + .5) / 4.));
  }
  float pen = 6. + .08 * (P.y < uF + 1. ? length(P.xz - G.xz) : 0.);
  return smoothstep(-pen, pen, m);
}
vec3 env(vec3 rd){
  // the room in front of the object, behind the camera: dim, and the window
  vec3 c = mix(uAmb * .22, uAmb * .5, smoothstep(-.4, .7, rd.y));
  if (uScene > .5) c = mix(uAmb * .9, uAmb * 2.2, smoothstep(-.4, .8, rd.y));
  if (uScene < .5){
    vec3 w = normalize(uL + vec3(0., .1, .25));
    vec3 ax = normalize(cross(vec3(0, 1, 0), w)); vec3 ay = cross(w, ax);
    float d = dot(rd, w);
    if (d > 0.){ vec2 uv = vec2(dot(rd, ax), dot(rd, ay)) / d;
      float bx = smoothstep(.42, .38, abs(uv.x)) * smoothstep(.62, .57, abs(uv.y));
      float mul = smoothstep(.012, .022, abs(uv.x + .02)) * smoothstep(.012, .022, abs(uv.y - .14));
      c += bx * mul * uSun * 4.0; }
  } else {
    // the dome's slit: one tall cool band
    float ds = dot(rd, uL);
    if (ds > 0.){ vec3 bx2 = normalize(cross(vec3(0, 1, 0), uL)); float u = dot(rd, bx2) / ds; float v = dot(rd, cross(uL, bx2)) / ds;
      c += smoothstep(.06, .045, abs(u)) * smoothstep(.9, .7, abs(v)) * uSun * 4.5 + exp(-u * u * 30.) * uSun * .25; }
    // and the warm strip light under the ledge, low and in front
    c += vec3(1., .72, .42) * uLip * .5 * smoothstep(.2, -.2, rd.y) * smoothstep(-.6, .4, rd.z);
  }
  return c;
}
// the fill and the sun on a surface (the sun without the object's shadows)
void light2(vec3 P, vec3 N, vec3 alb, float ao, out vec3 fill, out vec3 sun){
  float dif = max(dot(N, uL), 0.);
  sun = alb * uSun * dif * winMask(P);
  fill = alb * uAmb * ao * (.34 + .16 * N.y + .22 * max(N.z, 0.));
}
vec3 litFull(vec3 P, vec3 N, vec3 alb, float ao){
  vec3 f, s; light2(P, N, alb, ao, f, s); vec3 cc;
  float sh = sphereShadow(P, uG, cc) * baseShadow(P, uG);
  return f + s * sh + s * cc * .85;
}
vec3 wallPool(vec3 P){ if (uScene < .5) return vec3(0.); vec2 q = (P.xy - vec2(uG.x, uG.y - uR * .3)) / vec2(uR * 2.6, uR * 2.0); return uSun * .02 * exp(-dot(q, q)); }
vec3 wallAlb(vec3 P){ float tex = fbm(P.xy * .012) * .55 + fbm(P.xy * .09) * .3 + fbm(P.xy * .6) * .15; return uWall * (.93 + .12 * tex); }
vec3 topAlb(vec3 P){ float tex = fbm(P.xz * vec2(.05, .12)) * .6 + fbm(P.xz * .4) * .4; return uTop * (.95 + .08 * tex); }
vec3 stoneAlb(vec2 p){ float tex = fbm(p * .045) * .6 + fbm(p * .3) * .4; vec3 a = uStone * (.94 + .1 * tex);
  if (uScene > .5){ float g = h21(floor(p * .9)); a = uStone * (.78 + .28 * tex + .35 * step(.86, g) + .12 * vnoise(p * .08)); return a; }
  return a * (1. - .15 * smoothstep(.82, .95, vnoise(p * .55))); }
float topAO(vec3 P, vec3 G){ float ao = 1. - .18 * exp(-(P.z + uDepth) / 60.); float rb = length(P.xz - G.xz) - uBase.x; return ao * (1. - .45 * exp(-max(rb, 0.) / 14.)); }
`

// the object: the turned base and the globe with the miniature
const SCENE = `
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float sdRBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.) - r; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - r; }
float sdCone(vec3 p, float h, float r1, float r2){
  vec2 q = vec2(length(p.xz), p.y); vec2 k1 = vec2(r2, h); vec2 k2 = vec2(r2 - r1, 2. * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0., 1.);
  float s = (cb.x < 0. && ca.y < 0.) ? -1. : 1.; return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
// one tier of a fir: a cone whose rim is cut into drooping branch tips
float tier(vec3 q, float h, float r){
  float a = atan(q.z, q.x);
  float y = clamp(q.y / h, 0., 1.);
  float rr = r * (1. - y) * (1. + .11 * sin(a * 11. + h * 40.) * (1. - y));
  float d = (length(q.xz) - rr) * .64;
  float droop = .28 * h * smoothstep(.45, 1., length(q.xz) / max(r, 1e-3));
  return max(d, max(-(q.y + droop), q.y - h));
}
const float GY = -.40;
const float SC = 1.5;
vec3 toS(vec3 p){ return (p - vec3(0, GY, 0)) / SC + vec3(0, GY, 0); }
float ground(vec3 p){
  float r = length(p.xz);
  float groove = 0.;
  if (uScene < .5){ vec2 a = vec2(-.13, .10) * SC, b = vec2(.12, .21) * SC; vec2 pa = p.xz - a, ba = b - a; float hh = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); groove = .012 * smoothstep(.05, 0., length(pa - ba * hh)); }
  float clumps = .03 * vn3(p * 5.) + .014 * vn3(p * 13.) + .006 * vn3(p * 37.);
  return (p.y - (GY + .05 * exp(-r * r * 4.) + clumps - .35 * max(0., r - .45) * max(0., r - .45) - groove)) * .7;
}
vec2 mapS(vec3 p0){
  vec2 m = vec2(ground(p0) / SC, 1.);
  vec3 p = toS(p0);
  if (uScene < .5){
    // the cafe: a rounded plaster box with a pitched roof, a deep snow cap, a chimney, recessed door and windows
    vec3 c = p - vec3(-.13, GY, -.04);
    float body = sdRBox(c - vec3(0, .105, 0), vec3(.15, .105, .105), .014);
    body = max(body, -sdRBox(c - vec3(0, .052, .108), vec3(.026, .056, .014), .005));
    vec3 wq = c - vec3(0, .0975, .108); wq.x = abs(wq.x) - .0675;
    body = max(body, -sdRBox(wq, vec3(.032, .037, .010), .004));
    vec3 sq = c - vec3(.152, .10, 0); body = max(body, -sdRBox(sq, vec3(.012, .03, .028), .004));
    vec3 r = c - vec3(0, .205, 0);
    float roof = max(max(abs(r.x) * .643 + r.y * .766 - .118, -r.y), abs(r.z) - .128) - .006;
    float th = .014 + .012 * vn3(c * 34.) + .006 * max(0., sin(r.z * 70.));
    float cap = max(max(abs(r.x) * .643 + r.y * .766 - (.118 + th), -(r.y - .022 + .01 * vn3(c * 50.))), abs(r.z) - .136) - .005;
    float chim = sdRBox(c - vec3(.075, .31, -.04), vec3(.022, .06, .022), .006);
    float chimSnow = length((c - vec3(.075, .372, -.04)) * vec3(1., 2.2, 1.)) - .028;
    float sill = sdRBox(wq - vec3(0., -.043, .012), vec3(.038, .005, .012), .003);
    float sillSnow = length((wq - vec3(0., -.034, .014)) * vec3(.9, 2.6, 1.4)) - .028;
    if (body < m.x) m = vec2(body, 2.);
    if (roof < m.x) m = vec2(roof, 3.);
    if (chim < m.x) m = vec2(chim, 3.);
    if (sill < m.x) m = vec2(sill, 2.5);
    float snw = min(min(cap, chimSnow), sillSnow);
    if (snw < m.x) m = vec2(snw, 1.2);
    // the window panes (lit from inside)
    float pane = sdRBox(wq - vec3(0, 0, -.004), vec3(.031, .036, .002), .001);
    if (pane < m.x) m = vec2(pane, 15.);
    // two firs, three tiers each
    vec3 t = p - vec3(.27, GY, -.20);
    float tr = smin(smin(smin(tier(t - vec3(0, .06, 0), .11, .135), tier(t - vec3(0, .135, 0), .10, .11), .015), tier(t - vec3(0, .21, 0), .09, .085), .015), tier(t - vec3(0, .28, 0), .08, .06), .015) - .003;
    float trunk = sdCap(t, vec3(0, 0, 0), vec3(0, .09, 0), .016);
    vec3 t2 = p - vec3(-.40, GY - .02, .10);
    float tr2 = smin(tier(t2 - vec3(0, .05, 0), .10, .09), tier(t2 - vec3(0, .13, 0), .08, .065), .018) - .004;
    tr = min(tr, tr2);
    if (tr < m.x) m = vec2(tr, 4.);
    if (trunk < m.x) m = vec2(trunk, 14.);
    // the figure: a coat, arms round a cup, a head, a scarf with a tail, a bobble hat
    vec3 f = p - vec3(.12, GY, .21);
    float coat = sdCone(f - vec3(0, .048, 0), .046, .038, .022) - .006;
    float legs = min(sdCap(f, vec3(-.012, 0., 0.), vec3(-.012, .02, 0.), .009), sdCap(f, vec3(.012, 0., 0.), vec3(.012, .02, 0.), .009));
    float arms = min(sdCap(f, vec3(-.026, .085, 0.), vec3(-.008, .062, .028), .009), sdCap(f, vec3(.026, .085, 0.), vec3(.008, .062, .028), .009));
    coat = smin(smin(coat, arms, .012), legs, .006);
    float head = length(f - vec3(0, .118, 0)) - .025;
    float hat = max(length(f - vec3(0, .124, 0)) - .027, -(f.y - .128));
    float bob = length(f - vec3(0, .156, 0)) - .010;
    float scarf = sdTorus(f - vec3(0, .094, 0), vec2(.021, .008));
    scarf = min(scarf, sdCap(f, vec3(.012, .092, .016), vec3(.020, .055, .030), .006));
    float cup = sdRBox(f - vec3(0., .064, .036), vec3(.008, .010, .008), .003);
    if (coat < m.x) m = vec2(coat, 5.);
    if (head < m.x) m = vec2(head, 6.);
    if (min(hat, bob) < m.x) m = vec2(min(hat, bob), 7.);
    if (scarf < m.x) m = vec2(scarf, 7.);
    if (cup < m.x) m = vec2(cup, 11.);
    // the lamp post
    vec3 l = p - vec3(-.03, GY, .20);
    float post = smin(sdCap(l, vec3(0, 0, 0), vec3(0, .20, 0), .006), sdCone(l - vec3(0, .012, 0), .012, .014, .007), .005);
    float lamp = length(l - vec3(0, .215, 0)) - .017;
    float lcap = sdCone(l - vec3(0, .236, 0), .008, .022, .004);
    if (min(post, lcap) < m.x) m = vec2(min(post, lcap), 8.);
    if (lamp < m.x) m = vec2(lamp, 9.);
  } else {
    // the observatory: a rounded drum, a ribbed dome with its slit open, a telescope, a figure looking up, on a crag
    vec3 c = p - vec3(-.06, GY + .03, -.06);
    // the crag: faceted rock, two blocks cut by planes
    vec3 r1 = p - vec3(-.10, GY + .03, -.10);
    float rock = max(max(max(dot(r1, normalize(vec3(.3, 1., .1))) - .07, dot(r1, normalize(vec3(-.8, .5, .3))) - .19), max(dot(r1, normalize(vec3(.9, .45, -.2))) - .2, dot(r1, normalize(vec3(.1, .4, .95))) - .17)), max(max(dot(r1, normalize(vec3(-.2, .35, -.95))) - .2, dot(r1, normalize(vec3(-.6, .9, -.6))) - .12), -r1.y - .12));
    vec3 r2 = p - vec3(-.31, GY + .02, .13);
    float rock2 = max(max(max(dot(r2, normalize(vec3(.2, 1., .3))) - .04, dot(r2, normalize(vec3(-.9, .4, .2))) - .07), max(dot(r2, normalize(vec3(.8, .5, -.3))) - .07, dot(r2, normalize(vec3(.2, .3, .95))) - .06)), max(dot(r2, normalize(vec3(-.3, .3, -.9))) - .07, -r2.y - .08));
    rock = min(rock, rock2);
    float drum = sdRBox(vec3(length(c.xz), c.y - .06, 0.), vec3(.108, .06, 1.), .008);
    drum = max(length(c.xz) - .11, abs(c.y - .06) - .06) ;
    drum = max(drum, -sdRBox(c - vec3(0, .04, .11), vec3(.022, .04, .02), .004));
    float ring = sdTorus(c - vec3(0, .125, 0), vec2(.122, .009));
    vec3 dc = c - vec3(0, .133, 0);
    float dome = max(length(dc) - .128, -dc.y);
    float slit = max(abs(dc.x) - .026, -dc.z);
    dome = max(dome, -max(slit, -dc.y + .01));
    float scope = sdCap(c, vec3(0, .16, 0), vec3(.0, .26, .085), .018);
    if (rock < m.x) m = vec2(rock, 10.);
    if (drum < m.x) m = vec2(drum, 11.);
    if (ring < m.x) m = vec2(ring, 13.);
    if (dome < m.x) m = vec2(dome, 12.);
    if (scope < m.x) m = vec2(scope, 13.);
    vec3 t = p - vec3(.30, GY, -.16);
    float tr = smin(smin(tier(t - vec3(0, .06, 0), .13, .12), tier(t - vec3(0, .16, 0), .11, .09), .012), tier(t - vec3(0, .25, 0), .10, .065), .012);
    if (tr < m.x) m = vec2(tr, 4.);
    vec3 f = p - vec3(.20, GY, .20);
    float coat = smin(sdCone(f - vec3(0, .048, 0), .046, .036, .022) - .006, min(sdCap(f, vec3(-.012, 0., 0.), vec3(-.012, .02, 0.), .009), sdCap(f, vec3(.012, 0., 0.), vec3(.012, .02, 0.), .009)), .006);
    float head = length(f - vec3(-.004, .118, -.010)) - .024;
    float hat = max(length(f - vec3(-.004, .124, -.012)) - .026, -(f.y - .126 + .4 * (f.z + .01)));
    if (coat < m.x) m = vec2(coat, 5.);
    if (head < m.x) m = vec2(head, 6.);
    if (hat < m.x) m = vec2(hat, 7.);
  }
  m.x *= SC;
  return m;
}
vec3 nS(vec3 p){ vec2 e = vec2(.0012, 0); return normalize(vec3(mapS(p + e.xyy).x - mapS(p - e.xyy).x, mapS(p + e.yxy).x - mapS(p - e.yxy).x, mapS(p + e.yyx).x - mapS(p - e.yyx).x)); }
`

const OBJECT = `
float softS(vec3 p, vec3 l){ float r = 1., t = .012; for (int i = 0; i < 20; i++){ float h = mapS(p + l * t).x; r = min(r, 9. * h / t); t += clamp(h, .01, .08); if (r < .02 || t > 1.2) break; } return clamp(r, 0., 1.); }
float aoS(vec3 p, vec3 n){ float o = 0., w = 1.; for (int i = 1; i < 6; i++){ float h = .014 * float(i); o += w * (h - mapS(p + n * h).x); w *= .62; } return clamp(1. - o * 7., 0., 1.); }
mat3 yawM(float a){ float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }

vec3 shadeScene(vec3 p0, vec3 rd, float id, vec3 Ll, float atGlass, float lit){
  vec3 n = nS(p0); float occ = aoS(p0, n);
  if (atGlass > .5){ n = normalize(-rd + vec3(0, .6, 0)); occ = .9; }
  vec3 p = toS(p0);
  vec3 alb = vec3(.9); vec3 emit = vec3(0.); float gloss = .35;
  // hand-painted: every colour wanders a little, and pools darker in the creases
  float pv = .88 + .24 * vn3(p * 46.);
  if (id < 1.5) { alb = uSnow; gloss = .1; }
  else if (id < 2.2) { alb = vec3(.80, .56, .34) * pv; }
  else if (id < 2.7) { alb = vec3(.92, .88, .80) * pv; }
  else if (id < 3.5) { alb = vec3(.30, .16, .12) * pv; }
  else if (id < 4.5) { alb = vec3(.10, .24, .17) * (.8 + .4 * vn3(p * 30.)); }
  else if (id < 5.5) { alb = (uScene < .5 ? vec3(.14, .18, .30) : vec3(.20, .16, .26)) * pv; }
  else if (id < 6.5) { alb = vec3(.88, .66, .52); }
  else if (id < 7.5) { alb = (uScene < .5 ? vec3(.72, .17, .11) : vec3(.62, .44, .16)) * pv; }
  else if (id < 8.5) { alb = vec3(.07, .07, .08); gloss = .8; }
  else if (id < 9.5) { alb = vec3(1.); emit = vec3(1., .72, .38) * 2.4; }
  else if (id < 10.5) { alb = vec3(.16, .16, .18) * (.75 + .4 * vn3(p * 25.)); gloss = .35; }
  else if (id < 11.5) { alb = vec3(.86, .84, .80) * pv; }
  else if (id < 12.5) { vec3 q = p - vec3(-.06, GY + .163, -.06); float rib = smoothstep(0., .004, abs(fract(atan(q.z, q.x) * 6. / PI) - .5) - .46);
    alb = vec3(.62, .64, .68) * (.86 + .14 * rib); gloss = .95;
    // inside the open slit: dark, with the warm light of the room below rising into it
    float inside = step(abs(q.x), .027) * step(0., q.z) * step(length(q), .124);
    if (inside > .5){ alb = vec3(.04); gloss = 0.; emit += vec3(1., .5, .22) * (.10 + .55 * smoothstep(.12, .0, q.y + .02)); } }
  else if (id < 13.5) { alb = vec3(.75, .56, .26) * .6; gloss = 1.; emit += vec3(1., .55, .25) * .06; }
  else if (id < 14.5) { alb = vec3(.25, .15, .09) * pv; }
  else { // a lit window: warm, brighter in the middle, with glazing bars
    vec3 c = p - vec3(-.13, GY, -.04); vec2 w = vec2(abs(abs(c.x) - .0675), abs(c.y - .0975));
    float bars = step(.004, w.x) * step(.004, w.y);
    alb = vec3(.1); emit = vec3(1., .58, .24) * (1.6 + 1.6 * exp(-dot(w, w) * 900.)) * bars + vec3(.05, .04, .03) * (1. - bars);
  }
  // snow gathers in clumps on whatever faces up
  float clump = vn3(p * 55.) * .6 + vn3(p * 140.) * .4;
  float snow = id < 1.5 ? 1. : smoothstep(.50, .70, n.y + .32 * (clump - .5));
  if (id > 8.5 && id < 9.5 || id > 14.5) snow = 0.;
  if (uScene > .5 && id > 9.5 && id < 10.5) snow *= smoothstep(.75, .95, n.y);
  if (uScene > .5 && id > 10.5 && id < 13.5) snow = 0.;
  alb = mix(alb, uSnow * (.94 + .1 * clump), snow);
  gloss = mix(gloss, .15, snow);
  float dif = max(dot(n, Ll), 0.);
  float wrap = max((dot(n, Ll) + .35) / 1.35, 0.);
  float sh = atGlass > .5 ? .8 : softS(p0 + n * .004, Ll);
  vec3 col = alb * (uSun * mix(dif, wrap, snow * .6) * sh * lit * 1.05 + uAmb * (.42 + .3 * n.y) * occ) + emit;
  // the glossy coat: a highlight from the key and a little of the room
  vec3 R = reflect(rd, n);
  float fr = .04 + .96 * pow(1. - max(dot(-rd, n), 0.), 5.);
  col += uSun * pow(max(dot(R, Ll), 0.), 50.) * gloss * .6 * sh * lit + env(R) * fr * gloss * .5;
  if (uScene < .5){
    // the windows glow through the plaster round them and onto the snow
    vec3 c = p - vec3(-.13, GY, -.04);
    vec3 wl = vec3(c.x, c.y, c.z); wl.x = abs(wl.x) - .0675;
    float dw = length((wl - vec3(0, .0975, .11)) * vec3(1., 1.2, 1.));
    col += alb * vec3(1., .55, .25) * .55 * exp(-dw * dw * 520.) * (id < 2.7 && id > 1.5 ? 1.4 : 1.);
    float dl = length(p - vec3(-.03, GY + .215, .20)); col += alb * vec3(1., .66, .35) * .45 * exp(-dl * dl * 160.);
    if (snow > .5){ float s = step(.996, h21(floor(p.xz * 500. + p.y * 300.))); col += s * uSun * .6 * dif * sh * lit; }
  } else {
    if (snow > .3){ vec2 cell = floor(p.xz * 220. + p.y * 120.); float g = step(.992, h21(cell));
      vec3 gn = normalize(n + (vec3(h21(cell + 3.), .5, h21(cell + 7.)) - .5) * 1.6);
      col += g * vec3(1., .78, .40) * pow(max(dot(reflect(rd, gn), Ll), 0.), 10.) * 3. * lit; }
    col += alb * vec3(.10, .12, .18) * (.5 + .5 * n.y);
    float dl = length(p - vec3(-.06, GY + .30, .05)); col += alb * vec3(1., .5, .25) * .5 * exp(-dl * dl * 40.);
  }
  return col;
}

// the turned base: foot, bead, a long cove, a rounded lip; walnut or ebony under lacquer, a brass ring
float baseR(float y){
  float r = .80 - .012 * smoothstep(0., .05, y);
  r += .014 * exp(-pow((y - .13) / .035, 2.));
  r -= .035 * sin(PI * clamp((y - .20) / .62, 0., 1.));
  r -= .03 * smoothstep(.90, 1., y) * smoothstep(.90, 1., y);
  return r;
}
float sdBase(vec3 P){ float y = (P.y - uF) / uBase.z; float d = length(P.xz - uG.xz) - baseR(clamp(y, 0., 1.)) * uR; return max(d * .9, max(-(P.y - uF), P.y - (uF + uBase.z))); }
bool baseHit(vec3 ro, vec3 rd, out float t, out vec3 N){
  t = -1.;
  vec2 o = ro.xz - uG.xz; float rb = uR * .84;
  float A = dot(rd.xz, rd.xz), B = dot(o, rd.xz), C = dot(o, o) - rb * rb;
  float D = B * B - A * C; if (D < 0.) return false;
  float tt = max((-B - sqrt(D)) / A, 0.), t1 = (-B + sqrt(D)) / A;
  for (int i = 0; i < 56; i++){
    vec3 P = ro + rd * tt; float d = sdBase(P);
    if (d < .05){ t = tt; vec2 e = vec2(.4, 0.);
      N = normalize(vec3(sdBase(P + e.xyy) - sdBase(P - e.xyy), sdBase(P + e.yxy) - sdBase(P - e.yxy), sdBase(P + e.yyx) - sdBase(P - e.yyx))); return true; }
    tt += d; if (tt > t1) break;
  }
  return false;
}
vec3 shadeBase(vec3 P, vec3 N, vec3 rd){
  float a = atan(P.z - uG.z, P.x - uG.x);
  float yy = (P.y - uF) / uBase.z;
  float grain = fbm(vec2(a * 3. + yy * .6, yy * 18.) * vec2(6., 1.));
  vec3 alb = uWood * (.70 + .55 * grain);
  float band = smoothstep(.855, .865, yy) * smoothstep(.905, .895, yy);
  float dif = max(dot(N, uL), 0.) * winMask(P);
  vec3 col = alb * (uSun * dif * .9 + uAmb * (.30 + .25 * N.y));
  vec3 R = reflect(rd, N);
  float fr = .04 + .96 * pow(1. - max(dot(-rd, N), 0.), 5.);
  vec3 er = env(R);
  col += er * fr * .55 + uSun * pow(max(dot(R, uL), 0.), 40.) * .18 * winMask(P);
  col = mix(col, uBrass * (uSun * dif * .5 + uAmb * .2) + uBrass * er * 1.1 + uSun * pow(max(dot(R, uL), 0.), 30.) * winMask(P), band);
  col *= mix(.55, 1., smoothstep(1., .96, yy));
  return col;
}
// the room seen through or reflected in the glass
vec3 bg(vec3 ro, vec3 rd){
  float tBest = 1e9; int kind = 0; vec3 Nb;
  if (rd.z < 0. && ro.z > .5){ float t = -ro.z / rd.z; vec3 P = ro + rd * t; if (P.y < uF && t < tBest){ tBest = t; kind = 1; } }
  if (abs(rd.y) > 1e-4){ float t = (uF - ro.y) / rd.y; vec3 P = ro + rd * t; if (t > .01 && P.z < 0. && P.z > -uDepth && t < tBest){ tBest = t; kind = 2; } }
  if (rd.z < 0.){ float t = (-uWallZ - ro.z) / rd.z; if (t > .01 && t < tBest){ tBest = t; kind = 3; } }
  float tb; vec3 nb; if (baseHit(ro, rd, tb, nb) && tb < tBest){ tBest = tb; kind = 4; Nb = nb; }
  if (kind == 0) return env(rd);
  vec3 P = ro + rd * tBest;
  if (kind == 1) return litFull(P, vec3(0, 0, 1), stoneAlb(P.xy), 1.);
  if (kind == 4) return shadeBase(P, Nb, rd);
  if (kind == 2) return litFull(P, vec3(0, 1, 0), topAlb(P), topAO(P, uG)) + env(reflect(rd, vec3(0, 1, 0))) * (.05 + .95 * pow(1. - abs(rd.y), 5.)) * uPolish;
  return litFull(P, vec3(0, 0, 1), wallAlb(P), 1.) + wallPool(P);
}
vec3 refr(vec3 i, vec3 n, float eta, out bool tir){ vec3 r = refract(i, n, eta); tir = dot(r, r) < 1e-6; return tir ? reflect(i, n) : r; }
bool sph(vec3 ro, vec3 rd, vec3 c, float r, out float t0, out float t1){ vec3 oc = ro - c; float b = dot(oc, rd), cc = dot(oc, oc) - r * r, d = b * b - cc; if (d < 0.) return false; d = sqrt(d); t0 = -b - d; t1 = -b + d; return true; }
`

// object pass: colour (gl_FragData would need an extension: two draws, uOut picks colour or depth)
const OBJ_FRAG = HEAD + ROOM + SCENE + OBJECT + `
uniform float uOut;
uniform float uLitG;
void main(){
  vec2 frag = (gl_FragCoord.xy + uOrg) / uDpr;
  vec3 ro = uCam; vec3 rd = normalize(vec3(frag - uCam.xy, -uCam.z));
  float t0, t1, tb; vec3 nb;
  bool hb = baseHit(ro, rd, tb, nb);
  bool hs = sph(ro, rd, uG, uR, t0, t1);
  vec3 col = vec3(0.); float a = 0., depth = 0.;
  if (hs && t0 > 0. && (!hb || t0 < tb)){
    a = 1.;
    vec3 P = ro + rd * t0; vec3 N = normalize(P - uG);
    float cosi = -dot(rd, N);
    float Fr = .04 + .96 * pow(1. - cosi, 5.);
    vec3 refl = bg(P + N * .5, reflect(rd, N));
    vec3 iorG = vec3(1.512, 1.505, 1.498), iorW = vec3(1.338, 1.333, 1.328);
    vec3 thru = vec3(0.); vec3 sceneC = vec3(0.); float sceneA = 0.;
    float ri = uR * .90;
    mat3 Yi = yawM(-uTyaw);
    vec3 Ll = Yi * uL;
    for (int k = 0; k < 3; k++){
      bool tir; vec3 d1 = refr(rd, N, 1. / iorG[k], tir);
      vec3 outc; float glassLen = 0.;
      float a0, a1;
      if (sph(P + d1 * .01, d1, uG, ri, a0, a1) && a0 > 0.){
        glassLen += a0;
        vec3 p2 = P + d1 * (a0 + .01); vec3 n2 = normalize(p2 - uG);
        vec3 d2 = refract(d1, n2, iorG[k] / iorW[k]);
        if (dot(d2, d2) < 1e-6){
          // total internal reflection at the inner wall: the light runs on inside the glass
          vec3 dr = reflect(d1, n2); float c0, c1; sph(p2, dr, uG, uR, c0, c1); glassLen += c1;
          vec3 p4 = p2 + dr * c1; vec3 n4 = normalize(p4 - uG);
          vec3 d4 = refr(dr, -n4, iorG[k], tir);
          outc = tir ? env(d4) * .7 : bg(p4 + d4 * .5, d4);
        } else {
          float b0, b1; sph(p2, d2, uG, ri, b0, b1);
          if (k == 1){
            vec3 lo = Yi * ((p2 - uG) / uR), ld = Yi * d2; float tm = .002, hitT = -1., id = 0.;
            for (int i = 0; i < 110; i++){ vec2 h = mapS(lo + ld * tm); if (h.x < .0006){ hitT = tm; id = h.y; break; } tm += h.x * .85; if (tm > b1 / uR) break; }
            float tEnd = hitT > 0. ? hitT : b1 / uR;
            depth = tEnd;
            if (hitT > 0.){ sceneC = shadeScene(lo + ld * hitT, ld, id, Ll, hitT < .006 ? 1. : 0., uLitG); sceneA = 1.; }
            sceneC = mix(sceneC, uTint * .55, (1. - exp(-tEnd * .5)) * .14);
          }
          vec3 p3 = p2 + d2 * b1; vec3 n3_ = normalize(p3 - uG);
          vec3 d3 = refr(d2, -n3_, iorW[k] / iorG[k], tir);
          float c0, c1; sph(p3, d3, uG, uR, c0, c1);
          glassLen += c1;
          vec3 p4 = p3 + d3 * c1; vec3 n4 = normalize(p4 - uG);
          vec3 d4 = refr(d3, -n4, iorG[k], tir);
          outc = tir ? env(d4) * .6 : bg(p4 + d4 * .5, d4);
          outc *= exp(-(b1 / uR) * vec3(.05, .025, .02) * (uScene > .5 ? 3. : 1.));
        }
      } else {
        float c0, c1; sph(P, d1, uG, uR, c0, c1); glassLen += c1;
        vec3 p4 = P + d1 * c1; vec3 n4 = normalize(p4 - uG);
        vec3 d4 = refr(d1, -n4, iorG[k], tir);
        outc = tir ? env(d4) * .5 : bg(p4 + d4 * .5, d4);
      }
      outc *= exp(-(glassLen / uR) * vec3(.55, .20, .40));
      thru[k] = outc[k];
    }
    vec3 inside = mix(thru, sceneC, sceneA);
    col = mix(inside, refl, Fr);
    col += uSun * .10 * pow(max(dot(reflect(rd, N), normalize(uL + vec3(0, .1, .25))), 0.), 400.) * uLitG;
  } else if (hb){
    a = 1.;
    col = shadeBase(ro + rd * tb, nb, rd);
  }
  if (uOut < .5) gl_FragColor = vec4(sqrt(clamp(col * .5, 0., 1.)), a);
  else gl_FragColor = vec4(clamp(depth * .5, 0., 1.), 0., 0., 1.);
}`

// room pass: uOut 0 = the fill, 1 = the sun (without the object's shadows)
const ROOM_FRAG = HEAD + ROOM + `
uniform sampler2D uText; uniform float uTF; uniform float uOut; uniform vec4 uTextBox;
float tdist(vec2 p){
  vec2 uv = (vec2(p.x, uView.y - p.y) - uTextBox.xy) / uTextBox.zw;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return -30.;
  float v = texture2D(uText, uv).r; return uTF > .5 ? v : (v - .5) * 2. * 24.;
}
void main(){
  vec2 frag = gl_FragCoord.xy / uDpr;
  vec3 ro = uCam; vec3 rd = normalize(vec3(frag - uCam.xy, -uCam.z));
  vec3 fill = vec3(0.), sun = vec3(0.);
  if (frag.y < uF){
    // the plinth's face, with the inscription and the label frame
    vec2 p = frag; vec3 P = vec3(p, 0.);
    vec3 alb = stoneAlb(p);
    float dd = tdist(p);
    vec3 Nf = vec3(0, 0, 1);
    if (dd > -1.5){
      float e = .75;
      vec2 g = vec2(tdist(p + vec2(e, 0)) - tdist(p - vec2(e, 0)), tdist(p + vec2(0, e)) - tdist(p - vec2(0, e))) / (2. * e);
      vec3 Nc = normalize(vec3(g * 1.15, 1.));
      Nf = normalize(mix(Nf, Nc, smoothstep(0., .3, dd)));
    }
    vec3 sf, ss; light2(P, Nf, alb * .92, 1., sf, ss);
    float paint = dd > -1.5 ? smoothstep(.12, .6, dd) : 0.;
    float inCut = smoothstep(-.05, .15, dd);
    vec3 R = reflect(rd, Nf);
    float fd = max(dot(Nf, uL), 0.);
    // the paint is authored as the colour it shows in the fill
    // the paint fills the cut: its surface is flush and flat, only a soft relief of the V shows through
    float relief = mix(.78, 1.04, max(dot(Nf, normalize(vec3(-.45, .6, .66))), 0.));
    vec3 pf = uPaint * relief + env(reflect(rd, vec3(0, 0, 1))) * .02;
    vec3 ps = uPaint / max(uAmb * .56, vec3(.02)) * uSun * uL.z * winMask(P) * .6 * relief;
    // the bare stone wall of the cut, before the paint starts, stays in its own shade
    sf = mix(sf, sf * .55, inCut); ss = mix(ss, vec3(0.), inCut);
    if (uScene > .5){
      // night: no paint; the cut is dark inside, and its gilded walls catch only the strip light under the ledge
      vec3 Lg = normalize(vec3(0., .92, .38)); float gr = exp(-(uF - p.y) / 260.);
      float face = max(dot(Nf, Lg), 0.);
      vec3 gilt = uPaint * (.10 + 2.1 * pow(face, 2.2) * gr * uLip) + uPaint * 1.6 * pow(max(dot(reflect(rd, Nf), Lg), 0.), 6.) * gr * uLip;
      pf = mix(uPaint * .08, gilt, smoothstep(.0, .5, dd) * (1. - smoothstep(4.5, 9., dd) * .55));
      ps = vec3(0.);
      paint = inCut;
    }
    fill = mix(sf, pf, paint); sun = mix(ss, ps, paint);
    // at night the ledge's overhang keeps the moon off the face; only the strip light reaches it
    if (uScene > .5) sun *= 0.;
    if (uLip > 0.){
      // a warm strip light under the ledge lip grazes down the face
      vec3 Lg = normalize(vec3(0., .92, .38)); float gr = exp(-(uF - p.y) / 170.);
      vec3 lipC = vec3(1., .72, .42) * uLip * gr;
      fill += alb * .55 * max(dot(Nf, Lg), 0.) * lipC * (1. - paint);
    }
    // a brass frame round the copy, let into the stone (a card holder)
    vec2 q = p - uCopy.xy; vec2 hs = uCopy.zw * .5; vec2 qq = abs(q - hs) - hs;
    float od = max(qq.x, qq.y) - 12.;
    float fw = 7.;
    if (uCopy.z > 0. && od > -1. && od < fw){
      vec2 nn = qq.x > qq.y ? vec2(sign(q.x - hs.x), 0.) : vec2(0., sign(q.y - hs.y));
      float u = clamp(od / fw, 0., 1.);
      vec3 Nb = normalize(vec3(nn * (u * 2. - 1.) * 1.6, 1.));
      vec3 Rb = reflect(rd, Nb);
      fill = uBrass * (uAmb * .35 + env(Rb) * .9) + uBrass * vec3(1., .72, .42) * uLip * .5 * max(dot(Nb, normalize(vec3(0., .92, .38))), 0.);
      sun = uBrass * uSun * max(dot(Nb, uL), 0.) * .7 * winMask(P) + uSun * pow(max(dot(Rb, uL), 0.), 24.) * .5 * winMask(P);
      // a dark seam where frame meets stone
      float seam = smoothstep(fw - 1.2, fw, od) + smoothstep(0., -1., od);
      fill *= 1. - .6 * seam; sun *= 1. - .6 * seam;
    } else if (uCopy.z > 0. && od >= fw && od < fw + 6.){
      // the frame's own small shadow on the stone, away from the light
      vec2 lp = -normalize(uL.xy); float side = dot(qq.x > qq.y ? vec2(sign(q.x - hs.x), 0.) : vec2(0., sign(q.y - hs.y)), lp);
      float sh = smoothstep(fw + 6., fw, od) * (.25 + .45 * max(side, 0.));
      fill *= 1. - sh * .6; sun *= 1. - sh;
    }
    // the ledge lip catches the light; a little shade just under it
    fill *= 1. - .10 * smoothstep(26., 0., uF - p.y);
    sun += uSun * alb * .10 * smoothstep(3., 0., uF - p.y) * winMask(P);
  } else {
    float t = (uF - ro.y) / rd.y;
    vec3 P = ro + rd * t;
    if (rd.y < 0. && P.z > -uDepth){
      light2(P, vec3(0, 1, 0), topAlb(P), topAO(P, uG), fill, sun);
    } else {
      float tw = (-uWallZ - ro.z) / rd.z; P = ro + rd * tw;
      light2(P, vec3(0, 0, 1), wallAlb(P), 1., fill, sun);
      // the backdrop pool behind the object
      vec2 qp = (P.xy - vec2(uG.x - uR * .5, uG.y - uR * .2)) / vec2(uR * 3.0, uR * 2.1);
      fill += wallAlb(P) * uAmb * exp(-dot(qp, qp)) * .3 + wallPool(P);
    }
  }
  vec3 o = uOut < .5 ? fill : sun;
  gl_FragColor = vec4(sqrt(clamp(o * .5, 0., 1.)), 1.);
}`

// the miniature from above: its top surface as a height map (two bytes)
const HEIGHT_FRAG = HEAD + SCENE + `
uniform vec2 uHRes;
void main(){
  vec2 xz = (gl_FragCoord.xy / uHRes) * 1.8 - .9;
  float y = .9, h = -1.;
  for (int i = 0; i < 160; i++){ float d = mapS(vec3(xz.x, y, xz.y)).x; if (d < .001){ h = y; break; } y -= max(d * .8, .002); if (y < -.95) break; }
  float v = clamp((h + 1.) * .5, 0., 1.) * 255.;
  gl_FragColor = vec4(floor(v) / 255., fract(v), 0., 1.);
}`

// every frame
const FRAME_FRAG = HEAD + ROOM + `
uniform sampler2D uRF, uRS, uO, uD;
uniform vec4 uOBox;            // object texture: origin and size (device px)
uniform vec2 uOff;             // the object's shake offset (css px, y up)
uniform vec3 uOffW;            // the same, in the world at the object's depth
uniform vec3 uLevel;           // the liquid's surface: normal x, normal z, level (in R)
uniform float uGrain, uLitG; uniform vec3 uPlate;
vec3 dec(vec4 c){ return c.rgb * c.rgb * 2.; }
bool sph(vec3 ro, vec3 rd, vec3 c, float r, out float t0, out float t1){ vec3 oc = ro - c; float b = dot(oc, rd), cc = dot(oc, oc) - r * r, d = b * b - cc; if (d < 0.) return false; d = sqrt(d); t0 = -b - d; t1 = -b + d; return true; }
vec3 refr(vec3 i, vec3 n, float eta, out bool tir){ vec3 r = refract(i, n, eta); tir = dot(r, r) < 1e-6; return tir ? reflect(i, n) : r; }
// the room seen through the air cap (no base, no inscription needed up there)
vec3 bgCap(vec3 ro, vec3 rd, vec3 G){
  float tBest = 1e9; int kind = 0;
  if (abs(rd.y) > 1e-4){ float t = (uF - ro.y) / rd.y; vec3 P = ro + rd * t; if (t > .01 && P.z < 0. && P.z > -uDepth){ tBest = t; kind = 2; } }
  if (rd.z < 0.){ float t = (-uWallZ - ro.z) / rd.z; if (t > .01 && t < tBest){ tBest = t; kind = 3; } }
  if (kind == 0) return env(rd);
  vec3 P = ro + rd * tBest; vec3 f, s, cc;
  if (kind == 2) light2(P, vec3(0, 1, 0), topAlb(P), topAO(P, G), f, s);
  else light2(P, vec3(0, 0, 1), wallAlb(P), 1., f, s);
  return f + s * sphereShadow(P, G, cc) + s * cc * .85;
}
vec4 objAt(vec2 devPx){ vec2 uv = (devPx - uOBox.xy) / uOBox.zw; if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec4(0.); return texture2D(uO, uv); }
void main(){
  vec2 frag = gl_FragCoord.xy / uDpr;
  vec2 tuv = gl_FragCoord.xy / (uView * uDpr);
  vec3 ro = uCam; vec3 rd = normalize(vec3(frag - uCam.xy, -uCam.z));
  vec3 G = uG + uOffW;
  vec3 fill = dec(texture2D(uRF, tuv)), sun = dec(texture2D(uRS, tuv));
  vec3 col;
  // where this pixel meets the room
  vec3 P; vec3 N;
  if (frag.y < uF){ P = vec3(frag, 0.); N = vec3(0, 0, 1); }
  else { float t = (uF - ro.y) / rd.y; P = ro + rd * t; N = vec3(0, 1, 0);
    if (!(rd.y < 0. && P.z > -uDepth)){ float tw = (-uWallZ - ro.z) / rd.z; P = ro + rd * tw; N = vec3(0, 0, 1); } }
  vec3 cc;
  float sh = sphereShadow(P, G, cc) * baseShadow(P, G);
  col = fill + sun * sh + sun * cc * (uScene > .5 ? .55 : .85);
  if (uPolish > 0. && N.y > .5) col += uSun * min(cc, vec3(1.2)) * .025 * uPolish * winMask(P);
  // polished stone: the object mirrored in the ledge
  if (uPolish > 0. && N.y > .5){
    vec3 Rr = reflect(rd, N);
    float fr = .05 + .95 * pow(1. - abs(rd.y), 5.);
    float t0, t1; vec3 hit; bool any = false;
    if (sph(P, Rr, G, uR, t0, t1) && t0 > 0.){ hit = P + Rr * t0; any = true; }
    else {
      // the base, as its bounding cylinder
      vec2 o = P.xz - G.xz; float rb = uR * .80;
      float A = dot(Rr.xz, Rr.xz), B = dot(o, Rr.xz), C = dot(o, o) - rb * rb, D = B * B - A * C;
      if (D > 0.){ float tt = (-B - sqrt(D)) / A; vec3 hb = P + Rr * tt; if (tt > 0. && hb.y < uF + uBase.z){ hit = hb; any = true; } }
    }
    vec3 rc = env(Rr) * .35;
    if (any){
      // look the hit up in the object's picture, where the camera sees that point
      vec3 hp = hit - uOffW; vec3 dv = hp - uCam; vec2 sp = uCam.xy + dv.xy * (-uCam.z / dv.z);
      vec4 oc = objAt((sp + uOff) * uDpr);
      rc = mix(rc, dec(oc), oc.a);
    }
    col += rc * fr * uPolish * (.35 + .65 * smoothstep(-uDepth, 0., P.z));
  }
  // the object, cached at rest and moved by the shake
  vec4 ob = objAt(gl_FragCoord.xy - uOff * uDpr);
  col = mix(col, dec(ob), ob.a);
  // the air cap under the top of the glass, the liquid's surface and its meniscus (they move)
  float t0, t1;
  if (sph(ro, rd, G, uR, t0, t1) && t0 > 0.){
    vec3 Ps = ro + rd * t0; vec3 Ns = normalize(Ps - G);
    bool tir; vec3 d1 = refr(rd, Ns, 1. / 1.505, tir);
    float ri = uR * .9, a0, a1;
    vec3 pn = normalize(vec3(uLevel.x, 1., uLevel.y)); vec3 pl = G + vec3(0., uLevel.z * uR, 0.);
    if (sph(Ps + d1 * .01, d1, G, ri, a0, a1) && a0 > 0.){
      vec3 p2 = Ps + d1 * (a0 + .01); vec3 n2 = normalize(p2 - G);
      float side2 = dot(p2 - pl, pn);
      vec4 dpt = texture2D(uD, (gl_FragCoord.xy - uOff * uDpr - uOBox.xy) / uOBox.zw);
      float sceneT = dpt.r * 2. * uR;
      vec3 capCol = vec3(0.); float useCap = 0.;
      if (side2 > 0.){
        // in the air: glass to air, then out through the top, or down into the liquid
        useCap = 1.;
        vec3 d2 = refr(d1, n2, 1.505, tir);
        float b0, b1; sph(p2, d2, G, ri, b0, b1);
        float dn = dot(d2, pn); float tp = dn < 0. ? -side2 / dn : 1e9;
        if (tp < b1){
          vec3 ps = p2 + d2 * tp;
          float c = -dn; float fr = .02 + .98 * pow(1. - c, 5.);
          vec3 d3 = refract(d2, pn, 1. / 1.333);
          float e0, e1; sph(ps, d3, G, ri, e0, e1);
          vec3 p3 = ps + d3 * e1; vec3 n3 = normalize(p3 - G);
          vec3 d4 = refr(d3, -n3, 1.333 / 1.505, tir); float g0, g1; sph(p3, d4, G, uR, g0, g1);
          vec3 p4 = p3 + d4 * g1; vec3 d5 = refr(d4, -normalize(p4 - G), 1.505, tir);
          vec3 below = bgCap(p4 + d5, d5, G) * exp(-(e1 / uR) * vec3(.05, .025, .02));
          vec3 dr = reflect(d2, pn); float h0, h1; sph(ps, dr, G, ri, h0, h1); vec3 pr = ps + dr * h1;
          vec3 dr2 = refr(dr, -normalize(pr - G), 1. / 1.505, tir); float k0, k1; sph(pr, dr2, G, uR, k0, k1);
          vec3 pr2 = pr + dr2 * k1; vec3 dr3 = refr(dr2, -normalize(pr2 - G), 1.505, tir);
          capCol = mix(below, bgCap(pr2 + dr3, dr3, G), fr);
        } else {
          vec3 p3 = p2 + d2 * b1; vec3 n3 = normalize(p3 - G);
          vec3 d4 = refr(d2, -n3, 1. / 1.505, tir); float g0, g1; sph(p3, d4, G, uR, g0, g1);
          vec3 p4 = p3 + d4 * g1; vec3 d5 = refr(d4, -normalize(p4 - G), 1.505, tir);
          capCol = tir ? env(d5) * .6 : bgCap(p4 + d5, d5, G);
          // the back meniscus, seen through the air
          float sb = dot(p3 - pl, pn); capCol *= 1. - .75 * exp(-pow(sb / (uR * .006), 2.));
        }
        capCol = capCol * exp(-(a0 / uR) * vec3(.55, .20, .40)) * 1.2 + uAmb * .08;
      } else {
        // in the liquid: does this ray reach the surface from below before the scene or the far wall?
        vec3 d2 = refract(d1, n2, 1.505 / 1.333);
        float b0, b1; sph(p2, d2, G, ri, b0, b1);
        float dn = dot(d2, pn); float tp = dn > 0. ? -side2 / dn : 1e9;
        float lim = min(b1, sceneT > 0. ? sceneT : b1);
        if (false && tp < lim){
          useCap = 1.;
          vec3 ps = p2 + d2 * tp;
          // from below the surface is a mirror past the critical angle: the silver underside
          vec3 dt = refract(d2, -pn, 1.333);
          vec3 dr = reflect(d2, -pn);
          float c = dn; float fr = dot(dt, dt) < 1e-6 ? 1. : .02 + .98 * pow(1. - c, 5.);
          float h0, h1; sph(ps, dr, G, ri, h0, h1); vec3 pr = ps + dr * h1;
          vec3 dr2 = refr(dr, -normalize(pr - G), 1.333 / 1.505, tir); float k0, k1; sph(pr, dr2, G, uR, k0, k1);
          vec3 pr2 = pr + dr2 * k1; vec3 dr3 = refr(dr2, -normalize(pr2 - G), 1.505, tir);
          vec3 refl = tir ? env(dr3) : bgCap(pr2 + dr3, dr3, G);
          vec3 trans = vec3(0.);
          if (fr < 1.){ float e0, e1; sph(ps, dt, G, ri, e0, e1); vec3 p3 = ps + dt * e1;
            vec3 d4 = refr(dt, -normalize(p3 - G), 1. / 1.505, tir); float g0, g1; sph(p3, d4, G, uR, g0, g1);
            vec3 p4 = p3 + d4 * g1; vec3 d5 = refr(d4, -normalize(p4 - G), 1.505, tir); trans = bgCap(p4 + d5, d5, G); }
          capCol = mix(trans, refl * 1.08, fr) * exp(-(a0 / uR) * vec3(.55, .20, .40));
        }
      }
      if (useCap > .5){
        float cosi = -dot(rd, Ns); float Fr = .04 + .96 * pow(1. - cosi, 5.);
        vec3 refl = env(reflect(rd, Ns));
        col = mix(capCol, refl, Fr);
        col += uSun * .10 * pow(max(dot(reflect(rd, Ns), normalize(uL + vec3(0, .1, .25))), 0.), 400.) * uLitG;
      }
      // the meniscus: the surface climbs the glass and bends the light away, a dark line with a bright edge under it
      float s2 = side2 / (uR * .006);
      col *= 1. - .8 * exp(-s2 * s2);
      col += vec3(.9) * .25 * exp(-pow((side2 + uR * .014) / (uR * .006), 2.));
    }
  }
  // tone: a soft shoulder, then the display curve; a fixed grain
  col = mix(col, .8 + .2 * (1. - exp(-(col - .8) / .2)), step(.8, col));
  col = pow(max(col, 0.), vec3(1. / 2.2));
  col += (h21(gl_FragCoord.xy * .731) - .5) * .022 * uGrain;
  // the card's margin inside the brass holder, in the plate's own colour
  if (uCopy.z > 0.){ vec2 q = frag - uCopy.xy; vec2 hs = uCopy.zw * .5; vec2 qq = abs(q - hs) - hs; float od = max(qq.x, qq.y);
    if (od >= -.5 && od < 11.5) col = uPlate; }
  gl_FragColor = vec4(col, 1.);
}`

// the flakes: flat irregular flakes, stretched along their motion, softened when near the glass
const FLAKE_VERT = `
attribute vec2 aC; attribute vec2 aQ; attribute vec4 aAx; attribute vec2 aV; attribute vec4 aCol; attribute vec3 aMisc;
uniform vec2 uCanvas;
varying vec2 vP; varying vec4 vAx; varying vec2 vV; varying vec4 vCol; varying vec3 vMisc;
void main(){
  float hf = max(aAx.x, aAx.y) + aAx.w + length(aV) * .5 + 1.5 + aMisc.z * 9.;
  vec2 p = aC + aQ * hf;
  vP = aQ * hf; vAx = aAx; vV = aV; vCol = aCol; vMisc = aMisc;
  gl_Position = vec4(p / uCanvas * 2. - 1., 0., 1.);
}`
const FLAKE_FRAG = `precision highp float;
uniform sampler2D uD; uniform vec4 uOBox; uniform vec2 uOffD; uniform float uDprF;
varying vec2 vP; varying vec4 vAx; varying vec2 vV; varying vec4 vCol; varying vec3 vMisc;
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main(){
  // hidden behind the miniature, or outside the liquid
  vec4 d = texture2D(uD, (gl_FragCoord.xy - uOffD - uOBox.xy) / uOBox.zw);
  float lim = d.r * 2.;
  if (lim <= 0. || vMisc.y > lim + .02) discard;
  vec2 p = vP;
  float vv = dot(vV, vV);
  if (vv > .01) p -= vV * clamp(dot(p, vV) / vv, -.5, .5);
  float c = cos(vAx.z), s = sin(vAx.z);
  vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
  float ang = atan(q.y, q.x);
  // an irregular outline: a few lobes, different for every flake
  float lob = 1. + .22 * sin(ang * 3. + vMisc.x * 17.) + .14 * sin(ang * 5. + vMisc.x * 31.);
  float r = length(q / vec2(vAx.x, max(vAx.y, .35)));
  float edge = .6 + vAx.w;
  float a = smoothstep(lob + edge / max(vAx.x, .5), lob - edge / max(vAx.x, .5), r);
  float spread = (vAx.x * max(vAx.y, .35)) / ((vAx.x + vAx.w) * (max(vAx.y, .35) + vAx.w)) / (1. + length(vV) / max(vAx.x * 2., 1.));
  a *= clamp(spread, .12, 1.);
  // a glitter flake that catches the light flashes a small star
  float st = vMisc.z * (exp(-abs(vP.y) * 1.4) * exp(-abs(vP.x) / (vAx.x * 4.)) + exp(-abs(vP.x) * 1.4) * exp(-abs(vP.y) / (vAx.x * 4.)));
  float alpha = clamp(a * vCol.a + st * .9, 0., 1.);
  vec3 col = pow(vCol.rgb, vec3(1. / 2.2)) * a * vCol.a + vec3(1., .95, .85) * st;
  gl_FragColor = vec4(col, alpha);
}`

// ---------------------------------------------------------------- the set, solved from the layout
function solveSet(v) {
  const W = v.width
  const H = v.height
  const phone = !!v.mobile
  const type = v.type
  const fs = type.size
  const capTop = Math.min(...type.lines.map((l) => l.baseline)) - fs * 0.72
  const barB = v.bar.y + v.bar.h
  const faceTopS = Math.max(barB + 120, capTop - fs * (phone ? 0.42 : 0.4))
  const backS = faceTopS - (phone ? 92 : Math.min(150, (faceTopS - barB) * 0.3))
  const contactS = faceTopS - (phone ? 30 : 46)
  const avail = contactS - (barB + (phone ? 30 : 62))
  const Rs = Math.max(40, Math.min(avail / 2.12, phone ? W * 0.37 : W * (H > W ? 0.24 : 0.15)))
  let gx = phone ? W * 0.53 : W * 0.735
  // where the copy plate rises above the ledge (tall screens), the globe stands clear of it
  const pl = v.plates.find((q) => q.y > barB + 1)
  if (!phone && pl && pl.y < contactS + 10) gx = Math.max(Rs * 1.2, Math.min(gx, pl.x - Rs * 1.15 - 16))
  const gcS = contactS - 1.12 * Rs
  const D = phone ? 1500 : 2400
  const F = H - faceTopS
  const camY = H - gcS + 0.95 * Rs
  const yb = H - backS
  const yc = H - contactS
  const depth = (D * (F - camY)) / (yb - camY) - D
  const zc = D - (D * (F - camY)) / (yc - camY)
  const s = D / (D - zc)
  const R = Rs / s
  const G = [gx, F + 1.12 * R, zc]
  const wallZ = Math.max(depth + 40, -zc + 8.5 * R)
  // the object's box on screen (css px, y up), with a margin
  const box = { x0: gx - 1.12 * Rs - 8, x1: gx + 1.12 * Rs + 8, y0: H - (contactS + 0.06 * Rs + 6), y1: H - (gcS - Rs - 8) }
  return { W, H, phone, F, camX: gx, camY, D, depth, wallZ, R, G, s, Rs, box, faceTopS, barB }
}

/** The settled stretches of the loop (scene seconds), for stills. Pure. */
function holdsOf(p) {
  const T = p.cycle
  const ts = p.shakeAt
  // all flakes are home by (T - 3.5) after the shake, and stay until the next one
  return [[0, ts], [(ts + T - 3.5) % T, T]]
}

// ---------------------------------------------------------------- flakes: the simulation, in the globe's units
function rng(seed) {
  let s = seed >>> 0 || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
const LEVEL = 0.885
const RI = 0.9

function makeSim(p, hm, glitter) {
  const N = p.flakes
  const T = p.cycle
  const fps = 60
  const frames = Math.round(T * fps)
  const rnd = rng(glitter ? 77 : 41)
  const H = (x, z) => {
    const n = hm.n
    const u = clamp(((x + 0.9) / 1.8) * n - 0.5, 0, n - 1.001)
    const w = clamp(((z + 0.9) / 1.8) * n - 0.5, 0, n - 1.001)
    const i = Math.floor(u)
    const j = Math.floor(w)
    const fu = u - i
    const fw = w - j
    const g = (a, b) => hm.h[b * n + a]
    return (g(i, j) * (1 - fu) + g(i + 1, j) * fu) * (1 - fw) + (g(i, j + 1) * (1 - fu) + g(i + 1, j + 1) * fu) * fw
  }
  // home spots: on the mound, and more than their share on roofs, branches and hats
  const fl = []
  for (let k = 0; k < N; k++) {
    let x, z, y
    for (let tries = 0; tries < 40; tries++) {
      const a = rnd() * TAU
      const r = Math.sqrt(rnd()) * 0.74
      x = Math.cos(a) * r
      z = Math.sin(a) * r
      y = H(x, z)
      const raised = y > -0.33
      if (y < -0.95) continue
      if (raised || rnd() < 0.45) break
    }
    const size = glitter ? 0.009 + rnd() * 0.009 : 0.011 + Math.pow(rnd(), 2.0) * 0.02
    fl.push({
      home: [x, y + size * 0.3, z],
      tilt: 0.12 + rnd() * 0.3,
      az: rnd() * TAU,
      size,
      spin: (1.5 + rnd() * 3.5) * (rnd() < 0.5 ? -1 : 1),
      spin2: (0.6 + rnd() * 1.4) * (rnd() < 0.5 ? -1 : 1),
      flut: rnd() * TAU,
      fdir: rnd() * TAU,
      seed: rnd(),
      metal: glitter ? (rnd() < 0.62 ? 0 : 1) : 0,
    })
  }
  const pos = new Float32Array(frames * N * 3)
  const ang = new Float32Array(frames * N * 2)
  const act = new Float32Array(frames * N)
  const S = fl.map((f) => ({ p: [...f.home], v: [0, 0, 0], free: false, landed: -1, from: null, a1: f.tilt, a2: f.az, cum: 0 }))
  const dt = 1 / fps
  const vt = glitter ? 0.085 : 0.11
  const tauD = 0.2
  const shakeLen = 1.1
  // the flow the shake leaves in the liquid: a side-to-side slosh, a vortex that spins down, a lift in the middle
  const flow = (q, tau) => {
    const [x, y, z] = q
    let u = [0, 0, 0]
    const r2 = x * x + y * y + z * z
    const wall = Math.max(0, 1 - r2 / (RI * RI))
    if (tau < shakeLen) {
      const e = Math.sin((Math.PI * tau) / shakeLen)
      const sl = -Math.cos(TAU * 2.6 * tau) * 1.1 * e * p.shake
      u[0] += sl * wall
      u[1] += 0.25 * Math.abs(sl) * wall
    }
    const om = 2.6 * p.shake * (1 - Math.exp(-tau / 0.35)) * Math.exp(-tau / 2.4)
    // rotation about a slightly tipped axis
    const ax = [0.25, 1, 0.15]
    const al = Math.hypot(...ax)
    const a = ax.map((c) => c / al)
    const cr = [a[1] * z - a[2] * y, a[2] * x - a[0] * z, a[0] * y - a[1] * x]
    for (let i = 0; i < 3; i++) u[i] += cr[i] * om * wall
    // the lift: up through the middle, down by the glass
    const lift = 1.25 * p.shake * Math.exp(-tau / 1.5) * (1 - Math.exp(-tau / 0.25))
    const rh = Math.hypot(x, z)
    u[1] += lift * (1 - 2.2 * rh * rh) * wall
    // a slow curl, so no two flakes take the same road
    const cu = 0.08 * p.shake * Math.exp(-tau / 4)
    u[0] += cu * Math.sin(3.1 * y + 1.7 * z + tau * 0.9)
    u[1] += cu * Math.sin(2.7 * z + 2.3 * x - tau * 0.7)
    u[2] += cu * Math.sin(2.9 * x + 1.3 * y + tau * 0.8)
    return u
  }
  const steerAt = T - 7.0
  const homeBy = T - 3.5
  for (let fi = 0; fi < frames; fi++) {
    const tau = fi * dt
    for (let k = 0; k < N; k++) {
      const st = S[k]
      const f = fl[k]
      let a = 0
      if (!st.free && st.landed < 0 && tau < 3.0) {
        const u = flow(st.p, tau)
        if (Math.hypot(...u) > 0.05 + 0.06 * f.seed) {
          st.free = true
          st.v = [u[0], u[1] + 0.35 + 0.45 * f.seed, u[2]]
        }
      }
      if (st.free) {
        const u = flow(st.p, tau)
        // flutter: flat flakes rock side to side as they fall
        const fl2 = 0.035 * Math.sin(f.flut + tau * 5.2)
        const fd = [Math.cos(f.fdir), 0, Math.sin(f.fdir)]
        for (let i = 0; i < 3; i++) st.v[i] += ((u[i] + fd[i] * fl2 - st.v[i]) / tauD) * dt
        st.v[1] -= (vt / tauD) * dt
        // steered home in the late settle (unseen in the swirl's decay)
        if (tau > steerAt) {
          const k1 = 3.2 * smooth(steerAt, homeBy - 0.6, tau)
          st.v[0] += ((f.home[0] - st.p[0]) * k1 - st.v[0] * 0.6 * k1) * dt * 2
          st.v[2] += ((f.home[2] - st.p[2]) * k1 - st.v[2] * 0.6 * k1) * dt * 2
          const late = smooth(homeBy - 2.4, homeBy - 0.4, tau)
          st.v[1] = st.v[1] * (1 - late) + Math.min(st.v[1], (f.home[1] - st.p[1]) * 2.5 - 0.02) * late
        }
        for (let i = 0; i < 3; i++) st.p[i] += st.v[i] * dt
        // stay in the liquid
        const r = Math.hypot(...st.p)
        if (r > RI - 0.03) for (let i = 0; i < 3; i++) st.p[i] *= (RI - 0.03) / r
        if (st.p[1] > LEVEL - 0.04) st.p[1] = LEVEL - 0.04
        const sp = Math.hypot(...st.v)
        a = clamp(sp / 0.12, 0, 1)
        // land on whatever is under it: near its home spot, or anywhere at the very end; otherwise
        // the flow sweeps it along the snow and up again
        const hh = H(st.p[0], st.p[2])
        if (st.p[1] <= hh + f.size * 0.3 && tau > 1.2) {
          const near = Math.hypot(f.home[0] - st.p[0], f.home[2] - st.p[2]) < 0.045
          if (near || tau > homeBy - 0.9) {
            st.free = false
            st.landed = tau
            st.from = [st.p[0], hh + f.size * 0.3, st.p[2]]
            st.v = [0, 0, 0]
          } else {
            st.p[1] = hh + f.size * 0.3
            st.v[1] = Math.max(st.v[1], 0) + (tau > steerAt ? 0.06 : 0.015)
          }
        }
      } else if (st.landed >= 0) {
        // a short slide onto the home spot (it landed within a few pixels of it)
        const e = smooth(st.landed, st.landed + 0.8, tau)
        const fr = st.from
        st.p = [fr[0] + (f.home[0] - fr[0]) * e, fr[1] + (f.home[1] - fr[1]) * e, fr[2] + (f.home[2] - fr[2]) * e]
      }
      if (tau >= homeBy) {
        st.p = [...f.home]
        st.free = false
      }
      // what is drawn: the simulated flake, eased onto its home spot over the last of the settle
      const w = Math.pow(smooth(homeBy - 3.2, homeBy, tau), 1.6)
      const shown = [st.p[0] + (f.home[0] - st.p[0]) * w, st.p[1] + (f.home[1] - st.p[1]) * w, st.p[2] + (f.home[2] - st.p[2]) * w]
      st.cum += a * dt
      st.a1 += f.spin * a * dt
      st.a2 += f.spin2 * a * dt
      pos.set(shown, (fi * N + k) * 3)
      ang[(fi * N + k) * 2] = st.a1
      ang[(fi * N + k) * 2 + 1] = st.a2
      act[fi * N + k] = a
    }
  }
  // the tumble closes the loop: spread the leftover angle over the moving part
  for (let k = 0; k < N; k++) {
    const f = fl[k]
    const end1 = S[k].a1
    const end2 = S[k].a2
    const d1 = end1 - f.tilt - TAU * Math.round((end1 - f.tilt) / TAU)
    const d2 = end2 - f.az - TAU * Math.round((end2 - f.az) / TAU)
    const tot = Math.max(S[k].cum, 1e-6)
    let c = 0
    for (let fi = 0; fi < frames; fi++) {
      c += act[fi * N + k] / fps
      ang[(fi * N + k) * 2] -= (d1 * c) / tot
      ang[(fi * N + k) * 2 + 1] -= (d2 * c) / tot
    }
  }
  return { N, frames, fps, pos, ang, act, fl, T }
}

// ---------------------------------------------------------------- optics in JS (the same as the shaders), for putting flakes on screen
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a) => mul(a, 1 / Math.hypot(a[0], a[1], a[2]))
const refract = (i, n, eta) => {
  const c = dot(n, i)
  const k = 1 - eta * eta * (1 - c * c)
  if (k < 0) return null
  return sub(mul(i, eta), mul(n, eta * c + Math.sqrt(k)))
}
const sphere = (ro, rd, c, r) => {
  const oc = sub(ro, c)
  const b = dot(oc, rd)
  const d = b * b - (dot(oc, oc) - r * r)
  if (d < 0) return null
  const s = Math.sqrt(d)
  return [-b - s, -b + s]
}
const yaw = (a, v) => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]
}

export default {
  holdsOf,
  solveSet,

  async init(c) {
    this.ctx = c
    this.p = c.params
    const p = this.p
    // the settled stretches of the loop (scene seconds): stills and posters come from inside them
    window.__snowGlobeHolds = holdsOf(p)
    const gl = c.canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: !!c.recording })
    if (!gl) throw new Error('WebGL is not available')
    this.gl = gl
    this.fext = gl.getExtension('OES_texture_float')
    this.flin = gl.getExtension('OES_texture_float_linear')
    const sh = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s))
      return s
    }
    const program = (vs, fs) => {
      const pr = gl.createProgram()
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs))
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs))
      gl.bindAttribLocation(pr, 0, 'aPos')
      gl.linkProgram(pr)
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr))
      const U = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (o[k] = gl.getUniformLocation(pr, k))) })
      return { pr, U }
    }
    this.P = {
      room: program(VERT, ROOM_FRAG),
      obj: program(VERT, OBJ_FRAG),
      height: program(VERT, HEIGHT_FRAG),
      frame: program(VERT, FRAME_FRAG),
      flake: program(FLAKE_VERT, FLAKE_FRAG),
    }
    this.quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    this.flakeBuf = gl.createBuffer()
    this.glitter = p.flakeKind === 'glitter'
    // the palette, as linear light
    this.pal = {
      uWall: lin(p.wall),
      uStone: lin(p.stone),
      uTop: lin(p.ledge),
      uPaint: lin(p.paint),
      uSun: lin(p.sun).map((x) => x * p.sunStrength),
      uAmb: lin(p.fill).map((x) => x * 1.6),
      uWood: lin(p.base === 'ebony' ? '#2a2624' : '#7a5a40').map((x) => x * 0.9),
      uBrass: lin('#c9a25e'),
      uTint: lin(p.scene === 'observatory' ? '#4a5a8a' : '#c8d6e2'),
      uSnow: lin(this.glitter ? '#c9d3e6' : '#eef1f5'),
    }
    // stone and wall are authored as the colours they show in the fill: divide the fill back out
    const fillAt = (n) => this.pal.uAmb.map((a) => a * n)
    const div = (a, b) => a.map((x, i) => x / Math.max(b[i], 0.02))
    this.pal.uStone = div(this.pal.uStone, fillAt(0.56))
    this.pal.uWall = div(this.pal.uWall, fillAt(0.56))
    this.pal.uTop = div(this.pal.uTop, fillAt(0.5))
    // the miniature's top surface, for landing
    this.scene = p.scene === 'observatory' ? 1 : 0
    const n = 128
    const hm = this.heightMap(n)
    this.sim = makeSim(p, hm, this.glitter)
    // live: a shake from the pointer (a quick move across the globe, or a press on it) starts the
    // loop's own shake now, when the snow has settled: the loop's phase moves, nothing jumps
    this.phase = 0
    this.ptr = null
    if (!c.recording && p.follow) {
      const shakeNow = () => {
        const now = c.now()
        const tau = this.tauOf(now)
        if (tau < this.sim.T - 3.5) return
        this.phase = (((now - p.shakeAt) % p.cycle) + p.cycle) % p.cycle
      }
      const overGlobe = (x, y, k) => {
        const S = this.set
        if (!S) return false
        const cy = S.H - (S.camY + (S.G[1] - S.camY) * S.s)
        return Math.hypot(x - S.camX, y - cy) < S.Rs * k
      }
      c.root.addEventListener('pointermove', (e) => {
        const r = c.root.getBoundingClientRect()
        const x = e.clientX - r.left
        const y = e.clientY - r.top
        const now = performance.now()
        if (this.ptr) {
          const sp = Math.hypot(x - this.ptr.x, y - this.ptr.y) / (Math.max(8, now - this.ptr.t) / 1000)
          if (sp > 1400 && overGlobe(x, y, 1.3)) shakeNow()
        }
        this.ptr = { x, y, t: now }
      })
      c.root.addEventListener('pointerdown', (e) => {
        const r = c.root.getBoundingClientRect()
        if (overGlobe(e.clientX - r.left, e.clientY - r.top, 1.2)) shakeNow()
      })
    }
  },

  /** The miniature from above, as heights (globe units). */
  heightMap(n) {
    const gl = this.gl
    const { pr, U } = this.P.height
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.useProgram(pr)
    gl.uniform1f(U.uScene, this.scene)
    gl.uniform2f(U.uHRes, n, n)
    gl.viewport(0, 0, n, n)
    this.drawQuad()
    const px = new Uint8Array(n * n * 4)
    gl.readPixels(0, 0, n, n, gl.RGBA, gl.UNSIGNED_BYTE, px)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fb)
    gl.deleteTexture(tex)
    const h = new Float32Array(n * n)
    for (let i = 0; i < n * n; i++) h[i] = ((px[i * 4] + px[i * 4 + 1] / 255) / 255) * 2 - 1
    return { n, h }
  },

  drawQuad() {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  },

  target(w, h, filter) {
    const gl = this.gl
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { tex, fb, w, h }
  },

  free() {
    const gl = this.gl
    for (const k of ['RF', 'RS', 'O', 'D', 'TX']) {
      const t = this[k]
      if (!t) continue
      if (t.fb) gl.deleteFramebuffer(t.fb)
      gl.deleteTexture(t.tex)
      this[k] = null
    }
  },

  /** Uniforms every pass shares: the set and the palette. */
  common(U) {
    const gl = this.gl
    const S = this.set
    const v = this.view
    const p = this.p
    gl.uniform2f(U.uView, v.width, v.height)
    gl.uniform1f(U.uDpr, v.dpr)
    gl.uniform3f(U.uCam, S.camX, S.camY, S.D)
    gl.uniform1f(U.uF, S.F)
    gl.uniform1f(U.uDepth, S.depth)
    gl.uniform1f(U.uWallZ, S.wallZ)
    gl.uniform3fv(U.uG, S.G)
    gl.uniform1f(U.uR, S.R)
    gl.uniform3f(U.uBase, 0.8 * S.R, 0.76 * S.R, 0.42 * S.R)
    gl.uniform3fv(U.uL, S.L)
    gl.uniform1f(U.uWinX, S.winX)
    gl.uniform4fv(U.uWin, S.win)
    gl.uniform2fv(U.uMul, S.mul)
    for (const k in this.pal) gl.uniform3fv(U[k], this.pal[k])
    gl.uniform1f(U.uScene, this.scene)
    gl.uniform1f(U.uTyaw, this.scene ? 0 : 0.42)
    gl.uniform1f(U.uLip, p.lipLight)
    gl.uniform1f(U.uPolish, p.polish)
    gl.uniform4fv(U.uCopy, S.copy)
    gl.uniform1f(U.uLitG, S.litG)
  },

  resize(view) {
    this.view = view
    const gl = this.gl
    const p = this.p
    const W = Math.max(1, Math.round(view.width * view.dpr))
    const H = Math.max(1, Math.round(view.height * view.dpr))
    this.ctx.canvas.width = W
    this.ctx.canvas.height = H
    const S = (this.set = solveSet(view))
    // the key light, and the window it comes through (solved so the headline's part of the face stays in the fill)
    const Lr = this.scene ? [-0.42, 0.55, 0.72] : [-0.74, 0.52, 0.42]
    const ll = Math.hypot(...Lr)
    S.L = Lr.map((x) => x / ll)
    const L = S.L
    S.winX = -Math.max(500, view.width * 0.45)
    const proj = (P) => {
      const sd = (S.winX - P[0]) / L[0]
      return [P[1] + L[1] * sd, P[2] + L[2] * sd]
    }
    const qg = proj(S.G)
    const tr = Math.max(...view.type.lines.map((l) => l.x + l.w))
    let faceMax = -1e9
    for (let x = 0; x <= (this.scene ? view.width : tr + 40); x += 20) faceMax = Math.max(faceMax, proj([x, S.F - 2, 0])[0])
    const R = S.R
    // the wall low behind the globe is what the glass shows, upside down: keep it in the sun
    const low = proj([S.G[0], S.F - R * 1.5, -S.wallZ])
    const sill = Math.min(S.phone ? qg[0] - R * 2.6 : Math.max(faceMax + 30, qg[0] - R * 3.2), low[0] - R * 0.4)
    if (this.scene) {
      // a shaft from the dome's slit: it takes in the globe and falls on the ledge and the wall behind it
      S.win = [qg[0] - R * 1.35, qg[0] + R * 1.25, qg[1] - R * 1.5, qg[1] + R * 1.05]
      S.mul = [1e6, 1e6]
    } else {
      const head = qg[0] + R * (S.phone ? 2.4 : 3.4)
      S.win = [sill, head, qg[1] - R * (S.phone ? 6 : 9), qg[1] + R * 1.6]
      const behind = proj([S.G[0] + R * 0.3, S.F - R * 0.6, -S.wallZ])
      S.mul = [behind[1], behind[0]]
    }
    // is the globe in the light (for the flakes' glints and the inside of the glass)
    const wm = (P) => {
      const q = proj(P)
      const w = S.win
      return q[0] > w[0] && q[0] < w[1] && q[1] > w[2] && q[1] < w[3] ? 1 : 0
    }
    S.litG = wm(S.G)
    // the copy plate (the label frame goes round it)
    const top = view.bar.y + view.bar.h + 1
    const pl = view.plates.find((q) => q.y > top)
    S.copy = pl ? [pl.x, view.height - (pl.y + pl.h), pl.w, pl.h] : [0, 0, 0, 0]
    this.free()
    this.textTex(view)
    // room: fill and sun
    this.RF = this.target(W, H, gl.LINEAR)
    this.RS = this.target(W, H, gl.LINEAR)
    {
      const { pr, U } = this.P.room
      gl.useProgram(pr)
      this.common(U)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.TX.tex)
      gl.uniform1i(U.uText, 0)
      gl.uniform1f(U.uTF, this.TX.float ? 1 : 0)
      gl.uniform4fv(U.uTextBox, this.TX.box)
      for (const [out, t] of [[0, this.RF], [1, this.RS]]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb)
        gl.viewport(0, 0, W, H)
        gl.uniform1f(U.uOut, out)
        this.drawQuad()
      }
    }
    // the object, in strips (a long single draw can trip a GPU watchdog)
    const b = S.box
    const ox = Math.max(0, Math.floor(b.x0 * view.dpr))
    const oy = Math.max(0, Math.floor(b.y0 * view.dpr))
    const ow = Math.min(W, Math.ceil(b.x1 * view.dpr)) - ox
    const oh = Math.min(H, Math.ceil(b.y1 * view.dpr)) - oy
    this.obox = [ox, oy, ow, oh]
    this.O = this.target(ow, oh, gl.LINEAR)
    this.D = this.target(ow, oh, gl.NEAREST)
    {
      const { pr, U } = this.P.obj
      gl.useProgram(pr)
      this.common(U)
      gl.uniform2f(U.uOrg, ox, oy)
      gl.enable(gl.SCISSOR_TEST)
      for (const [out, t] of [[0, this.O], [1, this.D]]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb)
        gl.viewport(0, 0, ow, oh)
        gl.uniform1f(U.uOut, out)
        const strip = 48
        for (let y = 0; y < oh; y += strip) {
          gl.scissor(0, y, ow, Math.min(strip, oh - y))
          this.drawQuad()
        }
      }
      gl.disable(gl.SCISSOR_TEST)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, W, H)
  },

  /** The headline's glyphs as a signed distance field (css px), over the headline's box only. */
  textTex(v) {
    const gl = this.gl
    const type = v.type
    const dpr = v.dpr
    const fs = type.size
    let x0 = 1e9
    let y0 = 1e9
    let x1 = -1e9
    let y1 = -1e9
    for (const l of type.lines) {
      x0 = Math.min(x0, l.x)
      x1 = Math.max(x1, l.x + l.w)
      y0 = Math.min(y0, l.baseline - fs)
      y1 = Math.max(y1, l.baseline + fs * 0.35)
    }
    x0 -= 40
    x1 += 40
    y0 -= 20
    y1 += 20
    const w = Math.max(4, Math.ceil((x1 - x0) * dpr))
    const h = Math.max(4, Math.ceil((y1 - y0) * dpr))
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr)
    g.fillStyle = '#000'
    g.textBaseline = 'alphabetic'
    if ('letterSpacing' in g) g.letterSpacing = `${type.letterSpacing}px`
    const bake = /[?&]sgh-bake\b/.test(location.search)
    if (!bake)
      for (const line of type.lines)
        for (const part of line.parts) {
          g.font = type.font(part.italic)
          g.fillText(part.text, part.x, line.baseline)
        }
    const img = g.getImageData(0, 0, w, h).data
    const N = w * h
    const ins = new Float64Array(N)
    const out = new Float64Array(N)
    for (let i = 0; i < N; i++) {
      const a = img[i * 4 + 3] / 255
      ins[i] = a > 0.5 ? 0 : 1e20
      out[i] = a > 0.5 ? 1e20 : 0
    }
    edt(ins, w, h)
    edt(out, w, h)
    const sd = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const a = img[i * 4 + 3] / 255
      let s = a > 0.5 ? Math.sqrt(out[i]) - 0.5 : -(Math.sqrt(ins[i]) - 0.5)
      if (Math.abs(s) < 1.2) s = a - 0.5
      sd[i] = clamp(s / dpr, -40, 40)
    }
    // a light blur so the cut's facets read as planes
    const tmp = new Float32Array(N)
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) {
        const r = y * w
        for (let x = 0; x < w; x++) tmp[r + x] = (sd[r + Math.max(0, x - 1)] + sd[r + x] + sd[r + Math.min(w - 1, x + 1)]) / 3
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sd[y * w + x] = (tmp[Math.max(0, y - 1) * w + x] + tmp[y * w + x] + tmp[Math.min(h - 1, y + 1) * w + x]) / 3
    }
    const useF = !!(this.fext && this.flin)
    let px
    if (useF) {
      px = new Float32Array(N * 4)
      for (let i = 0; i < N; i++) px[i * 4] = sd[i]
    } else {
      px = new Uint8Array(N * 4)
      for (let i = 0; i < N; i++) px[i * 4] = clamp(Math.round((0.5 + sd[i] / 48) * 255), 0, 255)
    }
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, useF ? gl.FLOAT : gl.UNSIGNED_BYTE, px)
    for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, val)
    // the box in css px with y down: x, y, w, h
    this.TX = { tex, float: useF, box: [x0, y0, x1 - x0, y1 - y0] }
  },

  /** The loop's own clock: seconds since the shake began (the shake starts p.shakeAt into the loop). */
  tauOf(t) {
    const T = this.p.cycle
    return (((t - this.p.shakeAt - this.phase) % T) + T) % T
  },

  /** Flakes at loop time tau: from the table (pure). */
  tableAt(tau) {
    const sim = this.sim
    const f = clamp(tau * sim.fps, 0, sim.frames - 1)
    const i = Math.floor(f)
    const j = Math.min(sim.frames - 1, i + 1)
    const w = f - i
    const N = sim.N
    const pos = new Float32Array(N * 3)
    const ang = new Float32Array(N * 2)
    const act = new Float32Array(N)
    for (let k = 0; k < N; k++) {
      for (let c = 0; c < 3; c++) pos[k * 3 + c] = sim.pos[(i * N + k) * 3 + c] * (1 - w) + sim.pos[(j * N + k) * 3 + c] * w
      for (let c = 0; c < 2; c++) ang[k * 2 + c] = sim.ang[(i * N + k) * 2 + c] * (1 - w) + sim.ang[(j * N + k) * 2 + c] * w
      act[k] = sim.act[i * N + k] * (1 - w) + sim.act[j * N + k] * w
    }
    return { pos, ang, act }
  },

  stateAt(t) {
    return this.tableAt(this.tauOf(t))
  },

  /** The shake: the object's offset (css px) and the liquid's tilt at loop time tau. Pure. */
  shakeAt(tau) {
    const p = this.p
    const len = 1.1
    let x = 0
    let y = 0
    if (tau < len) {
      const e = Math.pow(Math.sin((Math.PI * tau) / len), 0.8)
      x = Math.sin(TAU * 2.6 * tau) * e * 9 * p.shake
      y = Math.abs(Math.sin(TAU * 2.6 * tau)) * e * 3 * p.shake
    }
    // the surface lags the glass, rocks and comes to rest
    const sl = tau < 6 ? -0.30 * p.shake * Math.exp(-tau / 1.1) * Math.sin(TAU * 1.5 * tau) * smooth(0, 0.25, tau) : 0
    const sz = tau < 6 ? 0.08 * p.shake * Math.exp(-tau / 1.3) * Math.sin(TAU * 1.1 * tau + 0.7) * smooth(0, 0.3, tau) : 0
    return { x, y, sl, sz }
  },

  /** A point of the liquid (globe-local, scene frame) to the screen through the glass, by solving the refraction. */
  toScreen(q, S, off, guess) {
    const yawA = this.scene ? 0 : 0.42
    const g = yaw(yawA, q)
    const G = [S.G[0] + off[0], S.G[1] + off[1], S.G[2]]
    const P = add(G, mul(g, S.R))
    const cam = [S.camX, S.camY, S.D]
    const trace = (sx, sy) => {
      const rd = norm([sx - cam[0], sy - cam[1], -cam[2]])
      const h = sphere(cam, rd, G, S.R)
      if (!h) return null
      const Ps = add(cam, mul(rd, h[0]))
      const d1 = refract(rd, norm(sub(Ps, G)), 1 / 1.505)
      if (!d1) return null
      const h2 = sphere(Ps, d1, G, S.R * RI)
      if (!h2 || h2[0] < 0) return null
      const p2 = add(Ps, mul(d1, h2[0]))
      const d2 = refract(d1, norm(sub(p2, G)), 1.505 / 1.333)
      if (!d2) return null
      return { o: p2, d: d2 }
    }
    let s = guess || [S.camX + (P[0] - S.camX) * S.s * 1.1, S.camY + (P[1] - S.camY) * S.s * 1.1]
    let tr = null
    let J = null
    for (let it = 0; it < 6; it++) {
      tr = trace(s[0], s[1])
      if (!tr) return null
      const e = (t) => {
        const w = sub(P, t.o)
        return sub(w, mul(t.d, dot(w, t.d)))
      }
      const e0 = e(tr)
      const tx = trace(s[0] + 0.5, s[1])
      const ty = trace(s[0], s[1] + 0.5)
      if (!tx || !ty) return null
      const ex = mul(sub(e(tx), e0), 2)
      const ey = mul(sub(e(ty), e0), 2)
      // least squares for the 2D step
      const a = dot(ex, ex)
      const b = dot(ex, ey)
      const c = dot(ey, ey)
      const r1 = -dot(ex, e0)
      const r2 = -dot(ey, e0)
      const det = a * c - b * b
      if (Math.abs(det) < 1e-12) return null
      const dx = (r1 * c - r2 * b) / det
      const dy = (a * r2 - b * r1) / det
      s = [s[0] + clamp(dx, -60, 60), s[1] + clamp(dy, -60, 60)]
      J = Math.sqrt(Math.abs(det))
      if (Math.abs(dx) + Math.abs(dy) < 0.05) break
    }
    const w = sub(P, tr.o)
    const tLocal = dot(w, tr.d) / S.R
    // px per world unit across the ray, from the Jacobian (world units per px)
    const scale = 1 / Math.max(1e-6, Math.sqrt(J))
    return { s, t: tLocal, scale, view: tr.d, gz: g[2] }
  },

  seek(t, state) {
    const { gl, view: v, p } = this
    if (!v || !this.set) return
    const S = this.set
    // the clock: the loop's table, a pure function of t (a shake from the pointer moves the loop's phase)
    const tau = this.tauOf(t)
    const sh = this.shakeAt(tau)
    const fl = this.tableAt(tau)
    const flPrev = this.tableAt(Math.max(0, tau - 1 / 60))
    const off = [sh.x / S.s, sh.y / S.s]
    // ---- the frame
    const { pr, U } = this.P.frame
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, Math.round(v.width * v.dpr), Math.round(v.height * v.dpr))
    gl.useProgram(pr)
    this.common(U)
    gl.uniform1f(U.uGrain, p.grain)
    gl.uniform3fv(U.uPlate, hex(this.ctx.theme.plate ?? this.ctx.theme.background))
    gl.uniform2f(U.uOff, sh.x, sh.y)
    gl.uniform3f(U.uOffW, off[0], off[1], 0)
    gl.uniform3f(U.uLevel, sh.sl, sh.sz, LEVEL)
    gl.uniform4fv(U.uOBox, this.obox)
    const bind = (unit, tex, name) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(U[name], unit)
    }
    bind(0, this.RF.tex, 'uRF')
    bind(1, this.RS.tex, 'uRS')
    bind(2, this.O.tex, 'uO')
    bind(3, this.D.tex, 'uD')
    gl.disable(gl.BLEND)
    this.drawQuad()
    // ---- the flakes
    this.drawFlakes(fl, flPrev, sh, off)
  },

  drawFlakes(fl, flPrev, sh, off) {
    const { gl, view: v, p } = this
    const S = this.set
    const sim = this.sim
    const N = sim.N
    const dpr = v.dpr
    const L = S.L
    const yawA = this.scene ? 0 : 0.42
    const Ll = yaw(-yawA, L)
    const lit = S.litG
    const data = new Float32Array(N * 6 * 17)
    let n = 0
    const corners = [[-1, -1], [1, -1], [-1, 1], [-1, 1], [1, -1], [1, 1]]
    for (let k = 0; k < N; k++) {
      const q = [fl.pos[k * 3], fl.pos[k * 3 + 1], fl.pos[k * 3 + 2]]
      // solved from the same first guess every frame, so a frame depends on t alone
      const r = this.toScreen(q, S, off, null)
      if (!r) continue
      const qp = [flPrev.pos[k * 3], flPrev.pos[k * 3 + 1], flPrev.pos[k * 3 + 2]]
      const rp = this.toScreen(qp, S, off, r.s)
      const f = sim.fl[k]
      const a1 = fl.ang[k * 2]
      const a2 = fl.ang[k * 2 + 1]
      // the flake's normal (scene frame)
      const nrm = [Math.sin(a1) * Math.cos(a2), Math.cos(a1), Math.sin(a1) * Math.sin(a2)]
      const viewD = yaw(-yawA, r.view)
      const facing = Math.abs(dot(nrm, viewD))
      const rad = f.size * S.R * r.scale * dpr
      // tumbling flakes go thin edge-on; resting ones lie flat and are seen from above at an angle
      const aspect = clamp(facing, 0.18, 1)
      // its long axis on screen: perpendicular to the normal's screen direction
      const ns = [nrm[0], nrm[1]]
      const phi = Math.atan2(ns[1], ns[0]) + Math.PI / 2
      // light: thin flakes pass light from either side; a glint when the mirror angle lines up
      const ndl = Math.abs(dot(nrm, Ll))
      const refl = sub(viewD, mul(nrm, 2 * dot(viewD, nrm)))
      const g = Math.pow(Math.max(0, dot(refl, Ll)), this.glitter ? 50 : 30) + Math.pow(Math.max(0, dot(mul(refl, -1), Ll)), this.glitter ? 50 : 30) * 0.4
      let col
      let alpha
      let star = 0
      if (this.glitter) {
        const gold = f.metal ? [0.86, 0.9, 1.0] : [1.0, 0.76, 0.38]
        const lum = 0.16 + 0.25 * ndl * lit + 5.0 * g * lit
        col = gold.map((c) => Math.min(1.6, c * lum))
        alpha = 0.95
        star = clamp((g * lit - 0.25) * 1.4, 0, 1) * (rad > 1.2 ? 1 : 0.5)
      } else {
        const lum = 0.78 + 0.35 * ndl * lit + 2.2 * g * lit
        col = [0.95, 0.96, 0.98].map((c) => Math.min(1.4, c * lum))
        alpha = 0.92
      }
      // the depth of field: flakes near the front glass soften
      const blur = clamp((r.gz - 0.25) * 9, 0, 6) * dpr * 0.6
      // motion: the stretch over half a frame
      let vel = [0, 0]
      if (rp) vel = [(r.s[0] - rp.s[0]) * dpr * 0.5, (r.s[1] - rp.s[1]) * dpr * 0.5]
      const cx = (r.s[0] + 0) * dpr
      const cy = r.s[1] * dpr
      const tL = r.t
      col = col.map((c) => c * 0.94)
      for (const [qx, qy] of corners) {
        data.set([cx, cy, qx, qy, rad, rad * aspect, phi, blur, vel[0], vel[1], col[0], col[1], col[2], alpha, f.seed, tL, star], n * 17)
        n++
      }
    }
    if (!n) return
    const out = data.subarray(0, n * 17)
    const { pr, U } = this.P.flake
    gl.useProgram(pr)
    gl.uniform2f(U.uCanvas, Math.round(v.width * dpr), Math.round(v.height * dpr))
    gl.uniform4fv(U.uOBox, this.obox)
    gl.uniform2f(U.uOffD, sh.x * dpr, sh.y * dpr)
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, this.D.tex)
    gl.uniform1i(U.uD, 3)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.flakeBuf)
    gl.bufferData(gl.ARRAY_BUFFER, out, gl.DYNAMIC_DRAW)
    const st = 17 * 4
    const at = (name, size, offset) => {
      const loc = gl.getAttribLocation(pr, name)
      if (loc < 0) return
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, st, offset * 4)
    }
    at('aC', 2, 0)
    at('aQ', 2, 2)
    at('aAx', 4, 4)
    at('aV', 2, 8)
    at('aCol', 4, 10)
    at('aMisc', 3, 14)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.drawArrays(gl.TRIANGLES, 0, n)
    gl.disable(gl.BLEND)
    for (const name of ['aC', 'aQ', 'aAx', 'aV', 'aCol', 'aMisc']) {
      const loc = gl.getAttribLocation(pr, name)
      if (loc > 0) gl.disableVertexAttribArray(loc)
    }
  },
}

// squared Euclidean distance transform (Felzenszwalb), rows then columns
function edt1(f, n, d, v, z) {
  let k = 0
  v[0] = 0
  z[0] = -1e20
  z[1] = 1e20
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = 1e20
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]
  }
}
function edt(grid, w, h) {
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]
    edt1(f, h, d, v, z)
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]
    edt1(f, w, d, v, z)
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x]
  }
}
