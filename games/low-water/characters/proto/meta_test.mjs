// The drawer's pose solve from a build summary (actor.mjs metaOfBuilt, sent by a figure worker) against the
// solve from the built mesh: every cast member, with and without its tool's two-hand grip, the same skeleton
// to the last bit and the same hidden parts, and the grips and hands the same at every level of detail (the
// summary is made from the far build). A control drops the grip and must change a two-handed figure.
//   node characters/proto/meta_test.mjs        (exits non-zero on any difference)
import { readFile } from "node:fs/promises";
const { CAST } = await import("../runtime/castmap.mjs");
const { metaOfBuilt, createCast } = await import("../runtime/actor.mjs");
const { solveFigure, hiddenOf } = await import("../rig/solvefig.mjs");
const timing = JSON.parse(await readFile(new URL("../anim/timing.json", import.meta.url), "utf8"));
const L = createCast({ timing, combat: null, members: CAST }).library;
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
const same = (A, B) => A.length === B.length && A.every((j, i) => j.p.every((v, k) => v === B[i].p[k]) && j.R.every((r, k) => (Array.isArray(r) ? r.every((v, q) => v === B[i].R[k][q]) : r === B[i].R[k])));
let n = 0, bad = 0, lodBad = 0, two = 0, ctrl = 0;
for (const who of Object.keys(CAST)) {
  const C = CAST[who], far = C.build({ lod: "far" }), meta = structuredClone(metaOfBuilt(far)), mid = C.build({ lod: "mid" });
  if (JSON.stringify(mid.grips) !== JSON.stringify(far.grips) || JSON.stringify(mid.hands) !== JSON.stringify(far.hands)) lodBad++;
  if (far.tool && far.tool.twoHand != null) two++;
  for (const [anim, f] of [["idle", 3], ["walk", 7], ["heavy", 9], ["light_1", 4]]) {
    if (!L.clips[anim]) continue;
    const pose = L.pose(who, anim, f), locks = { L: { p: [0.12, 0.05, 0.02], w: 0.7 } };
    for (const lk of [null, locks]) { n++; const A = solveFigure(C, far, pose, lk), B = solveFigure(C, meta, pose, lk);
      if (!same(A, B) || [...hiddenOf(pose, far)].join() !== [...hiddenOf(pose, meta)].join()) bad++;
      if (far.tool && far.tool.twoHand != null) { const D = solveFigure(C, { ...meta, tool: null }, pose, lk); if (!same(A, D)) ctrl++; } }
  }
}
expect(bad === 0, `${n} solves over ${Object.keys(CAST).length} members: ${bad} differ between the build summary and the mesh`);
expect(lodBad === 0, `grips and hands the same at far and mid for every member (${lodBad} differ)`);
expect(two > 0 && ctrl > 0, `control: ${two} two-handed members, dropping the grip changes ${ctrl} solves`);
if (fails) { console.log(`${fails} failed`); process.exit(1); }
