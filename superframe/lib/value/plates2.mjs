// plates2.mjs: the gold plate and the illuminant-swap metamer plate.
import { INK, PAGE, masthead, methodBlock, label, pct, num, swatchRect } from '../study/kit.mjs';
import { enc, rgb8ToLab, dE76 } from '../study/cmath.mjs';
import { LAMBDA } from '../medium/spectral.mjs';
import { isYellow } from './goldmeasure.mjs';
import { shown } from './metamer.mjs';
import { SIGNAL, WARN } from './plates.mjs';

const { margin: M, w: W } = PAGE;

function strip(ops, x, y, w, h, swatches) {
  let a = 0;
  for (const s of swatches) { const sw = s.share * w; swatchRect(ops, x + a, y, Math.max(0.4, sw), h, s.hex); if (isYellow(s)) ops.push({ op: 'rect', x: x + a, y: y + h + 3, w: Math.max(0.4, sw), h: 3, fill: SIGNAL }); a += sw; }
}

function fresnelGraph(ops, F, x0, y0, gw, gh) {
  const X = l => x0 + (l - 400) / 300 * gw, Y = v => y0 + gh - v * gh;
  ops.push({ op: 'rect', x: x0, y: y0, w: gw, h: gh, fill: INK.panel });
  [0.25, 0.5, 0.75, 1].forEach(v => ops.push({ op: 'rect', x: x0, y: Y(v) - 0.4, w: gw, h: 0.8, fill: INK.rule }));
  ops.push({ op: 'line', pts: F.normal.map((v, i) => [X(LAMBDA[i]), Y(v)]), width: 2.2, color: '#e0b040' });
  ops.push({ op: 'line', pts: F.grazing.map((v, i) => [X(LAMBDA[i]), Y(v)]), width: 1.4, color: INK.text });
  ops.push({ op: 'line', pts: [[X(400), Y(F.dielectric)], [X(700), Y(F.dielectric)]], width: 1.4, color: WARN });
  label(ops, x0, y0 - 8, 'REFLECTANCE 0 TO 1, 400 TO 700 NM. GOLD AT NORMAL INCIDENCE (GOLD), AT 89.5 DEG (WHITE), GLASS n = 1.5 (RED)', { color: INK.faint, size: 10 });
}

export function goldPlate(G, F, ctx, envs) {
  const ops = [], gap = 16, cw = (W - 2 * M - 3 * gap) / 4;
  let y = masthead(ops, { ...ctx, title: 'Gold is a tinted mirror', question: 'Most of gold is not yellow, and its hue follows the room', subject: ctx.subject });
  envs.forEach((env, k) => {
    const x = M + k * (cw + gap), g = G.R[`${env}/gold`], d = G.R[`${env}/yellow`];
    ops.push({ op: 'image', x, y, w: cw, h: cw, src: `gold-${env}` });
    label(ops, x, y + cw + 20, `${env.toUpperCase()}: GOLD`, { color: INK.text });
    strip(ops, x, y + cw + 32, cw, 22, g.yellow.swatches);
    label(ops, x, y + cw + 80, `YELLOW ${pct(g.yellow.share)} OF AREA`, { color: g.yellow.share < 0.5 ? SIGNAL : WARN });
    label(ops, x, y + cw + 98, `MEAN HUE ${num(g.hue, 1)} DEG`, { color: INK.muted });
    const y2 = y + cw + 130;
    ops.push({ op: 'image', x, y: y2, w: cw, h: cw, src: `yellow-${env}` });
    label(ops, x, y2 + cw + 20, `${env.toUpperCase()}: DIFFUSE YELLOW`, { color: INK.text });
    strip(ops, x, y2 + cw + 32, cw, 22, d.yellow.swatches);
    label(ops, x, y2 + cw + 80, `YELLOW ${pct(d.yellow.share)} OF AREA`, { color: d.yellow.share > 0.5 ? SIGNAL : WARN });
    label(ops, x, y2 + cw + 98, `MEAN HUE ${num(d.hue, 1)} DEG`, { color: INK.muted });
  });
  y += 2 * cw + 320;
  G.follow.forEach((f, k) => {
    const x = M + k * 440;
    ops.push({ op: 'text', x, y, text: `${num(f.gold.coefficient, 3)}  vs  ${num(f.yellow.coefficient, 3)}`, size: 30, style: 'display', weight: 600, color: f.gold.coefficient >= 0.5 ? SIGNAL : WARN });
    label(ops, x, y + 24, `HUE FOLLOW, ${f.a.toUpperCase()} TO ${f.b.toUpperCase()}: GOLD vs DIFFUSE YELLOW`);
    label(ops, x, y + 42, `ROOM HUE MOVES ${num(f.gold.dEnv, 1)} DEG; GOLD ${num(f.gold.dObj, 1)}, YELLOW ${num(f.yellow.dObj, 1)}`, { color: INK.faint });
  });
  y += 90; fresnelGraph(ops, F, M, y + 20, W - 2 * M, 200); y += 250;
  const h = methodBlock(ops, y, 'Gold has no diffuse term: each band is the exact conductor Fresnel reflectance from n + ik (Johnson and Christy 1972, recalled values) times the environment along the mirror ray, or the D65 key where the ray meets it. The control is Lambert with a yellow albedo under the same key and the same environment irradiance. Palettes are lib/study/palette.mjs (k = 10) on the sphere pixels; a cyan tick marks a yellow swatch (HSV hue 35 to 70, C*ab at least 20). Hue follow is the change in the mean CIELAB hue of the sphere over the change in the mean hue its mirror rays see.', [`Spheres ${ctx.goldSize} px, 2 x 2 samples, spectral in 16 bands, shown through the value-budget curve with C = (E_key + largest environment irradiance) / pi. The environment colours are authored.`]);
  return { id: 'value-gold', title: 'Gold', w: W, h, ground: INK.ground, ops };
}

