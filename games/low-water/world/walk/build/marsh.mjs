// The reed halls of the marsh. The form is the Marsh Arab mudhif of southern Iraq, credited and
// transformed: a guest hall of reed, its arches bundles of reed bent over and tied at the crown,
// the skin between them woven reed mats, the ends a lattice screen with a door between two tall
// bundled pillars. Inside, a hearth with its coffee pots in the middle of the floor and carpets
// and cushions down both walls (the saved reference img-008 6). Each hall stands on its own
// island of packed reed and mud in open water, with a long boat drawn up beside it.
import { frame, put } from "./kit.mjs";
import { rng } from "../flora/grow.mjs";
import { baseGround, waterAt } from "../data.mjs";
import { HUE } from "../lights.mjs";
import { VERNACULAR, lantern, person } from "./parts.mjs";

export const owns = (m) => m.kind === "mudhif";
const RUGS = [[0.42, 0.05, 0.04], [0.10, 0.10, 0.32], [0.48, 0.10, 0.05], [0.30, 0.04, 0.05], [0.45, 0.32, 0.10]];

export function plans(world) {
  const marks = world.json.marks.filter(owns).map((m) => ({ ...m, wx: (m.x + 0.5) * world.cell, wz: (m.y + 0.5) * world.cell })), out = [];
  for (const m of marks) { const c = out.find((q) => Math.hypot(q.cx - m.wx, q.cz - m.wz) < 3000); if (c) c.marks.push(m); else out.push({ cx: m.wx, cz: m.wz, marks: [m] }); }
  for (const c of out) c.reach = Math.max(...c.marks.map((m) => Math.hypot(m.wx - c.cx, m.wz - c.cz))) + 120;
  return out;
}

// the arch: a pointed parabola across the width, from the floor to the crown
const arch = (half, H, t) => { const s = t * 2 - 1; return [s * half * (1 - 0.08 * (1 - Math.abs(s))), H * (1 - Math.abs(s) ** 1.7)]; };

function hall(T, f, L, half, H) {
  const { K, R } = T, ribs = Math.round(L / 1.6), N = 14, reed = (v) => [29, v, 0, 0];
  // the skin: woven mat between the arches, the full length of the hall
  for (let i = 0; i < N; i++) { const [x0, y0] = arch(half, H, i / N), [x1, y1] = arch(half, H, (i + 1) / N); K.face(f, [x0, y0, -L / 2], [x0, y0, L / 2], [x1, y1, L / 2], [x1, y1, -L / 2], [29, 0.15, 1, 0]); }
  // the arches: bundles a forearm thick, standing proud of the skin inside and out
  for (let r = 0; r <= ribs; r++) {
    const z = -L / 2 + r * L / ribs, pts = [];
    for (let i = 0; i <= N; i++) { const [x, y] = arch(half - 0.05, H, i / N); pts.push(put(f, [x, Math.max(-0.3, y - 0.05), z])); }
    K.pipe(pts, 0.13, 6, reed(0.75 + 0.2 * R()));
  }
  // the ends: a lattice screen with a doorway, two tall pillars of bound reed either side
  for (const s of [-1, 1]) {
    const z = s * L / 2;
    for (let i = 0; i < N; i++) {
      const [x0, y0] = arch(half, H, i / N), [x1, y1] = arch(half, H, (i + 1) / N);
      if (Math.abs((x0 + x1) / 2) < 0.8) continue;
      K.face(f, [x0, 0, z], [x1, 0, z], [x1, y1, z], [x0, y0, z], [29, 0.3, 2, 0]);
    }
    K.face(f, [-0.8, 2.3, z], [0.8, 2.3, z], [0.8, arch(half, H, 0.5)[1] * 0.97, z], [-0.8, arch(half, H, 0.5)[1] * 0.97, z], [29, 0.3, 2, 0]);
    for (const px of [-half - 0.4, half + 0.4]) { const b = put(f, [px, -0.3, z]); K.lathe(b[0], b[1], b[2], [[0.55, 0], [0.5, H * 0.6], [0.42, H * 1.05], [0.3, H * 1.18], [0.05, H * 1.25]], 10, reed(0.6)); for (let k = 1; k < 6; k++) K.lathe(b[0], b[1] + k * H * 0.2, b[2], [[0.56, 0], [0.56, 0.12]], 10, [14, 0.2, 0, 0]); }
  }
  // inside: a floor of mats, carpets and cushions down both walls, the hearth in the middle
  K.face(f, [-half, 0.03, -L / 2], [half, 0.03, -L / 2], [half, 0.03, L / 2], [-half, 0.03, L / 2], [29, 0.2, 1, 0]);
  for (const s of [-1, 1]) for (let z = -L / 2 + 1.2; z < L / 2 - 1.5; z += 1.1 + 0.4 * R()) {
    const c = Math.floor(R() * RUGS.length), x = s * (half - 0.9);
    K.box(f, x - 0.45, 0, z, x + 0.45, 0.22, z + 1.0, [33, c, R(), 0], true);
    K.box(f, s > 0 ? x + 0.3 : x - 0.45, 0.22, z + 0.05, s > 0 ? x + 0.45 : x - 0.3, 0.75, z + 0.95, [33, Math.floor(R() * RUGS.length), R(), 1], true);
  }
  K.box(f, -0.9, 0, -0.9, 0.9, 0.28, 0.9, [22, 0.7, 0, 0], true);
  K.face(f, [-0.65, 0.29, -0.65], [0.65, 0.29, -0.65], [0.65, 0.29, 0.65], [-0.65, 0.29, 0.65], [16, 1.0, 0.36, 0.08]);
  for (let i = 0; i < 3; i++) { const p = put(f, [-0.35 + i * 0.35, 0.29, (i - 1) * 0.15]), h = 0.25 + 0.1 * (i === 1); K.lathe(p[0], p[1], p[2], [[0.09, 0], [0.11, h * 0.5], [0.05, h * 0.75], [0.06, h], [0.02, h + 0.08]], 10, [20, 0.55, 0.40, 0.10]); }
  const fire = put(f, [0, 0.6, 0]); T.lights.add({ x: fire[0] + T.O[0], y: fire[1], z: fire[2] + T.O[2], col: HUE.flare, power: 40, reach: 14, size: 0.1, flicker: 0.5, glow: 0.3 });
  lantern(T, f, 0, H * 0.55, -L / 2 + 2, "paraffin", 0);
  const door = put(f, [0, 1.6, L / 2 + 0.6]); T.lights.add({ x: door[0] + T.O[0], y: door[1], z: door[2] + T.O[2], col: HUE.paraffin, power: 10, reach: 10, size: 0, glow: 0 });
}

