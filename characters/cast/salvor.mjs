// The skirmisher: a salvor of the Low Company (combat's skirmisher archetype; f.salvor and kin).
// Quick and fragile, low to the ground. Read from across the quay: the pale canvas smock (the light
// coat), the red knitted cap, the coil of rope across the body, the mud bag on the hip, the crowbar.
// Exaggerated feature: the stoop, and long arms that nearly reach the ground.
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf } from "./tools.mjs";

export const P = { h: 1.74, leg: 0.5, head: 0.26, neck: 0.13, shoulder: 0.17, hip: 0.11, arm: 0.84, stoop: 20 };
export const palette = { skin: { c: [0.8, 0.6, 0.48], v: 0.58 } };
export const info = { coat: { kg: 1, stiff: 0.1 }, name: "Salvor", tool: "crowbar", offhand: "mud", bladeR: 0.03, radius: 0.28 };

export function build({ lod = "far", tool = "crowbar" } = {}) {
  const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16;
  const M = new Mesh(), B = bind(P), ch = J(B, "chest");
  torso(M, B, P, { w: 0.19, waist: 0.17, d: 0.13, mat: "canvas" });
  skirt(M, B, P, { hem: 0.62, flare: 0.25, mat: "canvas", gap: 0.06 });
  legs(M, B, P, { r: 0.068, mat: "trouser", boot: "boot", bootTop: 0.5, foot: 0.25 });
  arms(M, B, P, { r: 0.058, mat: "canvas", rolled: "skin", handR: 0.052 });
  head(M, B, P, { cell, r: 0.13, neck: 0.05, nose: [0.075, 0.02, 0.6, 0.5], hair: "none", jaw: 0.8, lids: 0.3, browW: 1.0, chin: 1.3, mouth: 1.1 });
  propBlob(M, B, "head", [0, 0.2, -0.02], [0.135, 0.09, 0.14], "knit", { rings: 8, seg: 16 });
  propBlob(M, B, "head", [0, 0.29, -0.03], [0.03, 0.03, 0.03], "knit", { rings: 4, seg: 8 });
  // the rope coil across the body
  const pts = [];
  for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI * 2; pts.push({ c: add(ch, [0.02 + 0.2 * Math.cos(a), -0.12 + 0.22 * Math.sin(a) + 0.1 * Math.cos(a), 0.02 + 0.15 * Math.sin(a + 0.6)]), rx: 0.03, rz: 0.03, w: { chest: 0.7, spine: 0.3 } }); }
  M.begin("rope"); tube(M, pts, { mat: mid("rope"), seg: 8 }); M.end();
  propBlob(M, B, "pelvis", [0.2, 0.0, 0.08], [0.08, 0.1, 0.07], "case", { rings: 6, seg: 12 });   // the mud bag
  M.begin("tool"); T.build(M, B); M.end();
  return { M, B, tool: T, grips: { L: false, R: true }, hands: { L: "open", R: "fist" } };
}
// Style: low and ready, weight forward.
export function style(p) {
  p.root = { ...(p.root || {}), y: (p.root?.y || 0) - 0.04 };
  for (const s of ["L", "R"]) { p["shin" + s] = { ...(p["shin" + s] || {}), bend: (p["shin" + s]?.bend || 0) + 8 }; p["thigh" + s] = { ...(p["thigh" + s] || {}), fwd: (p["thigh" + s]?.fwd || 0) + 6 }; }
  return p;
}
