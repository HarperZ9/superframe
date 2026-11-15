// The Quota (design/quota/02-HOUSEHOLDS.md, 07-PRODUCTION.md): the vertical slice's cast on the old
// parametric head (cast/parts.mjs head(), the heads players preferred in the R3 appeal test). Since
// 2026-10-22 each person is a place in a people's range and a class's marks (cast/peoples.mjs), with
// one feature of their own on top, in era 2 dress: dark wool for the Tarn, felt and a blue thread at the wrist
// for the Hesh (design/quota/01-WORLD.md, the peoples).
// Ages: a person is one face record at one age; ageVariant() makes the child and the old from it,
// so Anni at fourteen and Anni at forty share a nose and a jaw (see AGES below).
// Members: NED, MARY, PELL (a boy of ten), ABEL (old, era 2), ABEL_ERA1, WILL, TOMAS (eleven), AARON (nine),
// ANNI (fourteen), ANNI_ADULT (era 3), PELL_ADULT (era 3), CAPTAIN; and the rest of the slice's speakers
// (design/voice/quota-cast.json): EDIE, DAVEY, ROSE (Brack), BET, ILO (Haldane), GEDGE, PASK, MOTT, TESK, LIL.
import { Mesh, bind, tube } from "../rig/body.mjs";
import { torso, skirt, legs, arms, head, prop, propBlob, J, add, mid, apron } from "./parts.mjs";
import { toolOf } from "./tools.mjs";
import { MATS } from "../rig/materials.mjs";
import { sample, inherit, resolve, CLASSES } from "./peoples.mjs";
import { sculptHead, SCULPT, sculptPalette } from "./sculpt.mjs";
export { sample, inherit, CLASSES };

