// The rest of The Quota's slice speakers (design/voice/quota-cast.json, design/quota/02-HOUSEHOLDS.md),
// on the same maker, people ranges and class marks as cast/quota.mjs. Each has one idea (info.quota.idea).
// Members: EDIE, DAVEY, ROSE (the Bracks), BET, ILO (Haldane), TESK (Hesh, the end cell), LIL (Mary's
// sister), GEDGE (constable), PASK (the Directorate's commissioner), MOTT (brigade clerk).
import { prop, propBlob, J, add, mid } from "./parts.mjs";
import { tube } from "../rig/body.mjs";
import { SCULPT } from "./sculpt.mjs";
import { make, person, at, inherit, sample, CLASSES, S_WILL, S_EDIE, S_ILO, S_BET, S_MARYS } from "./quota.mjs";

const setA = (p, j, k, v) => { p[j] = { ...(p[j] || {}), [k]: v }; return p; };
const armband = (M, B) => tube(M, [{ c: add(J(B, "armL"), [0.01, -0.12, 0]), rx: 0.075, rz: 0.075, w: { armL: 1 } }, { c: add(J(B, "armL"), [0.01, -0.2, 0]), rx: 0.073, rz: 0.073, w: { armL: 1 } }], { mat: mid("paper"), seg: 12 });

// ---- Brack: Edie (a cottar's daughter), Davey (nine, under the stairs), Rose (six, on her knee) ----
const EDIE_D = { id: "edie", name: "Edie Brack", people: "tarn", S: S_EDIE, sex: "f", idea: "a face held still, and the sleeve pulled down over the wrist",
  apron: { hem: 0.32, mat: "canvas" }, cuff: "wool", hat: undefined, face: { lids: 0.45, mouth: 0.8 }, style: (p) => setA(setA(p, "armL", "fwd", 18), "foreL", "bend", 70) };
export const EDIE = make(person({ ...EDIE_D, cls: { ...CLASSES.cottar, hunger: 0.55, gaps: 0 }, age: 34, P: { stoop: 4 } }));
const S_DAVEY = inherit(S_WILL, S_EDIE, "davey", 0.55), S_ROSE = inherit(S_WILL, S_EDIE, "rose", 0.8);
export const DAVEY = make({ ...at(person({ id: "davey", name: "Davey Brack", people: "tarn", S: S_DAVEY, cls: { ...CLASSES.cottar, hunger: 0.6 }, age: 9,
  idea: "his father's broken nose already, and his shoulders up round his ears", top: "gansey", coat: { hem: 0.5, mat: "gansey", flare: 0.1 }, legs: "wool", hair: "crop", wear: "handdown",
  face: { noseBend: 0.035, bridge: 0.6 } }), 10), id: "davey", age: 9,
  style: (p) => { for (const s of ["L", "R"]) setA(p, "clav" + s, "up", (p["clav" + s]?.up || 0) + 9); return setA(p, "head", "bend", (p.head?.bend || 0) + 8); } });
export const ROSE = make({ ...at(person({ id: "rose", name: "Rose Brack", people: "tarn", S: S_ROSE, sex: "f", cls: { ...CLASSES.cottar, hunger: 0.4 }, age: 6,
  idea: "her mother's face, very small and very round", dress: { hem: 0.1, mat: "shawl", flare: 0.3 }, apron: null, hat: undefined, hair: "crop", wear: "handdown" }), 6), id: "rose", style: null });

// ---- Haldane: Bet (Tarn, a cottar's daughter) and Ilo (Hesh, a hand who stayed) ----
export const BET = make(person({ id: "bet", name: "Bet Haldane", people: "tarn", S: S_BET, sex: "f", cls: { ...CLASSES.cottar, hunger: 0.75 }, age: 35,
  idea: "a broad strong face gone thin, hair scraped back under a scarf", cuff: "wool", P: { stoop: 6 }, face: { jaw: 1.02, jawCorners: 0.6 } }));
export const ILO = make(person({ id: "ilo", name: "Ilo Haldane", people: "hesh", S: S_ILO, cls: "hand", age: 45,
  idea: "his son's cheekbones grown broad and weathered, grey coming into the braid", belt: "strap", face: { stubble: true } }));

// ---- Old Tesk: a Hesh herder from the hill, in the end cell ----
export const TESK = make({ ...at(person({ id: "tesk", name: "Old Tesk", people: "hesh", seed: "tesk", cls: { ...CLASSES.hand, hunger: 0.7, gaps: 2, teeth: "bad" }, age: 65,
  idea: "a hill face like bark, a grey braid and white stubble", braid: { len: 0.3 }, belt: "rope", legs: "felt", face: { stubble: true } }), 65), id: "tesk" });

