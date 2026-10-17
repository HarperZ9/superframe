// The Lamplighters (design/CAST-SHEETS.md): one costume, a long dark Municipal coat, a cap with a brass
// badge, a brass pole longer than the wearer, a notebook in the breast pocket. Variants: gorm (sergeant:
// pale braid on the cuffs, the open book in her left hand), hobb (two lit lanterns, the pole on his back,
// a coat too big), fewell (heavy moustache), strand (pale scarf), bright (spectacles), coe (thickset,
// a muffler). Each variant is a cast member: import { GORM, HOBB, ... }.
import { Mesh, bind } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob } from "./parts.mjs";
import { toolOf } from "./tools.mjs";
import { lantern } from "./lamb.mjs";

const V = {
  gorm: { P: { h: 1.7, leg: 0.49, head: 0.26, neck: 0.12, shoulder: 0.18, hip: 0.13, arm: 0.76, stoop: 3 }, face: { nose: [0.045, 0.026, 0.2, 0], jaw: 1.3, lids: 0.2, browW: 1.2, mouth: 0.8 } },
  hobb: { P: { h: 1.92, leg: 0.55, head: 0.24, neck: 0.17, shoulder: 0.15, hip: 0.11, arm: 0.84, stoop: 6 }, face: { nose: [0.07, 0.02, 0.4, 0.2], jaw: 0.8, chin: 1.3, lids: 0.1, mouth: 0.7 } },
  fewell: { P: { h: 1.8, leg: 0.5, head: 0.25, neck: 0.12, shoulder: 0.19, hip: 0.12, arm: 0.78, stoop: 2 }, face: { nose: [0.06, 0.028, 0.3, 0], jaw: 1.1, lids: 0.5, stubble: true } },
  strand: { P: { h: 1.74, leg: 0.48, head: 0.27, neck: 0.1, shoulder: 0.2, hip: 0.14, arm: 0.76, stoop: 4 }, face: { nose: [0.05, 0.022, 0.3, 0.3], jaw: 0.95, lids: 0.6 } },
  bright: { P: { h: 1.84, leg: 0.51, head: 0.24, neck: 0.13, shoulder: 0.17, hip: 0.12, arm: 0.8, stoop: 0 }, face: { nose: [0.065, 0.02, 0.2, 0.5], jaw: 0.9, lids: 0.3 } },
  coe: { P: { h: 1.68, leg: 0.47, head: 0.26, neck: 0.11, shoulder: 0.21, hip: 0.15, arm: 0.75, stoop: 5 }, face: { nose: [0.04, 0.03, 0.3, 0], jaw: 1.3, lids: 0.6, jowls: 0.8 } },
};

function make(name) {
  const v = V[name], hobb = name === "hobb", defTool = hobb ? "hands" : "pole";
  const member = {
    P: v.P, palette: {}, info: { coat: { kg: 3.5, stiff: 0.25 }, name, tool: defTool, bladeR: 0.04, radius: 0.3 },
    build({ lod = "far", tool = defTool } = {}) {
      const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16, M = new Mesh(), B = bind(v.P), R = 0.135 * (v.P.head / 0.26);
      torso(M, B, v.P, { w: 0.2 + (name === "coe" ? 0.04 : 0), waist: 0.18, d: 0.14, mat: "muni" });
      skirt(M, B, v.P, { hem: 0.2, flare: 0.4, mat: "muni", gap: 0.03, wide: hobb ? 1.15 : 1 });
      legs(M, B, v.P, { r: 0.07, mat: "trouser", boot: "boot", bootTop: 0.35 });
      arms(M, B, v.P, { r: hobb ? 0.072 : 0.062, mat: "muni", cuff: name === "gorm" ? "braid" : "muni", handR: 0.052 });
      for (let k = 0; k < 4; k++) propBlob(M, B, "chest", [0.03, 0.1 - k * 0.1, 0.14], [0.011, 0.011, 0.008], "brass", { rings: 4, seg: 8 });
      propBlob(M, B, "chest", [-0.1, 0.05, 0.14], [0.04, 0.05, 0.012], "paper", { rings: 4, seg: 8 });   // the notebook
      head(M, B, v.P, { cell, r: R, neck: 0.055, hair: "none", ...v.face });
      propBlob(M, B, "head", [0, R * 1.68, -0.01], [R * 1.04, R * 0.42, R * 1.06], "muni", { rings: 6, seg: 16 });   // the cap
      propBlob(M, B, "head", [0, R * 1.32, R * 0.85], [R * 0.85, 0.012, R * 0.45], "boot", { rings: 4, seg: 12 });
      propBlob(M, B, "head", [0, R * 1.68, R * 1.05], [0.02, 0.018, 0.008], "brass", { rings: 4, seg: 8 });
      if (name === "strand" || name === "coe") propBlob(M, B, "neck", [0, 0, 0], [0.09, 0.06, 0.09], name === "strand" ? "paper" : "gansey", { rings: 6, seg: 14 });
      if (name === "fewell") propBlob(M, B, "head", [0, R * 0.4, R * 0.92], [R * 0.4, R * 0.08, R * 0.12], "hair", { rings: 4, seg: 10 });
      if (name === "bright") for (const x of [-1, 1]) propBlob(M, B, "head", [x * R * 0.33, R * 1.03, R * 0.93], [R * 0.16, R * 0.13, 0.006], "glass", { rings: 4, seg: 10 });
      if (name === "gorm") { M.begin("book"); propBlob(M, B, "handL", [0.0, -0.06, 0.06], [0.08, 0.005, 0.11], "paper", { rings: 3, seg: 8 }); M.end(); }
      if (hobb) { M.begin("lanterns"); lantern(M, B, "hangL"); lantern(M, B, "hangR"); M.end(); prop(M, B, "chest", [[0.2, 0.5, -0.17, 0.016], [-0.25, -0.9, -0.2, 0.016]], "brass", { seg: 8 }); }
      M.begin("tool"); T.build(M, B); M.end();
      return { M, B, tool: T, grips: { L: name === "gorm" || hobb || !!T.twoHand, R: tool !== "hands" || hobb }, hands: { L: name === "gorm" || hobb ? "fist" : "open", R: hobb ? "fist" : "open" } };
    },
  };
  // Hobb holds both lanterns out from the body, never lowered
  if (hobb) member.style = (p) => { for (const s of ["L", "R"]) { p["arm" + s] = { ...(p["arm" + s] || {}), fwd: Math.max(p["arm" + s]?.fwd || 0, 34), out: (p["arm" + s]?.out || 0) + 10 }; p["fore" + s] = { ...(p["fore" + s] || {}), bend: Math.max(p["fore" + s]?.bend || 0, 40) }; } return p; };
  return member;
}
export const GORM = make("gorm"), HOBB = make("hobb"), FEWELL = make("fewell"), STRAND = make("strand"), BRIGHT = make("bright"), COE = make("coe");
