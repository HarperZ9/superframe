// The form override: a form layer holds painted planes, never shows in the picture, and the light-stroke
// brush over it loads its colour from those planes lit by the key, not from the canvas. Control: the same
// brush with no form layer under it takes the canvas colour.
//   node --test tools/studio/tests/form.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { smallDoc, line } from "./fixture.mjs";
import { addLayer, composite } from "../core/doc.mjs";
import { beginStroke, strokeTo, endStroke } from "../core/stroke.mjs";
import { planeNormal, formNormalAt, sitterFacing, formLight } from "../core/form.mjs";
import { LIGHT } from "../core/brush.mjs";

function setup() {
  const D = smallDoc(120, 60, 0.5); D.doc.meta.cam = { yaw: 34, turn: -32 }; D.doc.meta.keyDir = planeNormal({ yaw: 40, pitch: 20 }, sitterFacing(D.doc.meta));
  D.doc.meta.formTones = { light: [0.95, 0.75, 0.6], shadow: [0.2, 0.15, 0.16] }; const F = addLayer(D.doc, { name: "form", kind: "form", author: "human" }); composite(D.doc); return { ...D, F };
}
const plane = (D, p, x0, x1) => { const S = beginStroke(D.doc, D.F, { tool: "brush", size: 20, plane: p, flow: 1, bristles: 20, spread: 2 }, {}); for (const [x, y, q] of line(x0, 30, x1, 30, 10, 1)) strokeTo(S, x, y, q); endStroke(S); };
const lightAt = (D, x) => { const L = D.doc.layers.find((l) => l.name === "paint"), S = beginStroke(D.doc, L, { ...LIGHT, colour: [0, 0, 1], depletion: 0 }, { seed: 3 }); for (const [px, y, q] of line(x - 3, 30, x + 3, 30, 4, 0.9)) strokeTo(S, px, y, q); endStroke(S); return Array.from(L.rgba.subarray((30 * D.doc.w + x) * 4, (30 * D.doc.w + x) * 4 + 3)); };

test("planes facing the key light the brush; planes turned away shade it; the form layer itself never shows", () => {
  const D = setup(), before = Float32Array.from(D.doc.out);
  plane(D, { yaw: 40, pitch: 20 }, 10, 45); plane(D, { yaw: -80, pitch: -10 }, 70, 105); composite(D.doc);
  assert.ok(D.doc.out.every((v, i) => v === before[i]), "the form layer is not in the picture");
  const n = formNormalAt(D.doc, 30 * 120 + 25); assert.ok(n && formLight(D.doc, n)[0] > 0.8, "a plane facing the key is lit");
  const lit = lightAt(D, 25), dark = lightAt(D, 88);
  assert.ok(lit[0] > 0.8 && dark[0] < 0.35, `lit plane ${lit.map((v) => v.toFixed(2))}, turned-away plane ${dark.map((v) => v.toFixed(2))}`);
  const K = setup(), plain = lightAt(K, 25);
  assert.ok(Math.abs(plain[0] - plain[2]) < 0.15 && plain[0] > 0.5 && plain[0] < 0.75, `control: no form, the canvas grey lifted (${plain.map((v) => v.toFixed(2))})`);
});

test("the coverage check: a plane covered by a solid base coat shows almost no underpainting; sparse dabs (control) do", async () => {
  const { formCoverage } = await import("../core/form.mjs");
  const run = (dense) => {
    const D = setup(); plane(D, { yaw: 40, pitch: 20 }, 15, 100);
    const L = D.doc.layers.find((l) => l.name === "paint");
    for (let x = 0; x <= 119; x += dense ? 6 : 24) { const S = beginStroke(D.doc, L, { colour: [0.8, 0.6, 0.5], size: dense ? 14 : 4, flow: 0.9, bristles: 30, spread: 2.6, dry: 0, depletion: 0 }, {}); for (const [px, y, q] of line(x, 4, x, 56, 8, 1)) strokeTo(S, px, y, q); endStroke(S); }
    return formCoverage(D.doc).uncovered;
  };
  const covered = run(true), sparse = run(false);
  assert.ok(covered < 0.05, `dense coat leaves ${(covered * 100).toFixed(1)} percent open`);
  assert.ok(sparse > 0.05, `control: sparse dabs leave ${(sparse * 100).toFixed(1)} percent open`);
});
