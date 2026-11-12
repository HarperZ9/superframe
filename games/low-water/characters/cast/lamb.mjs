// Assessor H. Lamb, the player. Night-shift loss assessor of the Lower Shelf.
// Read from across the quay: the wide hat, the long coat that has been dry for eleven years, the
// pale collar at the throat, the lantern low in the left hand, the diagonal strap of the Kit case,
// and the measuring rod (a brass-shod surveyor's rod, Shelf issue, which is also what Lamb fights
// with). Exaggerated feature: the coat, a coat-shaped tent, and the hat over a long neck.
import { Mesh, bind } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, hat, prop, propBlob, strap, J, add, mid } from "./parts.mjs";
import { TOOLS, toolOf, GRIP, shaft } from "./tools.mjs";
export { GRIP, shaft };

export const P = { h: 1.86, leg: 0.5, head: 0.27, neck: 0.15, shoulder: 0.19, hip: 0.12, arm: 0.8, stoop: 7 };
export const palette = {
  coat: { c: [0.23, 0.24, 0.27], v: 0.22 },        // slate wool, Shelf issue
  coatIn: { c: [0.42, 0.18, 0.14], v: 0.24 },      // oxblood lining, seen when the coat swings
  collar: { c: [0.9, 0.87, 0.79], v: 0.87 },
};
export const info = { coat: { kg: 3, stiff: 0.25 }, name: "Lamb", tool: "stick", offhand: "lantern", bladeR: 0.03, radius: 0.32 };

export function build({ lod = "far", tool = "stick" } = {}) {
  const T = toolOf(tool), leftBusy = !!(T.left || T.twoHand);
  const cell = { near: 0.042, mid: 0.08 }[lod] || 0.16;
  const M = new Mesh(), B = bind(P);
  torso(M, B, P, { w: 0.22, waist: 0.19, d: 0.15, mat: "coat", front: "shirt", frontW: 0.22, frontFrom: 0.72, chest: 0.08 });
  skirt(M, B, P, { hem: 0.3, flare: 0.55, mat: "coat", gap: 0.05, deep: 1.05 });
  legs(M, B, P, { r: 0.075, mat: "trouser", boot: "boot", bootTop: 0.4 });
  arms(M, B, P, { r: 0.062, mat: "coat", cuff: "coatIn", handR: 0.05 });
  // the collar: turned up, pale, a ring round the neck base
  const nk = J(B, "neck");
  propBlob(M, B, "neck", [0, 0.01, 0.0], [0.105, 0.06, 0.095], "collar", { rings: 6, seg: 18 });
  // double row of brass buttons
  for (const x of [-0.06, 0.06]) for (let k = 0; k < 4; k++) propBlob(M, B, k < 2 ? "chest" : "spine", [x, k < 2 ? -0.02 - k * 0.09 : 0.08 - (k - 2) * 0.09, 0.155], [0.012, 0.012, 0.008], "brass", { rings: 4, seg: 8 });
  // belt
  const sp = J(B, "spine");
  prop(M, B, "spine", [[0, -0.07, 0, 0.205, 0.16], [0, -0.03, 0, 0.205, 0.16]], "strap", { seg: 22 });
  const c = head(M, B, P, { cell, r: 0.15, nose: [0.08, 0.024, 0.45, 0.4], hair: "cap", jaw: 0.92, lids: 0.6, browW: 1.05, chin: 1.1, mouth: 0.85 });
  hat(M, c, 0.15, "brim", { brim: 1.85, crown: 1.05, tilt: 14 });
  // the Kit case on the left hip, its strap across the chest from the right shoulder (unless it is in hand)
  const pel = J(B, "pelvis");
  if (T.left !== "case") {
  prop(M, B, "pelvis", [[0.17, 0.08, -0.17, 0.1, 0.035], [0.18, 0.02, -0.2, 0.13, 0.06], [0.18, -0.16, -0.2, 0.13, 0.06], [0.17, -0.2, -0.19, 0.1, 0.04]], "case", { square: 5, seg: 16 });
  propBlob(M, B, "pelvis", [0.18, -0.04, -0.265], [0.015, 0.025, 0.01], "brass", { rings: 4, seg: 8 });
  const ch = J(B, "chest"), arR = J(B, "armR");
  strap(M, [
    [add(arR, [0.02, 0.03, 0.06]), { chest: 1 }], [add(ch, [-0.06, 0.06, 0.165]), { chest: 1 }], [add(ch, [0.06, -0.08, 0.165]), { chest: 0.6, spine: 0.4 }],
    [add(sp, [0.15, -0.02, 0.15]), { spine: 0.6, pelvis: 0.4 }], [add(pel, [0.2, 0.09, -0.08]), { pelvis: 1 }], [add(pel, [0.18, 0.08, -0.17]), { pelvis: 1 }]], 0.02, "strap");
  }
  // the lantern, hanging from the left fist: brass cap, glass, a flame, a brass foot
  M.begin("lantern"); lantern(M, B, leftBusy ? "hangB" : "hangL"); M.end();
  M.begin("tool"); T.build(M, B); M.end();
  return { M, B, tool: T, grips: { L: true, R: !["shield", "unarmed"].includes(T.cls) }, hands: { L: "fist", R: "fist" } };
}

export function lantern(M, B, j) {
  prop(M, B, j, [[0, 0.09, 0, 0.006], [0, -0.02, 0, 0.006]], "brass", { seg: 6 });
  prop(M, B, j, [[0, -0.02, 0, 0.03], [0, -0.05, 0, 0.055], [0, -0.06, 0, 0.055]], "brass", { seg: 12 });
  prop(M, B, j, [[0, -0.06, 0, 0.05], [0, -0.18, 0, 0.05]], "glass", { seg: 12 });
  propBlob(M, B, j, [0, -0.13, 0], [0.016, 0.03, 0.016], "flame", { rings: 5, seg: 8 });
  prop(M, B, j, [[0, -0.18, 0, 0.058], [0, -0.21, 0, 0.058], [0, -0.22, 0, 0.04]], "brass", { seg: 12 });
}
