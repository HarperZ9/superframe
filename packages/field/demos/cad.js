// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Demo: a CAD dimension to DXF and back, through tools/diagram's own DXF writer and reader (cad/src/out.js).
   The source is the drawing's dimension record (BP.dims of each instrument in diagram/cad), model mm,
   plus a stress sample of the same dimensions with sub-micron decimals.
     cad.dxf.model   each dimension written as a LINE of that length in model space (1:1), read back.
                     Claims isomorphism within 1e-6 mm. The reverse test uses DXF written by hand, with
                     trailing zeros the writer never prints, and compares the numbers it carries, so the
                     target is DXF up to formatting (the quotient), where the claim can hold both ways.
     cad.dxf.text    the same, compared as text: an embedding at best, since many texts are one drawing.
     cad.dxf.sheet   each dimension as it sits on the sheet, at the drawing scale, read back and divided by
                     the scale. The writer's 1e-6 grain is in sheet mm, so the model-space bound is
                     5e-7 / scale; the converter claims the model bound 1e-6 mm, and the measurement decides. */
"use strict";
const F = require("../src/index.js");
const L = require("../../diagram/cad/load.js");
const C = L.C;
const SHEET = { w: 420, h: 297 };

const dxfOf = (lengths, scale) => C.toDXF({ w: SHEET.w, h: SHEET.h, E: Array.from(lengths, (v, i) => ({ t: "line", layer: "DIM", a: [0, i], b: [v * scale, i] })) });
const lengthsOf = (txt, scale) => C.parseDXF(txt).entities.filter((e) => e.t === "line").map((e) => (e.b[0] - e.a[0]) / scale);
const numbers = (txt) => C.parseDXF(txt).entities.filter((e) => e.t === "line").flatMap((e) => [e.a[0], e.a[1], e.b[0], e.b[1]]);
const numericResidual = (a, b) => { const x = numbers(a), y = numbers(b); if (x.length !== y.length) return Infinity; let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i] - y[i])); return m; };

/* Hand-written R12 DXF, same entities, with every number printed to ten decimals and trailing zeros kept. */
const handDXF = (txt) => txt.split("\n").map((line, i, arr) => (i % 2 === 1 && ["10", "11", "20", "21"].includes(arr[i - 1].trim()) ? Number(line).toFixed(10) : line)).join("\n");

const dxfConv = (id, scale, opt = {}) => F.converter({ id, claims: opt.claims || "isomorphism", tol: opt.tol !== undefined ? opt.tol : 1e-6,
  residual: "abs", targetResidual: opt.text ? "symbol" : numericResidual, targetTol: opt.text ? 0 : 1e-6 * scale,
  from: { unit: "mm" },
  forward: (f) => ({ values: [(opt.writer || dxfOf)(f.values, scale)], domain: { kind: "point", scale }, unit: "symbol", sigma: null, rep: { kind: "digital", encoding: "DXF R12 ASCII (AC1009)", grain: 1e-6 } }),
  inverse: (out) => Float64Array.from(lengthsOf(out.values[0], scale)),
  targets: (src, out) => F.derive(out, { values: [handDXF(out.values[0])], method: "hand-written DXF" }),
});

const sourceDims = () => {
  const rows = [];
  for (const id of L.IDS) { const A = L.artefacts(id); for (const d of A.BP.dims) rows.push({ inst: id, id: d.id, value: d.value, scale: A.BP.scale }); }
  return rows;
};

const field = (vals, label) => F.make({ name: label, domain: { kind: "sequence", shape: [vals.length] }, values: Float64Array.from(vals), unit: "mm",
  sigma: null, prov: { status: "defined", source: "tools/diagram/cad instruments (jnt, polariscope, room) BP.dims", method: "design parameters" },
  rep: { kind: "digital", encoding: "float64" } });

const run = () => {
  const dims = sourceDims(), r = F.rng(31);
  const base = field(dims.map((d) => d.value), "drawing dimensions"), stress = field(dims.map((d) => d.value + r() * 0.999999), "dimensions with sub-micron decimals");
  const res = {};
  for (const [name, f] of [["design", base], ["stress", stress]]) {
    res[name] = {
      model: F.apply(dxfConv("cad.dxf.model", 1), f, { strict: false }).verdict,
      text: F.apply(dxfConv("cad.dxf.text", 1, { text: true, claims: "embedding" }), f, { strict: false }).verdict,
      room_sheet_1to50: F.apply(dxfConv("cad.dxf.sheet (room, 1:50)", 0.02), f, { strict: false }).verdict,
      room_sheet_bound: F.apply(dxfConv("cad.dxf.sheet (room, 1:50) at 2.5e-5 mm", 0.02, { tol: 0.5e-6 / 0.02 + 1e-12 }), f, { strict: false }).verdict,
    };
  }
  return { dims, results: res };
};

module.exports = { run, dxfConv, dxfOf, lengthsOf, field, sourceDims, handDXF };
