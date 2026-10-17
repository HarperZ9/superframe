// Sabine Brine, landlady of the Brine (design/CAST-SHEETS.md). Exaggerated: width and quickness.
// Sleeves rolled, a striped apron over a dark skirt, a crossed shawl, the pickling fork through the
// bun. Pale mass: the apron (0.75) against the skirt (0.2).
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf } from "./tools.mjs";

export const P = { h: 1.62, leg: 0.47, head: 0.27, neck: 0.08, shoulder: 0.22, hip: 0.15, arm: 0.76, stoop: 4 };
export const palette = { skin: { c: [0.88, 0.66, 0.54], v: 0.62 } };
export const info = { coat: { kg: 1.5, stiff: 0.1 }, name: "Sabine", tool: "hands", bladeR: 0.04, radius: 0.36 };

export function build({ lod = "far", tool = "hands" } = {}) {
  const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16, M = new Mesh(), B = bind(P), pel = J(B, "pelvis"), ch = J(B, "chest");
  torso(M, B, P, { w: 0.24, waist: 0.19, d: 0.16, belly: 0.03, chest: 0.12, mat: "shirt" });
  skirt(M, B, P, { top: pel[1] + 0.02, hem: 0.18, flare: 0.12, waistAdd: 0.0, mat: "skirtd", gap: 0.02, deep: 0.95 });
  const rings = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; rings.push({ c: [0, pel[1] + 0.3 - t * 0.85, 0], rx: 0.26 + 0.03 * t, rz: 0.22 + 0.04 * t, w: t < 0.35 ? { spine: 1 - t, pelvis: t } : { pelvis: 1 - (t - 0.35) * 0.8, thighL: (t - 0.35) * 0.4, thighR: (t - 0.35) * 0.4 } }); }
  tube(M, rings, { arc: [Math.PI * 0.22, Math.PI * 0.78], seg: 10, matfn: (th) => mid(Math.floor(th / 0.11) % 3 === 1 ? "skirtd" : "stripe") });
  for (const x of [-1, 1]) tube(M, [{ c: add(ch, [x * 0.2, 0.16, -0.02]), rx: 0.05, rz: 0.03, w: { chest: 1 } }, { c: add(ch, [x * 0.08, 0.02, 0.17]), rx: 0.06, rz: 0.03, w: { chest: 1 } }, { c: add(ch, [-x * 0.12, -0.14, 0.18]), rx: 0.05, rz: 0.03, w: { chest: 0.6, spine: 0.4 } }], { mat: mid("oxblood"), seg: 8 });
  legs(M, B, P, { r: 0.08, mat: "skirtd", boot: "boot", bootTop: 0.3, foot: 0.22 });
  arms(M, B, P, { r: 0.07, mat: "shirt", rolled: "skin", handR: 0.056 });
  head(M, B, P, { cell, r: 0.145, neck: 0.07, nose: [0.05, 0.026, 0.3, 0], hair: "cap", hairMat: "hair", jaw: 1.05, lids: 0.3, mouth: 1.35 });
  propBlob(M, B, "head", [0, 0.2, -0.12], [0.08, 0.07, 0.07], "hair", { rings: 6, seg: 12 });   // the bun
  prop(M, B, "head", [[0.02, 0.18, -0.12, 0.006], [0.1, 0.32, -0.2, 0.006]], "steel", { seg: 6 });   // the fork through it
  M.begin("tool"); T.build(M, B); M.end();
  return { M, B, tool: T, grips: { L: false, R: tool !== "hands" }, hands: { L: "open", R: "open" } };
}
// Style: never still; weight on the balls of the feet.
export function style(p) { p.footL = { ...(p.footL || {}), bend: (p.footL?.bend || 0) + 6 }; p.footR = { ...(p.footR || {}), bend: (p.footR?.bend || 0) + 6 }; return p; }
