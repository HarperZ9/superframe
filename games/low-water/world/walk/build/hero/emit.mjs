// Emit a hero street for the native frame: a .glb of the geometry, the lights and the views.
//   node games/low-water/world/walk/build/hero/emit.mjs <world out dir> <out dir> [view name]
// Reads the generated world (seed 20261118 by default; whatever the folder holds), plans the town
// the view stands in (town.mjs), finds the view (play/viewpoints.mjs) and writes
//   <out>/<view>.glb          the street at hero density (glb.mjs)
//   <out>/<view>.frame.json   the lights, the cameras (the view, a closer one, a short walk), the
//                             sky clock, and counts; positions in metres from `origin`
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadWorldNode } from "./world-node.mjs";
import { makeRoads } from "../../roads.mjs";
import { coarseAt, baseGround } from "../../data.mjs";
import * as town from "../town.mjs";
import { viewpoints } from "../../../play/viewpoints.mjs";
import { street, groundOf } from "./hstreet.mjs";
import { writeGlb } from "./glb.mjs";

const [worldDir, outDir, want = "hoarstead-main-street"] = process.argv.slice(2);
if (!worldDir || !outDir) { console.error("usage: emit.mjs <world out dir> <out dir> [view name]"); process.exit(2); }
const t0 = Date.now(), log = (m) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s  ${m}`);
const world = await loadWorldNode(worldDir);
const roads = makeRoads(world, (x, z) => coarseAt(world, x, z));
const towns = world.json.settlements.filter((s) => s.region === 1 && (s.kind === "seat" || s.kind === "town")).map((s) => ({ s, plan: town.plan(world, roads, s) }));
const view = viewpoints({ world, roads, towns, ground: (x, z) => baseGround(world, x, z) }).find((v) => v.name === want);
if (!view) { console.error(`no viewpoint named ${want}`); process.exit(1); }
const site = towns.find((t) => want.startsWith(t.s.name.toLowerCase()));
log(`${want}: ${site.s.name}, ${site.plan.houses.length} houses, view at ${view.x.toFixed(1)}, ${view.z.toFixed(1)}`);
const { M, L, O, houses, smoke } = street(world, site.plan, view);
log(`${houses} houses built, ${M.triangles} triangles, ${L.length} lights`);

// cameras: the viewpoint at eye height; a closer one by the nearest lit door on the right; a walk
const g = (x, z) => { const q = groundOf(world, site.plan, site.plan.houses, x, z); return q.g + q.snow; };
const fx = Math.sin(view.yaw), fz = -Math.cos(view.yaw);
const cam = (x, z, eye, yaw, pitch, fov) => ({ eye: [x - O[0], g(x, z) + eye - O[1], z - O[2]], yaw, pitch, fov });
const cams = { main: cam(view.x, view.z, view.eye, view.yaw, view.pitch, 68) };
const door = site.plan.houses.filter((h) => h.doorX !== undefined).map((h) => ({ h, d: (h.x - view.x) * fx + (h.z - view.z) * fz })).filter((q) => q.d > 8 && q.d < 30).sort((a, b) => a.d - b.d)[0];
if (door) {
  const h = door.h, c = Math.cos(h.turn), s = Math.sin(h.turn), at = (u, w) => [h.x + u * c + w * s, h.z - u * s + w * c];
  const [tx, tz] = at(h.doorX, h.D / 2), [ex, ez] = at(h.doorX - 2.2, h.D / 2 + 3.4), yaw = Math.atan2(tx - ex, -(tz - ez));
  cams.close = cam(ex, ez, 1.6, yaw, -0.08, 50);
}
cams.walk = []; for (let k = 0; k < 96; k++) { const d = k * 0.045; cams.walk.push(cam(view.x + fx * d, view.z + fz * d, view.eye + 0.025 * Math.sin(k / 96 * Math.PI * 4), view.yaw + 0.04 * Math.sin(k / 96 * Math.PI), view.pitch, 68)); }

await mkdir(outDir, { recursive: true });
const glb = writeGlb(M, { snow: [0.9, 0.92, 0.95], ground: [0.85, 0.87, 0.9], boards: [0.08, 0.06, 0.05], cedar: [0.4, 0.25, 0.12], timber: [0.25, 0.2, 0.15], stone: [0.3, 0.3, 0.3], shingle: [0.25, 0.25, 0.27], iron: [0.1, 0.1, 0.1], ice: [0.7, 0.8, 0.85], glass: [0.05, 0.05, 0.05], lamp: [1, 0.8, 0.5], sign: [0.6, 0.2, 0.1] },
  { seed: world.json.seed, view: want, origin: O });
await writeFile(join(outDir, `${want}.glb`), glb);
const frame = { format: "lw-hero-frame-1", seed: world.json.seed, view: want, origin: O, clock: view.clock, day: view.day, cameras: cams,
  lights: L.map((l) => ({ p: l.p.map((v) => +v.toFixed(4)), col: l.col, power: l.power, radius: l.radius, ...(l.aim ? { aim: l.aim, cone: l.cone } : {}), ...(l.street ? { street: true } : {}) })),
  smoke: smoke.map((c) => c.map((v) => +v.toFixed(3))),
  counts: { triangles: M.triangles, lights: L.length, houses, materials: [...M.b.keys()] } };
await writeFile(join(outDir, `${want}.frame.json`), JSON.stringify(frame));
log(`wrote ${want}.glb (${(glb.length / 1e6).toFixed(1)} MB) and ${want}.frame.json`);
