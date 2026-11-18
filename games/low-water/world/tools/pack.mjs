// Pack a generated world into binary tiles (world/tiles.mjs says what they hold).
//   node games/low-water/world/tools/pack.mjs [--world games/low-water/world/out/20261118]
// Reads the generator's six text rasters and writes <world>/tiles/. The traversal reads the
// tiles when they are there and the text when they are not.
// Debt: the generator is BuildLang and should write this form itself; buildc's file writer takes
// strings and a string cannot hold a zero byte, so until it can, this step is JavaScript.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePgm } from "../pgm.mjs";
import { packWorld, WIDE, BYTE } from "../tiles.mjs";

const here = dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2), at = argv.indexOf("--world");
const dir = at >= 0 ? argv[at + 1] : join(here, "..", "out", "20261118"), t0 = performance.now();
const json = JSON.parse(await readFile(join(dir, "world.json"), "utf8")), codes = {}; let text = 0;
for (const name of [...WIDE, ...BYTE]) { const raw = await readFile(join(dir, `${name}.pgm`)); text += raw.length; codes[name] = parsePgm(raw).data; }
const files = await packWorld(codes, json.width, json.height);
await mkdir(join(dir, "tiles"), { recursive: true });
let bytes = 0;
for (const [name, body] of Object.entries(files)) { await writeFile(join(dir, "tiles", name), body); bytes += body.length; }
console.log(`packed ${json.width} x ${json.height} cells into ${Object.keys(files).length - 2} tiles and an overview: ${(bytes / 1e6).toFixed(2)} MB (the text rasters are ${(text / 1e6).toFixed(1)} MB), in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
