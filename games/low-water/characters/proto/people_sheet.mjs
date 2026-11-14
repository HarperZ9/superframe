// Portrait sheets for The Quota's peoples and cast (cast/peoples.mjs, cast/quota.mjs), at neutral with
// the portrait camera and paraffin light the mood sheet uses.
//   node proto/people_sheet.mjs <out.png> tarn|hesh|vell   eight people from one range: mixed ages and sexes, one class
//   node proto/people_sheet.mjs <out.png> cast             the slice's speakers
// Writes <out.png> and <out.json> (each cell's label lines), which proto/label_sheet.py prints under the cells.
import { readFileSync, writeFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { gbuffer } from "../render/figure.mjs";
import { paintFigure, relight } from "../render/painted.mjs";
import { down, paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { setExpression } from "../cast/parts.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { make, person, at } from "../cast/quota.mjs";
import { roster } from "./heads_roster.mjs";
import { PORTRAIT_RIG } from "./portrait_light.mjs";

// eight people in one range: [sex, age, class]; the class is held to one middling trade so the sheet
// shows the people's variation, not the class's
const EIGHT = [["m", 24], ["f", 30], ["m", 45], ["f", 40], ["f", 14], ["m", 10], ["m", 65], ["f", 75]];
const AGED = new Set([4, 10, 14, 65, 75]);
function samples(people) {
  return EIGHT.map(([sex, age], i) => {
    const d = { id: `${people}-${i}`, name: `${people} ${i + 1}`, people, seed: `${people}-sample-${i}`, sex, age, cls: "smith", idea: "a sample from the range" };
    const spec = AGED.has(age) ? { ...at(person(d), age), id: d.id } : person(d);
    return [d.id, make(spec), [`${people === "tarn" ? "Tarn" : people === "hesh" ? "Hesh" : "Vell"} ${i + 1}`, `${sex === "f" ? (age < 16 ? "girl" : "woman") : age < 16 ? "boy" : "man"}, ${age}`, `${spec.P.h.toFixed(2)} m`]];
  });
}
const [out, mode] = process.argv.slice(2);
const list = mode === "cast" ? Object.entries(await roster("quota")).map(([id, m]) => { const q = m.info.quota; return [id, m, [m.info.name, `${q.people}, ${q.cls}`, `${q.sex === "f" ? "f" : "m"} ${q.age}, ${m.P.h.toFixed(2)} m`]]; })
  : samples(mode);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cols = mode === "cast" ? 8 : 8, rows = Math.ceil(list.length / cols), w = 256, h = 320, W = w * cols, H = h * rows, img = new Float32Array(W * H * 4).fill(0.2), rig = PORTRAIT_RIG.paraffin.rig;
list.forEach(([id, C0], n) => {
  setExpression({ lidsAdd: -0.2 });   // the portrait's neutral (the mood sheet's: the cue's lids plus the open offset)
  const C = { ...C0 }, a = createCast({ timing, members: { [id]: C } }).actor(id, { facing: 2 });
  a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
  const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1];
  const { G } = gbuffer([{ C, pose, facing: 2 }], { yawDeg: 34, elevDeg: 6, height: 0.55, centre: [0, hy + 0.06, 0] }, w * 2, h * 2, 2, rig);
  const F = paintFigure(G, C.palette || {}, { rig, seed: 5 }), im = down(down(relight(G, F, rig, C.palette || {}, null), G.w, G.h, 2).rgba, w * 2, h * 2, 2);
  for (let i = 0; i < w * h; i++) { const al = im.rgba[i * 4 + 3]; for (let k = 0; k < 3; k++) im.rgba[i * 4 + k] = im.rgba[i * 4 + k] * al + [0.23, 0.15, 0.1][k] * (1 - al); im.rgba[i * 4 + 3] = 1; }
  paste(img, W, H, im.rgba, w, h, (n % cols) * w, Math.floor(n / cols) * h); setExpression(null);
  console.log("cell", id);
});
writePng(out, { width: W, height: H, data: toRgba8(img, W, H) });
writeFileSync(out.replace(/\.png$/, ".json"), JSON.stringify({ cols, w, h, labels: list.map((x) => x[2]) }, null, 1));
