// plates.mjs: the demo plates as op lists for lib/study/render.mjs (imported, unedited), on the study kit's page.
// Each plate is 1000 units wide and renders at 3840 px or more.
import { INK, PAGE, masthead, methodBlock, label, pct, num } from '../study/kit.mjs';
import { curve, D_W, xAt } from './tone.mjs';
import { WHITE_Y } from './measure.mjs';

const { margin: M, w: W } = PAGE;
export const SIGNAL = '#62d3e3', WARN = '#e3735e';
const stat = (ops, x, y, big, small, color = INK.text) => { ops.push({ op: 'text', x, y, text: big, size: 34, style: 'display', weight: 600, color }); label(ops, x, y + 24, small, { color: INK.muted, size: 10 }); };

// a mask view: the picture dimmed to a third, pixels above 0.95 painted by their label (specular cyan, diffuse red)
export function maskImage(disp, labels) {
  const rgba = new Uint8ClampedArray(disp.rgba.length), sig = [98, 211, 227], warn = [227, 115, 94];
  for (let i = 0; i < disp.w * disp.h; i++) {
    const p = 4 * i, r = disp.rgba[p], g = disp.rgba[p + 1], b = disp.rgba[p + 2], lin = v => (v / 255) ** 2.2, Y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const c = Y > WHITE_Y ? (labels[i] ? sig : warn) : [r / 3, g / 3, b / 3];
    rgba[p] = c[0]; rgba[p + 1] = c[1]; rgba[p + 2] = c[2]; rgba[p + 3] = 255;
  }
  return { w: disp.w, h: disp.h, rgba };
}
// dilate the coloured mask so single-pixel highlights stay visible at plate scale
export function dilate(img, rad = 2) {
  const o = Uint8ClampedArray.from(img.rgba), { w, h } = img, hot = p => img.rgba[p] === 98 || img.rgba[p] === 227;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = 4 * (y * w + x); if (!hot(p)) continue;
    for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) { const X = x + i, Y = y + j; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const q = 4 * (Y * w + X); if (!hot(q)) for (let c = 0; c < 3; c++) o[q + c] = img.rgba[p + c]; }
  }
  return { w, h, rgba: o };
}

function curveGraph(ops, x0, y0, gw, gh, xc) {
  const X = x => x0 + x / 4 * gw, Y = y => y0 + gh - y * gh;
  ops.push({ op: 'rect', x: x0, y: y0, w: gw, h: gh, fill: INK.panel });
  [0.25, 0.5, 0.75, 1].forEach(v => ops.push({ op: 'rect', x: x0, y: Y(v) - 0.4, w: gw, h: 0.8, fill: INK.rule }));
  ops.push({ op: 'line', pts: [[X(0), Y(WHITE_Y)], [X(4), Y(WHITE_Y)]], width: 0.8, color: INK.faint });
  ops.push({ op: 'line', pts: [[X(1), Y(0)], [X(1), Y(1)]], width: 0.8, color: INK.faint });
  const pts = Array.from({ length: 161 }, (_, k) => [X(k / 40), Y(curve(k / 40))]);
  ops.push({ op: 'line', pts, width: 2.2, color: SIGNAL });
  ops.push({ op: 'line', pts: [[X(0), Y(0)], [X(xc), Y(1)], [X(4), Y(1)]], width: 1.4, color: WARN });
  label(ops, X(1) + 6, Y(0) - 8, 'x = 1: DIFFUSE CEILING', { color: INK.muted, size: 10 });
  ops.push({ op: 'circle', cx: X(xAt(0.95)), cy: Y(WHITE_Y), r: 2.2, fill: SIGNAL });
  label(ops, X(xAt(0.95)) + 8, Y(WHITE_Y) + 18, `BUDGET REACHES 0.95 AT x = ${num(xAt(0.95), 4)}`, { color: SIGNAL, size: 10 });
  label(ops, X(xc) + 10, Y(0.55), `CLAMP REACHES 1.0 AT x = ${num(xc, 3)}`, { color: WARN, size: 10 });
  label(ops, x0, y0 + gh + 18, 'RADIANCE / CEILING, 0 TO 4', { color: INK.faint, size: 10 });
  label(ops, x0, y0 - 8, `DISPLAY LUMINANCE. BUDGET (CYAN): d_w = ${D_W}, SHOULDER ABOVE 1. CLAMP (RED): GAIN SET BY THE BRIGHTEST DIFFUSE PIXEL, CLIPPED`, { color: INK.faint, size: 10 });
}

