// The street round a hero view: the ground under a real depth of snow, the houses at hero density,
// the street lamps, the cables and the far land. Everything is placed from the town's plan
// (town.mjs plan), so the same seed gives the same street.
// The ground carries four blend weights in COLOR_0 for the frame's layered ground material:
// packed snow, trodden snow, cobbles and bare earth; the rest is fresh snow. Its height is the
// world's ground plus the snow: deep and drifted off the lanes, banks of cleared snow along them,
// packed with two worn tracks down each lane, scraped to the cobbles in front of each door.
import { heightAt, baseGround } from "../../data.mjs";
import { HeroMesh, lerp } from "./hmesh.mjs";
import { heroHouse } from "./hhouse.mjs";
import { streetLamp, cable, fbm } from "./hparts.mjs";
import { put } from "../kit.mjs";

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// signed distance to the nearest lane's edge (negative inside), the lane, and the offset across it
function laneAt(P, x, z) {
  let best = { d: 1e9, v: 0, L: null };
  for (const L of P.lanes) {
    const vx = L.b[0] - L.a[0], vz = L.b[1] - L.a[1], t = Math.max(0, Math.min(1, ((x - L.a[0]) * vx + (z - L.a[1]) * vz) / (L.len * L.len)));
    const px = x - L.a[0] - vx * t, pz = z - L.a[1] - vz * t, d = Math.hypot(px, pz) - L.half;
    if (d < best.d) best = { d, v: (px * -vz + pz * vx) / L.len, L };
  }
  return best;
}
// the house whose footprint is nearest, and the distance outside its walls (negative inside)
function houseAt(H, x, z) {
  let best = { d: 1e9, h: null, u: 0, w: 0 };
  for (const h of H) {
    if (Math.abs(h.x - x) > 12 || Math.abs(h.z - z) > 12) continue;
    const c = Math.cos(h.turn), s = Math.sin(h.turn), dx = x - h.x, dz = z - h.z, u = dx * c - dz * s, w = dx * s + dz * c;
    const qx = Math.abs(u) - h.W / 2, qz = Math.abs(w) - h.D / 2, d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
    if (d < best.d) best = { d, h, u, w };
  }
  return best;
}

