// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Board, DRC and fab-output tests for the thermometer board.  node eda/tests/eda.test.js [--json out.json]
   The routed board must pass the DRC; planted rule breaks must each be caught under their own rule name; every
   fab file must read back to what was written; the copper Gerbers rendered back must match the board view; and
   planted file faults must fail those same comparisons. */
"use strict";
const fs = require("fs"), path = require("path");
const { C, E } = require("../load.js");
const { build } = require("../jnt-board.js");
const { writeAll, compareLayer, primDiff } = require("../fab.js");
const out = { pass: 0, fail: 0, planted_rejected: 0, planted_accepted: 0, rows: [] };
const check = (name, ok, detail) => { out[ok ? "pass" : "fail"]++; out.rows.push({ name, ok: !!ok, detail: String(detail === undefined ? "" : detail) }); if (!ok) console.error("FAIL", name, detail || ""); };
const planted = (name, accepted, detail) => { out[accepted ? "planted_accepted" : "planted_rejected"]++; out.rows.push({ name: "planted: " + name, ok: !accepted, detail: String(detail || "") }); if (accepted) console.error("PLANTED ACCEPTED", name, detail || ""); };
const clone = (B) => Object.assign({}, B, { traces: B.traces.map((t) => Object.assign({}, t)), vias: B.vias.map((v) => Object.assign({}, v)), pourRects: B.pourRects.slice(), parts: B.parts.map((P) => Object.assign({}, P)) });

const { R, B } = build();
const onBoard = R.B.netlist.components.filter((c) => !c.offBoard);
check(`board takes its outline from the model's pcb part (${B.w} x ${B.h} mm)`, B.w === R.B.parts.find((p) => p.id === "pcb").geom.size[0] && B.h === R.B.parts.find((p) => p.id === "pcb").geom.size[2]);
check(`every on-board netlist component (${onBoard.length}) is placed with a footprint whose pads match its pins`, B.parts.length === onBoard.length && B.parts.every((P) => P.at && P.fp.pads.every((d) => d.num in P.comp.pins)));
const cy = B.parts.map((P) => E.courtyard(P.fp, P.at, P.rot, 0.25));
check("no two courtyards overlap and all lie on the board", cy.every((a, i) => a[0] >= 0 && a[1] >= 0 && a[2] <= B.w && a[3] <= B.h && cy.every((b, j) => j === i || !(a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]))));
const drc = E.drc(B);
check(`routed board: DRC clean (${drc.objects} copper objects, ${drc.pairs} pairs checked)`, drc.errors.length === 0, JSON.stringify(drc.errors.slice(0, 3)));
check(`every net with two or more pads is one piece of copper (${Object.keys(B.nets).length} nets, ${B.traces.length} segments, ${B.vias.length} vias, ${B.pourRects.length} pour rectangles)`, drc.unrouted.length === 0);
check("the two ground islands are separate pours that meet only through NT1", B.pourRects.some((r) => r.net === "GND_A") && B.pourRects.some((r) => r.net === "GND_B") && Math.max(...B.pourRects.filter((r) => r.net === "GND_A").map((r) => r.rect[2])) < Math.min(...B.pourRects.filter((r) => r.net === "GND_B").map((r) => r.rect[0])));
check("input-class traces are 0.3 mm and every trace meets its class width", B.traces.filter((t) => t.net === "IN").every((t) => t.w === 0.3) && B.traces.every((t) => t.w >= B.classes[B.nets[t.net].cls].width));

/* planted rule breaks, each must be caught by its own rule */
const caught = (B2, rule) => E.drc(B2).errors.some((e) => e.rule === rule);
{
  const B2 = clone(B), t = B2.traces.find((s) => s.net === "IN"), other = B2.traces.find((s) => s.net !== "IN" && s.layer === t.layer);
  B2.traces.push({ net: other.net, layer: t.layer, a: [t.a[0] + 0.5, t.a[1]], b: [t.b[0] + 0.5, t.b[1]], w: other.w });
  planted("a foreign trace 0.5 mm beside the input passes the clearance rule", !caught(B2, "clearance"));
  const B3 = clone(B); B3.traces.push({ net: other.net, layer: t.layer, a: t.a, b: t.b, w: other.w });
  planted("a foreign trace laid over the input passes as no short", !caught(B3, "short"));
  const B4 = clone(B); B4.traces[0] = Object.assign({}, B4.traces[0], { w: 0.12 });
  planted("a 0.12 mm trace passes the width rule", !caught(B4, "width"));
  const B5 = clone(B); B5.vias[0] = Object.assign({}, B5.vias[0], { dia: 0.4 });
  planted("a via with a 0.05 mm ring passes the annular-ring rule", !caught(B5, "annular ring"));
  const B6 = clone(B), len = (s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), fb = B6.traces.filter((s) => s.net === "A_FB1").sort((a, b) => len(b) - len(a))[0]; B6.traces.splice(B6.traces.indexOf(fb), 1);
  planted("a board with the longest A_FB1 segment deleted passes as routed", !caught(B6, "unrouted"));
  const B7 = clone(B); B7.traces.push({ net: "VA+", layer: 0, a: [0.1, 30], b: [0.1, 35], w: 0.5 });
  planted("copper on the board edge passes the edge rule", !caught(B7, "edge"));
  const B8 = clone(B); B8.vias.push(Object.assign({}, B8.vias[0], { at: [B8.vias[0].at[0] + 0.4, B8.vias[0].at[1]] }));
  planted("two drills 0.1 mm apart pass the hole-gap rule", !caught(B8, "hole gap"));
}

