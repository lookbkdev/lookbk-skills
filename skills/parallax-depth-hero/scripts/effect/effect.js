// Parallax Depth: a multiplane camera in code (the browser side of the
// effect; effect.mjs describes it to the kit).
//
// Six plates at real distances from the lens: the sky at infinity, three
// plates behind the headline (9, 5.4 and 3.4 units away), the headline's own
// plate (2.5) and two in front of it (1.6 and 1). A plate at distance z moves
// by cam × (2.5 / z − 1): the headline never moves, the plates behind it
// drift against the camera and the plates in front move with it, faster the
// nearer they are. One fragment shader paints every plate: its outline, its
// own texture (eroded rock, snow, a canopy of crowns, ragged spruce; or
// towers with lit floors, roofs, a festoon of lamps), its light and the air
// between it and the lens; the plates nearer than the headline are drawn
// out of focus by their circle of confusion. It runs twice a frame: the near
// plates alone, with alpha, copied to the kit's front canvas (in front of the
// letters), then the sky and the far plates, opaque, on the main canvas.
//
// The near plates may never cover more than `cover` (at most a third) of any
// letter. At every resize each letter is drawn alone and the height that
// leaves that share of its ink below is found; the shader may not draw a near
// plate above it in that letter's columns. coverage() measures the real
// share on the front canvas (scripts/coverage.mjs runs it over the story).
const SCENES = {
  range: { light: '#fff1d6', air: '#bfc6ca', lamp: '#ffd9a0' },
  city: { light: '#f3ead6', air: '#2a3047', lamp: '#f2a54a' },
}

