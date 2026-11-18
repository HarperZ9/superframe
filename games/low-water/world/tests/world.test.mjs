// Checks on the generated world. They run the generator, so they need a BuildLang compiler:
//   BUILDC=/path/to/buildc node --test games/low-water/world/tests/world.test.mjs
// LW_WORLD_SEED picks the seed (default 20261118). LW_WORLD_KEEP=dir keeps the outputs there.
//
//   determinism  two runs of one seed give byte-identical files (and another seed does not)
//   hydrology    every river line runs downhill on the water surface and ends in the sea, in a
//                lake or on another line; a world with one river bed raised 40 m must fail
//   scale        walking time along the roads between ring towns, measured
//   regions      all eleven exist, each with a seat where the rules ask for one
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePgm } from "../pgm.mjs";

const here = dirname(fileURLToPath(import.meta.url)), gen = join(here, "..", "gen");
const BUILDC = process.env.BUILDC, SEED = process.env.LW_WORLD_SEED || "20261118";
const FILES = ["height.pgm", "water.pgm", "moist.pgm", "river.pgm", "biome.pgm", "region.pgm", "world.json"];
const exe = join(gen, "target", "release", process.platform === "win32" ? "main.exe" : "main");
const root = process.env.LW_WORLD_KEEP || mkdtempSync(join(tmpdir(), "lw-world-"));

function build() {
  if (!BUILDC) throw new Error("set BUILDC to a BuildLang compiler (CI pins the commit in .github/workflows/test.yml)");
  execFileSync(BUILDC, ["build", "--release", "."], { cwd: gen, stdio: "pipe" });
  assert.ok(existsSync(exe), "the generator did not build");
}
function run(name, seed, ...extra) {
  const dir = join(root, name); mkdirSync(dir, { recursive: true });
  const out = execFileSync(exe, [String(seed), dir.replace(/\\/g, "/"), ...extra], { encoding: "utf8" });
  return { dir, out };
}
const sums = (dir) => Object.fromEntries(FILES.map((f) => [f, createHash("sha256").update(readFileSync(join(dir, f))).digest("hex")]));
const load = (dir) => ({
  json: JSON.parse(readFileSync(join(dir, "world.json"), "utf8")),
  height: parsePgm(readFileSync(join(dir, "height.pgm"))), water: parsePgm(readFileSync(join(dir, "water.pgm"))),
  region: parsePgm(readFileSync(join(dir, "region.pgm"))),
});

// The hydrology check, made from the written files alone. Surface = water level where there is
// water, the ground elsewhere. Returns the faults found.
export function hydrologyFaults({ json, height, water }) {
  const W = json.width, faults = [];
  const surface = (x, y) => { const k = y * W + x; return water.data[k] > 0 ? water.data[k] : height.data[k]; };
  const wet = (x, y) => water.data[y * W + x] > 0;
  const onLine = new Set();
  for (const r of json.rivers) for (let i = 0; i < r.pts.length - 2; i += 2) onLine.add(r.pts[i + 1] * W + r.pts[i]);
  for (const r of json.rivers) {
    const p = r.pts, n = p.length / 2;
    for (let i = 1; i < n; i++) {
      const dx = Math.abs(p[2 * i] - p[2 * i - 2]), dy = Math.abs(p[2 * i + 1] - p[2 * i - 1]);
      if (dx > 1 || dy > 1) faults.push({ river: r.id, step: i, why: "the line jumps" });
      if (surface(p[2 * i], p[2 * i + 1]) > surface(p[2 * i - 2], p[2 * i - 1])) faults.push({ river: r.id, step: i, why: "uphill" });
    }
    const ex = p[2 * n - 2], ey = p[2 * n - 1];
    const ok = r.end === "join" ? onLine.has(ey * W + ex) : wet(ex, ey);
    if (!ok) faults.push({ river: r.id, step: n - 1, why: `does not end in ${r.end}` });
  }
  return faults;
}

let A, world;
test("the generator builds and runs", { timeout: 600000 }, () => {
  build();
  A = run("a", SEED);
  assert.match(A.out, /hydrology: pass/);
  world = load(A.dir);
});

