// The ground and the air a fight happens in, read through the engine's environment hub
// (G.envAt, world/envhub.mjs). The night that drives the dialogue drives the fight: tide, rain,
// fog, frost, wind, light and sodium at the place.
//
// An arena is data (data/arenas.mjs):
//   { place, cell, origin: [x0, z0], rows: ["SSmm.."], legend: { S: { surface, h } },
//     water: { a, b } (water height = a + b * tide), lights: [{ x, z, r, k, sodium }],
//     exits: [[x0, z0, x1, z1]], spawns, tideEnds, blackout }
// or, for a fight on a painted plate (sim/plate.mjs), `grid: { w, h, cells }` in place of rows and
// legend, cells null where the ground is solid, and water { a, b, vscale }: depths in real metres
// are (water height - ground) / vscale. Solid ground blocks bodies, thrown things and sight.
// x runs along a row (east), z down the rows (south); h is ground height above chart datum.
// The hub's wind z points north, so the field turns it round.
//
// The rules (both sides obey them):
//   footing   per tile, the hub's footing kinds and grip (stone, mud, wood, weed; becoming frost,
//             wet, or water by the night). Grip sets acceleration, turning, how far a knockback
//             carries, and how far root motion runs on (a roll on wet stone slides on). Mud is also
//             sticky: slower, shorter, and a roll in it ends late
//   water     ankle, knee and waist bands slow movement and breath; a roll at the knee is a lurch
//   sight     a body is seen within a range set by the light falling on it, cut by fog. A lantern
//             lights its bearer and everyone near: it helps you see and be seen
//   wind      thrown things drift downwind, more for light ones
import { FOOTING_GRIP } from "../../world/envhub.mjs";

export const STICKY = { mud: { speed: 0.72, root: 0.72, recovery: 6 } };
export const WATER_BANDS = [
  { band: "dry", from: -Infinity, speed: 1, regen: 1, accel: 1, root: 1 },
  { band: "ankle", from: 0.08, speed: 0.86, regen: 0.9, accel: 0.9, root: 0.95 },
  { band: "knee", from: 0.4, speed: 0.6, regen: 0.6, accel: 0.7, root: 0.7 },
  { band: "waist", from: 0.85, speed: 0.36, regen: 0.35, accel: 0.5, root: 0.45 },
];
export const SIGHT = { base: 2.2, perLight: 22, fogK: 32, min: 1.6, max: 24 };
export const WIND_K = 0.35;
// what cellAt returns for solid ground: no footing, far above any water
export const WALL = Object.freeze({ surface: "stone", h: 99, solid: true });

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const num = (v, d = 0) => (typeof v === "number" && isFinite(v) ? v : d);