// a long boat of tarred reed and plank: a shallow hull turned on its length, high at both ends
function boat(T, x, y, z, turn) {
  const { K } = T, c = Math.cos(turn), s = Math.sin(turn), pts = [], r = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10 * 2 - 1, u = t * 4.5; pts.push([x + u * c, y + 0.15 + 0.45 * t ** 4, z - u * s]); r.push(0.08 + 0.42 * (1 - t * t)); }
  K.pipe(pts, r, 8, [14, 0.1, 0, 0]);
}

export function mesh(world, P, K, O, lights) {
  const R = rng(world.json.seed + 6606 + Math.floor(P.cx)), T = { K, R, O, lights, V: VERNACULAR.marsh };
  for (const m of P.marks) {
    const wx = m.wx, wz = m.wz, w = waterAt(world, wx, wz), y = Math.max(w > -500 ? w + 0.35 : -9, baseGround(world, wx, wz) + 0.05), turn = m.turn_deg * Math.PI / 180;
    const L = m.size_m, half = 3.0 + 0.6 * R(), H = Math.max(6, m.tall_m * 0.75), f = frame(wx - O[0], y + 0.3, wz - O[2], turn);
    // the island: packed reed and mud, a little wider than the hall, its edge stepping into the water
    K.lathe(wx - O[0], y - 1.2, wz - O[2], [[L * 0.62, 0], [L * 0.6, 1.3], [L * 0.56, 1.45], [0.1, 1.47]], 24, [29, 0.1, 0, 0]);
    hall(T, f, L, half, H);
    boat(T, wx - O[0] + Math.cos(turn) * (half + 4), (w > -500 ? w : y - 0.3), wz - O[2] - Math.sin(turn) * (half + 4), turn + 1.57 + (R() - 0.5) * 0.5);
    // the host at the door, and a guest arriving
    const d = put(f, [0.6, 0, L / 2 + 1.5]); person(T, d[0], y, d[2], turn, { umbrella: false });
    if (R() < 0.6) { const g = put(f, [-1.4, 0, L / 2 + 4]); person(T, g[0], y, g[2], turn + 3.1, { umbrella: false }); }
  }
}
