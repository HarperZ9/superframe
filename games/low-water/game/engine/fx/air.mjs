// The air and the sky, as post on a finished frame (the author's sections 13 and 14; techniques only, own code): film
// grain in the luminance, a blue-hour sky with peach-lit clouds behind silhouettes, rays down the street from a low sun,
// distance haze in planes of warm and cold air, valley fog lying low at dawn, the sky mirrored in flooded ground, and a
// rare bleached look with one hue kept. Same frame operations for the painted and glyph frames; depth, height, wetness
// and sun visibility come from the light field (F). Deterministic in (frame, seed, t); grain honours the flicker setting.
//   grain(img, { era, t, setting })           luminance grain, strongest in the darks and mids; eras 4 and 5 heaviest
//   blueHourSky(img, F, sky, { seed })         the sky's samples (none behind them) as slate blue with peach-lit cloud
//   godRays(img, F, sky, { k })                the sunlit ground smeared away from the sun across the frame, warm
//   hazePlanes(img, F, sky, { planes })        the fog depth stepped into planes, each a little warmer or colder
//   valleyFog(img, F, sky, { k, top })         fog by height over the lowest ground, lit by the hour
//   skyMirror(img, F, sky, { k })              flooded and wet ground taking the sky's colour by its Fresnel
//   bleach(img, { hue, keep, k })              toward white, one hue kept (dream or memory, rarely)
const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const enc = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, Math.min(1, x)), 1 / 2.4) - 0.055) * 255;
const hh = (a, b, c = 0) => { let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
const vn = (x, y, s) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, U = u * u * (3 - 2 * u), V = v * v * (3 - 2 * v); return (hh(i, j, s) * (1 - U) + hh(i + 1, j, s) * U) * (1 - V) + (hh(i, j + 1, s) * (1 - U) + hh(i + 1, j + 1, s) * U) * V; };
const fbm = (x, y, s) => vn(x, y, s) * 0.55 + vn(x * 2.1, y * 2.1, s + 1) * 0.3 + vn(x * 4.3, y * 4.3, s + 2) * 0.15;
const sample = (F, W, H, x, y) => Math.min(F.h - 1, Math.floor(y * F.h / H)) * F.w + Math.min(F.w - 1, Math.floor(x * F.w / W));
const each = (img, f) => { const W = img.width, H = img.height, D = img.data; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = (y * W + x) * 4, c = [LIN[D[q]], LIN[D[q + 1]], LIN[D[q + 2]]], o = f(c, x, y); if (o) for (let k = 0; k < 3; k++) D[q + k] = enc(o[k]); } return img; };
const isSky = (F, i) => !Number.isFinite(F.pos[i * 3 + 1]) || F.pos[i * 3 + 1] > 500;

