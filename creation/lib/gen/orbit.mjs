// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// orbit: the orbit field and the aperture motif (the 2026-10-26 batches: ellipses at tilts around a nucleus, dotted
// concentric rings with crosshairs; Kandinsky's circles on a dark field). From first principles:
//   orbit i    a circle of radius a_i inclined by i_i and turned by tilt t_i, projected: an ellipse with semi-axes
//              a_i and a_i cos(i_i); drawn as a hairline of `line` cells
//   body i     sits at phase phi_i(t) on its orbit; each orbit's phase is its own timing: phi = 2 pi (p_i(t) + offset),
//              where p_i is a timing layer's progress if one is given, else uniform motion at its Kepler rate
//              (period proportional to a^1.5)
//   phase      each body is a sphere lit by one light; al-Biruni's moon phases: the lit share seen is
//              (1 + cos alpha) / 2, alpha the angle at the body between light and viewer; the terminator is drawn
//              as an ellipse across the disc (geometry is the light change)
//   rings      dotted concentric rings and a crosshair, as dots every `dot` cells
// amount = ink of lines, rings and the dark sides of bodies; rgb = body colours (lit side) for the cover law.
// quantizeAngles(points, w): the angle-quantisation law (the Kibernetyk Mono rule, used as a rule only): each
// segment's direction moves toward the nearest multiple of 45 degrees by weight w (0 free, 1 snapped).
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, hexLin, smooth } from '../core/layer.mjs';

export function quantizeAngles(pts, w) {
  if (!w) return pts; const out = [pts[0].slice()];
  for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], L = Math.hypot(dx, dy), a = Math.atan2(dy, dx), q = Math.round(a / (Math.PI / 4)) * Math.PI / 4, b = a + w * (q - a); out.push([out[i - 1][0] + L * Math.cos(b), out[i - 1][1] + L * Math.sin(b)]); }
  return out;
}

const PAL = ['#e08000', '#0050a0', '#d03010', '#a0c0c0', '#cc8490', '#306048'].map(hexLin);   // the Kandinsky card's hues (the save's card, read as hex)

export const orbit = defineGen({
  id: 'orbit',
  kind: 'conformational',
  law: { shape: 'cover', params: { lines: 'hairline ink', bodies: 'lit spheres with a phase terminator' } },
  weights: { orbits: 'how many', line: 'line width, cells', bodyR: 'body radius, cells', light: 'light direction, degrees', rings: 'dotted rings', dot: 'dot spacing, cells', kepler: 'period exponent (1.5 is Kepler)' },
  inputs: { timing: 'optional: each orbit takes the timing layer\'s progress, offset by its index' },
  mechanism: 'ellipse (a cos th, a cos(i) sin th) turned by tilt; body at phi(t); lit share (1 + cos alpha) / 2; terminator x = r cos(alpha) on the body disc',
  credits: ['al-Biruni (moon phases from one light and one sphere)', 'Kepler 1619 (period and orbit size, third law)', 'Kandinsky, Vertiefte Regung 1928 (circles on a dark field; composition only, via Meditations in Color)', 'the aperture and luminous-orb motif (design canon)'],
  create({ w = 160, h = 100, orbits = 5, line = 0.7, bodyR = 3.2, light = 210, rings = 4, dot = 3, kepler = 1.5, seed = 3, lineInk = [0.16, 0.15, 0.17] } = {}) {
    const O = Array.from({ length: orbits }, (_, i) => ({ a: Math.min(w, h) * (0.12 + 0.075 * i), inc: 0.25 + 0.55 * ((i * 0.37 + seed * 0.1) % 1), tilt: (i * 41 + seed * 17) % 180 * Math.PI / 180, off: (i * 0.29) % 1, col: PAL[i % PAL.length] }));
    return makeLayer('orbit', { w, h, law: { shape: 'cover', params: {} }, weights: { orbits, line, bodyR, light, rings, dot, kepler, lineInk }, fields: { rgb: F32(3 * w * h) }, state: { O } });
  },
  step(L, dt, ctx) {
    const { w, h } = L, W = L.weights, A = L.fields.amount, C = L.fields.rgb, cx = w / 2, cy = h / 2, ink = W.lineInk ?? [0.16, 0.15, 0.17]; A.fill(0);
    // a mark of radius `line` cells (antialiased), so the same law draws a hairline at 128 px and a pen line at 4K
    const rad = Math.max(0.5, W.line), plot = (x, y, v, col, rr = rad) => { for (let j = Math.floor(y - rr); j <= Math.ceil(y + rr); j++) for (let i = Math.floor(x - rr); i <= Math.ceil(x + rr); i++) { if (i < 0 || j < 0 || i >= w || j >= h) continue; const d = Math.hypot(i + 0.5 - x, j + 0.5 - y), a = v * Math.max(0, Math.min(1, rr + 0.5 - d)); const k = j * w + i; if (a > A[k]) { A[k] = a; C[3 * k] = col[0]; C[3 * k + 1] = col[1]; C[3 * k + 2] = col[2]; } } };
    for (let r = 1; r <= W.rings; r++) { const R = Math.min(w, h) * 0.08 * r, n = Math.floor(2 * Math.PI * R / W.dot); for (let q = 0; q < n; q++) plot(cx + R * Math.cos(q / n * 6.283), cy + R * Math.sin(q / n * 6.283), 0.7, ink); }
    for (let x = -Math.min(w, h) * 0.45; x <= Math.min(w, h) * 0.45; x += W.dot) { plot(cx + x, cy, 0.7, ink); plot(cx, cy + x, 0.7, ink); }
    const Ls = W.light * Math.PI / 180, lx = Math.cos(Ls), ly = Math.sin(Ls);
    for (const [i, o] of L.state.O.entries()) {
      const ct = Math.cos(o.tilt), st = Math.sin(o.tilt), P = th => { const x = o.a * Math.cos(th), y = o.a * Math.cos(o.inc) * Math.sin(th); return [cx + x * ct - y * st, cy + x * st + y * ct]; };
      const nq = Math.max(720, Math.ceil(2 * Math.PI * o.a / (rad * 0.8))); for (let q = 0; q < nq; q++) { const [x, y] = P(q / nq * 6.283); plot(x, y, 0.8, ink); }
      const p = ctx.timing?.state ? (ctx.timing.state.progress * (1 + i * 0.35)) : L.t / (4 * (o.a / (Math.min(w, h) * 0.12)) ** W.kepler), [bx, by] = P(6.283 * (p + o.off));
      // the body: a sphere lit from the light direction, seen from the viewer; lit share by the terminator
      const vx = bx - cx, vy = by - cy, vl = Math.hypot(vx, vy) || 1, alpha = Math.acos(clamp(-(vx * lx + vy * ly) / vl, -1, 1)), R = W.bodyR * (1 + 0.3 * Math.sin(6.283 * (p + o.off)));
      for (let y = Math.floor(by - R - 1); y <= by + R + 1; y++) for (let x = Math.floor(bx - R - 1); x <= bx + R + 1; x++) {
        const dx = (x + 0.5 - bx) / R, dy = (y + 0.5 - by) / R, d2 = dx * dx + dy * dy; if (d2 > 1) continue;
        const along = dx * lx + dy * ly, across = -dx * ly + dy * lx, term = Math.cos(alpha) * Math.sqrt(Math.max(0, 1 - across * across)), lit = along > -term ? 1 : 0.18;
        plot(x + 0.5, y + 0.5, smooth(1, 0.8, d2), o.col.map(c => c * lit), 0.5);
      }
    }
  },
});
