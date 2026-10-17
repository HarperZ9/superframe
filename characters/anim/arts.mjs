// Tool specials (combat's "arts", data/arts.mjs) and the running strike, under combat's names:
// <class>.art_<art>, <class>.art2_<art>, <class>.run. Each art is keyed once and registered for
// every class (combat picks the class from the tool); phased like the strikes, so combat's warp
// and its playback rate set the timing. Weight first: a held anticipation, momentum carried
// through the active frames, a settle in recovery.
import { merge } from "./pose.mjs";
import { GUARD } from "./stances.mjs";

const P3 = ["startup", "active", "recovery"], G = (p) => merge(GUARD, p);
const ph = (keys, tags = ["combat", "attack", "art"]) => ({ phases: P3, keys, tags });
const low = (y = -0.2) => ({ root: { y }, thighL: { fwd: 50 }, shinL: { bend: 60 }, thighR: { fwd: -30 }, shinR: { bend: 40 } });
const over = { root: { y: 0.03 }, spine: { bend: -14 }, chest: { bend: -18 }, clavR: { lift: 22 }, armR: { fwd: 180, out: 12 }, foreR: { bend: 80 }, handR: { bend: 40 }, armL: { fwd: 160, out: 20 }, foreL: { bend: 60 } };
const strikeN = (n, from, to) => Array.from({ length: n * 2 }, (_, i) => ({ at: ["a", (i + 1) / (n * 2 + 1)], pose: G(i % 2 ? from : to) }));

