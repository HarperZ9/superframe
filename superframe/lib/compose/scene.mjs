// scene.mjs: synthetic scenes ray-cast through a pinhole camera, so every answer the checkers are graded on is
// planted by geometry: vanishing points from K R d, subject positions from projecting the subject box, and the depth
// span of each visible line from clipping it to the frame. Painted lines are box-filtered over each sample's
// footprint on the surface, so lines far down a corridor fade to their mean tone instead of aliasing into moire.
import { makeCamera, visibleSpan } from './camera.mjs';

const enc = c => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));

// Fraction of [s - fp/2, s + fp/2] covered by lines of width lw centred on multiples of period P.
export function stripeCov(s, fp, P, lw) {
  const C = x => { const y = x + lw / 2, k = Math.floor(y / P); return k * lw + Math.min(y - k * P, lw); };
  if (fp < 1e-9) { const m = (((s + lw / 2) % P) + P) % P; return m < lw ? 1 : 0; }
  return (C(s + fp / 2) - C(s - fp / 2)) / fp;
}

// Render with ss x ss stratified samples per pixel; shade(o, d, fp) returns linear RGB. fp: world size of a pixel at unit distance.
export function render(cam, shade, { ss = 2 } = {}) {
  const { w, h } = cam, rgba = new Uint8ClampedArray(w * h * 4), fp = 1 / (cam.f * ss);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const c = shade(cam.pos, cam.ray(i + (sx + 0.5) / ss, j + (sy + 0.5) / ss), fp);
      r += c[0]; g += c[1]; b += c[2];
    }
    const n = ss * ss, p = 4 * (j * w + i);
    rgba[p] = enc(r / n); rgba[p + 1] = enc(g / n); rgba[p + 2] = enc(b / n); rgba[p + 3] = 255;
  }
  return rgba;
}

export const CORRIDOR = { hw: 1.5, H: 3, z0: -1, z1: 40, P: 0.5, Pz: 2, lw: 0.03, lineGain: 1.9 };
const TONE = { floor: [0.11, 0.095, 0.085], ceil: [0.26, 0.27, 0.3], left: [0.17, 0.15, 0.13], right: [0.2, 0.18, 0.16],
  end: [0.13, 0.13, 0.14], facade: [0.33, 0.31, 0.28], lamp: [1, 0.96, 0.88], subject: [0.46, 0.43, 0.4] };

function slab(o, d, lo, hi) {
  let tn = -Infinity, tf = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < lo[a] || o[a] > hi[a]) return null; continue; }
    let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a]; if (t1 > t2) [t1, t2] = [t2, t1];
    tn = Math.max(tn, t1); tf = Math.min(tf, t2);
  }
  return tn <= tf && tf > 0 ? tn : null;
}

// Surface hit inside the corridor box from parameter t0: which wall, and its two surface coordinates.
function corridorExit(o, d, S) {
  const c = [['x', d[0] < 0 ? -S.hw : S.hw, 0], ['y', d[1] < 0 ? 0 : S.H, 1], ['z', S.z1, 2]];
  let best = Infinity, which = null;
  for (const [, b, a] of c) { if (Math.abs(d[a]) < 1e-12) continue; const t = (b - o[a]) / d[a]; if (t > 0 && t < best) { best = t; which = a; } }
  const p = [o[0] + best * d[0], o[1] + best * d[1], o[2] + best * d[2]];
  if (which === 0) return { t: best, p, s: d[0] < 0 ? 'left' : 'right', u: p[2], v: p[1], cos: Math.abs(d[0]) };
  if (which === 1) return { t: best, p, s: d[1] < 0 ? 'floor' : 'ceil', u: p[2], v: p[0], cos: Math.abs(d[1]) };
  return { t: best, p, s: 'end', u: p[0], v: p[1], cos: Math.abs(d[2]) };
}

function inLamp(hit, lamps) {
  for (const L of lamps) if (L.s === hit.s && Math.abs(hit.u - L.u) < L.du && Math.abs(hit.v - L.v) < L.dv) return true;
  return false;
}