// the figure-ground painting: ground in member b, a disc and a bar in member a, under one light
export function metamerImage(pair, illum, w = 640, h = 400) {
  const A = shown(pair.a, illum).map(v => Math.round(enc(v) * 255)), B = shown(pair.b, illum).map(v => Math.round(enc(v) * 255)), rgba = new Uint8ClampedArray(4 * w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fig = Math.hypot(x - w * 0.36, y - h * 0.5) < h * 0.27 || (x > w * 0.6 && x < w * 0.86 && Math.abs(y - h * 0.5) < h * 0.08), c = fig ? A : B, p = 4 * (y * w + x);
    rgba[p] = c[0]; rgba[p + 1] = c[1]; rgba[p + 2] = c[2]; rgba[p + 3] = 255;
  }
  return { img: { w, h, rgba }, dE8: dE76(rgb8ToLab(...A), rgb8ToLab(...B)), A, B };
}

function lineChart(ops, x0, y0, gw, gh, series, xr, yr, title) {
  const X = v => x0 + (v - xr[0]) / (xr[1] - xr[0]) * gw, Y = v => y0 + gh - (Math.min(yr[1], v) - yr[0]) / (yr[1] - yr[0]) * gh;
  ops.push({ op: 'rect', x: x0, y: y0, w: gw, h: gh, fill: INK.panel });
  for (const s of series) ops.push({ op: 'line', pts: s.pts.map(([a, b]) => [X(a), Y(b)]), width: s.width ?? 1.8, color: s.color });
  label(ops, x0, y0 - 8, title, { color: INK.faint, size: 10 });
  return { X, Y };
}

export function metamerPlate(Ms, ctx) {
  const ops = [], gap = 16, pw = (W - 2 * M - 2 * gap) / 3, ph = pw * 400 / 640, lights = [['D65', 'D65'], ['A', 'A, 2856 K'], ['candle', 'CANDLE, 1900 K']];
  let y = masthead(ops, { ...ctx, title: 'Two paints, one light', question: 'A figure painted to match its ground under daylight comes apart under lamplight', subject: ctx.subject });
  for (const m of Ms) {
    lights.forEach(([il, name], k) => {
      const x = M + k * (pw + gap), r = m.views[il];
      ops.push({ op: 'image', x, y, w: pw, h: ph, src: `meta-${m.hex.slice(1)}-${il}` });
      label(ops, x, y + ph + 20, `${name}: dE ${num(r.dE8, 2)} ON SCREEN`, { color: r.dE8 < 0.5 ? INK.muted : SIGNAL });
    });
    label(ops, M, y + ph + 40, `TARGET ${m.hex.toUpperCase()}: SPECTRAL dE76 ${num(m.d65, 3)} UNDER D65, ${num(m.A, 2)} UNDER A; RGB ENGINE RELIT TO A: ${num(m.rgbA, 3)}`, { color: INK.faint });
    y += ph + 76;
  }
  const half = (W - 2 * M - 20) / 2, cols = ['#62d3e3', '#e3735e'];
  lineChart(ops, M, y + 20, half, 180, Ms.flatMap((m, k) => [{ pts: m.a.map((v, i) => [LAMBDA[i], v]), color: cols[k] }, { pts: m.b.map((v, i) => [LAMBDA[i], v]), color: cols[k], width: 1 }]), [400, 700], [0, 1], 'REFLECTANCE OF EACH PAIR, 400 TO 700 NM (THICK: FIGURE, THIN: GROUND)');
  lineChart(ops, M + half + 20, y + 20, half, 180, Ms.map((m, k) => ({ pts: m.sweep.map(s => [s.K, s.dE]), color: cols[k] })), [1900, 10000], [0, 50], 'SPLIT dE76 UNDER BLACKBODY LIGHT, 1900 TO 10000 K (0 TO 50)');
  Ms.forEach((m, k) => { const lo = m.sweep.reduce((a, b) => (b.dE < a.dE ? b : a)); label(ops, M + half + 20, y + 222 + 16 * k, `${m.hex.toUpperCase()}: LEAST SPLIT dE ${num(lo.dE, 2)} AT ${lo.K.toFixed(0)} K${k ? '' : '. NO BLACKBODY KEEPS THE MATCH'}`, { color: cols[k], size: 10 }); });
  y += 270;
  const h = methodBlock(ops, y, 'Each pair is drawn from the metamer set of its target (lib/medium/metamers.mjs): 64 spectra by hit-and-run in the 13-dimensional polytope of reflectances that read the target XYZ under D65 for the CIE 1931 observer; the pair kept is the one that comes apart most under illuminant A. The viewer is adapted to each light (von Kries). On-screen dE is CIE76 between the two 8-bit colours as displayed. The RGB control multiplies each member\'s D65 RGB by the lamp\'s RGB, which is all a three-number engine can do.', ['The members are jagged spectra drawn uniformly from the polytope, not measured pigments, so the split is an upper end of what paint would show. The smoothest pair in each set that still splits by more than 4 under A is reported in results.json.']);
  return { id: 'value-metamer', title: 'Metamers', w: W, h, ground: INK.ground, ops };
}
