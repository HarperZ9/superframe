// Marrow Dunlin, shop steward of the Guild of the Gut. Forty-five; the largest man on the quay and
// the gentlest with a knife. Vast, aproned, forearms shining with scales that never wash off, the
// blindfold still round his neck. Exaggerated feature: girth. Value design: the white apron front
// against the dark smock, and the white band at the throat.
// Weapon: a priest (the short weighted club a fisherman kills fish with); a gutting knife on the belt.
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf } from "./tools.mjs";

export const P = { h: 2.04, leg: 0.45, head: 0.29, neck: 0.07, shoulder: 0.27, hip: 0.17, arm: 0.84, stoop: 11 };
export const palette = {
  smock: { c: [0.24, 0.29, 0.38], v: 0.26 },
  coatIn: { c: [0.2, 0.24, 0.32], v: 0.22 },
  skin: { c: [0.86, 0.6, 0.5], v: 0.6 },
};
export const info = { coat: { kg: 1.5, stiff: 0.2 }, name: "Marrow", tool: "priest", offhand: "none", bladeR: 0.06, radius: 0.45 };

export function build({ lod = "far", tool = "priest" } = {}) {
  const T = toolOf(tool);
  const cell = { near: 0.042, mid: 0.08 }[lod] || 0.16;
  const M = new Mesh(), B = bind(P), pel = J(B, "pelvis");
  torso(M, B, P, { w: 0.33, waist: 0.36, d: 0.25, belly: 0.13, mat: "smock", chest: 0.06 });
  // the apron: a front panel from the chest to below the knee, ties round the back
  const rings = []; for (let i = 0; i <= 8; i++) { const t = i / 8, y = pel[1] + 0.5 - t * 1.0; rings.push({ c: [0, y, 0], rx: 0.4 + 0.02 * t, rz: t < 0.5 ? 0.33 + 0.1 * Math.sin(Math.PI * t * 1.6) : 0.42 - 0.12 * (t - 0.5), w: t < 0.45 ? { spine: 1 - t, pelvis: t } : { pelvis: 1 - (t - 0.45), thighL: (t - 0.45) / 2, thighR: (t - 0.45) / 2 } }); }
  tube(M, rings, { arc: [Math.PI * 0.2, Math.PI * 0.8], seg: 10, mat: mid("apron") });
  prop(M, B, "spine", [[0, -0.02, 0.05, 0.4, 0.33], [0, 0.02, 0.05, 0.4, 0.33]], "apron", { seg: 24 });
  legs(M, B, P, { r: 0.1, mat: "trouser", boot: "boot", bootTop: 0.95, bootWide: 1.15, foot: 0.3 });
  arms(M, B, P, { r: 0.1, mat: "smock", rolled: "scales", handR: 0.068 });
  const c = head(M, B, P, { cell, r: 0.16, neck: 0.085, nose: [0.055, 0.034, 0.35, 0], hair: "crop", jaw: 1.25, jowls: 1.0, lids: 0.7, browW: 1.2, cheeks: true, mouth: 1.2, stubble: true });
  // the blindfold, round the neck
  const nk = J(B, "neck"); tube(M, [{ c: add(nk, [0, 0.0, 0.01]), rx: 0.115, rz: 0.115, w: { neck: 0.6, chest: 0.4 } }, { c: add(nk, [0, 0.05, 0.015]), rx: 0.11, rz: 0.11, w: { neck: 1 } }], { mat: mid("band"), seg: 16 });
  propBlob(M, B, "neck", [0.0, 0.02, 0.12], [0.03, 0.04, 0.02], "band", { rings: 4, seg: 8 });
  // the gutting knife on the belt
  propBlob(M, B, "pelvis", [-0.3, 0.18, 0.12], [0.02, 0.07, 0.03], "wood", { rings: 5, seg: 8 });
  propBlob(M, B, "pelvis", [-0.31, 0.03, 0.12], [0.008, 0.09, 0.022], "steel", { rings: 5, seg: 8 });
  M.begin("tool"); T.build(M, B); M.end();
  return { M, B, tool: T, grips: { L: false, R: true }, hands: { L: "open", R: "fist" } };
}

// Style: a wide planted stance and a heavy forward set of the shoulders.
export function style(p, clip) {
  for (const s of ["L", "R"]) p["thigh" + s] = { ...(p["thigh" + s] || {}), out: (p["thigh" + s]?.out || 0) + 5 };
  for (const s of ["L", "R"]) p["arm" + s] = { ...(p["arm" + s] || {}), out: (p["arm" + s]?.out || 0) + 8 };
  if (clip.tags?.includes("calm")) p.head = { ...(p.head || {}), bend: (p.head?.bend || 0) - 6 };
  return p;
}
