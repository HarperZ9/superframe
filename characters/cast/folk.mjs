// The wider cast from design/CAST-SHEETS.md, built from one data-driven costume script: a record per
// person (proportions, coat or dress, legs, sleeves, face, hair, headgear, neckwear, props, style).
// Members: PIP, CRAKE, FISK, PELLOW, ROOK, ASH, SALLIS, PARDEW, DACE, ORME, LUGG, COCKLE, PENHALLOW,
// TEAGUE, MAB, NOLL, SPRATT, SHADWELL, GAUZE, TOBIT, DILLY, GILL, DUNLIN.
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf } from "./tools.mjs";
import { MATS, BY_ID } from "../rig/materials.mjs";

// a few more materials for this cast
// (the extra materials this cast uses live in rig/materials.mjs)

const hatOn = (M, B, R, kind, mat = "black") => {
  const hd = J(B, "head"), W = { head: 1 };
  if (kind === "bowler") { propBlob(M, B, "head", [0, R * 1.62, -0.01], [R * 1.0, R * 0.62, R * 1.02], mat, { rings: 8, seg: 16 }); propBlob(M, B, "head", [0, R * 1.3, -0.01], [R * 1.4, 0.012, R * 1.45], mat, { rings: 4, seg: 18 }); }
  if (kind === "peaked") { tube(M, [{ c: add(hd, [0, R * 1.4, 0]), rx: R * 1.02, rz: R * 1.05, w: W }, { c: add(hd, [0, R * 1.9, -0.01]), rx: R * 1.15, rz: R * 1.15, w: W }], { mat: mid(mat), seg: 18 }); propBlob(M, B, "head", [0, R * 1.42, R * 1.0], [R * 0.85, 0.012, R * 0.5], "boot", { rings: 4, seg: 12 }); }
  if (kind === "knit") propBlob(M, B, "head", [0, R * 1.45, -0.02], [R * 1.05, R * 0.75, R * 1.07], mat, { rings: 8, seg: 16 });
  if (kind === "maidcap") propBlob(M, B, "head", [0, R * 1.7, -0.05], [R * 0.9, R * 0.3, R * 0.85], "paper", { rings: 6, seg: 14 });
  if (kind === "roll") propBlob(M, B, "head", [0, R * 1.5, -R * 0.6], [R * 0.75, R * 0.45, R * 0.5], mat, { rings: 6, seg: 12 });
};