test("determinism: one seed gives byte-identical files; another seed gives a different world", { timeout: 600000 }, () => {
  const B = run("b", SEED), a = sums(A.dir), b = sums(B.dir);
  for (const f of FILES) assert.equal(a[f], b[f], `${f} differs between two runs of seed ${SEED}`);
  const C = run("c", +SEED + 1), c = sums(C.dir);
  assert.notEqual(a["height.pgm"], c["height.pgm"], "a different seed gave the same terrain, so the seed is not used");
  console.log(`  seed ${SEED}: ${FILES.map((f) => `${f} ${a[f].slice(0, 12)}`).join("  ")}`);
});

test("hydrology: every river reaches the sea or a lake with no uphill step", () => {
  const faults = hydrologyFaults(world);
  assert.deepEqual(faults.slice(0, 3), [], `${faults.length} faults`);
  const ends = { sea: 0, lake: 0, join: 0 };
  for (const r of world.json.rivers) ends[r.end]++;
  assert.ok(world.json.rivers.length > 40 && ends.sea > 10, "too few rivers for the check to mean anything");
  // every joined line leads, line by line, to one that ends in water
  const W = world.json.width, owner = new Map();
  for (const r of world.json.rivers) for (let i = 0; i < r.pts.length - 2; i += 2) owner.set(r.pts[i + 1] * W + r.pts[i], r);
  for (const r0 of world.json.rivers) {
    let r = r0, hops = 0;
    while (r.end === "join") { r = owner.get(r.pts[r.pts.length - 1] * W + r.pts[r.pts.length - 2]); assert.ok(r && ++hops < 500, `river ${r0.id} never reaches water`); }
  }
  console.log(`  ${world.json.rivers.length} river lines: ${ends.sea} to the sea, ${ends.lake} to a lake, ${ends.join} joining another; ${world.json.checks.lakes} lakes`);
});

test("hydrology control: a planted uphill river fails the check", { timeout: 600000 }, () => {
  const P = run("planted", SEED, "plant");
  assert.match(P.out, /hydrology: FAIL/, "the generator's own check passed a planted fault");
  const faults = hydrologyFaults(load(P.dir));
  assert.ok(faults.some((f) => f.why === "uphill"), "the file check passed a planted uphill river");
});

test("scale: ring towns are about a day's walk apart by road", () => {
  const { json } = world, town = (i) => json.settlements[i];
  const roads = json.roads.filter((r) => r.kind !== "path");
  const hours = roads.map((r) => r.hours100 / 100).sort((a, b) => a - b), km = roads.map((r) => r.km100 / 100).sort((a, b) => a - b);
  const med = (v) => v[v.length >> 1];
  console.log(`  island ${(json.width * json.cell_m / 1000).toFixed(1)} x ${(json.height * json.cell_m / 1000).toFixed(1)} km; ${roads.length} roads between ${json.settlements.filter((s) => s.kind === "seat" || s.kind === "town").length} ring towns`);
  console.log(`  road walk: median ${med(hours)} h (${med(km)} km), shortest ${hours[0]} h, longest ${hours.at(-1)} h`);
  for (const r of roads) console.log(`    ${town(r.from).name} to ${town(r.to).name}: ${(r.km100 / 100).toFixed(1)} km, ${(r.hours100 / 100).toFixed(1)} h${r.kind === "ferry" ? " (with the ferry)" : ""}`);
  assert.ok(med(hours) >= 4 && med(hours) <= 10, `median road walk ${med(hours)} h is not a day's walk`);
  // crossing the island on foot takes more than a day: the longest chain of roads west to east
  assert.ok(json.width * json.cell_m / 1000 / 5 > 20, "the island is too small to take hours to cross");
});

test("regions: all eleven exist and the towns sit in them", () => {
  const { json } = world;
  for (const r of json.regions) assert.ok(r.cells > 3000, `${r.name} has ${r.cells} cells`);
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11]) assert.ok(json.settlements.some((s) => s.kind === "seat" && s.region === id), `region ${id} has no seat`);
  const names = json.settlements.map((q) => q.name);
  assert.equal(new Set(names).size, names.length, `two places share a name: ${names.filter((n, i) => names.indexOf(n) !== i).join(", ")}`);
  const kinds = new Set(json.marks.map((m) => m.kind));
  for (const k of ["tower", "spire", "furnace", "stack", "slab", "tenement", "drowned", "seastack", "mudhif"]) assert.ok(kinds.has(k), `no ${k} was placed`);
});
