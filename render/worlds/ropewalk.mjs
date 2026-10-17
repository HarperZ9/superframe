// The Ropewalk: a long straight lane laid for rope, cobbles, the old rope groove across the street,
// the telegraph wire strung on the old rope posts, the telegraph office (a municipal-green door, a
// yellow curled card in the window, an upstairs sash), the Gannet house four doors up (the brass
// letter flap the only bright thing on it, a step that rocks), the yard-wide passage behind it (a lit
// shutter, a warm grating over a lead pipe), and the warm pipe up the street that frost will not
// settle on. Laid on the combat arena (arenas2.mjs ROPEWALK, 26 x 6): world x, z = arena x, z, the
// lane at y = 0 (arena h 9), paraffin lamps at (6, 1) and (19, 1), exits at both ends. The lane runs
// on past the arena both ways. Near-side houses (z > 6) are cut to their ground floor.
// Original block-out (Low Water look work).
import { box, cyl, cap, gable, vnoise, sat } from "../sdf.mjs";
import { makeWorld, rnd } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";

const PAINTS = [ID.brickdark, ID.limewash, ID.brick, ID.bone, ID.brickdark, ID.teal];
export const PIPE_Z = 4.2;
export function ropewalk() {
  const W = makeWorld({ cell: 2, margin: 0.5 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.map((v) => v.toFixed(2)).join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  W.ground((x, y, z, T) => {
    T(Math.max(y, Math.abs(z - 3) - 3.0), ID.cobble);
    T(Math.max(y - 0.1, Math.abs(z - 3) - 3.6, -(Math.abs(z - 3) - 3.0)), ID.slab); // the footways
    T(Math.max(y + 0.02, Math.abs(x - 13.4) - 0.07, Math.abs(z - 3) - 3.6) , ID.iron); // the old rope groove, an iron strip across the street
    T(Math.max(y + 0.02, -(Math.abs(z - 3) - 3.6)), ID.cobble); // yards beyond the footways
  });
  // houses both sides; the telegraph office and the Gannet house on the north side
  for (const side of [-1, 1]) for (let k = 0; k < 12; k++) {
    const cx = -14 + k * 4.6 + (side > 0 ? 1.4 : 0), w = 2.2, near = side > 0, h = near ? 1.0 : 6.5 + 2 * rnd(k, side), cz = side < 0 ? -2.5 : 8.5, fz = side < 0 ? -0.6 : 6.6, seed = 80 + k * 2 + (near ? 1 : 0);
    const special = !near && (k === 4 ? "telegraph" : k === 7 ? "gannet" : null);
    add(K.shape([cx - w - 0.6, 0, cz - 2.4, cx + w + 0.6, h + 3.2, cz + 2.4], (x, y, z, T) => {
      if (near) { T(box(x, y, z, cx, 0.2, fz + 0.15, w, 0.2, 0.15), ID.brickdark); return; }
      T(box(x, y, z, cx, h / 2, cz, w, h / 2, 1.9), special === "telegraph" ? ID.limewash : PAINTS[(k + 2) % PAINTS.length]); T(gable(x, y, z, cx, h, cz, w + 0.15, 2.1, 1.3), ID.roof);
      T(cap(x, y, z, [cx + 1.2, h + 0.8, cz - 0.6], [cx + 1.2, h + 2.6, cz - 0.6], 0.2), ID.chimney);
      const dk = special === "telegraph" ? ID.green : special === "gannet" ? ID.navy : rnd(seed, 1) < 0.5 ? ID.tar : ID.oxblood;
      T(box(x, y, z, cx - 0.9, 1.05, fz + 0.02, 0.5, 1.05, 0.05), dk); T(box(x, y, z, cx - 0.9, 0.08, fz + 0.3, 0.6, 0.08, 0.25), ID.steps);
      const lit = special || rnd(seed, 2) < 0.25;
      T(box(x, y, z, cx + 0.8, 1.6, fz + 0.02, 0.5, 0.55, 0.04), lit ? ID.windowdim : ID.glass); T(box(x, y, z, cx + 0.8, 4.3, fz + 0.02, 0.45, 0.55, 0.04), rnd(seed, 3) < 0.15 ? ID.window : ID.glass);
      if (special === "telegraph") T(box(x, y, z, cx + 0.8, 1.45, fz + 0.06, 0.16, 0.12, 0.01), ID.mustard); // the yellow curled card
      if (special === "gannet") T(box(x, y, z, cx - 0.9, 1.0, fz + 0.09, 0.12, 0.03, 0.02), ID.brass); // the letter flap
    }));
    if (special === "telegraph") { spot("telegraph_door", "pry", [cx - 0.9, 0, fz + 0.6], "the municipal-green door (R:129)"); spot("window_card", "read", [cx + 0.8, 0, fz + 0.6], "the yellow curled card for the Shelf's agent (R:776)"); L.push({ pos: [cx + 0.8, 1.6, fz + 0.5], type: 1, I: 1.4, cone: [0, 0, 1], mode: 2, reach: 5, group: "window", key: "telegraph" }); }
    if (special === "gannet") { spot("letter_flap", "eavesdrop", [cx - 0.9, 0, fz + 0.6], "the brass letter flap (R:638)"); spot("rocking_step", "wait", [cx - 0.9, 0, fz + 0.4], "a step that rocks"); marks.exits.push({ id: "gannet_wall", at: [cx + w + 0.3, 0, fz], note: "the passage behind the Gannet house" }); L.push({ pos: [cx + 0.8, 1.6, fz + 0.5], type: 1, I: 1.2, cone: [0, 0, 1], mode: 2, reach: 5, group: "window", key: "gannet" }); }
  }
  // the passage beside the Gannet house: a yard wide, a lit shutter, the warm grating
  const GX = -14 + 7 * 4.6 + 2.2 + 0.3;
  add(K.shape([GX - 0.5, 0, -4.6, GX + 0.5, 2.2, -0.6], (x, y, z, T) => { T(box(x, y, z, GX, 0.02, -2.6, 0.45, 0.03, 2.0), ID.slab); for (let k = 0; k < 6; k++) T(box(x, y, z, GX, 0.04, -1.6 + k * 0.1, 0.3, 0.02, 0.02), ID.iron); T(box(x, y, z, GX - 0.42, 1.5, -3.6, 0.03, 0.4, 0.35), ID.window); }));
  L.push({ pos: [GX, 1.5, -3.6], type: 1, I: 1.0, cone: [1, 0, 0], mode: 2, reach: 3, group: "window", key: "shutter" });
  spot("warm_grating", "pry", [GX, 0, -1.4], "the grating breathing warm air over a lead pipe (R:902)");
  marks.hides.push({ id: "passage", at: [GX, 0, -3.0], r: 0.4, note: "the yard-wide passage (R:823)" });
  // the old rope posts along the north footway with the telegraph wire; the two paraffin lamps
  for (let k = 0; k < 12; k++) { const px = -12 + k * 4.4; add(K.shape([px - 0.2, 0, 0.0, px + 0.2, 3.8, 0.4], (x, y, z, T) => { T(cyl(x, y, z, px, 1.6, 0.2, 0.09, 1.6), ID.timber); T(cap(x, y, z, [px - 0.25, 3.15, 0.2], [px + 0.25, 3.15, 0.2], 0.04), ID.timber); })); }
  add(K.rope([-12, 3.2, 0.2], [36.4, 3.2, 0.2], 0.0, 0.01, ID.iron));
  for (const lx of [6, 19]) add(K.paraffin(lx, 0, 1.0, 0, true, 22, "lantern"));
  marks.lamps.push({ id: "lamp_6", kind: "paraffin", at: [6, 3, 1], arena: [6, 1] }, { id: "lamp_19", kind: "paraffin", at: [19, 3, 1], arena: [19, 1] });
  spot("lamp_6", "douse", [6, 0, 1.4], "the street lamp; douse it (R:111)"); spot("lamp_19", "douse", [19, 0, 1.4], "the street lamp; douse it");
  spot("telegraph_wire", "rig", [10.4, 0, 0.6], "the telegraph wire on the old rope posts; hang the Vane (R:482)");
  for (let k = 0; k < 4; k++) add(K.barrel(-2 + k * 9.3, 0, 0.45 + 0.1 * (k % 2), 0.3, 0.8));
  add(K.coil(14.6, 0.1, 5.2, 0.45)); add(K.coil(26.8, 0.1, 5.4, 0.35));
  marks.exits.push({ id: "west", at: [0, 0, 3], note: "toward the quay (arena exit x 0..0.8)" }, { id: "east", at: [26, 0, 3], note: "toward the hill steps and the Gut yards (arena exit x 25.2..26)" });
  return { world: W.build(), marks, lights: (V = {}) => {
    const o = []; for (const l of L) { const f = V.emit && l.group in V.emit ? V.emit[l.group] : 1; if (f > 0) o.push({ ...l, I: l.I * f }); }
    if (V.moon) o.push({ pos: V.moon.pos, type: 2, I: V.moon.I, reach: 400, key: "moon", soft: 30 });
    return o;
  } };
}
