// stack-plates-b.mjs: plate 3 (onion skin and sprite stacking, the time and height axes of one read) and plate 4
// (the living still and the motion lens's reading of it).
import { existsSync, readFileSync } from 'node:fs';
import { spriteSeq, onionFrame, ghostCentroid } from '../lib/stack/echo.mjs';
import { volume, vidx, spriteStack } from '../lib/stack/stack.mjs';
import { frame } from '../lib/stack/frame.mjs';
import { livingStill } from '../lib/stack/still.mjs';
import { gable, rain } from './stack-scenes.mjs';
import { SPRITE } from './stack-plates-a.mjs';
import { newPlate, panel, units, text, para, writePlate, INK, M } from './stack-plate-kit.mjs';

const f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);

// A voxel pine on a snowy plinth: 18 x 18 x 26 cells, cones of foliage stepping in, snow on each tier's rim.
function pine() {
  const V = volume(18, 18, 26), set = (x, y, z, rgb) => { const k = vidx(V, x, y, z); V.occ[k] = 1; V.rgb.set(rgb, 3 * k); };
  for (let z = 0; z < 26; z++) for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
    const r = Math.hypot(x - 8.5, y - 8.5);
    if (z < 2) { set(x, y, z, x > 14 ? [0.55, 0.12, 0.08] : y > 14 ? [0.75, 0.55, 0.15] : [0.75, 0.78, 0.85]); continue; }
    if (z < 5 && x >= 13 && x <= 15 && y >= 2 && y <= 4) { set(x, y, z, [1, 0.8, 0.35]); continue; }
    if (z < 6 && r < 1.6) { set(x, y, z, [0.22, 0.12, 0.06]); continue; }
    const tier = (z - 6) % 7, top = Math.floor((z - 6) / 7), rad = (7.5 - top * 1.8) * (1 - tier / 9);
    if (z >= 6 && r < rad) set(x, y, z, tier === 0 && r > rad - 1.4 ? [0.82, 0.86, 0.92] : [0.05, 0.20 + 0.03 * top, 0.11]);
  }
  return V;
}

export function plateOnion(m) {
  const P = newPlate('stack-03-onion', 3, 'Onion skin and sprite stacking', 'One read along two axes: time slices give ghosts, height slices give a solid.');
  const w = 320, h = 180, ground = { w, h, rgb: [0.02, 0.022, 0.035] };
  const seq = spriteSeq({ w, h, ...SPRITE, path: n => [22 + 22 * n, 96 - 30 * Math.sin(n * 0.5)] });
  const n = 6, O = onionFrame(seq, n, { ground, past: 3, future: 3 });
  const st = frame(w, h, [0.02, 0.022, 0.035]), V = pine();
  let S = st; [0, 0.6, 1.2, 1.9].forEach((th, i) => { S = spriteStack(V, S, { cx: 42 + i * 78, cy: 140, theta: th, scale: 1.9, rise: 2, shade: 0.45 }); });
  const [uw, uh] = units(w * 5, h * 5), gap = 1000 - 2 * M - 2 * uw, y0 = 230;
  panel(P, 'a', O, M, y0, uw, uh, 'A  onion skin, frame 6: past warm, future cool', { scale: 5 });
  panel(P, 'b', S, M + uw + gap, y0, uw, uh, 'B  sprite stack: 26 slices, 2 px rise, 4 turns', { scale: 5 });
  const ty = y0 + uh + 90, errs = [-3, -2, -1, 1, 2, 3].map(j => { const c = ghostCentroid(seq, n, j, { ground }), [ex, ey] = [22 + 22 * (n + j), 96 - 30 * Math.sin((n + j) * 0.5)]; return { j, d: Math.hypot(c[0] - ex, c[1] - ey) }; });
  text(P, M, ty, 'GHOST CENTROID AGAINST ITS SOURCE FRAME  (px, this plate\'s path)', { color: INK.text, size: 12 });
  errs.forEach((e, i) => text(P, M + i * 145, ty + 26, `j ${e.j > 0 ? '+' : ''}${e.j}: ${f3(e.d)}`, { size: 12, color: e.d < 0.5 ? INK.signal : '#d9a35c' }));
  para(P, M, ty + 64, 1000 - 2 * M, 'Both panels are the same readStack call. In A the slices are frames n + j of one sprite, drawn as flat silhouettes under the base, opacity falling with distance. In B the slices are plane sections of a voxel volume at heights 0 to 25, each drawn 2 px above the one below and turned together, bottom first. Ghost colours, opacity falloff and the slice shading are authored conventions. All six ghost centroids land within 0.5 px of their source frames; what remains is the hard-edged sprite\'s rounding to whole pixels on this curved path. The plinth\'s red and amber faces and the lamp block show the turn.', { size: 14, lead: 22 });
  return writePlate(P, ty + 210);
}

