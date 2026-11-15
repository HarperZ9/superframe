// Painted-style proof of the light model: each Quota slice plate as baked (before) and relit by the model
// (after) for the scene's clock, street state and moving lights, through the reference consumer
// (consume.mjs relight). Writes each pair and a contact sheet.
//   node game/engine/light/tools/oilsheet.mjs --plates <dir with q_*/ bakes> --out <dir> [--only id,...]
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "./png.mjs";
import { sheet } from "./sheet.mjs";
import { stocksReader } from "./stocks.mjs";
import { sceneLight } from "../proof.mjs";
import { relightRgba } from "../consume.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const root = join(fileURLToPath(import.meta.url), "../../../../.."), plates = opt.plates || join(root, "render/preview/v2"), out = opt.out || join(root, "game/capture/light/oil");
// the proof scenes: plate, the clock to show, the street state, the time (s) for flicker and the train
export const SCENES = [
  { id: "square-dawn", plate: "q_square_wide", hour: 7.8, state: "start", label: "SQUARE 07:50 DAWN" },
  { id: "square-night", plate: "q_square_wide", hour: 22.0, state: "start", label: "SQUARE 22:00 NIGHT" },
  { id: "square-night-after", plate: "q_square_wide", hour: 22.0, state: "after", label: "SQUARE 22:00 WEEK AFTER" },
  { id: "square-blue", plate: "q_square_wide", hour: 17.1, state: "start", label: "SQUARE 17:05 BLUE HOUR" },
  { id: "train-a", plate: "q_square_wide_quiet", hour: 6.9, state: "start", t: 6, label: "TRAIN 06:55 T=6S" },
  { id: "train-b", plate: "q_square_wide_quiet", hour: 6.9, state: "start", t: 13, label: "TRAIN 06:55 T=13S" },
  { id: "kitchen-haldane", plate: "q_haldane", hour: 7.6, state: "start", label: "HALDANE 07:35 EMBERS" },
  { id: "kitchen-haldane-after", plate: "q_haldane", hour: 7.6, state: "after", label: "HALDANE WEEK AFTER" },
  { id: "kitchen-furrowe", plate: "q_furrowe_kitchen", hour: 18.6, state: "start", label: "FURROWE 18:35 STOVE" },
  { id: "kitchen-brack", plate: "q_brack_kitchen", hour: 19.1, state: "start", label: "BRACK 19:05 STOVE" },
  { id: "granary", plate: "q_granary", hour: 23.7, state: "start", label: "GRANARY 23:40 LAMP" },
];
function load(dir) {
  const pj = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), b = readFileSync(join(dir, "geo-pos.f32"));
  return { pj, geo: { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(join(dir, "geo-id.u8"))) } };
}
export function relitScene(sc, { plates: P = plates } = {}) {
  const dir = join(P, sc.plate), { pj, geo } = load(dir), img = readPng(join(dir, `${pj.variants[0]}.png`));
  const L = sceneLight({ pj, geo, read: stocksReader(root, sc.state), hour: sc.hour, t: sc.t ?? 0 });
  return { ...L, pj, before: img, after: { width: img.width, height: img.height, data: relightRgba(img.data, img.width, img.height, L.S.F, L.ratio, L.emit) } };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(out, { recursive: true });
  const only = opt.only ? opt.only.split(",") : null, cells = [];
  for (const sc of SCENES) {
    if (only && !only.includes(sc.id)) continue; const t0 = Date.now(), r = relitScene(sc);
    writePng(join(out, `${sc.id}-before.png`), r.before); writePng(join(out, `${sc.id}-after.png`), r.after);
    const on = r.S.M.lights.filter((L) => L.decay.on).length;
    console.log(`${sc.id}: ${r.S.M.lights.length} lights (${on} burning, ${r.S.M.lights.filter((L) => L.generated).length} windows found), ${r.dyn.length} moving, ${Date.now() - t0} ms`);
    cells.push({ img: r.before, label: `${sc.label} BEFORE` }, { img: r.after, label: `${sc.label} AFTER` });
  }
  writePng(join(out, "sheet.png"), sheet(cells, { cols: 2, cellW: 640, cellH: 380, title: "LIGHT MODEL: PAINTED REFERENCE RELIGHT" }));
}
