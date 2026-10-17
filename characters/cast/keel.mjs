// Absalom Keel, harbourmaster (design/CAST-SHEETS.md). Exaggerated: height and narrowness, and the
// water. Navy greatcoat black with wet to the ankle, buttoned to the throat; the peaked cap that
// funnels water; a pale face and white cap badge the only light masses; a speaking trumpet under the
// arm; a drip from cuffs and brim that never stops (info.drip, drawn by the renderer each frame).
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf } from "./tools.mjs";

export const P = { h: 2.1, leg: 0.55, head: 0.26, neck: 0.18, shoulder: 0.18, hip: 0.11, arm: 0.86, stoop: 0 };
export const palette = { skin: { c: [0.66, 0.68, 0.66], v: 0.62 }, coatIn: { c: [0.08, 0.1, 0.16], v: 0.12 } };
export const info = { coat: { kg: 4, stiff: 0.2 }, name: "Keel", tool: "hands", offhand: "trumpet", bladeR: 0.05, radius: 0.3, drip: ["handL", "handR", "head"] };

export function build({ lod = "far", tool = "hands" } = {}) {
  const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16, M = new Mesh(), B = bind(P);
  torso(M, B, P, { w: 0.2, waist: 0.17, d: 0.13, mat: "navy" });
  skirt(M, B, P, { hem: 0.12, flare: 0.3, mat: "navy", gap: 0.02 });
  legs(M, B, P, { r: 0.07, mat: "navy", boot: "boot", bootTop: 0.3 });
  arms(M, B, P, { r: 0.062, mat: "navy", cuff: "navy", handR: 0.054 });
  for (let k = 0; k < 6; k++) propBlob(M, B, k < 3 ? "chest" : "spine", [0, 0.12 - (k % 3) * 0.11, 0.135], [0.012, 0.012, 0.008], "brass", { rings: 4, seg: 8 });
  propBlob(M, B, "neck", [0, 0.0, 0.0], [0.085, 0.07, 0.08], "navy", { rings: 6, seg: 16 });   // buttoned to the throat
  head(M, B, P, { cell, r: 0.13, neck: 0.05, nose: [0.06, 0.02, 0.2, 0], hair: "none", jaw: 1.25, chin: 1.4, lids: 0.5, mouth: 0.7 });
  // the peaked cap: crown, band, the peak out front, the badge
  const hd = J(B, "head"), W = { head: 1 };
  tube(M, [{ c: add(hd, [0, 0.19, 0.0]), rx: 0.135, rz: 0.14, w: W }, { c: add(hd, [0, 0.26, 0.0]), rx: 0.14, rz: 0.145, w: W }, { c: add(hd, [0, 0.31, -0.01]), rx: 0.17, rz: 0.17, w: W }], { mat: mid("navy"), seg: 20 });
  propBlob(M, B, "head", [0, 0.19, 0.15], [0.12, 0.012, 0.07], "boot", { rings: 4, seg: 14 });
  propBlob(M, B, "head", [0, 0.26, 0.14], [0.025, 0.02, 0.008], "paper", { rings: 4, seg: 8 });
  M.begin("trumpet"); prop(M, B, "chest", [[0.25, -0.18, -0.12, 0.025], [0.25, -0.18, 0.12, 0.06], [0.25, -0.18, 0.2, 0.09]], "brass", { seg: 12, capB: false }); M.end();
  M.begin("tool"); T.build(M, B); M.end();
  return { M, B, tool: T, grips: { L: false, R: tool !== "hands" }, hands: { L: "open", R: "open" } };
}
// Style: rigidly upright; turns the whole body, not the head.
export function style(p) { p.head = { ...(p.head || {}), turn: 0, side: 0 }; p.neck = { ...(p.neck || {}), turn: 0 }; p.spine = { ...(p.spine || {}), bend: (p.spine?.bend || 0) * 0.4 }; return p; }