export function budgetPlate(V, ctx) {
  const ops = [], half = (W - 2 * M - 20) / 2, ih = half * V.img.h / V.img.w;
  let y = masthead(ops, { ...ctx, title: 'Value budget, white on white', question: 'Is pure white spent only where the physics allows it: on speculars', subject: ctx.subject });
  ops.push({ op: 'image', x: M, y, w: half, h: ih, src: 'budget' }, { op: 'image', x: M + half + 20, y, w: half, h: ih, src: 'clamp' });
  label(ops, M, y + ih + 22, 'VALUE BUDGET: DIFFUSE CEILING AT 0.80, SHOULDER TO WHITE'); label(ops, M + half + 20, y + ih + 22, 'CONTROL: BRIGHTEST DIFFUSE PIXEL EXPOSED TO 1.0, CLIPPED');
  y += ih + 44;
  ops.push({ op: 'image', x: M, y, w: half, h: ih, src: 'mbudget' }, { op: 'image', x: M + half + 20, y, w: half, h: ih, src: 'mclamp' });
  label(ops, M, y + ih + 22, 'PIXELS ABOVE 0.95: CYAN SPECULAR-ORIGIN, RED DIFFUSE-ORIGIN (DILATED 2 PX TO BE SEEN)');
  y += ih + 70;
  const q = (W - 2 * M) / 4;
  stat(ops, M, y, V.P1.share === null ? 'n/a' : pct(V.P1.share), `SPECULAR: ${V.P1.spec} OF ${V.P1.bright} ABOVE 0.95`, SIGNAL);
  stat(ops, M + q, y, pct(V.P1.frac, 3), 'OF FRAME ABOVE 0.95 (FLOOR 0.050%)', V.P1.frac >= V.minBright ? INK.text : WARN);
  stat(ops, M + 2 * q, y, V.P1c.share === null ? 'n/a' : pct(V.P1c.share), `CONTROL: ${V.P1c.spec} OF ${V.P1c.bright} SPECULAR`, WARN);
  stat(ops, M + 3 * q, y, V.P1s.share === null ? 'n/a' : pct(V.P1s.share), 'SHUFFLED LABELS', INK.muted);
  y += 80; curveGraph(ops, M, y + 20, W - 2 * M, 230, V.difOverC); y += 290;
  const h = methodBlock(ops, y, `Ray traced: ground plane and four spheres (white under a dielectric coat with GGX lobes of roughness 0.06, 0.12 and 0.30; clear glass n = 1.5) under one spherical key of angular radius ${num(V.scene.light.r / 12 * 180 / Math.PI, 2)} degrees and a uniform surround. Caustics from ${ctx.photons} photons per glass sphere. Each pixel's radiance is split by the first interaction after the light; a pixel is specular when that share is at least half. Ceiling C = (largest key irradiance on a matte point + pi x largest surround radiance) / pi = ${num(V.scene.C, 4)}; the brightest diffuse pixel sits at ${num(V.difOverC, 3)} C.`, [`Luminance is CIE Y of the decoded 8-bit sRGB. Render ${V.img.w} x ${V.img.h}, ${ctx.ss} x ${ctx.ss} samples per pixel.`]);
  return { id: 'value-budget', title: 'Value budget', w: W, h, ground: INK.ground, ops };
}

function histBars(ops, x0, y0, bw, bh, hist, color) {
  const mx = Math.max(...hist, 1e-9);
  ops.push({ op: 'rect', x: x0, y: y0, w: bw, h: bh, fill: INK.panel });
  hist.forEach((v, k) => { const hh = v / mx * (bh - 6); if (hh > 0.2) ops.push({ op: 'rect', x: x0 + k / 101 * bw, y: y0 + bh - hh, w: bw / 101 * 0.8, h: hh, fill: color }); });
  ops.push({ op: 'rect', x: x0 + 25 / 101 * bw - 0.5, y: y0, w: 1, h: bh, fill: WARN });
  label(ops, x0, y0 + bh + 16, 'CIE L* 0 TO 100; RED RULE AT L* 25', { color: INK.faint, size: 10 });
}

export function darkPlate(D, ctx) {
  const ops = [], half = (W - 2 * M - 20) / 2, ih = half * D.disp.h / D.disp.w;
  let y = masthead(ops, { ...ctx, title: 'Dark field, one source', question: 'Does the falloff of one motivated light do the drawing', subject: ctx.subject });
  ops.push({ op: 'image', x: M, y, w: half, h: ih, src: 'dark' }, { op: 'image', x: M + half + 20, y, w: half, h: ih, src: 'flat' });
  label(ops, M, y + ih + 22, 'ONE LANTERN, SURROUND 0.0015'); label(ops, M + half + 20, y + ih + 22, 'CONTROL: NO KEY, UNIFORM SURROUND OF EQUAL MEAN IRRADIANCE');
  y += ih + 44;
  histBars(ops, M, y, half, 120, D.P2.hist, SIGNAL); histBars(ops, M + half + 20, y, half, 120, D.P2c.hist, INK.muted);
  y += 190;
  stat(ops, M, y, pct(D.P2.dark), 'OF PIXELS BELOW L* 25', SIGNAL);
  stat(ops, M + 220, y, pct(D.P2.white, 2), `ABOVE 0.95, ${D.P2.check.share === null ? 'n/a' : pct(D.P2.check.share)} SPECULAR`);
  stat(ops, M + half + 20, y, pct(D.P2c.dark), 'CONTROL: BELOW L* 25', WARN);
  stat(ops, M + half + 240, y, pct(D.P2c.white, 2), 'CONTROL: ABOVE 0.95', INK.muted);
  y += 90;
  const h = methodBlock(ops, y, `The same four objects on grey stone (albedo 0.30, white spheres 0.60) with one small key (radius ${num(D.scene.light.r, 2)}, warm tint) ${num(D.scene.light.p[1], 2)} units above the ground. Inverse-square falloff and the near-black surround leave most of the frame dark. The tone curve and its ceiling are the same rule as the white plate: C = ${num(D.scene.C, 4)} here, ${num(D.flat.C, 4)} for the control.`, ['The warm tint is a display convention for the lantern: it is normalised to luminance 1 and multiplies every channel, so every luminance share is the untinted one.']);
  return { id: 'value-dark', title: 'Dark field', w: W, h, ground: INK.ground, ops };
}
