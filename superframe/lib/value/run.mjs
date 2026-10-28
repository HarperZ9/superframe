// run.mjs: every PREREG measurement in one pass, at a chosen resolution. Returns the numbers and the images the
// plates draw. P1 and P2 on the traced scenes, P3 on the curve, P4 on the Fresnel tables, P5 and P6 on the gold
// renders, P7 on the metamer pairs.
import { whiteOnWhite, darkField, flatControl } from './presets.mjs';
import { render } from './trace.mjs';
import { toDisplay, curve, xAt, D_W } from './tone.mjs';
import { specLabels, whiteCheck, shuffleLabels, valueBudget, uniformField, MIN_BRIGHT } from './measure.mjs';
import { renderSphere } from './goldscene.mjs';
import { yellowShare, meanAB, hueOf, hueFollow } from './goldmeasure.mjs';
import { goldF, dielectricF } from './gold.mjs';
import { metamerPair, blackbodySweep, rgbRelight, dEUnder } from './metamer.mjs';

export const ENV_LIST = ['sky', 'sunset', 'foliage', 'studio'];
export const PAIRS = [['sky', 'sunset'], ['foliage', 'sunset']];

export function runValue({ w = 480, h = 300, ss = 2, photons = 200000, scene = {} } = {}) {
  const s = whiteOnWhite({ photons, ...scene }), img = render(s, { w, h, ss }), lab = specLabels(img);
  const budget = toDisplay(img, { C: s.C }), clamp = toDisplay(img, { mode: 'clamp' });
  const P1 = whiteCheck(budget, lab), P1c = whiteCheck(clamp, lab), P1s = whiteCheck(budget, shuffleLabels(lab));
  const P1n = whiteCheck(uniformField(64, 64, 0.8), new Uint8Array(64 * 64));
  let difMax = 0; for (let i = 0; i < w * h; i++) difMax = Math.max(difMax, img.dif[3 * i] * 0.2126729 + img.dif[3 * i + 1] * 0.7151522 + img.dif[3 * i + 2] * 0.072175);
  return { scene: s, img, labels: lab, budget, clamp, P1, P1c, P1s, P1n, difOverC: difMax / s.C, minBright: MIN_BRIGHT };
}

export function runDark({ w = 480, h = 300, ss = 2, photons = 200000 } = {}) {
  const s = darkField({ photons }), img = render(s, { w, h, ss }), lab = specLabels(img), disp = toDisplay(img, { C: s.C });
  const f = flatControl(), fimg = render(f, { w, h, ss }), fdisp = toDisplay(fimg, { C: f.C });
  return { scene: s, flat: f, disp, fdisp, labels: lab, P2: { ...valueBudget(disp), check: whiteCheck(disp, lab) }, P2c: valueBudget(fdisp) };
}

export function runCurve() {
  const ladder = [0.25, 0.5, 1].map(x => ({ x, y: curve(x), err: Math.abs(curve(x) - D_W * x) }));
  let mono = true; for (let x = 0, p = -1; x < 50; x += 0.01) { const y = curve(x); if (y < p) mono = false; p = y; }
  return { ladder, monotonic: mono, x95: xAt(0.95), x95Closed: 1 + Math.log(4) / 4, atInf: curve(1e6) };
}

export function runFresnel() {
  const N = goldF(1), G = goldF(Math.cos(89.5 * Math.PI / 180)), D = dielectricF(1);
  return { normal: N, grazing: G, blueMax: Math.max(...N.slice(0, 5)), redMin: Math.min(...N.slice(10)), grazingMin: Math.min(...G), dielectric: D[0], dielectricSpread: Math.max(...D) - Math.min(...D) };
}

