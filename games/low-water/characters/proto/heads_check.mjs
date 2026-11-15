// The render half of the head rules (PROTOCOL amendment 2, forge/headrules.mjs is the other half):
// each face from the portrait camera (neutral, the costume hidden so a hat brim does not count
// against the eyes), G-buffer only, counted at the portrait's 512 x 640:
//   eye     per eye: white pixels and iris-and-pupil pixels. The nearer eye at least 70 white and 35
//           iris; the farther (half hidden by the nose in three-quarters) at least 25 and 15. At
//           the 720p panel (161 x 201, a tenth of the area) that is about 7 and 3 pixels a side.
//   brow    brow pixels at least 60 (both brows), unless the sheet's brows are marked pale
//   lumps   none here (forge/headrules.mjs)
//   node proto/heads_check.mjs [who,...]     prints a table; exits 1 when a face fails
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { gbuffer } from "../render/figure.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { MATS } from "../rig/materials.mjs";
import { roster } from "./heads_roster.mjs";
import { SHEETS } from "../forge/heads.cast.mjs";
import { checkRules } from "../forge/headrules.mjs";

export const EYE_MIN = { near: { white: 70, iris: 35 }, far: { white: 25, iris: 15 }, brow: 60 };
const [only] = process.argv.slice(2), members = await roster(), who = only ? only.split(",") : Object.keys(SHEETS);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const WHITE = MATS.white.id, IRIS = new Set([MATS.eye.id, MATS.hat.id]), BROW = MATS.brow.id;
let failed = 0;
for (const w of who) {
  const C = { ...members[w] }, a = createCast({ timing, members: { [w]: C } }).actor(w, { facing: 2 });
  a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
  const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1];
  const mesh = C[`mesh_near_${C.info?.tool}`] || (C[`mesh_near_${C.info?.tool}`] = C.build({ lod: "near", tool: C.info?.tool }));
  pose.hide = mesh.M.parts.filter((p) => p !== "head");
  const { G } = gbuffer([{ C, pose, facing: 2 }], { yawDeg: 34, elevDeg: 6, height: 0.8, centre: [0, hy - 0.02, 0] }, 512, 640, 2, null);
  const px = []; let brow = 0;
  for (let i = 0; i < G.w * G.h; i++) { const id = G.id[i]; if (id === WHITE || IRIS.has(id)) px.push([i % G.w, id === WHITE]); else if (id === BROW) brow++; }
  // split the eyes at the widest gap in x; counts at the 512 x 640 output (the G-buffer is 2x)
  px.sort((p, q) => p[0] - q[0]); let gi = 0, gap = -1; for (let i = 1; i < px.length; i++) if (px[i][0] - px[i - 1][0] > gap) { gap = px[i][0] - px[i - 1][0]; gi = i; }
  const eyes = [px.slice(0, gi), px.slice(gi)].map((L) => ({ white: Math.round(L.filter((p) => p[1]).length / 4), iris: Math.round(L.filter((p) => !p[1]).length / 4) })).sort((p, q) => q.white + q.iris - (p.white + p.iris));
  const [near, far] = eyes, b = Math.round(brow / 4), errs = [];
  if (near.white < EYE_MIN.near.white || near.iris < EYE_MIN.near.iris) errs.push(`near eye ${near.white}/${near.iris}`);
  if (far.white < EYE_MIN.far.white || far.iris < EYE_MIN.far.iris) errs.push(`far eye ${far.white}/${far.iris}`);
  if (b < EYE_MIN.brow && !SHEETS[w].paleBrows) errs.push(`brows ${b}`);
  const rules = checkRules(SHEETS[w], mesh.M.headNeck); errs.push(...rules.errors.map((e) => e.split(" (")[0]));
  if (errs.length) failed++;
  console.log(w.padEnd(10), `eyes ${near.white}/${near.iris} ${far.white}/${far.iris}`.padEnd(22), `brows ${b}`.padEnd(11), errs.length ? "FAIL " + errs.join("; ") : "ok", rules.waived.length ? `(waived: ${rules.waived.map((x) => x.split(" ")[0]).join(", ")})` : "");
}
console.log(`${who.length - failed} of ${who.length} faces pass`);
process.exit(failed ? 1 : 0);
