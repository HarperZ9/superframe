// Quick look at sculpted heads while authoring (half the portrait resolution; zoom > 1 for a close-up): for each person, the portrait (neutral, paraffin),
// the head alone from the portrait camera, and the head alone from the front, side by side.
//   node proto/heads_preview.mjs <out.png> who,who,... [expression name or JSON sliders] [zoom]
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { gbuffer } from "../render/figure.mjs";
import { paintFigure, relight } from "../render/painted.mjs";
import { down, paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { setExpression } from "../cast/parts.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { roster } from "./heads_roster.mjs";
import { PORTRAIT_RIG } from "./portrait_light.mjs";

const [out, list, expr = "neutral", zoomArg = "1"] = process.argv.slice(2), zoom = +zoomArg, members = await roster(), who = list.split(",");
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const w = 256, h = 320, cols = 3, img = new Float32Array(w * cols * h * who.length * 4);
for (let i = 0; i < w * cols * h * who.length; i++) img.set([0.23, 0.15, 0.1, 1], i * 4);
setExpression(expr.startsWith("{") ? JSON.parse(expr) : expr);
who.forEach((id, row) => {
  const C = { ...members[id] }, a = createCast({ timing, members: { [id]: C } }).actor(id, { facing: 2 });
  a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
  const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1];
  [[34, false], [34, true], [0, true]].forEach(([yaw, bare], col) => {
    const p = { ...pose }, mesh = C[`mesh_near_${C.info?.tool}`] || (C[`mesh_near_${C.info?.tool}`] = C.build({ lod: "near", tool: C.info?.tool }));
    if (bare) p.hide = mesh.M.parts.filter((n) => n !== "head");
    const view = { yawDeg: yaw, elevDeg: 6, height: 0.8 / zoom, centre: [0, hy - 0.02 + (zoom > 1 ? 0.1 : 0), 0] };
    const { G } = gbuffer([{ C, pose: p, facing: 2 }], view, w, h, 2, PORTRAIT_RIG.paraffin.rig);
    const F = paintFigure(G, C.palette || {}, { rig: PORTRAIT_RIG.paraffin.rig, seed: 5 }), r0 = relight(G, F, PORTRAIT_RIG.paraffin.rig, C.palette || {}, null);
    const r = down(r0, G.w, G.h, 2);
    const bg = new Float32Array(w * h * 4); for (let k = 0; k < w * h; k++) { const al = r.rgba[k * 4 + 3]; for (let c = 0; c < 3; c++) bg[k * 4 + c] = r.rgba[k * 4 + c] * al + [0.23, 0.15, 0.1][c] * (1 - al); bg[k * 4 + 3] = 1; }
    paste(img, w * cols, h * who.length, bg, w, h, col * w, row * h);
  });
  console.log("preview", id);
});
writePng(out, { width: w * cols, height: h * who.length, data: toRgba8(img, w * cols, h * who.length) });