export function runGold({ w = 400, h = 400, ss = 2 } = {}) {
  const R = {};
  for (const env of ENV_LIST) for (const mat of ['gold', 'yellow']) {
    const img = renderSphere(env, mat, { w, h, ss }), disp = toDisplay(img, { C: img.C }), y = yellowShare(disp, img.mask);
    R[`${env}/${mat}`] = { env, mat, disp, mask: img.mask, yellow: y, ab: meanAB(disp, img.mask), seen: img.seenAB, C: img.C };
  }
  for (const r of Object.values(R)) r.hue = hueOf(r.ab);
  const follow = PAIRS.map(([a, b]) => ({ a, b, gold: hueFollow(R[`${a}/gold`].ab, R[`${b}/gold`].ab, R[`${a}/gold`].seen, R[`${b}/gold`].seen), yellow: hueFollow(R[`${a}/yellow`].ab, R[`${b}/yellow`].ab, R[`${a}/gold`].seen, R[`${b}/gold`].seen) }));
  return { R, follow };
}

export function runMetamer() {
  return ['#7a8a5a', '#b08a6e'].map(hex => {
    const p = metamerPair(hex);
    return { ...p, rgbA: rgbRelight(p, 'A'), selfD65: dEUnder(p.a, p.a.slice(), 'D65'), selfA: dEUnder(p.a, p.a.slice(), 'A'), sweep: blackbodySweep(p) };
  });
}

// the graded table: every PREREG row with its measured number and whether it held
export function grade({ V, D, Cv, F, G, M }) {
  const rows = [];
  const add = (id, measured, held, note = '') => rows.push({ id, measured, held, note });
  add('P1 share', V.P1.share, V.P1.share !== null && V.P1.share >= 0.95, `${V.P1.spec} of ${V.P1.bright} pixels above 0.95`);
  add('P1 non-vacuous', V.P1.frac, V.P1.frac >= V.minBright, 'fraction of frame above 0.95, needed >= 0.0005');
  add('P1 control clamp', V.P1c.share, V.P1c.share !== null && V.P1c.share < 0.5, `${V.P1c.bright} pixels above 0.95`);
  add('P1s shuffled', V.P1s.share, V.P1s.share === null || V.P1s.share < 0.5);
  add('P1n noise floor', V.P1n.bright, V.P1n.bright === 0 && V.P1n.pass === false);
  add('P2 dark share', D.P2.dark, D.P2.dark >= 0.5);
  add('P2 white share', D.P2.white, D.P2.white <= 0.01);
  add('P2 white specular', D.P2.check.share, D.P2.check.share !== null && D.P2.check.share >= 0.95);
  add('P2 control flat dark share', D.P2c.dark, D.P2c.dark < 0.1);
  add('P3 ladder', Math.max(...Cv.ladder.map(l => l.err)), Cv.ladder.every(l => l.err < 1e-9) && Cv.monotonic && Math.abs(Cv.x95 - 1.3466) < 1e-4);
  add('P4 gold', [F.blueMax, F.redMin, F.grazingMin], F.blueMax < 0.5 && F.redMin > 0.85 && F.grazingMin > 0.97);
  add('P4 control dielectric', F.dielectricSpread, F.dielectricSpread < 1e-12 && Math.abs(F.dielectric - 0.04) < 1e-12);
  for (const env of ENV_LIST) add(`P5 gold ${env}`, G.R[`${env}/gold`].yellow.share, G.R[`${env}/gold`].yellow.share < 0.5);
  for (const env of ENV_LIST) add(`P5 control yellow ${env}`, G.R[`${env}/yellow`].yellow.share, G.R[`${env}/yellow`].yellow.share > 0.5);
  for (const f of G.follow) { add(`P6 gold ${f.a}-${f.b}`, f.gold.coefficient, f.gold.coefficient >= 0.5); add(`P6 control ${f.a}-${f.b}`, f.yellow.coefficient, f.yellow.coefficient <= 0.2); }
  for (const m of M) {
    add(`P7 ${m.hex} D65 match`, m.d65, m.d65 < 0.5); add(`P7 ${m.hex} A split`, m.A, m.A > 4);
    add(`P7 ${m.hex} control self`, [m.selfD65, m.selfA], m.selfD65 === 0 && m.selfA === 0); add(`P7 ${m.hex} control RGB relight`, m.rgbA, m.rgbA < 0.5);
  }
  return rows;
}
