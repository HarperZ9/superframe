// Tobias "Tub" Merrow, master of the Low Company (design/CAST-SHEETS.md). Exaggerated: short and wide,
// wet to the thigh. Yellow oilskin smock (his pale mass under sodium, 0.6), dark trousers dark with wet,
// a rope coil on one shoulder, a knitted cap, a cold pipe.
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf } from "./tools.mjs";

export const P = { h: 1.63, leg: 0.45, head: 0.27, neck: 0.06, shoulder: 0.24, hip: 0.17, arm: 0.78, stoop: 9 };
export const palette = { skin: { c: [0.74, 0.54, 0.44], v: 0.52 } };
export const info = { coat: { kg: 2, stiff: 0.45 }, name: "Merrow", tool: "hands", bladeR: 0.04, radius: 0.38 };

export function build({ lod = "far", tool = "hands" } = {}) {
  const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16, M = new Mesh(), B = bind(P), ch = J(B, "chest");
  torso(M, B, P, { w: 0.27, waist: 0.28, d: 0.21, belly: 0.08, mat: "yellow" });
  skirt(M, B, P, { hem: 0.62, flare: 0.2, waistAdd: 0.08, mat: "yellow", gap: 0.03 });
  legs(M, B, P, { r: 0.095, mat: "wader", boot: "boot", bootTop: 0.6, bootWide: 1.15 });
  arms(M, B, P, { r: 0.085, mat: "yellow", cuff: "yellow", handR: 0.064 });
  head(M, B, P, { cell, r: 0.145, neck: 0.075, nose: [0.035, 0.032, 0.2, 0], hair: "none", jaw: 1.2, lids: 0.7, browW: 1.2, mouth: 1.0, stubble: true });
  propBlob(M, B, "head", [0, 0.18, -0.02], [0.15, 0.1, 0.155], "knit", { rings: 8, seg: 16 });
  prop(M, B, "head", [[0.03, 0.04, 0.16, 0.007], [0.06, 0.0, 0.25, 0.007]], "wood", { seg: 6 });
  propBlob(M, B, "head", [0.065, 0.02, 0.26], [0.016, 0.025, 0.016], "wood", { rings: 4, seg: 8 });   // the cold pipe
  const pts = [];
  for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI * 2; pts.push({ c: add(ch, [-0.2 + 0.03 * Math.sin(a), 0.1 + 0.16 * Math.cos(a), 0.16 * Math.sin(a)]), rx: 0.035, rz: 0.035, w: { chest: 0.6, clavR: 0.4 } }); }
  M.begin("rope"); tube(M, pts, { mat: mid("rope"), seg: 8 }); M.end();
  M.begin("tool"); T.build(M, B); M.end();
  return { M, B, tool: T, grips: { L: false, R: tool !== "hands" }, hands: { L: "fist", R: "open" } };
}
// Style: feet apart as if on a deck.
export function style(p) { for (const s of ["L", "R"]) p["thigh" + s] = { ...(p["thigh" + s] || {}), out: (p["thigh" + s]?.out || 0) + 6 }; return p; }
