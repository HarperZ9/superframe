import { loadPlate, ppmAt } from "../render/plate.mjs";
const [name, ...pts] = process.argv.slice(2), p = loadPlate(name);
for (const s of pts) { const v = s.split(",").map(Number); const q = p.project(v); console.log(s, "->", q.map((x) => x.toFixed(0)).join(","), "ppm", ppmAt(p, v).toFixed(1), "plate depth there", p.depth[Math.round(q[1]) * p.W + Math.round(q[0])]?.toFixed(2), "fig depth", ((v[0] - p.cam.pos[0]) * p.cam.fwd[0] + (v[1] - p.cam.pos[1]) * p.cam.fwd[1] + (v[2] - p.cam.pos[2]) * p.cam.fwd[2]).toFixed(2)); }