export const GRAIN = { 1: 0.02, 2: 0.03, 3: 0.035, 4: 0.06, 5: 0.07 };
export function grain(img, { era = 2, t = 0, setting = "full" } = {}) {
  if (setting === "off") return img; const a = GRAIN[era] * (setting === "reduced" ? 0.4 : 1), f = Math.floor(t * 24);
  return each(img, (c, x, y) => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], w = Math.sqrt(Math.max(0, l)) * (1 - l) * 2.2, n = (hh(x, y, f) + hh(x + 7, y + 3, f) - 1) * a * w; return c.map((v) => v + n); });
}
export function blueHourSky(img, F, sky, { seed = 5 } = {}) {
  const W = img.width, H = img.height, peach = [1.0, 0.62, 0.42], slate = [0.12, 0.17, 0.3], low = sky.horizon || [0.4, 0.35, 0.4];
  return each(img, (c, x, y) => {
    const i = sample(F, W, H, x, y); if (!isSky(F, i)) return null; const v = y / H, base = slate.map((s, k) => s * (1 - v * 0.6) + low[k] * v * 0.6);
    const cl = fbm(x / 90, y / 28, seed), cov = Math.max(0, (cl - 0.52) / 0.25), under = Math.max(0, fbm(x / 90, (y + 6) / 28, seed) - cl);   // a cloud's underside: where it thins downward
    return base.map((b, k) => b * (1 - Math.min(1, cov)) + (slate[k] * 0.8 + peach[k] * Math.min(1, under * 9) * 0.9) * Math.min(1, cov));
  });
}
// rays from a low sun: each pixel gathers the sunlit samples behind it toward the sun's direction on the screen
export function godRays(img, F, sky, { k = 0.35, steps = 28, reach = 0.35 } = {}) {
  const W = img.width, H = img.height, s = sky.sun; if (!(s.E > 0)) return img; const B = F.camB; if (!B) return img;
  const sx = s.dir[0] * B.right[0] + s.dir[2] * B.right[2], sy = -(s.dir[0] * B.up[0] + s.dir[1] * B.up[1] + s.dir[2] * B.up[2]), l = Math.hypot(sx, sy) || 1, dx = sx / l, dy = sy / l, L = reach * Math.hypot(W, H), warm = s.rgb.map((v) => v / (Math.max(...s.rgb) || 1));
  const lit = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = sample(F, W, H, x, y); lit[y * W + x] = isSky(F, i) ? 0.6 : F.sunVis[i] / 255; }
  return each(img, (c, x, y) => {
    let a = 0; for (let j = 1; j <= steps; j++) { const t = (j / steps) * L, X = Math.round(x + dx * t), Y = Math.round(y + dy * t); if (X < 0 || Y < 0 || X >= W || Y >= H) break; a += lit[Y * W + X] * (1 - j / steps); }
    const g = (a / steps) * k * Math.min(1, s.E * 3); return c.map((v, q) => v + warm[q] * g);
  });
}
export function hazePlanes(img, F, sky, { planes = 4, k = 1 } = {}) {
  const W = img.width, H = img.height, warm = (sky.horizon || [0.6, 0.5, 0.45]).map((v) => v / Math.max(...(sky.horizon || [1]))), cold = [0.55, 0.62, 0.75];
  return each(img, (c, x, y) => {
    const i = sample(F, W, H, x, y), f = F.rec.fog[i] / 255 * k; if (f <= 0.01 || isSky(F, i)) return null;
    // planes: the depth stepped, each step's edge softened over a fifth of a plane, warm and cold air in turn
    const u = Math.min(planes - 0.001, f * planes * 2.5), p = Math.floor(u), e = u - p, blend = e > 0.8 ? (e - 0.8) / 0.2 : 0, m = Math.min(0.55, ((p + blend) + 1) / planes * 0.45);
    const col = [0, 1, 2].map((q) => (p % 2 ? cold[q] : warm[q]) * (1 - blend) + ((p + 1) % 2 ? cold[q] : warm[q]) * blend);
    return c.map((v, q) => v * (1 - m) + col[q] * 0.7 * m);
  });
}
export function valleyFog(img, F, sky, { k = 0.8, top = 1.2 } = {}) {
  const W = img.width, H = img.height; let gy = Infinity; for (let i = 0; i < F.n; i += 13) if (!isSky(F, i) && Number.isFinite(F.N[i * 3])) gy = Math.min(gy, F.pos[i * 3 + 1]);
  const col = sky.amb.map((v, q) => Math.min(1, v * 1.6 + 0.12 + (sky.sun.rgb[q] || 0) * sky.sun.E * 0.8));
  return each(img, (c, x, y) => {
    const i = sample(F, W, H, x, y); if (isSky(F, i)) return null; const h = F.pos[i * 3 + 1] - gy, n = fbm(F.pos[i * 3] / 6, F.pos[i * 3 + 2] / 6, 21);
    const f = Math.min(0.85, k * Math.exp(-Math.max(0, h) / top) * (0.55 + 0.45 * n)); return c.map((v, q) => v * (1 - f) + col[q] * f);
  });
}
export function skyMirror(img, F, sky, { k = 0.8 } = {}) {
  const W = img.width, H = img.height, top = sky.amb.map((v) => Math.min(1, v * 2.2)), hor = (sky.horizon || sky.amb).map((v) => Math.min(1, v * 2.2));
  return each(img, (c, x, y) => {
    const i = sample(F, W, H, x, y), w = F.rec.wet[i] / 255; if (w < 0.45 || isSky(F, i)) return null;   // standing water only
    const rip = 0.85 + 0.15 * Math.sin(F.pos[i * 3] * 9 + F.pos[i * 3 + 2] * 5), fr = 0.35 + 0.45 * (1 - (F.up[i] / 255 - 0.5) * 2) ** 2, m = Math.min(0.85, (w - 0.45) / 0.55 * k * fr * 1.6) * rip, v = y / H;
    return c.map((p, q) => p * (1 - m) + (top[q] * (1 - v) + hor[q] * v) * m);   // the sky upside down: the zenith nearest the viewer
  });
}
export function bleach(img, { hue = 25, keep = 22, k = 0.75 } = {}) {
  return each(img, (c) => {
    const mx = Math.max(...c), mn = Math.min(...c), l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; let h = 0;
    if (mx > mn) { const d = mx - mn; h = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4; h = (h * 60 + 360) % 360; }
    const dh = Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue)), held = mx - mn > 0.05 && dh < keep ? 1 : 0, up = 1 - (1 - Math.min(1, l * 2.6)) * (1 - k) - 0;
    const wash = Math.min(1, l * (1 + 3 * k) + 0.25 * k);
    return held ? c.map((v) => Math.min(1, v * (1 + k))) : [wash, wash, wash * 0.97].map((v) => v * up + v * (1 - up));
  });
}
