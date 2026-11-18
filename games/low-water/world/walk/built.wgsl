// What people have built, drawn from meshes made by rule (build/): houses of the snow town and
// the steel of the works. A vertex is 12 floats: place (metres from the chunk's corner), normal,
// uv, then a material and three numbers it reads:
//   10 timber wall (tone)          11 roof metal (tone)        12 snow on a roof
//   13 window (lit, hue, panes)    14 door (tone)              15 stone footing
//   16 light: colour               17 icicles (atlas card)
//   20 painted steel: colour       21 rusted plate (tone)      22 concrete (tone)
//   23 lattice (atlas card; tone)  24 lagged pipe (tone)       25 ribbed sheet: colour
//   26 banded stack (height m)     27 lit strip of shed windows (seed)
//   18 sign (hue, seed, upright)   19 cloth: colour             28 slate or tile (tone)
//   29 thatch or reed (tone; 1 woven mat, 2 lattice)  30 leaf card (atlas)
//   31 sea rock (tone)             32 surf (flow angle, rock radius)
//   33 woven rug (palette, seed, cushion)
// An instance is the chunk's corner in the world.

struct BOut {
  @builtin(position) clip: vec4f,
  @location(0) wp: vec3f,
  @location(1) n: vec3f,
  @location(2) uv: vec2f,
  @location(3) @interpolate(flat) m: vec4f,
}

@vertex fn vsBuilt(@location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) uv: vec2f, @location(3) m: vec4f, @location(4) i0: vec4f) -> BOut {
  var o: BOut;
  o.wp = pos + i0.xyz;
  o.clip = F.viewProj * vec4f(o.wp, 1.0);
  o.n = nrm; o.uv = uv; o.m = m;
  return o;
}

// rust: plate gone orange-brown in streaks that run down from every seam
fn rust(p: vec2f, tone: f32) -> vec3f {
  let run = fbm(vec2f(p.x * 1.3, p.y * 0.22) + tone * 9.0);
  let blotch = fbm(p * 0.6 + 3.0);
  var c = mix(vec3f(0.070, 0.036, 0.022), vec3f(0.215, 0.085, 0.030), run);
  c = mix(c, vec3f(0.045, 0.040, 0.040), smoothstep(0.5, 0.75, blotch) * 0.7);
  return c * (0.8 + 0.4 * vnoise(p * 9.0));
}

