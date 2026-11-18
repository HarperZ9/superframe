// A hero house of the snow town: the same plan (town.mjs) at the density a camera at the door
// needs. A stone footing of single bevelled blocks; a timber frame (posts, sill, plate and rails);
// walls of single vertical boards with battens over the joints, cut round every opening and up
// each gable; windows with frames, muntins, a sill of snow and a room behind the glass; a plank
// door under a hood. The roof, its load of snow and its ice are hroof.mjs.
// Wear: every vertex carries wear (the house's age, more on the weather side and low down), wetness
// (the splash zone over the snow line) and dirt; the frame's shader ages the scanned textures by it.
import { frame, put, dir } from "../kit.mjs";
import { snowPillow, lantern, signBoard, signBox, clutter, HUE } from "./hparts.mjs";
import { roof } from "./hroof.mjs";
import { chooseStyle, halfTimber, dormer, porch, balcony, shed, fence, settle, mark } from "./hvariety.mjs";

// wear at a point of a wall: age, the side the weather comes from (north-west), height above ground
function wearAt(T, f, p, n) {
  const w = dir(f, n), weather = Math.max(0, -w[0] * 0.6 - w[2] * 0.8), low = Math.max(0, 1 - p[1] / 1.2);
  return [Math.min(1, T.age * (0.55 + 0.45 * weather) + 0.25 * low), Math.min(1, low * 0.9), Math.min(1, low * 0.7 + 0.1 * T.age), T.R()];
}

// the boards of one wall: the wall runs along local x from a to b at depth z (facing sgn), from y0
// up to top(x); openings [x0, x1, y0, y1] are left open with the boards cut round them
function boards(T, f, a, b, z, sgn, y0, top, openings, mat, wide = false) {
  const { M, R } = T;
  for (let x = a; x < b - 0.02;) {
    const w = Math.min(b - x, wide ? 0.9 + 0.3 * R() : 0.17 + 0.09 * R()), cx = x + w / 2, ht = top(cx), proud = wide ? 0.012 : 0.018 + 0.008 * R(), off = [R() * 7, R() * 7];
    const cuts = openings.filter((o) => cx > o[0] - 0.02 && cx < o[1] + 0.02).sort((p, q) => p[2] - q[2]);
    let y = y0;
    for (const o of [...cuts, [0, 0, ht, ht]]) {
      const yt = Math.min(o[2], ht);
      if (yt - y > 0.04) {
        M.wear = wearAt(T, f, [cx, (y + yt) / 2, z], [0, 0, sgn]);
        const zz = sgn > 0 ? [z, z + proud] : [z - proud, z];
        M.bbox(mat, f, x + (wide ? 0 : 0.003), y, zz[0], x + w - (wide ? 0 : 0.003), yt, zz[1], wide ? 0.002 : 0.004, 1, off, { top: true, bottom: true });
      }
      y = Math.max(y, o[3]);
    }
    x += w;
  }
  M.wear = T.col;
}

