// value-demo.mjs: runs every PREREG measurement of lib/value at plate resolution, writes the four plates (3840 px
// wide or more) and results.json to out/value/. Usage: node tools/value-demo.mjs [--width 3840] [--quick]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runValue, runDark, runCurve, runFresnel, runGold, runMetamer, grade, ENV_LIST } from '../lib/value/run.mjs';
import { budgetPlate, darkPlate, maskImage, dilate } from '../lib/value/plates.mjs';
import { goldPlate, metamerPlate, metamerImage } from '../lib/value/plates2.mjs';
import { renderPlate, pngOf } from '../lib/study/render.mjs';
import { sha256 } from '../lib/study/load.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(ROOT, 'out', 'value');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const quick = process.argv.includes('--quick'), width = arg('--width', 3840);
const pw = quick ? 480 : 1652, ph = Math.round(pw * 10 / 16), gs = quick ? 200 : 800, photons = quick ? 100000 : 1000000, ss = 2;
const subj = (name, img) => ({ file: name, sha256: sha256(Buffer.from(img.rgba.buffer)), w: img.w, h: img.h });
const time = (name, f) => { const t = Date.now(), r = f(); console.log(`${name}: ${((Date.now() - t) / 1000).toFixed(1)} s`); return r; };
const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (['img', 'disp', 'fdisp', 'budget', 'clamp', 'labels', 'mask', 'scene', 'flat', 'caustic', 'swatchesRaw', 'rgba'].includes(k) ? undefined : v)));

async function write(spec, file) {
  const R = renderPlate(spec, { width }), path = join(OUT, file);
  writeFileSync(path, await pngOf(R)); console.log(`${path}  ${R.w} x ${R.h}`);
  return { file, w: R.w, h: R.h };
}

mkdirSync(OUT, { recursive: true });
const V = time('white on white', () => runValue({ w: pw, h: ph, ss, photons }));
const D = time('dark field', () => runDark({ w: pw, h: ph, ss, photons }));
const Cv = runCurve(), F = runFresnel();
const G = time('gold', () => runGold({ w: gs, h: gs, ss }));
const Ms = time('metamers', () => runMetamer());
for (const m of Ms) m.views = Object.fromEntries(['D65', 'A', 'candle'].map(il => [il, metamerImage(m, il)]));
const rows = grade({ V, D, Cv, F, G, M: Ms });
const ctx = { criterion: 'value', of: 4, photons, ss, goldSize: gs };
const plates = [];
plates.push(await write({ ...budgetPlate(V, { ...ctx, n: 1, subject: subj('rendered: white on white', V.budget) }), images: { budget: V.budget, clamp: V.clamp, mbudget: dilate(maskImage(V.budget, V.labels)), mclamp: dilate(maskImage(V.clamp, V.labels)) } }, 'plate-1-value-budget.png'));
plates.push(await write({ ...darkPlate(D, { ...ctx, n: 2, subject: subj('rendered: dark field', D.disp) }), images: { dark: D.disp, flat: D.fdisp } }, 'plate-2-dark-field.png'));
const gimg = {}; for (const env of ENV_LIST) { gimg[`gold-${env}`] = G.R[`${env}/gold`].disp; gimg[`yellow-${env}`] = G.R[`${env}/yellow`].disp; }
plates.push(await write({ ...goldPlate(G, F, { ...ctx, n: 3, subject: subj('rendered: gold, four rooms', G.R['sky/gold'].disp) }, ENV_LIST), images: gimg }, 'plate-3-gold.png'));
const mimg = {}; for (const m of Ms) for (const il of ['D65', 'A', 'candle']) mimg[`meta-${m.hex.slice(1)}-${il}`] = m.views[il].img;
plates.push(await write({ ...metamerPlate(Ms, { ...ctx, n: 4, subject: subj('rendered: metamer pairs', Ms[0].views.D65.img) }), images: mimg }, 'plate-4-metamers.png'));

const results = {
  date: new Date().toISOString(), quick, render: { white: [pw, ph], gold: gs, ss, photons },
  graded: rows, P1: V.P1, P1c: V.P1c, P1s: V.P1s, P1n: V.P1n, ceiling: V.scene.C, difOverC: V.difOverC, clampGain: V.clamp.gain,
  P2: { ...D.P2, hist: undefined }, P2c: { ...D.P2c, hist: undefined }, curve: Cv, fresnel: F,
  gold: Object.fromEntries(Object.entries(G.R).map(([k, r]) => [k, { yellowShare: r.yellow.share, yellowCount: r.yellow.count, swatches: r.yellow.swatches.map(s => ({ hex: s.hex, share: s.share, hsv: s.hsv_hue, C: s.C })), hue: r.hue, seenHue: r.seen, C: r.C }])),
  follow: G.follow, metamers: Ms.map(m => ({ hex: m.hex, gentle: m.gentle, roughness: { a: m.a.reduce((s, v, i) => (i ? s + (v - m.a[i - 1]) ** 2 : 0), 0), target: m.target.reduce((s, v, i) => (i ? s + (v - m.target[i - 1]) ** 2 : 0), 0) }, d65: m.d65, A: m.A, candle: m.candle, rgbA: m.rgbA, onScreen: Object.fromEntries(Object.entries(m.views).map(([k, v]) => [k, v.dE8])), sweep: m.sweep, a: m.a, b: m.b })),
  plates,
};
writeFileSync(join(OUT, quick ? 'results-quick.json' : 'results.json'), JSON.stringify(strip(results), null, 1));
for (const r of rows) console.log(`${r.held ? 'HELD  ' : 'FAILED'} ${r.id}: ${JSON.stringify(r.measured)} ${r.note}`);