// ---- age ----
// Proportions and face sliders by age, applied to an adult record. Children: shorter, a larger head for
// the height, shorter legs and arms, a small soft nose, a narrow jaw, open lids, no stubble. The old:
// a stoop, heavier lids, jowls, a longer drooping nose, a narrower mouth, grey or white hair.
export const AGES = {
  4: { h: 0.56, head: 0.82, neck: 0.5, shoulder: 0.5, hip: 0.62, arm: 0.5, leg: 0.89, stoop: 0, nose: 0.45, jaw: 0.72, chin: 0.72, lids: -0.4, mouth: 0.75,
       shape: { skull: [1.14, 1.08, 1.1], faceLen: 0.74, eyes: 1.4, cheekR: 1.5, browShape: "arch", browT: 0.6, lips: 1.15, bulb: 1.2 } },
  10: { h: 0.72, head: 0.92, neck: 0.75, shoulder: 0.62, hip: 0.72, arm: 0.7, leg: 0.94, stoop: 0, nose: 0.55, jaw: 0.78, chin: 0.8, lids: -0.4, mouth: 0.8,
        shape: { skull: [1.1, 1.04, 1.08], faceLen: 0.82, eyes: 1.3, cheekR: 1.35, browShape: "arch", browT: 0.7, lips: 1.1, bulb: 1.15 } },
  14: { h: 0.9, head: 0.95, neck: 0.85, shoulder: 0.78, hip: 0.85, arm: 0.88, leg: 0.98, stoop: 0, nose: 0.72, jaw: 0.86, chin: 0.88, lids: -0.3, mouth: 0.88,
        shape: { skull: [1.05, 1.02, 1.04], faceLen: 0.9, eyes: 1.18, cheekR: 1.2, browShape: "arch", browT: 0.8, lips: 1.05, bulb: 1.08 } },
  40: { h: 1, head: 1, neck: 1, shoulder: 1, hip: 1, arm: 1, leg: 1, stoop: 0, nose: 1.05, jaw: 1.1, chin: 1.05, lids: 0.1, mouth: 1, shape: { faceLen: 1.1, lines: 0.6, eyes: 0.95 } },
  65: { h: 0.98, head: 1, neck: 0.95, shoulder: 0.96, hip: 1, arm: 0.99, leg: 0.98, stoop: 10, nose: 1.1, jaw: 0.97, chin: 1.05, lids: 0.25, mouth: 0.9, jowls: 0.5, droop: 0.12, hair: "grey", shape: { faceLen: 1.08, lines: 0.9, eyes: 0.92 } },
  75: { h: 0.97, head: 1, neck: 0.9, shoulder: 0.94, hip: 1, arm: 0.98, leg: 0.97, stoop: 18, nose: 1.15, jaw: 0.95, chin: 1.1, lids: 0.35, mouth: 0.85, jowls: 0.9, droop: 0.2, hair: "grey", shape: { faceLen: 1.06, lines: 1, eyes: 0.9 } },
};
// ages between two records are mixed from the pair: Tomas at eleven sits a quarter of the way from ten to fourteen
const mixAge = (a, b, t) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => {
  const x = a[k] ?? b[k], y = b[k] ?? a[k];
  if (typeof x === "number") return [k, +(x + (y - x) * t).toFixed(3)];
  if (Array.isArray(x)) return [k, x.map((v, i) => +(v + (y[i] - v) * t).toFixed(3))];
  if (x && typeof x === "object") return [k, mixAge(x, y, t)];
  return [k, t < 0.5 ? x : y];
}));
AGES[11] = mixAge(AGES[10], AGES[14], 0.25);
AGES[6] = mixAge(AGES[4], AGES[10], 1 / 3);   // Rose Brack at six in era 2 (canon fault 4)
// an age's face shape scales the person's own (a child's larger eyes are their own eyes, larger), so a
// people's range survives into its children and its old
const REL = new Set(["faceLen", "eyes", "cheekR", "lips", "bulb", "browT"]);
const relShape = (f, sh) => Object.fromEntries(Object.entries(sh).map(([k, v]) => [k, k === "skull" ? (f.skull || [1, 1, 1]).map((x, i) => +(x * v[i]).toFixed(3)) : REL.has(k) && typeof f[k] === "number" ? +(f[k] * v).toFixed(3) : k === "lines" ? Math.max(f.lines || 0, v) : v]));
export function ageVariant(spec, age, extra = {}) {
  const a = AGES[age]; if (!a) throw new Error(`quota: no age record ${age}`);
  const P = spec.P, f = spec.face || {}, n = f.nose || [0.06, 0.024, 0.3, 0];
  const P2 = { h: +(P.h * a.h).toFixed(3), leg: P.leg * a.leg, head: P.head * a.head, neck: P.neck * a.neck, shoulder: P.shoulder * a.shoulder, hip: P.hip * a.hip, arm: P.arm * a.arm, stoop: age < 16 ? Math.min(2, (P.stoop || 0) + a.stoop) : (P.stoop || 0) + a.stoop };   // a child stands up straight (the hunger shows in the face and the frame, not a stoop)
  const face = { ...f, ...relShape(f, a.shape || {}), ...(a.shape?.browShape && f.browShape === "arch" ? { browShape: "arch" } : {}), nose: [n[0] * a.nose, n[1] * Math.min(1, a.nose + 0.1), Math.min(0.9, (n[2] || 0) + (a.droop || 0)), n[3] || 0], jaw: (f.jaw || 1) * a.jaw, chin: (f.chin || 1) * a.chin,
    lids: Math.max(0, Math.min(1, (f.lids ?? 0.4) + a.lids)), mouth: (f.mouth || 1) * a.mouth, ...(a.jowls ? { jowls: Math.max(f.jowls || 0, a.jowls) } : {}), ...(age < 18 ? { stubble: false } : {}) };
  return { ...spec, ...extra, P: P2, face: { ...face, ...(extra.face || {}) }, hairMat: a.hair && !extra.hairMat && !spec.palette?.hair ? a.hair : extra.hairMat ?? spec.hairMat, age };
}