const VERT = `attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform vec4 uType;   // the scene's anchor: top, last baseline, left, right (hero px)
uniform vec2 uCam;    // how far the sky moves (hero px); a plate at z moves uCam*(2.5/z-1)
uniform vec2 uSun;    // the sun or moon, before the camera moves
uniform vec4 uPlate;  // the copy plate: x, y, w, h (hero px)
uniform sampler2D uCeil;
uniform float uTime, uLayer, uCity, uGrain, uMist, uSeed, uSize;
uniform vec3 cSky, cGlow, cLight, cAir, cLand, cLamp, cPlate;
// the near roofs, laid out at resize under each letter's ceiling (hero px, camera at rest)
uniform vec4 uChim[4];  // chimney: x, top of the stack, half width, on
uniform vec4 uGable;    // pitched roof: x, apex, half span, on
uniform vec4 uRoof;     // flat roof top, parapet step, water tower x, its half width
uniform vec4 uFest[2];  // festoon: pole by the headline x, pole by the edge x, pole top y, on

const float ZT = 2.5;
// hashes without sine, so a seed gives the same scene on every GPU
float h11(float p){ p = fract(p * .1031 + uSeed); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031 + uSeed); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h11(i), h11(i + 1.), f); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm2(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * n2(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float ridged(float x, float sd){ float s = 0., a = .62, f = 1.; for (int i = 0; i < 5; i++){ float v = 1. - abs(n1(x * f + sd * 31.7) * 2. - 1.); s += v * v * a; a *= .42; f *= 2.17; } return s; }

vec2 offsetFor(float z){ return uCam * (ZT / z - 1.); }
float airAt(float z){ return 1. - exp(-z * mix(.2, .13, uCity)); }

float A, W;
vec2 sunP;
float toSun(vec2 q){ return clamp((sunP.x - q.x) / (.08 * W), -1., 1.); }

vec3 airColour(vec2 q){
  float d = length(q - sunP);
  vec3 a = mix(cAir, cGlow, .35);
  if (uCity < .5) return mix(a, cLight, .7 * exp(-d / (.3 * W)));
  float low = smoothstep(uType.x, uRes.y * 1.15, q.y);
  return mix(a, mix(cAir, cLamp, .5), low * .6);
}

// the lowest a near plate may reach in this column so no letter is covered past the limit (0: free)
float ceilAt(float x){
  vec4 e = texture2D(uCeil, vec2(clamp(x, 0., uRes.x - 1.) / uRes.x, .5));
  return (e.r * 255. * 256. + e.g * 255.) * .5;
}

// the copy plate, grown by m and feathered by f: 1 inside
float plateZone(vec2 q, float m, float f){
  vec2 c = uPlate.xy + uPlate.zw * .5;
  vec2 d = abs(q - c) - (uPlate.zw * .5 + m);
  return 1. - smoothstep(0., f, max(d.x, d.y));
}

// shafts of light fanning down from the low sun through the haze
float rays(vec2 q){
  vec2 d = q - sunP;
  float ang = atan(d.y, d.x);
  float k = n1(ang * 7. + uTime * .03) * (.6 + .4 * n1(ang * 15. - uTime * .02 + 7.));
  return smoothstep(.35, .9, k) * exp(-length(d) / (.5 * W)) * smoothstep(0., .08 * W, length(d)) * smoothstep(-.2 * A, .5 * A, d.y);
}

vec3 skyColour(vec2 q){
  float hor = uType.y + offsetFor(1e4).y;
  float t = clamp(q.y / max(1., hor), 0., 1.3);
  vec3 c = mix(cSky, cGlow, pow(clamp(t, 0., 1.), uCity > .5 ? 2. : 1.25));
  float d = length(q - sunP);
  float r = uCity > .5 ? .021 * min(W, uRes.y * 1.6) : .036 * min(W, uRes.y * 1.4);
  if (uCity < .5){
    c = mix(c, cLight, .5 * exp(-d / (.38 * W)) + .55 * exp(-d / (r * 2.2)));
    float ci = fbm2(vec2(q.x * .0018 + uTime * .004, q.y * .022) + 3.) * fbm2(vec2(q.x * .006, q.y * .05) + 9.);
    float hi = smoothstep(hor * .95, hor * .25, q.y);
    c = mix(c, mix(cLight, cGlow, .3), smoothstep(.2, .42, ci) * hi * (.18 + .3 * exp(-d / (.3 * W))));
    c = mix(c, vec3(1., .99, .96), smoothstep(r + 1.2, r - 1.2, d));
    c = mix(c, cLight, rays(q) * .22);
  } else {
    c += cLamp * .2 * smoothstep(.6, 1.2, t);
    vec2 g = floor(q / 3.);
    float s = step(.9972, h21(g)) * (1. - smoothstep(.1, .6, t));
    c += vec3(.75, .78, .85) * s * (.3 + .4 * h21(g + 7.));
    float m = smoothstep(r + 1., r - 1., d);
    float mare = fbm2((q - sunP) / r * 1.4 + 4.);
    c = mix(c, cLight * (.8 + .22 * mare), m);
    c += cLight * (.14 * exp(-d / (r * 3.)) + .05 * exp(-d / (r * 12.))) * (1. - m);
  }
  return c;
}

/* ------------------------------------------------------------ the range */

float rangeCrest(int i, float x){
  if (i == 0) return uType.x + .85 * A - 1.3 * A * ridged(x / (1.05 * W), 1.);
  if (i == 1) return uType.y + .22 * A - .72 * A * ridged(x / (.72 * W), 2.);
  if (i == 2) return uType.y + .55 * A - .55 * A * ridged(x / (.55 * W), 3.);
  if (i == 3) return uType.y + .16 * uSize - .2 * uSize * ridged(x / (.8 * W), 4.);
  return uRes.y * 1.03 - .03 * uRes.y * n1(x / (.3 * W) + 9.);
}

// eroded rock: gullies running down the slope; the faces turned to the low sun catch it
vec3 rock(vec2 q, vec2 lp, float s, float sd, out float e){
  vec2 p = vec2(lp.x * .006, lp.y * .017) * s;
  p.x += .9 * fbm2(p * .6 + 5.);
  e = fbm2(p);
  float ex = fbm2(p + vec2(.04, 0.)) - e;
  float lit = clamp(.5 + ex * 10. * toSun(q), 0., 1.);
  float strata = .5 + .5 * sin(lp.y * .09 * s + 6. * e);
  // rock in shade is never black: faces and ribs only ever lighten the land colour, so the
  // contrast under the headline never falls below the plain plate's
  float k = clamp(.1 * e + .5 * lit * lit * e + .05 * strata * e, 0., .6);
  return mix(cLand, mix(cAir, cLight, .5), k);
}

// a canopy of spruce crowns in rows, the side toward the sun lit (signed, + inside a crown)
float canopy(vec2 lp, float cell, out float side){
  float rh = cell * .78;
  float row = floor(lp.y / rh);
  float yy = fract(lp.y / rh);
  float xx = lp.x / cell + h11(row * 3.1) * 7.;
  float c = floor(xx);
  float f = fract(xx) - .5 + (h11(c + row * 7.3) - .5) * .35;
  side = f;
  return yy * (.42 + .3 * h11(c * 1.3 + row)) - abs(f) + .04 * (n2(lp * .4) - .5);
}

// spruce standing on a crest: whorls that droop, ragged ends, a thin leader (signed px)
float gSide, gV, gHw;
float gCapX0 = 1e6, gCapX1 = -1e6, gCapY = 0.;
float spruce(vec2 lp, float cell, float hmax, float sd, float crest, float slope, float shift){
  float best = -1e4;
  float c0 = floor(lp.x / cell);
  for (int k = -2; k <= 2; k++){
    float c = c0 + float(k);
    float clump = smoothstep(.2, .65, n1(c * .09 + sd));
    float r = h11(c * 1.37 + sd);
    if (r > .2 + .8 * clump) continue;
    float cx = (c + .5 + (h11(c * 2.91 + sd) - .5) * .9) * cell;
    float h = hmax * (.35 + .65 * h11(c * 4.13 + sd)) * (.5 + .5 * clump);
    float base0 = crest + slope * (cx - lp.x);
    // a near tree grows only as tall as the letters in front of it allow (screen x = cx + shift)
    if (shift > -1e3){
      float cy = max(max(ceilAt(cx + shift - .08 * h), ceilAt(cx + shift)), ceilAt(cx + shift + .08 * h));
      if (cy > 0.) h = min(h, max(0., (base0 + uCam.y * (ZT / 1.6 - 1.) - cy) / .9 - 3.));
      if (h < hmax * .12) continue;
    }
    // a tree under the copy plate stays below it
    if (cx > gCapX0 && cx < gCapX1){ h = min(h, max(0., (base0 - gCapY) / .9)); if (h < hmax * .4) continue; }
    if (h < hmax * .12) continue;
    float base = base0 + h * .1;
    float v = (base - lp.y) / h;
    if (v < -.05 || v > 1.02) continue;
    float dx = lp.x - cx - (h11(c * 7.7 + sd) - .5) * .06 * h * v * v;
    float side = dx < 0. ? -1. : 1.;
    float n = 7. + 5. * r;
    float droop = pow(fract(v * n + r * 3.), .45);
    float rag = n2(vec2(v * 60. + c, side * 4.1 + c * .7)) - .5;
    float taper = pow(max(1. - v, 0.), 1.15);
    float hw = h * .21 * taper * (.45 + .55 * droop + .4 * rag) + h * .012 * (1. - v);
    float d = hw - abs(dx);
    if (d > best){ best = d; gSide = dx / max(hw, 1.); gV = v; gHw = hw; }
  }
  return best;
}

// grass at the lens, out of focus: a thin blade blurred wider than itself turns faint
// (coverage, 0..1), backlit blades let the low sun through; tips that catch it bloom into discs
vec4 grass(vec2 lp, vec2 q, float base, float coc, float near){
  float cover = 0.;
  float glow = 0.;
  float bok = 0.;
  float cell = 15.;
  float c0 = floor(lp.x / cell);
  float hmaxAll = .34 * uRes.y;
  if (lp.y < base - hmaxAll - coc * 2.) return vec4(0.);
  for (int k = -4; k <= 4; k++){
    float c = c0 + float(k);
    float r = h11(c * 3.7 + 11.);
    // keep the blades lower under the copy, so the plate sits in clear mist
    float under = plateZone(vec2((c + .5) * cell, uPlate.y + 1.), 40., 60.);
    float h = hmaxAll * (.08 + .92 * r * r * r) * (.3 + .7 * n1(c * .05 + 3.));
    h = mix(h, min(h, base - (uPlate.y + uPlate.w + 40.)), under);
    if (h < 6.) continue;
    float bx = (c + .5) * cell;
    float lean = (h11(c * 5.1) - .4) * .55 + .05 * sin(uTime * .8 + c * .37);
    // a seed head or dew drop at the tip, catching the sun: a disc the shape of the aperture
    if (r > .9 && h > coc * 3.){
      vec2 tip = vec2(bx + lean * h, base - h);
      float bd = length(lp - tip);
      float R = coc * 1.3;
      bok = max(bok, smoothstep(R, R - 3., bd) * (.8 + .2 * smoothstep(R - 5., R - 1., bd)) * smoothstep(.05, .5, near));
    }
    float v = (base - lp.y) / h;
    if (v < -.1 || v > 1.15) continue;
    float x = bx + lean * h * v * v;
    float hw = (2.5 + 4. * h11(c * 9.3)) * (1. - v * v) + .8;
    float d = abs(lp.x - x);
    float a = smoothstep(-coc, coc, hw - d) * min(1., (hw + 1.) / coc) * smoothstep(1.1, .95, v) * step(-.02, v);
    cover = max(cover, a);
    glow = max(glow, a * (1. - v) * .6 + a * .4);
  }
  return vec4(cover, glow, bok, 0.);
}

/* ------------------------------------------------------------ the city */

float gMx, gMy, gMast, gCellW;
float tower(float x, float cell, float tall, float salt, out float id, out float u, float base, bool mastable){
  float c = floor(x / cell);
  id = c * 1.7 + salt;
  u = fract(x / cell);
  float r = h11(c * 1.91 + salt);
  float h = tall * (.12 + .88 * pow(r, 2.4));
  if (h11(c * 3.3 + salt) > .5 && (u < .16 || u > .84)) h *= .87;
  if (u < .04 || u > .96) h *= .6;
  if (r > .86) h += tall * .35 * smoothstep(.5, .3, abs(u - .5));
  if (mastable && r > .9){
    float top = h + tall * .32;
    gMast = 1.; gMx = (c + .5) * cell; gMy = base - top;
    if (abs(u - .5) < .015) h = top;
  }
  return h;
}
float cityCrest(int i, float x, out float id, out float u){
  float cA = i == 2 ? 112. : i == 0 ? 120. : 64.;
  float cB = i == 2 ? 60. : i == 0 ? 74. : 41.;
  float s = ZT / (i == 0 ? 9. : i == 1 ? 5.4 : 3.4);
  float base = i == 0 ? uType.y + .25 * A : i == 1 ? uType.y + .58 * A : uType.y + .98 * A;
  float tall = i == 0 ? .62 * A : i == 1 ? .66 * A : .7 * A;
  float idA, uA, idB, uB;
  gMast = 0.;
  float a = tower(x, cA * s, tall, float(i) * 13.1, idA, uA, base, true);
  float b = tower(x + 23. * s, cB * s, tall * .75, float(i) * 13.1 + 5.3, idB, uB, base, false);
  if (a >= b){ id = idA; u = uA; gCellW = cA * s; return base - a; }
  id = idB; u = uB; gCellW = cB * s; return base - b;
}

// windows. Far towers (i 0, 1): whole floors lit as soft bands broken into runs, never single
// panes (they would alias). Near towers (i 2): few, large windows aligned to the tower, with a
// frame, a mullion, blinds in some, a warm interior brighter toward the sill
vec3 windowLight(vec2 lp, int i, float s, float id, float u, float sd){
  if (i < 2){
    float fh = (i == 0 ? 2.3 : 2.) * 9. * s;
    float row = floor(lp.y / fh);
    float fy = fract(lp.y / fh);
    float lit = step(i == 0 ? .84 : .74, h21(vec2(row, id)));
    float run = smoothstep(.35, .6, n1(lp.x / (fh * 2.5) + row * 7.3 + id));
    float prof = exp(-pow((fy - .5) / .24, 2.));
    float edge = smoothstep(0., .08, u) * smoothstep(1., .92, u);
    vec3 tint = mix(cLamp, vec3(.75, .8, .95), step(.8, h21(vec2(row, id + 3.))));
    return tint * lit * run * prof * edge * (i == 0 ? .3 : .42) * step(1.5 * fh, sd);
  }
  float margin = gCellW * .1;
  float wide = gCellW - 2. * margin;
  float n = max(1., floor(wide / 17.));
  float cw = wide / n;
  float xl = u * gCellW - margin;
  if (xl < 0. || xl > wide) return vec3(0.);
  float ch = 24.;
  vec2 g = vec2(xl / cw, lp.y / ch);
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float lit = step(.62, h21(cell + id * 3.1));
  float warm = step(.2, h21(cell * 1.7 + id));
  vec3 tint = mix(vec3(.62, .72, .95), cLamp, warm);
  float ax = 1. / cw, ay = 1. / ch;
  float pane = smoothstep(.2 - ax, .2 + ax, f.x) * smoothstep(.8 + ax, .8 - ax, f.x) * smoothstep(.18 - ay, .18 + ay, f.y) * smoothstep(.8 + ay, .8 - ay, f.y);
  float mull = 1. - .7 * smoothstep(1.2 * ax, .2 * ax, abs(f.x - .5));
  float blinds = h21(cell + id * 5.7) > .78 ? .75 + .25 * smoothstep(.4, .6, fract(f.y * 7.)) : 1.;
  float inside = .55 + .55 * smoothstep(.2, .8, f.y);
  float frame = pane * (1. - pane) * 4.;
  return tint * lit * pane * mull * blinds * inside * (.5 + .5 * h21(cell * 1.3 + id)) * step(ch * .8, sd);
}

// the roofs across the street, as objects: a parapet with a lit coping, chimney stacks with a cap
// and pots, a pitched roof with a ridge and a lit slope, a water tower past the end of the
// headline. Their sizes come from resize, which keeps them under each letter's ceiling.
// Returns the colour and the signed distance (>0 inside).
vec4 roofs(vec2 lp, vec2 q){
  float base = uRoof.x;
  float span = uType.w - uType.z;
  vec3 dark = mix(cPlate, cLand, .3);
  vec3 sky = mix(cLight, cGlow, .55);
  float step1 = step(.55, fract(lp.x / (.31 * span) + .2));
  float ptop = base - uRoof.y * step1;
  float sd = lp.y - ptop;
  vec3 col = dark * (.92 + .16 * fbm2(lp * .05));
  col += sky * .13 * smoothstep(3.5, 1., lp.y - ptop);
  col *= 1. - .25 * smoothstep(4., 6., lp.y - ptop) * smoothstep(9., 6., lp.y - ptop);
  // the pitched roof
  if (uGable.w > .5){
    float dx = lp.x - uGable.x;
    float ry = uGable.y + abs(dx) * .32;
    float g = min(min(lp.y - ry, uGable.z - abs(dx)), base + 1. - lp.y);
    if (g > sd - .5){
      sd = max(sd, g);
      float litSide = step(0., dx * (sunP.x - uGable.x));
      vec3 c = dark * (.85 + .25 * litSide);
      c *= 1. - .12 * smoothstep(.8, 1., fract((lp.y - ry) / 5.));
      c += sky * (.32 * litSide + .1) * smoothstep(2.2, .4, lp.y - ry);
      c += sky * .25 * smoothstep(3.5, 1., length(lp - vec2(uGable.x, uGable.y)));
      c *= 1. - .35 * smoothstep(3., 0., base - lp.y);
      col = c;
    }
  }
  // chimney stacks: a cap that overhangs, two pots on it, the side toward the moon catching it
  for (int k = 0; k < 4; k++){
    vec4 ch = uChim[k];
    if (ch.w < .5) continue;
    float dx = lp.x - ch.x;
    float hw = ch.z;
    float capH = .045 * uSize + 3.;
    float capW = hw + 2. + .012 * uSize;
    float potH = .06 * uSize + 4.;
    float pw = max(2.5, hw * .3);
    float body = min(hw - abs(dx), min(lp.y - ch.y, base + 1. - lp.y));
    float cap = min(capW - abs(dx), min(lp.y - (ch.y - capH), ch.y + 1. - lp.y));
    float pots = -1e4;
    for (int j = 0; j < 2; j++){
      float px = ch.x + (j == 0 ? -1. : 1.) * hw * .45;
      float ph = potH * (.8 + .4 * h11(float(k * 2 + j) + 4.));
      float t = clamp((ch.y - capH - lp.y) / ph, 0., 1.);
      float pot = min(pw * (1. - .18 * t) - abs(lp.x - px), min(lp.y - (ch.y - capH - ph), ch.y - capH + 1. - lp.y));
      pots = max(pots, pot);
    }
    float o = max(body, max(cap, pots));
    if (o > sd - .5){
      sd = max(sd, o);
      float toward = sign(sunP.x - ch.x);
      vec3 c = dark * (.95 + .1 * fbm2(lp * .2));
      // brick courses on the stack
      c *= 1. - .1 * smoothstep(.75, 1., fract(lp.y / 4.)) * step(0., body);
      float edge = body > 0. ? hw - abs(dx) : cap > 0. ? capW - abs(dx) : pw - abs(lp.x - ch.x - sign(dx) * hw * .45);
      c += sky * .22 * smoothstep(1.8, .3, edge) * step(0., dx * toward);
      c += sky * .2 * smoothstep(2., .4, lp.y - (ch.y - capH)) * step(0., cap);
      col = c;
    }
  }
  // the water tower: staves, three iron hoops, a conical cap, four legs
  float tw = uRoof.w;
  if (tw > 0.){
    float tx = uRoof.z;
    float tTop = base - .95 * uSize;
    float tBot = base - .42 * uSize;
    float dx = lp.x - tx;
    float tank = min(tw - abs(dx), min(lp.y - tTop, tBot - lp.y));
    float cone = min(lp.y - (tTop - .2 * uSize + abs(dx) * .2 * uSize / tw), tTop - lp.y + 1.);
    float legs = -1e4;
    for (int k = 0; k < 4; k++){
      float lx = tx + tw * (-.8 + .53 * float(k)) + (lp.y - tBot) * (float(k) - 1.5) * .08;
      legs = max(legs, min(2. - abs(lp.x - lx), min(lp.y - tBot, base - lp.y + 2.)));
    }
    float o = max(max(tank, cone), legs);
    if (o > sd - .5){
      sd = max(sd, o);
      float toward = sign(sunP.x - tx);
      vec3 c = dark * (.9 + .12 * smoothstep(.0, .2, fract(dx / 7.)));
      float hy = (lp.y - tTop) / (tBot - tTop);
      c *= 1. - .3 * step(0., tank) * (smoothstep(.03, 0., abs(hy - .2)) + smoothstep(.03, 0., abs(hy - .55)) + smoothstep(.03, 0., abs(hy - .88)));
      c += sky * .2 * smoothstep(2., .3, tw - abs(dx)) * step(0., dx * toward) * step(0., tank);
      c += sky * .18 * smoothstep(2., .3, lp.y - (tTop - .2 * uSize + abs(dx) * .2 * uSize / tw)) * step(0., cone);
      col = c;
    }
  }
  return vec4(col, sd);
}

// a festoon of lamps strung between two poles on the roofs: one by the headline, one by the
// edge of the frame with a guy wire down to the roof, so the string is held at both ends
vec4 festoon(vec2 lp){
  vec3 light = vec3(0.);
  float a = 0.;
  float base = uRoof.x;
  for (int k = 0; k < 2; k++){
    vec4 f = uFest[k];
    if (f.w < .5) continue;
    float x0 = f.x, x1 = f.y, top = f.z;
    float side = sign(x1 - x0);
    float len = abs(x1 - x0);
    float sag = .07 * len + 6.;
    for (int j = 0; j < 2; j++){
      float px = j == 0 ? x0 : x1;
      a = max(a, smoothstep(1.7, .5, abs(lp.x - px)) * step(top - 3., lp.y) * step(lp.y, base));
      a = max(a, smoothstep(3.2, 2., length(lp - vec2(px, top - 2.))));
    }
    // the guy wire from the outer pole down to the roof
    vec2 g0 = vec2(x1, top);
    vec2 g1 = vec2(x1 + side * .028 * W, base);
    vec2 gd = g1 - g0;
    float t = clamp(dot(lp - g0, gd) / dot(gd, gd), 0., 1.);
    a = max(a, smoothstep(1., .2, length(lp - g0 - gd * t)) * .7);
    float u = (lp.x - x0) / (x1 - x0);
    if (u < 0. || u > 1.) continue;
    float wy = top + sag * 4. * u * (1. - u);
    a = max(a, smoothstep(1.1, .2, abs(lp.y - wy)) * .85);
    float n = max(4., floor(len / 30.));
    float kb = floor(u * n + .5);
    float bu = kb / n;
    if (kb < .5 || kb > n - .5) continue;
    vec2 b = vec2(mix(x0, x1, bu), top + sag * 4. * bu * (1. - bu) + 4.);
    float d = length(lp - b);
    float on = .75 + .25 * h11(kb + float(k) * 9.);
    light += cLamp * (smoothstep(3.2, 1.6, d) * 1.5 + exp(-d / 8.) * .35) * on;
    a = max(a, smoothstep(3.2, 1.6, d));
  }
  return vec4(light, a);
}

void main(){
  vec2 q = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;
  W = uRes.x;
  A = max(40., uType.y - uType.x);
  sunP = uSun + offsetFor(1e4);
  float near = exp(-length(q - sunP) / (.17 * W));
  float grainK = (h21(floor(gl_FragCoord.xy) + 3.) - .5) * .04 * uGrain;
  vec3 col = vec3(0.);
  float alpha = 0.;

  if (uLayer < .5){
    col = skyColour(q);
    for (int i = 0; i < 3; i++){
      float z = i == 0 ? 9. : i == 1 ? 5.4 : 3.4;
      float s = ZT / z;
      vec2 lp = q - offsetFor(z);
      float soft = .6 + .2 * float(i);
      vec3 air = airColour(q);
      float a = airAt(z);
      float sd;
      vec3 c;
      float red = 0.;
      // nothing of this plate reaches above its highest possible crest: skip the work there
      float hiTop = uCity < .5
        ? (i == 0 ? uType.x + .85 * A - 1.45 * A : i == 1 ? uType.y + .22 * A - .8 * A : uType.y + .55 * A - .62 * A - .08 * A)
        : (i == 0 ? uType.y + .25 * A - 1.95 * .62 * A : i == 1 ? uType.y + .58 * A - 1.95 * .66 * A : uType.y + .98 * A - 1.95 * .7 * A);
      if (lp.y < hiTop - 6.) continue;
      if (uCity < .5){
        float cr = rangeCrest(i, lp.x);
        float sl = (rangeCrest(i, lp.x + 3.) - rangeCrest(i, lp.x - 3.)) / 6.;
        sd = lp.y - cr;
        float e;
        vec3 body = rock(q, lp, s, sd, e);
        if (i == 0){
          // old snow on the summits, held in the gullies
          float snow = smoothstep(uType.x + .2 * A, uType.x - .15 * A, lp.y) * smoothstep(.42, .6, e + .2 * fbm2(lp * .05));
          body = mix(body, mix(cLight, cGlow, .35) * .95, snow * .8);
        }
        if (i == 2){
          // the wooded shoulder: a canopy of small crowns, spruce on the skyline
          float side;
          float cn = canopy(lp, 7., side);
          vec3 wood = cLand * (.55 + .25 * smoothstep(-.05, .05, cn)) * (1. + .35 * clamp(side * toSun(q) * 2., -1., 1.) * step(0., cn));
          body = mix(body, wood, smoothstep(.02 * A, .12 * A, sd) * .85);
          sd = max(sd, spruce(lp, 8., .075 * A, 5., cr, sl, -1e4));
        }
        c = mix(body, air, a);
        float face = clamp(sl * toSun(q) * 1.4, 0., 1.) * exp(-max(sd, 0.) / (.22 * A));
        c = mix(c, cLight, face * .22 * (.3 + near));
        c += cLight * exp(-max(sd, 0.) / 1.1) * (.04 + .9 * near) * (1. - a) * (1. - a);
        float m = smoothstep(.04 * A, .55 * A, sd) * uMist;
        float drift = fbm2(vec2(lp.x * .003 + uTime * .01 * (1. + float(i)), lp.y * .01 + float(i) * 3.));
        c = mix(c, mix(air, cLight, .2 + .3 * near), m * (.4 + .5 * drift));
        c = mix(c, cLight, rays(q) * .35 * a);
      } else {
        float id, u;
        float cr = cityCrest(i, lp.x, id, u);
        sd = lp.y - cr;
        float g = fbm2(lp * .03 * s);
        // facades: a little light from the street below, more on the lower floors
        vec3 body = cLand * (.85 + .3 * g) + cLamp * .025 * smoothstep(0., A, sd);
        c = mix(body, air, a);
        c += windowLight(lp, i, s, id, u, sd) * (1. - a * .8) * 1.05;
        c += mix(cLight, cLamp, .3) * .05 * exp(-max(sd, 0.) / 1.) * (1. - a);
        float m = smoothstep(.05 * A, .8 * A, sd) * uMist;
        float drift = fbm2(vec2(lp.x * .003 + uTime * .01 * (1. + float(i)), lp.y * .01 + float(i) * 3.));
        c = mix(c, mix(air, cLamp, .35), m * (.25 + .35 * drift));
        // a red warning light on the masts, slowly blinking
        if (gMast > .5){
          float d = length(lp - vec2(gMx, gMy));
          red = (smoothstep(1.8 * s + .8, .6, d) + .35 * exp(-d / (5. * s + 2.))) * (.35 + .65 * smoothstep(.2, .5, abs(fract(uTime * .45 + gMx * .01) - .5) * 2.)) * (1. - a * .5);
        }
      }
      col = mix(col, c, smoothstep(-soft, soft, sd));
      col += vec3(1., .2, .12) * red;
    }
    col += grainK;
    gl_FragColor = vec4(col, 1.);
    return;
  }

  /* ---- the front pass: the plates nearer than the headline, out of focus (premultiplied) ---- */
  // circle of confusion, focused on the headline's plate: |1/z - 1/2.5|
  float coc3 = .8 + .006 * uSize;
  float coc4 = 3. + .06 * uSize;
  // above the highest near object nothing is drawn in this pass
  float front = uCity < .5 ? uType.y + .16 * uSize - .25 * uSize - .52 * uSize : uRoof.x - 1.25 * uSize;
  if (q.y < front + offsetFor(1.6).y - 12.){ gl_FragColor = vec4(0.); return; }
  {
    float z = 1.6;
    vec2 lp = q - offsetFor(z);
    vec3 air = airColour(q);
    float a = airAt(z);
    float sd;
    vec3 c;
    if (uCity < .5){
      float cr = rangeCrest(3, lp.x);
      float sl = (rangeCrest(3, lp.x + 3.) - rangeCrest(3, lp.x - 3.)) / 6.;
      float ground = lp.y - cr;
      float tr = spruce(lp, .1 * uSize + 6., .5 * uSize, 9., cr, sl, offsetFor(1.6).x);
      sd = max(ground, tr);
      float side;
      float cn = canopy(lp, .05 * uSize + 6., side);
      // needles: dark, the side toward the sun lit along its edge; sky shows through the sparse ends
      vec3 wood = cLand * (.55 + .2 * smoothstep(-.05, .05, cn) + .12 * fbm2(lp * .25));
      wood *= 1. + .4 * clamp(side * toSun(q) * 2., -1., 1.) * step(0., cn) * smoothstep(0., .1 * A, ground);
      c = mix(wood, air, a);
      bool tree = tr > ground;
      float facing = tree ? clamp(gSide * toSun(q), 0., 1.) : 1.;
      c += cLight * exp(-max(sd, 0.) / 1.8) * (.05 + 1.2 * near) * (.25 + .75 * facing);
      float holes = tree ? smoothstep(.62, .75, n2(lp * .22)) * smoothstep(.45 * gHw, 0., tr) : 0.;
      float on = smoothstep(-coc3, coc3, sd) * (1. - .7 * holes);
      col = c * on;
      alpha = on;
      // valley mist below the near ridge, its top lit; under the copy it is the plate's own colour
      float wave = .04 * A * (fbm2(vec2(lp.x * .004 + uTime * .006, 1.)) - .5) * 2.;
      float pz = plateZone(q, 34., 70.);
      float fogTop = mix(uPlate.y - .5 * (uPlate.y - uType.y) + wave, uPlate.y - 34., pz);
      // billows on the fog's top; below them it is solid, and exactly the plate's colour
      float lump = fbm2(vec2(q.x * .006 + uTime * .008, q.y * .02));
      float edge = fogTop + (lump - .5) * 26. * (1. - pz);
      float fog = smoothstep(edge - 12., edge + 14., q.y);
      float deep = smoothstep(edge, edge + 46., q.y);
      // the body of the fog: rolling billows, larger toward the lens, their tops lit, hollows shaded
      float v = clamp((q.y - edge) / max(40., uRes.y - edge), 0., 1.);
      float sc = mix(1., 3.2, v);
      vec2 bp = vec2(q.x * .0045 / sc + uTime * .006, (q.y - edge) * .022 / sc);
      float bb = fbm2(bp + 11.);
      float bdy = fbm2(bp + vec2(0., .07) + 11.) - bb;
      vec3 body = cPlate * (.965 + .06 * clamp(-bdy * 14., -1., 1.) + .03 * (bb - .5));
      body = mix(body, mix(cPlate, cLight, .6), clamp(-bdy * 10., 0., 1.) * .25 * (.3 + near));
      vec3 fc = mix(mix(cPlate, cLight, .5 * (.3 + .7 * near)), body, smoothstep(edge - 4., edge + 26., q.y));
      fc = mix(fc, cPlate, pz);
      fog = max(fog, plateZone(q + vec2(0., -9.), 26., 0.) * step(uPlate.y - 12., q.y));
      col = col * (1. - fog) + fc * fog;
      alpha = alpha * (1. - fog) + fog;
      // spruce tops standing out of the fog, a plate behind the grass (z 2: they hardly move)
      {
        vec2 lp2 = q - offsetFor(2.);
        float cr2 = uPlate.y + uPlate.w + .5 * max(30., uRes.y - uPlate.y - uPlate.w) + 10. * n1(lp2.x / 140.);
        gCapX0 = uPlate.x - 50.; gCapX1 = uPlate.x + uPlate.z + 50.; gCapY = uPlate.y + uPlate.w + 34.;
        float hmax2 = .45 * uSize;
        float t2 = spruce(lp2, .13 * uSize + 8., hmax2, 13., cr2, 0., -1e4);
        gCapX0 = 1e6; gCapX1 = -1e6;
        float m2 = smoothstep(-1.2, 1.2, t2) * smoothstep(cr2 + 2., cr2 - .3 * hmax2, lp2.y) * (1. - plateZone(q, 20., 24.));
        vec3 c2 = mix(cLand * .7, cPlate, .5) + cLight * .2 * exp(-max(t2, 0.) / 1.5) * near;
        col = col * (1. - m2) + c2 * m2;
        alpha = max(alpha, m2);
      }
    } else {
      vec4 rf = roofs(lp, q);
      sd = rf.a;
      // tar paper with seams and the festoon's warm spill on the flat roof; the plate's own colour under the copy
      float seam = smoothstep(.9, 1., fract(lp.y / 13. + .3 * n1(lp.x * .01))) * smoothstep(.02 * A, .1 * A, lp.y - uRoof.x);
      c = rf.rgb + cLamp * (.04 * seam + .1 * smoothstep(uType.y, uRes.y, q.y) * smoothstep(.03 * A, .3 * A, lp.y - uRoof.x));
      float pz = plateZone(q, 30., 60.);
      c = mix(c, cPlate, pz);
      float on = smoothstep(-coc3, coc3, sd);
      on = max(on, plateZone(q, 24., 0.));
      col = c * on;
      alpha = on;
      vec4 fe = festoon(lp);
      col = col * (1. - fe.a) + cLand * .5 * fe.a + fe.rgb;
      alpha = max(alpha, fe.a);
    }
  }
  {
    float z = 1.;
    vec2 lp = q - offsetFor(z);
    if (uCity < .5){
      float base = rangeCrest(4, lp.x);
      vec4 g = grass(lp, q, base, coc4, near);
      // backlit blades glow where the sun comes through them
      vec3 blade = mix(cLand * .55, cLight * vec3(1., .92, .62) * .75, g.y * near * .7);
      float gr = g.x;
      col = col * (1. - gr) + blade * gr;
      alpha = alpha * (1. - gr) + gr;
      col += cLight * vec3(1., .82, .55) * g.z * .22;
      alpha = max(alpha, g.z * .08);
    } else {
      // the terrace railing at the lens, far out of focus, its top rail catching the lamps
      float top = max(uPlate.y + uPlate.w + 30., uRes.y * .82);
      float rail = min(lp.y - top, top + 16. - lp.y);
      float post = 5. - abs(mod(lp.x, 54.) - 27.);
      float sd = max(rail, min(post, lp.y - top));
      sd = max(sd, lp.y - uRes.y * .97);
      float on = smoothstep(-coc4, coc4, sd) * .92;
      vec3 c = cLand * 1.4 + cLamp * .45 * exp(-max(lp.y - top, 0.) / 6.) * step(lp.y, top + 18.);
      col = col * (1. - on) + c * on;
      alpha = alpha * (1. - on) + on;
      // the festoon's light lying along the wet top rail, smeared by the defocus
      float streak = exp(-abs(lp.y - top - 3.) / (coc4 * .6)) * smoothstep(.35, .75, n1(lp.x / 90. + 4.)) * (1. - plateZone(vec2(lp.x, top), 10., 40.));
      col += cLamp * streak * .35;
      alpha = max(alpha, streak * .15);
    }
  }
  // never above the line that keeps a letter's covered share under the limit
  vec4 e = texture2D(uCeil, vec2(q.x / uRes.x, .5));
  float ceilY = (e.r * 255. * 256. + e.g * 255.) * .5;
  float allow = smoothstep(ceilY, ceilY + 5., q.y);
  col *= allow;
  alpha *= allow;
  col += grainK * alpha;
  gl_FragColor = vec4(col, alpha);
}
`