/* fab files: round trips, determinism, renders back */
const meta = { hash: R.hash }, W = writeAll(B, meta);
for (const t of W.trips) check(`${t.file} (${t.kind}) reads back to what was written`, t.ok, JSON.stringify(t));
check("every copper, mask, paste, silk and outline Gerber carries its X2 file function", W.trips.filter((t) => t.kind === "gerber").every((t) => t.fileFunction));
check("same model, same Gerber bytes", C.hashText(writeAll(build().B, meta).files["jnt-F_Cu.gbr"]) === C.hashText(W.files["jnt-F_Cu.gbr"]));
for (const [L, name] of [[0, "F_Cu"], [1, "B_Cu"]]) {
  const K = compareLayer(B, W.files[`jnt-${name}.gbr`], L);
  check(`${name} Gerber rendered back at 25 px/mm matches the board view: ${K.xor} edge pixels of ${K.copper} differ, none in a solid patch`, K.thick === 0 && K.frac < 0.01, JSON.stringify({ xor: K.xor, thick: K.thick }));
}
{
  const txt = W.files["jnt-F_Cu.gbr"], m = /%ADD(\d+)R,1\.025000X1\.400000\*%/.exec(txt) || /%ADD(\d+)R,1\.400000X1\.025000\*%/.exec(txt);
  const bad = txt.replace(m[0], m[0].replace(/1\.025000/, "1.625000"));
  planted("a Gerber with the 0805 pad aperture widened 0.6 mm matches the board view", compareLayer(B, bad, 0).thick === 0);
  const P = E.parseGerber(txt).prims, moved = txt.replace(/X(\d+)Y(\d+)D03\*/, (s, x, y) => `X${+x + 10}Y${y}D03*`);
  planted("a Gerber with one flash moved 10 nm reads back as written", primDiff(W.fab.F_Cu, E.parseGerber(moved).prims).length === 0, P.length);
  let refused = 0; for (const s of ["G02*", "%AMOC8*%"]) { try { E.parseGerber(txt.replace("G01*", "G01*\n" + s)); } catch (e) { refused++; } }
  check("the Gerber reader refuses arcs and aperture macros by name instead of skipping them", refused === 2);
  const drl = W.files["jnt.drl"].replace(/^(X[\d.]+)Y/m, (s, x) => `X${(+x.slice(1) + 0.05).toFixed(3)}Y`), H = E.holes(B), X = E.parseExcellon(drl);
  planted("a drill file with one hole moved 0.05 mm matches the board's holes", H.every((h) => X.holes.some((q) => Math.abs(q.at[0] - h.at[0]) < 5e-4 && Math.abs(q.at[1] - h.at[1]) < 5e-4)));
}
/* a parameter change reaches the board through the model */
{
  const { B: Bw } = build({ encW: 160 });
  check("a wider box (160 mm) widens the board and the Edge_Cuts outline with it", Bw.w === B.w + 30 && /X146000000Y0D01/.test(writeAll(Bw, meta).files["jnt-Edge_Cuts.gbr"]));
}
/* the 3D draw list reads the materials file */
{
  const MAT = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "board-materials.json"), "utf8")), L = E.boardDrawList(B, MAT);
  check(`3D board draw list: ${L.tris.length / 9} triangles, copper and ENIG colours from the materials library`, L.tris.length > 0 && L.style.some((s) => s.rgb === MAT.copper.srgb) && L.style.some((s) => s.rgb === MAT.enig.srgb) && MAT.copper.source.startsWith("derived:"));
}

console.log(`eda: ${out.pass} pass, ${out.fail} fail, planted ${out.planted_rejected} rejected, ${out.planted_accepted} accepted`);
const j = process.argv.indexOf("--json");
if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(Object.assign({ date: new Date().toISOString().slice(0, 10) }, out), null, 1));
process.exit(out.fail || out.planted_accepted ? 1 : 0);