// ---- dress and features ----
const hatOn = (M, B, R, kind, mat = "black", lift = 0) => {
  const hd = J(B, "head"), W = { head: 1 };
  if (kind === "good") {   // the good hat: a firm felt crown and a level brim (Abel's pride, Ned's inheritance)
    propBlob(M, B, "head", [0, R * 1.7, -0.01], [R * 0.98, R * 0.55, R * 1.0], mat, { rings: 8, seg: 16 });
    propBlob(M, B, "head", [0, R * 1.36, -0.01], [R * 1.55, 0.012, R * 1.6], mat, { rings: 4, seg: 20 });
    tube(M, [{ c: add(hd, [0, R * 1.42, -0.01]), rx: R * 1.0, rz: R * 1.02, w: W }, { c: add(hd, [0, R * 1.5, -0.01]), rx: R * 0.99, rz: R * 1.01, w: W }], { mat: mid("strap"), seg: 18 });
  }
  if (kind === "flat") {   // the Tarn flat cap; lift (R units) sets it back on the crown, clear of the brows
    propBlob(M, B, "head", [0, R * (1.68 + lift), R * 0.08], [R * 1.08, R * 0.32, R * 1.18], mat, { rings: 6, seg: 16 });
    propBlob(M, B, "head", [0, R * (1.5 + lift), R * 0.95], [R * 0.75, 0.012, R * 0.42], mat, { rings: 4, seg: 12 });
  }
  if (kind === "peaked") {   // the Directorate's cap
    tube(M, [{ c: add(hd, [0, R * 1.42, 0]), rx: R * 1.02, rz: R * 1.05, w: W }, { c: add(hd, [0, R * 1.95, -0.01]), rx: R * 1.2, rz: R * 1.22, w: W }], { mat: mid(mat), seg: 18 });
    propBlob(M, B, "head", [0, R * 1.43, R * 1.0], [R * 0.85, 0.012, R * 0.5], "boot", { rings: 4, seg: 12 });
    propBlob(M, B, "head", [0, R * 1.75, R * 1.12], [0.02, 0.018, 0.008], "brass", { rings: 4, seg: 8 });
  }
  if (kind === "scarf" && !SCULPT.on) propBlob(M, B, "head", [0, R * 1.35, -R * 0.12], [R * 1.05, R * 0.85, R * 1.06], mat, { rings: 8, seg: 16 });
};
// the line a good hat leaves: a band of untanned skin above the brows, all round
const hatLine = (M, B, R) => { const hd = J(B, "head"), W = { head: 1 }; tube(M, [{ c: add(hd, [0, R * 1.27, R * 0.028]), rx: R * 0.815, rz: R * 0.895, w: W }, { c: add(hd, [0, R * 1.33, R * 0.025]), rx: R * 0.805, rz: R * 0.885, w: W }], { mat: mid("hatline"), seg: 22 }); };   // a thin line, not a band
// a braid down the back from the nape (or over the shoulder with side < 0)
const braid = (M, B, R, len = 0.34, side = 0) => { for (let k = 0; k < 9; k++) { const t = k / 8; propBlob(M, B, "head", [side * t * 0.12 + (k % 2 ? 0.006 : -0.006), R * 0.85 - t * len, -R * 0.95 - t * 0.04 + (side ? t * 0.2 : 0)], [0.022 - t * 0.008, 0.026, 0.02 - t * 0.006], "hair", { rings: 5, seg: 8 }); } };
// the blue thread at the left wrist
const thread = (M, B) => { const w = J(B, "handL"), W = { foreL: 0.3, handL: 0.7 }; tube(M, [{ c: add(w, [0, 0.025, 0]), rx: 0.034, rz: 0.034, w: W }, { c: add(w, [0, 0.015, 0]), rx: 0.034, rz: 0.034, w: W }], { mat: mid("thread"), seg: 12 }); };
// the good hat held in the left hand, crown down
const hatInHand = (M, B) => { propBlob(M, B, "handL", [0, -0.08, 0.06], [0.11, 0.012, 0.115], "black", { rings: 4, seg: 18 }); propBlob(M, B, "handL", [0, -0.12, 0.06], [0.075, 0.05, 0.078], "black", { rings: 6, seg: 14 }); };

// patches: a square of other cloth at each elbow and one at the chest, the coat mended more than once
const patches = (M, B, P) => { for (const sd of ["L", "R"]) propBlob(M, B, "fore" + sd, [0, 0.0, -0.045], [0.045, 0.06, 0.02], "patch", { rings: 4, seg: 8 });
  propBlob(M, B, "chest", [P.shoulder * 0.45, 0.02, 0.12], [0.05, 0.055, 0.015], "patch", { rings: 4, seg: 8 }); };