export function createField({ G, arena }) {
  const A = { ...arena, lights: (arena.lights || []).map((l) => ({ ...l })) }, terms = {}, floods = [];
  const width = (A.grid ? A.grid.w : A.rows[0].length) * A.cell, depth = (A.grid ? A.grid.h : A.rows.length) * A.cell;
  const gripOf = (kind) => { const k = kind.replace(/^wet /, ""), r = G.rs.rules[`footing-${k}`], g = r != null ? +r : FOOTING_GRIP[k] ?? 1; return kind.startsWith("wet ") ? g * 0.85 : g; };
  const F = {
    arena: A, terms, gripOf, floods,
    bounds: { x0: A.origin[0], z0: A.origin[1], x1: A.origin[0] + width, z1: A.origin[1] + depth },
    // read the hub now (the world calls this on a fixed cadence, so replays agree)
    refresh() {
      const e = G.envAt({ place: A.place });
      Object.assign(terms, { tide: num(e.tide), fog: num(e.fog), rain: num(e.rain), frost: num(e.frost), light: num(e.light), sodium: num(e.sodium), temp: num(e.temp),
        windSpeed: num(e.wind.speed), windX: num(e.wind.x), windZ: -num(e.wind.z), outdoors: !(G.book.places[A.place] || {}).shelter, clock: G.env.clock() });
      terms.dark = num((G.book.places[A.place] || {}).dark, 0.05);
      if (A.blackout) { terms.light = 0.02; terms.sodium = 0; terms.dark = 0.02; }
      if (!terms.outdoors) { terms.windSpeed = 0; terms.windX = 0; terms.windZ = 0; }
      return terms;
    },
    cellAt(x, z) {
      const c = Math.floor((x - A.origin[0]) / A.cell), r = Math.floor((z - A.origin[1]) / A.cell);
      if (A.grid) { const g = A.grid; return c >= 0 && r >= 0 && c < g.w && r < g.h && g.cells[r * g.w + c] ? g.cells[r * g.w + c] : WALL; }
      const row = A.rows[clamp(r, 0, A.rows.length - 1)], ch = row[clamp(c, 0, row.length - 1)];
      const cell = A.legend[ch] || { surface: "stone", h: 0 };
      return cell.solid ? WALL : cell;
    },
    solid: (x, z) => F.cellAt(x, z) === WALL,
    // nothing solid on the straight line between two points (sampled every half cell)
    lineClear(ax, az, bx, bz) {
      const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (A.cell * 0.5));
      for (let i = 1; i < n; i++) { const t = i / n; if (F.solid(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
      return true;
    },
    waterY: () => (A.water ? A.water.a + A.water.b * terms.tide : -9),
    depthAt: (x, z) => (F.waterY() + floodAt(floods, x, z) - F.cellAt(x, z).h) / ((A.water && A.water.vscale) || 1),
    band(d) { let b = WATER_BANDS[0]; for (const w of WATER_BANDS) if (d >= w.from) b = w; return b; },
    footing: (x, z) => footingAt(F, x, z),
    lightAt: (x, z, lamps = []) => lightAt(F, x, z, lamps),
    sodiumAt: (x, z) => terms.sodium * litShare(A) > 0.3 || (A.lights || []).some((s) => s.sodium && !s.off && Math.hypot(x - s.x, z - s.z) < s.r * 0.8),
    // how far away a body standing in this much light can be seen, given the fog
    seenRange: (light) => clamp((SIGHT.base + SIGHT.perLight * light) / (1 + terms.fog * SIGHT.fogK), SIGHT.min, SIGHT.max),
    // acceleration on a thrown thing of this mass (m/s^2), downwind
    wind: (mass = 1) => { const k = WIND_K / Math.max(0.2, mass); return [terms.windX * k, terms.windZ * k]; },
    inExit: (x, z) => (A.exits || []).some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1),
  };
  F.refresh();
  return F;
}

// The hub's footing kinds, per tile: frost on dry ground outdoors, wet in rain, water when deep.
function footingAt(F, x, z) {
  const cell = F.cellAt(x, z), t = F.terms, d = F.depthAt(x, z), band = F.band(d);
  let kind = cell.surface;
  if (t.outdoors && t.frost >= 1 && d < 0) kind = "frost";
  else if (t.outdoors && t.rain > 0.5) kind = `wet ${kind}`;
  if (d > 0.05) kind = "water";
  const grip = F.gripOf(kind), stick = STICKY[cell.surface] || { speed: 1, root: 1, recovery: 0 };
  return {
    surface: cell.surface, kind, grip, depth: d, band: band.band, regen: band.regen,
    accel: grip * band.accel, turn: 0.5 + 0.5 * grip, friction: 3 + 12 * grip,
    speed: stick.speed * band.speed, root: stick.root * band.root * (1 + 0.35 * (1 - grip) * (stick.root < 1 ? 0 : 1)),
    recovery: stick.recovery, frost: kind === "frost", wet: kind.startsWith("wet ") || kind === "water",
  };
}

// Water a sluice has let into a zone (sim/props.mjs), on top of the tide.
const floodAt = (floods, x, z) => floods.reduce((a, f) => (x >= f.zone[0] && x <= f.zone[2] && z >= f.zone[1] && z <= f.zone[3] ? a + f.add : a), 0);

// The place's light is what its lamps give: as the arena's lamps go out it falls toward the
// place's dark-light, in proportion.
const litShare = (A) => { const ls = A.lights || []; return ls.length ? ls.filter((l) => !l.off).length / ls.length : 1; };

function lightAt(F, x, z, lamps) {
  const share = litShare(F.arena);
  let L = clamp(F.terms.dark + (F.terms.light - F.terms.dark) * share, 0, 1);
  for (const s of [...(F.arena.lights || []).filter((l) => !l.off), ...lamps]) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r) L = Math.max(L, s.k * (1 - d / s.r));
  }
  return L;
}
