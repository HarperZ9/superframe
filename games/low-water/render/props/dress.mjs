// Dressing a built place with more props, without touching the code that built it (world-layers pass, 2026-10-23).
// A place module calls its world builder as before, then lays a list of items over the result: the props go into their own
// grid, the two distance fields are combined (the nearer surface wins), any lamps join the place's lights, and examine
// marks join the place's spots, so the bake writes them to place.json. Game-agnostic: the list is data.
//
//   const R = layered(mott(), [
//     { p: sheet("handbill", ...), spot: { id: "handbill", verb: "read", at: [x, 0, z], note: "..." } },
//     { p: [spoon(...), spoon(...)] },
//     { p: lampProp, light: { pos, type, I, reach, key, group } },
//   ]);
//   export default { ..., world: R.world, marks: R.marks, lights: R.lights };
// The returned world has map, idOf, propOf and props (the base's props, then the overlay's), so tools that count props
// (render/tools/variety.mjs) see both. An item with spot only (no p) adds a mark on an existing prop.
import { makeWorld } from "../kit/world.mjs";

export function layered(base, items, { cell = 1.2, margin = 0.35 } = {}) {
  const O = makeWorld({ cell, margin }), extra = [];
  const marks = base.marks || { spots: [], hides: [], exits: [], lamps: [] };
  for (const it of items) {
    for (const p of [].concat(it.p || [])) O.add(p);
    if (it.spot) {
      if (marks.spots.some((s) => s.id === it.spot.id)) throw new Error(`layered: mark ${it.spot.id} is already on this place`);
      marks.spots.push({ verb: "look", ...it.spot });
    }
    if (it.light) extra.push(it.light);
  }
  O.build();
  const B = base.world, n = (B.props || []).length;
  let id = 0, pr = -1;
  const world = {
    props: [...(B.props || []), ...O.props],
    map(x, y, z) {
      const d1 = B.map(x, y, z), i1 = B.idOf(), p1 = B.propOf ? B.propOf() : -1, d2 = O.map(x, y, z);
      if (d2 < d1) { id = O.idOf(); pr = O.propOf() >= 0 ? n + O.propOf() : -1; return d2; }
      id = i1; pr = p1; return d1;
    },
    idOf: () => id,
    propOf: () => pr,
  };
  const lights = typeof base.lights === "function" ? (V) => base.lights(V).concat(extra.filter((l) => !(V && V.emit && V.emit[l.group] === 0))) : base.lights;
  return { ...base, world, marks, lights, layered: O.props.length };
}
