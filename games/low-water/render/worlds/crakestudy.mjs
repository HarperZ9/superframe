// The Alderman's study (Act 2, place crake_study; content/act2/hill.lwd): a stove, a desk with the Trust's
// ledger under a yellow-shaded lamp, the telephone off its hook on its side, the chair by the stove, the
// lane's white arc close at the window, the side door the station's key opens, a shelf of the Trust's
// books. About 4.5 m by 3.5 m. Original block-out.
import { box, cyl, ell, cap } from "../sdf.mjs";
import { makeWorld } from "../kit/world.mjs";
import { ID } from "../kit/ids.mjs";
import * as K from "../kit/props.mjs";
import { shell } from "./_room.mjs";

export function crakeStudy() {
  const W = makeWorld({ cell: 1.0, margin: 0.4 }), L = [], marks = { spots: [], hides: [], exits: [], lamps: [] };
  const add = (p) => { W.add(p); if (p.light) L.push({ ...p.light, key: `${p.light.group}@${p.light.pos.join(",")}` }); return p; };
  const spot = (id, verb, at, note) => marks.spots.push({ id, verb, at, note });
  const HX = 2.25, HZ = 1.75, H = 3.0, WIN = [0.6, 1.6, -HZ - 0.1, 0.55, 0.7, 0.3], SIDE = [-HX - 0.1, 1.0, 0.7, 0.3, 1.0, 0.45];
  const wood = ID.darkwood || ID.timber;
  W.ground((x, y, z, T) => {
    shell(T, x, y, z, { hx: HX, hz: HZ, h: H, floor: ID.boards, wall: ID.bone, wallNear: ID.bone, sill: 0.35, cuts: [WIN, SIDE] });
    T(box(x, y, z, 0, 0.004, -0.2, 1.4, 0.006, 1.0), ID.rug);
    // the window's frame, glazing bars, and the lane's white arc right outside
    T(Math.max(box(x, y, z, WIN[0], WIN[1], -HZ - 0.06, WIN[3] + 0.06, WIN[4] + 0.06, 0.05), -box(x, y, z, WIN[0], WIN[1], -HZ - 0.06, WIN[3] - 0.02, WIN[4] - 0.02, 0.1)), wood);
    T(Math.min(box(x, y, z, WIN[0], WIN[1], -HZ - 0.06, 0.025, WIN[4], 0.025), box(x, y, z, WIN[0], WIN[1], -HZ - 0.06, WIN[3], 0.025, 0.025)), wood);
    T(box(x, y, z, WIN[0], WIN[1], -HZ - 0.6, WIN[3] + 0.4, WIN[4] + 0.4, 0.05), ID.windowdim);
    T(box(x, y, z, -HX - 0.3, 1.0, 0.7, 0.05, 1.0, 0.45), wood);   // the side door, shut
    // a shelf of the Trust's books on the back wall
    T(box(x, y, z, -1.2, 1.2, -HZ + 0.15, 0.8, 0.02, 0.15), wood); T(box(x, y, z, -1.2, 1.75, -HZ + 0.15, 0.8, 0.02, 0.15), wood);
    { const k = Math.floor((x + 1.95) / 0.075); if (k >= 0 && k < 19) T(box(x, y, z, -1.95 + (k + 0.5) * 0.075, 1.43, -HZ + 0.14, 0.03, 0.21 - (k % 4) * 0.02, 0.12), k % 5 === 2 ? ID.navy : ID.oxblood); }
  });
  // the stove in the corner, its glow
  add(K.shape([-2.2, 0, -1.7, -1.3, 2.9, -0.9], (x, y, z, T) => { T(box(x, y, z, -1.75, 0.45, -1.3, 0.35, 0.45, 0.32), ID.stove); T(cyl(x, y, z, -1.75, 1.9, -1.4, 0.08, 1.0), ID.iron); T(box(x, y, z, -1.75, 0.35, -0.97, 0.18, 0.12, 0.02), ID.stovefire); }));
  L.push({ pos: [-1.75, 0.4, -0.85], type: 1, I: 5, reach: 4, group: "fire", key: "stove" });
  // the desk with the ledger, the yellow-shaded lamp and the telephone on its side, off its hook
  add(K.table(0.6, 0, -1.0, 0.75, 0.38, 0.78, 0, wood));
  add(K.shape([-0.2, 0.78, -1.45, 1.4, 1.4, -0.6], (x, y, z, T) => {
    T(box(x, y, z, 0.35, 0.81, -0.95, 0.22, 0.03, 0.16), ID.red);   // the ledger
    T(box(x, y, z, 0.35, 0.843, -0.95, 0.2, 0.004, 0.14), ID.paper);
    T(cyl(x, y, z, 1.05, 0.95, -1.15, 0.015, 0.16), ID.brass); T(cyl(x, y, z, 1.05, 0.8, -1.15, 0.07, 0.015), ID.brass);
    T(Math.max(ell(x, y, z, 1.05, 1.13, -1.15, 0.17, 0.11, 0.17), -ell(x, y, z, 1.05, 1.08, -1.15, 0.15, 0.1, 0.15), 1.07 - y), ID.mustard);   // the yellow shade
    T(ell(x, y, z, 1.05, 1.08, -1.15, 0.04, 0.05, 0.04), ID.lantern);
    T(box(x, y, z, 0.0, 0.84, -0.75, 0.06, 0.05, 0.1), ID.tar); T(cap(x, y, z, [0.15, 0.82, -0.7], [0.32, 0.82, -0.62], 0.025), ID.tar);   // the telephone on its side, the receiver beside it
  }));
  L.push({ pos: [1.05, 1.0, -1.15], type: 1, I: 7, reach: 4, cone: [0, -1, 0], group: "lantern", key: "deskshade" });
  L.push({ pos: [0.6, 2.2, -HZ - 1.4], type: 3, I: 12, reach: 7, group: "white", key: "lanearc" });
  // the chair by the stove (warm), the Alderman's chair at the desk
  for (const [cx, cz, face] of [[-1.0, -0.4, 1], [0.6, -0.4, -1]]) add(K.shape([cx - 0.3, 0, cz - 0.3, cx + 0.3, 1.0, cz + 0.3], (x, y, z, T) => { T(box(x, y, z, cx, 0.45, cz, 0.22, 0.025, 0.22), wood); T(box(x, y, z, cx, 0.75, cz + face * 0.21, 0.22, 0.3, 0.02), wood); for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) T(box(x, y, z, cx + a, 0.22, cz + b, 0.02, 0.22, 0.02), wood); }));
  spot("ledger", "read", [0.35, 0, -0.45], "the Trust's ledger under the yellow lamp");
  spot("lamp", "look", [1.2, 0, -0.5], "the yellow shade (CANDLEMAS: where did the yellow pencil go?)");
  spot("telephone", "use", [0.0, 0, -0.35], "the telephone, off its hook");
  spot("stove_chair", "wait", [-1.0, 0, 0.1], "the chair by the stove: warm");
  spot("window", "look", [0.6, 0, -1.2], "the lane's white lamp close at the glass");
  marks.exits.push({ id: "hall", at: [1.6, 0, 1.4], note: "the door back to the hall" }, { id: "side_door", at: [-1.9, 0, 0.7], note: "the side door the station's key opens" });
  marks.hides.push({ id: "behind_desk", at: [1.5, 0, -1.3], r: 0.35, note: "low behind the desk" });
  return { world: W.build(), marks, lights: (V = {}) => L.filter((l) => !(V.emit && V.emit[l.group] === 0)).map((l) => ({ ...l, I: l.I * (V.emit?.[l.group] ?? 1) })).concat(V.fill ? [{ pos: [0.8, 2.3, 1.2], type: 1, I: V.fill, reach: 7, group: "fill", key: "fill" }] : []) };
}
