// The stills: one or two views for each region, each placed from the generated world so a new
// seed moves the camera with the land. A view is a place in km, a height above the surface in
// metres, a heading (0 north, 90 east) and pitch in degrees, a day and a clock.
import { regionState, skyEvents } from "../weather.mjs";

const KM = 0.064;
const seat = (j, region) => j.settlements.find((s) => s.kind === "seat" && s.region === region) || j.regions.find((r) => r.id === region);
const marks = (j, kind) => j.marks.filter((m) => m.kind === kind);
const at = (p) => ({ x: (p.x ?? p.cx) * KM, z: (p.y ?? p.cy) * KM });
// stand `back` km from a target on a bearing, facing it
function facing(target, bearingDeg, back, extra = {}) {
  const b = bearingDeg * Math.PI / 180;
  return { x: target.x - Math.sin(b) * back, z: target.z + Math.cos(b) * back, yaw: bearingDeg, ...extra };
}
// the stair landmark deepest in the forest region stands in for "among the trees"
const forest = (j) => at(j.marks.find((m) => m.kind === "stairs") || seat(j, 3));
const centre = (list) => ({ x: list.reduce((a, m) => a + m.x, 0) / list.length * KM, z: list.reduce((a, m) => a + m.y, 0) / list.length * KM });

export function viewsFor(j, probe = null) {
  const v = [], add = (name, o) => v.push({ name, fly: true, day: 3, pitch: -3, alt: 1.7, ...o });
  const s = (r) => at(seat(j, r));
  // 1 thaw country: the snow town at dusk, lamps on
  const thaw = j.settlements.find((q) => q.region === 1 && q.kind === "town") || seat(j, 1);
  add("01-thaw-country", facing(at(thaw), 265, 0.75, { alt: 6, clock: 18.3, day: 5, pitch: 2 }));
  // 2 folded uplands: the white house on the moor under the alpine tier, and the cloud sea from above
  const house = j.settlements.filter((q) => q.kind === "house").sort((a, b) => b.elev_m - a.elev_m)[0];
  add("02-uplands-white-house", facing(at(house), 100, 0.11, { alt: 3, clock: 16.6, day: 3, pitch: 4 }));
  add("02-uplands-cloud-sea", { ...s(2), alt: 1700, yaw: 275, pitch: -13, clock: 6.6, day: 7 });
  // 3 fog forest: among the trunks at dawn
  const deep = probe ? probe.densest(5, seat(j, 3)) : forest(j);
  add("03-fog-forest", { ...deep, alt: 2.4, yaw: 40, pitch: 3, clock: 6.9, day: 3 });
  // 4 storm coast: stacks and the port from the water at dusk
  const stacks = marks(j, "seastack");
  add("04-storm-coast", facing(stacks.length ? at(stacks[0]) : s(4), 80, 0.32, { alt: 4, clock: 17.3, day: 4, pitch: 4 }));
  // 5 canyon and badlands: low sun along the banded walls
  add("05-canyon", { ...s(5), alt: 60, yaw: 110, pitch: -8, clock: 15.2, day: 3 });
  // 6 marsh: the reed halls across standing water, storm light
  const reed = marks(j, "mudhif");
  add("06-marsh", facing(reed.length ? centre(reed) : s(6), 330, 0.5, { alt: 2.2, clock: 15.4, day: 6, pitch: 1 }));
  // 7 the city across the water, from the works shore at night
  add("07-city-across-water", facing(s(7), 215, 1.5, { alt: 4, clock: 20.5, day: 3, pitch: 3 }));
  // 8 the works: furnaces and stacks doubled in water, night
  const furn = marks(j, "furnace");
  // from the bay, so the lamps stand over their own reflections
  add("08-the-works", facing(furn.length ? centre(furn) : s(8), 355, 2.3, { alt: 2.5, clock: 21.5, day: 3, pitch: 4 }));
  // 9 the monument ground: the Tower at dusk, and the Tower seen from another region
  const tower = marks(j, "tower")[0];
  add("09-monument-ground", facing(at(tower), 290, 5.5, { alt: 12, clock: 17.4, day: 3, pitch: 5 }));
  // from the uplands seat, a region away: the bearing is worked out from the two places
  const up = s(2), tw = at(tower), bearing = Math.atan2(tw.x - up.x, -(tw.z - up.z)) * 180 / Math.PI;
  add("09-tower-from-afar", { ...up, alt: 420, yaw: bearing, pitch: -2, clock: 16.4, day: 3 });
  // 10 the drowned quarter at dawn
  const dr = marks(j, "drowned");
  // from open water, looking through the blocks toward the island behind them
  const dc = dr.length ? centre(dr) : s(10), isle = { x: j.isle_centre[0] * KM, z: j.isle_centre[1] * KM };
  add("10-drowned-quarter", facing(dc, Math.atan2(isle.x - dc.x, -(isle.z - dc.z)) * 180 / Math.PI, 0.55, { alt: 2.2, clock: 6.5, day: 3, pitch: 3 }));
  // 11 the far-north works town: slabs in blowing snow, and the aurora night
  const slabs = marks(j, "slab");
  add("11-far-north-works-town", facing(slabs.length ? centre(slabs) : s(11), 10, 0.42, { alt: 3, clock: 18.1, day: 3, pitch: 4 }));
  // the first night in 120 when the north is clear and the aurora is strong
  let auroraDay = 11;
  for (let d = 0; d < 120; d++) { const w = regionState(j.seed, 11, d, 23.2); if (w.cover < 0.25 && skyEvents(j.seed, w, 0.05, d, 23.2).aurora > 0.4) { auroraDay = d; break; } }
  add("11-aurora", facing(slabs.length ? centre(slabs) : s(11), 5, 0.9, { alt: 8, clock: 23.2, day: auroraDay, pitch: 16 }));
  // the whole island from high up, mid-morning
  add("00-island", { x: j.width * KM / 2, z: j.height * KM * 1.08, alt: 52000, yaw: 0, pitch: -50, clock: 9.5, day: 3 });
  return v;
}