function make(spec) {
  const P = spec.P, R = 0.135 * (P.head / 0.26);
  return {
    P, palette: spec.palette || {}, info: { coat: spec.coatKg || { kg: 2, stiff: 0.2 }, name: spec.name, tool: spec.tool || "hands", bladeR: 0.04, radius: 0.3 },
    build({ lod = "far", tool = spec.tool || "hands" } = {}) {
      const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16, M = new Mesh(), B = bind(P), pel = J(B, "pelvis");
      torso(M, B, P, { w: P.shoulder + 0.03, waist: P.shoulder - 0.01 + (spec.belly || 0), d: 0.14, mat: spec.top, front: spec.front, frontW: spec.frontW || 0.2, frontFrom: spec.frontFrom ?? 0.6 });
      if (spec.coat) skirt(M, B, P, { hem: spec.coat.hem, flare: spec.coat.flare ?? 0.35, mat: spec.coat.mat || spec.top, gap: spec.coat.gap ?? 0.03 });
      if (spec.dress) skirt(M, B, P, { top: pel[1] + 0.02, hem: spec.dress.hem, flare: spec.dress.flare ?? 0.15, mat: spec.dress.mat, gap: 0.01 });
      if (spec.apron) { const rings = []; for (let i = 0; i <= 8; i++) { const t = i / 8; rings.push({ c: [0, pel[1] + 0.25 - t * (pel[1] + 0.25 - spec.apron.hem), 0], rx: P.hip + 0.1 + 0.03 * t, rz: P.hip + 0.06 + 0.04 * t, w: t < 0.35 ? { spine: 1 - t, pelvis: t } : { pelvis: 1 - (t - 0.35) * 0.8, thighL: (t - 0.35) * 0.4, thighR: (t - 0.35) * 0.4 } }); } tube(M, rings, { arc: [Math.PI * 0.24, Math.PI * 0.76], seg: 8, mat: mid(spec.apron.mat || "apron") }); }
      legs(M, B, P, { r: spec.legR || 0.065, mat: spec.legs || "trouser", boot: spec.boot || "boot", bootTop: spec.bootTop ?? 0.35 });
      arms(M, B, P, { r: spec.armR || 0.058, mat: spec.sleeve || spec.top, cuff: spec.cuff, rolled: spec.rolled, handR: 0.05 });
      head(M, B, P, { cell, r: R, neck: 0.05, hair: spec.hair || "none", hairMat: spec.hairMat, ...spec.face });
      if (spec.hat) hatOn(M, B, R, spec.hat, spec.hatMat);
      if (spec.neck) propBlob(M, B, "neck", [0, 0, 0.0], [0.085, 0.06, 0.085], spec.neck, { rings: 6, seg: 14 });
      if (spec.specs) for (const x of [-1, 1]) propBlob(M, B, "head", [x * R * 0.33, R * 1.03, R * 0.93], [R * 0.17, R * 0.14, 0.006], spec.specs, { rings: 4, seg: 10 });
      if (spec.props) { M.begin("props"); spec.props(M, B, R); M.end(); }
      M.begin("tool"); T.build(M, B); M.end();
      return { M, B, tool: T, grips: { L: !!spec.gripL, R: tool !== "hands" || !!spec.gripR }, hands: spec.hands || { L: "open", R: "open" } };
    },
    style: spec.style || null,
  };
}
const setA = (p, j, k, v) => { p[j] = { ...(p[j] || {}), [k]: v }; return p; };

export const PIP = make({ name: "Pip", P: { h: 1.6, leg: 0.53, head: 0.25, neck: 0.14, shoulder: 0.14, hip: 0.11, arm: 0.74, stoop: 0 },
  top: "shawl", front: "shirt", frontW: 0.3, dress: { hem: 0.55, mat: "skirtd", flare: 0.25 }, apron: { hem: 0.6 }, legs: "skin", boot: "boot", bootTop: 0.5,
  face: { nose: [0.035, 0.02, 0.3, 0], jaw: 0.85, lids: 0.05, mouth: 1.1, chin: 0.9 }, hair: "crop", hairMat: "hair",
  props: (M, B) => { propBlob(M, B, "handL", [0, -0.09, 0.02], [0.035, 0.07, 0.035], "brass", { rings: 6, seg: 10 }); },   // the brass canister
  gripL: true, hands: { L: "fist", R: "open" } });
export const CRAKE = make({ name: "Crake", P: { h: 1.74, leg: 0.51, head: 0.25, neck: 0.17, shoulder: 0.15, hip: 0.13, arm: 0.74, stoop: 0 },
  top: "grey", coat: { hem: 0.38, flare: 0.18, mat: "grey" }, legs: "grey", cuff: "grey", hat: "roll", hatMat: "grey", specs: "amber",
  face: { nose: [0.05, 0.02, 0.15, 0], jaw: 1.0, lids: 0.5, mouth: 0.8, chin: 1.1 }, hands: { L: "fist", R: "fist" },
  props: (M, B) => { prop(M, B, "handR", [[0, -0.06, 0.0, 0.007], [0, -0.06, 0.13, 0.006]], "black", { seg: 6 }); },   // the fountain pen
  style: (p, c) => (c.tags?.includes("calm") ? setA(setA(setA(setA(p, "armL", "fwd", 22), "foreL", "bend", 80), "armR", "fwd", 22), "foreR", "bend", 80) : p) });   // hands folded at the waist
