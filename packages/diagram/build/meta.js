// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Print the page builder's inputs as JSON: lens and layer tables, and each diagram's words and parts. */
"use strict";
const fs = require("fs"), path = require("path");
require("../../ndim/src/index.js");
require("../../perceive/src/index.js");
for (const f of ["core", "mesh", "model", "section", "raster", "scene", "lens", "layout", "spacetime", "overlay", "charts"]) require("../src/" + f + ".js");
const D = globalThis.Diagram, ids = process.argv.slice(2);
for (const i of ids) require("../diagrams/" + i + ".js");
const out = { LENS: D.LENS, OVERLAY: D.OVERLAY, MATERIALS: D.MATERIALS, defs: {} };
for (const i of ids) {
  const d = globalThis.DiagramDefs[i];
  out.defs[i] = { id: i, title: d.title, region: d.region, file: d.file, super: d.super, message: d.message, lede: d.lede, plain: d.plain, working: d.working, sources: d.sources || [], knobs: d.knobs || [], overlayNotes: d.overlayNotes || "",
    parts: d.parts.map((p) => ({ id: p.id, label: p.label, alt: p.alt, material: p.material, qty: p.qty || "" })), problems: D.validate(d) };
}
process.stdout.write(JSON.stringify(out));
