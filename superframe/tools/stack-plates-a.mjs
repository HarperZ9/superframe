// stack-plates-a.mjs: plate 1 (the shutter integral against the post-blur shortcut) and plate 2 (the frame-offset
// echo and its recovery). Numbers come from out/stack/measures.json (tools/stack-measure.mjs).
import { expose, postBlur, midFrame } from '../lib/stack/shutter.mjs';
import { imageSpeed } from '../lib/stack/scene.mjs';
import { spriteSeq, echoFrame, baseFrame } from '../lib/stack/echo.mjs';
import { frame } from '../lib/stack/frame.mjs';
import { ROWS, PAL, PLANTED } from '../lib/stack/plant.mjs';
import { panScene } from './stack-scenes.mjs';
import { newPlate, panel, units, text, para, bars, writePlate, hex, INK, M } from './stack-plate-kit.mjs';

const f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);

export function plateShutter(m) {
  const P = newPlate('stack-01-shutter', 1, 'Shutter integral', 'Does the streak equal image velocity times shutter, and does a strobe stay sharp inside it?');
  const W = 1640, H = 920, T = 1 / 30, sc = panScene(W, H, T), [uw, uh] = units(W, H), gap = 1000 - 2 * M - 2 * uw;
  const fast = sc.items.find(it => it.vx > sc.cam.vx + 1), L = imageSpeed(fast, sc.cam) * T;
  const A = expose(sc, 0, T, { step: 0.25 }), mid = midFrame(sc, 0, T), B = postBlur(mid, L, 1, 0, { step: 0.5 });
  const y0 = 230, y1 = y0 + uh + 90;
  panel(P, 'a', A, M, y0, uw, uh, `A  shutter integral, 1/30 s. Camera tracks the runner; posts streak ${f2(sc.cam.vx * T)} px; the cube ${f2(L)} px`);
  panel(P, 'b', B, M + uw + gap, y0, uw, uh, `B  control: mid-shutter frame (C) smeared ${f2(L)} px along x afterwards`);
  panel(P, 'c', mid, M, y1, uw, uh, 'C  the sharp mid-shutter frame, strobe drawn lit');
  const tx = M + uw + gap, ty = y1 + 8;
  text(P, tx, ty, 'PLANTED STREAKS  (bar 4 px wide, 1/30 s)', { color: INK.text, size: 12 });
  text(P, tx, ty + 28, 'L px      FWHM     moments   moments 16x', { size: 12, color: INK.faint });
  m.shutter.forEach((r, i) => text(P, tx, ty + 50 + i * 20, `${String(r.planted).padEnd(9)} ${f2(r.fwhm).padEnd(8)} ${f3(r.moments).padEnd(9)} ${f3(r.moments16)}`, { size: 12 }));
  const fy = ty + 50 + m.shutter.length * 20 + 26;
  text(P, tx, fy, 'STROBE ON A 64 PX STREAK  (growth over the marker, px)', { color: INK.text, size: 12 });
  text(P, tx, fy + 28, 'share     expected  integral 16x   post-blur', { size: 12, color: INK.faint });
  m.flash.forEach((r, i) => text(P, tx, fy + 50 + i * 20, `${(r.fraction * 100).toFixed(1).padEnd(4)}%     ${f3(r.expected).padEnd(9)} ${f3(r.integral16).padEnd(14)} ${f2(r.postBlur)}`, { size: 12, color: r.fraction < 0.01 ? INK.signal : INK.muted }));
  const ny = Math.max(y1 + uh + 90, fy + 50 + m.flash.length * 20 + 40);
  para(P, M, ny, 1000 - 2 * M, 'Exposure is the time integral of irradiance over the open shutter. A is the mean of time slices spaced so the fastest item moves 0.25 px between them, and each strobe is integrated over its own window. The strobe on the blue cube lasts 0.5% of the shutter, so it lands as a sharp square inside the cube\'s streak. B blurs the finished frame: it cannot know which light arrived when, so the strobe smears the full length, and the tracked runner smears with it. FWHM reads max(L, bar width), so it fails below 4 px; the second moment, L = sqrt(12 x added variance), holds to 2% from 4 px at 1x and to 0.1% from 0.5 px on a 16x finer grid.', { size: 14, lead: 22 });
  return writePlate(P, ny + 150);
}