export const FISK = make({ name: "Fisk", P: { h: 1.68, leg: 0.48, head: 0.27, neck: 0.11, shoulder: 0.15, hip: 0.12, arm: 0.72, stoop: 9 },
  top: "tweed", coat: { hem: 0.85, flare: 0.1, mat: "tweed" }, legs: "tweed", bootTop: 0.55, boot: "mud", neck: "collar", hat: "bowler",
  face: { nose: [0.05, 0.022, 0.2, 0], jaw: 0.9, lids: 0.4, mouth: 0.8 },
  props: (M, B) => { prop(M, B, "chest", [[0.0, -0.05, 0.16, 0.13, 0.04], [0.0, -0.3, 0.16, 0.13, 0.04]], "case", { square: 6, seg: 12 }); propBlob(M, B, "chest", [0, -0.07, 0.2], [0.11, 0.015, 0.01], "paper", { rings: 3, seg: 8 }); },
  style: (p) => setA(setA(setA(setA(p, "armL", "fwd", 40), "foreL", "bend", 110), "armR", "fwd", 40), "foreR", "bend", 110) });   // the satchel held to his chest
export const PELLOW = make({ name: "Pellow", P: { h: 1.6, leg: 0.46, head: 0.26, neck: 0.1, shoulder: 0.17, hip: 0.16, arm: 0.73, stoop: 7 },
  top: "black", dress: { hem: 0.05, mat: "black", flare: 0.18 }, apron: { hem: 0.25 }, cuff: "paper", hat: "maidcap", hair: "cap", hairMat: "grey",
  face: { nose: [0.04, 0.024, 0.3, 0], jaw: 1.0, lids: 0.6, mouth: 0.8 },
  props: (M, B) => { propBlob(M, B, "handL", [0, -0.13, 0.04], [0.13, 0.08, 0.09], "wood", { rings: 6, seg: 12 }); propBlob(M, B, "handL", [0, -0.07, 0.04], [0.12, 0.02, 0.08], "paper", { rings: 4, seg: 12 }); },   // the covered basket
  gripL: true, hands: { L: "fist", R: "open" } });
export const ROOK = make({ name: "Rook", P: { h: 1.66, leg: 0.5, head: 0.26, neck: 0.18, shoulder: 0.14, hip: 0.12, arm: 0.78, stoop: 5 },
  top: "black", dress: { hem: 0.08, mat: "black" }, sleeve: "black", rolled: "paper", hair: "cap", hairMat: "hair",
  face: { nose: [0.06, 0.02, 0.3, 0.3], jaw: 0.85, lids: 0.6, mouth: 0.7 },
  props: (M, B, R) => { prop(M, B, "head", [[0.04, R * 1.7, -R * 0.4, 0.005], [-0.08, R * 1.9, -R * 0.2, 0.005]], "wood", { seg: 5 }); },   // the pencil in her hair
  style: (p) => setA(setA(p, "neck", "bend", (p.neck?.bend || 0) + 18), "head", "bend", (p.head?.bend || 0) + 10) });   // the long neck bent toward the sounder
export const ASH = make({ name: "Ash", P: { h: 1.8, leg: 0.49, head: 0.24, neck: 0.12, shoulder: 0.18, hip: 0.15, arm: 0.78, stoop: 12 },
  top: "black", dress: { hem: 0.04, mat: "black", flare: 0.2 }, neck: "collar",
  face: { nose: [0.055, 0.022, 0.4, 0.2], jaw: 1.05, lids: 0.7, mouth: 0.7, jowls: 0.6 },
  props: (M, B) => { prop(M, B, "chest", [[0.24, -0.2, -0.15, 0.03, 0.12], [0.24, -0.2, 0.12, 0.03, 0.12]], "paper", { square: 6, seg: 8 }); prop(M, B, "chest", [[0.215, -0.2, -0.16, 0.012, 0.13], [0.215, -0.2, 0.13, 0.012, 0.13]], "black", { square: 6, seg: 8 }); },   // the ledger
  style: (p) => setA(setA(setA(p, "armL", "fwd", 4), "armL", "out", 22), "foreL", "bend", 70) });
