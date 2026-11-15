// The study under the paint: the value design and colour a painter would decide before laying a stroke.
// One light. Every pixel of the sitter goes to the light family or the shadow family (a soft split at the
// terminator), the light family in three planes, the shadow family one flat cool plane with a little warm
// reflected light near its edge. Skin varies in temperature as a painter mixes it: the forehead yellow,
// the middle of the face (cheeks, nose, ears) red, the jaw and chin cool, a warm red at the terminator.
// Cloth carries folds: a fold field in the cloth's own space, deepened where the body closes (cavity),
// bent into the normal before the light is computed, so a coat turns in folds instead of a flat blob.
// The ground is counterchanged against the figure: darker behind the lit side, lighter behind the shadow.
//   study({ G, A, face, maps, key, opts }) -> { rgb (Float32Array n*3 linear), light (0..1 light family), fold }
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const SKIN = new Set([4, 29, 39, 16]), EYEISH = new Set([15, 28, 25]), HAIR = new Set([5, 26]);
// cloth: everything that is not skin, eye, hair, metal, glass or flame
const NOT_CLOTH = new Set([4, 29, 39, 16, 15, 28, 5, 26, 11, 13, 14, 23, 25, 30, 33, 52, 27, 48]);
export const isSkin = (id) => SKIN.has(id), isCloth = (id) => id && !NOT_CLOTH.has(id), isEye = (id) => EYEISH.has(id), isHair = (id) => HAIR.has(id);

function hash3(x, y, z) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t, c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
// a fold profile: ridged noise stretched along the drape (down the body), its spacing a few centimetres;
// returns height 0..1 (ridges at 1) for a bind-space point
function foldHeight(p, scale) {
  const x = p[0] / scale, y = p[1] / (scale * 3.2), z = p[2] / scale;
  const a = 1 - Math.abs(vnoise(x + 3.1, y, z) * 2 - 1), b = 1 - Math.abs(vnoise(x * 2.1 + 9, y * 1.7, z * 2.1) * 2 - 1);
  return Math.pow(a, 1.6) * 0.8 + Math.pow(b, 2.5) * 0.2;
}

