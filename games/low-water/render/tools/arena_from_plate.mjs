// Fight ground from a painted place: sample the place's own world (the SDF the plate was baked from)
// on a 1 m grid inside a rectangle and write a combat arena in the combat engineer's format
// (game/engine/combat/data/arenas.mjs): rows, legend { surface, h }, solid cells where the painting
// has a wall, a bench or a barrel, lights from the place's own lamps, anchors (cut, lamp, snare,
// sluice) from its lamps and rig spots, spawns on open ground, exits on open edges, and the stage
// line (@area arena: id x y z yaw) that lays it back on the plate. So a fight is fought on the
// ground the player sees.
//   node render/tools/arena_from_plate.mjs <place> <arena-id> x0 z0 cols rows [--variant night] [--datum harbour|<metres>]
// Heights: arenas count metres above chart datum. Rooms and Act 2 places use h = y + datum. The
// harbour compresses the tide (its quay stands 3.2 m over the floor, the real range is near 6 m):
//   h = -0.3 + 1.72 (y + 3.2)   (the floor's mud at -0.3, the quay top at 5.2, the mole at 5.8)
// which the game inverts to draw the water on the plate: y = -3.2 + (tide + 0.3) / 1.72.
import { writeFileSync, mkdirSync } from "node:fs";
import { BY_ID } from "../kit/ids.mjs";
import { FOOT } from "../places/_common.mjs";
import { makeTracer } from "../sdf.mjs";

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const [name, id, X0, Z0, C, R] = a, x0 = +X0, z0 = +Z0, cols = +C, rows = +R, P = (await import(`../places/${name}.mjs`)).default;
const datumA = opt("--datum", "0"), toH = datumA === "harbour" ? (y) => (y + 3.029) / 0.62 : (y) => y + +datumA; // harbour: the shells' plate datum (water y = -3.029 + 0.62 tide)
const footOf = Object.fromEntries(Object.entries(FOOT).flatMap(([f, ks]) => ks.map((k) => [k, f])));
const walk = new Set((P.walk || []).map((i) => BY_ID[i]?.name));
// ground under a point: march down from above; the first surface met
function probe(x, z) {
  let y = 12; for (let i = 0; i < 400 && y > -8; i++) { const d = P.world.map(x, y, z); if (d < 0.004) break; y -= Math.max(d * 0.9, 0.004); }
  P.world.map(x, y, z); return { y, kind: BY_ID[P.world.idOf()]?.name || "wall" };
}
const SURF = { stone: "stone", mud: "mud", water: "mud", weed: "weed", shingle: "shingle", wood: "wood", sand: "mud" };
const legend = {}, keyOf = new Map(), grid = [], CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
let floorY = Infinity;
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const p = probe(x0 + c + 0.5, z0 + r + 0.5); if (walk.has(p.kind)) floorY = Math.min(floorY, p.y); }
for (let r = 0; r < rows; r++) {
  let line = "";
  for (let c = 0; c < cols; c++) {
    // five samples a cell: the median ground, and the cell is solid if most samples stand on something not walkable
    const S = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].map(([u, v]) => probe(x0 + c + u, z0 + r + v));
    const ok = S.filter((s) => walk.has(s.kind)), solid = ok.length < 3 || !walk.has(S[0].kind);
    const base = solid ? S[0] : ok.sort((p, q) => p.y - q.y)[Math.floor(ok.length / 2)];
    const surface = solid ? "stone" : SURF[footOf[base.kind] || "stone"], h = Math.round(toH(base.y) * 10) / 10;
    const k = `${surface}|${h}|${solid}`;
    if (!keyOf.has(k)) { const ch = solid ? "#" + "" : null; const sym = CH[keyOf.size]; keyOf.set(k, sym); legend[sym] = solid ? { surface: "stone", h, solid: true } : { surface, h }; }
    line += keyOf.get(k);
  }
  grid.push(line);
}
const inside = (p) => p[0] >= x0 && p[0] < x0 + cols && p[2] >= z0 && p[2] < z0 + rows, toA = (p) => [+(p[0] - x0).toFixed(2), +(p[2] - z0).toFixed(2)];
const V = P.variants[opt("--variant", Object.keys(P.variants)[0])] || {}, L = (P.lights ? P.lights(V.V || {}) : (V.glows || []).map((g) => ({ pos: g.pos, type: 1, I: g.intensity * 12, group: "lamp", key: "glow" }))).filter((l) => inside(l.pos) && !/moon|sun|fill|sky|daylouvre|daydoor/.test(l.key || ""));
const lights = L.map((l) => { const [ax, az] = toA(l.pos); return { x: ax, z: az, r: +Math.min(10, Math.sqrt(l.I) * 1.1).toFixed(1), k: +Math.min(0.9, 0.3 + l.I / 120).toFixed(2), ...(l.type === 0 ? { sodium: true } : {}), group: l.group || "" }; });
const strong = lights.filter((l) => l.r >= 2.5);
const spots = (P.marks?.spots || []).filter((s) => inside(s.at)), rig = spots.filter((s) => /rig|douse|light|cutpower/.test(s.verb));
const anchors = { cut: strong.map((l) => [l.x, l.z]), lamp: strong.slice(0, 1).map((l) => [l.x, l.z]), snare: spots.filter((s) => s.verb === "rig").map((s) => toA(s.at)), sluice: spots.filter((s) => /sluice/.test(s.id)).map((s) => toA(s.at)) };
// spawns: open cells, Lamb near the middle of the bottom half, foes spread over the top half
const open = []; grid.forEach((line, r) => [...line].forEach((ch, c) => { if (!legend[ch].solid) open.push([c + 0.5, r + 0.5]); }));
// distinct open cells, at least 1.2 m apart; hand-placed spawns (world x,z;x,z;... Lamb first) snap to the nearest open cell
const taken = [], pick = (tx, tz) => { const c = open.filter((p) => taken.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 1.2)); const b = (c.length ? c : open).reduce((b, p) => (Math.hypot(p[0] - tx, p[1] - tz) < Math.hypot(b[0] - tx, b[1] - tz) ? p : b)); taken.push(b); return b; };
const hand = opt("--spawns", null), targets = hand ? hand.split(";").map((q) => q.split(",").map(Number)).map(([x, z]) => [x - x0, z - z0]) : [[cols / 2, rows * 0.72], [cols * 0.3, rows * 0.25], [cols * 0.7, rows * 0.25], [cols / 2, rows * 0.15], [cols * 0.15, rows * 0.5]];
const picked = targets.map(([tx, tz]) => pick(tx, tz)), spawns = { lamb: picked[0], foes: picked.slice(1) };
const exits = []; for (const [side, cells] of [["w", grid.map((l) => l[0])], ["e", grid.map((l) => l[cols - 1])]]) { const o = cells.map((ch, r) => [ch, r]).filter(([ch]) => !legend[ch].solid); if (o.length) exits.push(side === "w" ? [0, o[0][1], 0.8, o[o.length - 1][1] + 1] : [cols - 0.8, o[0][1], cols, o[o.length - 1][1] + 1]); }
// the light each cell stands in, per variant: the place's own lights (the ones that lit the paint),
// with their shadows, as 0..1 (1 - exp(-E)); stealth sight and the fight's sight rule can read it
const tr = makeTracer(P.world.map, P.world.idOf), lightGrid = {};
if (P.lights) for (const [vn, VV] of Object.entries(P.variants)) {
  const LL = P.lights(VV.V || {}).filter((l) => !/^(skyfill|fill|cellfill)$/.test(l.key || "")), out = [];
  for (let r = 0; r < rows; r++) { const row = []; for (let c = 0; c < cols; c++) { const g = probe(x0 + c + 0.5, z0 + r + 0.5), Pp = [x0 + c + 0.5, g.y + 0.9, z0 + r + 0.5]; let E = 0;
    for (const l of LL) { const v = [l.pos[0] - Pp[0], l.pos[1] - Pp[1], l.pos[2] - Pp[2]], d = Math.hypot(...v); if (d > (l.reach || 30) && !/moon|sun/.test(l.key || "")) continue; const vis = tr.shadow(Pp, [0, 1, 0], [v[0] / d, v[1] / d, v[2] / d], Math.min(d - 0.3, 60), 8); E += (l.I * vis * Math.max(0.2, v[1] / d)) / (d * d); }
    row.push(+(1 - Math.exp(-E * 0.6)).toFixed(2)); } out.push(row); }
  lightGrid[vn] = out;
}
const arena = { name: id, place: name, cell: 1, origin: [0, 0], rows: grid, legend, water: datumA === "harbour" ? { a: 0, b: 1 } : null, lights, exits, tideEnds: datumA === "harbour" && floorY < -2, anchors, spawns, light: lightGrid,
  stage: { line: `arena: ${id} ${x0} ${datumA === "harbour" ? 0 : -(+datumA)} ${z0} 0`, note: "the arena's (0, 0) at world (x0, z0); y is world y = 0 because stage.toWorld adds the arena height, so the game should pass the world height for each cell (inverse of h)", heightToWorld: datumA === "harbour" ? "y = -3.029 + 0.62 h (the plate datum in place.json)" : `y = h - ${+datumA}` },
  source: { plate: `content/${name}`, rect: [x0, z0, cols, rows], made: "render/tools/arena_from_plate.mjs" } };
mkdirSync(new URL(`../../content/${name}/`, import.meta.url), { recursive: true });
writeFileSync(new URL(`../../content/${name}/arena-${id}.json`, import.meta.url), JSON.stringify(arena, null, 1));
console.log(`${name}/arena-${id}.json: ${cols} x ${rows}, ${Object.keys(legend).length} kinds, ${lights.length} lights, ${anchors.snare.length} snares`);
console.log(grid.join("\n"));
