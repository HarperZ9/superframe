// The harbour's weapons (SYSTEMS-FULL 18.4) as props. A one-handed tool lies along the right fist's
// grip axis (GRIP); a two-handed tool names where the left hand goes on the shaft (twoHand, metres
// along the axis from the right fist), and the IK in rig/ik.mjs puts it there every frame.
// Classes and tool ids follow game/engine/combat/data/tools.mjs.
import { prop, propBlob, mid } from "./parts.mjs";
import { tube } from "../rig/body.mjs";

export const GRIP = (() => { const d = [0, -0.9, 0.6], l = Math.hypot(...d); return d.map((x) => x / l); })();
export const gripAt = (s, off = [0, 0, 0]) => [GRIP[0] * s + off[0], -0.065 + GRIP[1] * s + off[1], 0.012 + GRIP[2] * s + off[2]];

// A shaft along the grip axis from s = from to s = to; r a number or a function of s; bands(s) -> mat name or null.
export function shaft(M, B, joint, from, to, r, mat, bands) {
  const pts = []; for (let s = from; s <= to + 1e-6; s += 0.04) pts.push([...gripAt(s), typeof r === "function" ? r(s) : r]);
  prop(M, B, joint, pts, mat, { seg: 8, matfn: bands ? (th, ring, t) => mid(bands(from + t * (to - from)) || mat) : null });
}
const blobAt = (M, B, j, s, off, r, mat) => propBlob(M, B, j, gripAt(s, off), r, mat, { rings: 5, seg: 10 });

// tool id -> { cls, twoHand?, left? (what the left hand holds instead of the lantern), build(M, B) }
export const TOOLS = {
  stick: { id: "w.stick", cls: "light", blade: [0.1, 0.8], build(M, B) {
    // the Vane's folding stick: two brass hinges, the tin cockerel on its spindle at the tip
    shaft(M, B, "handR", -0.16, 0.74, 0.013, "wood", (s) => (s < -0.12 || Math.abs(s - 0.18) < 0.015 || Math.abs(s - 0.46) < 0.015 ? "brass" : null));
    shaft(M, B, "handR", 0.74, 0.86, 0.004, "brass");
    blobAt(M, B, "handR", 0.86, [0, 0.0, 0], [0.012, 0.05, 0.045], "tin");          // body
    blobAt(M, B, "handR", 0.84, [0, 0.03, -0.05], [0.008, 0.045, 0.03], "tin");     // tail
    blobAt(M, B, "handR", 0.9, [0, 0.02, 0.04], [0.01, 0.022, 0.02], "tin");        // head
    blobAt(M, B, "handR", 0.92, [0, 0.03, 0.05], [0.006, 0.014, 0.01], "lip");      // comb
  } },
  case: { id: "w.case", cls: "shield", left: "case", blade: [-0.2, 0.25], build(M, B) {
    // the claims case held by its handle in the left fist, lid outward: Lamb's shield
    prop(M, B, "handL", [[0, -0.07, 0.0, 0.012], [0, -0.03, 0.0, 0.012]], "brass", { seg: 6 });
    prop(M, B, "handL", [[0, -0.1, 0.0, 0.17, 0.06], [0, -0.14, 0.0, 0.2, 0.07], [0, -0.36, 0.0, 0.2, 0.07], [0, -0.4, 0.0, 0.17, 0.06]], "case", { square: 6, seg: 16 });
    propBlob(M, B, "handL", [0.0, -0.13, 0.072], [0.03, 0.018, 0.01], "brass", { rings: 4, seg: 8 });
  } },
  boathook: { id: "w.boathook", cls: "long", twoHand: 0.55, blade: [0.6, 1.6], build(M, B) {
    shaft(M, B, "handR", -0.45, 1.5, 0.018, "wood");
    shaft(M, B, "handR", 1.5, 1.68, 0.012, "steel");
    blobAt(M, B, "handR", 1.6, [0, 0.07, 0.0], [0.01, 0.06, 0.01], "steel");
  } },
  pole: { id: "w.pole", cls: "long", twoHand: 0.55, blade: [0.6, 1.65], build(M, B) {
    shaft(M, B, "handR", -0.45, 1.6, 0.016, "brass");
    blobAt(M, B, "handR", 1.62, [0, 0.05, 0.0], [0.03, 0.03, 0.03], "brass");
  } },
  knife: { id: "w.knife", cls: "short", blade: [0.05, 0.28], build(M, B) {
    shaft(M, B, "handR", -0.06, 0.07, 0.016, "wood");
    shaft(M, B, "handR", 0.07, 0.28, (s) => 0.014 * (1 - (s - 0.07) / 0.24) + 0.002, "steel");
  } },
  hammer: { id: "w.hammer", cls: "heavy", twoHand: -0.2, blade: [0.4, 0.62], build(M, B) {
    shaft(M, B, "handR", -0.3, 0.55, 0.017, "wood");
    blobAt(M, B, "handR", 0.58, [0, 0, 0], [0.06, 0.045, 0.1], "steel");
  } },
  crowbar: { id: "w.crowbar", cls: "bar", blade: [0.2, 0.7], build(M, B) {
    shaft(M, B, "handR", -0.08, 0.66, 0.013, "steel");
    blobAt(M, B, "handR", 0.7, [0, 0.03, 0.0], [0.012, 0.05, 0.02], "steel");
  } },
  hands: { id: "w.hands", cls: "unarmed", blade: [-0.05, 0.05], build() {} },
  // the tide-warden's hook: a long ash shaft with an iron hook, held one-handed (the chain is in the other hand)
  hook: { id: "w.boathook", cls: "long", blade: [0.6, 1.7], build(M, B) {
    shaft(M, B, "handR", -0.35, 1.6, 0.019, "wood");
    shaft(M, B, "handR", 1.6, 1.74, 0.014, "iron");
    blobAt(M, B, "handR", 1.66, [0, 0.08, 0.02], [0.012, 0.075, 0.012], "iron");
  } },
  // for the cast: the deacon's crook and the steward's priest
  crook: { id: "w.pole", cls: "long", twoHand: 0.5, blade: [0.6, 1.3], build(M, B) {
    shaft(M, B, "handR", -0.5, 1.25, 0.017, "wood", (s) => (s < -0.45 || s > 1.1 ? "brass" : null));
    blobAt(M, B, "handR", 1.3, [0, 0.06, -0.02], [0.012, 0.07, 0.04], "brass");
  } },
  priest: { id: "w.crowbar", cls: "bar", blade: [0.1, 0.42], build(M, B) {
    shaft(M, B, "handR", -0.1, 0.42, (s) => 0.018 + Math.max(0, s - 0.15) * 0.1, "wood", (s) => (s > 0.33 && s < 0.38 ? "steel" : null));
  } },
};
// class -> the art's default tool, for actors whose tool is not named
export const BY_CLASS = { light: "stick", shield: "case", long: "boathook", short: "knife", heavy: "hammer", bar: "crowbar", unarmed: "hands" };
export const toolOf = (t) => TOOLS[t] || TOOLS[BY_CLASS[t]] || Object.values(TOOLS).find((x) => x.id === t) || TOOLS.hands;
export { tube };
