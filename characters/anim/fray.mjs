// The Fray's clips under combat's names (game/engine/combat/out/timing.combat.json):
//   <class>.light_1..3, <class>.heavy, <class>.heavy_charged, <class>.catch   (strikes, phased)
//   step, roll_dash, roll, roll_hop, lurch  as <name>_f, _b, _l, _r            (body moves)
//   riposte, shove, grapple, use_lantern, use_bottle, stagger, parried, ducked, knockdown, getup,
//   fall, yield; locomotion guard and wade.
// Strikes are keyed in phases (startup, active, recovery) so combat's warp lands the art's windup
// on its last startup frame. Moves whose combat timing is one span are keyed as fractions of it.
import { merge, mirror } from "./pose.mjs";
import { STAND, GUARD, DOWN } from "./stances.mjs";
import * as C from "./combat.mjs";

const P3 = ["startup", "active", "recovery"], G = (b, p) => merge(b, p);
const ph = (name, keys, tags = ["combat", "attack"]) => ({ name, phases: P3, keys, tags });
const fr = (name, keys, tags = ["combat", "move"]) => ({ name, keys, tags, smooth: true });   // body moves carry momentum through their keys

// Guards by how the tool is held.
export const GUARDS = {
  one: GUARD,
  two: G(GUARD, { pelvis: { turn: 30 }, chest: { turn: -20 }, armR: { fwd: 22, out: 22, twist: 0 }, foreR: { bend: 62 }, handR: { bend: 14, side: 0 } }),
  shield: G(GUARD, { pelvis: { turn: -10 }, chest: { turn: 12 }, armL: { fwd: 36, out: 6, twist: 0 }, foreL: { bend: 112 }, handL: { bend: 0 }, clavL: { lift: 6 }, armR: { fwd: 30, out: 18 }, foreR: { bend: 70 } }),
};
const STYLE_OF = { light: "one", short: "one", bar: "one", unarmed: "one", long: "two", heavy: "two", shield: "shield" };

function oneHanded(cls) {
  const g = GUARDS.one, re = (c, name) => ({ ...c, name: `${cls}.${name}` });
  return [
    re(C.light1, "light_1"), re(C.light2, "light_2"), re(C.light3, "light_3"),
    ph(`${cls}.heavy`, [
      { at: ["s", 0], pose: g },
      { at: ["s", 0.7], pose: G(g, { root: { y: 0.0 }, spine: { bend: -12 }, chest: { turn: -10, bend: -18 }, clavR: { lift: 20 }, armR: { fwd: 185, out: 14 }, foreR: { bend: 80 }, handR: { bend: 40 }, armL: { fwd: 50, out: 40 }, thighL: { fwd: 30 } }) },
      { at: ["s", 1], pose: G(g, { root: { y: 0.02, zf: 0.1 }, spine: { bend: -16 }, chest: { turn: -12, bend: -22 }, clavR: { lift: 24 }, armR: { fwd: 195, out: 12 }, foreR: { bend: 86 }, handR: { bend: 44 }, armL: { fwd: 55, out: 40 }, thighL: { fwd: 34 } }) },
      { at: ["a", 0.5], pose: G(g, { root: { y: -0.22, zf: 0.85 }, spine: { bend: 34 }, chest: { bend: 26, turn: 8 }, armR: { fwd: 50, out: 6 }, foreR: { bend: 2 }, handR: { bend: 46 }, thighL: { fwd: 58 }, shinL: { bend: 62 }, thighR: { fwd: -34 }, shinR: { bend: 34 } }) },
      { at: ["a", 1], pose: G(g, { root: { y: -0.26, zf: 0.95 }, spine: { bend: 38 }, chest: { bend: 28, turn: 8 }, armR: { fwd: 30, out: 6 }, foreR: { bend: 0 }, handR: { bend: 50 }, thighL: { fwd: 60 }, shinL: { bend: 66 }, thighR: { fwd: -34 }, shinR: { bend: 38 } }) },
      { at: ["r", 0.5], pose: G(g, { root: { y: -0.14, zf: 1 }, spine: { bend: 24 }, chest: { bend: 14 }, armR: { fwd: 34 }, foreR: { bend: 24 } }) },
      { at: ["r", 1], pose: G(g, { root: { zf: 1 } }) },
    ]),
    { ...C.heavy, name: `${cls}.heavy_charged` },
    ph(`${cls}.catch`, [
      { at: ["s", 0], pose: g },
      { at: ["s", 1], pose: G(g, { root: { y: -0.08 }, chest: { turn: 10, bend: -4 }, armR: { fwd: 78, out: -12, twist: 40 }, foreR: { bend: 84, twist: 30 }, handR: { bend: 10, side: -50 }, head: { bend: 0 } }) },
      { at: ["a", 1], pose: G(g, { root: { y: -0.1, zf: -0.3 }, chest: { turn: 12, bend: -6 }, armR: { fwd: 82, out: -14, twist: 42 }, foreR: { bend: 86, twist: 32 }, handR: { bend: 12, side: -52 } }) },
      { at: ["r", 1], pose: G(g, { root: { zf: -0.3 } }) },
    ]),
  ];
}

