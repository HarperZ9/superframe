// Bake a sheet's meshes for every level of detail: node forge/bake.mjs <sheet name>
// Writes characters/forged/<name>-<lod>.lwmesh (the runtime and the portrait bake load these).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { forged } from "./compile.mjs";
import { packMesh, unpackMesh } from "./meshio.mjs";
const name = process.argv[2] || "keel", sheet = JSON.parse(readFileSync(new URL(`../sheets/${name}.json`, import.meta.url), "utf8"));
const base = sheet.base ? { ...(await import(`../cast/${sheet.base}.mjs`)) } : null, F = forged(sheet, base), dir = new URL("../forged/", import.meta.url); mkdirSync(dir, { recursive: true });
for (const lod of ["far", "mid", "near"]) {
  const t = Date.now(), built = F.build({ lod }), buf = packMesh(built), back = unpackMesh(buf, F.P);
  if (back.M.tri.length !== built.M.tri.length) throw new Error("lwmesh round trip lost triangles");
  writeFileSync(new URL(`${name}-${lod}.lwmesh`, dir), new Uint8Array(buf));
  console.log(name, lod, built.M.tri.length / 3, "triangles", (buf.byteLength / 1e6).toFixed(2), "MB", Date.now() - t, "ms");
}
