// Wenna Tallow, keeper of Mother (design/CAST-SHEETS.md). Exaggerated: the oversized head on a small
// round back. The oxblood keeper's coat, too long, cuffs turned back twice, over a grey gansey; a
// white crop cut with a knife; a brass key on a string at her neck.
import { Mesh, bind } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob } from "./parts.mjs";
import { toolOf } from "./tools.mjs";

export const P = { h: 1.52, leg: 0.44, head: 0.31, neck: 0.06, shoulder: 0.17, hip: 0.14, arm: 0.72, stoop: 24 };
export const palette = { skin: { c: [0.86, 0.7, 0.6], v: 0.62 }, coatIn: { c: [0.42, 0.42, 0.42], v: 0.4 } };
export const info = { coat: { kg: 2.5, stiff: 0.2 }, name: "Wenna", tool: "hands", bladeR: 0.03, radius: 0.3 };

export function build({ lod = "far", tool = "hands" } = {}) {
  const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16, M = new Mesh(), B = bind(P);
  torso(M, B, P, { w: 0.18, waist: 0.17, d: 0.15, mat: "oxblood", front: "gansey", frontW: 0.25, frontFrom: 0.55 });
  skirt(M, B, P, { hem: 0.12, flare: 0.45, mat: "oxblood", gap: 0.05 });
  legs(M, B, P, { r: 0.065, mat: "trouser", boot: "boot", bootTop: 0.4, foot: 0.22 });
  arms(M, B, P, { r: 0.058, mat: "oxblood", cuff: "gansey", handR: 0.05 });
  head(M, B, P, { cell, r: 0.17, neck: 0.055, nose: [0.04, 0.02, 0.3, 0], hair: "crop", hairMat: "band", jaw: 0.95, lids: 0.85, mouth: 0.8, chin: 0.9 });
  prop(M, B, "chest", [[-0.05, 0.2, 0.1, 0.003], [0, 0.04, 0.17, 0.003], [0.05, 0.2, 0.1, 0.003]], "rope", { seg: 4 });
  propBlob(M, B, "chest", [0, 0.02, 0.175], [0.012, 0.035, 0.006], "brass", { rings: 4, seg: 8 });   // the brass key
  M.begin("tool"); T.build(M, B); M.end();
  return { M, B, tool: T, grips: { L: false, R: tool !== "hands" }, hands: { L: "open", R: "open" } };
}
// Style: the head held up to see past the stoop.
export function style(p) { p.head = { ...(p.head || {}), bend: (p.head?.bend || 0) - 12 }; return p; }