const hex = (h) => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export default {
  async init(c) {
    this.ctx = c
    this.p = c.params
    const gl = c.canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: !!c.recording })
    if (!gl) throw new Error('WebGL is not available')
    this.gl = gl
    this.fg = c.front.getContext('2d', { willReadFrequently: true })
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
    for (const k of ['uChim', 'uGable', 'uRoof', 'uFest', 'uRes', 'uDpr', 'uType', 'uCam', 'uSun', 'uPlate', 'uCeil', 'uTime', 'uLayer', 'uCity', 'uGrain', 'uMist', 'uSeed', 'uSize', 'cSky', 'cGlow', 'cLight', 'cAir', 'cLand', 'cLamp', 'cPlate'])
      U[k] = gl.getUniformLocation(prog, k)
    this.U = U
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    this.ceilTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.ceilTex)
    for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
    gl.uniform1i(U.uCeil, 0)
    const p = this.p
    const sc = SCENES[p.scene]
    gl.uniform1f(U.uCity, p.scene === 'city' ? 1 : 0)
    gl.uniform1f(U.uGrain, p.grain)
    gl.uniform1f(U.uMist, p.mist)
    gl.uniform1f(U.uSeed, (p.seed % 997) * 0.013)
    gl.uniform3fv(U.cSky, hex(p.sky))
    gl.uniform3fv(U.cGlow, hex(p.glow))
    gl.uniform3fv(U.cLand, hex(p.land))
    gl.uniform3fv(U.cLight, hex(sc.light))
    gl.uniform3fv(U.cAir, hex(sc.air))
    gl.uniform3fv(U.cLamp, hex(sc.lamp))
    gl.uniform3fv(U.cPlate, hex(c.theme.plate))
    // for scripts/coverage.mjs: the measured share of each letter the near plates cover, and a test pointer
    c.root.pdh = { coverage: () => this.coverage(), pointer: null, bench: (n) => this.bench(n), layout: () => this.layout }
  },

  resize(view) {
    this.view = view
    const gl = this.gl
    // the scene is all air, haze and defocus: 1.5 device pixels per CSS pixel is as sharp as it
    // gets, and keeps a 2x screen near 10 ms a frame (the headline is the page's own text)
    this.rdpr = Math.min(view.dpr, 1.5)
    const W = Math.max(1, Math.round(view.width * this.rdpr))
    const H = Math.max(1, Math.round(view.height * this.rdpr))
    for (const cv of [this.ctx.canvas, this.ctx.front]) {
      cv.width = W
      cv.height = H
    }
    gl.viewport(0, 0, W, H)
    gl.uniform2f(this.U.uRes, view.width, view.height)
    gl.uniform1f(this.U.uDpr, this.rdpr)
    const t = view.type
    const lines = t.lines
    // the scene hangs from the last lines (more lines wrap on phones: the first ones sit on the sky)
    const capTop = Math.max(lines[0].baseline - t.size * 0.7, lines[lines.length - 1].baseline - t.size * (view.mobile ? 2.5 : 1.6))
    const base = lines[lines.length - 1].baseline
    const left = Math.min(...lines.map((l) => l.x))
    const right = Math.max(...lines.map((l) => l.x + l.w))
    this.type = { capTop, base, left, right, hc: Math.max(40, base - capTop) }
    gl.uniform4f(this.U.uType, capTop, base, left, right)
    gl.uniform1f(this.U.uSize, t.size)
    // the copy plate: the largest plate under the bar
    const top = view.bar.y + view.bar.h
    const plate = view.plates.filter((r) => r.y > top + 1).sort((a, b) => b.w * b.h - a.w * a.h)[0] || { x: 0, y: view.height * 2, w: 0, h: 0 }
    gl.uniform4f(this.U.uPlate, plate.x, plate.y, plate.w, plate.h)
    const city = this.p.scene === 'city'
    const hc = this.type.hc
    let sx = view.width * this.p.light
    let sy = capTop + 0.3 * hc
    if (city) {
      // the moon is the same colour as light ink: it never sits behind a letter. Beside the
      // headline when there is room, else in the strip of sky between the bar and the words
      const r = 0.021 * Math.min(view.width, view.height * 1.6)
      const realTop = lines[0].baseline - t.size * 0.75
      if (view.width - right > 4 * r + 40) {
        sx = Math.max(sx, right + (view.width - right) / 2)
        sy = capTop + 0.1 * hc
      } else sy = Math.max(top + r + 10, Math.min(realTop - r - 24, top + 0.5 * (realTop - top)))
    }
    gl.uniform2f(this.U.uSun, sx, sy)
    this.ceiling(view)
    if (city) this.roofs(view, plate)
  },

  /**
   * The roofs across the street, laid out once per size so that no chimney, gable or parapet
   * ever reaches a letter's ceiling, wherever the pointer moves the near plate (a margin of its
   * travel). An object that would have to be cut is made lower instead, or left out.
   */
  roofs(view, plate) {
    const gl = this.gl
    const U = this.U
    const { base: yB, left, right, hc } = this.type
    const size = view.type.size
    const W = view.width
    const ceil = this.ceilArr
    const M = Math.ceil((0.035 * this.p.depth + 0.006) * W * 0.5625) + 4
    const V = Math.ceil(0.012 * view.height * this.p.depth * 0.5625) + 8
    const ceilMax = (x0, x1) => {
      let m = 0
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(ceil.length - 1, Math.ceil(x1)); x++) m = Math.max(m, ceil[x])
      return m ? m + V : 0
    }
    const base = Math.min(yB + 0.16 * hc, plate.y - 10)
    const span = right - left
    // a parapet step only as high as the letters above it allow
    const stepH = Math.max(0, Math.min(0.05 * hc, base - (ceilMax(left - M, right + M) || -1e9)))
    let seed = (this.p.seed * 9301 + 49297) % 233280
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
    const chims = []
    for (let k = 0; k < 4; k++) {
      const x = left + span * (0.2 + 0.22 * k) + 30 * rnd()
      const hw = 0.03 * size + 5
      const capH = 0.045 * size + 3
      const potH = 0.06 * size + 4
      let top = base - (0.2 + 0.16 * rnd()) * size
      const c = ceilMax(x - hw - 4 - M, x + hw + 4 + M)
      if (c) top = Math.max(top, c + capH + potH * 1.2 + 2)
      chims.push(base - top > 0.07 * size ? [x, top, hw, 1] : [0, 0, 0, 0])
    }
    gl.uniform4fv(U.uChim, new Float32Array(chims.flat()))
    // the pitched roof: apex raised (lowered on screen) until both slopes clear every ceiling
    const px = left + 0.58 * span
    const hs = 0.26 * span
    let apex = base - 0.24 * size
    for (let x = px - hs; x <= px + hs; x += 2) {
      const c = ceilMax(x - M, x + M)
      if (c) apex = Math.max(apex, c + 2 - Math.abs(x - px) * 0.32)
    }
    gl.uniform4f(U.uGable, px, apex, hs, base - apex > 0.06 * size ? 1 : 0)
    // the water tower stands past the end of the headline, clear of every ceiling, if there is room
    let first = -1
    let last = -1
    for (let x = 0; x < ceil.length; x++) if (ceil[x]) (first < 0 && (first = x), (last = x))
    const tw = 0.2 * size + 10
    let tx = Math.max(right, last) + tw * 1.25
    while (tx + tw < W - 4 && ceilMax(tx - tw - M, tx + tw + M)) tx += 4
    const tower = tx + tw < W - 4
    gl.uniform4f(U.uRoof, base, stepH, tx, tower ? tw : 0)
    // festoons: between a pole beside the headline and one near the frame's edge, where there is room
    const top = base - 0.62 * size
    const fest = []
    const l0 = (first >= 0 ? first : left) - M - 10
    const l1 = 0.035 * W
    fest.push(l0 - l1 > 0.05 * W ? [l0, l1, top, 1] : [0, 0, 0, 0])
    const r0 = (tower ? tx + tw : Math.max(right, last) + M) + 0.03 * W
    const r1 = 0.965 * W
    fest.push(r1 - r0 > 0.05 * W ? [r0, r1, top, 1] : [0, 0, 0, 0])
    gl.uniform4fv(U.uFest, new Float32Array(fest.flat()))
    this.layout = { base, stepH, chims, apex, tx, tw, fest, M, V, right, left }
  },

  /** Each letter alone: the height above which its ink is more than `cover` of the whole; the near plates stay below it in its columns. */
  ceiling(view) {
    const t = view.type
    const W = Math.max(1, Math.round(view.width))
    const H = Math.max(1, Math.round(view.height))
    const ceil = new Float32Array(W)
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = H
    const g = cv.getContext('2d', { willReadFrequently: true })
    g.textBaseline = 'alphabetic'
    g.fillStyle = '#000'
    const cover = this.p.cover
    const letters = []
    for (const line of t.lines)
      for (const part of line.parts) {
        g.font = t.font(part.italic)
        if ('letterSpacing' in g) g.letterSpacing = `${t.letterSpacing}px`
        const chars = [...part.text]
        for (let i = 0; i < chars.length; i++) {
          const ch = chars[i]
          if (!/[\p{L}\p{N}]/u.test(ch)) continue
          const x = part.x + g.measureText(chars.slice(0, i).join('')).width
          const m = g.measureText(ch)
          const bx = Math.max(0, Math.floor(x - m.actualBoundingBoxLeft) - 3)
          const by = Math.max(0, Math.floor(line.baseline - m.actualBoundingBoxAscent) - 3)
          const bw = Math.min(W - bx, Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + 6)
          const bh = Math.min(H - by, Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 6)
          if (bw < 1 || bh < 1) continue
          g.clearRect(bx, by, bw, bh)
          g.fillText(ch, x, line.baseline)
          const d = g.getImageData(bx, by, bw, bh).data
          g.clearRect(bx, by, bw, bh)
          const mask = new Uint8Array(bw * bh)
          const rows = new Float64Array(bh)
          const cols = new Uint8Array(bw)
          let total = 0
          for (let yy = 0; yy < bh; yy++)
            for (let xx = 0; xx < bw; xx++) {
              const a = d[(yy * bw + xx) * 4 + 3]
              mask[yy * bw + xx] = a
              rows[yy] += a
              total += a
              if (a > 8) cols[xx] = 1
            }
          if (!total) continue
          // from the foot up, until the ink below would pass the limit
          let cum = 0
          let yc = by + bh
          for (let yy = bh - 1; yy >= 0; yy--) {
            if (cum + rows[yy] > cover * total) break
            cum += rows[yy]
            yc = by + yy
          }
          for (let xx = 0; xx < bw; xx++)
            if (cols[xx]) for (let k = -3; k <= 3; k++) {
              const X = bx + xx + k
              if (X >= 0 && X < W) ceil[X] = Math.max(ceil[X], yc)
            }
          letters.push({ ch, bx, by, bw, bh, mask })
        }
      }
    if ('letterSpacing' in g) g.letterSpacing = '0px'
    this.letters = letters
    this.ceilArr = ceil
    const px = new Uint8Array(W * 4)
    for (let x = 0; x < W; x++) {
      const v = Math.min(65535, Math.round(ceil[x] * 2))
      px[x * 4] = v >> 8
      px[x * 4 + 1] = v & 255
      px[x * 4 + 3] = 255
    }
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.ceilTex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px)
  },

  /** The share of each letter's ink the front canvas covers now (alpha-weighted). */
  coverage() {
    const v = this.view
    const fg = this.fg
    const dpr = this.rdpr
    const out = []
    for (const L of this.letters || []) {
      const X = Math.floor(L.bx * dpr)
      const Y = Math.floor(L.by * dpr)
      const w = Math.max(1, Math.ceil(L.bw * dpr))
      const h = Math.max(1, Math.ceil(L.bh * dpr))
      const d = fg.getImageData(X, Y, w, h).data
      let ink = 0
      let hid = 0
      for (let yy = 0; yy < L.bh; yy++)
        for (let xx = 0; xx < L.bw; xx++) {
          const m = L.mask[yy * L.bw + xx]
          if (!m) continue
          const sx = Math.min(w - 1, Math.round((L.bx + xx + 0.5) * dpr) - X)
          const sy = Math.min(h - 1, Math.round((L.by + yy + 0.5) * dpr) - Y)
          ink += m
          hid += m * (d[(sy * w + sx) * 4 + 3] / 255)
        }
      out.push({ ch: L.ch, share: ink ? hid / ink : 0 })
    }
    const worst = out.reduce((a, b) => (b.share > a.share ? b : a), { ch: '', share: 0 })
    return { worst, letters: out }
  },

  /** Draws n frames back to back, waiting for the GPU each time: milliseconds per frame (median, p95). */
  bench(n = 120) {
    const gl = this.gl
    const ms = []
    const px = new Uint8Array(4)
    for (let i = 0; i < n; i++) {
      const t0 = performance.now()
      this.seek(i / 60, { progress: (i % 60) / 60, pointer: { x: Math.sin(i * 0.1), y: Math.cos(i * 0.07) } })
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      ms.push(performance.now() - t0)
    }
    ms.sort((a, b) => a - b)
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    return { median: ms[n >> 1], p95: ms[Math.floor(n * 0.95)], dpr: this.view.dpr, drawn: this.rdpr, size: [gl.drawingBufferWidth, gl.drawingBufferHeight], renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) }
  },

  seek(t, state) {
    const { gl, U, view: v, p } = this
    if (!v) return
    const hc = this.type.hc
    const pr = state.progress ?? 0
    const ptr = this.ctx.root.pdh?.pointer || state.pointer || { x: 0, y: 0 }
    // the camera: the pointer trucks it sideways and up and down, a slow breath keeps it alive,
    // and the scroll raises it, as if climbing: the near ridge drops below the words while the
    // far ranges and the sun rise behind them
    const breath = Math.sin(t * 0.21) * 0.006 * v.width
    const camX = (ptr.x * 0.035 * v.width + breath) * p.depth
    const camY = ptr.y * 0.012 * v.height * p.depth + pr * p.rise * 0.55 * hc
    gl.uniform2f(U.uCam, -camX, camY)
    gl.uniform1f(U.uTime, t)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.ceilTex)
    // the front plates first, copied to the front canvas; then the scene behind the letters
    gl.uniform1f(U.uLayer, 1)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    const fg = this.fg
    fg.clearRect(0, 0, fg.canvas.width, fg.canvas.height)
    fg.drawImage(this.ctx.canvas, 0, 0)
    gl.uniform1f(U.uLayer, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  },
}
