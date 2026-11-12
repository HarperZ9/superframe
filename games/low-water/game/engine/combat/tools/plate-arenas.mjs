// Builds every plate's fight ground and writes what was found, plus the numbers an overlay needs
// to check it against the painting (tools/plate-overlay.py draws them on the plate).
//   node tools/plate-arenas.mjs   -> out/plates/<plate>.json, and a summary on stdout
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlateArena, PLATE_OF } from "../data/plates.mjs";

const here = dirname(fileURLToPath(import.meta.url)), CONTENT = join(here, "..", "..", "..", "..", "content"), out = join(here, "..", "out", "plates");
mkdirSync(out, { recursive: true });
for (const [area, plate] of Object.entries(PLATE_OF)) {
  if (!existsSync(join(CONTENT, plate, "place.json"))) { console.log(area, "no plate"); continue; }
  const A = await loadPlateArena(CONTENT, plate);
  const { w, h, cells } = A.grid, open = cells.filter(Boolean).length;
  const place = JSON.parse(readFileSync(join(CONTENT, plate, "place.json"), "utf8"));
  // an affine fit from world (x, y, z) to plate pixels, from the geometry itself (orthographic)
  const fit = affine(place, CONTENT, plate);
  writeFileSync(join(out, `${plate}.json`), JSON.stringify({ area, plate, cell: A.cell, origin: A.origin, w, h, cells: cells.map((c) => (c ? [c.surface[0], +c.h.toFixed(2)] : 0)), spawns: A.spawns, anchors: A.anchors, lights: A.lights, exits: A.exits, fit }));
  console.log(area, plate, `${w}x${h} cells, ${open} walkable (${(open * A.cell * A.cell).toFixed(0)} m2)`, "lamb", A.spawns.lamb.map((v) => +v.toFixed(1)), "foes", A.spawns.foes.length, "lights", A.lights.length, "tidal", !!A.water);
}

function affine(place, dir, plate) {
  const pos = new Float32Array(readFileSync(join(dir, plate, "geo-pos.f32")).buffer.slice(0)), gw = Math.round(place.width * place.geoScale), gh = Math.round(place.height * place.geoScale), s = place.width / gw;
  const rows = [];
  for (let k = 0; k < 4000; k++) { const gx = (k * 7919) % gw, gy = (k * 104729) % gh, i = (gy * gw + gx) * 3; if (isFinite(pos[i]) && Math.abs(pos[i]) < 500) rows.push([pos[i], pos[i + 1], pos[i + 2], gx * s, gy * s]); }
  const solve = (col) => lsq(rows.map((r) => [r[0], r[1], r[2], 1]), rows.map((r) => r[col]));
  return { u: solve(3), v: solve(4) };
}

// least squares for 4 unknowns (normal equations, Gauss elimination)
function lsq(X, y) {
  const n = 4, A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  for (let r = 0; r < X.length; r++) for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += X[r][i] * X[r][j]; A[i][n] += X[r][i] * y[r]; }
  for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]; for (let k = 0; k < n; k++) if (k !== i) { const f = A[k][i] / A[i][i]; for (let j = i; j <= n; j++) A[k][j] -= f * A[i][j]; } }
  return A.map((row, i) => row[n] / row[i]);
}