// Profiles (2026-10-22, the fidelity pass): the noses projected 7 to 10 cm from the cheeks in side view; a
// face's nose keeps its own shape (droop, hook, bend) and loses depth, so profiles and three-quarters hold up
// how ruddy the person's cheek colour runs over their skin (Will's flush is 2.5 or so; most 1 to 1.6)
const flushOf = (pal = {}) => { const k = pal.cheek?.c, sk = pal.skin?.c; return k && sk ? 1 + Math.max(0, Math.min(2, ((k[0] - k[1]) - (sk[0] - sk[1]) - 0.04) * 8)) : 1; };
const profileFace = (f = {}) => { const n = f.nose || [0.06, 0.024, 0.3, 0]; return { ...f, nose: [n[0] * 0.45, n[1] * 0.85, n[2], n[3] || 0], bulb: (f.bulb ?? 1) * 0.85 }; };
// the cheeks' warm zone drawn as round pink discs at play size (2026-10-22): unless a face asks for its own
// cheek colour (Will's flush), the warm zone sits a quarter of the way from the skin to the old cheek colour
const softCheeks = (pal) => { if (pal.cheek) return pal; const sk = pal.skin?.c || MATS.skin.c, ch = MATS.cheek.c; return { ...pal, cheek: { c: sk.map((v, i) => +(v * 0.75 + ch[i] * (sk[i] / MATS.skin.c[i]) * 0.25).toFixed(3)), v: pal.skin?.v ?? MATS.cheek.v } }; };
export function make(spec) {
  const P = spec.P, R = 0.135 * (P.head / 0.26), id = spec.id;
  return {
    P, palette: sculptPalette(softCheeks(spec.palette || {}), spec), info: { coat: spec.coatKg || { kg: 2.5, stiff: 0.22 }, name: spec.name, tool: spec.tool || "hands", bladeR: 0.04, radius: 0.3, quota: { id, idea: spec.idea, age: spec.age, people: spec.people, cls: spec.cls, sex: spec.sex } },
    build({ lod = "far", tool = spec.tool || "hands" } = {}) {
      const T = toolOf(tool), cell = { near: 0.042, mid: 0.08 }[lod] || 0.16, M = new Mesh(), B = bind(P), pel = J(B, "pelvis");
      const loose = spec.wear === "handdown" ? 0.035 : 0, coatMat = (m) => (spec.wear === "good" && (m === "wool" || m === "grey") ? (m === "grey" ? "grey" : "goodwool") : m);
      // the fidelity pass (2026-10-22): a waist under the shoulders, a chest, a squarer section (planes, not a tube)
      const fem = spec.sex === "f", kid = (spec.age ?? 40) < 14;
      const tOpts = { w: P.shoulder + 0.03 + loose, waist: P.shoulder * (kid ? 0.92 : fem ? 0.8 : 0.86) - (spec.belt ? 0.03 : 0) + (spec.belly || 0) + loose * 0.5, d: 0.13 + (spec.belly || 0) * 0.5, mat: coatMat(spec.top), front: spec.front, frontW: spec.frontW || 0.2, frontFrom: spec.frontFrom ?? 0.6, chest: kid ? 0.015 : fem ? 0.05 : 0.035, square: 2.6 };
      torso(M, B, P, tOpts);
      // cloth (2026-10-21): skirts and coats carry folds toward the hem; an apron hangs flat from the waist
      // in front with its own folds instead of wrapping the thighs; a belt pinches the waist
      if (spec.coat) skirt(M, B, P, { hem: spec.coat.hem - loose * 2, flare: (spec.coat.flare ?? 0.3) + loose * 2, mat: coatMat(spec.coat.mat || spec.top), gap: spec.coat.gap ?? 0.03, folds: 0.07, fit: true });
      if (spec.dress) skirt(M, B, P, { top: pel[1] + 0.02, hem: spec.dress.hem, flare: spec.dress.flare ?? 0.15, mat: spec.dress.mat, gap: 0.01, folds: 0.08, fit: true });
      // the apron lies on the dress and moves with it (cast/parts.mjs apron, 2026-10-22); ties hang behind
      if (spec.apron) apron(M, B, P, { hem: spec.apron.hem, mat: spec.apron.mat || "apron", torso: tOpts, under: spec.dress ? { top: pel[1] + 0.02, hem: spec.dress.hem, flare: spec.dress.flare ?? 0.15 } : { hem: 0.06, flare: 0.1 } });
      if (spec.belt) tube(M, [{ c: add(pel, [0, 0.13, 0]), rx: P.shoulder - 0.0, rz: 0.12, w: { spine: 0.6, pelvis: 0.4 } }, { c: add(pel, [0, 0.165, 0]), rx: P.shoulder - 0.005, rz: 0.12, w: { spine: 0.7, pelvis: 0.3 } }], { mat: mid(spec.belt), seg: 18 });
      legs(M, B, P, { r: spec.legR || 0.062 * (P.h / 1.75), mat: spec.legs || "trouser", boot: spec.boot || "boot", bootTop: spec.bootTop ?? 0.35, knees: true });
      const armR = (spec.armR || 0.056) * Math.min(1, 0.4 + P.h / 2.9);
      arms(M, B, P, { r: armR + loose * 0.4, skin: spec.handMat, mat: coatMat(spec.sleeve || spec.top), cuff: spec.cuff, rolled: spec.rolled, handR: 0.05 * Math.min(1, 0.35 + P.h / 2.6), hand2: P.h });
      // the sleeve breaks at the elbow: cloth bunched in two soft rolls, so the arm reads as a sleeve over an arm
      if (!spec.rolled) for (const sd of ["L", "R"]) { const e = J(B, "fore" + sd), W1 = { ["arm" + sd]: 0.6, ["fore" + sd]: 0.4 }, W2 = { ["fore" + sd]: 1 }, mt = mid(spec.sleeve || spec.top);
        tube(M, [{ c: add(e, [0, 0.035, 0]), rx: armR * 0.98, rz: armR * 0.98, w: W1 }, { c: add(e, [0, 0.012, 0]), rx: armR * 1.1, rz: armR * 1.12, w: W1 }, { c: add(e, [0, -0.012, 0]), rx: armR * 1.0, rz: armR * 1.0, w: W2 }, { c: add(e, [0, -0.035, 0]), rx: armR * 1.07, rz: armR * 1.08, w: W2 }, { c: add(e, [0, -0.06, 0]), rx: armR * 0.92, rz: armR * 0.92, w: W2 }], { mat: mt, seg: 12 }); }
      const ho = { id, cell, r: R, neck: spec.neckR || 0.05, hair: spec.hair || "none", hairMat: spec.hairMat, ...((spec.age ?? 40) >= 16 ? { lidPlane: true, socket: 1 } : {}), lidRange: true, exprGain: 1.8 };   // open eyes at rest, moods that read at portrait size
      // the sculpted head (cast/sculpt.mjs, 2026-10-22: planes, a skull, eyes in sockets); SCULPT.on false is the old head, the control
      if (SCULPT.on) sculptHead(M, B, P, { ...ho, ...spec.face, hatLine: !!spec.hatLine, scarf: spec.hat === "scarf" ? spec.hatMat || "black" : null, age: spec.age ?? 40, sex: spec.sex || "m", flush: flushOf(spec.palette) }, lod); else head(M, B, P, { ...ho, ...profileFace(spec.face) });
      if (spec.hatLine && !SCULPT.on) hatLine(M, B, R);
      if (spec.hat) hatOn(M, B, R, spec.hat, spec.hatMat, spec.hatLift || 0);
      // the yoke rounds the shoulder blocks; the collar comes up over the neck (the portrait shows both)
      const sz = Math.min(1, P.h / 1.75);   // a child's yoke and collar scale with the child
      propBlob(M, B, "chest", [0, 0.1 * sz, -0.005], [P.shoulder + 0.07 * sz, 0.1 * sz, (0.13 + (spec.belly || 0) * 0.5) * sz], spec.yoke || spec.top, { rings: 6, seg: 18 });
      const cs = Math.max(0.5, P.shoulder / 0.19), cm = spec.neck || spec.collarMat || spec.top;
      propBlob(M, B, "neck", [0, 0.015 * sz, 0.0], [0.082 * cs, (0.04 + Math.min(0.06, P.neck * 0.45)) * sz, 0.085 * cs], cm, { rings: 6, seg: 14 });
      M.begin("props");
      if (spec.braid) braid(M, B, R, spec.braid.len, spec.braid.side || 0);
      if (spec.thread) thread(M, B);
      if (spec.hatInHand) hatInHand(M, B);
      if (spec.wear === "patched") patches(M, B, P);
      if (spec.props) spec.props(M, B, R);
      M.end();
      M.begin("tool"); T.build(M, B); M.end();
      return { M, B, tool: T, grips: { L: !!spec.gripL, R: tool !== "hands" || !!spec.gripR }, hands: spec.hands || { L: "open", R: "open" } };
    },
    style: spec.style || null,
  };
}
const setA = (p, j, k, v) => { p[j] = { ...(p[j] || {}), [k]: v }; return p; };

