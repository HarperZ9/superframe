// Authored spots against the ground (coordinator, 2026-10-17): every area's spawn, every exit's
// spawn and every figure's spot, judged on the plate's hardened ground (world/plateworld.mjs: props
// closed, tops closed, a body's margin). A spot in or on a prop is moved by the game to the nearest
// clear floor; this lists each such spot with where it goes, for the director, who owns the marks.
// A spot in a void (no ground seen, such as behind the bar counter) stays and is listed as such.
//   node tools/marks-check.mjs [act1/act1.lwd ...]   (default: the three acts with the wiring)
import { readFile } from "node:fs/promises";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent } from "../game.mjs";
import { plateArena } from "../combat/sim/plate.mjs";
import { hardenGround, spotKind, clearSpot, GROUND_CELL } from "../world/plateworld.mjs";

const ROOT = new URL("../../../content/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const ENGINE = new URL("../", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const acts = process.argv.slice(2).length ? process.argv.slice(2) : ["act1/act1.lwd", "act2/act2.lwd", "act3/act3.lwd"];
const WIRING = { "act1/act1.lwd": "wiring/act1-areas.lwd" };
const plates = new Map();
async function ground(name) {
  if (plates.has(name)) return plates.get(name);
  const dir = `${ROOT}${name}/`, place = JSON.parse(await readFile(`${dir}place.json`, "utf8"));
  const [p, i] = await Promise.all([readFile(`${dir}geo-pos.f32`), readFile(`${dir}geo-id.u8`)]);
  const pos = new Float32Array(p.buffer, p.byteOffset, p.byteLength / 4), ids = new Uint8Array(i.buffer, i.byteOffset, i.byteLength);
  const A = plateArena(place, pos, ids, { cell: GROUND_CELL, datum: place.datum || null }); hardenGround(A, place, pos, ids, { margin: "soft" });
  plates.set(name, A); return A;
}
const f2 = (p) => p.map((v) => (+v).toFixed(2)).join(" ");
let moved = 0, total = 0;
for (const act of acts) {
  const { sources } = await loadAct(ROOT + act, (p) => readFile(p, "utf8"));
  if (WIRING[act]) sources.push({ file: WIRING[act], text: await readFile(ENGINE + WIRING[act], "utf8") });
  const C = loadContent(sources);
  for (const a of Object.values(C.map.areas)) {
    if (!a.plate) continue;
    let A; try { A = await ground(a.plate); } catch (e) { console.log(`${a.id}: plate ${a.plate} not readable (${e.message})`); continue; }
    const spots = [["spawn", a.spawn, a.line], ...a.exits.filter((x) => x.spawnAt).map((x) => [`exit spawn "${x.label}"`, x.spawnAt, x.line]), ...a.figures.map((f) => [`figure ${f.id}`, f.at, f.line])];
    for (const [what, at, line] of spots) {
      total++;
      const k = spotKind(A, at);
      if (k === "clear") continue;
      if (k === "void") { console.log(`${a.file}:${line}  ${a.id} ${what} at ${f2(at)}: no ground seen there (behind a prop or off the plate); stays`); continue; }
      const to = clearSpot(A, at, 2, { strict: true }) || clearSpot(A, at);
      moved++; console.log(`${a.file}:${line}  ${a.id} ${what} at ${f2(at)}: ${k === "margin" ? "against a prop" : `in a ${k}`}; the game stands it at ${f2(to)} (${Math.hypot(to[0] - at[0], to[2] - at[2]).toFixed(2)} m)`);
    }
  }
}
console.log(`\n${moved} of ${total} authored spots move clear of props.`);
