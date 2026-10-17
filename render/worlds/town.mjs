// The town behind Lamp Quay: the crooked five-storey row (oxblood, mustard, teal, bone), the mouth
// of the Gut between two of its houses, and the terraces climbing Chancel Hill with the gasholder
// frame against the sky. Original block-out (Low Water look work).
import { box, cyl, gable, lean, vnoise, sat, cap } from "../sdf.mjs";
import { ID } from "../kit/ids.mjs";
import { rnd } from "../kit/world.mjs";
import * as K from "../kit/props.mjs";

export const ROW_FRONT = -9.6;
const PAINTS = [ID.oxblood, ID.mustard, ID.teal, ID.bone, ID.oxblood, ID.limewash, ID.mustard, ID.teal];

export function town(W, add, { night = true, marks }) {
  // the row: houses of varied width and height, leaning on each other, a gap for the Gut
  const row = []; let x = -31;
  for (let i = 0; x < 21; i++) {
    const w = 2.0 + 1.2 * rnd(i, 1), h = 9.5 + 3.5 * rnd(i, 2);
    if (x < -21.6 && x + 2 * w > -21.6) { x = -19.4; continue; } // the Gut's mouth, x -21.6 .. -19.4
    row.push({ cx: x + w, hx: w, h, k: (rnd(i, 3) - 0.5) * 0.12, id: PAINTS[i % PAINTS.length], seed: 30 + i }); x += 2 * w + 0.02;
  }
  for (const r of row) {
    const p = add(K.house(r.cx, ROW_FRONT - 2.3, r.hx, 2.3, r.h, { k: r.k, id: r.id, seed: r.seed, lit: night ? 0.27 : 0.0, face: 1 }));
    // ground-floor lit windows spill on the street
    if (night) for (const [wx, wy, kd] of p.wins) if (wy < 4 && kd === "lit") W.__spill = (W.__spill || 0) + 1, add({ bb: [wx - 0.3, wy - 0.3, ROW_FRONT, wx + 0.3, wy + 0.3, ROW_FRONT + 0.6], light: { pos: [wx, wy, ROW_FRONT + 0.45], type: 1, I: 1.6, cone: [0, 0, 1], mode: 2, reach: 6, group: "window" }, f: () => {} });
  }
  // the Gut's mouth: a lane the width of an argument, eels in strings, a coloured wire lamp deep in
  add(K.shape([-21.7, 0, -24, -19.3, 8, ROW_FRONT], (x, y, z, T) => {
    for (let k = 0; k < 6; k++) { const ez = ROW_FRONT - 1.5 - k * 2.2; T(cap(x, y, z, [-21.5, 3.6, ez], [-19.5, 3.6, ez + 0.3], 0.02), ID.rope); for (let j = 0; j < 7; j++) T(cap(x, y, z, [-21.3 + j * 0.28, 3.55, ez + j * 0.04], [-21.3 + j * 0.28, 2.75 - 0.2 * rnd(k, j), ez + j * 0.04], 0.035), ID.fish); }
    T(box(x, y, z, -20.5, 0.35, -15, 0.3, 0.35, 0.1), ID.weed); // the gutter's lip
  }));
  for (const [gz, g] of [[-14, "gutter"], [-19, "gutter"]]) add({ bb: [-21, 3, gz - 0.3, -20, 3.6, gz + 0.3], light: { pos: [-20.5, 3.2, gz], type: 2, I: 5, reach: 7, group: g }, f: (x, y, z, T) => { T(K.shape ? Math.hypot(x + 20.5, y - 3.25, z - gz) - 0.12 : 1, ID.gutter); } });
  for (let k = 0; k < 3; k++) add(K.barrel(-21.2 + k * 0.4, 0, ROW_FRONT - 0.8 - k * 1.5, 0.3, 0.8));
  marks.exits.push({ id: "gut", at: [-20.5, 0, ROW_FRONT - 1], note: "the mouth of the Gut" });
  // Chancel Hill: terraces of narrow houses climbing behind the row, cheap boxes, every so often a lit window
  W.ground((x, y, z, T) => {
    if (z > -14.5) return;
    const lift = (zz) => 0.55 * Math.max(0, -zz - 14);
    T(box(x, y, z, -4, -1 + lift(z) / 2, -40, 40, 1 + lift(z) / 2 + 0.5, 25.5) * 0.7, ID.cobble);
    const cz = Math.floor((-z - 15) / 4.4), czc = -15 - 4.4 * (cz + 0.5), base = lift(czc) - 0.3;
    const cx = Math.floor((x + 46) / 3.2), cxc = -46 + 3.2 * (cx + 0.5), hr = (cx * 7 + cz * 13) % 5, hh = 3 + hr * 0.9;
    if (cz >= 0 && cz < 6 && cxc > -42 && cxc < 34) {
      const lx = lean(x, y, base, ((cx * 3 + cz) % 3 - 1) * 0.06);
      T(box(lx, y, z, cxc, base + hh / 2, czc, 1.4, hh / 2, 1.65) * 0.8, PAINTS[(cx + cz * 3) & 7]);
      T(gable(lx, y, z, cxc, base + hh, czc, 1.55, 1.85, 1.4) * 0.8, ID.roof);
      if ((cx * 5 + cz * 3) % 4 === 0) T(box(lx, y, z, cxc + 0.5, base + hh * 0.6, czc + 1.67, 0.25, 0.35, 0.04), night && (cx + cz) % 3 ? ID.window : ID.glass);
    }
    const bx = Math.min(x - (-46 + 3.2 * cx), -46 + 3.2 * (cx + 1) - x), bz = Math.min((-z - 15) - 4.4 * cz, 4.4 * (cz + 1) - (-z - 15));
    return T(Math.max(0.04, Math.min(bx, bz) + 0.04), 0);
  });
  // the gasholder frame on the hill's shoulder: three rings of lattice against the sky
  add(K.shape([12, 8, -44, 28, 24, -30], (x, y, z, T) => {
    const cx = 20, cz = -37, base = 10.5, q = Math.hypot(x - cx, z - cz);
    for (const ry of [3.5, 7, 10.5]) T(Math.hypot(q - 6.5, y - base - ry) - 0.12, ID.iron);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, px = cx + Math.cos(a) * 6.5, pz = cz + Math.sin(a) * 6.5; T(cap(x, y, z, [px, base, pz], [px, base + 10.6, pz], 0.14), ID.iron); }
    T(Math.max(q - 6.6, -(q - 6.2), Math.abs(y - base - 0.6) - 0.6), ID.brick);
  }));
  marks.lamps.push({ id: "gasholder", kind: "landmark", at: [20, 16, -37] });
}
