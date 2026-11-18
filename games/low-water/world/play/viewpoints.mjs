// Named places to stand and look, worked out from the world each time, so a change to the
// generator moves the view with the thing it looks at. A still or a spawn names a viewpoint
// ("hoarstead-main-street") rather than carrying coordinates that go stale when a road moves.
//   viewpoints({ world, roads, towns: [{ s, plan }], works: plan | null, ground, water, solids })
//     -> [{ name, says, x, z, eye, yaw, pitch, clock, day, mode }]   metres, radians, hours
// Every viewpoint is checked before it is returned: the eye stands clear of every solid by half a
// metre and above the ground, or the search moves it on.
import { heading } from "./math.mjs";

const clockOf = { night: 21.2, dusk: 18.3, dawn: 6.9 };
export function viewpoints({ world, roads, towns = [], works = null, ground, water = () => -1e9, solids = null }) {
  const out = [], clear = (x, z, eye) => { const y = ground(x, z) + eye; return (!solids || solids.sdfSolids([x, y, z]) > 0.5) && water(x, z) < ground(x, z) - 0.05; };
  const add = (v) => { if (clear(v.x, v.z, v.eye)) out.push({ pitch: 0.02, day: 3, mode: "first", ...v }); };
  // stand on a lane at share t of its length and look along it, toward its far end (or back)
  const alongLane = (L, t, back = false) => {
    const x = L.a[0] + (L.b[0] - L.a[0]) * t, z = L.a[1] + (L.b[1] - L.a[1]) * t, dx = (L.b[0] - L.a[0]) * (back ? -1 : 1), dz = (L.b[1] - L.a[1]) * (back ? -1 : 1);
    return { x, z, yaw: heading(dx, dz) };
  };
  for (const { s, plan } of towns) {
    if (!plan) continue;
    const id = s.name.toLowerCase().replace(/[^a-z]+/g, "-"), main = plan.lanes.find((L) => L.half > 2) || plan.lanes[0];
    // the main street: a third of the way in, looking down its length past the most houses
    for (const t of [0.3, 0.38, 0.22, 0.46]) {
      const a = alongLane(main, t), houses = plan.houses.filter((h) => { const d = [h.x - a.x, h.z - a.z], f = [Math.sin(a.yaw), -Math.cos(a.yaw)]; return d[0] * f[0] + d[1] * f[1] > 0; }).length;
      if (houses < 4) continue;
      const n = out.length; add({ name: `${id}-main-street`, says: `${s.name} main street, looking along it`, ...a, eye: 1.7, clock: clockOf.night });
      if (out.length > n) break;
    }
    // the longest side lane, from near its mouth
    const side = plan.lanes.filter((L) => L !== main).sort((p, q) => q.len - p.len)[0];
    if (side) for (const t of [0.15, 0.25, 0.35]) { const n = out.length; add({ name: `${id}-lane`, says: `a side lane of ${s.name}, from near the street`, ...alongLane(side, t), eye: 1.7, clock: clockOf.night }); if (out.length > n) break; }
    // the town from the road outside it, at dusk, eye a little raised
    const back = alongLane(main, -0.35);
    add({ name: `${id}-approach`, says: `${s.name} from the road outside it, at dusk`, ...back, eye: 3, clock: clockOf.dusk, pitch: 0.04, mode: "follow" });
  }
  if (works && works.marks.length) {
    // across the water from the far bank: the bearing from the plant with the most open water
    // between, standing on dry ground at the shore
    const furn = works.marks.filter((m) => m.kind === "furnace"), c = furn.length ? [furn.reduce((a, m) => a + m.wx, 0) / furn.length, furn.reduce((a, m) => a + m.wz, 0) / furn.length] : [works.cx, works.cz];
    let best = null;
    for (let b = 0; b < 360; b += 6) for (let d = 1400; d <= 4200; d += 200) {
      const u = [Math.sin(b * Math.PI / 180), -Math.cos(b * Math.PI / 180)], x = c[0] + u[0] * d, z = c[1] + u[1] * d;
      if (!(ground(x, z) > 0.6) || water(x, z) > ground(x, z)) continue;
      let wet = 0; for (let k = 1; k < 20; k++) { const q = d * (k / 20); if (water(c[0] + u[0] * q, c[1] + u[1] * q) > ground(c[0] + u[0] * q, c[1] + u[1] * q)) wet++; }
      // the shore: water within 60 m on the plant's side
      const shore = water(x - u[0] * 60, z - u[1] * 60) > ground(x - u[0] * 60, z - u[1] * 60);
      const score = wet + (shore ? 6 : 0) - d / 1400;
      if (!best || score > best.score) best = { score, x, z, yaw: heading(-u[0], -u[1]) };
    }
    if (best) add({ name: "works-across-water", says: "the works across the water from the far bank", x: best.x, z: best.z, yaw: best.yaw, eye: 1.7, clock: 21.5, pitch: 0.03 });
    // in the yard: on the concrete 160 m from the furnaces, toward the island's middle
    const isle = [world.json.isle_centre[0] * world.cell, world.json.isle_centre[1] * world.cell], v = [isle[0] - c[0], isle[1] - c[1]], l = Math.hypot(...v) || 1;
    for (const d of [160, 200, 240, 120]) { const n = out.length; const x = c[0] + v[0] / l * d, z = c[1] + v[1] / l * d; add({ name: "works-yard", says: "in the works yard, the furnaces ahead", x, z, yaw: heading(-v[0], -v[1]), eye: 1.7, clock: 21.5, pitch: 0.12 }); if (out.length > n) break; }
  }
  // the fog forest: the road point with the most forest cover round it, looking along the road
  if (roads) {
    let best = null;
    for (const L of roads.lines) for (let i = 4; i < L.pts.length - 4; i += 8) {
      const [x, z] = L.pts[i], k = Math.floor(z / world.cell) * world.W + Math.floor(x / world.cell);
      if (world.region[k] !== 3) continue;
      // deep in the region (its weather blends over the border), with the most forest round it
      let n = 0, edge = false; for (let j = -8; j <= 8; j += 2) for (let q = -8; q <= 8; q += 2) { const kk = k + j * world.W + q; if (world.region[kk] !== 3) edge = true; if (Math.abs(j) <= 4 && Math.abs(q) <= 4 && world.biome[kk] === 5) n++; }
      if (edge) continue;
      if (!best || n > best.n) best = { n, x, z, L, i };
    }
    if (best) {
      const p = best.L.pts[best.i + 3], q = best.L.pts[best.i - 3], yaw = heading(p[0] - q[0], p[1] - q[1]);
      add({ name: "fog-forest-road", says: "the road through the fog forest, at dawn", x: best.x, z: best.z, yaw, eye: 1.7, clock: clockOf.dawn, pitch: 0.06 });
      // among the trunks, 30 m off the road, looking back across it
      const r = [Math.cos(yaw), Math.sin(yaw)];
      for (const d of [30, 36, 24, 42]) { const n = out.length; add({ name: "fog-forest-under", says: "among the trunks off the forest road", x: best.x + r[0] * d, z: best.z + r[1] * d, yaw: yaw - Math.PI / 2 + 0.4, eye: 1.7, clock: clockOf.dawn, pitch: 0.14 }); if (out.length > n) break; }
    }
  }
  return out;
}