// one window: a frame of bevelled timber, muntins, the glass (with the room behind it), a snow sill
function windowAt(T, f, x, y, w, h, z, sgn, lit, cols, rows) {
  const { M, R } = T, s = sgn, Z = (d) => z + s * d, bx = (x0, y0, x1, y1, d0, d1) => M.bbox("timber", f, x0, y0, Math.min(Z(d0), Z(d1)), x1, y1, Math.max(Z(d0), Z(d1)), 0.01, 1, [R() * 9, R() * 9]);
  bx(x - w / 2 - 0.09, y - 0.12, x + w / 2 + 0.09, y, -0.02, 0.12);                  // sill
  bx(x - w / 2 - 0.1, y + h, x + w / 2 + 0.1, y + h + 0.13, -0.02, 0.09);            // head
  for (const sx of [-1, 1]) bx(x + sx * (w / 2 + 0.04) - 0.045, y, x + sx * (w / 2 + 0.04) + 0.045, y + h, -0.02, 0.07);
  for (let i = 1; i < cols; i++) { const mx = x - w / 2 + w * i / cols; bx(mx - 0.017, y, mx + 0.017, y + h, -0.05, 0.035); }
  for (let j = 1; j < rows; j++) { const my = y + h * j / rows; bx(x - w / 2, my - 0.017, x + w / 2, my + 0.017, -0.05, 0.035); }
  M.wear = [lit ? 0.45 + 0.55 * R() : 0, R(), 2.2 + 1.5 * R(), R() < 0.4 ? 1 : 0];
  const g = (px, py) => put(f, [px, py, Z(-0.035)]);
  if (s > 0) M.quad("glass", g(x - w / 2, y), g(x + w / 2, y), g(x + w / 2, y + h), g(x - w / 2, y + h), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  else M.quad("glass", g(x + w / 2, y), g(x - w / 2, y), g(x - w / 2, y + h), g(x + w / 2, y + h), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  M.wear = T.col;
  snowPillow(T, f, x - w / 2 - 0.09, Math.min(Z(-0.02), Z(0.12)), x + w / 2 + 0.09, Math.max(Z(-0.02), Z(0.12)), y, 0.07 + 0.05 * R(), 0.02);
  snowPillow(T, f, x - w / 2 - 0.1, Math.min(Z(-0.02), Z(0.09)), x + w / 2 + 0.1, Math.max(Z(-0.02), Z(0.09)), y + h + 0.13, 0.05, 0.015);
  // a lit room throws its light out through the glass
  // a lit room throws its light out through the glass: a lamp a hand in front of it, aimed out and
  // down so it lights the snow and the lane rather than the wall beside it
  if (lit) T.L.push({ p: put(f, [x, y + h * 0.5, Z(0.3)]), col: R() < 0.2 ? HUE.led : HUE.paraffin, power: 5 + 6 * w * h, radius: Math.min(w, h) * 0.3, aim: dir(f, [0, -0.35, s * 0.94]), cone: 0.55 });
}

// a plank door under a hood, with a step, at x on the front wall z
function doorAt(T, f, x, z, w = 0.95, h = 1.95) {
  const { M, R } = T, y = 0.55;
  for (let px = x - w / 2; px < x + w / 2 - 0.01; px += w / 6) M.bbox("cedar", f, px + 0.004, y, z - 0.03, px + w / 6 - 0.004, y + h, z + 0.005, 0.006, 1, [R() * 9, R() * 9]);
  for (const yy of [y + 0.25, y + h - 0.35]) M.bbox("timber", f, x - w / 2 + 0.03, yy, z, x + w / 2 - 0.03, yy + 0.12, z + 0.035, 0.008);
  for (const sx of [-1, 1]) M.bbox("timber", f, x + sx * (w / 2 + 0.05) - 0.06, y, z - 0.03, x + sx * (w / 2 + 0.05) + 0.06, y + h + 0.1, z + 0.08, 0.012);
  M.bbox("timber", f, x - w / 2 - 0.12, y + h + 0.1, z - 0.03, x + w / 2 + 0.12, y + h + 0.24, z + 0.1, 0.012);
  // the hood: a small roof of shingles on two brackets, and its snow
  const hx = w / 2 + 0.35;
  for (const sx of [-1, 1]) M.tube("timber", [put(f, [x + sx * (hx - 0.1), y + h - 0.2, z]), put(f, [x + sx * (hx - 0.1), y + h + 0.38, z + 0.62])], 0.035, 6);
  M.bbox("shingle", f, x - hx, y + h + 0.38, z, x + hx, y + h + 0.46, z + 0.78, 0.012, 1, [R() * 4, 0]);
  snowPillow(T, f, x - hx, z, x + hx, z + 0.78, y + h + 0.46, 0.18 + 0.1 * R(), 0.06);
  M.bbox("stone", f, x - w / 2 - 0.25, 0.25, z, x + w / 2 + 0.25, y, z + 0.5, 0.03, 1, [R() * 9, R() * 9]);
}

// the footing: two courses of stone blocks round the house
function footing(T, f, W, D) {
  const { M, R } = T;
  for (const [ax, len, sz] of [[0, W, D], [0, W, -D], [1, D, W], [1, D, -W]]) for (let course = 0; course < 2; course++) {
    const y0 = -0.35 + course * 0.45, y1 = y0 + 0.43;
    for (let t = -len - 0.08 + (course ? 0.25 : 0); t < len + 0.08;) {
      const l = Math.min(len + 0.08 - t, 0.35 + 0.45 * R()), d = 0.22 + 0.08 * R(), jit = (R() - 0.5) * 0.03;
      M.wear = [0.4 + 0.5 * T.age, 0.6, 0.6, R()];
      const [a0, a1] = [t + 0.008, t + l - 0.008], [z0, z1] = sz > 0 ? [sz - 0.1, sz + d - 0.1 + jit] : [sz - d + 0.1 + jit, sz + 0.1];
      if (ax === 0) M.bbox("stone", f, a0, y0, z0, a1, y1 + jit, z1, 0.035, 1, [R() * 9, R() * 9]);
      else M.bbox("stone", f, z0, y0, a0, z1, y1 + jit, a1, 0.035, 1, [R() * 9, R() * 9]);
      t += l;
    }
  }
  M.wear = T.col;
}

// the timber frame: corner posts, a sill on the footing, a plate under the eaves, a rail at the floor
function timberFrame(T, f, W, D, hw) {
  const { M, R } = T, s = 0.1, B = (a, b, c, d, e, g) => M.bbox("timber", f, a, b, c, d, e, g, 0.018, 1, [R() * 9, R() * 9]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(sx * W - s, 0.5, sz * D - s, sx * W + s, hw, sz * D + s);
  for (const y of hw > 4 ? [0.5, hw - 2.05, hw - 0.22] : [0.5, hw - 0.22]) {
    for (const sz of [-1, 1]) B(-W - s, y, sz * D - s * 0.9, W + s, y + 0.2, sz * D + s * 0.9);
    for (const sx of [-1, 1]) B(sx * W - s * 0.9, y, -D - s, sx * W + s * 0.9, y + 0.2, D + s);
  }
  for (const sz of [-1, 1]) for (const k of [-0.5, 0.5]) if (R() < 0.6) B(k * W - 0.07, 0.7, sz * D - s * 0.85, k * W + 0.07, hw - 0.22, sz * D + s * 0.85);
}

export function heroHouse(M, h, O, L, lod = 0) {
  let a = Math.floor(h.seed * 1e9) >>> 0;
  const R = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const f = frame(h.x - O[0], h.y + 0.1 - O[1], h.z - O[2], h.turn), W = h.W / 2, D = h.D / 2, hw = h.hw, age = 0.25 + 0.7 * R();
  const T = { M, R, L, age, col: [age, 0.2, 0.2, 0.5] };
  M.wear = T.col;
  const st = chooseStyle(R, age), m0 = mark(M), gable = (x) => hw + (D - Math.abs(x)) * Math.tan(h.pitch);
  T.roofMat = st.roofMat;
  footing(T, f, W, D);
  timberFrame(T, f, W, D, hw);
  const doorX = (R() - 0.5) * W * 1.1, open = { front: [[doorX - 0.62, doorX + 0.62, 0.55, 2.62]], back: [], gable: [] }, wins = [];
  for (const x of [-W * 0.6, W * 0.6]) if (Math.abs(x - doorX) > 1.5) { const w = Math.min(2.0, W * 0.55); wins.push(["front", x, 1.25, w, 1.15, R() < 0.75, 4, 2]); }
  const upper = hw > 4.2, split = upper ? hw - 2.05 : hw;
  if (upper) for (const x of [-W * 0.5, W * 0.5]) wins.push(["upper", x, hw - 1.75, 1.15, 1.05, R() < 0.55, 3, 2]);
  wins.push(["back", (R() - 0.5) * W, 1.3, 1.1, 1.0, R() < 0.3, 3, 2]);
  const jz = upper && st.jetty ? 0.32 : 0;
  for (const wv of wins) open[wv[0] === "upper" ? "front" : wv[0]].push([wv[1] - wv[3] / 2 - 0.1, wv[1] + wv[3] / 2 + 0.1, wv[2] - 0.12, wv[2] + wv[4] + 0.13]);
  // walls by style: boards or cedar all over, plaster in a timber frame, or plaster below and boards above
  const lowMat = st.style === "cedar" ? "cedar" : st.style === "framed" || st.style === "mixed" ? "plaster" : "boards";
  const upMat = st.style === "framed" ? "plaster" : st.style === "mixed" ? "boards" : lowMat;
  const wall = (fr, a, b, z, sgn, y0, top, op, mat) => { boards(T, fr, a, b, z, sgn, y0, top, op, mat, mat === "plaster"); if (mat === "plaster" && sgn > 0) halfTimber(T, fr, a, b, z + 0.012, y0, Math.min(top(0), 6), top); };
  wall(f, -W + 0.1, W - 0.1, D, 1, 0.6, () => split - 0.22, open.front, lowMat);
  if (upper) {
    wall(f, -W + 0.1, W - 0.1, D + jz, 1, split, () => hw - 0.22, open.front, upMat);
    if (jz) { M.bbox("timber", f, -W - 0.1, split - 0.2, D - 0.1, W + 0.1, split, D + jz + 0.05, 0.015); for (let x = -W; x <= W; x += 0.6) M.bbox("timber", f, x - 0.06, split - 0.32, D, x + 0.06, split - 0.2, D + jz, 0.01); }
  }
  boards(T, f, -W + 0.1, W - 0.1, -D, -1, 0.6, () => hw - 0.22, open.back, lowMat === "plaster" ? "plaster" : lowMat, lowMat === "plaster");
  for (const sx of [-1, 1]) {
    const g = { o: put(f, [sx * W, 0, 0]), c: Math.cos(h.turn + sx * Math.PI / 2), s: Math.sin(h.turn + sx * Math.PI / 2), turn: h.turn + sx * Math.PI / 2 };
    const gw = st.gableWindow ? [[-0.55, 0.55, gable(0) - 1.9, gable(0) - 0.85]] : [];
    const lw = R() < 0.6 ? (R() - 0.5) * D : null, lop = lw === null ? [] : [[lw - 0.6, lw + 0.6, 1.18, 2.38]];
    wall(g, -D + 0.1, D - 0.1, 0, 1, 0.6, () => split - 0.22, lop, lowMat);
    wall(g, -D + 0.1, D - 0.1, 0, 1, split - 0.22, (x) => gable(x) - 0.05, gw, upper ? upMat : lowMat);
    if (gw.length) windowAt(T, g, 0, gable(0) - 1.78, 0.85, 0.82, 0, 1, R() < 0.5, 2, 2);
    // a lower gable window on some houses, so the end walls toward the street are not blank
    if (lw !== null) windowAt(T, g, lw, 1.3, 1.0, 0.95, 0.02, 1, R() < 0.6, 2, 2);
  }
  // a wall of boards behind the frame closes each face, so no ray sees through the joints
  M.bbox("boards", f, -W + 0.02, 0.5, -D + 0.02, W - 0.02, hw, D - 0.02, 0, 1, [0, 0], { top: false, bottom: false, col: [1, 0.1, 0.1, 0] });
  for (const wv of wins) { const [side, x, y, w, hh, lit, c, r] = wv; windowAt(T, f, x, y, w, hh, side === "back" ? -D : side === "upper" ? D + jz : D, side === "back" ? -1 : 1, lit, c, r); }
  doorAt(T, f, doorX, D + 0.02);
  if (h.bar) for (let i = 0; i < 2 + Math.floor(R() * 3); i++) lantern(T, f, doorX - 1.3 + i * 0.75, 2.15, D + 0.05, "red", 0.38);
  else lantern(T, f, doorX + 0.85, 1.95, D + 0.05, "paper", 0.4);
  if (h.bar || R() < 0.6) signBoard(T, f, doorX, Math.min(split - 0.9, 2.75), D + 0.08);
  if (h.bar || R() < 0.45) signBox(T, f, (R() < 0.5 ? -1 : 1) * W * 0.82, 2.0 + R() * 0.6, D + 0.08);
  if (st.porch && !h.bar) porch(T, f, doorX, D + 0.05);
  if (upper && st.balcony) balcony(T, f, (R() - 0.5) * W * 0.6, split + 0.05, D + jz);
  if (lod === 0) for (let i = 0; i < 2 + Math.floor(R() * 2); i++) { const x = (R() - 0.5) * W * 1.7; if (Math.abs(x - doorX) > 1.4) clutter(T, f, x, D + 0.1); }
  if (st.shed) shed(T, f, R() < 0.5 ? -1 : 1, W, D);
  if (st.fence && lod === 0) fence(T, f, R() < 0.5 ? -1 : 1, W, D);
  const rf = roof(T, f, W, D, hw, h.pitch, lod, { ov: st.ov, mat: st.roofMat });
  for (let i = 0; i < st.dormers && upper; i++) dormer(T, f, (st.dormers === 1 ? 0 : (i - 0.5) * W) + (R() - 0.5) * 0.4, D, hw, h.pitch, windowAt);
  void rf;
  settle(M, m0, f, st, hw, W);
  return { f, W, D, hw, doorX };
}
