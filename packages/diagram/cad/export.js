// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Write every artefact of each instrument at its default parameters:
     node cad/export.js [outdir]      default cad/out; one folder per instrument
   drawing.svg, drawing.dxf, schematic.svg, <id>.kicad_sch, <id>.net (electrical instruments only), spec.md,
   spec.json, bom.csv, and manifest.json with each file's hash and the model hash it came from. */
"use strict";
const fs = require("fs"), path = require("path");
const { C, IDS, artefacts } = require("./load.js");
const base = process.argv[2] || path.join(__dirname, "out");
const csv = (rows) => rows.map((r) => r.map((x) => (/[",\n]/.test(String(x)) ? '"' + String(x).replace(/"/g, '""') + '"' : String(x))).join(",")).join("\n") + "\n";
for (const id of IDS) {
  const A = artefacts(id), R = A.R, dir = path.join(base, id), files = {};
  fs.mkdirSync(dir, { recursive: true });
  const put = (name, text) => { fs.writeFileSync(path.join(dir, name), text); files[name] = C.hashText(text); };
  put("drawing.svg", `<?xml version="1.0" encoding="UTF-8"?>
` + A.svg); put("drawing.dxf", A.dxf); put("schematic.svg", `<?xml version="1.0" encoding="UTF-8"?>
` + A.sch);
  if (A.kicadSch) { put(id + ".kicad_sch", A.kicadSch); put(id + ".net", A.kicadNet); }
  put("spec.md", C.specMD(A.spec)); put("spec.json", JSON.stringify(A.spec, null, 1));
  const top = R.B.items.map((it) => [it.item, it.parts.length, it.pn || "", it.pnStatus || "", it.desc, it.material || ""]);
  put("bom.csv", csv([["item", "qty", "part_number", "pn_status", "description", "material"], ...top]));
  const el = R.B.netlist.components.filter((c) => !C.SYM[c.sym].optical).map((c) => [c.ref, c.value, c.fp || "", c.pn || "", c.pnStatus || "", c.desc || "", c.offBoard ? "off board" : ""]);
  if (el.length) put("bom-electrical.csv", csv([["ref", "value", "footprint", "part_number", "pn_status", "description", "note"], ...el]));
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ id, model_hash: R.hash, params: R.p, problems: R.problems, sheet: A.BP.size, scale: C.scaleText(A.BP.scale), files }, null, 1));
  console.log(id, A.BP.size, C.scaleText(A.BP.scale), Object.keys(files).length, "files ->", dir);
}