export const SALLIS = make({ name: "Sallis", P: { h: 1.88, leg: 0.5, head: 0.25, neck: 0.1, shoulder: 0.23, hip: 0.14, arm: 0.82, stoop: 3 }, tool: "boathook",
  top: "oilskin", coat: { hem: 0.3, mat: "oilskin" }, legs: "wader", boot: "wader", bootTop: 1, hat: "knit", hatMat: "black",
  face: { nose: [0.05, 0.03, 0.4, 0], jaw: 1.25, lids: 0.6, stubble: true },
  props: (M, B) => { tube(M, [{ c: add(J(B, "armL"), [0.01, -0.12, 0]), rx: 0.072, rz: 0.072, w: { armL: 1 } }, { c: add(J(B, "armL"), [0.01, -0.2, 0]), rx: 0.07, rz: 0.07, w: { armL: 1 } }], { mat: mid("paper"), seg: 12 }); } });   // the Board armband
export const PARDEW = make({ name: "Pardew", P: { h: 1.82, leg: 0.51, head: 0.25, neck: 0.14, shoulder: 0.19, hip: 0.12, arm: 0.79, stoop: 0 }, tool: "crowbar",
  top: "pea", coat: { hem: 0.72, flare: 0.08, mat: "pea" }, neck: "collar", hat: "knit", hatMat: "pea", specs: "glass",
  face: { nose: [0.055, 0.024, 0.2, 0], jaw: 1.05, lids: 0.4, mouth: 0.85 } });
// Dace and Orme read apart: Dace tall and square in a peaked cap with a broad pale muffler; Orme
// shorter and stooped in a knitted cap, no muffler, a lighter worn reefer, a pipe.
export const DACE = make({ name: "Dace", P: { h: 1.8, leg: 0.5, head: 0.26, neck: 0.12, shoulder: 0.21, hip: 0.13, arm: 0.78, stoop: 0 },
  top: "pea", coat: { hem: 0.7, flare: 0.1, mat: "pea" }, hat: "peaked", hatMat: "pea",
  face: { nose: [0.05, 0.03, 0.3, 0], jaw: 1.15, lids: 0.7, stubble: true },
  props: (M, B) => { propBlob(M, B, "neck", [0, -0.01, 0.01], [0.12, 0.08, 0.12], "paper", { rings: 6, seg: 14 }); prop(M, B, "chest", [[0.05, 0.12, 0.14, 0.05, 0.015], [0.08, -0.15, 0.16, 0.055, 0.015]], "paper", { seg: 6 }); } });
export const ORME = make({ name: "Orme", P: { h: 1.66, leg: 0.48, head: 0.27, neck: 0.1, shoulder: 0.18, hip: 0.13, arm: 0.8, stoop: 16 },
  top: "tweed", coat: { hem: 0.68, flare: 0.12, mat: "tweed" }, hat: "knit", hatMat: "shawl",
  face: { nose: [0.065, 0.026, 0.45, 0.4], jaw: 0.9, lids: 0.5, mouth: 0.9 },
  props: (M, B, R) => { prop(M, B, "head", [[0.03, R * 0.42, R * 1.0, 0.006], [0.06, R * 0.3, R * 1.6, 0.006]], "wood", { seg: 6 }); propBlob(M, B, "head", [0.065, R * 0.4, R * 1.65], [0.015, 0.022, 0.015], "wood", { rings: 4, seg: 8 }); } });