// ---- Lil, Mary's sister from Tarn Hollow: the same parents, a widow's black, a smile kept ready ----
export const LIL = make(person({ id: "lil", name: "Lil", people: "tarn", S: inherit(S_MARYS[0], S_MARYS[1], "lil", 0.5), sex: "f", cls: "cottar", age: 38,
  idea: "her sister's cheekbones, a widow's black, and a smile kept ready", top: "black", dress: { hem: 0.05, mat: "black", flare: 0.18 }, apron: null, cuff: "black", hatMat: "black",
  face: { cheekbones: 0.7, mouth: 1.02 } }));

// ---- Gedge, constable at the cells: a bull's neck and a grin that comes too easily ----
export const GEDGE = make(person({ id: "gedge", name: "Constable Gedge", people: "tarn", seed: "gedge", cls: { ...CLASSES.militia, scar: false }, age: 30,
  idea: "a bull's neck and a grin that comes too easily", coat: { hem: 0.5, mat: "wool" }, belt: "strap", hat: "flat", hatMat: "wool", hatLift: 0.1, neckR: 0.075, P: { neck: 0.06, shoulder: 0.23 },
  face: { jaw: 1.25, jawCorners: 0.9, mouth: 1.15, lips: 0.95 }, props: armband }));

// ---- Commissioner Pask, from Arlen: the one soft, round, fed face at a table of hungry ones ----
export const PASK = make(person({ id: "pask", name: "Commissioner Pask", people: "tarn", label: "Arlen", seed: "pask", cls: "arlen", age: 50,
  idea: "a soft round fed face behind spectacles, at a table of hungry ones", top: "grey", coat: { hem: 0.5, mat: "grey", flare: 0.2 }, belly: 0.09, legs: "grey", hair: "crop",
  P: { neck: 0.07, hip: 0.17 }, face: { jowls: 0.9, cheekR: 1.25, cheekbones: 0, skull: [1.05, 0.97, 1.0], faceLen: 0.98, jawCorners: 0 },
  props: (M, B, R) => { for (const x of [-1, 1]) propBlob(M, B, "head", SCULPT.on ? [x * R * 0.27, R * 0.9, R * 0.95] : [x * R * 0.34, R * 1.02, R * 0.99], [R * 0.14, R * 0.11, 0.003], "lens", { rings: 4, seg: 12 }); } }));   // the spectacles

// ---- Walter Mott, brigade clerk: a narrow head bent to the ledger ----
export const MOTT = make(person({ id: "mott", name: "Walter Mott", people: "tarn", seed: "mott", cls: "clerk", age: 40,
  idea: "a narrow head bent to the ledger and a thin pinched nose", top: "tweed", coat: { hem: 0.6, mat: "tweed", flare: 0.12 }, rolled: "paper", wear: "handdown",
  face: { nose: [0.064, 0.017, 0.25, 0.05], faceLen: 1.14, skull: [0.9, 1.06, 1], lips: 0.75 },
  gripL: true, hands: { L: "fist", R: "open" }, style: (p) => setA(p, "head", "bend", (p.head?.bend || 0) + 10),
  props: (M, B) => prop(M, B, "handL", [[0, -0.06, -0.02, 0.018, 0.12], [0, -0.06, 0.18, 0.018, 0.12]], "case", { square: 6, seg: 8 }) }));   // the ledger

// The Studio's export ids (design/STATE.md, "the Studio, and a portrait export format"): <who>@e<era> to
// the cast ids here; the Requisition Captain is "holt" in the script and the cast map.
export const ERA_IDS = { "ned@e2": "ned", "mary@e2": "mary", "abel@e1": "abel_era1", "abel@e2": "abel", "pell@e2": "pell", "pell@e3": "pell_adult",
  "anni@e2": "anni", "anni@e3": "anni_adult", "will@e2": "will", "tomas@e2": "tomas", "aaron@e2": "aaron", "holt@e2": "captain", "edie@e2": "edie",
  "davey@e2": "davey", "rose@e2": "rose", "bet@e2": "bet", "ilo@e2": "ilo", "tesk@e2": "tesk", "lil@e2": "lil", "gedge@e2": "gedge", "pask@e2": "pask", "mott@e2": "mott" };
export { sample };
