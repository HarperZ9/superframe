// Camera and era post, proof: the painted frame (the plate relit by the light model) and the glyph frame (from
// glyphfx.mjs, cropped to the plate) each through depth of field (the narrow lens: the Haldane table), the haze ramp
// (the wide lens), the five era looks on the square, and the three ink-blot variants half way; one sheet.
//   node game/engine/fx/tools/postsheet.mjs [--out <dir>]
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "../../light/tools/png.mjs";
import { camBasis } from "../../world/plateworld.mjs";
import { sheet } from "../../light/tools/sheet.mjs";
import { stocksReader } from "../../light/tools/stocks.mjs";
import { sceneLight } from "../../light/proof.mjs";
import { relightRgba } from "../../light/consume.mjs";
import { dof, hazeRamp, eraPost } from "../post.mjs";
import { applyTransition } from "../transitions.mjs";
import { loosen, ghost } from "../dream.mjs";
import { grain, blueHourSky, godRays, hazePlanes, valleyFog, skyMirror, bleach } from "../air.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const root = join(fileURLToPath(import.meta.url), "../../../../.."), plates = join(root, "game/capture/light/plates"), out = opt.out || join(root, "game/capture/fx/post"), gdir = join(root, "game/capture/fx/glyph");
mkdirSync(out, { recursive: true });
function scene(plate, hour, terms = null) {
  const dir = join(plates, plate), pj = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), b = readFileSync(join(dir, "geo-pos.f32"));
  const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(join(dir, "geo-id.u8"))) };
  const L = sceneLight({ pj, geo, read: stocksReader(root, "start"), hour, terms }), img = readPng(join(dir, `${pj.variants[0]}.png`));
  L.S.F.camB = camBasis(pj.camera); return { F: L.S.F, M: L.S.M, oil: { width: img.width, height: img.height, data: relightRgba(img.data, img.width, img.height, L.S.F, L.ratio, L.emit) } };
}
const copy = (im) => ({ width: im.width, height: im.height, data: im.data.slice() });
const crop = (im, W, H) => { const d = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) d.set(im.data.subarray(y * im.width * 4, (y * im.width + W) * 4), y * W * 4); return { width: W, height: H, data: d }; };
const glyphOf = (id, W, H) => { const f = join(gdir, `${id}-after.png`); return existsSync(f) ? crop(readPng(f), W, H) : null; };
const cells = [], add = (img, label) => { if (img) cells.push({ img, label }); };
// the narrow lens: depth of field at the table
const hal = scene("q_haldane", 7.6), hg = glyphOf("haldane", hal.oil.width, hal.oil.height);
add(hal.oil, "HALDANE OIL"); const focus = 19.1; add(dof(copy(hal.oil), hal.F, { focus, range: 0.5, max: 9 }), "OIL DEPTH OF FIELD"); add(hg, "GLYPH"); add(hg && dof(copy(hg), hal.F, { focus, range: 0.5, max: 9 }), "GLYPH DEPTH OF FIELD");
// the wide lens: the haze ramp
const sq = scene("q_square_wide", 7.8), sg = glyphOf("square-dawn-snow", sq.oil.width, sq.oil.height);
add(sq.oil, "SQUARE OIL"); add(hazeRamp(copy(sq.oil), sq.F, { k: 1.6 }), "OIL HAZE RAMP"); add(sg, "GLYPH"); add(sg && hazeRamp(copy(sg), sq.F, { k: 1.6, col: [0.18, 0.2, 0.26] }), "GLYPH HAZE RAMP");
// the era looks, painted and glyph
for (const [era, name] of [[1, "ERA 1 VARNISH"], [2, "ERA 2 FROST, SCRAPED"], [3, "ERA 3 REGISTRATION"], [4, "ERA 4 TUBE AND GRAIN"], [5, "ERA 5 SODIUM, CLIP"]]) {
  add(eraPost(copy(sq.oil), era, { t: 1.3, clip: era === 5 }), `OIL ${name}`); add(sg && eraPost(copy(sg), era, { t: 1.3, clip: era === 5 }), `GLYPH ${name}`);
}
// a dream at the Haldane table: the frame coming loose, the week after showing through as a ghost underpainting
const halAfter = (() => { const dir = join(plates, "q_haldane"), pj = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), b = readFileSync(join(dir, "geo-pos.f32")); const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(join(dir, "geo-id.u8"))) }; const L = sceneLight({ pj, geo, read: stocksReader(root, "dark"), hour: 17.2 }), img = readPng(join(dir, `${pj.variants[0]}.png`)); return { width: img.width, height: img.height, data: relightRgba(img.data, img.width, img.height, L.S.F, L.ratio, L.emit) }; })();
const hgd = glyphOf("dream", hal.oil.width, hal.oil.height);
add(ghost(loosen(copy(hal.oil), 0.5, 1.2), halAfter, 0.55), "OIL DREAM: LOOSE, THE WEEK AFTER UNDER"); add(hgd && loosen(copy(hgd), 0.5, 1.2), "GLYPH DREAM: LOOSE, MARKS AHEAD");
// the air (sections 13 and 14): grain by era, the blue hour, rays from a low sun, haze in planes, valley fog, the sky in
// flooded ground, the bleached memory
const blue = scene("q_square_wide", 17.3), gold = scene("q_square_wide", 8.2), fog = scene("q_square_wide", 7.4), wet = scene("q_square_wide", 16.6, { rain: 0.9, snow: 0.3 });
add(grain(copy(sq.oil), { era: 2, t: 1 }), "GRAIN, ERA 2"); add(grain(copy(sq.oil), { era: 5, t: 1 }), "GRAIN, ERA 5 (HEAVIEST)");
add(blueHourSky(copy(blue.oil), blue.F, blue.M.sky), "BLUE HOUR SKY, SILHOUETTES"); add(godRays(copy(gold.oil), gold.F, gold.M.sky, { k: 0.6 }), "RAYS FROM A LOW SUN, 08:10");
add(hazePlanes(copy(sq.oil), sq.F, sq.M.sky, { k: 1.4 }), "HAZE IN PLANES"); add(valleyFog(copy(fog.oil), fog.F, fog.M.sky, { k: 0.7 }), "VALLEY FOG, 07:25");
add(skyMirror(copy(wet.oil), wet.F, wet.M.sky), "THE SKY IN THE FLOODED GROUND"); add(bleach(copy(sq.oil), { hue: 15, keep: 25 }), "BLEACHED, ONE HUE KEPT (MEMORY)");
// the ink-blot variants half way, square to granary
const gr = scene("q_granary", 23.7), next = { width: sq.oil.width, height: sq.oil.height, data: crop({ ...gr.oil, width: gr.oil.width }, sq.oil.width, sq.oil.height).data };
for (const n of ["bleed", "burn", "pageTurn"]) add(applyTransition(sq.oil, next, n, 0.5), `INK ${n.toUpperCase()} U=0.5`);
writePng(join(out, "sheet.png"), sheet(cells, { cols: 4, cellW: 480, cellH: 290, title: "CAMERA AND ERA POST, BOTH STYLES" }));
console.log(`postsheet: ${cells.length} cells`);
