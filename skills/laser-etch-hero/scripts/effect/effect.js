// Laser Etch (browser), Motion Heroes kit v2. Raw WebGL2, no libraries.
//
// The headline is cut into a real plate by a laser engraver, and one low
// raking lamp is what makes the cut readable. Everything is one plate seen
// from straight above:
// - the plate: maple (a board lying on the bench, with its ends, a roundover
//   and a contact shadow, held by a clamp bar the copy is printed on),
//   black anodised aluminium (full bleed) or cleaved slate;
// - the cut: a height field built from the headline's mask (view.type), so
//   each letter has a floor, walls, a heat-affected rim and process marks
//   (raster scan ridges, galvo hatch), lit by the lamp with shadows cast
//   inside the cut (a short march toward the lamp, run only inside the cut);
// - the tool: a vector contour pass, then a gantry raster (the whole job
//   scanned line by line, both directions, firing only inside the glyphs)
//   or a galvo hatch (glyph by glyph at 45 degrees, then 135 degrees);
// - its light and its by-products: the spot is a second, point light; maple
//   chars, glows and smokes, aluminium throws sparks, slate frosts.
//
// The loop: a settled hold under the lamp, the lamp swings across and rests,
// the finished plate slides out as a blank one slides in, contour, fill, the
// lamp swings back, hold. Every frame is a pure function of the loop phase
// (plus the live pointer, which moves the lamp), so the recording closes.
// window.__laserEtchHolds lists the settled stretches in scene seconds.

const VERT = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`

const COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uDpr, uK;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0., a = .5; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s; }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
`

// The material, drawn once per size into a texture (rgb: albedo, a: how deep a cut goes here).
const MAT = COMMON + `
uniform int uMat;
out vec4 o;
// hard maple, flat sawn: tight, slightly wavy growth lines at uneven spacing,
// short ray flecks, fibre streaks, pores and a slow drift of colour
vec4 maple(vec2 p){
  vec2 q = p / uK;
  float warp = 34.*fbm(q*vec2(0.0016, 0.0005)) + 5.*fbm(q*vec2(0.006, 0.0018) + 3.) + 0.8*fbm(q*vec2(0.03, 0.04));
  float r = (q.y + warp) / 8.5 + 2.2*fbm(vec2(q.x*0.0004, q.y*0.011)) + 0.9*fbm(vec2(q.x*0.0012, q.y*0.03) + 5.);
  r += 0.35*vnoise(vec2(floor(r)*3.1, q.x*0.0025));          // ring-to-ring irregularity
  float f = fract(r);
  float wv = 0.5 + 0.5*vnoise(vec2(floor(r)*1.7, q.x*0.004));        // each line's own weight, changing along its length
  float lw = smoothstep(0.86 - 0.06*wv, 0.95, f) * (1. - smoothstep(0.95, 1.0, f)) * (0.35 + 0.65*wv);
  float lwS = smoothstep(0.55, 0.95, f);                     // the soft side of each line
  vec3 early = lin(vec3(0.945, 0.885, 0.775));
  vec3 late  = lin(vec3(0.835, 0.715, 0.545));
  vec3 c = mix(early, late, lw*0.30 + lwS*0.05);
  float band = fbm(vec2(q.x*0.0004, q.y*0.006) + 21.);
  c = mix(c, c*lin(vec3(0.97, 0.90, 0.80)), smoothstep(0.5, 0.85, band)*0.8);   // long heartwood-tinted bands
  float tone = fbm(q*vec2(0.0011, 0.0045) + 3.);
  c = mix(c, c*lin(vec3(1.0, 0.94, 0.86)), smoothstep(0.42, 0.78, tone));   // warmer, golder streaks
  c = mix(c, c*lin(vec3(1.0, 0.96, 0.95)), smoothstep(0.5, 0.8, fbm(q*vec2(0.002, 0.03) + 9.)) * 0.6);
  c *= 0.965 + 0.07*fbm(q*vec2(0.004, 0.22));                 // long fibre bands
  c *= 0.98 + 0.04*fbm(q*vec2(0.035, 1.3));                   // fine fibre
  // ray flecks: short reddish dashes along the grain
  vec2 cell = vec2(floor(q.x/7.), floor(q.y/1.8));
  float h = hash(cell);
  vec2 fl = (q - (cell + 0.5)*vec2(7., 1.8)) / vec2(3.2*(0.6 + h), 0.75);
  float fleck = step(0.982, h) * smoothstep(1., 0.3, length(fl));
  c = mix(c, c*lin(vec3(0.88, 0.78, 0.68)), fleck*0.45);
  // pores: tiny dark dashes
  float pore = smoothstep(0.93, 0.995, vnoise(q*vec2(0.16, 1.9)));
  c *= 1. - 0.10*pore;
  float a = 1. - lw;                                          // earlywood burns deeper
  return vec4(pow(c, vec3(1./2.2)), a);
}
// black anodised aluminium, bead blasted
vec4 anodised(vec2 p){
  float bead = vnoise(p*1.9)*0.6 + vnoise(p*0.7)*0.4;
  vec3 c = lin(vec3(0.046, 0.051, 0.062)) * (0.88 + 0.24*bead) * (0.95 + 0.10*fbm(p*0.004));
  return vec4(pow(c, vec3(1./2.2)), 0.5 + 0.5*vnoise(p*1.3));
}
// cleaved slate: blue-grey, faint cleavage streaks and mica
vec4 slate(vec2 p){
  vec2 q = p / uK;
  float s = fbm(q*vec2(0.002, 0.03)) ;
  vec3 c = mix(lin(vec3(0.17, 0.19, 0.21)), lin(vec3(0.22, 0.235, 0.25)), s);
  c *= 0.9 + 0.2*fbm(q*vec2(0.03, 0.4));
  c += step(0.992, hash(floor(q*1.2))) * 0.03;
  return vec4(pow(c, vec3(1./2.2)), 0.5 + 0.5*fbm(q*0.05));
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  o = uMat == 0 ? maple(p) : uMat == 1 ? anodised(p) : slate(p);
}`