export function corridorShader(S) {
  const sub = S.subject ? { lo: [S.subject.x - 0.25, 0, S.subject.z - 0.15], hi: [S.subject.x + 0.25, 1.75, S.subject.z + 0.15] } : null;
  return (o, d, fp) => {
    let org = o;
    if (o[2] < S.z0) {
      if (d[2] <= 0) return TONE.facade;
      const t = (S.z0 - o[2]) / d[2], p = [o[0] + t * d[0], o[1] + t * d[1], S.z0];
      if (Math.abs(p[0]) > S.hw || p[1] < 0 || p[1] > S.H) return TONE.facade;
      org = p;
    }
    const hit = corridorExit(org, d, S);
    if (sub) { const ts = slab(org, d, sub.lo, sub.hi); if (ts !== null && ts < hit.t) return TONE.subject; }
    if (inLamp(hit, S.lamps ?? [])) return TONE.lamp;
    const base = TONE[hit.s];
    if (hit.s === 'end') return base;
    const dist = Math.hypot(hit.p[0] - o[0], hit.p[1] - o[1], hit.p[2] - o[2]), f = dist * fp / Math.max(0.08, hit.cos);
    const ca = stripeCov(hit.u, f, S.Pz, S.lw), cb = stripeCov(hit.v, dist * fp, S.P, S.lw), c = 1 - (1 - ca) * (1 - cb);
    return base.map(x => x * (1 + (S.lineGain - 1) * c));
  };
}

// The corridor's depth lines (painted lines and the four corners), for the planted depth spans.
export function corridorLines(S) {
  const L = [];
  for (let y = 0; y <= S.H + 1e-9; y += S.P) { L.push([-S.hw, y]); L.push([S.hw, y]); }
  for (let x = -S.hw + S.P; x < S.hw - 1e-9; x += S.P) { L.push([x, 0]); L.push([x, S.H]); }
  return L.map(([x, y]) => ({ X0: [x, y, S.z0], d: [0, 0, 1], t1: S.z1 - S.z0 }));
}

const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };

// A corridor scene: render plus planted answers. cam: makeCamera options; S: CORRIDOR overrides.
export function corridorScene(camOpts, S0 = {}, { ss = 2 } = {}) {
  const S = { ...CORRIDOR, ...S0 }, cam = makeCamera(camOpts), rgba = render(cam, corridorShader(S), { ss });
  const spans = corridorLines(S).map(l => visibleSpan(cam, l.X0, l.d, 0, l.t1, { minPx: 0.02 * cam.w })).filter(Boolean);
  const subject = S.subject ? cam.project([S.subject.x, 0.875, S.subject.z]).slice(0, 2) : null;
  const lamps = (S.lamps ?? []).map(L => cam.project(lampCentre(L, S)).slice(0, 2));
  return { w: cam.w, h: cam.h, rgba, cam, S, truth: { vp: cam.vanish([0, 0, 1]), subject, lamps, spans,
    depthRatio: median(spans.map(s => s.far[2] / s.near[2])) } };
}
export function lampCentre(L, S) {
  if (L.s === 'ceil') return [L.v, S.H, L.u];
  return [L.s === 'left' ? -S.hw : S.hw, L.v, L.u];
}

// Rail track on an open ground plane under a plain sky: two tracks, rails 1.5 m apart, sleepers every 0.65 m.
export function railShader() {
  const sky = [0.55, 0.6, 0.68], ground = [0.09, 0.08, 0.07], rail = [0.5, 0.5, 0.52], sleeper = [0.17, 0.13, 0.1];
  return (o, d, fp) => {
    if (d[1] >= -1e-9) return sky;
    const t = -o[1] / d[1], x = o[0] + t * d[0], z = o[2] + t * d[2], f = t * fp / Math.max(0.02, -d[1]), fx = t * fp;
    let c = ground;
    const tx = ((x % 4.5) + 4.5) % 4.5 - 2.25;   // tracks repeat every 4.5 m across
    if (Math.abs(tx) < 1.3) { const s = stripeCov(z, f, 0.65, 0.22); c = c.map((g, k) => g * (1 - s) + sleeper[k] * s); }
    const r = Math.min(1, stripeCov(tx - 0.75, fx, 1e9, 0.07) + stripeCov(tx + 0.75, fx, 1e9, 0.07));
    return c.map((g, k) => g * (1 - r) + rail[k] * r);
  };
}
export function railScene(camOpts, { ss = 2 } = {}) {
  const cam = makeCamera({ pos: [0, 1.7, 0], ...camOpts }), rgba = render(cam, railShader(), { ss });
  return { w: cam.w, h: cam.h, rgba, cam, truth: { vp: cam.vanish([0, 0, 1]), subject: null, spans: [], depthRatio: null } };
}