const stick = (M, B, len = 0.9) => prop(M, B, "handR", [[0, -0.05, 0.02, 0.012], [0, -0.05 - len, 0.12, 0.01]], "wood", { seg: 6 });
const lanternIn = (M, B, j) => { prop(M, B, j, [[0, -0.08, 0, 0.004], [0, -0.14, 0, 0.004]], "brass", { seg: 4 }); prop(M, B, j, [[0, -0.14, 0, 0.04], [0, -0.26, 0, 0.04]], "glass", { seg: 10 }); propBlob(M, B, j, [0, -0.2, 0], [0.014, 0.025, 0.014], "flame", { rings: 4, seg: 8 }); };
export const LUGG = make({ name: "Lugg", P: { h: 2.14, leg: 0.55, head: 0.24, neck: 0.19, shoulder: 0.21, hip: 0.13, arm: 0.92, stoop: 22 }, tool: "crowbar",
  top: "oilskin", coat: { hem: 0.5, mat: "oilskin" }, legs: "wader", boot: "wader", bootTop: 0.8, hat: "knit", hatMat: "black",
  face: { nose: [0.07, 0.022, 0.4, 0], jaw: 1.1, chin: 1.2, lids: 0.6, mouth: 0.7 },
  props: (M, B) => { propBlob(M, B, "chest", [0.12, -0.05, -0.22], [0.17, 0.24, 0.13], "canvas", { rings: 8, seg: 14 }); prop(M, B, "chest", [[-0.18, 0.2, 0.08, 0.02], [0.2, -0.25, -0.18, 0.02]], "rope", { seg: 6 }); },
  style: (p) => setA(p, "head", "bend", (p.head?.bend || 0) - 14) });   // bends to speak, the long arms hanging
export const COCKLE = make({ name: "Nan Cockle", P: { h: 1.48, leg: 0.45, head: 0.27, neck: 0.08, shoulder: 0.15, hip: 0.13, arm: 0.7, stoop: 30 },
  top: "pea", coat: { hem: 0.45, mat: "pea" }, dress: { hem: 0.32, mat: "shawl", flare: 0.3 }, legs: "skin", boot: "wader", bootTop: 0.9, hat: "maidcap",
  face: { nose: [0.04, 0.026, 0.5, 0.5], jaw: 0.75, chin: 1.4, lids: 0.8, mouth: 1.0 },
  props: (M, B) => { stick(M, B, 0.95); prop(M, B, "handL", [[0, -0.08, 0, 0.003], [0, -0.16, 0, 0.003]], "iron", { seg: 4 }); prop(M, B, "handL", [[0, -0.16, 0, 0.1], [0, -0.34, 0, 0.12]], "iron", { seg: 12, capA: false }); },
  gripL: true, gripR: true, hands: { L: "fist", R: "fist" } });
export const PENHALLOW = make({ name: "Penhallow", P: { h: 1.78, leg: 0.51, head: 0.26, neck: 0.13, shoulder: 0.21, hip: 0.13, arm: 0.78, stoop: 0 },
  top: "pea", coat: { hem: 0.66, flare: 0.08, mat: "pea" }, hat: "peaked", hatMat: "black", neck: "paper", hair: "cap", hairMat: "grey",
  face: { nose: [0.05, 0.024, 0.2, 0.2], jaw: 1.1, lids: 0.6, mouth: 0.8, chin: 1.1 },
  props: (M, B) => { prop(M, B, "handL", [[0, -0.06, -0.02, 0.02, 0.1], [0, -0.06, 0.16, 0.02, 0.1]], "case", { square: 6, seg: 8 }); }, gripL: true, hands: { L: "fist", R: "open" } });
export const TEAGUE = make({ name: "Teague", P: { h: 1.7, leg: 0.49, head: 0.27, neck: 0.13, shoulder: 0.16, hip: 0.12, arm: 0.76, stoop: 10 },
  top: "tweed", coat: { hem: 0.3, mat: "tweed" }, neck: "collar", hat: "bowler", hatMat: "tweed",
  face: { nose: [0.055, 0.022, 0.4, 0.1], jaw: 0.9, lids: 0.75, mouth: 0.75 },
  props: (M, B) => { prop(M, B, "handR", [[0, -0.07, 0.0, 0.006], [0, -0.03, 0.0, 0.006]], "strap", { seg: 4 }); prop(M, B, "handR", [[0, -0.1, -0.2, 0.08, 0.13], [0, -0.1, 0.2, 0.08, 0.13]], "case", { square: 5, seg: 10 }); }, gripR: true, hands: { L: "open", R: "fist" } });   // the valise
