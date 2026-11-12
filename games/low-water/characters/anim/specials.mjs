// The opponent archetypes' own moves, under combat's names (game/engine/combat/data/foes.mjs):
// holder.drag (a long, uncatchable hook that pulls Lamb down toward deep water), holder.chain (a
// wide chain swing with armour through it), holder.braced (a short chain swing from a planted brace
// after a stagger); skirmisher.mud (a handful from the bag, thrown overhand), skirmisher.rope (twirled
// overhead, thrown low at the legs), skirmisher.scuttle (a crouched scramble backward).
// Phased like the strikes so combat's warp lands the windups on its frames.
import { merge } from "./pose.mjs";
import { GUARD } from "./stances.mjs";

const P3 = ["startup", "active", "recovery"], G = (p) => merge(GUARD, p);
const ph = (name, keys, tags = ["combat", "attack"]) => ({ name, phases: P3, keys, tags });
const chainBack = { chest: { turn: -52, bend: 6 }, pelvis: { turn: -10 }, armL: { fwd: 50, out: -30, twist: 20 }, foreL: { bend: 30 }, head: { turn: 20 } };
const chainOut = (k) => ({ root: { zf: 0.4 * k }, chest: { turn: 58 * k, bend: 10 }, pelvis: { turn: 20 * k }, armL: { fwd: 70, out: 85, twist: 0 }, foreL: { bend: 6 }, head: { turn: -10 } });

export const SPECIALS = [
  ph("holder.drag", [
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 0.35], pose: G({ root: { y: 0.02 }, spine: { bend: -10 }, chest: { turn: -40, bend: -12 }, clavR: { lift: 16 }, armR: { fwd: 150, out: 26 }, foreR: { bend: 40 }, handR: { bend: 20 }, thighL: { fwd: 30 } }) },
    { at: ["s", 1], pose: G({ root: { y: 0.0 }, spine: { bend: -14 }, chest: { turn: -46, bend: -16 }, clavR: { lift: 20 }, armR: { fwd: 160, out: 24 }, foreR: { bend: 36 }, handR: { bend: 24 }, thighL: { fwd: 34 }, shinL: { bend: 24 } }) },
    { at: ["a", 1], pose: G({ root: { y: -0.18, zf: 0.6 }, spine: { bend: 30 }, chest: { turn: 20, bend: 22 }, armR: { fwd: 46, out: 8 }, foreR: { bend: 6 }, handR: { bend: 40 }, thighL: { fwd: 54 }, shinL: { bend: 56 }, thighR: { fwd: -30 }, shinR: { bend: 30 } }) },
    { at: ["r", 0.5], pose: G({ root: { y: -0.12, zf: 0.2 }, spine: { bend: -16 }, chest: { turn: -10, bend: -10 }, armR: { fwd: 16, out: 16 }, foreR: { bend: 96 }, handR: { bend: 10 }, thighL: { fwd: 36 }, shinL: { bend: 30 }, thighR: { fwd: -40 }, shinR: { bend: 40 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.1 } }) },
  ]),
  ph("holder.chain", [
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G(chainBack) },
    { at: ["a", 0.5], pose: G(chainOut(0.4)) },
    { at: ["a", 1], pose: G(chainOut(1)) },
    { at: ["r", 0.5], pose: G({ ...chainOut(1), armL: { fwd: 40, out: 50 }, foreL: { bend: 30 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.4 } }) },
  ]),
  ph("holder.braced", [
    { at: ["s", 0], pose: G({ root: { y: -0.16 }, thighL: { fwd: 30, out: 20 }, shinL: { bend: 36 }, thighR: { fwd: -24, out: 20 }, shinR: { bend: 36 } }) },
    { at: ["s", 1], pose: G({ ...chainBack, root: { y: -0.18 }, thighL: { fwd: 30, out: 20 }, shinL: { bend: 38 }, thighR: { fwd: -24, out: 20 }, shinR: { bend: 38 } }) },
    { at: ["a", 1], pose: G({ ...chainOut(0.8), root: { y: -0.2, zf: 0.1 }, thighL: { fwd: 30, out: 20 }, shinL: { bend: 40 }, thighR: { fwd: -24, out: 20 }, shinR: { bend: 40 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.1 } }) },
  ]),
  ph("skirmisher.mud", [
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 0.35], pose: G({ hands: ["open", null], chest: { turn: 26, bend: 14 }, armL: { fwd: -6, out: 26 }, foreL: { bend: 50 }, head: { turn: -16 } }) },
    { at: ["s", 1], pose: G({ hands: ["fist", null], chest: { turn: 34, bend: -10 }, clavL: { lift: 16 }, armL: { fwd: 168, out: 20 }, foreL: { bend: 70 }, thighR: { fwd: -26 } }) },
    { at: ["a", 1], pose: G({ hands: ["open", null], root: { zf: 0.3 }, chest: { turn: -26, bend: 20 }, armL: { fwd: 70, out: 4 }, foreL: { bend: 4 }, thighL: { fwd: 44 }, shinL: { bend: 40 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.3 } }) },
  ], ["combat", "use"]),
  ph("skirmisher.rope", [
    { at: ["s", 0], pose: GUARD },
    ...[0.3, 0.55, 0.8].map((u, i) => ({ at: ["s", u], pose: G({ clavL: { lift: 20 }, armL: { fwd: 160, out: 30 + (i % 2) * 20, twist: (i - 1) * 30 }, foreL: { bend: 30 }, chest: { turn: (i % 2 ? -1 : 1) * 10, bend: -6 } }) })),
    { at: ["s", 1], pose: G({ chest: { turn: 40 }, armL: { fwd: 30, out: -20 }, foreL: { bend: 40 }, root: { y: -0.1 } }) },
    { at: ["a", 1], pose: G({ hands: ["open", null], root: { y: -0.2, zf: 0.3 }, spine: { bend: 26 }, chest: { turn: -36, bend: 16 }, armL: { fwd: 40, out: 70 }, foreL: { bend: 6 }, thighL: { fwd: 50 }, shinL: { bend: 56 }, hide: ["rope"] }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.3 }, hide: ["rope"] }) },
  ], ["combat", "use"]),
  { name: "skirmisher.scuttle", tags: ["combat", "move"], keys: [
    { at: 0, pose: GUARD },
    { at: 0.25, pose: G({ hands: ["open", null], root: { y: -0.42, zf: -0.35 }, pelvis: { bend: 20 }, spine: { bend: 46 }, chest: { bend: 20 }, head: { bend: -10 }, armL: { fwd: 60, out: 10 }, foreL: { bend: 10 }, armR: { fwd: 50 }, thighL: { fwd: 80 }, shinL: { bend: 110 }, thighR: { fwd: 40 }, shinR: { bend: 120 } }) },
    { at: 0.55, pose: G({ hands: ["open", null], root: { y: -0.45, zf: -0.75 }, pelvis: { bend: 22 }, spine: { bend: 48 }, chest: { bend: 22 }, head: { bend: -12 }, armL: { fwd: 40, out: 14 }, foreL: { bend: 20 }, armR: { fwd: 30 }, thighL: { fwd: 60 }, shinL: { bend: 120 }, thighR: { fwd: 90 }, shinR: { bend: 100 } }) },
    { at: 0.85, pose: G({ root: { y: -0.2, zf: -0.97 }, spine: { bend: 22 } }) },
    { at: 1, pose: G({ root: { zf: -1 } }) },
  ] },
];