export const ARTS = {
  brace: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ root: { y: -0.14 }, clavL: { lift: 16 }, armL: { fwd: 80, out: 4 }, foreL: { bend: 100 }, armR: { fwd: 70, out: -10 }, foreR: { bend: 90 }, thighL: { fwd: 30, out: 14 }, shinL: { bend: 36 }, thighR: { fwd: -26, out: 14 }, shinR: { bend: 40 } }) },
    { at: ["a", 0.5], pose: G({ root: { y: -0.16 }, clavL: { lift: 18 }, armL: { fwd: 84, out: 4 }, foreL: { bend: 102 }, armR: { fwd: 72, out: -10 }, foreR: { bend: 92 }, thighL: { fwd: 30, out: 14 }, shinL: { bend: 40 }, thighR: { fwd: -26, out: 14 }, shinR: { bend: 44 } }) },
    { at: ["a", 1], pose: G({ root: { y: -0.15 }, clavL: { lift: 16 }, armL: { fwd: 82, out: 4 }, foreL: { bend: 100 }, armR: { fwd: 70, out: -10 }, foreR: { bend: 90 }, thighL: { fwd: 30, out: 14 }, shinL: { bend: 38 }, thighR: { fwd: -26, out: 14 }, shinR: { bend: 42 } }) },
    { at: ["r", 1], pose: GUARD },
  ], ["combat", "parry", "art"]),
  lash: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ chest: { turn: -34 }, armR: { fwd: 40, out: 40 }, foreR: { bend: 90 }, handR: { bend: 20 }, ...low(-0.1) }) },
    ...strikeN(3, { root: { zf: 0.5 }, chest: { turn: 30, bend: 10 }, armR: { fwd: 80, out: -20 }, foreR: { bend: 10 }, handR: { bend: 40, side: -30 } }, { root: { zf: 0.8 }, chest: { turn: -24, bend: 10 }, armR: { fwd: 80, out: 50 }, foreR: { bend: 14 }, handR: { bend: 30, side: 30 } }),
    { at: ["r", 0.3], pose: G({ root: { zf: 1, y: -0.1 }, chest: { turn: 10, bend: 14 }, armR: { fwd: 60 }, foreR: { bend: 20 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
  ]),
  haul: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ chest: { turn: -20, bend: -6 }, armR: { fwd: 30, out: 10 }, foreR: { bend: 80 }, ...low(-0.08) }) },
    { at: ["a", 1], pose: G({ root: { y: -0.22, zf: 0.6 }, spine: { bend: 30 }, chest: { bend: 20, turn: 10 }, armR: { fwd: 70, out: 4 }, foreR: { bend: 4 }, handR: { bend: 30 }, ...low(-0.22) }) },
    { at: ["r", 0.4], pose: G({ root: { y: -0.16, zf: 0.2 }, spine: { bend: -18 }, chest: { bend: -12, turn: -14 }, armR: { fwd: 10, out: 18 }, foreR: { bend: 100 }, handR: { bend: 0 }, thighL: { fwd: 30 }, shinL: { bend: 30 }, thighR: { fwd: -40 }, shinR: { bend: 50 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.2 } }) },
  ]),
  ring: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ root: { y: -0.3, yaw: 40 }, chest: { turn: 50, bend: 26 }, armR: { fwd: 40, out: -30 }, foreR: { bend: 40 }, ...low(-0.3) }) },
    ...[0.33, 0.66].map((u) => ({ at: ["a", u], pose: G({ root: { y: -0.34, yaw: 40 - 360 * u }, chest: { turn: -20, bend: 30 }, armR: { fwd: 50, out: 70 }, foreR: { bend: 6 }, handR: { bend: 10 }, armL: { out: 70 }, ...low(-0.34) }) })),
    { at: ["a", 1], pose: G({ root: { y: -0.32, yaw: -320 }, chest: { turn: -40, bend: 26 }, armR: { fwd: 40, out: 90 }, foreR: { bend: 8 }, ...low(-0.32) }) },
    { at: ["r", 0.6], pose: G({ root: { y: -0.12, yaw: -350 } }) },
    { at: ["r", 1], pose: G({ root: { yaw: -360 } }) },
  ]),
  open: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ root: { y: -0.16 }, chest: { turn: -30, bend: 14 }, armR: { fwd: 0, out: 20 }, foreR: { bend: 110 }, handR: { bend: 20 }, ...low(-0.16) }) },
    { at: ["a", 0.6], pose: G({ root: { y: -0.3, zf: 0.85 }, spine: { bend: 30 }, chest: { turn: 16, bend: 20 }, armR: { fwd: 80, out: 0 }, foreR: { bend: 2 }, handR: { bend: 20 }, thighL: { fwd: 70 }, shinL: { bend: 80 }, thighR: { fwd: -40 }, shinR: { bend: 20 } }) },
    { at: ["a", 1], pose: G({ root: { y: -0.3, zf: 0.95 }, spine: { bend: 30 }, chest: { turn: 10, bend: 20 }, armR: { fwd: 70 }, foreR: { bend: 30 }, thighL: { fwd: 70 }, shinL: { bend: 80 }, thighR: { fwd: -40 }, shinR: { bend: 20 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
  ]),
  break: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 0.6], pose: G({ ...over, root: { y: 0.02 } }) },
    { at: ["s", 1], pose: G({ ...over, root: { y: 0.05, zf: 0.1 }, spine: { bend: -20 } }) },
    { at: ["a", 1], pose: G({ root: { y: -0.36, zf: 0.8 }, spine: { bend: 44 }, chest: { bend: 30 }, armR: { fwd: 40, out: 10 }, foreR: { bend: 4 }, handR: { bend: 50 }, armL: { fwd: 50 }, foreL: { bend: 10 }, ...low(-0.36) }) },
    { at: ["r", 0.5], pose: G({ root: { y: -0.3, zf: 0.85 }, spine: { bend: 40 }, chest: { bend: 26 }, armR: { fwd: 36 }, ...low(-0.3) }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.9 } }) },
  ]),
  pry: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ root: { y: -0.2 }, spine: { bend: 22 }, armR: { fwd: 30, out: 10 }, foreR: { bend: 60 }, handR: { bend: -20 }, ...low(-0.2) }) },
    { at: ["a", 1], pose: G({ root: { y: -0.24, zf: 0.5 }, spine: { bend: 30 }, armR: { fwd: 60, out: 4, twist: 40 }, foreR: { bend: 10, twist: 40 }, handR: { bend: -30 }, ...low(-0.24) }) },
    { at: ["r", 0.4], pose: G({ root: { y: -0.08, zf: 0.4 }, spine: { bend: -10 }, armR: { fwd: 110, out: 10, twist: -20 }, foreR: { bend: 60 }, handR: { bend: 40 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.4 } }) },
  ]),
  slam: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ ...over, root: { y: 0.04 } }) },
    { at: ["a", 1], pose: G({ root: { y: -0.32, zf: 0.7 }, spine: { bend: 40 }, chest: { bend: 28 }, armL: { fwd: 60 }, foreL: { bend: 6 }, armR: { fwd: 60 }, foreR: { bend: 20 }, ...low(-0.32) }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.8 } }) },
  ]),
  flurry: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ chest: { turn: -30 }, armR: { fwd: 60, out: 40 }, foreR: { bend: 70 }, ...low(-0.12) }) },
    ...strikeN(5, { root: { zf: 0.4 }, chest: { turn: 34 }, armR: { fwd: 90, out: -30 }, foreR: { bend: 10 }, handR: { side: -40 } }, { root: { zf: 0.6 }, chest: { turn: -30 }, armR: { fwd: 100, out: 60 }, foreR: { bend: 14 }, handR: { side: 40 } }),
    { at: ["r", 1], pose: G({ root: { zf: 0.8 } }) },
  ]),
  skewer: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ root: { y: -0.1 }, chest: { turn: -40 }, pelvis: { turn: 40 }, armR: { fwd: -10, out: 30 }, foreR: { bend: 100 }, thighR: { fwd: -36 }, shinR: { bend: 40 } }) },
    { at: ["a", 1], pose: G({ root: { y: -0.32, zf: 1 }, spine: { bend: 24 }, chest: { turn: 10, bend: 16 }, pelvis: { turn: 10 }, armR: { fwd: 70 }, foreR: { bend: 4 }, handR: { bend: 20 }, thighL: { fwd: 80 }, shinL: { bend: 90 }, thighR: { fwd: -50 }, shinR: { bend: 10 } }) },
    { at: ["r", 0.6], pose: G({ root: { y: -0.2, zf: 1 }, spine: { bend: 14 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
  ]),
  stamp: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 0.7], pose: G({ ...over, root: { y: 0.1 }, thighL: { fwd: 50 }, shinL: { bend: 70 } }) },
    { at: ["s", 1], pose: G({ ...over, root: { y: 0.16 }, thighL: { fwd: 60 }, shinL: { bend: 90 } }) },
    { at: ["a", 1], pose: G({ root: { y: -0.42 }, spine: { bend: 50 }, chest: { bend: 30 }, armR: { fwd: 30 }, foreR: { bend: 0 }, handR: { bend: 60 }, armL: { fwd: 40 }, ...low(-0.42) }) },
    { at: ["r", 0.6], pose: G({ root: { y: -0.3 }, spine: { bend: 40 }, ...low(-0.3) }) },
    { at: ["r", 1], pose: GUARD },
  ]),
  wrench: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ root: { y: -0.1, zf: 0.3 }, armR: { fwd: 70, out: 0 }, foreR: { bend: 20 }, armL: { fwd: 70, out: 10 }, foreL: { bend: 30 }, hands: ["open", null] }) },
    { at: ["a", 1], pose: G({ root: { y: -0.14, zf: 0.5 }, chest: { turn: -60, bend: 10 }, pelvis: { turn: 20 }, armR: { fwd: 50, out: 40, twist: 60 }, foreR: { bend: 50, twist: 60 }, armL: { fwd: 40, out: -20 }, foreL: { bend: 70 }, hands: ["fist", null] }) },
    { at: ["r", 1], pose: G({ root: { zf: 0.5 } }) },
  ]),
  shoulder: ph([
    { at: ["s", 0], pose: GUARD },
    { at: ["s", 1], pose: G({ root: { y: -0.16 }, spine: { bend: 30 }, chest: { turn: 40, bend: 10 }, armL: { fwd: 20, out: 10 }, foreL: { bend: 100 }, ...low(-0.16) }) },
    { at: ["a", 1], pose: G({ root: { y: -0.12, zf: 0.9 }, spine: { bend: 26 }, chest: { turn: 50, bend: 14 }, armL: { fwd: 10, out: 6 }, foreL: { bend: 110 }, thighL: { fwd: 50 }, shinL: { bend: 30 }, thighR: { fwd: -40 }, shinR: { bend: 30 } }) },
    { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
  ]),
};
// the running strike: carried out of a run into a lunge, the body still leaning into its speed
export const RUN = ph([
  { at: ["s", 0], pose: G({ spine: { bend: 16 }, chest: { bend: 6 }, thighL: { fwd: 36 }, shinL: { bend: 30 }, thighR: { fwd: -30 }, shinR: { bend: 60 } }) },
  { at: ["s", 1], pose: G({ root: { zf: 0.3, y: -0.04 }, spine: { bend: 10 }, chest: { turn: -34, bend: 4 }, armR: { fwd: 60, out: 40 }, foreR: { bend: 90 }, thighL: { fwd: 50 }, shinL: { bend: 40 }, thighR: { fwd: -36 }, shinR: { bend: 50 } }) },
  { at: ["a", 1], pose: G({ root: { zf: 0.85, y: -0.26 }, spine: { bend: 30 }, chest: { turn: 20, bend: 18 }, armR: { fwd: 84, out: 0 }, foreR: { bend: 4 }, handR: { bend: 34 }, thighL: { fwd: 70 }, shinL: { bend: 80 }, thighR: { fwd: -46 }, shinR: { bend: 20 } }) },
  { at: ["r", 0.5], pose: G({ root: { zf: 0.98, y: -0.16 }, spine: { bend: 20 } }) },
  { at: ["r", 1], pose: G({ root: { zf: 1 } }) },
], ["combat", "attack", "run"]);

const CLASSES = ["shield", "light", "long", "short", "heavy", "bar", "unarmed"];
export const ART_CLIPS = CLASSES.flatMap((cls) => [
  ...Object.entries(ARTS).flatMap(([art, c]) => [{ ...c, name: `${cls}.art_${art}` }, { ...c, name: `${cls}.art2_${art}` }]),
  { ...RUN, name: `${cls}.run` },
]);