export function study({ G, A, face, maps, key = { dir: [-0.6, 0.3, 0.74], c: [1.0, 0.82, 0.62] }, opts = {} }) {
  const { w, h } = G, n = w * h, rgb = new Float32Array(n * 3), lightF = new Float32Array(n), fold = new Float32Array(n);
  const o = { amb: [0.075, 0.085, 0.11], bounce: [0.09, 0.06, 0.045], keyGain: 1.35, wrap: 0.15, foldScale: 0.075, foldDepth: 0.55, planes: 3, ...opts };
  const L = key.dir.map((v) => v / Math.hypot(...key.dir)), kc = key.c;
  for (let i = 0; i < n; i++) {
    const id = G.id[i]; if (!id) continue;
    let nx = G.N[i * 3], ny = G.N[i * 3 + 1], nz = G.N[i * 3 + 2];
    const p = [G.loc[i * 3], G.loc[i * 3 + 1], G.loc[i * 3 + 2]], cav = maps.cav[i];
    // cloth folds: the gradient of the fold height bends the normal (sideways across the drape), deeper in cavity
    if (isCloth(id)) {
      const e = 0.004, f0 = foldHeight(p, o.foldScale), fx = (foldHeight([p[0] + e, p[1], p[2]], o.foldScale) - f0) / e, fz = (foldHeight([p[0], p[1], p[2] + e], o.foldScale) - f0) / e;
      const amt = o.foldDepth * o.foldScale * (0.55 + 1.6 * cav);
      nx -= fx * amt; nz -= fz * amt; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; fold[i] = f0;
    }
    const shd = G.shadow ? G.shadow[i] : 1, d = clamp((nx * L[0] + ny * L[1] + nz * L[2] + o.wrap) / (1 + o.wrap)) * (0.15 + 0.85 * shd);
    // the light family, softly split from the shadow; inside it, planes (value steps with soft edges)
    const t = sm(0.16, 0.3, d), q = planes(clamp((d - 0.2) / 0.8), o.planes);
    lightF[i] = t;
    let a = [A.rgb[i * 3], A.rgb[i * 3 + 1], A.rgb[i * 3 + 2]];
    if (SKIN.has(id)) a = skinTemp(a, p, face, nx);
    if (HAIR.has(id)) a = a.map((v) => v * 0.9);
    if (id === 25) a = [0.16, 0.18, 0.18];   // a spectacle lens: dark glass over the eye (lit only by its highlight), never a glowing disc
    const ao = 1 - 0.75 * cav;
    const lit = [0, 1, 2].map((c) => a[c] * (kc[c] * o.keyGain * (0.45 + 0.6 * q) * ao + o.amb[c] * 1.5));
    // the shadow family: flat, cool, with warm light thrown back into it from below and behind (the jaw, the coat's underside)
    const refl = clamp(-ny * 0.6 + (nx * L[0] < 0 ? -nx * L[0] : 0) * 0.5) * (1 - cav);
    const shadow = [0, 1, 2].map((c) => a[c] * (o.amb[c] * 2.2 + o.bounce[c] * 2.4 * refl) * (1 - 0.5 * cav));
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = shadow[c] + (lit[c] - shadow[c]) * t;
    // the terminator on skin runs warm and a little saturated (blood under skin where the light turns)
    if (SKIN.has(id)) { const b = Math.max(0, 1 - Math.abs(t - 0.45) * 3.2) * 0.55; rgb[i * 3] *= 1 + 0.35 * b; rgb[i * 3 + 1] *= 1 - 0.06 * b; rgb[i * 3 + 2] *= 1 - 0.2 * b; }
  }
  return { rgb, light: lightF, fold };
}
// value steps with soft edges: the light family reads as a few planes, not a smooth gradient
function planes(v, k) { const t = v * k, f = t - Math.floor(t), s = sm(0.35, 0.65, f); return clamp((Math.floor(t) + s) / k); }
// the three zones of a face (forehead yellow, middle red, jaw cool), from the bind-space height in the head
function skinTemp(a, p, face, nx) {
  const y = (p[1] - face.c[1]) / face.R, side = Math.abs(p[0] - face.c[0]) / face.R;
  const top = sm(0.05, 0.4, y), low = sm(-0.25, -0.6, y), mid = Math.max(0, 1 - top - low), ear = sm(0.62, 0.85, side) * (1 - low);
  const tint = [1 + 0.04 * top + 0.09 * mid + 0.08 * ear - 0.05 * low, 1 + 0.01 * top - 0.03 * mid - 0.02 * ear + 0.0 * low, 1 - 0.1 * top - 0.06 * mid - 0.05 * ear + 0.06 * low];
  void nx; return a.map((v, c) => v * tint[c]);
}

// The ground behind the sitter, counterchanged: a warm-grey field, darker behind the lit side of the
// figure and lighter behind its shadow side, a soft glow behind the head, falling dark to the corners.
export function ground({ G, face, mask, keySide = -1, colours = { mid: [0.27, 0.27, 0.29], dark: [0.1, 0.095, 0.1], light: [0.46, 0.45, 0.43] } }) {
  const { w, h } = G, n = w * h, out = new Float32Array(n * 3), hx = colCentre(mask, w, h, face.eyeRow), hy = face.eyeRow;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, side = (x - hx) / (w * 0.5) * -keySide;   // 1 on the lit side, -1 on the shadow side
    const glow = Math.exp(-(((x - hx) / (w * 0.42)) ** 2 + ((y - hy) / (h * 0.42)) ** 2)), vig = 1 - 0.55 * (((x / w - 0.5) * 1.6) ** 2 + ((y / h - 0.45) * 1.3) ** 2);
    const tLight = clamp(0.5 - 0.6 * side) * glow, tDark = clamp(0.25 + 0.5 * side) * (1 - glow * 0.4);
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.max(0, (colours.mid[c] + (colours.light[c] - colours.mid[c]) * tLight - (colours.mid[c] - colours.dark[c]) * tDark) * clamp(vig, 0.35, 1));
  }
  return out;
}
function colCentre(mask, w, h, row) {
  const r = Math.max(0, Math.min(h - 1, row)); let s = 0, k = 0;
  for (let x = 0; x < w; x++) if (mask[r * w + x]) { s += x; k++; }
  return k ? s / k : w / 2;
}
