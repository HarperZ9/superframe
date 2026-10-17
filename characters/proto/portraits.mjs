// Bake painted portraits for the talk panel and close-ups: every speaking part, four expressions,
// paraffin and sodium light, through the engine's painter (render/painted.mjs).
//   node proto/portraits.mjs [lane] [lanes] [who,who,...]
// Writes characters/portraits/<who>/<expression>-<light>.png (512 x 640, straight alpha) and, from
// lane 0, portraits/index.json. Run two lanes at Idle priority (render/io.mjs sets it per process).
import { mkdirSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { gbuffer } from "../render/figure.mjs";
import { paintFigure, relight, sodiumTone } from "../render/painted.mjs";
import { down } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { setExpression, EXPRESSIONS } from "../cast/parts.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import * as LL from "../cast/lamplighter.mjs";
import * as FOLK from "../cast/folk.mjs";

const [laneArg = "0", lanesArg = "1", only] = process.argv.slice(2), lane = +laneArg, lanes = +lanesArg;
const solo = ["lamb", "keel", "fennick", "sabine", "wenna", "merrow", "marrow"];
const members = Object.fromEntries(await Promise.all(solo.map(async (n) => [n, { ...(await import(`../cast/${n}.mjs`)) }])));
for (const k of ["GORM", "HOBB", "FEWELL", "STRAND", "BRIGHT", "COE"]) members[k.toLowerCase()] = { ...LL[k] };
for (const [k, m] of Object.entries(FOLK)) members[k.toLowerCase()] = { ...m };
const who = only ? only.split(",") : Object.keys(members).filter((k, i) => i % lanes === lane);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cast = createCast({ timing, members });
const W = 512, H = 640, LIGHTS = {
  paraffin: { tone: null, rig: { amb: [0.13, 0.09, 0.08], ground: [0.05, 0.03, 0.03], key: { dir: [-0.6, 0.25, 0.76], c: [1.1, 0.8, 0.5], wrap: 0.3 }, fill: { dir: [0.7, 0.1, 0.3], c: [0.12, 0.1, 0.16], wrap: 0.5 }, fresnel: { c: [0.18, 0.12, 0.08], pow: 3 } } },
  sodium: { tone: sodiumTone, rig: { amb: [0.12, 0.1, 0.16], ground: [0.05, 0.04, 0.06], key: { dir: [-0.45, 0.35, 0.8], c: [1.4, 0.9, 0.4], wrap: 0.3 }, fresnel: { c: [0.3, 0.18, 0.08], pow: 3 } } },
};
const index = {};
for (const w of who) {
  const C = members[w], P = C.P, dir = new URL(`../portraits/${w}/`, import.meta.url); mkdirSync(dir, { recursive: true }); index[w] = {};
  for (const expr of Object.keys(EXPRESSIONS)) {
    setExpression(expr);
    const Cx = { ...C };   // a fresh member object so its cached meshes are this expression's
    const a = createCast({ timing, members: { [w]: Cx } }).actor(w, { facing: 34 - 32 }); a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
    const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1], view = { yawDeg: 34, elevDeg: 6, height: 0.8, centre: [0, hy - 0.02, 0] };   // framed on the head, eyes about 38 % down
    const { G } = gbuffer([{ C: Cx, pose, facing: 34 - 32, tool: "hands" }], view, W, H, 2, LIGHTS.paraffin.rig);
    index[w][expr] = {};
    for (const [lname, L] of Object.entries(LIGHTS)) {
      const F = paintFigure(G, Cx.palette || {}, { rig: L.rig, seed: 5 }), r = down(relight(G, F, L.rig, Cx.palette || {}, L.tone), G.w, G.h, 2);
      const file = `${expr}-${lname}.png`; writePng(new URL(file, dir).pathname.replace(/^\/([A-Z]:)/, "$1"), { width: r.w, height: r.h, data: toRgba8(r.rgba, r.w, r.h) });
      index[w][expr][lname] = `characters/portraits/${w}/${file}`;
    }
    setExpression(null);
  }
  console.log("portraits", w); await import(`./portraits_index.mjs?${w}`);
}
// the index is rebuilt from disk after each person, atomically (proto/portraits_index.mjs)
