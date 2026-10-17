// Which painted plate each encounter area fights on, and whether the sea reaches it. The shell
// (or a node tool) loads a plate's place.json, geo-pos.f32 and geo-id.u8, builds the arena with
// sim/plate.mjs plateArena(), and hands it to G.ext.combat.usePlate(area, arena); an area with
// no plate handed over fights on its placeholder arena (data/arenas.mjs, arenas2.mjs).
import { PLATE_DATUM } from "../sim/plate.mjs";

export const PLATE_OF = {
  floor: "floor", quay: "quay", weigh: "weigh", lamp: "lamp", brine: "brine", gut: "gut",
  hill: "station", spit: "spit", gasholder: "gasholder", ropewalk: "ropewalk", mole: "mole", office: "office",
};

// Plates the tide reaches (the prototype's mapping, game/night.mjs; to move into place.json).
export const TIDAL = { floor: PLATE_DATUM, quay: PLATE_DATUM, mole: PLATE_DATUM, spit: PLATE_DATUM };

// Read a plate from disk (node only: tests and tools) and build its arena.
export async function loadPlateArena(contentDir, plate, opts = {}) {
  const { readFile } = await import("node:fs/promises");
  const { plateArena } = await import("../sim/plate.mjs");
  const dir = `${contentDir}/${plate}`;
  const place = JSON.parse(await readFile(`${dir}/place.json`, "utf8"));
  const [p, i] = await Promise.all([readFile(`${dir}/geo-pos.f32`), readFile(`${dir}/geo-id.u8`)]);
  const pos = new Float32Array(p.buffer, p.byteOffset, p.byteLength / 4), ids = new Uint8Array(i.buffer, i.byteOffset, i.byteLength);
  return plateArena(place, pos, ids, { datum: TIDAL[plate] || null, fight: (place.marks || {}).fight || null, ...opts });
}
