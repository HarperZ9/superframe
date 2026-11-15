// Face images for the blind distinctness test (heads-test/PROTOCOL.md): only the mesh part named
// "head" (the sculpted face, its hair and beard, the neck) through the portrait path, every
// expression in paraffin and sodium. Raw 512 x 640 renders with alpha; heads-test/draw.py crops them.
//   node heads-test/stimuli.mjs <bank dir> [who,...]
// Writes <bank>/face/<who>/<expression>-<light>.png.
import { mkdirSync, readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { gbuffer } from "../render/figure.mjs";
import { paintFigure, relight } from "../render/painted.mjs";
import { PORTRAIT_RIG } from "../proto/portrait_light.mjs";
import { down } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { setExpression, EXPRESSIONS } from "../cast/parts.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { roster } from "../proto/heads_roster.mjs";

const [bank, only] = process.argv.slice(2);
if (!bank) throw new Error("usage: node heads-test/stimuli.mjs <bank dir> [who,...]");
const members = await roster(), who = only ? only.split(",") : Object.keys(members);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const W = 512, H = 640, LIGHTS = PORTRAIT_RIG;   // the portrait lights (proto/portrait_light.mjs)
for (const w of who) {
  const dir = `${bank}/face/${w}`; mkdirSync(dir, { recursive: true });
  for (const expr of Object.keys(EXPRESSIONS)) {
    setExpression(expr);
    const C = { ...members[w] }, a = createCast({ timing, members: { [w]: C } }).actor(w, { facing: 2 });
    a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
    const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1], view = { yawDeg: 34, elevDeg: 6, height: 0.8, centre: [0, hy - 0.02, 0] };
    const lod = "near", mesh = C[`mesh_${lod}_${C.info?.tool}`] || (C[`mesh_${lod}_${C.info?.tool}`] = C.build({ lod, tool: C.info?.tool }));
    pose.hide = mesh.M.parts.filter((p) => p !== "head");   // the face alone: no hat, collar, costume or props
    const { G } = gbuffer([{ C, pose, facing: 2 }], view, W, H, 2, LIGHTS.paraffin.rig);
    for (const [lname, L] of Object.entries(LIGHTS)) {
      const F = paintFigure(G, C.palette || {}, { rig: L.rig, seed: 5 }), r = down(relight(G, F, L.rig, C.palette || {}, L.tone), G.w, G.h, 2);
      writePng(`${dir}/${expr}-${lname}.png`, { width: r.w, height: r.h, data: toRgba8(r.rgba, r.w, r.h) });
    }
    setExpression(null);
  }
  console.log("stimuli", w);
}
