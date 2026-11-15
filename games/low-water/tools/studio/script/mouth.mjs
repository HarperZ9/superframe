// The mouth, painted as lips and not a bar: the upper lip a half-step darker (it faces down, away from the
// lamp), the line between the lips thin and dark with a slight bow and tapering ends, a small shadow at
// each corner, the lower lip lighter with one light catch toward the key, and the soft shadow under it.
// Placed on the painter's own mouth line when the underpainting reports one (its .info.mouth), else on
// the lip material's box.
//   mouthStrokes(ref, lm, dark, L)   L(layer, brush, pts, n) lays one record
import { mix as kmMix } from "../../../game/engine/paint/km.mjs";
import { colAt } from "./face.mjs";

function mouthFrame(lm) {
  const ml = lm.mouthLine, m = lm.mouth;
  if (ml) { const hw = Math.max(6, (ml.x1 - ml.x0) / 2); return { cx: (ml.x0 + ml.x1) / 2, cy: ml.y, hw, hh: Math.max(3, hw * 0.32) }; }
  if (m) { const hw = Math.max(6, (m.x1 - m.x0) / 2) * 0.8; return { cx: m.cx, cy: m.cy, hw, hh: Math.max(3, hw * 0.32) }; }
  return null;
}
// a path across the mouth: x from -1 to 1 of the half width, y as a function of x (in half heights), and
// the pressure swelling from nothing at the corners to p at the middle, so the shape tapers, never squared
function across(f, n, yOf, p, span = 1) {
  const out = []; for (let k = 0; k <= n; k++) { const t = -span + (2 * span * k) / n; out.push([f.cx + t * f.hw, f.cy + yOf(t) * f.hh, p * (0.12 + 0.88 * Math.sin(Math.PI * (k / n)))]); }
  return out;
}
export function mouthStrokes(ref, lm, dark, L) {
  const f = mouthFrame(lm); if (!f) return;
  const { cx, cy, hw, hh } = f, lip = colAt(ref, cx, cy + hh * 0.4), kx = lm.key[0] < 0 ? -1 : 1, soft = { bristles: 14, spread: 2.6, pickup: 0.3, wetUnder: true, depletion: 0.004 };
  // upper lip: a bow, two low peaks either side of the middle, a half-step darker than the lower
  L("features", { ...soft, colour: kmMix(lip, dark, 0.32), size: hh * 0.42, flow: 0.4, impasto: 0.15 }, across(f, 12, (t) => -0.32 - 0.12 * Math.cos(Math.PI * t * 1.6) * (1 - Math.abs(t)), 0.85, 0.72), 20);
  // lower lip: fuller in the middle, lighter, its weight below the line
  L("features", { ...soft, colour: kmMix(lip, colAt(ref, cx, cy + hh * 1.4), 0.35).map((q) => Math.min(1, q * 1.06)), size: hh * 0.5, flow: 0.4, impasto: 0.35 }, across(f, 12, (t) => 0.42 - 0.18 * t * t, 0.9, 0.58), 21);
  // the line between them: thin, dark, tapering into the corners
  L("features", { ...soft, bristles: 6, spread: 2, colour: kmMix(lip, dark, 0.8), size: Math.max(1.4, hh * 0.13), flow: 0.85, impasto: 0.05, pickup: 0.1 }, across(f, 14, (t) => 0.04 + 0.1 * t * t - 0.05 * Math.cos(Math.PI * t * 2) * (1 - Math.abs(t)), 0.9, 0.8), 22);
  for (const side of [-1, 1]) L("features", { ...soft, bristles: 6, colour: kmMix(lip, dark, 0.42), size: hh * 0.14, flow: 0.4, impasto: 0 }, [[cx + side * hw * 0.84, cy + hh * 0.1, 0.2], [cx + side * hw * 0.9, cy + hh * 0.16, 0.6], [cx + side * hw * 0.95, cy + hh * 0.24, 0.2]], 23 + side);   // corners
  const lx = cx + kx * hw * 0.16, ly = cy + hh * 0.36;
  L("features", { ...soft, bristles: 6, colour: lip.map((q) => Math.min(1, q * 1.3 + 0.05)), size: Math.max(1.2, hh * 0.12), flow: 0.75, impasto: 1, pickup: 0.05 }, [[lx - hw * 0.1, ly + 0.4, 0.2], [lx, ly, 0.7], [lx + hw * 0.1, ly + 0.4, 0.2]], 25);   // the light catch
  L("features", { ...soft, colour: kmMix(colAt(ref, cx, cy + hh * 1.6), dark, 0.28), size: hh * 0.45, flow: 0.28, impasto: 0 }, across(f, 8, () => 1.05, 0.7, 0.4), 26);   // shadow under the lower lip
}
