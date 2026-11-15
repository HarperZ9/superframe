// Bounce light proof (light/gi.mjs): each scene relit by the light model without and with the radiance-cascade bounce,
// and the bounce field drawn on the floor plan (the debug view), with the build time.
//   node game/engine/light/tools/gisheet.mjs [--out <dir>] [--k 1]
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "./png.mjs";
import { sheet, scaleTo } from "./sheet.mjs";
import { stocksReader } from "./stocks.mjs";
import { sceneLight } from "../proof.mjs";
import { relightRatio, relightRgba } from "../consume.mjs";
import { bounceField, albedoFrom } from "../gi.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const root = join(fileURLToPath(import.meta.url), "../../../../.."), plates = join(root, "game/capture/light/plates"), out = opt.out || join(root, "game/capture/light/gi"), K = +(opt.k || 1);
mkdirSync(out, { recursive: true });
const SC = [["q_haldane", 7.6, "HALDANE"], ["q_furrowe_kitchen", 18.6, "FURROWE"], ["q_brack_kitchen", 19.1, "BRACK"], ["q_square_wide", 22, "SQUARE NIGHT"]], cells = [];
const enc = (x) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, x)), 1 / 2.2));
for (const [plate, hour, label] of SC) {
  const dir = join(plates, plate), pj = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), b = readFileSync(join(dir, "geo-pos.f32"));
  const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(join(dir, "geo-id.u8"))) };
  const L = sceneLight({ pj, geo, read: stocksReader(root, "start"), hour }), img = readPng(join(dir, `${pj.variants[0]}.png`)), F = L.S.F;
  const t0 = performance.now(), A = albedoFrom(img.data, img.width, img.height, F, L.Ebake), G = bounceField(F, L.S.M, { albedo: A }), ms = performance.now() - t0;
  const En = L.Enow.slice(); for (let i = 0; i < En.length; i++) En[i] += G.bounce[i] * K;
  const before = { width: img.width, height: img.height, data: relightRgba(img.data, img.width, img.height, F, L.ratio, L.emit) };
  const after = { width: img.width, height: img.height, data: relightRgba(img.data, img.width, img.height, F, relightRatio(F, En, L.Ebake, { owners: L.S.owners, gains: L.gains }), L.emit) };
  const g = G.g, dbg = { width: g.w, height: g.h, data: new Uint8ClampedArray(g.w * g.h * 4) }; let mx = 1e-6; for (const v of G.fluence) mx = Math.max(mx, v);
  for (let c = 0; c < g.w * g.h; c++) { for (let k = 0; k < 3; k++) dbg.data[c * 4 + k] = g.wall[c] ? 90 : enc(G.fluence[c * 3 + k] / mx); dbg.data[c * 4 + 3] = 255; }
  cells.push({ img: before, label: `${label} DIRECT` }, { img: after, label: `WITH BOUNCE (${ms.toFixed(0)} MS)` }, { img: scaleTo(dbg, Math.max(1, g.w * 3), Math.max(1, g.h * 3)), label: "BOUNCE FIELD, TOP DOWN" });
  writePng(join(out, `${plate}-after.png`), after); console.log(plate, `${g.w}x${g.h} cells, ${ms.toFixed(0)} ms`);
}
writePng(join(out, "sheet.png"), sheet(cells, { cols: 3, cellW: 480, cellH: 300, title: "BOUNCE LIGHT: RADIANCE CASCADES ON THE FLOOR PLAN" }));
