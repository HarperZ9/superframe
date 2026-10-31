// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Load the engine, the CAD layer and the three instruments into Node; returns { D, C, pipeline(id) }. */
"use strict";
const path = require("path"), fs = require("fs");
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "..", "ndim", "src", "index.js"));
require(path.join(ROOT, "..", "perceive", "src", "index.js"));
for (const f of ["core", "mesh", "model", "section", "raster", "scene", "lens", "layout", "spacetime", "overlay", "charts"]) require(path.join(ROOT, "src", f + ".js"));
const CAD_SRC = ["param", "symbols", "ortho", "sheet", "blueprint", "out", "schem", "schsvg", "kicad", "spec"];
for (const f of CAD_SRC) require(path.join(__dirname, "src", f + ".js"));
const IDS = ["jnt", "polariscope", "room"];
for (const i of IDS) require(path.join(__dirname, "instruments", i + ".js"));
const INSTRUMENTS = path.join(ROOT, "..", "instruments"), PIPE = path.join(INSTRUMENTS, "examples");
const D = globalThis.Diagram, C = D.CAD;
const pipeline = (id) => JSON.parse(fs.readFileSync(path.join(PIPE, C.REG[id].pipeline), "utf8"));
/* Everything one parameter set produces, in one record. */
const artefacts = (id, over) => {
  const R = C.resolve(C.REG[id], over), BP = C.blueprint(R), SC = C.schematic(R), elec = R.B.netlist.components.some((c) => !C.SYM[c.sym].optical);
  return {
    R, BP, SC, spec: C.specSheet(R, pipeline(id)),
    svg: C.toSVG(BP.sheet, { label: R.inst.title + " assembly drawing" }), dxf: C.toDXF(BP.sheet),
    sch: C.schematicSVG(SC, { hash: R.hash, label: R.inst.title + " schematic" }),
    kicadSch: elec ? C.toKicadSch(R, SC) : null, kicadNet: elec ? C.toKicadNet(R) : null,
  };
};
const record = (id) => C.REG[id].record;
module.exports = { D, C, IDS, CAD_SRC, pipeline, record, artefacts, PIPE, INSTRUMENTS };
