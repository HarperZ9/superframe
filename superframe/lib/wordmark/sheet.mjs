// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// sheet.mjs: inspection pictures for the wordmark directions: the 200% crop, nearest-neighbour enlargements of the
// icons, and the comparison sheet (the six stills side by side at 4K over a panel of every icon at 1x and enlarged).
// Labels are set in Accession through the name-art setter. Pictures are the linear lib/img shape { w, h, px }.
import { setName } from '../../../name-art/lib/name.mjs';
import { img, down } from '../../../name-art/lib/img.mjs';
import { oklch } from './palette.mjs';

export function crop(I, x0, y0, w, h) {
  const O = img(w, h);
  for (let y = 0; y < h; y++) O.px.set(I.px.subarray(((y0 + y) * I.w + x0) * 3, ((y0 + y) * I.w + x0 + w) * 3), y * w * 3);
  return O;
}
export function nearest(I, k) {
  const O = img(Math.round(I.w * k), Math.round(I.h * k));
  for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) { const s = (Math.min(I.h - 1, (y / k) | 0) * I.w + Math.min(I.w - 1, (x / k) | 0)) * 3; O.px.set(I.px.subarray(s, s + 3), (y * O.w + x) * 3); }
  return O;
}
// The 200% crop: a region of `w x h` output px centred at (cx, cy) share of the frame, enlarged 2x without filtering.
export function crop200(I, cx, cy, w = 1920, h = 1080) {
  const x0 = Math.max(0, Math.min(I.w - w / 2, Math.round(cx * I.w - w / 4))), y0 = Math.max(0, Math.min(I.h - h / 2, Math.round(cy * I.h - h / 4)));
  return { image: nearest(crop(I, x0, y0, w / 2, h / 2), 2), region: [x0, y0, w / 2, h / 2] };
}
export function paste(D, S, x, y) {
  for (let j = 0; j < S.h; j++) { const yy = y + j; if (yy < 0 || yy >= D.h) continue; for (let i = 0; i < S.w; i++) { const xx = x + i; if (xx < 0 || xx >= D.w) continue; D.px.set(S.px.subarray((j * S.w + i) * 3, (j * S.w + i) * 3 + 3), (yy * D.w + xx) * 3); } }
  return D;
}
export function label(D, text, x, y, hpx, colour, { weight = 600, width = null } = {}) {
  const w = width ?? Math.ceil(hpx * text.length * 0.75), h = Math.ceil(hpx * 1.6), N = setName(text, w, h, { box: [0, 0.18, 1, 0.82], style: 'text', weight, align: 'left' });
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const m = N.mask[j * w + i]; if (m <= 0) continue; const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= D.w || yy >= D.h) continue;
    for (let c = 0; c < 3; c++) D.px[(yy * D.w + xx) * 3 + c] += (colour[c] - D.px[(yy * D.w + xx) * 3 + c]) * m;
  }
  return D;
}
const fill = (I, c) => { for (let i = 0; i < I.w * I.h; i++) I.px.set(c, i * 3); return I; };
export const INK = { ground: oklch(0.2, 0.005, 270), plate: oklch(0.55, 0.004, 270), text: oklch(0.93, 0.01, 90), dim: oklch(0.7, 0.01, 90) };

// Six 3840 x 2160 stills in a 3 x 2 grid of 1280 x 720 cells (box-filtered 3:1), each numbered.
export function stillsPanel(stills, titles) {
  const S = fill(img(3840, 2160), INK.ground);
  stills.forEach((I, k) => { const x = (k % 3) * 1280, y = ((k / 3) | 0) * 1080; paste(S, down(I, 3), x, y + 40); label(S, titles[k], x + 24, y + 770, 30, INK.text, { width: 1200 }); });
  return S;
}

// One row per direction: square icons at 1x, the same enlarged to 128 px, strips at 1x, the 16 px strip at 4x.
export function iconsPanel(rows, titles) {
  const P = fill(img(3840, 2160), INK.ground);
  rows.forEach((r, k) => {
    const y = k * 360, base = y + 300;
    paste(P, fill(img(3790, 270), INK.plate), 25, y + 64);
    label(P, titles[k], 40, y + 8, 30, INK.text, { width: 1800 });
    let x = 620;
    for (const I of r.square) { paste(P, I, x, base - I.h); x += I.w + 28; }
    x = 940;
    for (const I of r.square) { const k2 = I.w >= 128 ? 1 : I.w >= 48 ? 2 : 128 / I.w; const E = nearest(I, k2); paste(P, E, x, base - E.h); x += E.w + 28; }
    x = 1530;
    for (const I of r.strip) { paste(P, I, x, base - I.h); x += I.w + 28; }
    const E = nearest(r.strip[0], 4); paste(P, E, x + 20, base - E.h);
  });
  return P;
}

export function stack(A, B) { const O = img(A.w, A.h + B.h); O.px.set(A.px, 0); O.px.set(B.px, A.px.length); return O; }