function twoHanded(cls) {
  const g = GUARDS.two;
  const rise = { root: { y: 0.02 }, spine: { bend: -14 }, chest: { turn: -6, bend: -20 }, clavR: { lift: 18 }, armR: { fwd: 160, out: 18 }, foreR: { bend: 70 }, handR: { bend: 30 }, thighL: { fwd: 28 } };
  const slam = { root: { y: -0.24, zf: 0.9 }, spine: { bend: 34 }, chest: { bend: 24, turn: -4 }, armR: { fwd: 52, out: 14 }, foreR: { bend: 10 }, handR: { bend: 40 }, thighL: { fwd: 56 }, shinL: { bend: 60 }, thighR: { fwd: -32 }, shinR: { bend: 36 } };
  const heavy = (name, hold) => ph(`${cls}.${name}`, [
    { at: ["s", 0], pose: g }, { at: ["s", hold], pose: G(g, rise) }, { at: ["s", 1], pose: G(g, { ...rise, root: { y: 0.03, zf: 0.08 }, armR: { fwd: 172, out: 16 } }) },
    { at: ["a", 0.6], pose: G(g, slam) }, { at: ["a", 1], pose: G(g, { ...slam, root: { y: -0.27, zf: 0.95 }, spine: { bend: 38 } }) },
    { at: ["r", 0.5], pose: G(g, { root: { y: -0.14, zf: 1 }, spine: { bend: 22 }, armR: { fwd: 40 } }) }, { at: ["r", 1], pose: G(g, { root: { zf: 1 } }) },
  ]);
  return [
    ph(`${cls}.light_1`, [
      { at: ["s", 0], pose: g },
      { at: ["s", 1], pose: G(g, { chest: { turn: -34 }, pelvis: { turn: 38 }, armR: { fwd: -4, out: 26 }, foreR: { bend: 96 }, handR: { bend: 6 }, thighR: { fwd: -26 }, shinR: { bend: 32 } }) },
      { at: ["a", 0.6], pose: G(g, { root: { zf: 0.8 }, chest: { turn: 0, bend: 12 }, pelvis: { turn: 14 }, spine: { bend: 12 }, armR: { fwd: 52, out: 10 }, foreR: { bend: 26 }, handR: { bend: 14 }, thighL: { fwd: 40 }, shinL: { bend: 30 }, thighR: { fwd: -32 }, shinR: { bend: 10 } }) },
      { at: ["a", 1], pose: G(g, { root: { zf: 0.9 }, chest: { turn: 2, bend: 14 }, pelvis: { turn: 12 }, spine: { bend: 14 }, armR: { fwd: 56, out: 10 }, foreR: { bend: 20 }, handR: { bend: 14 }, thighL: { fwd: 42 }, shinL: { bend: 32 }, thighR: { fwd: -32 }, shinR: { bend: 10 } }) },
      { at: ["r", 1], pose: G(g, { root: { zf: 1 } }) },
    ]),
    ph(`${cls}.light_2`, [
      { at: ["s", 0], pose: G(g, { chest: { turn: 0 } }) },
      { at: ["s", 1], pose: G(g, { root: { y: -0.08 }, chest: { turn: 44, bend: 10 }, pelvis: { turn: 10 }, armR: { fwd: 30, out: -20, twist: 20 }, foreR: { bend: 60 }, handR: { bend: -10 } }) },
      { at: ["a", 0.5], pose: G(g, { root: { y: -0.16, zf: 0.6 }, chest: { turn: 0, bend: 22 }, pelvis: { turn: 26 }, armR: { fwd: 40, out: 40 }, foreR: { bend: 20 }, handR: { bend: -20 }, thighL: { fwd: 40 }, shinL: { bend: 46 } }) },
      { at: ["a", 1], pose: G(g, { root: { y: -0.16, zf: 0.8 }, chest: { turn: -46, bend: 22 }, pelvis: { turn: 40 }, armR: { fwd: 20, out: 80 }, foreR: { bend: 20 }, handR: { bend: -20 }, thighL: { fwd: 40 }, shinL: { bend: 46 } }) },
      { at: ["r", 1], pose: G(g, { root: { zf: 1 } }) },
    ]),
    heavy("heavy", 0.7), heavy("heavy_charged", 0.5),
    ph(`${cls}.catch`, [
      { at: ["s", 0], pose: g },
      { at: ["s", 1], pose: G(g, { root: { y: -0.1 }, chest: { turn: 0, bend: -6 }, armR: { fwd: 96, out: 30, twist: 30 }, foreR: { bend: 76 }, handR: { bend: 4, side: -62 } }) },
      { at: ["a", 1], pose: G(g, { root: { y: -0.12, zf: -0.3 }, chest: { turn: 0, bend: -8 }, armR: { fwd: 100, out: 30, twist: 30 }, foreR: { bend: 78 }, handR: { bend: 4, side: -64 } }) },
      { at: ["r", 1], pose: G(g, { root: { zf: -0.3 } }) },
    ]),
  ];
}