// ---- people and class (cast/peoples.mjs, 2026-10-22) ----
// person(): a people's sampled range (or two parents' blend) and a class, resolved to the maker's spec.
// Each character's own idea is laid on top as face overrides, kept inside human variation.
const BODY = { m: { leg: 0.5, head: 0.27, neck: 0.12, hip: 0.13, arm: 0.78 }, f: { leg: 0.47, head: 0.26, neck: 0.11, hip: 0.15, arm: 0.72 } };
// era 2 dress by people and sex: the Tarn's dark wool, the Hesh's felt, braid and blue thread, the Vell's
// embroidered collar and, for women, the Deep Well's bright scarf
export const DRESS = {
  tarn: { m: { top: "wool", coat: { hem: 0.45, mat: "wool" }, neck: "collar", hair: "cap", hairMat: "hair" }, f: { top: "wool", dress: { hem: 0.06, mat: "wool", flare: 0.16 }, apron: { hem: 0.22 }, hair: "cap", hairMat: "hair", hat: "scarf", hatMat: "shawl" } },
  hesh: { m: { top: "felt", sleeve: "felt", coat: { hem: 0.55, mat: "felt" }, legs: "wool", thread: true, hair: "cap", hairMat: "hair", braid: { len: 0.38 } }, f: { top: "felt", sleeve: "felt", dress: { hem: 0.1, mat: "felt", flare: 0.2 }, apron: { hem: 0.3, mat: "canvas" }, legs: "wool", thread: true, hair: "cap", hairMat: "hair", braid: { len: 0.36, side: 1 } } },
  vell: { m: { top: "wool", coat: { hem: 0.5, mat: "tweed" }, neck: "embroid", hair: "crop", hairMat: "hair", face: { stubble: true } }, f: { top: "wool", dress: { hem: 0.06, mat: "skirtd", flare: 0.18 }, neck: "embroid", hair: "cap", hairMat: "hair", hat: "scarf", hatMat: "vellscarf" } },
};
export function person(d) {
  const S = d.S || sample(d.people, d.seed || d.id), sex = d.sex || "m", age = d.age ?? 40, cls = typeof d.cls === "string" ? CLASSES[d.cls] : d.cls;
  const r = resolve(S, cls, { sex, age }), dress = DRESS[d.wardrobe || d.people || "tarn"]?.[sex] || {};
  const P = { ...BODY[sex], h: r.h, shoulder: r.shoulder, ...(d.P || {}) }; P.stoop = (d.P?.stoop ?? 2) + r.stoop;
  const { S: _s, cls: _c, P: _p, face, palette, ...rest } = d;
  return { ...dress, ...rest, P, age, sex, people: d.label || r.people, cls: r.cls, wear: d.wear ?? r.wear, handMat: "hands",
    face: { ...r.face, ...(dress.face || {}), ...(face || {}) }, palette: { ...r.palette, ...(palette || {}) } };
}
// grown from an adult person to an age record (children, the old): the people and class marks stay
export const at = (spec, age, extra = {}) => ({ ...ageVariant({ ...spec, age: 40 }, age, extra), palette: { ...spec.palette, ...(extra.palette || {}) } });
const moustache = (w = 0.03, t = 0.006) => (M, B) => propBlob(M, B, "head", [0, 0.045, 0.165], [w, t, 0.01], "hair", { rings: 4, seg: 8 });

