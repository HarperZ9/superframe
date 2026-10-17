// The holder: a tide-warden of the Harbour Board (combat's holder archetype; f.warden and kin).
// Heavy, slow, long reach. Read from across the quay: the sou'wester with its long back brim, the
// pale oilskin cape over the shoulders, chest waders, the hook in the right hand and the chain
// hanging from the left. Exaggerated feature: the cape's breadth over short legs.
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, legs, arms, head, prop, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf } from "./tools.mjs";

export const P = { h: 2.0, leg: 0.46, head: 0.27, neck: 0.09, shoulder: 0.26, hip: 0.16, arm: 0.8, stoop: 8 };
export const palette = { oilskin: { c: [0.78, 0.72, 0.42], v: 0.74 }, coatIn: { c: [0.3, 0.28, 0.2], v: 0.26 } };
export const info = { coat: { kg: 2.5, stiff: 0.5 }, name: "Tide-warden", tool: "hook", offhand: "chain", bladeR: 0.05, radius: 0.42 };

export function build({ lod = "far", tool = "hook" } = {}) {
  const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16;
  const M = new Mesh(), B = bind(P), nk = J(B, "neck");
  torso(M, B, P, { w: 0.3, waist: 0.3, d: 0.22, belly: 0.06, mat: "wader" });
  for (const x of [-0.1, 0.1]) prop(M, B, "chest", [[x, 0.2, 0.17, 0.02, 0.006], [x, -0.1, 0.22, 0.02, 0.006]], "strap", { seg: 6 });
  legs(M, B, P, { r: 0.1, mat: "wader", boot: "wader", bootTop: 1.0, bootWide: 1.2, foot: 0.3 });
  arms(M, B, P, { r: 0.09, mat: "knit", cuff: "knit", handR: 0.066 });
  // the cape: a short flared skirt hung from the shoulders, open at the front
  const rings = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6, y = nk[1] - 0.02 - t * 0.55; rings.push({ c: [0, y, -0.02], rx: 0.17 + 0.34 * Math.pow(t, 0.7), rz: 0.15 + 0.26 * Math.pow(t, 0.7), w: t < 0.4 ? { chest: 1 } : { chest: 0.6, clavL: 0.2, clavR: 0.2 } }); }
  tube(M, rings, { arc: [-Math.PI * 0.62, Math.PI * 1.62], seg: 22, mat: mid("oilskin") });
  head(M, B, P, { cell, r: 0.155, neck: 0.08, nose: [0.05, 0.03, 0.4, 0], hair: "none", jaw: 1.2, lids: 0.8, browW: 1.3, mouth: 0.9, stubble: true });
  // the sou'wester: a soft crown and a brim long at the back
  propBlob(M, B, "head", [0, 0.2, -0.02], [0.165, 0.11, 0.17], "oilskin", { rings: 8, seg: 18 });
  propBlob(M, B, "head", [0, 0.13, -0.06], [0.24, 0.014, 0.27], "oilskin", { rings: 6, seg: 26, rmod: (th) => 1 + 0.3 * Math.max(0, -Math.sin(th)) });
  // the chain, hanging from the left fist: links and an iron weight
  M.begin("chain");
  for (let k = 0; k < 9; k++) propBlob(M, B, "handL", [0, -0.1 - k * 0.06, 0.02], [0.016, 0.03, k % 2 ? 0.008 : 0.016], "iron", { rings: 4, seg: 8 });
  propBlob(M, B, "handL", [0, -0.68, 0.02], [0.045, 0.05, 0.045], "iron", { rings: 6, seg: 10 });
  M.end();
  M.begin("tool"); T.build(M, B); M.end();
  return { M, B, tool: T, grips: { L: true, R: true }, hands: { L: "fist", R: "fist" } };
}
// Style: planted, the head low.
export function style(p) {
  for (const s of ["L", "R"]) p["thigh" + s] = { ...(p["thigh" + s] || {}), out: (p["thigh" + s]?.out || 0) + 4 };
  p.head = { ...(p.head || {}), bend: (p.head?.bend || 0) - 4 };
  return p;
}