function shield() {
  const g = GUARDS.shield, cls = "shield";
  return [
    ph(`${cls}.light_1`, [
      { at: ["s", 0], pose: g },
      { at: ["s", 1], pose: G(g, { chest: { turn: -10 }, pelvis: { turn: -14 }, armL: { fwd: 20, out: 10 }, foreL: { bend: 120 } }) },
      { at: ["a", 0.6], pose: G(g, { root: { zf: 0.8 }, chest: { turn: 26, bend: 12 }, pelvis: { turn: 6 }, armL: { fwd: 74, out: 2 }, foreL: { bend: 70 }, thighL: { fwd: 40 }, shinL: { bend: 30 } }) },
      { at: ["a", 1], pose: G(g, { root: { zf: 0.9 }, chest: { turn: 28, bend: 14 }, armL: { fwd: 78, out: 2 }, foreL: { bend: 64 }, thighL: { fwd: 42 }, shinL: { bend: 32 } }) },
      { at: ["r", 1], pose: G(g, { root: { zf: 1 } }) },
    ]),
    ph(`${cls}.light_2`, [
      { at: ["s", 0], pose: g },
      { at: ["s", 1], pose: G(g, { chest: { turn: 30 }, armR: { fwd: 20, out: 40 }, foreR: { bend: 100 } }) },
      { at: ["a", 0.6], pose: G(g, { root: { zf: 0.7 }, chest: { turn: -30, bend: 10 }, pelvis: { turn: 20 }, armR: { fwd: 84, out: 20 }, foreR: { bend: 30 }, thighL: { fwd: 36 } }) },
      { at: ["a", 1], pose: G(g, { root: { zf: 0.85 }, chest: { turn: -34, bend: 12 }, pelvis: { turn: 22 }, armR: { fwd: 86, out: 16 }, foreR: { bend: 24 } }) },
      { at: ["r", 1], pose: G(g, { root: { zf: 1 } }) },
    ]),
    ...["heavy", "heavy_charged"].map((name) => ph(`${cls}.${name}`, [
      { at: ["s", 0], pose: g },
      { at: ["s", 1], pose: G(g, { root: { y: 0.03 }, spine: { bend: -12 }, chest: { bend: -16, turn: 0 }, clavL: { lift: 20 }, clavR: { lift: 20 }, armL: { fwd: 170, out: 10 }, foreL: { bend: 30 }, armR: { fwd: 160, out: 20 }, foreR: { bend: 50 } }) },
      { at: ["a", 0.6], pose: G(g, { root: { y: -0.25, zf: 0.85 }, spine: { bend: 36 }, chest: { bend: 26 }, armL: { fwd: 70, out: 6 }, foreL: { bend: 10 }, armR: { fwd: 60, out: 20 }, foreR: { bend: 30 }, thighL: { fwd: 56 }, shinL: { bend: 62 } }) },
      { at: ["a", 1], pose: G(g, { root: { y: -0.28, zf: 0.95 }, spine: { bend: 38 }, chest: { bend: 28 }, armL: { fwd: 60, out: 6 }, foreL: { bend: 6 }, armR: { fwd: 50, out: 22 }, foreR: { bend: 30 }, thighL: { fwd: 58 }, shinL: { bend: 66 } }) },
      { at: ["r", 1], pose: G(g, { root: { zf: 1 } }) },
    ])),
    ph(`${cls}.catch`, [
      { at: ["s", 0], pose: g },
      { at: ["s", 1], pose: G(g, { root: { y: -0.1 }, chest: { bend: -4 }, clavL: { lift: 14 }, armL: { fwd: 70, out: 4 }, foreL: { bend: 100 } }) },
      { at: ["a", 1], pose: G(g, { root: { y: -0.12, zf: -0.3 }, chest: { bend: -6 }, clavL: { lift: 16 }, armL: { fwd: 74, out: 4 }, foreL: { bend: 102 } }) },
      { at: ["r", 1], pose: G(g, { root: { zf: -0.3 } }) },
    ]),
  ];
}