// ---- the Furrowes (Tarn; Abel and Ned inspectors, a household fed better than the street) ----
export const S_ABEL = sample("tarn", "abel"), S_NED = inherit(S_ABEL, sample("tarn", "ned-mother"), "ned", 0.4);
export const S_MARYS = [sample("tarn", "mary-father"), sample("tarn", "mary-mother")], S_MARY = inherit(S_MARYS[0], S_MARYS[1], "mary", 0.5);
export const NED = make(person({ id: "ned", name: "Ned Furrowe", people: "tarn", S: S_NED, cls: "officer", age: 42, idea: "the good hat's line across a long careful face",
  hatLine: true, hatInHand: true, gripL: true, hands: { L: "fist", R: "open" }, P: { stoop: 2 },
  face: { faceLen: 1.12, skull: [0.9, 1.06, 0.94], nose: [0.065, 0.021, 0.25, 0], lips: 0.78, mouthCut: 1.35, lids: 0.45, stubble: false, moustache: [0.03, 0.006] }, props: (M, B) => SCULPT.on || moustache()(M, B) }));
export const MARY = make(person({ id: "mary", name: "Mary Furrowe", people: "tarn", S: S_MARY, cls: { ...CLASSES.officer, hands: "worked", weather: 0.45 }, sex: "f", age: 40,
  idea: "high tight cheekbones over a mouth kept straight", cuff: "paper", face: { cheekbones: 0.75, cheekR: 0.85, lips: 0.8, mouth: 0.78 } }));
