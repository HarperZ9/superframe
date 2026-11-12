import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const rn = (p) => new URL("../../../../../../native/" + p, import.meta.url).href;
const { isoCamera, project } = await import(rn("web/shaders/paintover/camera.mjs"));
const { makeWorld, findPath, passable, GRID, ROOMS, HOTSPOTS, ROOM_HOTSPOTS } = await import("../world.mjs");
for (const name of ["quay", "brine", "weigh", "lamp"]) {
  const dir = `../../content/${name}`, info = JSON.parse(readFileSync(new URL(`${dir}/place.json`, import.meta.url)));
  const pos = new Float32Array(readFileSync(new URL(`${dir}/geo-pos.f32`, import.meta.url)).buffer.slice(0)), ids = new Uint8Array(readFileSync(new URL(`${dir}/geo-id.u8`, import.meta.url)));
  const w = makeWorld({ W: info.width, H: info.height, pos, ids, camera: isoCamera(info.camera), project, grid: name === "quay" ? GRID : ROOMS[name].grid, walk: info.walk, gully: name === "quay" });
  const rules = { waterY: name === "quay" ? -3.36 : -99, floorClosed: false, gullyDeep: false }, start = name === "quay" ? [-1.2, 0, -2.6] : ROOMS[name].spawn;
  let filled = 0; for (const v of w.height) if (!isNaN(v)) filled++;
  const [sx, sz] = w.cellOf(start[0], start[2]);
  console.log(name, "walk cells", filled, "start passable", passable(w, sx, sz, rules), "h", w.groundAt(start[0], start[2]));
  for (const h of (name === "quay" ? HOTSPOTS : ROOM_HOTSPOTS[name])) { const p = findPath(w, start, h.at, rules); const [gx, gz] = w.cellOf(h.at[0], h.at[2]); console.log("  ", h.id, p ? `path ${p.length}` : "NO PATH", "target passable", passable(w, gx, gz, rules), "h", w.groundAt(h.at[0], h.at[2])); }
}