const big = rows => rows.flatMap(r => { const d = r.flatMap(v => [v, v]); return [d, d]; });
export const SPRITE = { rows: big(ROWS), palette: PAL };

export function plateEcho(m) {
  const P = newPlate('stack-02-echo', 2, 'Frame-offset echo', 'Can the tint and the delay be read back out of the finished 8-bit frames?');
  const w = 320, h = 180, ground = { w, h, rgb: [0.02, 0.022, 0.035] };
  const seq = spriteSeq({ w, h, ...SPRITE, path: n => [160 + 120 * Math.sin(n * 0.11), 90 + 55 * Math.sin(n * 0.17 + 1)] });
  const copies = PLANTED.map(([k, tint]) => ({ k, tint, opacity: 0.8 })), n = 22;
  const O = echoFrame(seq, n, { ground, copies }), Bf = baseFrame(seq, n, ground), R = frame(w, h);
  for (let i = 0; i < R.px.length; i++) R.px[i] = Math.abs(O.px[i] - Bf.px[i]);
  const [uw, uh] = units(w * 5, h * 5), gap = 1000 - 2 * M - 2 * uw, y0 = 230;
  panel(P, 'a', O, M, y0, uw, uh, 'A  copies at k = 3, 5, 8 under the base', { scale: 5 });
  panel(P, 'b', R, M + uw + gap, y0, uw, uh, 'B  output minus the base-only render', { scale: 5 });
  const cy = y0 + uh + 110, cw = 400, ch = 120;
  const lagsClean = m.echo.lagClean, lagsJit = m.echo.lagJitter, labels = lagsClean.map((_, i) => i);
  bars(P, M, cy, cw, ch, lagsClean, { labels, hi: 5, title: 'Lag correlation, planted k = 5 (peak ' + f3(Math.max(...lagsClean)) + ')' });
  bars(P, M + cw + 80, cy, cw, ch, lagsJit, { labels, hi: lagsJit.indexOf(Math.max(...lagsJit)), hiColor: '#d9a35c', title: 'Control: delays jittered by up to 2 frames (peak ' + f3(Math.max(...lagsJit)) + ')' });
  const sy = cy + ch + 70;
  text(P, M, sy, 'TINT RECOVERED FROM 8-BIT FRAMES  (least squares on the delayed base, 40 frames)', { color: INK.text, size: 12 });
  m.echo.rows.forEach((r, i) => {
    const x = M + i * 293;
    P.ops.push({ op: 'rect', x, y: sy + 18, w: 60, h: 40, fill: hex(r.tint) }, { op: 'rect', x: x + 64, y: sy + 18, w: 60, h: 40, fill: hex(r.recovered) });
    text(P, x, sy + 80, `k = ${r.k}  peak lag ${r.peakLag}`, { size: 12, color: INK.text });
    text(P, x, sy + 100, `error ${f3(r.err255)}/255`, { size: 12, color: INK.signal });
    text(P, x, sy + 120, `jittered ${f2(r.jitterErr255)}/255`, { size: 12, color: '#d9a35c' });
  });
  text(P, M, sy + 150, `k = 0 control: the base covers its own echo, support ${m.echo.k0.support}, tint unrecoverable`, { size: 12 });
  para(P, M, sy + 190, 1000 - 2 * M, 'Left swatch: planted tint. Right swatch: recovered. The echo colour is tint x luma of the delayed frame, composited under the base with Porter-Duff over. Subtracting the base-only render leaves (1 - alpha_now) x opacity x alpha_then x (tint x luma_then - ground), which is linear in the tint, so least squares gives it back. The error left is 8-bit rounding: a four-colour sprite gives only four residual levels, so rounding errors do not average away. Tints and opacity are authored; the compositing law is exact.', { size: 14, lead: 22 });
  return writePlate(P, sy + 320);
}