const ABEL_D = { id: "abel", name: "Abel Furrowe", people: "tarn", S: S_ABEL, idea: "the good hat worn proud over a long straight nose", face: { nose: [0.07, 0.022, 0.25, 0.05], browT: 1.15, stubble: false } };
export const ABEL_ERA1 = make(person({ ...ABEL_D, id: "abel_era1", cls: "officer", age: 63, hat: "good" })); // 63 in era 1, 75 in era 2 (decision 2026-10-22)
export const ABEL = make({ ...at(person({ ...ABEL_D, cls: { ...CLASSES.officer, hunger: 0.35 }, age: 75, face: { ...ABEL_D.face, stubble: true } }), 75),
  id: "abel", tool: "hands", gripR: true, hands: { L: "open", R: "fist" }, props: (M, B) => prop(M, B, "handR", [[0, -0.05, 0.02, 0.012], [0, -0.95, 0.1, 0.01]], "wood", { seg: 6 }) });   // the old man's stick
const PELL_D = { id: "pell_adult", name: "Pell Furrowe", people: "tarn", S: inherit(S_NED, S_MARY, "pell", 0.45), idea: "his grandfather's long nose, arriving early", face: { nose: [0.068, 0.021, 0.25, 0.05] } };
export const PELL_ADULT = make(person({ ...PELL_D, cls: "officer", age: 40, hat: "flat", hatMat: "tweed" }));
export const PELL = make({ ...at(person({ ...PELL_D, id: "pell", cls: { ...CLASSES.officer, hunger: 0.3 }, age: 12 }), 11), id: "pell", coat: { hem: 0.3, mat: "wool" }, legs: "wool", bootTop: 0.5 });

// ---- Brack (Tarn, the Militia; Edie a cottar's daughter) ----
export const S_WILL = sample("tarn", "will"), S_EDIE = sample("tarn", "edie");
export const WILL = make(person({ id: "will", name: "Will Brack", people: "tarn", S: S_WILL, cls: "militia", age: 36, idea: "a flushed broken nose over a jaw like a step",
  hat: "flat", hatMat: "wool", hatLift: 0.14, neck: "wool", belly: 0.04, coat: { hem: 0.55, mat: "wool" }, tool: "hands", P: { head: 0.28, neck: 0.08, stoop: 4 },
  face: { nose: [0.05, 0.024, 0.25, 0.1], noseBend: 0.06, noseFlat: true, jaw: 1.3, jawCorners: 1.0, cheekbones: 1.0, chin: 1.2, lids: 0.55, jowls: 0.2, stubble: false, faceLen: 1.15, skull: [1.0, 1.04, 0.98], cheekR: 0.9, scar: [0.18, 0.5, 0.36, 0.38] },
  palette: { cheek: { c: [0.86, 0.46, 0.4], v: 0.5 } },
  props: (M, B) => tube(M, [{ c: add(J(B, "armL"), [0.01, -0.12, 0]), rx: 0.075, rz: 0.075, w: { armL: 1 } }, { c: add(J(B, "armL"), [0.01, -0.2, 0]), rx: 0.073, rz: 0.073, w: { armL: 1 } }], { mat: mid("paper"), seg: 12 }) }));   // the militia armband

// ---- the Haldanes: Ilo (Hesh) and Bet (Tarn); Tomas and Aaron carry both, Anni is Bet's and Ned's (below) ----
export const S_ILO = sample("hesh", "ilo"), S_BET = sample("tarn", "bet");
const HALDANE = { cls: "hand", wardrobe: "hesh", label: "Hesh and Tarn" };
// Tomas, eleven (author, 2026-10-22): a hungry child; the high Hesh cheekbones over hollow cheeks, the braid,
// and the Orme lad's wool coat over his own felt, too big for him (handdown: loose on the body, the hem at his shins)
export const TOMAS = make({ ...at(person({ id: "tomas", name: "Tomas Haldane", people: "hesh", S: inherit(S_ILO, S_BET, "tomas", 0.3), ...HALDANE, cls: { ...CLASSES.hand, hunger: 0.85 }, age: 11,
  idea: "a child's hollow cheeks under high cheekbones, the braid, and a coat made for somebody bigger", face: { cheekbones: 1.0 } }), 11),
  id: "tomas", age: 11, braid: { len: 0.28 }, wear: "handdown", coat: { hem: 0.16, mat: "wool" }, legs: "wool", bootTop: 0.5 });