// distance outside a house's footprint with its corners rounded by a metre, so drifts turn the corner
// smoothly instead of meeting along a crease
function smoothFoot(ho) {
  const r = 1.0, qx = Math.abs(ho.u) - (ho.h.W / 2 - r), qz = Math.abs(ho.w) - (ho.h.D / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}
// height of the ground under the snow, the snow's depth and the blend weights, at a world point
export function groundOf(world, P, H, x, z) {
  const ln = laneAt(P, x, z), ho = houseAt(H, x, z), raw = baseGround(world, x, z), flat = heightAt(world, x, z);
  // the town is built on levelled ground (the WebGPU walk does the same with its built map): the
  // relief fades out over the town's reach, and lanes and yards are flatter still
  const inTown = smooth(P.reach + 40, P.reach - 40, Math.hypot(x - P.cx, z - P.cz));
  const level = Math.max(inTown * 0.9, smooth(3, -0.5, ln.d), ho.h ? smooth(2.5, 0.2, ho.d) : 0);
  let g = lerp(raw, flat, level);
  if (ho.h) g = lerp(g, ho.h.y + 0.05, smooth(2.0, 0.3, ho.d));
  const n = fbm(x * 0.35, z * 0.35), fine = fbm(x * 2.7 + 11, z * 2.7 + 5);
  let snow = 0.42 + 0.16 * n + 0.03 * fine, w = [0, 0, 0, 0];
  const inLane = smooth(0.6, -0.4, ln.d);
  if (inLane > 0) {
    const across = Math.abs(ln.v), half = ln.L.half, track = Math.exp(-Math.pow((across - half * 0.42) / 0.28, 2));
    const packed = 0.05 + 0.02 * fine - 0.035 * track;
    snow = lerp(snow, packed, inLane);
    w = [inLane * (1 - track * 0.8), inLane * track * 0.85, 0, 0];
  }
  // the bank of cleared snow just off the lane, and drifts against the walls (deeper to the north-west)
  const bank = Math.exp(-Math.pow((ln.d - 0.75) / 0.55, 2)) * (0.38 + 0.2 * n);
  snow += bank * (1 - inLane * 0.7);
  if (ho.h) {
    // wind-shaped drifts against the walls: a smooth swell whose reach and height wander with noise,
    // deeper to the north-west, with a soft drip trench under the eaves and ripples on top
    const r2 = smoothFoot(ho), windward = Math.max(0, -(x - ho.h.x) * 0.6 - (z - ho.h.z) * 0.8) / 6;
    const reach = 1.1 + 1.0 * fbm(x * 0.37 + 3, z * 0.37 + 7), height = (0.18 + 0.45 * windward) * (0.7 + 0.6 * fbm(x * 0.21, z * 0.21));
    const t = Math.min(1, Math.max(0, r2 / reach)), swell = height * Math.pow(1 - t * t * (3 - 2 * t), 1.6);
    const drip = 0.1 * Math.exp(-Math.pow((r2 - 0.55 - 0.15 * fine) / 0.3, 2));
    const ripple = 0.022 * Math.sin((x * 0.8 - z * 0.6) * 5.5 + fbm(x * 0.9, z * 0.9) * 6) * (1 - inLane);
    snow = Math.max(0.02, snow + swell - drip + ripple);
    // nothing piles past the window sills
    const cap = 0.85 + 0.6 * Math.min(1, r2 / 2.5), k = 0.25, hm = Math.max(k - Math.abs(snow - cap), 0) / k;
    snow = Math.min(snow, cap) - hm * hm * k * 0.25;   // a smooth minimum, so the cap leaves no ridge
    // in front of the door the snow is shovelled back to the cobbles, in a rough oval with a berm round it
    const du = (ho.u - ho.h.doorX) / (0.95 + 0.12 * fbm(x * 3, z * 3)), dw = (ho.w - ho.h.D / 2 - 0.55) / (1.05 + 0.15 * fbm(x * 2.3, z * 2.3));
    const e = Math.hypot(du, dw);
    if (e < 1.6) {
      // the cut walls of the clearing slope off over a third of a metre, the berm low and soft
      const k = 1 - smooth(0.55, 1.2, e), berm = 0.1 * Math.exp(-Math.pow((e - 1.25) / 0.3, 2)) * (0.7 + 0.6 * fine);
      snow = lerp(snow, 0.012, k) + berm * (1 - k);
      w = [w[0] * (1 - k), w[1] * (1 - k), k * 0.92, k * 0.08];
    }
    if (ho.d < 0.4) w[3] = Math.max(w[3], smooth(0.4, 0.1, ho.d) * 0.5);
  }
  return { g, snow, w, inHouse: ho.d < -0.05 };
}

// the ground grid in the view's frame: rows along the view, spaced by distance; columns across it
function groundMesh(M, world, P, H, O, view) {
  const fx = Math.sin(view.yaw), fz = -Math.cos(view.yaw), rx = Math.cos(view.yaw), rz = Math.sin(view.yaw);
  const rows = [], cols = [];
  for (let d = -30; d < 260; d += d < 30 ? 0.16 : d < 80 ? 0.35 : 0.9) rows.push(d);
  for (let a = 0; a < 70; a += a < 10 ? 0.16 : a < 25 ? 0.35 : 0.9) { cols.push(a); if (a > 0) cols.unshift(-a); }
  const idx = [], hole = [];
  for (const d of rows) for (const a of cols) {
    const x = view.x + fx * d + rx * a, z = view.z + fz * d + rz * a, q = groundOf(world, P, H, x, z);
    const p = [x - O[0], q.g + q.snow - O[1], z - O[2]];
    idx.push({ p, w: q.w, uv: [x - O[0], z - O[2]] });
    hole.push(q.inHouse);
  }
  const nc = cols.length, at = (i, j) => j * nc + i, ids = new Array(idx.length);
  // normals from the neighbours
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < nc; i++) {
    const c = idx[at(i, j)], l = idx[at(Math.max(0, i - 1), j)], r = idx[at(Math.min(nc - 1, i + 1), j)], b = idx[at(i, Math.max(0, j - 1))], t = idx[at(i, Math.min(rows.length - 1, j + 1))];
    const du = [r.p[0] - l.p[0], r.p[1] - l.p[1], r.p[2] - l.p[2]], dv = [t.p[0] - b.p[0], t.p[1] - b.p[1], t.p[2] - b.p[2]];
    let n = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
    if (n[1] < 0) n = n.map((v) => -v);
    const L = Math.hypot(...n) || 1;
    ids[at(i, j)] = M.v("ground", c.p, n.map((v) => v / L), c.uv[0], c.uv[1], c.w);
  }
  for (let j = 0; j + 1 < rows.length; j++) for (let i = 0; i + 1 < nc; i++) {
    if (hole[at(i, j)] && hole[at(i + 1, j)] && hole[at(i, j + 1)] && hole[at(i + 1, j + 1)]) continue;
    M.tri("ground", ids[at(i, j)], ids[at(i + 1, j)], ids[at(i + 1, j + 1)]); M.tri("ground", ids[at(i, j)], ids[at(i + 1, j + 1)], ids[at(i, j + 1)]);
  }
}

