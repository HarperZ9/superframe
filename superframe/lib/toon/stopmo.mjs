// stopmo.mjs: the stop-motion mode. Three things make a frame read as shot on a table rather than drawn:
//   - replacement jitter: every part sits a little differently each frame, because a hand moved it and put it back
//     (children inherit their parent's knock, plus a smaller one of their own: a replacement mouth on a head);
//   - lighting flicker: tungsten on a mains supply and a shutter that is never quite the same, a per-frame exposure
//     wobble of a few percent with a faint warm-cool drift;
//   - a believable surface: modelling clay, with a dome of volume from the distance to each part's edge, thumb
//     ridges and lumps in the height, a soft key light and a waxy highlight, and no ink line anywhere.
// Amplitudes are authored; the clay's light is Lambert plus Blinn-Phong on a height field.
import { rngFrom } from '../seed.mjs';
import { noise2 } from './ink.mjs';
import { lin } from './raster.mjs';

// Per-frame knocks. amp: model units; rot: radians. Returns a new part list.
export function jitterParts(parts, f, { amp = 3, rot = 0.012, seed = 'stopmo' } = {}) {
  const knock = new Map(), byId = new Map(parts.map(p => [p.id, p]));
  const of = p => {
    if (knock.has(p.id)) return knock.get(p.id);
    const r = rngFrom(`${seed}/${f}/${p.id}`), own = p.clip ? 0.35 : 1, base = p.clip && byId.has(p.clip) ? of(byId.get(p.clip)) : [0, 0, 0];
    const k = [base[0] + (r() - 0.5) * 2 * amp * own, base[1] + (r() - 0.5) * 2 * amp * own, (r() - 0.5) * 2 * rot * own];
    knock.set(p.id, k); return k;
  };
  return parts.map(p => {
    const [dx, dy, dr] = of(p), mv = q => [q[0] + dx, q[1] + dy, q[2]];
    if (p.kind === 'tube' || p.kind === 'stroke') return { ...p, path: p.path.map(mv) };
    return { ...p, at: mv(p.at), rot: (p.rot ?? 0) + dr };
  });
}

// Exposure and white balance for frame f: { gain, tint: [r, g, b] }.
export function flicker(f, { depth = 0.035, seed = 'flicker' } = {}) {
  const r = rngFrom(`${seed}/${f}`), slow = Math.sin(f * 0.37) * 0.4 + Math.sin(f * 1.71) * 0.3, g = 1 + depth * (slow * 0.5 + (r() - 0.5));
  const warm = 0.012 * Math.sin(f * 0.23);
  return { gain: g, tint: [1 + warm, 1, 1 - warm] };
}
export function expose(K, { gain, tint }) { for (let i = 0; i < K.px.length; i++) K.px[i] *= gain * tint[i % 3]; return K; }

// Distance (px) from each covered pixel to the edge of the coverage, by a two-pass 3-4 chamfer.
export function insideDistance(A) {
  const { w, h } = A, D = new Float32Array(w * h), BIG = 1e9;
  for (let i = 0; i < w * h; i++) D[i] = A.a[i] >= 0.5 ? BIG : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : D[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!D[i]) continue; D[i] = Math.min(D[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!D[i]) continue; D[i] = Math.min(D[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4); }
  for (let i = 0; i < w * h; i++) D[i] /= 3;
  return D;
}

// The clay surface as a puppet surface hook: opts.surface = clay({ ... }). Shades the part's pixels in place.
export function clay({ light = [-0.45, -0.65, 0.62], ambient = 0.42, spec = 0.16, shine = 18, ridge = 0.5, seed = 'clay', round = 0.3 } = {}) {
  const L = norm(light), H = norm([L[0], L[1], L[2] + 1]);
  return (K, A, C, p, k) => {
    if (!A || p.kind === 'stroke' || p.opacity === 0) return;
    const D = insideDistance(A), R = Math.max(4, Math.min(round * Math.min(A.w, A.h), 140 * k)), n1 = noise2(`${seed}/${p.id}/lump`), n2 = noise2(`${seed}/${p.id}/print`);
    const prints = Array.from({ length: 3 }, (_, i) => { const r = rngFrom(`${seed}/${p.id}/thumb${i}`); return [A.x0 + r() * A.w, A.y0 + r() * A.h, 30 * k + r() * 40 * k]; });
    const hgt = (x, y) => {
      const i = y * A.w + x, d = D[i] ?? 0, t = Math.min(1, d / R), dome = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) * R;
      const X = x + A.x0, Y = y + A.y0, lump = n1(X / (90 * k), Y / (90 * k)) * 6 * k;
      let th = 0; for (const [cx, cy, rr] of prints) { const q = Math.hypot(X - cx, Y - cy); if (q < rr) th += Math.sin(q / (2.2 * k)) * (1 - q / rr) * ridge * k; }
      return dome + lump + th + n2(X / (6 * k), Y / (6 * k)) * 0.35 * k;
    };
    const Hf = new Float32Array(A.w * A.h);
    for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) if (A.a[y * A.w + x] > 0) Hf[y * A.w + x] = hgt(x, y);
    smooth3(Hf, A.w, A.h); smooth3(Hf, A.w, A.h);                        // the chamfer steps would show as ridges
    for (let y = 1; y < A.h - 1; y++) for (let x = 1; x < A.w - 1; x++) {
      const i = y * A.w + x, a = A.a[i]; if (a <= 0) continue;
      const nx = -(Hf[i + 1] - Hf[i - 1]) / 2, ny = -(Hf[i + A.w] - Hf[i - A.w]) / 2, N = norm([nx, ny, 1]);
      const diff = ambient + (1 - ambient) * Math.max(0, N[0] * L[0] + N[1] * L[1] + N[2] * L[2]) * 1.15, sp = spec * Math.max(0, N[0] * H[0] + N[1] * H[1] + N[2] * H[2]) ** shine;
      const pix = 3 * ((y + A.y0) * K.w + x + A.x0);
      for (let c = 0; c < 3; c++) { const v = K.px[pix + c] * diff + sp; K.px[pix + c] += (v - K.px[pix + c]) * a; }
    }
  };
}
function smooth3(F, w, h) {
  const T = new Float32Array(F.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += F[y * w + Math.min(w - 1, Math.max(0, x + k))]; T[y * w + x] = s / 5; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -2; k <= 2; k++) s += T[Math.min(h - 1, Math.max(0, y + k)) * w + x]; F[y * w + x] = s / 5; }
}
const norm = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };

// A cloth or paper backdrop texture: low-frequency mottling plus fibre noise, multiplied into the canvas.
export function backdrop(K, { seed = 'backdrop', depth = 0.08, fibre = 0.03, scale = 1 } = {}) {
  const a = noise2(`${seed}/m`), b = noise2(`${seed}/f`);
  for (let y = 0; y < K.h; y++) for (let x = 0; x < K.w; x++) {
    const g = 1 + depth * a(x / (380 * scale), y / (380 * scale)) + fibre * b(x / (2.5 * scale), y / (9 * scale)), p = 3 * (y * K.w + x);
    K.px[p] *= g; K.px[p + 1] *= g; K.px[p + 2] *= g;
  }
  return K;
}
export { lin };
