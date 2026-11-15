// Halftone proof: the night square and the granary's light as a dot screen (light/halftone.mjs).
//   node game/engine/light/tools/halftonesheet.mjs [out.png]
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(fileURLToPath(import.meta.url), "../../../../..");
import { readFileSync } from "node:fs";
import { stocksReader } from "./stocks.mjs";
import { sceneLight } from "../proof.mjs";
import { halftoneRgba } from "../halftone.mjs";
import { writePng } from "./png.mjs";
import { sheet } from "./sheet.mjs";
const cells = [];
for (const [plate, hour] of [["q_square_wide", 22], ["q_granary", 23.7]]) {
  const dir = join(root, "game/capture/light/plates", plate), pj = JSON.parse(readFileSync(dir + "/place.json")), b = readFileSync(dir + "/geo-pos.f32");
  const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(dir + "/geo-id.u8")) };
  const L = sceneLight({ pj, geo, read: stocksReader(root, "start"), hour });
  cells.push({ img: halftoneRgba(L.S.F, L.Enow, pj.width, pj.height, { cell: 6 }), label: `${plate.toUpperCase()} HALFTONE OF THE LIGHT` });
}
writePng(process.argv[2] || join(root, "game/capture/light/halftone/sheet.png"), sheet(cells, { cols: 2, cellW: 640, cellH: 400, title: "HALFTONE FALLOFF FROM THE IRRADIANCE TERM" }));
