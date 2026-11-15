// The stroke-light terms the painted lead lays strokes from (design/state/light.md): per plate sample, which source
// rules it, its lit side and shadow side, and the terminator band. One row per environment scene: the plate,
// the key's source (each source its own colour, in the key's own light colour), the side split (lit side in the
// key's colour, shadow side in the sky's), and the terminator mask.
//   node game/engine/light/tools/strokelight.mjs [--plates <dir>] [--out <dir>]
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "./png.mjs";
import { sheet } from "./sheet.mjs";
import { stocksReader } from "./stocks.mjs";
import { sceneLight } from "../proof.mjs";
import { keyRgb, KEY_SKY } from "../field.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const root = join(fileURLToPath(import.meta.url), "../../../../.."), plates = opt.plates || join(root, "game/capture/light/plates"), out = opt.out || join(root, "game/capture/light/strokelight");
const SC = [["exchange", "q_exchange", 8.5, "EXCHANGE 08:30"], ["tower", "q_square_wide", 7.8, "TOWER 07:50"], ["tower-train", "q_square_wide_quiet", 6.9, "TOWER TRAIN", 6], ["granary", "q_granary", 23.7, "GRANARY 23:40"], ["haldane", "q_haldane", 7.6, "HALDANE 07:35"], ["furrowe", "q_furrowe_kitchen", 18.6, "FURROWE 18:35"], ["brack", "q_brack_kitchen", 19.1, "BRACK 19:05"]];
const enc = (x) => 255 * Math.pow(Math.max(0, Math.min(1, x)), 1 / 2.2);
const img = (F, fn) => { const d = new Uint8ClampedArray(F.n * 4); for (let i = 0; i < F.n; i++) { const v = Number.isFinite(F.N[i * 3]) ? fn(i) : [10, 9, 12]; d.set([v[0], v[1], v[2], 255], i * 4); } return { width: F.w, height: F.h, data: d }; };
mkdirSync(out, { recursive: true });
const cells = [];
for (const [id, plate, hour, label, t = 0] of SC) {
  const dir = join(plates, plate), pj = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), b = readFileSync(join(dir, "geo-pos.f32"));
  const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(join(dir, "geo-id.u8"))) };
  const L = sceneLight({ pj, geo, read: stocksReader(root, "start"), hour, t }), F = L.S.F, M = L.S.M, R = F.rec, sky = keyRgb(F, M, 0, M.sky).length && M.sky.amb;
  const sk = sky.map((v) => v / (Math.max(...sky) || 1));
  const source = img(F, (i) => { const c = R.key[i] === KEY_SKY ? [0.25, 0.3, 0.45] : keyRgb(F, M, i); const k = 0.25 + 0.75 * Math.min(1, R.keyE[i] / 120); return c.map((v) => enc(v * k)); });
  const side = img(F, (i) => { const s = R.side[i] / 127, c = s > 0 ? keyRgb(F, M, i) : sk; const k = Math.min(1, R.keyE[i] / 60) * Math.abs(s); return c.map((v) => enc(v * (0.12 + 0.88 * k))); });
  const term = img(F, (i) => { const v = R.term[i] * Math.min(1, R.keyE[i] / 40); return [v, v * 0.9, v * 0.7]; });
  const plateImg = readPng(join(dir, `${pj.variants[0]}.png`));
  for (const [k, im] of [["source", source], ["side", side], ["term", term]]) writePng(join(out, `${id}-${k}.png`), im);
  cells.push({ img: plateImg, label: `${label} PLATE` }, { img: source, label: "KEY SOURCE" }, { img: side, label: "LIT / SHADOW SIDE" }, { img: term, label: "TERMINATOR" });
  console.log(`${id}: ${M.lights.length} lights, keys ${[...new Set(R.key)].join(",")}`);
}
writePng(join(out, "sheet.png"), sheet(cells, { cols: 4, cellW: 400, cellH: 250, title: "STROKE LIGHT TERMS: KEY, SIDE, TERMINATOR" }));
