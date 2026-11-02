// tests/golden/lens-page.json was generated from the source page's own statements, not from these modules. Equal hashes
// mean the core generates the same shader text and the same tables as the page it came from.
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { assert } from "./h.mjs";
import { SH, GR, GROUPS } from "../core/shapes.js";
import { SCENES, sceneCode } from "../core/scenes.js";
import { PATFN } from "../core/scatter.js";
import { ILL, BL, cmfB, SENS, MP } from "../core/spectra.js";
import { COMMON, CAM, ACC } from "../core/shaders/common.js";
import { lensFS } from "../core/shaders/lens.js";
import { trainFS, MAXS } from "../core/shaders/train.js";
import { worldFS } from "../core/shaders/world.js";
import { VS, VIEWS_DS } from "../core/shaders/display.js";
import { PRESETS } from "../core/train.js";
import { FIELDS } from "../core/fields.js";
import { MAT, MIR, DISPB } from "../core/materials.js";
import { FRAMES } from "../core/frames.js";
import { I_COMMON } from "../core/inner.js";
import { dropProfile, ewCurv, G } from "../core/liquid.js";
import { fCompile, FEX } from "../core/formula.js";

const gold = JSON.parse(readFileSync(new URL("./golden/lens-page.json", import.meta.url)));
const h = (s) => createHash("sha256").update(String(s)).digest("hex").slice(0, 24);
const J = (v) => h(JSON.stringify(v, (_, x) => (x instanceof Float32Array || x instanceof Float64Array ? [...x] : x)));
const base = (a, o = {}) => ({
  a,
  b: null,
  m: null,
  grin: null,
  scene: "chart",
  fhelp: false,
  pol: false,
  pt: true,
  St: { fRho: "1", fAbs: "1", fTr: "1", inner: null, ...(o.St || {}) },
  meta: false,
  scat: false,
  tr: false,
  ltex: false,
  pat: false,
  soap: false,
  inner: null,
  prof: false,
  ...o,
});

test("one program per shape, byte for byte the page's", () => {
  assert.deepEqual(Object.keys(SH).sort(), Object.keys(gold.lens).sort());
  for (const id of Object.keys(SH))
    assert.equal(h(lensFS(base(SH[id][1], { grin: GR[id] || null, prof: id === "50" }))), gold.lens[id], `shape ${id}`);
});
test("feature switches generate the page's programs", () => {
  const A = SH[4][1];
  const f = {
    two: { b: SH[1][1] },
    morph: { m: SH[5][1] },
    pol: { pol: true },
    ptOff: { pt: false },
    scat: { scat: true },
    tr: { tr: true },
    ltex: { ltex: true, pat: true },
    soap: { soap: true },
    metaScene: { scene: "meta", meta: true },
    patScene: { scene: "patterns", pat: true },
    fhelp: { fhelp: true },
    inSpheres: { inner: "spheres", St: { inner: "spheres" } },
    inTree: { inner: "tree", St: { inner: "tree" } },
    inCrystals: { inner: "crystals", St: { inner: "crystals" } },
    inCell: { inner: "cell", St: { inner: "cell" } },
    inRoom: { inner: "room", St: { inner: "room" } },
  };
  for (const [k, o] of Object.entries(f)) assert.equal(h(lensFS(base(A, o))), gold.features[k], k);
  for (const k of Object.keys(SCENES)) {
    assert.equal(h(sceneCode(k)), gold.scenes[k], `scene ${k}`);
    assert.equal(h(lensFS(base(A, { scene: k, meta: k === "meta", pat: k === "patterns" }))), gold.features["scene_" + k], k);
  }
});
test("train and world programs match", () => {
  for (const k of ["chart", "night"]) assert.equal(h(trainFS({ scene: k })), gold.train[k], k);
  for (const [k, f] of Object.entries(FIELDS)) if (f.body) assert.equal(h(worldFS({ body: f.body, St: { scatOn: false } })), gold.world[k], k);
});
test("tables match, including the materials now built from provenance rows", () => {
  const t = gold.tables;
  assert.equal(J(MAT), t.MAT, "MAT");
  assert.equal(J(MIR), t.MIR, "MIR");
  assert.equal(J(FRAMES), t.FRAMES, "FRAMES");
  assert.equal(J(FIELDS), t.FIELDS, "FIELDS");
  assert.equal(J(GROUPS), t.GROUPS, "GROUPS");
  assert.equal(J(ILL), t.ILL, "ILL");
  assert.equal(J(BL), t.BL, "BL");
  assert.equal(J(cmfB), t.cmfB, "cmfB");
  assert.equal(J(SENS), t.SENS, "SENS");
  assert.equal(J(MP), t.MP, "MP");
  assert.equal(J(dropProfile(0)), t.drop0, "drop");
  assert.equal(J(dropProfile(2)), t.drop2, "drop");
  for (const [k, v] of Object.entries({ COMMON, CAM, ACC, VS, VIEWS_DS, PATFN, I_COMMON })) assert.equal(h(v), t[k], k);
  assert.equal(ewCurv(30), t.ewCurv30);
  assert.equal(G, t.G);
  assert.equal(DISPB, t.DISPB);
  assert.equal(MAXS, t.MAXS);
  for (const [k, p] of Object.entries(PRESETS)) assert.equal(J(p.make()), t["preset_" + k], k);
});
test("the page's formula examples compile to the same code", () => {
  for (const [, text] of FEX) {
    const c = fCompile(text);
    assert.equal(h(c.body + "|" + c.grin + "|" + c.kind), gold.formula[text], text);
  }
});
test("planted: one changed character in a body is caught", () => {
  const tampered = SH[4][1].replace(".85", ".86");
  assert.notEqual(h(lensFS(base(tampered))), gold.lens[4]);
});
test("no program holds a table of shapes: a shape's program stays near its own size", () => {
  const sizes = Object.values(gold.sizes);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) < 3000, `spread ${Math.max(...sizes) - Math.min(...sizes)}`);
  const one = lensFS(base(SH[4][1]));
  assert.ok(!one.includes(SH[47][1]), "another shape's body is not in this program");
});
