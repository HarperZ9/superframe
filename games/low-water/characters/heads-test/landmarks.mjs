// Eye and mouth centres for the face-core crops (heads-test/PROTOCOL.md, amendment 1): the same view
// as stimuli.mjs, G-buffer only (no painting), the pixels of the eye materials (white, iris, pupil)
// split into two eyes, and the pixels of the lip material.
//   node heads-test/landmarks.mjs <bank dir> [who,...]      writes <bank>/landmarks.json (512 x 640 px)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { gbuffer } from "../render/figure.mjs";
import { setExpression, EXPRESSIONS } from "../cast/parts.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { MATS } from "../rig/materials.mjs";
import { roster } from "../proto/heads_roster.mjs";

const [bank, only] = process.argv.slice(2), members = await roster(), who = only ? only.split(",") : Object.keys(members);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const file = `${bank}/landmarks.json`, out = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const EYE = new Set(["white", "eye"].map((n) => MATS[n].id)), PUPIL = MATS.hat.id, LIP = MATS.lip.id;
for (const w of who) {
  out[w] = {};
  for (const expr of ["startled", ...Object.keys(EXPRESSIONS).filter((e) => e !== "startled")]) {   // startled first: its lids are open widest, and the eyes do not move between expressions
    setExpression(expr);
    const C = { ...members[w] }, a = createCast({ timing, members: { [w]: C } }).actor(w, { facing: 2 });
    a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
    const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1], view = { yawDeg: 34, elevDeg: 6, height: 0.8, centre: [0, hy - 0.02, 0] };
    const mesh = C[`mesh_near_${C.info?.tool}`] || (C[`mesh_near_${C.info?.tool}`] = C.build({ lod: "near", tool: C.info?.tool }));
    pose.hide = mesh.M.parts.filter((p) => p !== "head");
    const { G } = gbuffer([{ C, pose, facing: 2 }], view, 512, 640, 2, null), eye = [], lip = [];
    const headPx = (i) => G.id[i] !== 0;
    for (let i = 0; i < G.w * G.h; i++) { const id = G.id[i], x = (i % G.w) / 2, y = Math.floor(i / G.w) / 2; if (EYE.has(id) || (id === PUPIL && headPx(i))) eye.push([x, y]); else if (id === LIP) lip.push([x, y]); }
    if (lip.length < 4) {   // the lips hidden (a full beard): take the mouth from startled, where the jaw is open
      if (!out[w].startled || out[w].startled.mouthFrom) throw new Error(`landmarks: ${w} ${expr}: ${lip.length} lip pixels`);
      for (let k = 0; k < 6; k++) lip.push(out[w].startled.mouth);
      var mouthFrom = "startled";
    } else var mouthFrom = undefined;
    // two eyes: split at the largest gap in x
    eye.sort((p, q) => p[0] - q[0]); let gi = 1, gap = -1; for (let i = 1; i < eye.length; i++) if (eye[i][0] - eye[i - 1][0] > gap) { gap = eye[i][0] - eye[i - 1][0]; gi = i; }
    if (eye.length < 8 || gap < 6) {   // lids (nearly) shut, or one eye only: take the eyes from startled, the eyes do not move
      if (!out[w].startled) throw new Error(`landmarks: ${w} ${expr}: no eyes even with the lids open`);
      out[w][expr] = { ...out[w].startled, mouth: (([x, y]) => [+x.toFixed(1), +y.toFixed(1)])([lip.reduce((s, p) => s + p[0], 0) / lip.length, lip.reduce((s, p) => s + p[1], 0) / lip.length]), eyesFrom: "startled" };
      setExpression(null); continue;
    }
    const mean = (L) => [L.reduce((s, p) => s + p[0], 0) / L.length, L.reduce((s, p) => s + p[1], 0) / L.length];
    const eL = mean(eye.slice(0, gi)), eR = mean(eye.slice(gi)), m = mean(lip);
    out[w][expr] = { eyes: [eL, eR].map((p) => p.map((v) => +v.toFixed(1))), mouth: m.map((v) => +v.toFixed(1)), eyeGap: +gap.toFixed(1), ...(mouthFrom ? { mouthFrom } : {}) };
    setExpression(null);
  }
  console.log("landmarks", w, JSON.stringify(out[w].neutral));
  out[w] = Object.fromEntries(Object.keys(EXPRESSIONS).map((e) => [e, out[w][e]]));
}
writeFileSync(file, JSON.stringify(out, null, 1));
