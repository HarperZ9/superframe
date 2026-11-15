// Play-size figures for the head contact sheets: every named person standing in idle, drawn through
// the same path as the portraits (gbuffer, the painter, relight) at the game's figure scale, so the
// sheet shows what a head reads as at the size a player sees it.
//   node proto/heads_play.mjs <outdir> <ppm> [who,who,...]
// ppm is screen pixels per vertical metre at the figure: about 70 at 1280 x 720 on the quay plates
// (Wenna measured 105 px for 1.52 m in game/capture/act2-areas-2026-10-21/03-mole.png), 105 at 1080p.
// Camera: the plate camera's 26 degrees of yaw and 30 of elevation (runtime/fightdrawer.mjs).
// Writes <outdir>/<who>.png (straight alpha) and <outdir>/play.json (the box and the scale).
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { gbuffer } from "../render/figure.mjs";
import { paintFigure, relight } from "../render/painted.mjs";
import { down } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { roster } from "./heads_roster.mjs";

const [outArg, ppmArg = "70", only] = process.argv.slice(2);
if (!outArg) throw new Error("usage: node proto/heads_play.mjs <outdir> <ppm> [who,...]");
const ppm = +ppmArg, members = await roster(), who = only ? only.split(",") : Object.keys(members);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const rig = { amb: [0.13, 0.09, 0.08], ground: [0.05, 0.03, 0.03], key: { dir: [-0.6, 0.25, 0.76], c: [1.1, 0.8, 0.5], wrap: 0.3 }, fill: { dir: [0.7, 0.1, 0.3], c: [0.12, 0.1, 0.16], wrap: 0.5 }, fresnel: { c: [0.18, 0.12, 0.08], pow: 3 } };
const boxM = [1.2, 2.6], W = Math.round(boxM[0] * ppm), H = Math.round(boxM[1] * ppm);
mkdirSync(outArg, { recursive: true });
for (const w of who) {
  const C = { ...members[w] }, a = createCast({ timing, members: { [w]: C } }).actor(w, { facing: 0 });
  a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
  const pose = a.pose(), view = { yawDeg: 26, elevDeg: 30, height: boxM[1], centre: [0, 1.2, 0] };
  const { G } = gbuffer([{ C, pose, facing: 0, tool: C.info?.tool }], view, W, H, 2, rig);
  const F = paintFigure(G, C.palette || {}, { rig, seed: 5 }), r = down(relight(G, F, rig, C.palette || {}, null), G.w, G.h, 2);
  writePng(`${outArg}/${w}.png`, { width: r.w, height: r.h, data: toRgba8(r.rgba, r.w, r.h) });
  console.log("play", w, r.w, "x", r.h);
}
writeFileSync(`${outArg}/play.json`, JSON.stringify({ ppm, box_m: boxM, px: [W, H], camera: { yawDeg: 26, elevDeg: 30 } }, null, 1));
