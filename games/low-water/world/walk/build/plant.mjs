// The plant round the furnaces: process units on a street grid, the way a refinery fills its
// ground. Each block is one unit, chosen by rule: an open steel structure of decks with vessels
// standing through it, a cluster of columns, a tank farm in its bund, a row of spheres, a fired
// heater with its stacks, or a bank of cooling cells. Pipe racks run down every street between
// blocks, and every deck corner and landing carries a lamp. Seen from across the water at night
// this is the wall of steel and light of the reference, B3.19.
//   layout(world, P) is cheap: it says where each block stands (for the yards and the forest).
//   build(T, P) draws them with the works' own parts (works.mjs passes T).
import { frame } from "./kit.mjs";
import { CELLS } from "../flora/atlas.mjs";
import { rng } from "../flora/grow.mjs";
import { baseGround, regionAt } from "../data.mjs";

const BLOCK = 50, STREET = 20, PITCH = BLOCK + STREET, SPAN = [6, 5];
const TYPES = ["structure", "structure", "structure", "columns", "columns", "tanks", "spheres", "heater", "cooling"];

export function layout(world, P) {
  const R = rng(world.json.seed + 4111), blocks = [], streets = [];
  const dry = (x, z) => baseGround(world, x, z) > 1.2 && regionAt(world, x, z) === 8;
  for (const f of P.marks.filter((m) => m.kind === "furnace")) {
    const turn = f.turn_deg * Math.PI / 180, ux = Math.cos(turn), uz = -Math.sin(turn), at = (i, j) => [f.wx + (ux * i - uz * j) * PITCH, f.wz + (uz * i + ux * j) * PITCH];
    const used = new Set();
    for (let j = -SPAN[1]; j <= SPAN[1]; j++) for (let i = -SPAN[0]; i <= SPAN[0]; i++) {
      const [x, z] = at(i, j), r = R(), t = R();
      // the furnace and the plant that already serves it keep their ground
      if (Math.hypot(i, j) < 2.3 || Math.hypot(x - (f.wx + ux * 95), z - (f.wz + uz * 95)) < 95) continue;
      if (r < 0.1 || ![[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].every(([a, b]) => dry(x + a * BLOCK * 0.5, z + b * BLOCK * 0.5))) continue;
      blocks.push({ x, z, turn, ux, uz, kind: TYPES[Math.floor(t * TYPES.length)], seed: R() });
      used.add(i * 100 + j);
    }
    // a rack down each street that has plant on both sides of it
    for (let j = -SPAN[1]; j <= SPAN[1]; j++) for (let i = -SPAN[0]; i < SPAN[0]; i++) {
      if (used.has(i * 100 + j) && used.has((i + 1) * 100 + j)) { const a = at(i + 0.5, j - 0.5), b = at(i + 0.5, j + 0.5); streets.push([a[0], a[1], b[0], b[1]]); }
      if (used.has(j * 100 + i) && used.has(j * 100 + i + 1) && R() < 0.7) { const a = at(j - 0.5, i + 0.5), b = at(j + 0.5, i + 0.5); streets.push([a[0], a[1], b[0], b[1]]); }
    }
  }
  return { blocks, streets, half: BLOCK * 0.5 };
}

export function build(T, P) {
  const { K, g, lamp, dot, landing, scaffold, column, sphere, rack, stack, O } = T, STEEL = [0.050, 0.060, 0.058];
  for (const b of P.layout.blocks) {
    const R = rng(Math.floor(b.seed * 1e9)), cx = b.x - O[0], cz = b.z - O[2], h = P.layout.half - 3;
    const loc = (u, v) => [cx + b.ux * u - b.uz * v, cz + b.uz * u + b.ux * v];
    if (b.kind === "structure") {
      // an open structure: columns on a 6 m grid, a deck every 6 m, vessels through the decks
      const nu = 3 + Math.floor(R() * 3), nv = 2 + Math.floor(R() * 3), decks = 3 + Math.floor(R() * 5), sp = 6, y0 = g(cx, cz);
      const W = nu * sp / 2, D = nv * sp / 2, f = frame(cx, y0, cz, b.turn);
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) K.box(f, -W + i * sp - 0.2, -0.5, -D + j * sp - 0.2, -W + i * sp + 0.2, decks * sp, -D + j * sp + 0.2, [20, ...STEEL], false);
      for (let d = 1; d <= decks; d++) {
        const y = d * sp;
        K.box(f, -W - 0.3, y - 0.35, -D - 0.3, W + 0.3, y, D + 0.3, [20, ...STEEL], R() < 0.6, true);
        for (const [a0, a1, c0, c1] of [[-W, W, -D, -D], [W, -W, D, D]]) K.cardAt(T.put(f, [a0, y + 1.1, c0]), T.put(f, [a1, y + 1.1, c1]), T.put(f, [a1, y, c1]), T.put(f, [a0, y, c0]), CELLS.rail, [23, 1, 0, 0], Math.max(1, Math.round(W / 2)));
        // lamps at the corners of every deck and a few along its edge
        for (const [a, c] of [[-W, -D], [W, -D], [W, D], [-W, D]]) { const p = T.put(f, [a, y + 2.4, c]); (R() < 0.3 ? lamp : dot)(p[0], p[1], p[2]); }
        for (let k = 0; k < nu; k++) if (R() < 0.6) { const p = T.put(f, [-W + (k + 0.5) * sp, y - 0.5, R() < 0.5 ? -D : D]); dot(p[0], p[1], p[2]); }
        // a horizontal drum or exchanger lying on the deck
        if (R() < 0.6 && d < decks) { const len = sp * (1 + Math.floor(R() * 2)), r = 0.8 + R() * 1.0, v = (R() - 0.5) * D; K.pipe([T.put(f, [-len / 2, y + r + 0.3, v]), T.put(f, [len / 2, y + r + 0.3, v])], r, 10, R() < 0.5 ? [24, R(), 0, 0] : [20, 0.30, 0.31, 0.30]); }
      }
      // the bracing and cladding in tiers on two faces
      for (let d = 0; d < decks; d++) if (R() < 0.55) { const y = d * sp; K.cardAt(T.put(f, [-W, y + sp, -D]), T.put(f, [W, y + sp, -D]), T.put(f, [W, y, -D]), T.put(f, [-W, y, -D]), CELLS.lattice, [23, R() < 0.5 ? 1 : 0, 0, 0], nu); }
      for (let k = 0; k < 1 + Math.floor(R() * 4); k++) { const [x, z] = loc((R() - 0.5) * W * 1.6, (R() - 0.5) * D * 1.6); column(x, z, 0.8 + R() * 1.5, decks * sp * (0.8 + R() * 0.9), R() < 0.6); }
      // lines down off the structure to the rack in the street
      for (let k = 0; k < 4; k++) { const v = (R() - 0.5) * D * 1.8, a = T.put(f, [W, sp * (1 + Math.floor(R() * decks)) - 0.6, v]), e = T.put(f, [W + STREET * 0.45, 8.5, v]); K.pipe([a, [e[0], a[1], e[2]], [e[0], y0 + 8.5, e[2]]], 0.12 + 0.2 * R(), 6, [24, R(), 0, 0]); }
    } else if (b.kind === "columns") {
      const n = 3 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) { const [x, z] = loc((k / (n - 1) - 0.5) * h * 1.6, (R() - 0.5) * h * 0.8), hh = 25 + 45 * R() * R(), r = 1.0 + 1.8 * R(); column(x, z, r, hh); if (R() < 0.7) scaffold(x, g(x, z), z, r + 1.4, hh * (0.5 + 0.4 * R()), 5); }
      const [ax, az] = loc(-h, h * 0.7), [bx, bz] = loc(h, h * 0.7); rack(ax, az, bx, bz, 7);
    } else if (b.kind === "tanks") {
      const n = R() < 0.5 ? 2 : 4, r = n === 2 ? 11 + 5 * R() : 7 + 3 * R();
      for (let k = 0; k < n; k++) {
        const [x, z] = n === 2 ? loc((k - 0.5) * h, 0) : loc((k % 2 - 0.5) * h, (Math.floor(k / 2) - 0.5) * h), y = g(x, z), t = 10 + 8 * R();
        K.lathe(x, y, z, [[r, -0.5], [r, t], [r * 0.4, t + r * 0.1], [0.1, t + r * 0.12]], 26, [25, 0.30 + 0.05 * R(), 0.31, 0.30]);
        landing(x, y + t - 0.1, z, r - 0.05, r + 0.9, [0.42, 0.33, 0.04]);
        for (let i = 0; i < 5; i++) { const a = i / 5 * 6.2832 + R(); dot(x + Math.cos(a) * (r + 0.5), y + t + 1.9, z + Math.sin(a) * (r + 0.5)); }
        lamp(x + r + 1, y + t + 2.5, z);
      }
      // the bund wall round the farm
      const f = frame(cx, g(cx, cz), cz, b.turn); for (const s of [-1, 1]) { K.box(f, -h, -0.5, s * h - 0.3, h, 1.4, s * h + 0.3, [22, R(), 0, 0]); K.box(f, s * h - 0.3, -0.5, -h, s * h + 0.3, 1.4, h, [22, R(), 0, 0]); }
    } else if (b.kind === "spheres") {
      for (let k = 0; k < 3; k++) { const [x, z] = loc((k - 1) * h * 0.66, (R() - 0.5) * 8); sphere(x, z, 6 + 2.5 * R()); }
    } else if (b.kind === "heater") {
      // a fired heater: a tall box of a firebox, its convection section and stacks, lit from below
      const f = frame(cx, g(cx, cz), cz, b.turn), w = 10 + 6 * R(), d = 7 + 3 * R(), H = 18 + 10 * R();
      K.box(f, -w / 2, -0.5, -d / 2, w / 2, H, d / 2, [21, R(), 0, 0]);
      K.box(f, -w / 2 + 1, H, -d / 2 + 1, w / 2 - 1, H + 6, d / 2 - 1, [21, R(), 0, 0]);
      for (const s of [-1, 1]) { const p = T.put(f, [s * w * 0.25, 0, 0]); stack(p[0], p[2], 1.2, H + 24 + 8 * R(), false); }
      for (let y = 6; y < H; y += 6) for (const s of [-1, 1]) { const p = T.put(f, [s * (w / 2 + 0.8), y, 0]); lamp(p[0], p[1], p[2]); landing(p[0], p[1] - 2.2, p[2], 0.2, 1.4, STEEL); }
      const fire = T.put(f, [0, 1.2, d / 2 + 0.2]); T.lights.add({ x: fire[0] + O[0], y: fire[1], z: fire[2] + O[2], col: T.HUE.flare, power: 120, reach: 26, size: 0, glow: 0, flicker: 0.3 });
      K.face(f, [-w / 2 + 1, 0.4, d / 2 + 0.06], [w / 2 - 1, 0.4, d / 2 + 0.06], [w / 2 - 1, 1.6, d / 2 + 0.06], [-w / 2 + 1, 1.6, d / 2 + 0.06], [16, 1.0, 0.36, 0.08]);
    } else {
      // cooling cells: a long low box of fans, a plume over each in the cold
      const f = frame(cx, g(cx, cz), cz, b.turn), n = 4 + Math.floor(R() * 3), cw = 9;
      K.box(f, -n * cw / 2, -0.5, -6, n * cw / 2, 9, 6, [25, 0.13, 0.15, 0.16]);
      for (let k = 0; k < n; k++) { const p = T.put(f, [(k + 0.5 - n / 2) * cw, 9, 0]); K.lathe(p[0], p[1], p[2], [[3.4, 0], [3.6, 2.4], [3.9, 3.0]], 16, [25, 0.13, 0.15, 0.16]); dot(p[0] + 3.6, p[1] + 3.3, p[2]); }
      for (const s of [-1, 1]) for (let k = 0; k <= n; k++) { const p = T.put(f, [(k - n / 2) * cw, 4.5, s * 6.4]); dot(p[0], p[1], p[2]); }
    }
  }
  for (const [ax, az, bx, bz] of P.layout.streets) rack(ax - O[0], az - O[2], bx - O[0], bz - O[2], 8 + Math.round(Math.abs(Math.sin(ax * 0.013)) * 4));
}