// the land beyond the street: the raster under snow, 16 m cells, sunk where the street grid lies
function farLand(M, world, O, view) {
  const R = 1800, step = 16;
  M.grid("snow", (s, t) => {
    // sunk well under the street grid where that grid lies (which levels the town's relief), and
    // eased back up beyond it, so no far cell pokes through the near snow
    const x = view.x - R + 2 * R * s, z = view.z - R + 2 * R * t, sink = 4 * smooth(320, 220, Math.hypot(x - view.x, z - view.z));
    return [x - O[0], baseGround(world, x, z) + 0.4 - sink - O[1], z - O[2]];
  }, (2 * R) / step, (2 * R) / step, (s, t) => [s * 2 * R * 0.25, t * 2 * R * 0.25]);
}

export function street(world, P, view, opts = {}) {
  const M = new HeroMesh(), L = Object.assign([], { smoke: [] }), O = [view.x, Math.round(baseGround(world, view.x, view.z)), view.z];
  const fx = Math.sin(view.yaw), fz = -Math.cos(view.yaw), seen = (x, z, back = 25, side = 60, far = 280) => {
    const d = (x - view.x) * fx + (z - view.z) * fz, a = Math.abs((x - view.x) * Math.cos(view.yaw) + (z - view.z) * Math.sin(view.yaw));
    return d > -back && d < far && a < side;
  };
  const H = P.houses.filter((h) => seen(h.x, h.z));
  // each house stands on the levelled ground at its middle (the plan sat it on the unlevelled ground)
  for (const h of H) { h.y = undefined; }
  for (const h of H) { const q = groundOf(world, P, [], h.x, h.z); h.y = q.g; }
  // where each door is, before the ground is laid, so the ground can clear it
  const built = [];
  for (const h of H) {
    const lod = Math.hypot(h.x - view.x, h.z - view.z) < (opts.heroRadius || 90) ? 0 : 1;
    const out = heroHouse(M, h, O, L, lod);
    h.doorX = out.doorX;
    built.push({ h, out });
  }
  groundMesh(M, world, P, H, O, view);
  farLand(M, world, O, view);
  const T = { M, R: mulberry(world.json.seed ^ 0x51ee7), L, col: [0.5, 0.2, 0.2, 0.5] };
  for (const l of P.lamps) if (seen(l.x, l.z)) {
    const q = groundOf(world, P, H, l.x, l.z);
    streetLamp(T, l.x - O[0], q.g - O[1], l.z - O[2], l.ax, l.az);
  }
  // cables slung across the street from eave to eave
  for (const { h, out } of built) {
    if (T.R() > 0.5) continue;
    const other = built.find((b) => b.h !== h && Math.hypot(b.h.x - h.x, b.h.z - h.z) < 16 && h.fx * b.h.fx + h.fz * b.h.fz < -0.5);
    if (!other) continue;
    for (let k = 0; k < 1 + Math.floor(T.R() * 2); k++) cable(T, put(out.f, [(T.R() - 0.5) * h.W * 0.6, h.hw - 0.3 - k * 0.15, h.D / 2 + 0.15]), put(other.out.f, [(T.R() - 0.5) * other.h.W * 0.6, other.h.hw - 0.35 - k * 0.12, other.h.D / 2 + 0.15]), 0.4 + 0.4 * T.R());
  }
  // a light that the snow has buried (a window low on a drifted wall) is left out
  const lit = L.filter((l) => { const q = groundOf(world, P, H, l.p[0] + O[0], l.p[2] + O[2]); return l.p[1] + O[1] > q.g + q.snow + 0.35; });
  return { M, L: lit, O, houses: H.length, smoke: L.smoke || [] };
}

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