const FRAG = COMMON + `
out vec4 o;
uniform sampler2D uFill, uB1, uB2, uId, uSoft, uTex;
uniform int uMat;                 // 0 maple, 1 anodised, 2 slate
uniform int uBoard;               // 1: a board lying on the bench (with a clamp bar); 0: full bleed
uniform vec4 uBoardR;             // the board (plate-local CSS px): x0, y0, x1, y1
uniform vec4 uClamp;              // the clamp bar: y0, y1, lift (px), on
uniform vec3 uBench, uClampC;     // sRGB
uniform vec3 uLamp, uLampC;       // the raking lamp: position (CSS px, z up) and colour
uniform vec2 uOffA, uOffB;        // where the engraved plate and the incoming blank plate are
uniform int uStage;               // 0 done, 1 contour pass, 2 fill
uniform float uCCur, uCAng;       // contour: glyph in progress and its angle
uniform vec2 uCent[48];           // glyph centres (plate-local)
uniform int uGalvo;
uniform float uFrontY, uDir, uHeadX, uPitch, uPass;   // raster (gantry)
uniform float uHCur, uSFront, uHeadT;                 // galvo
uniform vec2 uHead, uHeadPrev; uniform float uBeam;  // the spot (screen CSS px), on 0..1
uniform float uSmoke, uSparks, uT, uDepth, uGrain, uHeat;
uniform vec2 uWind;

vec2 vp(){ return uRes / uDpr; }
vec2 UV(vec2 p){ return vec2(p.x / vp().x, 1.0 - p.y / vp().y); }
float S(vec2 p){ return dot(p, vec2(0.70710678)); }
float T2(vec2 p){ return dot(p, vec2(0.70710678, -0.70710678)); }
float gid(vec2 q){ return floor(texture(uId, UV(q)).r*255./6. + 0.5) - 1.; }   // -1 none, 0 burned before the job, 1.. glyphs

// has the tool cut this pixel of the plate yet (the engraved plate A; plate B is blank)
float filledAt(vec2 q, float id){
  if (id < -0.5) return 0.;
  if (id < 0.5 || uStage == 0) return 1.;
  if (uStage == 1) return 0.;
  if (uGalvo == 1) {
    if (id < uHCur - 0.5) return 1.;
    if (id > uHCur + 0.5) return 0.;
    float s = S(q);
    if (s < uSFront) return 1.;
    if (s < uSFront + uPitch) return step((T2(q) - uHeadT)*uDir, 0.);
    return 0.;
  }
  if (q.y < uFrontY - uPitch*0.5) return 1.;
  if (q.y < uFrontY + uPitch*0.5) return step((q.x - uHeadX)*uDir, 0.);
  return 0.;
}
float outlinedAt(vec2 q, float id){
  if (id < -0.5) return 0.;
  if (uStage != 1 || id < 0.5) return 1.;
  if (id < uCCur - 0.5) return 1.;
  if (id > uCCur + 0.5) return 0.;
  vec2 d = q - uCent[int(id)];
  float a = atan(d.y, d.x) + 3.14159265;
  return step(a, uCAng);
}
float crossDone(vec2 q, float id){ return (uStage == 0 || id < 0.5 || (uStage == 2 && id < uHCur - 0.5)) ? 1. : 0.; }
float contourBand(float b1, float w){ return 1. - smoothstep(0.0, w, abs(b1 - 0.5)); }

// the height of the plate's surface (0) and its cut (negative), plate-local
float Hgt(vec2 q, int plate){
  vec2 uv = UV(q);
  float b1 = texture(uB1, uv).r;
  if (b1 < 0.004) return 0.;
  float id = gid(q);
  float f = plate == 0 ? b1 * filledAt(q, id) : b1 * step(-0.5, id) * step(id, 0.5);
  float c = contourBand(b1, 0.30) * (plate == 0 ? outlinedAt(q, id) : step(-0.5, id)*step(id, 0.5));
  float a = max(f, c * (uMat == 0 ? 0.12 : 0.22));
  float v = 0.;
  if (uMat == 0) {
    float ew = texture(uTex, uv).a;
    v = 0.30*ew + 0.06*sin(q.y*6.2831853/(2.4*uK)) + 0.10*(vnoise(q*0.6/uK) - .5);
  } else if (uMat == 1) {
    v = 0.05*(1. - crossDone(q, id))*cos(S(q)*6.2831853/3.2) + 0.08*(vnoise(q*1.3) - .5);
  } else {
    v = 0.18*(vnoise(q*0.9) - .5);
  }
  float h = -uDepth * a * (1. + v*smoothstep(0.3, 0.9, f));
  if (uMat == 0) {                       // a slightly raised, fuzzy lip just outside the cut
    float ring = clamp(texture(uB2, uv).r - b1, 0., 1.) * (plate == 0 ? filledAt(q, id) : step(-0.5, id));
    h += uDepth * 0.10 * ring * (0.6 + 0.8*vnoise(q*0.9/uK));
  }
  return h;
}

// rounded-rect signed distance (the board)
float sdBox(vec2 p, vec4 r, float rad){
  vec2 c = (r.xy + r.zw)*0.5, h = (r.zw - r.xy)*0.5 - rad;
  vec2 d = abs(p - c) - h;
  return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - rad;
}

vec3 tone(vec3 c){ c = c / (1. + c*0.16); return pow(max(c, 0.), vec3(1./2.2)); }

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec3 V = vec3(0, 0, 1);
  vec3 L = normalize(uLamp - vec3(p, 0.));
  vec3 Lc = lin(uLampC);
  float grainN = (hash(floor(gl_FragCoord.xy)) - 0.5) * 0.02 * uGrain;

  // ---------- which surface is here ----------
  int plate = -1; vec2 q = p;
  float sdA = -1., sdB = -1.;
  float rad = 14.*uK;
  if (uBoard == 1) {
    sdA = sdBox(p - uOffA, uBoardR, rad);
    sdB = sdBox(p - uOffB, uBoardR, rad);
    if (sdA < 0.5) { plate = 0; q = p - uOffA; }
    else if (sdB < 0.5) { plate = 1; q = p - uOffB; }
  } else {
    // full bleed: plate A from its top edge (uOffA.y) down, plate B above it
    if (p.y >= uOffA.y) { plate = 0; q = p - uOffA; } else { plate = 1; q = p - uOffB; }
  }

  // ---------- the clamp bar (copy is printed on it): flat, exactly the plate colour ----------
  if (uBoard == 1 && uClamp.w > 0.5 && p.y >= uClamp.x && p.y <= uClamp.y) {
    vec3 c = uClampC;
    float e0 = p.y - uClamp.x, e1 = uClamp.y - p.y;
    c *= 1. + 0.10*exp(-e0*1.2) - 0.16*exp(-e1*0.9);       // a lit top arris, a shaded lower one
    // bolt heads at the ends
    for (int i = 0; i < 2; i++) {
      vec2 bc = vec2(i == 0 ? 26. : vp().x - 26., (uClamp.x + uClamp.y)*0.5);
      float d = length(p - bc);
      if (d < 8.) { vec2 n = (p - bc)/8.; float sh = 0.86 + 0.25*dot(n, normalize(-L.xy)); c *= mix(sh, 1., smoothstep(7., 8., d)); c *= 1. - 0.25*smoothstep(1.4, 0.6, abs(d - 3.)) * step(abs((p - bc).x), 0.9) ; }
    }
    o = vec4(c, 1.); return;
  }

  // shadows the board and the clamp bar throw (soft, away from the lamp)
  vec2 away = -L.xy / max(L.z, 0.15);
  float clampSh = 0.;
  if (uBoard == 1 && uClamp.w > 0.5) {
    float lift = 5. + uClamp.z;
    float y0 = uClamp.x + away.y*lift, y1 = uClamp.y + away.y*lift;
    clampSh = smoothstep(y0 - 6., y0 + 6., p.y) * (1. - smoothstep(y1 - 6., y1 + 6. + uClamp.z, p.y)) * mix(0.30, 0.18, clamp(uClamp.z/10., 0., 1.));
  }

  if (plate < 0) {
    // the bench: flat paper, the board's soft contact shadow
    float th = 12.*uK;
    float s = min(sdBox(p - uOffA - away*th, uBoardR, rad), sdBox(p - uOffB - away*th, uBoardR, rad));
    float sh = (1. - smoothstep(-6., 16., s)) * 0.32 + (1. - smoothstep(-2., 4., min(sdA, sdB))) * 0.0;
    float ao = (1. - smoothstep(0., 7., min(sdA, sdB))) * 0.22;
    vec3 c = lin(uBench) * (1. - sh) * (1. - ao) * (1. - clampSh);
    o = vec4(tone(c*1.0) + grainN, 1.);
    return;
  }

  // ---------- the plate ----------
  vec2 uv = UV(q);
  vec4 mt = texture(uTex, uv);
  vec3 base = lin(mt.rgb);
  float id = gid(q);
  float b1 = texture(uB1, uv).r, b2 = texture(uB2, uv).r, fill = texture(uFill, uv).r;
  float fd = plate == 0 ? filledAt(q, id) : step(-0.5, id)*step(id, 0.5);
  float od = plate == 0 ? outlinedAt(q, id) : step(-0.5, id)*step(id, 0.5);
  float fA = fill * fd;                                 // inside a finished cut
  float cutA = smoothstep(uMat == 0 ? 0.10 : 0.3, uMat == 0 ? 0.48 : 0.7, b1) * fd;
  float cont = contourBand(b1, 0.22) * od * (1. - fd);  // a contour-only groove

  float h0 = Hgt(q, plate);
  float e = 0.75;
  vec3 N = normalize(vec3(-(Hgt(q + vec2(e,0), plate) - Hgt(q - vec2(e,0), plate))/(2.*e), -(Hgt(q + vec2(0,e), plate) - Hgt(q - vec2(0,e), plate))/(2.*e), 1.));

  // the board's roundover: the surface falls away over the last few pixels of the edge
  float edge = 0.;
  if (uBoard == 1) {
    float sd = plate == 0 ? sdA : sdB;
    float w = 7.*uK;
    edge = smoothstep(-w, 0., sd);
    vec2 g = vec2(sdBox(p - (plate == 0 ? uOffA : uOffB) + vec2(1,0), uBoardR, rad) - sdBox(p - (plate == 0 ? uOffA : uOffB) - vec2(1,0), uBoardR, rad),
                  sdBox(p - (plate == 0 ? uOffA : uOffB) + vec2(0,1), uBoardR, rad) - sdBox(p - (plate == 0 ? uOffA : uOffB) - vec2(0,1), uBoardR, rad)) * 0.5;
    N = normalize(N + vec3(g * edge * 1.6, 0.));
  }

  // cast shadow inside the cut
  float sh = 1.;
  if (h0 < -0.05) {
    vec2 d2 = normalize(L.xy); float tz = L.z / max(length(L.xy), 1e-3);
    for (int k = 1; k <= 10; k++) {
      float s = float(k) * 1.0 * max(uK, 0.6);
      float hq = Hgt(q + d2*s, plate);
      sh = min(sh, clamp(1. - (hq - (h0 + s*tz))*1.3, 0., 1.));
    }
  }
  float ao = 1. - 0.5*smoothstep(0., 1., b2) * smoothstep(0.2, 0.8, b1) * fd;
  float dif = max(dot(N, L), 0.) / max(L.z, 0.12);
  vec3 Hh = normalize(L + V);
  float distL = length(uLamp.xy - p);
  float fall = 1.04 - 0.30*smoothstep(0.15, 1.35, distL / max(vp().x, vp().y) - 0.25);
  vec3 amb = lin(vec3(0.70, 0.73, 0.80));
  vec3 col;

  if (uMat == 0) {
    // ---------- MAPLE ----------
    vec3 wood = base;
    float near = plate == 0 ? fd : 1.;
    float haz = clamp(b2 - fill, 0., 1.) * near * step(fill, 0.5);
    wood = mix(wood, wood*lin(vec3(0.55, 0.36, 0.20)), 0.85*smoothstep(0.0, 0.6, haz));                  // toasted rim
    float soot = texture(uSoft, UV(q - uWind*9.*uK)).r * (plate == 0 ? (uStage == 0 ? 1. : 0.6) : 0.);
    wood = mix(wood, wood*lin(vec3(0.85, 0.78, 0.70)), 0.18*soot*(1. - cutA));
    // char: near black-brown, velvety, the grain showing as lighter ridges, the scan lines as ridges
    float ew = mt.a;
    vec3 charc = mix(lin(vec3(0.30, 0.195, 0.12)), lin(vec3(0.125, 0.08, 0.052)), smoothstep(0.3, 0.9, ew));
    charc *= 0.80 + 0.40*vnoise(q*vec2(1.1, 2.6)/uK);
    charc *= 1. + 0.16*sin(q.y*6.2831853/(2.4*uK));
    // the contour pass: a thin toasted line with small burn variation
    vec3 tline = wood * mix(lin(vec3(0.62, 0.44, 0.28)), lin(vec3(0.42, 0.27, 0.15)), vnoise(vec2(q.x + q.y, q.x - q.y)*0.35));
    vec3 alb = mix(wood, tline, cont);
    alb = mix(alb, charc, cutA);
    // the end grain shows on the roundover at the board's ends
    if (uBoard == 1) { float endz = smoothstep(uBoardR.x + 10.*uK, uBoardR.x, q.x) + smoothstep(uBoardR.z - 10.*uK, uBoardR.z, q.x); alb = mix(alb, alb*lin(vec3(0.84, 0.76, 0.66)), edge*clamp(endz, 0., 1.)); }
    float lit = mix(1., dif, 0.85);
    col = alb * (amb*0.36 + Lc*lit*sh*0.80) * ao * fall;
    // the char's velvet: a soft, broad sheen of the fine ridges toward the lamp
    col += cutA * lin(vec3(0.42, 0.33, 0.27)) * pow(max(dot(N, Hh), 0.), 3.) * 0.10 * sh;
    // satin oil finish: a broad sheen from the lamp, and chatoyance that shifts with the lamp
    float az = atan(L.y, L.x);
    float chat = sin(q.x*0.018/uK + 2.6*fbm(q*vec2(0.003, 0.02)/uK) + az*2.2);
    col *= 1. + (1. - cutA) * 0.035 * chat;
    float spec = pow(max(dot(N, Hh), 0.), 10.) * 0.10 * (1. - cutA) + pow(max(dot(N, Hh), 0.), 60.) * 0.05 * (1. - cutA);
    col += Lc * spec * sh * fall;
  } else if (uMat == 1) {
    // ---------- BLACK ANODISED ALUMINIUM ----------
    float frost = vnoise(q*2.3)*0.5 + vnoise(q*0.9)*0.5;
    vec3 metal = lin(vec3(0.88, 0.90, 0.92)) * (0.82 + 0.22*frost);
    float bright = max(fA, cont);
    vec3 alb = mix(base, metal, bright);
    float fresh = 1. - crossDone(q, id);
    float hatch = 0.5 + 0.5*cos(S(q)*6.2831853/3.2);
    float cross2 = crossDone(q, id) * (0.5 + 0.5*cos(T2(q)*6.2831853/2.6));
    vec3 Nm = normalize(N + fA*vec3(vec2(0.70710678)*(hatch - 0.5)*mix(0.12, 0.55, fresh) + vec2(0.70710678, -0.70710678)*(cross2 - 0.5)*0.10 + (vec2(vnoise(q*1.7), vnoise(q*1.7 + 5.)) - 0.5)*0.35, 0.));
    float sp = pow(max(dot(Nm, Hh), 0.), mix(14., 30., bright)) * mix(0.16, 1.2, bright);
    col = alb * (amb*0.22 + Lc*dif*sh*0.55) * ao + Lc * sp * sh;
    col += fA * metal * (0.03 + 0.10*fresh*hatch + 0.03*cross2);
    col += cont * metal * 0.28;
  } else {
    // ---------- SLATE ----------
    vec3 frostc = lin(vec3(0.66, 0.68, 0.70)) * (0.85 + 0.25*vnoise(q*2.1));
    vec3 alb = mix(base, frostc, max(cutA, cont*0.8));
    float sp = pow(max(dot(N, Hh), 0.), 18.) * 0.06 * (1. - cutA);
    col = alb * (amb*0.30 + Lc*dif*sh*0.62) * ao * fall + Lc * sp * sh;
  }

  // ---------- the spot: a point light just above the plate ----------
  vec2 hv = uHead - p; float dd = length(hv);
  if (uBeam > 0.001) {
    vec3 Lp = normalize(vec3(hv, 10.*uK));
    float att = 1. / (1. + dd*dd/((uMat == 0 ? 2200. : 1600.)*uK*uK));
    vec3 beamC = uMat == 0 ? lin(vec3(1.0, 0.62, 0.28)) : lin(vec3(0.95, 0.96, 1.0));
    float pl = max(dot(N, Lp), 0.) * att * uBeam;
    if (uMat == 1) {
      vec3 Hp = normalize(Lp + V);
      float sp2 = pow(max(dot(N, Hp), 0.), mix(8., 40., fA));
      col += beamC * (pl*0.25 + sp2 * att * uBeam * mix(0.35, 2.2, fA));
    } else col += beamC * pl * 0.8;
  }

  // ---------- fresh heat ----------
  if (plate == 0 && uStage == 2 && uHeat > 0.) {
    if (uGalvo == 0) {
      // age of each fresh pixel: lines above the front were passed earlier, the current one behind the head
      float lines = (uFrontY - q.y) / uPitch;
      float along = (uHeadX - q.x) * uDir;
      float age = lines < 0.5 ? max(along, 0.) / max(uPass, 1.) : (lines - 0.5) * 1.0 + 0.5;
      float glow = fA * exp(-age*1.6) * step(-0.5, lines) * uHeat;
      col += lin(vec3(1.0, 0.42, 0.10)) * glow * 1.5;
    } else {
      float hot = fA * step(uHCur - 0.5, id) * step(id, uHCur + 0.5) * exp(-max(uSFront - S(q), 0.)/5.) * exp(-dd/(34.*uK)) * uBeam;
      col += lin(vec3(1.0, 0.85, 0.65)) * hot * 1.6;
    }
  }

  // ---------- smoke (maple): a thin sheet rising off the row being burned, and a plume off the spot ----------
  if (uMat == 0 && uSmoke > 0.001) {
    vec2 w = normalize(uWind);
    float dens = 0.;
    float rise = (uFrontY + uOffA.y - p.y);                    // smoke travels up and across from the row
    if (uGalvo == 0 && uStage == 2 && rise > -4. && rise < 420.*uK) {
      float s = rise / max(-w.y, 0.2);
      float ox = p.x - w.x*s;
      float src = texture(uSoft, UV(vec2(ox, uFrontY) - uOffA*0.)).r;
      vec2 nq = vec2(ox*0.012/uK, s*0.016/uK - uT*1.4);
      vec2 wq = nq + 0.8*vec2(fbm(nq*1.3 + 4.), fbm(nq*1.3 + 9.));
      float fil = 1. - abs(2.*fbm(wq*1.7) - 1.);
      dens += src * smoothstep(-4., 10., rise) * exp(-s/(55.*uK)) * smoothstep(0.55, 0.97, fil) * 0.7;
    }
    vec2 r = (p - uHead) / uK; float ax = dot(r, w); float sd = dot(r, vec2(-w.y, w.x)) + 14.*sin(ax*0.014 - uT*1.3) * smoothstep(0., 120., ax);
    if (uBeam > 0.001 && ax > -8. && ax < 900. && abs(sd) < 3. + ax*0.6) {
    float wid = 3. + ax*0.17 + 0.0004*ax*ax;
    vec2 pq = vec2(ax*0.018 - uT*1.6, sd*0.05);
    vec2 pw = pq + 0.9*vec2(fbm(pq*1.3 + 4.), fbm(pq*1.3 + 9.));
    float pf = 1. - abs(2.*fbm(pw*1.6) - 1.);
    dens += smoothstep(-6., 6., ax) * exp(-pow(sd/wid, 2.)) * exp(-max(ax, 0.)/220.) * (0.15 + 0.85*smoothstep(0.55, 0.97, pf)) * uBeam;
    }
    dens *= uSmoke;
    vec3 smokeC = mix(lin(vec3(0.93, 0.93, 0.95)), lin(vec3(1.0, 0.70, 0.42)), exp(-dd/(26.*uK))*0.85);
    col = mix(col, smokeC * (0.8 + 0.2*fall), clamp(dens*0.22, 0., 0.28));
  }

  // ---------- sparks (aluminium) ----------
  if (uMat == 1 && uBeam > 0.001 && uSparks > 0. && dd < 330.*uK) {   // sparks never fly further than this
    float spk = 0.;
    for (int i = 0; i < 26; i++) {
      float fi = float(i);
      float life = 0.22 + 0.25*hash(vec2(fi, 3.1));
      float ph = uT/life + hash(vec2(fi, 9.7));
      float age = fract(ph);
      float ang = 6.2831853*hash(vec2(fi, floor(ph) + 1.3));
      float spd = (140. + 380.*hash(vec2(fi, 5.5))) * uK;
      vec2 dir = vec2(cos(ang), sin(ang));
      float s1 = spd*age*(1. - 0.45*age)*life, s0 = max(0., s1 - spd*life*0.07);
      vec2 a = uHead + dir*s0, b = uHead + dir*s1;
      vec2 pa = p - a, ba = b - a; float hh = clamp(dot(pa, ba)/max(dot(ba, ba), 1e-3), 0., 1.);
      float dl = length(pa - ba*hh);
      spk += exp(-dl*dl/0.5) * (1. - age) * (0.4 + 0.6*hh);
    }
    col += lin(vec3(1.0, 0.78, 0.45)) * spk * 1.6 * uBeam * uSparks;
  }
  if (uMat == 2 && uBeam > 0.001) {            // slate: a pale dust off the spot instead of smoke
    vec2 r = (p - uHead)/uK; float ax = dot(r, normalize(uWind));
    float dust = smoothstep(-4., 4., ax) * exp(-pow(dot(r, vec2(-uWind.y, uWind.x))/(4. + ax*0.2), 2.)) * exp(-max(ax, 0.)/90.) * fbm(vec2(ax*0.03 - uT*2., 0.));
    col = mix(col, lin(vec3(0.75, 0.76, 0.78)), clamp(dust*0.5, 0., 0.35));
  }

  // ---------- the clamp bar's shadow on the board ----------
  col *= 1. - clampSh;

  // ---------- the spot itself: core, halo, a soft wide glow, drawn as a short streak along its motion ----------
  if (uBeam > 0.001) {
    vec2 a = uHeadPrev, b = uHead; vec2 pa = p - a, ba = b - a;
    float hh = clamp(dot(pa, ba)/max(dot(ba, ba), 1e-3), 0., 1.);
    float ds = length(pa - ba*hh);
    float core = exp(-ds*ds/((uMat == 0 ? 2.2 : 3.0)*uK*uK));
    float halo = exp(-dd*dd/((uMat == 0 ? 110. : 90.)*uK*uK));
    float wide = exp(-dd/((uMat == 0 ? 70. : 60.)*uK));
    vec3 glowC = uMat == 0 ? lin(vec3(1.0, 0.68, 0.32)) : lin(vec3(0.85, 0.90, 1.0));
    col += uBeam * (vec3(1.0, 0.98, 0.94)*core*3.0 + glowC*halo*1.1 + glowC*wide*(uMat == 0 ? 0.16 : 0.12));
  }

  // the seam between full-bleed plates while they swap
  if (uBoard == 0) { float sm = abs(p.y - uOffA.y); col *= mix(1., 0.2, exp(-sm*sm/1.5)) ; col += lin(vec3(0.5)) * 0.25 * exp(-pow(p.y - uOffA.y - 2., 2.)/1.2) * step(0.5, uOffA.y); }

  o = vec4(tone(col) + grainN, 1.);
}`

