// Ambrose Fennick, deacon of the Congregation of the Filament. Fifty; tall, narrow-shouldered,
// a white surplice over black oilskins, a glass bell jar carried under the arm like a hat.
// Exaggerated feature: the neck. Value design: the white surplice is the largest pale mass on the
// quay, so it must stay large (STATE.md note 2: it did not read at quay distance as a cutout).
// Weapon: the filament crook, a lamplighter's brass-hooked pole the Congregation carries in procession.
import { Mesh, bind } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf } from "./tools.mjs";

export const P = { h: 1.99, leg: 0.52, head: 0.25, neck: 0.27, shoulder: 0.155, hip: 0.11, arm: 0.8, stoop: 2 };
export const palette = {
  skin: { c: [0.86, 0.7, 0.6], v: 0.64, sheen: 0.35 },
  coatIn: { c: [0.85, 0.83, 0.78], v: 0.84 },
};
export const info = { coat: { kg: 1.2, stiff: 0.1 }, name: "Fennick", tool: "crook", offhand: "bell jar", bladeR: 0.04, radius: 0.28 };

export function build({ lod = "far", tool = "crook" } = {}) {
  const T = toolOf(tool);
  const cell = { near: 0.042, mid: 0.08 }[lod] || 0.16;
  const M = new Mesh(), B = bind(P);
  torso(M, B, P, { w: 0.2, waist: 0.17, d: 0.13, mat: "surplice" });
  skirt(M, B, P, { top: J(B, "pelvis")[1] - 0.25, hem: 0.08, flare: 0.25, waistAdd: 0.02, mat: "oilskin", gap: 0.03 });
  skirt(M, B, P, { top: J(B, "pelvis")[1] + 0.12, hem: 0.46, flare: 0.62, waistAdd: -0.035, mat: "surplice", gap: 0.0, deep: 1.05 });
  legs(M, B, P, { r: 0.068, mat: "oilskin", boot: "boot", bootTop: 0.3 });
  arms(M, B, P, { r: 0.058, mat: "surplice", bell: 1.55, bellMat: "surplice" });
  // a black stole down the front of the surplice
  for (const x of [-1, 1]) prop(M, B, "chest", [[x * 0.07, 0.2, 0.06, 0.02, 0.006], [x * 0.05, 0.1, 0.135, 0.02, 0.006], [x * 0.045, -0.1, 0.15, 0.021, 0.006], [x * 0.05, -0.32, 0.16, 0.022, 0.006], [x * 0.055, -0.62, 0.19, 0.024, 0.006]], "oilskin", { seg: 6 });
  const c = head(M, B, P, { cell, r: 0.13, neck: 0.045, nose: [0.07, 0.017, 0.15, 0.8], hair: "none", jaw: 0.8, brow: "band", lids: 0.15, cheeks: true, chin: 0.8, mouth: 1.1 });
  // a fringe of grey hair round the back of the bald head
  propBlob(M, B, "head", [0, 0.1, -0.06], [0.12, 0.05, 0.1], "band", { rings: 6, seg: 14 });
  // the bell jar, under the left arm (set down when he fights)
  M.begin("jar"); jar(M, B); M.end();
  M.begin("tool"); T.build(M, B); M.end();
  return { M, B, tool: T, grips: { L: false, R: true }, hands: { L: "open", R: "fist" } };
}
function jar(M, B) {
  const ch = J(B, "chest"), base = add(ch, [0.33, -0.5, 0.1]), W = { chest: 0.3, spine: 0.3, armL: 0.4 }, pts = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6, a = t * Math.PI * 0.5; pts.push({ c: add(base, [0, 0.03 + Math.sin(a) * 0.24, 0]), rx: 0.12 * Math.cos(a * 0.85) + 0.012, rz: 0.12 * Math.cos(a * 0.85) + 0.012, w: W }); }
  M_tube(M, pts, "glass");
  propBlob(M, B, "chest", [0.33, -0.21, 0.1], [0.02, 0.022, 0.02], "brass", { rings: 4, seg: 8 });
}
import { tube } from "../rig/body.mjs";
const M_tube = (M, rings, mat) => tube(M, rings, { mat: mid(mat), seg: 16, capA: false });
// Style: upright and ecstatic; the left arm keeps the jar pinned whatever the clip does.
export function style(p, clip) {
  const calm = clip.tags?.includes("calm");
  if (calm) { p.armL = { ...(p.armL || {}), fwd: 4, out: 26, twist: 0 }; p.foreL = { ...(p.foreL || {}), bend: 78 }; p.handL = { bend: 30, side: 0 }; }
  else p.hide = ["jar"];
  if (calm) { p.chest = { ...(p.chest || {}), bend: (p.chest?.bend || 0) - 4 }; p.head = { ...(p.head || {}), bend: (p.head?.bend || 0) - 10 }; }
  return p;
}
