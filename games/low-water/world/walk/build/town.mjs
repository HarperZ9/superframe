// The snow town of Thaw Country. One street along the road and narrow lanes off it, houses set
// shoulder to shoulder with their eaves over the lane. One vernacular: tarred boards on a stone
// footing, a steep roof under a load of snow that rolls over the eave, ice hanging from it, a
// chimney, small-paned windows lit from inside, a paper lantern by the door, a sign board on
// every third house. The lanes are packed snow with the cleared snow banked along the walls.
// plan() is cheap and says where everything stands; mesh() makes the geometry and the lamps.
import { Kit, frame, put, dir } from "./kit.mjs";
import { CELLS } from "../flora/atlas.mjs";
import { rng } from "../flora/grow.mjs";
import { baseGround } from "../data.mjs";
import { HUE } from "../lights.mjs";
import { VERNACULAR, window as windowPart, door as doorPart, lantern, sign, chimney, clutter, cable, person } from "./parts.mjs";

const SIZE = { seat: [300, 9], town: [230, 7], village: [95, 2], house: [0, 0] };

export function plan(world, roads, s) {
  const R = rng(world.json.seed + s.id * 7717), cx = (s.x + 0.5) * world.cell, cz = (s.y + 0.5) * world.cell, [len, crossN] = SIZE[s.kind] || SIZE.village;
  // the street follows the road through the place
  const rd = roads.nearest(cx, cz, 400); let turn = R() * 3.14;
  if (rd) { const L = roads.lines[rd.line], a = L.pts[Math.max(0, rd.i - 3)], b = L.pts[Math.min(L.pts.length - 1, rd.i + 3)]; turn = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  const ax = [Math.cos(turn), Math.sin(turn)], nx = [-ax[1], ax[0]], lanes = [], houses = [], lamps = [];
  const lane = (x0, z0, x1, z1, half) => lanes.push({ a: [x0, z0], b: [x1, z1], half, len: Math.hypot(x1 - x0, z1 - z0), turn: Math.atan2(z1 - z0, x1 - x0) });
  if (len) {
    lane(cx - ax[0] * len, cz - ax[1] * len, cx + ax[0] * len, cz + ax[1] * len, 2.2);
    for (let i = 0; i < crossN; i++) {
      const t = ((i + 0.5) / crossN - 0.5) * 2 * len * 0.92 + (R() - 0.5) * 10, px = cx + ax[0] * t, pz = cz + ax[1] * t, side = i % 2 ? 1 : -1, l0 = 45 + 70 * R(), l1 = R() < 0.5 ? 30 + 50 * R() : 0;
      lane(px - nx[0] * side * l1, pz - nx[1] * side * l1, px + nx[0] * side * l0, pz + nx[1] * side * l0, 1.35);
    }
  } else lane(cx - 8, cz, cx + 8, cz, 1.3);
  const laneDist = (x, z, skip) => { let best = 1e9; for (const L of lanes) { if (L === skip) continue; const vx = L.b[0] - L.a[0], vz = L.b[1] - L.a[1], t = Math.max(0, Math.min(1, ((x - L.a[0]) * vx + (z - L.a[1]) * vz) / (L.len * L.len))); best = Math.min(best, Math.hypot(x - L.a[0] - vx * t, z - L.a[1] - vz * t) - L.half); } return best; };
  // houses down both sides of every lane, fronts to the lane
  for (const L of lanes) for (const side of [-1, 1]) {
    const ux = (L.b[0] - L.a[0]) / L.len, uz = (L.b[1] - L.a[1]) / L.len, px = -uz * side, pz = ux * side;
    for (let t = 1 + R() * 3; t < L.len - 4;) {
      const W = 5.5 + 4.5 * R(), D = 6 + 3 * R(), x = L.a[0] + ux * (t + W / 2) + px * (L.half + 0.35 + D / 2), z = L.a[1] + uz * (t + W / 2) + pz * (L.half + 0.35 + D / 2);
      const clear = laneDist(x, z, L) > Math.hypot(W, D) * 0.5 + 0.3 && !houses.some((h) => Math.hypot(h.x - x, h.z - z) < (Math.hypot(h.W, h.D) + Math.hypot(W, D)) * 0.42);
      if (clear && baseGround(world, x, z) > 0.8) {
        // the front (local +z) looks at the lane
        houses.push({ x, z, W, D, turn: Math.atan2(-px, -pz), y: baseGround(world, x, z), hw: R() < 0.4 ? 4.6 + R() : 2.7 + 0.5 * R(), pitch: 0.62 + 0.3 * R(), seed: R(), fx: -px, fz: -pz, bar: R() < (L.half > 2 ? 0.3 : 0.4) });
      }
      t += W + (R() < 0.15 ? 2.2 + R() : 0.25 + 0.5 * R());
    }
    // a lamp on a pole every so often along the street
    if (L.half > 2) for (let t = 12 + R() * 10; t < L.len; t += 30 + 12 * R()) lamps.push({ x: L.a[0] + ux * t + px * (L.half - 0.3), z: L.a[1] + uz * t + pz * (L.half - 0.3), ax: -px, az: -pz });
  }
  return { s, cx, cz, reach: len + 140, lanes, houses, lamps };
}

// what the town does to the ground: packed lanes, banks of cleared snow, dry earth under every roof
export function stamp(P, { A, B, rect, KIND }) {
  for (const L of P.lanes) rect((L.a[0] + L.b[0]) / 2, (L.a[1] + L.b[1]) / 2, -L.turn, L.len / 2 + 1, L.half, 2.2, (k, u, v) => {
    const d = Math.abs(v) - L.half;
    if (d < 0) { B[k] = 255; B[k + 1] = KIND.sett; B[k + 3] = Math.max(B[k + 3], 150 + 105 * Math.max(0, 1 - Math.abs(Math.abs(v) - L.half * 0.45) / 0.5)); B[k + 2] = 128 - 4; }
    else if (B[k] < 200) { B[k] = Math.max(B[k], 255 * Math.max(0, 0.5 - d / 4)); B[k + 2] = Math.max(B[k + 2], 128 + 64 * 0.55 * Math.max(0, 1 - Math.abs(d - 0.6) / 0.9)); }
  });
  for (const h of P.houses) rect(h.x, h.z, h.turn, h.W / 2, h.D / 2, 1.4, (k, u, v) => {
    const inside = Math.abs(u) < h.W / 2 + 0.5 && Math.abs(v) < h.D / 2 + 0.6;
    if (inside) { A[k + 2] = 255; B[k + 2] = 128; } else if (A[k + 2] < 120) A[k + 2] = 120;
    A[k + 3] = Math.max(A[k + 3], inside ? 255 : 110);
  });
}

function house(K, f, R, h, lights, O) {
  const W = h.W / 2, D = h.D / 2, hw = h.hw, ov = 0.55, rise = (D + ov) * Math.tan(h.pitch), tone = R(), wall = [10, tone, 0, 0];
  K.box(f, -W - 0.06, -0.8, -D - 0.06, W + 0.06, 0.55, D + 0.06, [15, tone, 0, 0], true);
  K.box(f, -W, 0.5, -D, W, hw, D, wall, false);
  // gables
  for (const sx of [-1, 1]) { const x = sx * W; if (sx > 0) K.tri(f, [x, hw, D], [x, hw, -D], [x, hw + D * Math.tan(h.pitch), 0], wall); else K.tri(f, [x, hw, -D], [x, hw, D], [x, hw + D * Math.tan(h.pitch), 0], wall); }
  const ridge = hw + D * Math.tan(h.pitch), eave = ridge - rise, gx = W + 0.35;
  for (const sz of [-1, 1]) {
    const e = [gx, eave, sz * (D + ov)], r = [gx, ridge, 0];
    if (sz > 0) K.face(f, [-gx, eave, e[2]], [gx, eave, e[2]], [gx, ridge + 0.02, 0], [-gx, ridge + 0.02, 0], [11, tone, 0, 0]); else K.face(f, [gx, eave, e[2]], [-gx, eave, e[2]], [-gx, ridge + 0.02, 0], [gx, ridge + 0.02, 0], [11, tone, 0, 0]);
    // the snow on this side: a sheet of points from ridge to eave and one row past it, where it rolls over
    const NX = 9, NS = 5, T = 0.62 + 0.62 * R(), ph = R() * 9, P = [];
    for (let j = 0; j <= NS + 1; j++) { const row = []; for (let i = 0; i <= NX; i++) {
      const u = i / NX, s = Math.min(1, j / NS), x = (u * 2 - 1) * (gx + 0.12), lip = j > NS ? 1 : 0;
      const t = T * (0.7 + 0.35 * Math.sin(u * 4.0 + ph) + 0.22 * Math.sin(u * 11 + ph * 2 + j) + 0.12 * Math.sin(u * 23 + ph * 3)) * (1 - 0.15 * s) * (j === 0 ? 1.05 : 1) * (i === 0 || i === NX ? 0.5 : 1);
      const zz = sz * ((D + ov) * s + lip * (0.3 + 0.18 * t)), yy = ridge - rise * s + t * Math.cos(h.pitch) * (lip ? 0.55 : 1) - lip * (0.18 + 0.2 * t);
      row.push(put(f, [x, yy + 0.03, zz + sz * t * Math.sin(h.pitch) * 0.4]));
    } P.push(row); }
    const nAt = (j, i) => { const a = P[Math.min(NS + 1, j + 1)][i], b = P[Math.max(0, j - 1)][i], c = P[j][Math.min(NX, i + 1)], d = P[j][Math.max(0, i - 1)], u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], w = [c[0] - d[0], c[1] - d[1], c[2] - d[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) * (n[1] < 0 ? -1 : 1) || 1; return n.map((v) => v / l); };
    for (let j = 0; j <= NS; j++) for (let i = 0; i < NX; i++) for (const [jj, ii] of [[j, i], [j, i + 1], [j + 1, i + 1], [j, i], [j + 1, i + 1], [j + 1, i]]) K.v(P[jj][ii], nAt(jj, ii), ii, jj, [12, 0.1 + 0.3 * tone, 0, 0]);
    // the underside of the roll, and the ends of the load
    for (let i = 0; i < NX; i++) { const a = P[NS + 1][i], b = P[NS + 1][i + 1], c = put(f, [((i + 1) / NX * 2 - 1) * gx, eave, sz * (D + ov)]), d = put(f, [(i / NX * 2 - 1) * gx, eave, sz * (D + ov)]); for (const q of [a, b, c, a, c, d]) K.v(q, dir(f, [0, -0.5, sz * 0.85]), 0, 0, [12, 0.5, 0, 0]); }
    for (const i of [0, NX]) for (let j = 0; j <= NS; j++) { const a = P[j][i], b = P[j + 1][i], s0 = Math.min(1, j / NS), s1 = Math.min(1, (j + 1) / NS), x = (i ? 1 : -1) * gx, c = put(f, [x, ridge - rise * s1, sz * (D + ov) * s1]), d = put(f, [x, ridge - rise * s0, sz * (D + ov) * s0]); for (const q of [a, b, c, a, c, d]) K.v(q, dir(f, [i ? 1 : -1, 0.2, 0]), 0, 0, [12, 0.4, 0, 0]); }
    // ice from the eave: long on the side the sun reaches
    const ice = 0.2 + 0.45 * R();
    K.cardAt(put(f, [-gx, eave + 0.02, e[2] + sz * 0.02]), put(f, [gx, eave + 0.02, e[2] + sz * 0.02]), put(f, [gx, eave - ice, e[2] + sz * 0.02]), put(f, [-gx, eave - ice, e[2] + sz * 0.02]), CELLS.icicle, [17, 0, 0, 0], Math.max(1, Math.round(gx / 1.6)));
    void r;
  }
  const T = { K, R, O, lights, V: VERNACULAR.snow };
  chimney(T, f, (R() - 0.5) * W, ridge - 0.5, -0.57);
  // front: a door under its own small roof, windows with small panes, an upper row where there is a floor
  const doorX = (R() - 0.5) * W * 1.1;
  doorPart(T, f, doorX, D);
  for (const x of [-W * 0.62, W * 0.62]) if (Math.abs(x - doorX) > 1.5) windowPart(T, f, x, 1.25, Math.min(2.2, W * 0.55), 1.15, D, 1, R() < 0.72, 4);
  if (hw > 4.2) for (const x of [-W * 0.5, W * 0.5]) windowPart(T, f, x, hw - 1.75, 1.2, 1.1, D, 1, R() < 0.5, 3);
  windowPart(T, f, (R() - 0.5) * W, 1.3, 1.1, 1.0, -D, -1, R() < 0.3, 3);
  // a bar hangs a row of red lanterns under its eave; a house hangs one paper lantern by the door
  if (h.bar) for (let i = 0; i < 2 + Math.floor(R() * 3); i++) lantern(T, f, doorX - 1.2 + i * 0.75, 2.1, D, "red", 0.35);
  else lantern(T, f, doorX + 0.8, 1.95, D, "paper", 0.38);
  // signs: a board over the door, a light box standing out from the wall
  if (h.bar || R() < 0.6) sign(T, f, doorX, Math.min(hw - 0.9, 2.72), D, false);
  if (h.bar || R() < 0.5) sign(T, f, (R() < 0.5 ? -1 : 1) * W * 0.85, 2.0 + R() * 0.6, D, true);
  // what stands outside: two or three pieces along the front
  for (let i = 0; i < 2 + Math.floor(R() * 2); i++) { const x = (R() - 0.5) * W * 1.8; if (Math.abs(x - doorX) > 0.9) clutter(T, f, x, D); }
}

export function mesh(world, P, lights) {
  const K = new Kit(), O = [P.cx, 0, P.cz], R = rng(world.json.seed + P.s.id * 31);
  for (const h of P.houses) house(K, frame(h.x - O[0], h.y + 0.1, h.z - O[2], h.turn), rng(Math.floor(h.seed * 1e9)), h, lights, O);
  const T = { K, R, O, lights, V: VERNACULAR.snow };
  // cables slung across the lanes from eave to eave
  for (const h of P.houses) {
    if (R() > 0.55) continue;
    const a = put(frame(h.x - O[0], h.y, h.z - O[2], h.turn), [(R() - 0.5) * h.W * 0.8, h.hw - 0.15, h.D / 2 + 0.1]);
    let best = null, bd = 16;
    for (const q of P.houses) { const d = Math.hypot(q.x - h.x, q.z - h.z); if (q !== h && d < bd && h.fx * q.fx + h.fz * q.fz < -0.5) { bd = d; best = q; } }
    if (best) for (let k = 0; k < 1 + Math.floor(R() * 3); k++) cable(T, [a[0], a[1] + k * 0.12, a[2] + k * 0.1], put(frame(best.x - O[0], best.y, best.z - O[2], best.turn), [(R() - 0.5) * best.W * 0.8, best.hw - 0.2 - k * 0.1, best.D / 2 + 0.1]), 0.35 + 0.4 * R());
  }
  // people out in the snow: alone, in pairs, most under umbrellas, more on the street than the lanes
  for (const L of P.lanes) {
    const ux = (L.b[0] - L.a[0]) / L.len, uz = (L.b[1] - L.a[1]) / L.len, n = Math.round(L.len / (L.half > 2 ? 11 : 20));
    for (let i = 0; i < n; i++) {
      const t = R() * L.len, off = (R() - 0.5) * L.half * 1.3, x = L.a[0] + ux * t - uz * off, z = L.a[1] + uz * t + ux * off, turn = Math.atan2(-uz, ux) + (R() < 0.5 ? 0 : Math.PI) + Math.PI / 2;
      person(T, x - O[0], baseGround(world, x, z), z - O[2], turn);
      if (R() < 0.3) person(T, x - O[0] + ux * 0.2 - uz * 0.6, baseGround(world, x, z), z - O[2] + uz * 0.2 + ux * 0.6, turn, { umbrella: false, child: R() < 0.3 });
    }
  }
  // street lamps: a wooden pole, an arm, a sodium lamp under a tin shade
  for (const l of P.lamps) {
    const y = baseGround(world, l.x, l.z), f = frame(l.x - O[0], y, l.z - O[2], 0), hx = l.ax * 0.9, hz = l.az * 0.9;
    K.box(f, -0.09, -0.5, -0.09, 0.09, 5.6, 0.09, [10, 0.3, 0, 0]);
    K.pipe([[l.x - O[0], y + 5.3, l.z - O[2]], [l.x - O[0] + hx, y + 5.5, l.z - O[2] + hz]], 0.035, 4, [20, 0.05, 0.05, 0.05]);
    K.box(frame(l.x - O[0] + hx, y + 5.3, l.z - O[2] + hz, 0), -0.16, 0, -0.16, 0.16, 0.14, 0.16, [16, 1.0, 0.56, 0.16], true, true);
    K.box(frame(l.x - O[0] + hx, y + 5.44, l.z - O[2] + hz, 0), -0.24, 0, -0.24, 0.24, 0.07, 0.24, [12, 0.1, 0, 0]);
    lights.add({ x: l.x + hx, y: y + 5.25, z: l.z + hz, col: HUE.sodium, power: 34, reach: 17, mono: 1, aim: [0, -1, 0], cone: 0.42, size: 0.14, flicker: R() < 0.12 ? 0.6 : 0 });
  }
  return { data: K.data, origin: O };
}