export function plateStill(m) {
  const P = newPlate('stack-04-living-still', 4, 'Living still', 'Does a held frame whose grain re-rolls on twos read as alive, and does frozen grain read as still?');
  const W = 1640, H = 920, F = gable(W, H), src = livingStill(F, { hold: 2, N: 400, cell: 2, levels: 32, seed: 'plate', movers: rain(W, H, { hold: 2 }) });
  const f0 = src(0), f1 = src(1), f2b = src(2), [uw, uh] = units(W, H), gap = 1000 - 2 * M - 2 * uw, y0 = 230, y1 = y0 + uh + 90;
  const diff = (a, b, k) => { const D = { w: W, h: H, b: new Uint8ClampedArray(a.b.length) }; let c = 0; for (let i = 0; i < a.b.length; i++) { const d = Math.abs(a.b[i] - b.b[i]); D.b[i] = Math.min(255, d * k); if (d) c++; } return { D, c }; };
  const d1 = diff(f1, f0, 8), d2 = diff(f2b, f0, 8);
  panel(P, 'a', f0, M, y0, uw, uh, 'A  frame 0: the held gable, shot-noise grain, ordered dither, rain on the same holds');
  panel(P, 'b', f2b, M + uw + gap, y0, uw, uh, 'B  frame 2: grain, dither phase and rain re-rolled');
  panel(P, 'c', d1.D, M, y1, uw, uh, `C  |frame 1 - frame 0| x 8: ${d1.c} channel values differ (the hold)`);
  panel(P, 'd', d2.D, M + uw + gap, y1, uw, uh, `D  |frame 2 - frame 0| x 8: ${(d2.c / f0.b.length * 100).toFixed(1)}% of values differ`);
  const lens = existsSync('out/stack/clips/lens.json') ? JSON.parse(readFileSync('out/stack/clips/lens.json', 'utf8')).rows : [];
  const ty = y1 + uh + 100;
  text(P, M, ty, 'DECOMPOSE MOTION LENS ON THE RENDERED CLIPS  (H.264 crf 16, read at 160 px wide)', { color: INK.text, size: 12 });
  text(P, M, ty + 26, 'clip                      counter Hz   lens Hz   label     boil    mean flow', { size: 12, color: INK.faint });
  lens.forEach((r, i) => { const L = r.lens.cadence ? r.lens : null;
    text(P, M, ty + 48 + i * 20, `${r.name.padEnd(25)} ${f2(r.counterHz).padEnd(12)} ${L ? f2(L.cadence.unique_frame_rate_hz).padEnd(9) : 'error    '} ${L ? L.cadence.label.padEnd(9) : ''} ${L ? String(L.boil.present).padEnd(7) : ''} ${L ? L.flow.mean_speed.toFixed(4) : ''}`, { size: 12, color: INK.muted }); });
  const py = ty + 48 + Math.max(1, lens.length) * 20 + 24;
  para(P, M, py, 1000 - 2 * M, 'Grain is photon shot noise: a cell expecting s x N photons draws a Poisson count, so its variance is s / N (here N = 400 at full signal, measured slope x N = ' + f3(m.grain.slopeTimesN) + '; flat Gaussian control ' + f3(m.grain.controlSlopeTimesN) + '). Grain is drawn in linear light, then display-encoded and dithered to 32 levels with a Bayer 4x4 matrix whose phase re-rolls with the grain. Cell size, dither and level count are authored. The lens reads at 160 px wide, so at 4K it averages 24 x 24 pixels; the re-rolled grain and dither still shift enough codes to register. On threes the lens reads still: its 5-frame activity window drops isolated changes, a lens defect, while the module counter reads 10 Hz.', { size: 14, lead: 22 });
  return writePlate(P, py + 150);
}
