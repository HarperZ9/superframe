// Origin: the alive workspace tests/helpers.js, written 2026-10-23; carried on 2026-11-14 with imports repointed and the look-at copies moved to out/ at the repo root.
// tests/helpers.js: fixtures, goldens and small synthetic scenes for the alive tests.
// Goldens follow the playbook rule: SSIM mean >= 0.995 and worst 32 px tile >= 0.97
// against tests/golden/<name>.png; a missing golden is written once and never overwritten; every render is also
// saved to out/alive-actual/ for the 200% look. PNG and SSIM come from the playbook builds' lib (one copy, not two).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, decodePNG } from '../../../playbook/lib/png.js';
import { ssim } from '../../../playbook/lib/ssim.js';
import { image } from '../src/lib/img.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const GOLDEN = join(HERE, 'golden'), ACTUAL = join(HERE, '..', '..', '..', 'out', 'alive-actual'), FIX = join(HERE, 'fixtures');

export function golden(name, im, { mean = 0.995, tile = 0.97 } = {}) {
  mkdirSync(GOLDEN, { recursive: true }); mkdirSync(ACTUAL, { recursive: true });
  const rgba = new Uint8Array(im.data.buffer, im.data.byteOffset, im.data.length), png = encodePNG(im.w, im.h, rgba), gp = join(GOLDEN, name + '.png');
  writeFileSync(join(ACTUAL, name + '.png'), png);
  if (!existsSync(gp)) { writeFileSync(gp, png); return { created: true, mean: 1, worst: 1, ok: true }; }
  const g = decodePNG(readFileSync(gp));
  if (g.w !== im.w || g.h !== im.h) return { ok: false, reason: `size ${im.w}x${im.h} against golden ${g.w}x${g.h}` };
  const s = ssim(g.data, im.data, im.w, im.h);
  return { created: false, ...s, ok: s.mean >= mean && s.worst >= tile };
}
export const ssimOf = (a, b) => ssim(a.data, b.data, a.w, a.h);
export function fixture(name) { const p = decodePNG(readFileSync(join(FIX, name + '.png'))); return { w: p.w, h: p.h, data: new Uint8ClampedArray(p.data) }; }
export function fnv(bytes) { let h = 2166136261; for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
export const save = (name, bytes) => { mkdirSync(ACTUAL, { recursive: true }); writeFileSync(join(ACTUAL, name), bytes); };

// Strip of images side by side with a 2 px gutter, for goldens of sequences.
export function strip(ims, gap = 2, ground = [15, 15, 14, 255]) {
  const w = ims.reduce((a, m) => a + m.w + gap, -gap), h = Math.max(...ims.map((m) => m.h)), o = image(w, h, ground);
  let x = 0; for (const m of ims) { for (let y = 0; y < m.h; y++) o.data.set(m.data.subarray(y * m.w * 4, (y + 1) * m.w * 4), (y * w + x) * 4); x += m.w + gap; }
  return o;
}

// A textured scene: a striped far wall on top, a checked near floor below, a disc in front. Deterministic.
export function scene(w = 96, h = 72, { shift = 0, disc = [0.5, 0.62, 0.14] } = {}) {
  const o = image(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x - shift, far = y < h * 0.45;
    let v = far ? 150 + 60 * Math.sin(X * 0.45) : ((Math.floor(X / 6) + Math.floor(y / 6)) & 1 ? 70 : 120);
    const dx = (X - disc[0] * w) / w, dy = (y - disc[1] * h) / w; if (Math.hypot(dx, dy) < disc[2]) v = 235 - 40 * Math.hypot(dx, dy) / disc[2];
    o.data.set([v, v * 0.95, v * 0.88, 255], (y * w + x) * 4);
  }
  return o;
}

// Luma centroid of pixels brighter than thr inside a box, for tracking motion in tests.
export function centroid(im, thr = 200, [x0, y0, x1, y1] = [0, 0, im.w, im.h]) {
  let sx = 0, sy = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * im.w + x) * 4; if (im.data[i] > thr) { sx += x; sy += y; n++; } }
  return n ? [sx / n, sy / n] : [NaN, NaN];
}
