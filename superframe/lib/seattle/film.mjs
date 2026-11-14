// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// film.mjs: turn a scene (create, step, render) into pixel-art frames, loops, sheets and files.
//
// A loop has to close. The world in each scene is periodic in the loop length, but the rain on the glass, the
// floaters and the drifting snow are simulations with memory, and their state at the end differs from the start.
// The seam is a dither dissolve in index space: the first `fade` frames of the loop blend, pixel by pixel through a
// Bayer threshold, from the frames that would follow the last one to the true first frames. No new colour appears,
// and the cut reads as a fizz in the rain rather than a jump. Videos do not loop and need no seam.
//
//   shoot(scene, { frames, fps, fade, exposure })  -> { w, h, index: [Uint8Array], palette: [[r,g,b]], de }
//   sheet(film, picks, cols)                       -> { w, h, rgba } a contact sheet of chosen frames
import { tone, pairTable, dither, measureDE } from './pixq.mjs';
import { bayer } from '../quantize/dither.mjs';

export function shoot(scene, { frames, fps = 12, fade = 0, every = 1, onFrame = null }) {
  const S = scene.create(), dt = 1 / fps, P = scene.palette(), table = pairTable(P.cb), M = bayer(8), out = [];
  let de = null;
  const total = frames + fade;
  for (let k = 0; k < total; k++) {
    scene.step(S, dt);
    if (k % every) continue;
    const F = scene.render(S), lin = tone(F, { exposure: scene.exposure(S) }), q = dither(lin, F.w, F.h, P.cb, table);
    if (k === Math.floor(frames / 2)) de = measureDE(lin, q.rgba, F.w, F.h, 60);
    out.push(q.index);
    if (onFrame) onFrame(k, total);
  }
  if (fade) for (let k = 0; k < fade; k++) {
    const a = out[frames + k], b = out[k], w = (k + 1) / (fade + 1), W = scene.W;
    for (let i = 0; i < b.length; i++) if (M[((i / W) | 0) % 8][i % W % 8] > w) b[i] = a[i];
  }
  return { w: scene.W, h: scene.H, fps, index: out.slice(0, frames), palette: P.cb.code.map(c => [c[0], c[1], c[2]]), hexes: P.hexes, de };
}

export function rgbaOf(film, k) {
  const idx = film.index[k], o = new Uint8ClampedArray(idx.length * 4);
  for (let i = 0; i < idx.length; i++) { const c = film.palette[idx[i]]; o[4 * i] = c[0]; o[4 * i + 1] = c[1]; o[4 * i + 2] = c[2]; o[4 * i + 3] = 255; }
  return o;
}

export function upscaleRGBA(rgba, w, h, k) {
  const W = w * k, o = new Uint8ClampedArray(W * h * k * 4);
  for (let y = 0; y < h * k; y++) for (let x = 0; x < W; x++) { const s = 4 * (((y / k) | 0) * w + ((x / k) | 0)), d = 4 * (y * W + x); o[d] = rgba[s]; o[d + 1] = rgba[s + 1]; o[d + 2] = rgba[s + 2]; o[d + 3] = 255; }
  return o;
}

export function sheet(film, picks, cols = 3, gap = 2) {
  const rows = Math.ceil(picks.length / cols), w = cols * film.w + (cols - 1) * gap, h = rows * film.h + (rows - 1) * gap, o = new Uint8ClampedArray(w * h * 4).fill(255);
  picks.forEach((k, n) => {
    const src = rgbaOf(film, k), ox = (n % cols) * (film.w + gap), oy = ((n / cols) | 0) * (film.h + gap);
    for (let y = 0; y < film.h; y++) o.set(src.subarray(4 * y * film.w, 4 * (y + 1) * film.w), 4 * ((oy + y) * w + ox));
  });
  return { w, h, rgba: o };
}
