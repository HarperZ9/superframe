// The wider cast from design/CAST-SHEETS.md, built from one data-driven costume script: a record per
// person (proportions, coat or dress, legs, sleeves, face, hair, headgear, neckwear, props, style).
// Members: PIP, CRAKE, FISK, PELLOW, ROOK, ASH, SALLIS, PARDEW, DACE, ORME.
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob, J, add, mid } from "./parts.mjs";
import { toolOf } from "./tools.mjs";
import { MATS, BY_ID } from "../rig/materials.mjs";

// a few more materials for this cast
for (const [k, m] of Object.entries({
  grey:     { id: 50, c: [0.5, 0.5, 0.5], v: 0.5, stroke: { scale: 0.06, stretch: 3, amount: 0.12 } },
  black:    { id: 51, c: [0.06, 0.055, 0.065], v: 0.06, stroke: { scale: 0.06, stretch: 3, amount: 0.18 } },
  amber:    { id: 52, c: [0.95, 0.75, 0.2], v: 0.72, sheen: 1 },
  tweed:    { id: 53, c: [0.36, 0.3, 0.24], v: 0.3, stroke: { scale: 0.015, stretch: 1, amount: 0.3 } },
  mud:      { id: 54, c: [0.28, 0.22, 0.16], v: 0.22, stroke: { scale: 0.03, stretch: 1, amount: 0.35 } },
  pea:      { id: 55, c: [0.12, 0.14, 0.18], v: 0.13, stroke: { scale: 0.05, stretch: 2.5, amount: 0.2 } },
  shawl:    { id: 56, c: [0.45, 0.32, 0.3], v: 0.34, stroke: { scale: 0.012, stretch: 1, amount: 0.3 } },
})) if (!MATS[k]) { MATS[k] = { ...m, name: k }; BY_ID[m.id] = MATS[k]; }

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
export const DACE = make({ name: "Dace", P: { h: 1.76, leg: 0.49, head: 0.26, neck: 0.12, shoulder: 0.19, hip: 0.13, arm: 0.78, stoop: 2 },
  top: "pea", coat: { hem: 0.7, flare: 0.1, mat: "pea" }, hat: "peaked", hatMat: "pea", neck: "paper",
  face: { nose: [0.05, 0.03, 0.3, 0], jaw: 1.1, lids: 0.7, stubble: true } });
export const ORME = make({ name: "Orme", P: { h: 1.7, leg: 0.49, head: 0.26, neck: 0.12, shoulder: 0.19, hip: 0.13, arm: 0.78, stoop: 6 },
  top: "pea", coat: { hem: 0.7, flare: 0.1, mat: "pea" }, hat: "peaked", hatMat: "pea",
  face: { nose: [0.06, 0.026, 0.4, 0.3], jaw: 0.95, lids: 0.5, mouth: 0.9 } });
