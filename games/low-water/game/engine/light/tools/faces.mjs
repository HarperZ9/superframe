// Is every speaker in each slice scene legibly lit, at play size and at portrait size? Each speaker is drawn
// through the character renderer (characters/render) twice: under the fixed rigs the game used before (the
// drawer's default rig at play size, PORTRAIT_RIG.paraffin for portraits) and under the light model's rig at
// their mark (figure.mjs), with its catch-light and cold warmth. The face's L* range and its separation from
// the ground behind it (the relit plate round the head) are measured against pass lines set beforehand
// (legible.mjs LIMITS); a flat control rig must fail. Writes a contact sheet and faces.json.
//   node game/engine/light/tools/faces.mjs --out <dir> [--plates <dir>]
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writePng } from "./png.mjs";
import { sheet } from "./sheet.mjs";
import { relitScene } from "./oilsheet.mjs";
import { figureRig, NUDGE, scaleRig } from "../figure.mjs";
import { faceStats, ringStats, legible, LIMITS } from "../legible.mjs";
import { projectPlate } from "../../world/camera.mjs";
import { touchUp } from "./touchup.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const root = join(fileURLToPath(import.meta.url), "../../../../.."), ch = (p) => pathToFileURL(join(root, "characters", p)).href, out = opt.out || join(root, "game/capture/light/faces");
const { createCast } = await import(ch("runtime/actor.mjs")), { gbuffer } = await import(ch("render/figure.mjs")), { albedo, light, compose } = await import(ch("render/shade.mjs"));
const { PORTRAIT_RIG } = await import(ch("proto/portrait_light.mjs")), { roster } = await import(ch("proto/heads_roster.mjs")), { INDEX } = await import(ch("rig/skeleton.mjs")), { MATS } = await import(ch("rig/materials.mjs"));
const timing = JSON.parse(readFileSync(join(root, "characters/anim/timing.json"), "utf8")), members = await roster("quota");
const FACE = new Set(["skin", "cheek", "jawcool", "lip"].map((n) => MATS[n].id)), EYE = MATS.eye.id, SKIN = new Set(["skin", "cheek", "jawcool"].map((n) => MATS[n].id));
// the drawer's own default rig (characters/runtime/fightdrawer.mjs FIGHT_RIG), the play-size before
const DRAWER_RIG = { amb: [0.09, 0.07, 0.13], ground: [0.03, 0.025, 0.04], key: { dir: [-0.35, 0.85, 0.4], c: [0.95, 0.6, 0.26], wrap: 0.35 }, fill: { dir: [0.5, 0.3, -0.6], c: [0.2, 0.12, 0.06], wrap: 0.5 }, fresnel: { c: [0.34, 0.2, 0.08], pow: 3 } };
// the slice's speakers at their marks (the plates' spots; around a table, the seats either side)
export const SPEAKERS = [
  { scene: "square-dawn", who: [["ned", [8.5, 0, 9.5]], ["will", [17.0, 0, 0.5]]] },
  { scene: "kitchen-haldane", who: [["tomas", [0.3, 0, 0.9]], ["aaron", [-0.5, 0, 0.5]], ["anni", [1.1, 0, 1.3]]] },
  { scene: "kitchen-furrowe", who: [["ned", [0.4, 0, 1.5]], ["mary", [-0.4, 0, 0.8]], ["pell", [1.2, 0, 0.7]], ["abel", [-1.3, 0, 1.2]]] },
  { scene: "kitchen-brack", who: [["will", [0.2, 0, 1.4]]] },
  { scene: "granary", who: [["captain", [0, 0, -2.4]], ["will", [0.4, 0, 2]], ["ned", [-1.6, 0, 1.2]]] },
];
function draw(who, view, W, H, rig, ss, facing) {
  const C = { ...members[who] }, a = createCast({ timing, members: { [who]: C } }).actor(who, { facing }); a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
  const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1], v = typeof view === "function" ? view(hy) : view;
  const { G } = gbuffer([{ C, pose, facing, tool: "none" }], v, W, H, ss, rig), A = albedo(G, C.palette || {}), E = light(G, rig, C.palette || {});
  return { G, rgba: compose(G, A, E, null, { bands: 0 }) };
}
function onGround(fig, bg) {   // the figure over a flat ground of the scene's local value, as an 8-bit image
  const { G, rgba } = fig, img = { width: G.w, height: G.h, data: new Uint8ClampedArray(G.w * G.h * 4) };
  for (let i = 0; i < G.w * G.h; i++) { const a = Math.min(1, rgba[i * 4 + 3]); for (let k = 0; k < 3; k++) img.data[i * 4 + k] = 255 * Math.min(1, rgba[i * 4 + k] * a + (bg[k] / 255) * (1 - a)); img.data[i * 4 + 3] = 255; }
  return img;
}
function measure(scene, who, at, rel, rigs) {
  const pj = rel.pj, p = projectPlate(pj.camera, pj.width, pj.height, [at[0], at[1] + 1.55, at[2]]), r = (pj.pxPerMetre || 40) * 0.35, cam = pj.camera, rows = [];
  for (const [name, rig, plate, extra] of rigs) {
    const ground = ringStats(plate, p[0], p[1], r, r * 2.2), bgPx = groundRgb(plate, p, r);
    const ppm = cam.ppm || (pj.pxPerMetre || 40) * 2, H = Math.round(2.0 * ppm), W = Math.max(16, Math.round(0.6 * H));
    const play = draw(who, { yawDeg: cam.yawDeg, elevDeg: cam.elevDeg, height: 2.0, centre: [0, 1.0, 0] }, W, H, rig, 2, cam.yawDeg - 32);
    const port = draw(who, (hy) => ({ yawDeg: 34, elevDeg: 4, height: 0.78, centre: [0, hy, 0] }), 512, 640, extra?.portraitRig || rig, 1, 2);
    if (extra && extra.touch) { touchUp(play, extra.touch, { FACE: SKIN, EYE }); touchUp(port, extra.touch, { FACE: SKIN, EYE }); }
    const sp = legible(faceStats(play.rgba, play.G.w, play.G.h, play.G.id, FACE), ground, LIMITS.play), so = legible(faceStats(port.rgba, port.G.w, port.G.h, port.G.id, FACE), ground, LIMITS.portrait);
    rows.push({ scene, who, rig: name, play: sp, portrait: so, ground: +ground.p50.toFixed(1), img: { play: onGround(play, bgPx), port: onGround(port, bgPx) } });
  }
  return rows;
}
function groundRgb(img, p, r) { const acc = [0, 0, 0]; let m = 0; for (let a = 0; a < 16; a++) { const x = Math.round(p[0] + Math.cos(a) * r * 1.6), y = Math.round(p[1] + Math.sin(a) * r * 1.6); if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue; const q = (y * img.width + x) * 4; for (let k = 0; k < 3; k++) acc[k] += img.data[q + k]; m++; } return acc.map((v) => v / (m || 1)); }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(out, { recursive: true });
  const { SCENES } = await import("./oilsheet.mjs"), all = [], cells = [];
  for (const sp of SPEAKERS) {
    if (opt.only && !opt.only.split(",").includes(sp.scene)) continue;
    const sc = SCENES.find((s) => s.id === sp.scene), rel = relitScene(sc, { plates: opt.plates });
    for (const [who, at] of sp.who) {
      if (!members[who]) { console.log(`faces: no ${who}`); continue; }
      const R = figureRig({ M: rel.S.M, at, F: rel.S.F, groundRgb: null }), flatV = 0.1 + 0.8 * Math.pow(ringStats(rel.after, ...projectPlate(rel.pj.camera, rel.pj.width, rel.pj.height, [at[0], 1.55, at[2]]), 10, 22).p50 / 100, 1.6);
      const flat = { amb: [flatV, flatV, flatV], ground: [flatV, flatV, flatV] };
      // the play drawer and the portrait each set their own exposure: each size takes the first nudge (one stop
      // either way) that passes; the before rigs get the same allowance, so the comparison is like for like
      const pick = (name, rig, plate, extra) => {
        const tries = NUDGE.map((k) => Object.assign(measure(sp.scene, who, at, rel, [[name, scaleRig(rig, k), plate, extra ? { ...extra, portraitRig: extra.portraitRig && scaleRig(extra.portraitRig, k) } : extra]])[0], { k }));
        if (opt.verbose) for (const a of tries) console.log(`  ${name} k ${a.k}: play ${a.play.range}/${a.play.sep} portrait ${a.portrait.range}/${a.portrait.sep} ground ${a.ground}`);
        const bp = tries.find((a) => a.play.ok) || tries[0], bo = tries.find((a) => a.portrait.ok) || tries[0];
        return { ...bp, portrait: bo.portrait, img: { play: bp.img.play, port: bo.img.port }, nudge: bp.k, nudgeP: bo.k };
      };
      const before = [pick("before", DRAWER_RIG, rel.before, { portraitRig: PORTRAIT_RIG.paraffin.rig })], after = [pick("after", R.rig, rel.after, { touch: R })];
      const rows = [...before, ...after, ...measure(sp.scene, who, at, rel, [["control-flat", flat, rel.after, null]])];
      for (const r of rows) { all.push({ ...r, img: undefined }); console.log(`${r.scene} ${r.who} ${r.rig}${r.nudge ? ` (nudge play ${r.nudge}, portrait ${r.nudgeP})` : ""}: play ${r.play.ok ? "pass" : "FAIL"} (range ${r.play.range}, sep ${r.play.sep}) portrait ${r.portrait.ok ? "pass" : "FAIL"} (range ${r.portrait.range}, sep ${r.portrait.sep})`); }
      for (const r of rows.slice(0, 2)) cells.push({ img: r.img.port, label: `${who} ${r.rig} ${r.portrait.ok ? "OK" : "LOW"} ${r.portrait.range}/${r.portrait.sep}` }, { img: r.img.play, label: `PLAY ${r.play.range}/${r.play.sep}` });
    }
  }
  writeFileSync(join(out, "faces.json"), JSON.stringify(all, null, 1));
  writePng(join(out, "sheet.png"), sheet(cells, { cols: 4, cellW: 256, cellH: 320, title: "FACES: BEFORE AND AFTER (RANGE/SEP L*)" }));
}
