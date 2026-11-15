// Body proportions of The Quota's cast against a reference by age (characters/notes/ANIM-BOUNDS.md, target 4).
//   node proto/body_check.mjs [--json out/bodies.json]
// Reference, natural proportions (artists' and growth-chart figures, from memory, moderate confidence):
// heads per height 5.0 at 4, 6.0 at 9, 6.1 at 10, 6.3 at 11, 6.9 at 14, 7.5 adult; hip-joint height over
// stature below the same sex's adult by 0.05 at 4, 0.015 at 9 and 10, 0.01 at 11, 0.005 at 14. The cast is
// stylised (adults run larger heads than 7.5), so the heads reference is scaled by the cast's own adults:
// style = mean adult heads per height / 7.5. A child passes within 6 % of the scaled heads figure and
// within 0.03 of the hip ratio.
import { writeFileSync } from "node:fs";
import { roster } from "./heads_roster.mjs";

const HEADS = [[4, 5.0], [9, 6.0], [10, 6.1], [11, 6.3], [14, 6.9], [18, 7.5]];
const LEGD = [[4, -0.05], [9, -0.015], [10, -0.015], [11, -0.01], [14, -0.005], [18, 0]];
const interp = (T, a) => { if (a <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (a <= T[i][0]) { const [a0, v0] = T[i - 1], [a1, v1] = T[i], t = (a - a0) / (a1 - a0); return v0 + (v1 - v0) * t; } return T[T.length - 1][1]; };
const m = await roster("quota"), rows = [];
for (const [id, C] of Object.entries(m)) { const q = C.info.quota || {}; rows.push({ id, age: q.age ?? 40, sex: q.sex === "f" ? "f" : "m", P: C.P }); }
const adults = rows.filter((r) => r.age >= 18), style = adults.reduce((s, r) => s + r.P.h / r.P.head, 0) / adults.length / 7.5;
const adultLeg = { m: avg(adults.filter((r) => r.sex === "m").map((r) => r.P.leg)), f: avg(adults.filter((r) => r.sex === "f").map((r) => r.P.leg)) };
function avg(a) { return a.reduce((s, x) => s + x, 0) / a.length; }
console.log(`style: the cast's adults average ${(style * 7.5).toFixed(2)} heads (${(style * 100).toFixed(0)} % of 7.5); adult hip ratio m ${adultLeg.m.toFixed(3)}, f ${adultLeg.f.toFixed(3)}`);
let fails = 0;
for (const r of rows.sort((a, b) => a.age - b.age)) {
  const heads = r.P.h / r.P.head, refH = interp(HEADS, r.age) * style, refL = adultLeg[r.sex] + interp(LEGD, r.age);
  const dH = heads / refH - 1, dL = r.P.leg - refL, child = r.age < 18, ok = !child || (Math.abs(dH) <= 0.06 && Math.abs(dL) <= 0.03);
  if (!ok) fails++;
  r.out = { heads, refH, dH, leg: r.P.leg, refL, dL, ok };
  console.log(`${ok ? "ok  " : "OFF "} ${r.id.padEnd(11)} ${r.sex} ${String(r.age).padStart(2)}  ${r.P.h.toFixed(2)} m  heads ${heads.toFixed(2)} (ref ${refH.toFixed(2)}, ${(dH * 100).toFixed(0).padStart(3)} %)  hip ${r.P.leg.toFixed(3)} (ref ${refL.toFixed(3)}, ${dL >= 0 ? "+" : ""}${dL.toFixed(3)})  shoulders ${(2 * r.P.shoulder / r.P.h).toFixed(3)} h  arm ${(r.P.arm / r.P.h).toFixed(3)} h`);
}
console.log(`${fails} children outside the bounds`);
const i = process.argv.indexOf("--json"); if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify({ style, adultLeg, rows }, null, 1));
