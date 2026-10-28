// measure.mjs: shared measurement helpers for the lib/body tests and the spec sheet tool (tools/body-spec.mjs).
import { axialRange, footVsKneecap, aimFoot } from './knee.mjs';
import { checkStance, poseSet } from './pose.mjs';
import { rngFrom } from '../seed.mjs';

// Worst foot turn against the kneecap's locked line over flexion 0 to 5 deg (coupled unwind plus cord range).
export function worstLockDeviation(step = 0.05, cords = undefined) {
  let w = 0;
  for (let f = 0; f < 5 - 1e-9; f += step) {
    const r = axialRange(f, cords);
    w = Math.max(w, Math.abs(footVsKneecap(f, r.outward)), Math.abs(footVsKneecap(f, -r.inward)));
  }
  return w;
}

// K5: six planted straight-leg twists and six clean poses.
export function plantedLegSet() {
  const planted = [[3, 0], [5, 1], [8, 2], [12, 3], [20, 4], [30, 4.9]].map(([dev, flex]) => ({ flex, hip: 0, foot: dev, planted: true }));
  const clean = [[10, 0], [-20, 2], [30, 4]].map(([t, flex]) => { const a = aimFoot(t, flex); return { flex, hip: a.hip, foot: a.reached, planted: false }; });
  for (const flex of [30, 60, 90]) { const r = axialRange(flex), foot = footVsKneecap(flex, 0.8 * r.outward); clean.push({ flex, hip: 5, foot: 5 + foot, planted: false }); }
  return [...planted, ...clean];
}

// Seeded Gaussian jitter on a 2D path (Box-Muller).
export function jittered(path, sigma, seed = 'body/jaw-noise') {
  const rng = rngFrom(seed), g = () => { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
  return path.map(([x, y]) => [x + sigma * g(), y + sigma * g()]);
}

// C5: checker agreement with labels shuffled across the pooled contrapposto and same-direction sets.
export function shuffledAgreement(seed = 'body/pose-shuffle') {
  const pooled = [...poseSet('contrapposto'), ...poseSet('same')], labels = pooled.map(x => x.kind === 'contrapposto');
  const rng = rngFrom(seed);
  for (let i = labels.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [labels[i], labels[j]] = [labels[j], labels[i]]; }
  return pooled.filter((x, i) => (checkStance(x.pose).cls === 'contrapposto') === labels[i]).length / pooled.length;
}