// Aaron, nine (author, 2026-10-22): cropped like a town boy, more his mother's face; the only one without the
// braid. Built on the ten record, as Davey is (cast/quota2.mjs).
export const AARON = make({ ...at(person({ id: "aaron", name: "Aaron Haldane", people: "hesh", S: inherit(S_ILO, S_BET, "aaron", 0.7), ...HALDANE, cls: { ...CLASSES.hand, hunger: 0.75 }, age: 9,
  idea: "a town crop and the ears that stick out of it", face: { earOut: 1 } }), 10),
  id: "aaron", age: 9, braid: null, hair: "crop", hat: "flat", hatMat: "wool", coat: { hem: 0.3, mat: "felt" }, legs: "wool", bootTop: 0.5,
  props: (M, B, R) => { if (!SCULPT.on) for (const x of [-1, 1]) propBlob(M, B, "head", [x * R * 1.02, R * 0.85, -R * 0.02], [R * 0.2, R * 0.34, R * 0.25], "skin", { rings: 6, seg: 10 }); } });   // the ears stand out
// Anni, Bet's before the wedding (author, 2026-10-22: "Out of wedlock."). Her father is Ned Furrowe (decided
// 2026-10-22, design/spine-plan/09-ANNI.md); the register's father column is ruled and Ilo raised her. So she is
// Tarn by blood on both sides, raised Hesh, with the thread: her face is Bet's and Ned's, leaning to Ned's long
// careful face (his face override, narrowed), and she wears the Haldanes' Hesh dress. No line says whose she is;
// the face is one of the objects the player reads it from.
const ANNI_D = { id: "anni_adult", name: "Anni Haldane", people: "tarn", S: inherit(S_BET, S_NED, "anni", 0.55), ...HALDANE, label: "Tarn, raised Hesh", sex: "f",
  idea: "a long careful face with no hat's line across it, wide watchful eyes, the braid over her shoulder", face: { eyes: 1.12, faceLen: 1.07, skull: [0.93, 1.04, 0.96] } };
export const ANNI_ADULT = make(person({ ...ANNI_D, cls: "smith", age: 40 }));
export const ANNI = make({ ...at(person({ ...ANNI_D, id: "anni", cls: { ...CLASSES.hand, hunger: 0.7 }, age: 14 }), 14), id: "anni", braid: { len: 0.3, side: 1 }, gripL: true, hands: { L: "fist", R: "open" },
  props: (M, B) => propBlob(M, B, "handL", [0, -0.06, 0.06], [0.05, 0.01, 0.07], "paper", { rings: 4, seg: 8 }) });   // the tally of the sacks

// ---- the Directorate, from Arlen: fed, straight-backed, good cloth ----
export const CAPTAIN = make(person({ id: "captain", name: "The Requisition Captain", people: "tarn", label: "Arlen", cls: "arlen", age: 36, idea: "a long clean chin and a thin moustache under a peaked cap",
  top: "grey", coat: { hem: 0.25, mat: "grey", flare: 0.2 }, neck: "collar", hat: "peaked", hatMat: "grey", legs: "grey", boot: "boot", bootTop: 0.6, gripL: true, hands: { L: "fist", R: "open" }, P: { h: 1.86, stoop: 0 },
  face: { chin: 1.45, faceLen: 1.18, lids: 0.5, lips: 0.72, mouth: 0.8, stubble: false, moustache: [0.032, 0.004] },
  props: (M, B) => { if (!SCULPT.on) moustache(0.032, 0.004)(M, B);
    const ch = J(B, "chest"); tube(M, [{ c: add(ch, [-0.15, 0.1, 0.12]), rx: 0.025, rz: 0.008, w: { chest: 1 } }, { c: add(ch, [0.15, -0.25, 0.15]), rx: 0.025, rz: 0.008, w: { chest: 0.5, spine: 0.5 } }], { mat: mid("strap"), seg: 6 });   // the cross strap
    prop(M, B, "handL", [[0, -0.06, -0.02, 0.006, 0.1], [0, -0.06, 0.16, 0.006, 0.1]], "paper", { square: 6, seg: 8 }); },   // the requisition order
  style: (p, c) => (c.tags?.includes("calm") ? setA(setA(p, "armL", "fwd", 30), "foreL", "bend", 70) : p) }));
// the rest of the slice's speakers live in cast/quota2.mjs (EDIE, DAVEY, ROSE, BET, ILO, TESK, LIL, GEDGE, PASK, MOTT)
