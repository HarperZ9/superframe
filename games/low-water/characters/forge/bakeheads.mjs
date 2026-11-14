// Bake every head sheet to .lwmesh at three levels of detail, with its curvature, thickness and
// cavity maps in the same file (forge/meshio.mjs maps), head-local metres.
//   node forge/bakeheads.mjs [who,who,...] [lane]      runs at Idle priority
// Writes characters/forged/heads/<who>-<lod>.lwmesh and characters/forged/heads/report.json (with a
// lane name, report-<lane>.json, so lanes can run side by side; node forge/bakeheads.mjs --merge joins them).
import os from "node:os";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { headAlone } from "./heads.mjs";
import { bakeMaps } from "./maps.mjs";
import { packMesh, unpackMesh } from "./meshio.mjs";
import { SHEETS } from "./heads.cast.mjs";
import { roster } from "../proto/heads_roster.mjs";
try { os.setPriority(0, os.constants.priority.PRIORITY_LOW); } catch (e) { console.error("could not set Idle priority:", e.message); }
import { readdirSync } from "node:fs";
const [only, lane] = process.argv.slice(2), dir = new URL("../forged/heads/", import.meta.url); mkdirSync(dir, { recursive: true });
if (only === "--merge") {
  const all = {}; for (const f of readdirSync(dir).filter((f) => /^report(-.+)?\.json$/.test(f)).sort()) Object.assign(all, JSON.parse(readFileSync(new URL(f, dir), "utf8")));
  const sorted = Object.fromEntries(Object.keys(SHEETS).filter((k) => all[k]).map((k) => [k, all[k]]));
  writeFileSync(new URL("report.json", dir), JSON.stringify(sorted, null, 1)); console.log("merged", Object.keys(sorted).length, "heads"); process.exit(0);
}
const members = await roster(), repPath = new URL(lane ? `report-${lane}.json` : "report.json", dir), report = existsSync(repPath) ? JSON.parse(readFileSync(repPath, "utf8")) : {};
for (const id of only ? only.split(",") : Object.keys(SHEETS)) {
  report[id] = {};
  for (const lod of ["far", "mid", "near"]) {
    const t0 = Date.now(), { M, model, stats } = headAlone(id, members[id].P, { lod }), t1 = Date.now();
    const maps = bakeMaps({ pos: M.pos, nrm: M.nrm, tri: M.tri }, model.F.d), t2 = Date.now();
    const meta = { id, lod, s: +model.s.toFixed(4), cell: model.cell, crown: model.crown, chin: model.chin, dropped: model.dropped, idea: SHEETS[id].idea, neck: SHEETS[id].neck, collar: SHEETS[id].collar };
    const buf = packMesh({ M, grips: null, hands: null, tool: null, meta }, maps), back = unpackMesh(buf, null);
    if (back.M.tri.length !== M.tri.length || back.maps.cavity.length !== M.pos.length / 3) throw new Error(`bake ${id} ${lod}: round trip lost data`);
    writeFileSync(new URL(`${id}-${lod}.lwmesh`, dir), new Uint8Array(buf));
    const q = (a) => { const s = Float32Array.from(a).sort(); return [s[Math.floor(s.length * 0.05)], s[Math.floor(s.length * 0.5)], s[Math.floor(s.length * 0.95)]].map((v) => +v.toFixed(4)); };
    report[id][lod] = { triangles: M.tri.length / 3, vertices: M.pos.length / 3, mb: +(buf.byteLength / 1e6).toFixed(2), sculpt_ms: t1 - t0, maps_ms: t2 - t1, evaluated: stats.evaluated, dropped: model.dropped, curvature_p5_p50_p95: q(maps.curvature), thickness_p5_p50_p95: q(maps.thickness), cavity_p5_p50_p95: q(maps.cavity) };
    console.log(id, lod, report[id][lod].triangles, "tris", report[id][lod].sculpt_ms, "+", report[id][lod].maps_ms, "ms");
  }
  writeFileSync(repPath, JSON.stringify(report, null, 1));
}
