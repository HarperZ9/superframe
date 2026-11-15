// Abel Furrowe's hayloft over the horse, dressed from the authored prop library. A gable end of grey boards with
// through-gaps (the low evening sun lays bars across the hay and boards), the back slope of the roof as boards on rafters
// with a few leaks of sky, the hay heaped and slumped against the eaves with a hollow worn into it, the hatch and ladder,
// the loading door with its hoist, one lantern. Original (2026-10-23).
// Parameters: dressLoft(W, L, marks, { HX, HZ }); half sizes 2.6 x 2.0; the roof runs from an eave at 1.5 m to a ridge at 3.3 m. No stage switch.
import { ID } from "./kinds.mjs";
import { box, sstep } from "./prim.mjs";
import { boardShell } from "./shell.mjs";
import { timber, brace, bucket, stool, ladder, doorLeaf, hatchLid, barrel, boardWall } from "./wood.mjs";
import { bale, hayMound, drift, wisps, fork, rake } from "./straw.mjs";
import { hookLantern, hook, sack, ropeCoil, harness, cobweb, hoist, blanket } from "./gear.mjs";

export function dressLoft(W, L, marks, { HX, HZ }) {
  const E = 1.5, R = 3.3, LL = Math.hypot(HZ, R - E), add = (p) => W.add(p);
  const hLeft = (z) => (z < 0 ? E + (z + HZ) * (R - E) / HZ : Math.max(0.6, R - z * (R - E) / HZ));
  const roofS = (x, y, z) => (y - E) * HZ / LL - (z + HZ) * (R - E) / LL;   // signed distance above the back slope's plane
  W.ground((x, y, z, T) => {
    boardShell(T, x, y, z, { hx: HX, hz: HZ, hBack: () => E + 0.02, hLeft, floor: ID.chaff, mix: true, gap: 0.034, gapFrac: 0.65, sill: 0.3, seed: 9, cuts: [[-HX - 0.12, 0.95, -0.4, 0.3, 0.85, 0.55]], floorCuts: [[1.6, 0, 1.2, 0.35, 0.3, 0.35]] });
    // the back slope: boards laid in courses along the slope, a seam each, some seams open to the sky
    if (z < 0.05 && Math.abs(x) < HX + 0.2) {
      const m = (y - E) * (R - E) / LL + (z + HZ) * HZ / LL, k = Math.floor(m / 0.19), fu = m / 0.19 - k, bu = Math.min(fu, 1 - fu) * 0.19, open = ((k * 7919) % 5 === 0) ? 0.012 : 0.003;
      let d = Math.max(Math.abs(roofS(x, y, z)) - 0.02, z - 0.02, -z - HZ - 0.1, Math.abs(x) - HX - 0.2, -(open - bu) * 0.9);
      T(Math.max(d, y - R - 0.1), ID.greyx);
    }
  });
  // the frame under the roof: rafters, ridge, collar ties, purlin, posts; each set just under the boards
  const under = (x, y, z, o = 0.07) => [x, y - o * HZ / LL, z + o * (R - E) / LL];
  for (let i = -4; i <= 4; i++) { const x = i * 0.6; add(brace(under(x, E, -HZ), under(x, R, 0.0), 0.045, "rafter")); }
  add(timber("ridge_beam", [0, R - 0.08, 0.0], [HX, 0.07, 0.07])); add(timber("purlin", [0, 2.35, -0.95], [HX, 0.06, 0.06]));
  for (const x of [-1.8, 0, 1.8]) add(timber("collar_tie", [x, 2.9, -0.05], [0.04, 0.06, 0.95], ID.beamoak));
  add(timber("wall_plate", [0, E - 0.05, -HZ + 0.08], [HX, 0.07, 0.07])); add(timber("gable_post", [-HX + 0.1, 1.4, -0.9], [0.08, 1.4, 0.08])); add(timber("gable_post", [-HX + 0.1, 1.0, 1.2], [0.08, 1.0, 0.08]));
  for (const x of [-1.8, 0.4, 2.2]) add(timber("back_post", [x, E / 2, -HZ + 0.1], [0.08, E / 2, 0.08]));
  // the loading door: frame, one leaf swung back, the hoist beam over it with its tackle
  add(timber("door_lintel", [-HX + 0.06, 1.88, -0.4], [0.07, 0.07, 0.62])); add(timber("door_sill", [-HX + 0.06, 0.07, -0.4], [0.08, 0.05, 0.6]));
  add(doorLeaf([-HX + 0.08, 0.1, 0.15], 0.62, 1.7, 1.2, { name: "loading_door_leaf", seed: 6 }));
  add(timber("hoist_beam", [-HX + 0.55, 2.12, -0.4], [0.5, 0.07, 0.07])); add(hoist(-HX + 0.92, 2.05, -0.4, { drop: 0.85 }));
  // the hatch and the ladder, the lid standing open
  add(timber("hatch_curb", [1.6, 0.04, 1.55], [0.4, 0.04, 0.025], ID.oakx)); add(hatchLid(1.6, 0.0, 1.55, 0.72, 0.72, 1.4));
  add(ladder([1.55, -1.2, 1.2], [1.55, 0.95, 1.1], "hatch_ladder", 0.46, 9));
  // the hay: the big slumped heap on the back and right, a smaller one at the left, loose drifts on the boards
  const clip = (x, y, z) => (z < 0 ? roofS(x, y, z) + 0.06 : -1);
  add(hayMound("hay_heap", [-0.5, 0, -HZ + 0.05, HX - 0.1, 2.4, 1.4], [[1.35, -1.35, 1.8, 0.62], [0.5, -1.5, 1.35, 0.7], [2.1, -0.9, 1.25, 0.75], [1.0, -0.2, 0.8, 0.95], [1.9, 0.0, 0.55, 1.1], [-0.1, -0.7, 0.7, 0.9]], { clip, tunnel: { pts: [[0.9, 0.42, 0.45], [1.35, 0.5, -0.15], [1.9, 0.6, -0.8]], r: 0.36 }, cuts: [[2.3, 0.45, 0.0, 0.4, 0.5, 0.55]], terrace: 0.22, tuft: 0.09, soft: 0.14 }));
  add(hayMound("hay_slump", [-1.9, 0, -HZ + 0.05, -0.5, 1.9, -0.3], [[-1.3, -1.5, 1.2, 0.9], [-0.9, -1.0, 0.7, 1.0]], { clip, tuft: 0.07, soft: 0.14 }));
  add(hayMound("hay_forkful", [-1.6, 0, 0.1, -0.2, 0.4, 1.3], [[-0.9, 0.7, 0.28, 0.5]], { tuft: 0.03 }));
  add(drift("hay_drift", 0.0, 0.3, 0.9, 0.55, 0.13)); add(drift("hay_drift_small", -0.9, 1.4, 0.4, 0.3, 0.09)); add(wisps("hay_wisps", 0.2, 0.6, 46, 2.0, 3)); add(wisps("hay_wisps_door", -1.8, -0.3, 30, 0.8, 7));
  add(drift("nest_bed", 1.35, -0.62, 0.45, 0.3, 0.05)); add(blanket(1.15, 0.02, -0.7, { a: 0.5, name: "nest_blanket" }));
  add(fork([0.35, 0.3, -0.35], [0.1, 1.95, -0.1], "hay_fork")); add(rake([-1.2, 0, -1.85], [-1.4, 1.5, -1.95]));
  add(bale(-0.7, 0, -1.55, { seed: 3, a: 0.04 })); add(bale(-1.4, 0.46, -1.6, { seed: 8 }));
  // the lantern hung from a collar tie
  add(hookLantern(-0.55, 1.95, 0.4, { drop: 0.7 })); add(hook(-0.55, 2.9, 0.4)); L.push({ pos: [-0.55, 1.95, 0.4], type: 1, I: 5, reach: 6, key: "lamp0", group: "lantern" });
  L.push({ pos: [1.35, 0.6, -0.1], type: 1, I: 2.6, reach: 3.2, key: "hollow", group: "lantern" });   // the lantern's glow reaching the hollow
  L.push({ pos: [1.2, 2.3, 0.0], type: 1, I: 6, reach: 6, cone: [0, -1, 0], mode: 1, key: "pool0", group: "pool" });   // a pool on the hollow
  // stores: sacks of oats, a barrel, a bucket, a stool, the harness, rope, a crate of tools
  for (const [x, z, a, s] of [[-1.9, 0.6, 0.3, 0.27], [-1.55, 1.15, 1.0, 0.27]]) add(sack(x, 0, z, { s, a, seed: Math.round(z * 10) }));
  add(sack(-2.15, 0, 0.1, { s: 0.27, a: 0.5, open: true, seed: 4, name: "oat_sack_open" })); add(barrel(-2.0, 0, -1.4, { r: 0.28, h: 0.8, name: "oat_barrel" })); add(bucket(2.2, 0, 0.7)); add(stool(0.9, 1.5));
  add(harness(0.2, 1.4, -HZ + 0.12)); add(ropeCoil(-0.4, 0.03, 1.1)); add(timber("tool_crate", [2.3, 0.13, 1.45], [0.25, 0.13, 0.17], ID.oakx, 0.02));
  add(cobweb([-HX + 0.03, R - 0.3, 0.0], [0, 0, -1], [1, 0, 0], { size: 0.7, seed: 4 })); add(cobweb([0.4, 2.8, -0.15], [1, 0, 0], [0, 0, 1], { size: 0.45, seed: 6, name: "beam_cobweb" }));
  marks.spots.push({ id: "door", verb: "read", at: [-HX + 0.7, 0, -0.4], note: "the loading door: open on the evening, the yard below, the horse shifting under the boards" });
  marks.spots.push({ id: "hay", verb: "listen", at: [0.6, 0, 0.4], note: "the hay: still warm from the field, and something under it that is not hay" });
  marks.hides.push({ id: "hay", at: [1.2, 0, -0.6], note: "down in the hay against the eaves" });
  marks.exits.push({ id: "hatch", at: [1.6, 0, 1.2], note: "the hatch and the ladder down to the horse" });
}
void box; void sstep; void boardWall;