// Directional body moves: a template keyed facing forward, turned to each direction. The body
// leans and travels toward the move; under a lock it keeps facing the target (combat's rule), so
// side and back moves are the forward template turned by root yaw for the travel and turned back.
const DIRS = { f: [0, 1], b: [0, -1], l: [1, 0], r: [-1, 0] };
function directional(name, build) {
  return Object.entries(DIRS).map(([d, [x, z]]) => fr(`${name}_${d}`, build(d, x, z)));
}
const travel = (x, z, u) => ({ xf: x * u, zf: z * u });
const lean = (d, a) => (d === "f" ? { spine: { bend: a } } : d === "b" ? { spine: { bend: a * 0.5 } } : { spine: { side: d === "l" ? a * 0.6 : -a * 0.6, bend: a * 0.3 } });
const step = directional("step", (d, x, z) => [
  { at: 0, pose: GUARD },
  { at: 0.35, pose: G(GUARD, { root: { y: -0.08, ...travel(x, z, 0.5) }, ...lean(d, 12), [d === "l" ? "thighL" : "thighR"]: { out: 24 }, [d === "b" ? "thighR" : "thighL"]: { fwd: d === "b" ? -36 : 36 } }) },
  { at: 0.75, pose: G(GUARD, { root: { y: -0.1, ...travel(x, z, 0.95) }, ...lean(d, 6) }) },
  { at: 1, pose: G(GUARD, { root: { ...travel(x, z, 1) } }) },
]);
const dash = directional("roll_dash", (d, x, z) => [
  { at: 0, pose: GUARD },
  { at: 0.3, pose: G(GUARD, { root: { y: -0.3, ...travel(x, z, 0.45) }, ...lean(d, 34), thighL: { fwd: 70 }, shinL: { bend: 80 }, thighR: { fwd: -20 }, shinR: { bend: 70 }, armL: { out: 60 }, hangL: { swing: d === "f" ? 30 : -20 } }) },
  { at: 0.7, pose: G(GUARD, { root: { y: -0.26, ...travel(x, z, 0.9) }, ...lean(d, 26), thighL: { fwd: 60 }, shinL: { bend: 76 } }) },
  { at: 1, pose: G(GUARD, { root: { ...travel(x, z, 1) } }) },
]);
const roll = directional("roll", (d, x, z) => {
  const yaw = { f: 0, b: 180, l: 90, r: -90 }[d], tuck = { pelvis: { bend: 30 }, spine: { bend: 45 }, chest: { bend: 35 }, neck: { bend: 20 }, head: { bend: 30 }, thighL: { fwd: 110, out: 10 }, shinL: { bend: 130 }, thighR: { fwd: 100, out: 10 }, shinR: { bend: 130 }, armR: { fwd: 60, out: 10 }, foreR: { bend: 80 }, armL: { fwd: 50, out: 25 }, foreL: { bend: 90 } };
  return [
    { at: 0, pose: GUARD },
    { at: 0.12, pose: G(GUARD, { root: { y: -0.3, yaw, ...travel(x, z, 0.06), pitch: 10 }, spine: { bend: 30 }, chest: { bend: 20 }, thighL: { fwd: 60 }, shinL: { bend: 70 } }) },
    // the turn of the roll eases in and out (slow over the shoulder, fast across the back, slowing to land)
    ...[[0.2, 45, -0.45], [0.3, 120, -0.58], [0.4, 210, -0.62], [0.5, 290, -0.55]].map(([u, pitch, y]) => ({ at: u, pose: G(GUARD, { ...tuck, root: { y, yaw, ...travel(x, z, 0.1 + u), pitch } }) })),
    { at: 0.6, pose: G(GUARD, { root: { y: -0.34, yaw, ...travel(x, z, 0.72), pitch: 360 }, spine: { bend: 30 }, thighL: { fwd: 70 }, shinL: { bend: 100 }, thighR: { fwd: 10 }, shinR: { bend: 80 } }) },
    { at: 0.85, pose: G(GUARD, { root: { y: -0.16, yaw: yaw * 0.3, ...travel(x, z, 0.95), pitch: 360 }, spine: { bend: 16 } }) },   // the hittable slide out of the roll
    { at: 1, pose: G(GUARD, { root: { yaw: 0, ...travel(x, z, 1), pitch: 360 } }) },
  ];
});
const hop = directional("roll_hop", (d, x, z) => [
  { at: 0, pose: GUARD },
  { at: 0.2, pose: G(GUARD, { root: { y: -0.22, ...travel(x, z, 0.05) }, ...lean(d, 16), shinL: { bend: 50 }, shinR: { bend: 50 } }) },
  { at: 0.4, pose: G(GUARD, { root: { y: 0.1, ...travel(x, z, 0.6) }, ...lean(d, 10), thighL: { fwd: 30 }, shinL: { bend: 40 }, thighR: { fwd: -10 }, shinR: { bend: 50 }, armL: { out: 50 }, hangL: { swing: -20 } }) },
  { at: 0.55, pose: G(GUARD, { root: { y: -0.32, ...travel(x, z, 1) }, ...lean(d, 30), thighL: { fwd: 60 }, shinL: { bend: 90 }, thighR: { fwd: 0 }, shinR: { bend: 90 }, hangL: { swing: 25 } }) },
  { at: 0.85, pose: G(GUARD, { root: { y: -0.2, ...travel(x, z, 1) }, ...lean(d, 18) }) },
  { at: 1, pose: G(GUARD, { root: { ...travel(x, z, 1) } }) },
]);
const lurch = directional("lurch", (d, x, z) => [
  { at: 0, pose: GUARD },
  { at: 0.3, pose: G(GUARD, { root: { y: -0.12, ...travel(x, z, 0.4), pitch: d === "f" ? 12 : 0, roll: d === "l" ? -10 : d === "r" ? 10 : 0 }, ...lean(d, 26), armL: { fwd: 40, out: 60 }, armR: { fwd: 50, out: 50 }, thighL: { fwd: 50 }, shinL: { bend: 40 }, hangL: { swing: 35 } }) },
  { at: 0.65, pose: G(GUARD, { root: { y: -0.18, ...travel(x, z, 0.85) }, ...lean(d, 18), armL: { out: 50 }, armR: { out: 40 }, thighR: { fwd: 40 }, shinR: { bend: 50 }, hangL: { swing: -25 } }) },
  { at: 1, pose: G(GUARD, { root: { ...travel(x, z, 1) } }) },
]);