const gutter = (name, apronV, P) => make({ name, P, top: "smock", apron: { hem: 0.35, mat: apronV > 0.6 ? "apron" : "canvas" }, legs: "trouser", boot: "wader", bootTop: 0.7, sleeve: "smock", rolled: "wader", hat: "knit", hatMat: "smock",
  face: { nose: [0.05, 0.03, 0.3, 0], jaw: 1.0, lids: 0.5, mouth: 1.1 }, tool: "knife", style: (p) => setA(p, "head", "side", name === "Mab" ? -12 : 12) });   // leaning toward each other
export const MAB = gutter("Mab", 0.75, { h: 1.72, leg: 0.47, head: 0.29, neck: 0.08, shoulder: 0.2, hip: 0.14, arm: 0.82, stoop: 8 });
export const NOLL = gutter("Noll", 0.4, { h: 1.72, leg: 0.47, head: 0.29, neck: 0.08, shoulder: 0.2, hip: 0.14, arm: 0.82, stoop: 8 });
export const SPRATT = make({ name: "Spratt", P: { h: 1.58, leg: 0.46, head: 0.28, neck: 0.09, shoulder: 0.16, hip: 0.16, arm: 0.74, stoop: 12 }, tool: "knife",
  top: "skirtd", dress: { hem: 0.2, mat: "skirtd" }, apron: { hem: 0.3 }, sleeve: "skirtd", rolled: "paper", hat: "knit", hatMat: "shawl",
  face: { nose: [0.05, 0.024, 0.3, 0.3], jaw: 1.0, chin: 1.6, lids: 0.5, mouth: 0.8 },
  props: (M, B) => { for (let k = 0; k < 4; k++) prop(M, B, "chest", [[-0.18 + k * 0.03, 0.2, -0.06, 0.012], [-0.2 + k * 0.03, -0.25, 0.1, 0.012]], "scales", { seg: 6 }); } });   // the string of eels
export const SHADWELL = make({ name: "Shadwell", P: { h: 1.76, leg: 0.49, head: 0.26, neck: 0.14, shoulder: 0.18, hip: 0.12, arm: 0.8, stoop: 15 },
  top: "grey", apron: { hem: 0.3, mat: "black" }, sleeve: "grey", palette: { skin: { c: [0.18, 0.15, 0.14], v: 0.15 } },
  face: { nose: [0.06, 0.026, 0.4, 0], jaw: 1.0, lids: 0.3, mouth: 0.8 },
  props: (M, B, R) => { for (const x of [-1, 1]) propBlob(M, B, "head", [x * R * 0.33, R * 1.03, R * 0.83], [R * 0.2, R * 0.16, R * 0.06], "paper", { rings: 4, seg: 10 }); prop(M, B, "head", [[0.03, R * 0.42, R * 1.0, 0.006], [0.07, R * 0.3, R * 1.6, 0.006]], "black", { seg: 6 }); },   // pale eye-rings in the soot, the pipe
  style: (p) => setA(p, "head", "bend", (p.head?.bend || 0) - 22) });   // looks up at the beams
export const GAUZE = make({ name: "Sister Gauze", P: { h: 1.55, leg: 0.46, head: 0.25, neck: 0.12, shoulder: 0.15, hip: 0.14, arm: 0.72, stoop: 18 },
  top: "grey", dress: { hem: 0.03, mat: "grey", flare: 0.2 }, hat: "maidcap",
  face: { nose: [0.045, 0.02, 0.3, 0], jaw: 0.85, lids: 0.7, mouth: 0.7 },
  props: (M, B, R) => { propBlob(M, B, "head", [0, R * 0.9, 0], [R * 1.25, R * 1.25, R * 1.25], "paper", { rings: 6, seg: 14 }); const hd = J(B, "head"); tube(M, [[-0.4, 1.7], [1.4, 1.65], [2.3, 1.2], [2.7, 0.2]].map(([y, r]) => ({ c: add(hd, [0, R * y, 0]), rx: R * r, rz: R * r, w: { head: 1 } })), { mat: mid("glass"), seg: 18, arc: [Math.PI / 2 + 0.75, Math.PI / 2 - 0.75 + 2 * Math.PI] }); } });   // the jar drawn with its near face open, so the face shows and the rim and sides catch the light   // the wimple seen through the bell jar
