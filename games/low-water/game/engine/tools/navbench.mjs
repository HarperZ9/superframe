#!/usr/bin/env node
// Paths on the plates: grid A* (world/plateworld.mjs findPath) against A* on the visibility graph
// (world/visgraph.mjs), over the same random pairs of open floor on each plate. Reports expansions,
// path length and time for each, and how often the graph's path is as short (within 2%).
//   node tools/navbench.mjs [--pairs 200] [--plates quay,brine,...] [--seed 1]
import { readFileSync } from "node:fs";
import { plateArena } from "../combat/sim/plate.mjs";
import { hardenGround, findPath } from "../world/plateworld.mjs";
import { findPathVG, visGraph, pathLength } from "../world/visgraph.mjs";

const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1];
const ROOT = new URL("../../../content/", import.meta.url), PAIRS = +(opt.pairs || 200);
const PLATES = (opt.plates || "quay,brine,gut,mole,weigh,floor,hall,ropewalk,gasholder,station").split(",");
let seed = +(opt.seed || 1); const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const ms = () => performance.now();
const rows = [];
for (const name of PLATES) {
  let A;
  try {
    const dir = new URL(`${name}/`, ROOT), place = JSON.parse(readFileSync(new URL("place.json", dir), "utf8"));
    const p = readFileSync(new URL("geo-pos.f32", dir)), i = readFileSync(new URL("geo-id.u8", dir));
    const pos = new Float32Array(p.buffer, p.byteOffset, p.byteLength / 4), ids = new Uint8Array(i.buffer, i.byteOffset, i.byteLength);
    A = plateArena(place, pos, ids, { cell: 0.25, datum: place.datum || null }); hardenGround(A, place, pos, ids, { margin: "soft" });
  } catch (e) { console.error(`${name}: plate not readable: ${e.message}`); continue; }
  const open = []; for (let r = 0; r < A.grid.h; r++) for (let c = 0; c < A.grid.w; c++) { const x = A.grid.cells[r * A.grid.w + c]; if (x && !x.margin) open.push([A.origin[0] + (c + 0.5) * A.cell, A.origin[1] + (r + 0.5) * A.cell]); }
  if (open.length < 2) continue;
  const g = visGraph(A);
  const R = { plate: name, cells: open.length, nodes: g.nodes.length, edges: g.edges, buildMs: +g.ms.toFixed(1), n: 0, gridExp: 0, vgExp: 0, gridMs: 0, vgMs: 0, gridLen: 0, vgLen: 0, asShort: 0, bothFound: 0, straight: 0, gridOnly: 0, vgOnly: 0, bentGrid: 0, bentVg: 0 };
  for (let k = 0; k < PAIRS; k++) {
    const a = open[Math.floor(rnd() * open.length)], b = open[Math.floor(rnd() * open.length)];
    const sg = {}, sv = {};
    let t = ms(); const pg = findPath(A, a, b, { stats: sg }); R.gridMs += ms() - t;
    t = ms(); const pv = findPathVG(A, a, b, { stats: sv, fallback: false }); R.vgMs += ms() - t;
    R.n++;
    if (pg && !pv) R.gridOnly++; if (pv && !pg) R.vgOnly++;
    if (!pg || !pv) continue;
    R.bothFound++; if (sv.expanded === 0) R.straight++; else { R.bentGrid += sg.expanded || 0; R.bentVg += sv.expanded; }
    const lg = pathLength(a, pg), lv = pathLength(a, pv);
    R.gridExp += sg.expanded || 0; R.vgExp += sv.expanded || 0; R.gridLen += lg; R.vgLen += lv; if (lv <= lg * 1.02) R.asShort++;
  }
  rows.push(R);
  console.log(`${name.padEnd(10)} cells ${String(R.cells).padStart(6)}  graph ${R.nodes} nodes ${R.edges} edges (${R.buildMs} ms)  pairs ${R.bothFound}/${R.n} (${R.straight} straight)  expansions grid ${(R.gridExp / R.bothFound).toFixed(0)} vs graph ${(R.vgExp / R.bothFound).toFixed(1)}  length grid ${(R.gridLen / R.bothFound).toFixed(2)} m vs graph ${(R.vgLen / R.bothFound).toFixed(2)} m  as short ${R.asShort}/${R.bothFound}  found by one only: grid ${R.gridOnly}, graph ${R.vgOnly}  time grid ${(R.gridMs / R.n).toFixed(2)} ms vs graph ${(R.vgMs / R.n).toFixed(2)} ms`);
}
const T = rows.reduce((a, r) => ({ ge: a.ge + r.gridExp, ve: a.ve + r.vgExp, n: a.n + r.bothFound, s: a.s + r.asShort, gl: a.gl + r.gridLen, vl: a.vl + r.vgLen, bg: a.bg + r.bentGrid, bv: a.bv + r.bentVg, nb: a.nb + r.bothFound - r.straight, go: a.go + r.gridOnly, vo: a.vo + r.vgOnly }), { ge: 0, ve: 0, n: 0, s: 0, gl: 0, vl: 0, bg: 0, bv: 0, nb: 0, go: 0, vo: 0 });
console.log(`all: ${T.n} pairs; expansions grid ${(T.ge / T.n).toFixed(0)} vs graph ${(T.ve / T.n).toFixed(1)} (${(T.ge / Math.max(1, T.ve)).toFixed(0)}x fewer); mean length grid ${(T.gl / T.n).toFixed(2)} m vs graph ${(T.vl / T.n).toFixed(2)} m; graph as short (within 2%) on ${T.s} of ${T.n}; pairs that need a bend (${T.nb}): grid ${(T.bg / T.nb).toFixed(0)} vs graph ${(T.bv / T.nb).toFixed(1)} expansions (${(T.bg / Math.max(1, T.bv)).toFixed(0)}x); found by one only: grid ${T.go}, graph ${T.vo}`);