const actions = [
  ph("riposte", [
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G(GUARD, { root: { zf: 0.4 }, chest: { turn: -30, bend: 6 }, armR: { fwd: 120, out: 10 }, foreR: { bend: 90 }, handR: { bend: 60 } }) },
    { at: ["a", 1], pose: G(GUARD, { root: { y: -0.3, zf: 1 }, spine: { bend: 40 }, chest: { turn: 10, bend: 26 }, armR: { fwd: 40, out: 4 }, foreR: { bend: 0 }, handR: { bend: 70 }, thighL: { fwd: 64 }, shinL: { bend: 70 } }) },
    { at: ["r", 1], pose: G(GUARD, { root: { zf: 1 } }) },
  ]),
  ph("shove", [
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G(GUARD, { root: { y: -0.08 }, chest: { bend: -6 }, armL: { fwd: 40, out: 20 }, foreL: { bend: 110 }, armR: { fwd: 40, out: 20 }, foreR: { bend: 110 }, hands: ["open", "open"] }) },
    { at: ["a", 1], pose: G(GUARD, { root: { y: -0.12, zf: 1 }, spine: { bend: 22 }, chest: { bend: 14, turn: 0 }, pelvis: { turn: 0 }, armL: { fwd: 84, out: 10 }, foreL: { bend: 6 }, armR: { fwd: 84, out: 10 }, foreR: { bend: 6 }, thighL: { fwd: 46 } }) },
    { at: ["r", 1], pose: G(GUARD, { root: { zf: 1 } }) },
  ], ["combat", "attack"]),
  ph("grapple", [
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G(GUARD, { root: { y: -0.12, zf: 0.5 }, spine: { bend: 24 }, chest: { turn: 20 }, armL: { fwd: 80, out: 4 }, foreL: { bend: 10 }, hands: ["open", null] }) },
    { at: ["a", 1], pose: G(GUARD, { root: { y: -0.14, zf: 1 }, spine: { bend: 26 }, chest: { turn: 22 }, armL: { fwd: 86, out: 0 }, foreL: { bend: 20 } }) },
    { at: ["r", 0.6], pose: G(GUARD, { root: { y: -0.1, zf: 0.7 }, spine: { bend: -8 }, chest: { turn: -20 }, armL: { fwd: 30, out: 10 }, foreL: { bend: 100 } }) },
    { at: ["r", 1], pose: G(GUARD, { root: { zf: 0.7 } }) },
  ], ["combat", "attack"]),
  ph("use_lantern", [
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G(GUARD, { chest: { turn: 20 }, armL: { fwd: -40, out: 20 }, foreL: { bend: 20 }, hangL: { swing: -30 } }) },
    { at: ["a", 1], pose: G(GUARD, { chest: { turn: -16, bend: 8 }, armL: { fwd: 110, out: 10 }, foreL: { bend: 10 }, thighL: { fwd: 36 }, hide: ["lantern"], hands: ["open", null] }) },
    { at: ["r", 1], pose: G(GUARD, { hide: ["lantern"], hands: ["open", null] }) },
  ], ["combat", "use"]),
  ph("use_bottle", [
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G(GUARD, { chest: { turn: -30, bend: -8 }, armR: { fwd: 150, out: 30 }, foreR: { bend: 100 } }) },
    { at: ["a", 1], pose: G(GUARD, { chest: { turn: 20, bend: 14 }, armR: { fwd: 70, out: 0 }, foreR: { bend: 6 }, thighL: { fwd: 40 } }) },
    { at: ["r", 1], pose: GUARD },
  ], ["combat", "use"]),
  fr("parried", [
    { at: 0, pose: GUARD },
    { at: 0.15, pose: G(GUARD, { root: { zf: 0.4, y: -0.04 }, spine: { bend: -12 }, chest: { bend: -14, turn: 16 }, head: { bend: -14 }, armR: { fwd: 150, out: 40 }, foreR: { bend: 30 }, handR: { bend: -30 }, armL: { out: 50 } }) },
    { at: 0.6, pose: G(GUARD, { root: { zf: 0.85, y: -0.1 }, spine: { bend: 4 }, armR: { fwd: 60, out: 50 }, foreR: { bend: 40 } }) },
    { at: 1, pose: G(GUARD, { root: { zf: 1 } }) },
  ], ["combat", "react"]),
  fr("ducked", [
    { at: 0, pose: GUARD },
    { at: 0.25, pose: G(GUARD, { root: { y: -0.42 }, pelvis: { bend: 10 }, spine: { bend: 40 }, chest: { bend: 20 }, head: { bend: 20 }, thighL: { fwd: 70 }, shinL: { bend: 100 }, thighR: { fwd: 10 }, shinR: { bend: 100 } }) },
    { at: 0.65, pose: G(GUARD, { root: { y: -0.36 }, spine: { bend: 34 }, thighL: { fwd: 66 }, shinL: { bend: 92 }, thighR: { fwd: 8 }, shinR: { bend: 96 } }) },
    { at: 1, pose: GUARD },
  ], ["combat", "react"]),
  { ...C.fall, name: "knockdown" },
  { ...C.fall, name: "fall" },
  { ...C.getup, name: "getup" },
  { ...C.stagger, name: "stagger" },
  fr("yield", [
    { at: 0, pose: GUARD },
    { at: 0.4, pose: G(STAND, { root: { y: -0.45 }, spine: { bend: 10 }, thighL: { fwd: 80 }, shinL: { bend: 90 }, thighR: { fwd: -10 }, shinR: { bend: 100 }, footR: { bend: 50 }, armR: { fwd: 30, out: 40 }, foreR: { bend: 80 }, armL: { fwd: 30, out: 40 }, foreL: { bend: 80 }, head: { bend: 20 }, hide: ["tool"], hands: ["open", "open"] }) },
    { at: 1, pose: G(STAND, { root: { y: -0.47 }, spine: { bend: 6 }, thighL: { fwd: 82 }, shinL: { bend: 92 }, thighR: { fwd: -12 }, shinR: { bend: 102 }, footR: { bend: 50 }, clavL: { lift: 12 }, clavR: { lift: 12 }, armR: { fwd: 60, out: 50 }, foreR: { bend: 90 }, armL: { fwd: 60, out: 50 }, foreL: { bend: 90 }, head: { bend: 26 }, hide: ["tool"], hands: ["open", "open"] }) },
  ], ["combat", "react"]),
];

const loco = [
  ...[["guard", GUARDS.one], ["long.guard", GUARDS.two], ["heavy.guard", GUARDS.two], ["shield.guard", GUARDS.shield]].map(([name, g]) => ({ name, loop: true, frames: 48, tags: ["combat", "loco"], keys: [
    { at: 0, pose: g }, { at: 0.5, pose: G(g, { root: { y: -0.065 }, chest: { bend: (g.chest?.bend || 0) + 1.5 }, hangL: { swing: 3 } }) },
  ] })),
];

export const FRAY = [...["light", "short", "bar", "unarmed"].flatMap(oneHanded), ...["long", "heavy"].flatMap(twoHanded), ...shield(), ...step, ...dash, ...roll, ...hop, ...lurch, ...actions, ...loco];
export { STYLE_OF };