export const TOBIT = make({ name: "Tobit", P: { h: 1.3, leg: 0.46, head: 0.25, neck: 0.1, shoulder: 0.12, hip: 0.1, arm: 0.56, stoop: 0 },
  top: "surplice", dress: { hem: 0.25, mat: "surplice", flare: 0.4 }, sleeve: "surplice", legs: "gansey", hair: "crop", hairMat: "hair",
  face: { nose: [0.03, 0.018, 0.2, 0], jaw: 0.8, lids: 0.1, mouth: 1.1, chin: 0.8 },
  props: (M, B) => { prop(M, B, "handR", [[0, -0.05, 0.0, 0.012], [0, 0.08, 0.0, 0.012]], "paper", { seg: 6 }); propBlob(M, B, "handR", [0, 0.11, 0], [0.008, 0.02, 0.008], "flame", { rings: 4, seg: 6 }); }, gripR: true, hands: { L: "open", R: "fist" } });   // the candle
export const DILLY = make({ name: "Dilly Rudd", P: { h: 1.22, leg: 0.45, head: 0.26, neck: 0.09, shoulder: 0.12, hip: 0.1, arm: 0.52, stoop: 0 },
  top: "gansey", dress: { hem: 0.45, mat: "skirtd" }, legs: "skin", boot: "wader", bootTop: 0.9, legR: 0.05, hair: "crop", hairMat: "hair",
  face: { nose: [0.03, 0.02, 0.2, 0], jaw: 0.8, lids: 0.0, mouth: 1.0 },
  props: (M, B) => { prop(M, B, "chest", [[0, -0.12, 0.14, 0.008, 0.09], [0, -0.26, 0.14, 0.008, 0.09]], "black", { square: 6, seg: 8 }); lanternIn(M, B, "handL"); }, gripL: true, hands: { L: "fist", R: "open" } });   // the slate and the lantern
export const GILL = make({ name: "Gill", P: { h: 1.38, leg: 0.5, head: 0.24, neck: 0.1, shoulder: 0.12, hip: 0.1, arm: 0.6, stoop: 4 },
  top: "gansey", apron: { hem: 0.06, mat: "canvas" }, hat: "knit", hatMat: "pea", face: { nose: [0.035, 0.02, 0.3, 0], jaw: 0.8, lids: 0.1, mouth: 1.0 } });
export const DUNLIN = make({ name: "Captain Dunlin", P: { h: 2.06, leg: 0.45, head: 0.29, neck: 0.07, shoulder: 0.26, hip: 0.16, arm: 0.84, stoop: 6 },
  top: "navy", coat: { hem: 0.55, mat: "navy" }, belly: 0.08, neck: "band", hat: "peaked", hatMat: "navy", hair: "crop", hairMat: "grey",
  face: { nose: [0.06, 0.03, 0.3, 0], jaw: 1.25, jowls: 1.0, lids: 0.7, browW: 1.2, stubble: true },
  props: (M, B, R) => { for (let k = 0; k < 4; k++) propBlob(M, B, "chest", [0.06, 0.1 - k * 0.1, 0.24], [0.014, 0.014, 0.008], "scales", { rings: 4, seg: 8 }); prop(M, B, "head", [[0.03, R * 0.42, R * 1.0, 0.007], [0.07, R * 0.3, R * 1.6, 0.007]], "wood", { seg: 6 }); } });