@fragment fn fsBuilt(v: BOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  if (clipped(v.wp) || cutaway(v.wp, v.clip.xy)) { discard; }
  var n = normalize(v.n);
  let view = normalize(v.wp - F.cam.xyz);
  let dist = distance(v.wp, F.cam.xyz);
  let det = 1.0 - smoothstep(8.0, 40.0, dist);
  let k = v.m.x; let night = F.misc.x;
  var alb = vec3f(0.1); var rough = 0.85; var gloss = 0.03; var glow = vec3f(0.0); var wrap = 0.0; var card = false;
  let cold = snowCold(v.wp);
  if (k < 10.5) {
    // boards a hand wide, tarred, the grain running up; pale where the weather has had them
    let b = v.uv.x / 0.15; let id = hash21(vec2f(floor(b), v.m.y * 31.0));
    let gap = smoothstep(0.0, 0.06, abs(fract(b) - 0.5) * -2.0 + 1.0);
    let grain = vnoise(vec2f(v.uv.x * 60.0, v.uv.y * 3.0 + id * 9.0));
    alb = mix(vec3f(0.030, 0.023, 0.018), vec3f(0.085, 0.060, 0.042), id * 0.6 + grain * 0.4) * (0.5 + 0.5 * gap) * (0.8 + 0.4 * v.m.y);
    alb = mix(alb, vec3f(0.16, 0.15, 0.14), smoothstep(0.55, 0.9, fbm(v.uv * vec2f(0.8, 0.3) + v.m.y * 7.0)) * 0.5);
    // snow blown against the foot of the wall
    alb = mix(alb, vec3f(0.80, 0.84, 0.90), cold * smoothstep(0.9, 0.2, v.uv.y + vnoise(v.uv * vec2f(1.2, 3.0)) * 0.7));
    gloss = 0.05 * F.wx.w;
  } else if (k < 11.5) {
    let rib = abs(fract(v.uv.x / 0.4) - 0.5);
    alb = mix(vec3f(0.035, 0.036, 0.040), vec3f(0.070, 0.050, 0.040), fbm(v.uv * 0.9 + v.m.y * 5.0)) * (0.7 + 0.3 * smoothstep(0.0, 0.06, rib));
    rough = 0.5; gloss = 0.3;
  } else if (k < 12.5) {
    let s = snowMat(v.wp.xz + v.wp.y * 0.7, clamp(v.m.y + F.snowp.w * 0.5 - F.wx.y * 0.4, 0.0, 1.0), det);
    alb = s.c; rough = s.r; gloss = s.g; wrap = 0.45;
    // the load is rounded by wind: the normal rolls with a slow noise
    let e = 0.2;
    let g = vec2f(fbm(v.wp.xz * 0.9 + vec2f(e, 0.0)) - fbm(v.wp.xz * 0.9 - vec2f(e, 0.0)), fbm(v.wp.xz * 0.9 + vec2f(0.0, e)) - fbm(v.wp.xz * 0.9 - vec2f(0.0, e)));
    n = normalize(n + vec3f(-g.x, 0.0, -g.y) * 0.9);
    // a thaw greys it and wets its edge
    alb = mix(alb, alb * vec3f(0.62, 0.64, 0.68), F.snowp.y * 0.6);
  } else if (k < 13.5) {
    // a window: a frame, glazing bars, and behind them a room. Lit rooms differ: paper screens,
    // a bare bulb, a curtain half drawn. Lamps come on after the sky has gone.
    let panes = max(v.m.w, 1.0);
    let q = v.uv * vec2f(panes, max(floor(panes * 0.75), 1.0));
    let bar = min(min(fract(q.x), 1.0 - fract(q.x)), min(fract(q.y), 1.0 - fract(q.y)));
    let frame = min(min(v.uv.x, 1.0 - v.uv.x), min(v.uv.y, 1.0 - v.uv.y));
    let wood = step(bar, 0.07) + step(frame, 0.045);
    let lit = step(0.5, v.m.y) * smoothstep(0.25, 0.7, night + (v.m.y - 0.75) * 0.6);
    var hue = mix(vec3f(1.0, 0.70, 0.36), vec3f(1.0, 0.86, 0.62), fract(v.m.z * 3.0));
    if (v.m.z > 0.86) { hue = vec3f(0.62, 0.86, 1.0); }
    let paper = 0.55 + 0.45 * vnoise(v.uv * vec2f(3.0, 5.0) + v.m.z * 40.0);
    let curtain = smoothstep(0.35, 0.3, abs(v.uv.x - 0.5 - (fract(v.m.z * 7.0) - 0.5) * 0.8)) * step(0.6, fract(v.m.z * 11.0));
    // the room: brightest low down where the lamp stands, a shadow crossing it
    let room = (0.35 + 0.65 * smoothstep(1.0, 0.2, v.uv.y)) * paper * (1.0 - 0.6 * curtain);
    alb = mix(vec3f(0.012, 0.016, 0.022), vec3f(0.05, 0.04, 0.035), min(wood, 1.0));
    glow = hue * lit * room * 0.5 * (1.0 - min(wood, 1.0));
    rough = 0.1; gloss = 0.22 * (1.0 - min(wood, 1.0)) * (1.0 - lit);
    // frost creeps in from the corners of cold glass
    let fr = cold * smoothstep(0.30, 0.0, frame + vnoise(v.uv * 14.0) * 0.14);
    alb = mix(alb, vec3f(0.5, 0.55, 0.6), fr * (1.0 - min(wood, 1.0))); glow *= 1.0 - 0.5 * fr;
  } else if (k < 14.5) {
    let b = v.uv.x / 0.2;
    alb = mix(vec3f(0.05, 0.030, 0.020), vec3f(0.11, 0.055, 0.030), v.m.y) * (0.6 + 0.4 * smoothstep(0.0, 0.05, abs(fract(b) - 0.5)));
  } else if (k < 15.5) {
    let c = voro(v.uv * vec2f(2.2, 3.4));
    alb = mix(vec3f(0.035, 0.035, 0.04), vec3f(0.085, 0.08, 0.078), c.z) * (0.4 + 0.6 * smoothstep(0.0, 0.08, c.y));
    alb = mix(alb, vec3f(0.80, 0.84, 0.90), cold * smoothstep(0.8, 0.3, v.uv.y + vnoise(v.uv * 2.0) * 0.5));
  } else if (k < 16.5) {
    // a lit box: brighter at its heart than at its edge, like paper round a flame
    alb = v.m.yzw * 0.2;
    let heart = 0.45 + 0.55 * smoothstep(0.0, 0.5, min(min(fract(v.uv.x * 0.9999), 1.0 - fract(v.uv.x * 0.9999)), 0.5));
    glow = v.m.yzw * (0.04 + 0.96 * smoothstep(0.2, 0.75, night)) * 0.5 * heart;
  } else if (k < 17.5 || (k > 22.5 && k < 23.5) || (k > 29.5 && k < 30.5)) {
    let tx = textureSample(atlasTex, rsamp, v.uv);
    let lod = log2(max(max(length(dpdx(v.uv)), length(dpdy(v.uv))) * 2048.0, 1.0));
    if (textureSampleLevel(atlasTex, rsamp, v.uv, min(lod, 2.5)).a < 0.4) { discard; }
    card = true;
    if (k > 29.5) { alb = tx.rgb * 0.6; rough = 0.8; gloss = 0.02; wrap = 0.5; alb = mix(alb, vec3f(0.80, 0.84, 0.90), cold * smoothstep(0.4, 0.8, vnoise(v.uv * 900.0))); }
    else if (k < 17.5) { alb = vec3f(0.55, 0.62, 0.70); rough = 0.08; gloss = 0.8; wrap = 0.6; }
    else { alb = mix(rust(v.wp.xy + v.wp.zz, v.m.y), tx.rgb * vec3f(0.30, 0.31, 0.33), step(0.5, v.m.y)); rough = 0.6; gloss = 0.15; }
  } else if (k < 18.5) {
    // A sign with lettering. Letters are drawn from a seed: each cell of a column (upright) or a
    // row holds a glyph of three to five strokes, the way a lit board reads from down a lane. Light
    // boards carry dark strokes, dark boards carry lit coloured strokes.
    let up = v.m.w > 0.5;
    let q = select(v.uv, vec2f(v.uv.y, v.uv.x), up);
    let n = select(4.0, 3.0, up);
    let hueId = v.m.y;
    var face = vec3f(0.95, 0.92, 0.82);
    if (hueId > 0.5) { face = vec3f(1.0, 0.88, 0.6); } if (hueId > 1.5) { face = vec3f(0.9, 0.12, 0.08); } if (hueId > 2.5) { face = vec3f(0.08, 0.10, 0.09); }
    if (hueId > 3.5) { face = vec3f(0.12, 0.30, 0.55); } if (hueId > 4.5) { face = vec3f(0.98, 0.95, 0.9); }
    let ink = select(vec3f(0.05, 0.04, 0.04), vec3f(0.55, 1.0, 0.75), hueId > 2.5 && hueId < 3.5);
    let cell = floor(q.x * n); let f = vec2f(fract(q.x * n), q.y);
    var stroke = 0.0;
    if (q.x > 0.06 && q.x < 0.94 && q.y > 0.14 && q.y < 0.86) {
      for (var i = 0; i < 7; i++) {
        let h = hash21(vec2f(cell * 7.0 + f32(i), v.m.z * 113.0));
        let h2 = hash21(vec2f(cell * 3.0 + f32(i) * 5.0, v.m.z * 71.0 + 3.0));
        if (f32(i) > 3.0 + h2 * 4.0) { break; }
        let a = vec2f(0.18 + 0.64 * fract(h * 7.0), 0.2 + 0.6 * fract(h * 13.0));
        let b = select(vec2f(a.x, 0.2 + 0.6 * h2), vec2f(0.18 + 0.64 * h2, a.y), fract(h * 3.0) > 0.5);
        let pa = vec2f(f.x, (q.y - 0.14) / 0.72) - a; let ba = b - a;
        let t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
        stroke = max(stroke, smoothstep(0.06, 0.035, length(pa - ba * t)));
      }
    }
    let rim = step(min(min(v.uv.x, 1.0 - v.uv.x), min(v.uv.y, 1.0 - v.uv.y)), 0.03);
    let paint = mix(face, ink, stroke);
    alb = paint * 0.25 * (1.0 - rim) + vec3f(0.02) * rim;
    let on = smoothstep(0.15, 0.6, night + 0.25) * step(0.2, fract(v.m.z * 5.0));
    glow = paint * on * 0.35 * (1.0 - rim) * (0.9 + 0.1 * vnoise(v.uv * 20.0));
    rough = 0.3; gloss = 0.2;
  } else if (k < 19.5) {
    // cloth: wool and down, dull, a little lighter where it folds toward the light
    alb = v.m.yzw * (0.85 + 0.3 * vnoise(v.wp.xy * 9.0 + v.wp.z));
    rough = 0.95; gloss = 0.02; wrap = 0.3;
  } else if (k < 20.5) {
    // paint over steel: chipped at the edges, streaked under every bolt
    let chip = smoothstep(0.62, 0.8, fbm(v.wp.xz * 1.1 + v.wp.y * 1.7));
    alb = mix(v.m.yzw * (0.75 + 0.3 * vnoise(v.wp.xy * 3.0 + v.wp.z)), rust(v.wp.xy + v.wp.zz, 0.3), chip * 0.7);
    rough = 0.45; gloss = 0.2;
  } else if (k < 21.5) {
    alb = rust(vec2f(v.uv.x, v.uv.y), v.m.y); rough = 0.8; gloss = 0.05;
    // plates riveted in courses
    let course = abs(fract(v.uv.y / 2.4) - 0.5); alb *= 0.75 + 0.25 * smoothstep(0.0, 0.02, 0.5 - course);
  } else if (k < 22.5) {
    let c = concreteMat(v.uv, det);
    alb = c.c * (0.8 + 0.4 * v.m.y);
    // rain has run down it for years
    alb *= 0.65 + 0.35 * smoothstep(0.25, 0.7, fbm(vec2f(v.uv.x * 0.9, v.uv.y * 0.12) + v.m.y * 3.0));
    rough = 0.8;
  } else if (k < 24.5) {
    // lagging in sheet-metal jackets: bands every metre, dull silver
    let band = abs(fract(v.uv.y / 1.1) - 0.5);
    alb = mix(vec3f(0.20, 0.21, 0.22), vec3f(0.36, 0.37, 0.38), vnoise(vec2f(v.uv.y * 0.6, v.m.y * 9.0))) * (0.7 + 0.3 * smoothstep(0.0, 0.03, 0.5 - band));
    alb = mix(alb, rust(v.uv, v.m.y), smoothstep(0.6, 0.85, fbm(v.uv * 0.5 + v.m.y * 11.0)) * 0.6);
    rough = 0.35; gloss = 0.45;
  } else if (k < 25.5) {
    let rib = abs(fract(v.uv.x / 0.25) - 0.5);
    alb = v.m.yzw * (0.65 + 0.35 * smoothstep(0.05, 0.25, rib)) * (0.7 + 0.5 * fbm(vec2f(v.uv.x * 0.4, v.uv.y * 0.1)));
    alb = mix(alb, rust(v.uv, 0.5), smoothstep(0.55, 0.8, fbm(vec2f(v.uv.x * 0.7, v.uv.y * 0.2) + 5.0)) * 0.55);
    rough = 0.5; gloss = 0.2;
  } else if (k < 26.5) {
    // a stack: concrete, with red and white bands near its top
    let band = step(0.5, fract(v.uv.y / 18.0)) * step(v.m.y * 0.55, v.uv.y);
    alb = mix(vec3f(0.19, 0.185, 0.18) * (0.7 + 0.5 * fbm(vec2f(v.uv.x * 0.3, v.uv.y * 0.05))), mix(vec3f(0.5, 0.5, 0.48), vec3f(0.42, 0.045, 0.03), band), step(v.m.y * 0.55, v.uv.y));
  } else if (k > 27.5 && k < 28.5) {
    // slate: courses of small dark plates, each a little different, lichen on the old ones
    let row = floor(v.uv.y / 0.25); let col = floor(v.uv.x / 0.3 + row * 0.5);
    let id = hash21(vec2f(col, row + v.m.y * 17.0));
    let edge = min(abs(fract(v.uv.y / 0.25) - 0.02), abs(fract(v.uv.x / 0.3 + row * 0.5) - 0.5) * 2.0);
    alb = mix(vec3f(0.035, 0.038, 0.045), vec3f(0.075, 0.075, 0.08), id) * (0.55 + 0.45 * smoothstep(0.0, 0.08, edge));
    alb = mix(alb, vec3f(0.16, 0.16, 0.10), smoothstep(0.6, 0.85, fbm(v.uv * 0.7 + v.m.y * 5.0)) * 0.6);
    rough = 0.4; gloss = 0.3;
  } else if (k > 32.5 && k < 33.5) {
    // a woven rug or cushion: a field colour, bands across it and a row of lozenges, the way the
    // flat-woven rugs of the marsh read from across a hall
    var c0 = vec3f(0.42, 0.05, 0.04); var c1 = vec3f(0.62, 0.45, 0.12);
    if (v.m.y > 0.5) { c0 = vec3f(0.08, 0.09, 0.30); c1 = vec3f(0.70, 0.62, 0.50); } if (v.m.y > 1.5) { c0 = vec3f(0.48, 0.10, 0.05); c1 = vec3f(0.05, 0.05, 0.06); }
    if (v.m.y > 2.5) { c0 = vec3f(0.30, 0.04, 0.05); c1 = vec3f(0.08, 0.10, 0.28); } if (v.m.y > 3.5) { c0 = vec3f(0.45, 0.32, 0.10); c1 = vec3f(0.35, 0.05, 0.04); }
    let q = vec2f(v.uv.x * 9.0, v.uv.y * 9.0 + v.m.z * 7.0);
    let band = step(0.72, fract(q.y * 0.5 + v.m.z));
    let loz = step(abs(fract(q.x) - 0.5) + abs(fract(q.y) - 0.5), 0.28) * step(fract(q.y * 0.25 + v.m.z), 0.5);
    alb = mix(c0, c1, max(band, loz)) * (0.8 + 0.25 * vnoise(v.uv * 60.0));
    alb = mix(alb, vec3f(0.85, 0.82, 0.75) * 0.6, step(0.93, fract(q.y * 0.5 + 0.3 + v.m.z)) * 0.7);
    rough = 0.95; gloss = 0.02; wrap = 0.3;
  } else if (k > 30.5 && k < 31.5) {
    // sea rock: dark and jointed, banded by strata, black and glossy where the sea wets it,
    // grey lichen and salt crust above the reach of the spray
    let strata = vnoise(vec2f(v.wp.y * 1.3 + vnoise(v.wp.xz * 0.2) * 2.0, v.m.y * 9.0));
    let crack = smoothstep(0.05, 0.0, abs(vnoise(v.wp.xz * 0.5 + v.wp.y * 0.25) - 0.5)) * 0.4;
    alb = mix(vec3f(0.040, 0.042, 0.046), vec3f(0.11, 0.10, 0.095), strata * 0.7 + fbm(v.wp.xz * 0.5 + v.wp.y * 0.3) * 0.3) * (1.0 - 0.6 * crack);
    let wetBand = 1.0 - smoothstep(1.5, 5.0, v.wp.y);
    alb = mix(alb, alb * 0.45, wetBand); gloss = mix(0.08, 0.6, wetBand); rough = mix(0.8, 0.25, wetBand);
    alb = mix(alb, vec3f(0.30, 0.31, 0.28), smoothstep(0.62, 0.85, fbm(v.wp.xz * 0.7 + v.wp.y)) * smoothstep(8.0, 14.0, v.wp.y) * 0.6 * max(n.y, 0.2));
    alb = mix(alb, vec3f(0.12, 0.12, 0.07), smoothstep(0.5, 0.9, n.y) * 0.5);
  } else if (k > 31.5 && k < 32.5) {
    // surf in a long exposure: foam drawn into streaks along the flow round the rock
    let ang = v.uv.x * 6.2832; let rad = v.uv.y;
    let along = ang * 8.0 + F.cam.w * 0.15;
    let streak = vnoise(vec2f(along * 0.8, rad * 14.0 + v.m.y * 3.0)) * 0.65 + vnoise(vec2f(along * 2.7, rad * 40.0)) * 0.35;
    let thick = (1.0 - rad) * 0.9 + 0.15;
    if (streak * thick < 0.28) { discard; }
    alb = mix(vec3f(0.38, 0.44, 0.48), vec3f(0.78, 0.82, 0.86), smoothstep(0.28, 0.6, streak * thick));
    rough = 0.6; gloss = 0.05; wrap = 0.5; n = vec3f(0.0, 1.0, 0.0);
  } else if (k > 28.5 && k < 29.5) {
    // reed and thatch: bundles laid in courses, the stems running down the slope
    if (v.m.z > 1.5) {
      // a lattice screen: reed laths crossed on the diagonal, open between
      let d1 = abs(fract((v.uv.x + v.uv.y) / 0.32) - 0.5); let d2 = abs(fract((v.uv.x - v.uv.y) / 0.32) - 0.5);
      if (min(d1, d2) > 0.13) { discard; }
    }
    let course = fract(v.uv.y / 0.45);
    let stem = vnoise(vec2f(v.uv.x * 40.0, v.uv.y * 2.0 + v.m.y * 9.0));
    alb = mix(vec3f(0.16, 0.12, 0.07), vec3f(0.36, 0.29, 0.17), stem * 0.7 + v.m.y * 0.3) * (0.55 + 0.45 * smoothstep(0.0, 0.25, course));
    alb = mix(alb, vec3f(0.07, 0.07, 0.05), smoothstep(0.55, 0.8, fbm(v.uv * vec2f(0.5, 0.2) + 3.0)) * 0.5);
    if (v.m.z > 0.5 && v.m.z < 1.5) {
      // a woven mat: strips over and under in a herringbone
      let q = v.uv / 0.12; let row = floor(q.y);
      let wv = abs(fract(q.x + row * 0.5 + select(0.0, q.y, fract(row * 0.5) > 0.25)) - 0.5);
      alb = mix(vec3f(0.20, 0.15, 0.08), vec3f(0.42, 0.33, 0.18), smoothstep(0.0, 0.3, wv) * (0.6 + 0.4 * vnoise(v.uv * 3.0)));
    }
    rough = 0.95; gloss = 0.02; wrap = 0.2;
  } else {
    // a strip of shed windows: most dark, some lit green-white, grime on all of them
    let pane = floor(v.uv.x / 1.4); let lit = step(0.45, hash21(vec2f(pane, v.m.y * 91.0)));
    let bar = step(abs(fract(v.uv.x / 1.4) - 0.5), 0.44) * step(abs(v.uv.y - 0.5), 0.42);
    alb = vec3f(0.02, 0.025, 0.03);
    glow = mix(vec3f(0.75, 1.0, 0.85), vec3f(1.0, 0.8, 0.5), step(0.8, hash21(vec2f(pane, 3.0)))) * lit * bar * (0.5 + 0.5 * vnoise(v.uv * 3.0)) * (0.06 + 0.45 * night);
    rough = 0.2; gloss = 0.4;
  }
  if (!front && card) { n = -n; }
  // snow on whatever faces the sky
  if (k > 19.5 || (k > 13.5 && k < 15.5)) { alb = mix(alb, vec3f(0.82, 0.85, 0.91), cold * smoothstep(0.55, 0.85, n.y)); }
  // wet steel and wet boards
  alb *= 1.0 - 0.3 * F.wx.w * (1.0 - cold);
  gloss = mix(gloss, max(gloss, 0.35), F.wx.w);
  let ndl = clamp((dot(n, F.key.xyz) + wrap) / (1.0 + wrap), 0.0, 1.0);
  var lit = alb * (F.amb.rgb * (0.6 + 0.4 * n.y) + F.keyCol.rgb * F.key.w * ndl * keyShadow(v.wp, n));
  lit += alb * F.ev.w * vec3f(0.7, 0.75, 0.9);
  lit += lampLight(v.wp, n, -view, alb, rough, gloss, wrap);
  // Steel in a lit plant: hundreds of lamps too small to be sent one by one still light the
  // decks and vessels round them. Pools of white and sodium on the steel, strongest low down
  // where the lamps hang thickest, so the plant reads as lit structure from across the water.
  if (k > 19.5) {
    let pool = smoothstep(0.35, 0.8, vnoise(v.wp.xz * 0.06 + v.wp.y * 0.11)) * 0.8 + 0.2;
    let hue = mix(vec3f(0.95, 0.97, 1.0), vec3f(1.0, 0.62, 0.25), smoothstep(0.4, 0.7, vnoise(v.wp.xz * 0.013 + 7.0)));
    lit += alb * hue * F.misc.x * 0.55 * pool * (0.55 + 0.45 * max(n.y, 0.0) + 0.25 * (1.0 - abs(n.y)));
  }
  let fres = gloss * (0.04 + 0.96 * pow(1.0 - max(dot(-view, n), 0.0), 5.0));
  let r = reflect(view, n);
  lit = mix(lit, skyBase(vec3f(r.x, abs(r.y), r.z)), clamp(fres, 0.0, 1.0) * 0.6);
  return vec4f(inAir(lit + glow, v.wp), 1.0);
}
@fragment fn fsBuiltShadow(v: BOut) {
  if (v.m.x > 31.5 && v.m.x < 32.5) { discard; }
  if ((v.m.x > 16.5 && v.m.x < 17.5) || (v.m.x > 22.5 && v.m.x < 23.5) || (v.m.x > 29.5 && v.m.x < 30.5)) { if (textureSample(atlasTex, rsamp, v.uv).a < 0.4) { discard; } }
}
