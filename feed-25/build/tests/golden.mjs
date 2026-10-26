// golden.mjs: golden-image helpers. A golden is the 8-bit sRGB luma of a piece rendered at 256 px,
// base64 in tests/golden/<name>.json. Compared with SSIM (lettering lib): mean over the image and the
// worst 32 px tile, the thresholds of QUALITY-SPEC S5 (mean >= 0.995, worst tile >= 0.97).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ssim, encode, decode } from '../../../lettering/lib/ssim.mjs';
import { PIECES } from '../pieces.mjs';
import { loadPlates } from '../render.mjs';
import * as Anim from '../anim.mjs';

export const SIZE = 256;
export const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'golden');

export function lumaOf(rgba, n) { const f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = (0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2]) / 255; return f; }

export async function renderSmall(name) {
  if (name === 'feedback-plate') { const st = Anim.createFeedback(SIZE); let r; for (let i = 0; i < 12; i++) r = Anim.step(st); return r.sheet.out({ grain: r.grain }); }
  const r = await PIECES[name].render(SIZE, { plates: loadPlates() }); return r.sheet.out({ grain: r.grain });
}

export function compare(a, b, w = SIZE, h = SIZE, tile = 32) {
  const mean = ssim(a, b, w, h); let worst = 1;
  for (let y = 0; y < h; y += tile) for (let x = 0; x < w; x += tile) {
    const A = new Float32Array(tile * tile), B = new Float32Array(tile * tile);
    for (let j = 0; j < tile; j++) for (let i = 0; i < tile; i++) { A[j * tile + i] = a[(y + j) * w + x + i]; B[j * tile + i] = b[(y + j) * w + x + i]; }
    worst = Math.min(worst, ssim(A, B, tile, tile));
  }
  return { mean, worst };
}

export const NAMES = [...Object.keys(PIECES), 'feedback-plate'];
export const readGolden = (name) => decode(JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')).luma);

// node tests/golden.mjs --write : regenerate every golden (only after a deliberate visual change).
if (process.argv.includes('--write')) {
  for (const name of NAMES) {
    const f = lumaOf(await renderSmall(name), SIZE * SIZE);
    fs.writeFileSync(path.join(DIR, `${name}.json`), JSON.stringify({ name, size: SIZE, luma: encode(f) }));
    console.log('golden', name);
  }
}