const TAU = Math.PI * 2
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const ease = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2 }
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const MATS = { maple: 0, anodised: 1, slate: 2 }

// The loop, as shares of the cycle. Holds are settled (nothing moves but nothing is mid-way).
const PH = { holdA: [0, 0.125], swingAB: [0.125, 0.275], holdB: [0.275, 0.35], swap: [0.35, 0.42], contour: [0.42, 0.5], fill: [0.5, 0.9], swingBA: [0.5, 0.94], clear: [0.9, 0.95], holdA2: [0.96, 1] }

export default {
  PH,

  async init(c) {
    this.ctx = c
    this.p = c.params
    const gl = c.canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: !!c.recording })
    if (!gl) throw new Error('WebGL2 is not available')
    this.gl = gl
    const sh = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s))
      return s
    }
    const prog = (fs) => {
      const pr = gl.createProgram()
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT))
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs))
      gl.bindAttribLocation(pr, 0, 'aPos')
      gl.linkProgram(pr)
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr))
      return pr
    }
    this.main = prog(FRAG)
    this.matProg = prog(MAT)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.tex = {}
    for (const k of ['uFill', 'uB1', 'uB2', 'uId', 'uSoft', 'uTex']) this.tex[k] = gl.createTexture()
    this.fbo = gl.createFramebuffer()
    this.U = {}
    const p = this.p
    this.mat = MATS[p.material] ?? 0
    this.galvo = p.machine === 'galvo'
    this.cycle = p.cycle
    // live: the pointer moves the lamp, on a spring
    this.live = { ptr: null, rest: -1e9, az: null, el: null, last: null }
    c.root.addEventListener('pointermove', (e) => {
      const r = c.root.getBoundingClientRect()
      this.live.ptr = { x: e.clientX - r.left, y: e.clientY - r.top }
      this.live.rest = performance.now()
    })
    c.root.addEventListener('pointerleave', () => (this.live.ptr = null))
    const C = this.cycle
    window.__laserEtchHolds = [[0, PH.holdA[1] * C], [PH.holdB[0] * C + 0.15, PH.holdB[1] * C], [PH.holdA2[0] * C, C]].map((h) => h.map((x) => Math.round(x * 100) / 100))
  },

  u(name) {
    const k = this.cur + name
    if (!(k in this.U)) this.U[k] = this.gl.getUniformLocation(this.curProg, name)
    return this.U[k]
  },
  use(pr, tag) { this.gl.useProgram(pr); this.curProg = pr; this.cur = tag },

  upload(name, src, nearest, unit) {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, this.tex[name])
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, src)
    const f = nearest ? gl.NEAREST : gl.LINEAR
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  },

  /** The layout of the scene for this view: the board, the clamp bar, the glyphs, the mark. */
  resize(view) {
    this.view = view
    const gl = this.gl
    const p = this.p
    const W = Math.max(1, Math.round(view.width * view.dpr))
    const H = Math.max(1, Math.round(view.height * view.dpr))
    this.ctx.canvas.width = W
    this.ctx.canvas.height = H
    const vw = view.width, vh = view.height, dpr = view.dpr
    const type = view.type
    this.k = Math.max(0.35, Math.min(1.6, type.size / 180))
    const barB = view.bar.y + view.bar.h
    const copy = view.plates.filter((pl) => pl.y > barB + 1).sort((a, b) => a.y - b.y)[0] || null
    this.board = p.layout === 'board'
    // the board: its ends and top edge in view, running off the bottom; on phones nearly the full width
    // on phones the board runs off both sides (its top edge and the clamp bar make it a board)
    const m = view.mobile ? -24 : Math.round(vw * 0.045)
    this.boardR = [m, barB + (view.mobile ? 16 : 26), vw - m, vh + 60]
    // the clamp bar the copy is printed on: the full width, a margin round the copy plate
    const pad = view.mobile ? 0 : 18
    this.clamp = copy && this.board ? [copy.y - pad, copy.y + copy.h + pad] : null
    // ---- masks ----
    const canv = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); return c }
    const glyphs = []
    const drawAll = (g, scale, mode) => {
      g.save()
      g.scale(scale, scale)
      if (type.rotate) { g.translate(type.center.x, type.center.y); g.rotate(type.rotate); g.translate(-type.center.x, -type.center.y) }
      g.textBaseline = 'alphabetic'
      g.textAlign = 'left'
      let id = 1
      for (const line of type.lines)
        for (const part of line.parts) {
          g.font = type.font(part.italic)
          if ('letterSpacing' in g) g.letterSpacing = `${type.letterSpacing}px`
          for (let i = 0; i < part.text.length; i++) {
            const ch = part.text[i]
            const x = part.x + g.measureText(part.text.slice(0, i)).width
            if (ch.trim()) {
              if (mode === 'id') { const v = `rgb(${(id + 1) * 6},0,0)`; g.fillStyle = v; g.strokeStyle = v; g.lineWidth = 8; g.strokeText(ch, x, line.baseline) }
              else g.fillStyle = '#fff'
              g.fillText(ch, x, line.baseline)
              if (mode === 'id') glyphs.push(id)
              id++
            }
          }
          if ('letterSpacing' in g) g.letterSpacing = '0px'
        }
      g.restore()
      // what the job burned first: the maker's mark (maple, slate) or a graduation scale (anodised)
      g.save()
      g.scale(scale, scale)
      const col = mode === 'id' ? 'rgb(6,0,0)' : '#fff'
      g.fillStyle = col
      g.strokeStyle = col
      if (this.pre?.kind === 'mark') {
        const { x, y, r } = this.pre
        g.lineWidth = r * 0.045; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke()
        g.lineWidth = Math.max(1.2, r * 0.022); g.beginPath(); g.arc(x, y, r * 0.84, 0, TAU); g.stroke()
        g.font = type.font(true).replace(/[\d.]+px/, `${Math.round(r * 0.95)}px`)
        g.textAlign = 'center'
        g.fillText(p.mark, x, y + r * 0.33)
      } else if (this.pre?.kind === 'scale') {
        const { a, b, at, vertical } = this.pre
        for (let i = 0, s = a; s <= b; i++, s += 7.5) {
          const len = i % 10 === 0 ? 22 : i % 5 === 0 ? 14 : 8
          const wd = i % 10 === 0 ? 2 : 1.4
          if (vertical) g.fillRect(at - len, s, len, wd)
          else g.fillRect(s, at - len, wd, len)
        }
      }
      g.restore()
    }
    // the burned-first layer's place
    this.pre = null
    const box = type.box
    if (p.mark && this.mat !== 1) {
      if (view.mobile && this.clamp) {
        const free = vh - this.clamp[1]
        const r = Math.min(64, free / 2 - 34)
        if (r > 26) this.pre = { kind: 'mark', x: vw / 2, y: this.clamp[1] + free / 2 + 4, r }
      } else if (!view.mobile) {
        const r = Math.max(30, Math.min(50, type.size * 0.28))
        const x = Math.min(this.boardR[2] - r - 36, box.x + box.w + (this.boardR[2] - box.x - box.w) / 2)
        const y = Math.min(box.y + box.h - r * 1.2, (this.clamp ? this.clamp[0] : vh) - r - 34)
        if (x - r > box.x + box.w + 24) this.pre = { kind: 'mark', x, y, r }
      }
    }
    if (p.scale && this.mat === 1) {
      if (type.rotate) this.pre = { kind: 'scale', a: barB + 40, b: vh - 100, at: vw - 14, vertical: true }
      else if (copy) this.pre = { kind: 'scale', a: view.width * 0.034, b: vw - vw * 0.034, at: copy.y - 14 }
    }
    const fill = canv(); drawAll(fill.getContext('2d'), dpr, 'fill')
    const blur = (src, px) => { const c = canv(); const g = c.getContext('2d'); g.filter = `blur(${px * dpr}px)`; g.drawImage(src, 0, 0); return c }
    const b1 = blur(fill, this.mat === 1 ? 0.9 : 1.2)
    const b2 = blur(fill, 3.0)
    const idc = canv(); drawAll(idc.getContext('2d'), dpr, 'id')
    // a soft, low-resolution copy for soot and the smoke's source
    const sw = Math.max(8, Math.round(vw / 6)), shh = Math.max(8, Math.round(vh / 6))
    const soft = canv(sw, shh)
    { const g = soft.getContext('2d'); g.filter = 'blur(4px)'; g.drawImage(fill, 0, 0, sw, shh) }
    this.upload('uFill', fill, false, 0)
    this.upload('uB1', b1, false, 1)
    this.upload('uB2', b2, false, 2)
    this.upload('uId', idc, true, 3)
    this.upload('uSoft', soft, false, 4)
    // ---- the glyphs, read back at CSS resolution for the tool's paths ----
    const cw = Math.round(vw), ch = Math.round(vh)
    const small = canv(cw, ch); drawAll(small.getContext('2d'), 1, 'id')
    const data = small.getContext('2d').getImageData(0, 0, cw, ch).data
    const G = new Map()
    const hit = new Uint8Array(cw * ch)
    this.hitMap = { a: hit, w: cw, h: ch }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        const v = data[(y * cw + x) * 4]
        if (v < 9) continue
        hit[y * cw + x] = 1
        const id = Math.round(v / 6) - 1
        if (id < 1) continue
        let g = G.get(id)
        if (!g) G.set(id, (g = { id, n: 0, sx: 0, sy: 0, pts: [] }))
        g.n++; g.sx += x; g.sy += y
        if ((x + y) % 2 === 0) g.pts.push(x, y)
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
    const list = [...G.values()].sort((a, b) => a.id - b.id)
    for (const g of list) {
      g.cx = g.sx / g.n; g.cy = g.sy / g.n
      // the outline, ordered by angle about the centre (the contour pass's head follows it)
      const edge = []
      const at = (x, y) => (x < 0 || y < 0 || x >= cw || y >= ch ? 0 : Math.round(data[(y * cw + x) * 4] / 6) - 1)
      for (let i = 0; i < g.pts.length; i += 2) {
        const x = g.pts[i], y = g.pts[i + 1]
        if (at(x + 2, y) !== g.id || at(x - 2, y) !== g.id || at(x, y + 2) !== g.id || at(x, y - 2) !== g.id) {
          const a = Math.atan2(y - g.cy, x - g.cx) + Math.PI
          edge.push([a, x, y, Math.hypot(x - g.cx, y - g.cy)])
        }
      }
      edge.sort((a, b) => a[0] - b[0])
      // keep the outermost point per small angle step: the head rides the outer contour
      const ring = []
      const steps = 180
      for (let s = 0; s < steps; s++) {
        let best = null
        const a0 = (s / steps) * TAU, a1 = ((s + 1) / steps) * TAU
        for (const e of edge) if (e[0] >= a0 && e[0] < a1 && (!best || e[3] > best[3])) best = e
        if (best) ring.push(best)
      }
      g.ring = ring
      // galvo hatch: the glyph's extent along the hatch axis, and per hatch line its span along the line
      let smin = 1e9, smax = -1e9
      for (let i = 0; i < g.pts.length; i += 2) { const s = (g.pts[i] + g.pts[i + 1]) * Math.SQRT1_2; smin = Math.min(smin, s); smax = Math.max(smax, s) }
      g.smin = smin; g.smax = smax
      const bins = Math.max(1, Math.ceil(smax - smin) + 1)
      g.tmin = new Float32Array(bins).fill(1e9); g.tmax = new Float32Array(bins).fill(-1e9)
      for (let i = 0; i < g.pts.length; i += 2) {
        const x = g.pts[i], y = g.pts[i + 1]
        const b = Math.round((x + y) * Math.SQRT1_2 - smin)
        const t = (x - y) * Math.SQRT1_2
        if (t < g.tmin[b]) g.tmin[b] = t
        if (t > g.tmax[b]) g.tmax[b] = t
      }
      g.pts = null
    }
    this.glyphs = list
    this.job = { x0, x1, y0, y1 }
    // the galvo's time per glyph follows its area
    const area = list.reduce((a, g) => a + g.n, 0) || 1
    let acc = 0
    for (const g of list) { g.t0 = acc / area; acc += g.n; g.t1 = acc / area }
    // ---- the material, once per size ----
    this.use(this.matProg, 'm')
    gl.activeTexture(gl.TEXTURE5)
    gl.bindTexture(gl.TEXTURE_2D, this.tex.uTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex.uTex, 0)
    gl.viewport(0, 0, W, H)
    gl.uniform2f(this.u('uRes'), W, H)
    gl.uniform1f(this.u('uDpr'), dpr)
    gl.uniform1f(this.u('uK'), this.k)
    gl.uniform1i(this.u('uMat'), this.mat)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    // ---- static uniforms of the main pass ----
    this.use(this.main, 'f')
    gl.viewport(0, 0, W, H)
    gl.uniform2f(this.u('uRes'), W, H)
    gl.uniform1f(this.u('uDpr'), dpr)
    gl.uniform1f(this.u('uK'), this.k)
    ;['uFill', 'uB1', 'uB2', 'uId', 'uSoft', 'uTex'].forEach((n, i) => gl.uniform1i(this.u(n), i))
    gl.uniform1i(this.u('uMat'), this.mat)
    gl.uniform1i(this.u('uBoard'), this.board ? 1 : 0)
    gl.uniform4f(this.u('uBoardR'), ...this.boardR)
    gl.uniform3f(this.u('uBench'), ...hex(p.bench))
    gl.uniform3f(this.u('uClampC'), ...hex(this.ctx.theme.plate))
    gl.uniform3f(this.u('uLampC'), ...hex(p.lamp))
    gl.uniform1i(this.u('uGalvo'), this.galvo ? 1 : 0)
    gl.uniform1f(this.u('uDepth'), (this.mat === 1 ? 3.2 : 5) * this.k * p.depth)
    gl.uniform1f(this.u('uGrain'), p.grain)
    const cent = new Float32Array(96)
    for (const g of list) if (g.id < 48) { cent[g.id * 2] = g.cx; cent[g.id * 2 + 1] = g.cy }
    gl.uniform2fv(this.u('uCent'), cent)
    // the air assist blows the smoke up and to one side
    gl.uniform2f(this.u('uWind'), 0.42, -0.9)
  },

  /** The lamp at scene time t (azimuth and elevation, radians), scripted. */
  lampAt(t) {
    const C = this.cycle
    const f = (((t / C) % 1) + 1) % 1
    const A = this.mat === 1 ? [222, 20] : [214, 21]
    const B = this.mat === 1 ? [328, 15] : [322, 19]
    let k = 0
    if (f < PH.swingAB[0]) k = 0
    else if (f < PH.swingAB[1]) k = ease((f - PH.swingAB[0]) / (PH.swingAB[1] - PH.swingAB[0]))
    else if (f < PH.swingBA[0]) k = 1
    else if (f < PH.swingBA[1]) k = 1 - ease((f - PH.swingBA[0]) / (PH.swingBA[1] - PH.swingBA[0]))
    // the long way round over the top, so the light rakes across the letters
    const az = A[0] + (B[0] - A[0]) * k
    const el = A[1] + (B[1] - A[1]) * k + 6 * Math.sin(Math.PI * k)
    return { az: (az * Math.PI) / 180, el: (el * Math.PI) / 180 }
  },

  /** The tool's state at scene time t. Pure. */
  stateAt(t) {
    const C = this.cycle
    const f = (((t / C) % 1) + 1) % 1
    const v = this.view
    const s = { stage: 0, offA: [0, 0], offB: [0, 0], lift: 0, beam: 0, head: [-999, -999], prev: [-999, -999], cCur: 0, cAng: 0, front: -1e4, dir: 1, headX: 0, hCur: 999, sFront: 0, headT: 0, smoke: 0, heat: 0, pass: 1 }
    const span = (a) => (f - a[0]) / (a[1] - a[0])
    const W = v.width, H = v.height
    // the swap: plate A (done) leaves, plate B (blank) arrives; after it, A is the working plate again
    if (f >= PH.swap[0] && f < PH.swap[1]) {
      const k = ease(span(PH.swap))
      if (this.board) { const d = W; s.offA = [-d * k, 0]; s.offB = [d * (1 - k), 0] }
      else { s.offA = [0, H * k]; s.offB = [0, H * k - H] }
      s.lift = 8 * Math.sin(Math.PI * k)
      return s
    }
    if (this.board) s.offB = [W, 0]
    else s.offB = [0, -H]
    const gl = this.glyphs
    if (!gl.length) return s
    if (f >= PH.contour[0] && f < PH.contour[1]) {
      s.stage = 1
      const k = span(PH.contour)
      const n = gl.length
      const x = k * n
      const i = Math.min(n - 1, Math.floor(x))
      const fr = x - i
      s.cCur = gl[i].id
      s.cAng = fr * TAU
      const ring = gl[i].ring
      if (ring.length) {
        const r = ring[Math.min(ring.length - 1, Math.floor(fr * ring.length))]
        s.head = [r[1], r[2]]
        const rp = ring[Math.max(0, Math.floor(fr * ring.length) - 2)]
        s.prev = [rp[1], rp[2]]
      }
      s.beam = 1
      s.smoke = 0.35 * smooth(0, 0.3, k)
      return s
    }
    if (f >= PH.fill[0] && f < PH.fill[1]) {
      s.stage = 2
      const k = span(PH.fill)
      const dur = (PH.fill[1] - PH.fill[0]) * C
      s.smoke = 0.35 + 0.65 * smooth(0, 0.08, k)
      s.heat = 1
      if (this.galvo) {
        // glyph by glyph, area-weighted; inside a glyph, serpentine hatch lines at 45 degrees
        const g = gl.find((g) => k >= g.t0 && k < g.t1) || gl[gl.length - 1]
        const kk = clamp01((k - g.t0) / (g.t1 - g.t0))
        const pitch = 5
        const lines = Math.max(1, Math.ceil((g.smax - g.smin) / pitch))
        const x = kk * lines
        const li = Math.min(lines - 1, Math.floor(x))
        const fr = x - li
        const sv = g.smin + li * pitch
        const b = Math.min(g.tmin.length - 1, Math.max(0, Math.round(sv + pitch * 0.5 - g.smin)))
        let t0 = g.tmin[b], t1 = g.tmax[b]
        if (t0 > t1) { t0 = 0; t1 = 0 }
        const dir = li % 2 === 0 ? 1 : -1
        const tt = dir > 0 ? t0 + (t1 - t0) * fr : t1 - (t1 - t0) * fr
        const at = (s2, t2) => [(s2 + t2) * Math.SQRT1_2, (s2 - t2) * Math.SQRT1_2]
        s.hCur = g.id; s.sFront = sv; s.headT = tt; s.dir = dir
        s.head = at(sv + pitch * 0.5, tt)
        s.prev = at(sv + pitch * 0.5, tt - dir * (t1 - t0) * 0.08)
        s.beam = t1 > t0 ? 1 : 0
        s.pitch = pitch
      } else {
        // gantry raster: the whole job box, line by line, both directions, top to bottom
        const j = this.job
        const pitch = 3 * this.k
        const lines = Math.max(1, Math.ceil((j.y1 - j.y0 + 2) / pitch))
        const x = k * lines
        const li = Math.min(lines - 1, Math.floor(x))
        const fr = x - li
        const dir = li % 2 === 0 ? 1 : -1
        const over = 16
        const xa = j.x0 - over, xb = j.x1 + over
        const hx = dir > 0 ? xa + (xb - xa) * fr : xb - (xb - xa) * fr
        s.front = j.y0 + li * pitch + pitch * 0.5
        s.dir = dir; s.headX = hx
        s.head = [hx, s.front]
        const per = dur / lines
        s.pass = (xb - xa) / per          // head speed, px per second
        const prevX = hx - dir * s.pass / 120
        s.prev = [prevX, s.front]
        s.pitch = pitch
        s.beam = 1 // switched by the glyph under the head (in the shader the fill decides what burns)
      }
      return s
    }
    // done, parked: smoke clears
    if (f >= PH.fill[1] && f < PH.clear[1]) s.smoke = 1 - smooth(PH.fill[1], PH.clear[1], f)
    return s
  },

  seek(t, state) {
    const { gl, view: v, p } = this
    if (!v) return
    this.use(this.main, 'f')
    const s = this.stateAt(t)
    // the lamp: scripted, or the pointer's on a live page
    let { az, el } = this.lampAt(t)
    const live = !this.ctx.recording && !state.still && p.follow
    if (live) {
      const L = this.live
      const now = state.time
      const dt = L.last === null ? 0 : Math.min(0.05, Math.max(0, now - L.last))
      L.last = now
      const resting = !L.ptr || performance.now() - L.rest > 2500
      let aAz = az, aEl = el
      if (!resting) {
        const dx = L.ptr.x - v.width / 2, dy = L.ptr.y - v.height / 2
        aAz = Math.atan2(dy, dx)
        const r = Math.min(1, Math.hypot(dx / (v.width / 2), dy / (v.height / 2)))
        aEl = ((40 - 28 * r) * Math.PI) / 180
      }
      if (L.az === null) { L.az = az; L.el = el }
      let d = aAz - L.az
      d = Math.atan2(Math.sin(d), Math.cos(d))
      const k = 1 - Math.pow(1 - 0.08, dt * 60)
      L.az += d * k
      L.el += (aEl - L.el) * k
      az = L.az; el = L.el
    }
    // the lamp stands just off the plate: close enough that its glare and falloff cross the frame
    const D = (this.mat === 1 ? 0.78 : 1.1) * Math.max(v.width, v.height)
    const cx = v.width / 2, cy = v.height / 2
    gl.uniform3f(this.u('uLamp'), cx + Math.cos(az) * Math.cos(el) * D, cy + Math.sin(az) * Math.cos(el) * D, Math.sin(el) * D)
    gl.uniform2f(this.u('uOffA'), ...s.offA)
    gl.uniform2f(this.u('uOffB'), ...s.offB)
    gl.uniform4f(this.u('uClamp'), this.clamp ? this.clamp[0] : 0, this.clamp ? this.clamp[1] : 0, s.lift, this.clamp ? 1 : 0)
    gl.uniform1i(this.u('uStage'), s.stage)
    gl.uniform1f(this.u('uCCur'), s.cCur)
    gl.uniform1f(this.u('uCAng'), s.cAng)
    gl.uniform1f(this.u('uFrontY'), s.front)
    gl.uniform1f(this.u('uDir'), s.dir)
    gl.uniform1f(this.u('uHeadX'), s.headX)
    gl.uniform1f(this.u('uPitch'), s.pitch || 3)
    gl.uniform1f(this.u('uPass'), s.pass || 1)
    gl.uniform1f(this.u('uHCur'), s.hCur)
    gl.uniform1f(this.u('uSFront'), s.sFront)
    gl.uniform1f(this.u('uHeadT'), s.headT)
    // the spot is on only over a glyph (the raster passes over gaps and turns round with the laser off)
    let beam = s.beam
    if (beam && s.stage === 2 && !this.galvo) beam = this.inGlyph(s.head[0], s.head[1]) ? 1 : 0
    gl.uniform2f(this.u('uHead'), s.head[0] + s.offA[0], s.head[1] + s.offA[1])
    gl.uniform2f(this.u('uHeadPrev'), s.prev[0] + s.offA[0], s.prev[1] + s.offA[1])
    gl.uniform1f(this.u('uBeam'), beam)
    gl.uniform1f(this.u('uSmoke'), s.smoke * p.smoke)
    gl.uniform1f(this.u('uSparks'), p.sparks)
    gl.uniform1f(this.u('uHeat'), s.heat)
    // noise in the smoke and sparks repeats with the loop
    const C = this.cycle
    gl.uniform1f(this.u('uT'), ((((t % C) + C) % C)))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  },

  /** Is there a glyph under this point (CSS px)? The raster fires only there. */
  inGlyph(x, y) {
    const m = this.hitMap
    if (!m) return false
    const xi = Math.round(x), yi = Math.round(y)
    if (xi < 0 || yi < 0 || xi >= m.w || yi >= m.h) return false
    return m.a[yi * m.w + xi] > 0
  },
}
