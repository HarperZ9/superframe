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
/* mounting holes come from the model's standoffs; copper, parts and silk keep clear of them */
{
  const so = R.B.parts.filter((p) => /^so\d+$/.test(p.id)), h = B.holes[0], at = (H, q) => H.some((k) => Math.abs(k.at[0] - q.at[0]) < 5e-4 && Math.abs(k.at[1] - q.at[1]) < 5e-4);
  check(`one ${E.RULES.mountDrill} mm hole under each of the model's ${so.length} standoffs`, so.length === 4 && B.holes.length === 4 && E.mountCheck(B, R).length === 0, E.mountCheck(B, R).join("; "));
  const B2 = clone(B); B2.holes = B.holes.map((q, i) => (i ? q : Object.assign({}, q, { at: [q.at[0] + 1, q.at[1]] })));
  planted("a board with one mounting hole moved 1 mm agrees with the standoffs", E.mountCheck(B2, R).length === 0);
  const B3 = clone(B); B3.traces.push({ net: "VA+", layer: 0, a: [h.at[0], h.at[1] + 1], b: [h.at[0] + 8, h.at[1] + 1], w: 0.5 });
  planted("a trace across a standoff seat passes the hole-clearance rule", !caught(B3, "hole clearance"));
  let refused = false;
  try { const Bx = E.makeBoard(R, {}); E.place(Bx, { zones: { A: [2, 2, Bx.w - 2, Bx.h - 2] }, zoneOf: () => "A", anchors: { BT1: [h.at[0], h.at[1], 0] } }); } catch (e) { refused = /mounting hole/.test(e.message); }
  planted("a part anchored on a mounting hole is placed", !refused);
  const N = E.parseExcellon(W.files["jnt-NPTH.drl"]);
  check("the non-plated drill file holds the four mounting holes and nothing else", N.holes.length === 4 && N.holes.every((q) => Math.abs(q.d - E.RULES.mountDrill) < 5e-4) && B.holes.every((q) => at(N.holes, q)) && !E.holes(B).some((q) => at(N.holes, q)));
  const moved = E.parseExcellon(W.files["jnt-NPTH.drl"].replace(/^(X[\d.]+)Y/m, (s, x) => `X${(+x.slice(1) + 0.05).toFixed(3)}Y`));
  planted("a non-plated drill file with one hole moved 0.05 mm matches the mounting holes", B.holes.every((q) => at(moved.holes, q)));
  const open = (l) => B.holes.every((q) => W.fab[l].some((p) => p.type === "flash" && p.at[0] === q.at[0] && p.at[1] === q.at[1] && p.ap.w >= q.d));
  check("the solder mask opens over each mounting hole on both sides", open("F_Mask") && open("B_Mask"));
}
/* silkscreen: every reference label prints whole */
{
  const L = E.silkLabels(B), p = E.bbox(E.pads(B)[0].shape);
  check(`all ${L.length} reference labels sit clear of pads, holes, other parts, other labels and the edge`, L.length === B.parts.length && !caught(B, "silk overlap"), JSON.stringify(drc.errors.filter((e) => e.rule === "silk overlap").slice(0, 3)));
  const B2 = clone(B); B2.labels = L.map((l, i) => (i ? l : Object.assign({}, l, { at: [p[0], p[1]], box: [p[0], p[1], p[0] + 1.5, p[1] + 0.8] })));
  planted("a reference label printed across a pad passes the silk-overlap rule", !caught(B2, "silk overlap"));
  const B3 = clone(B); B3.labels = L.map((l, i) => (i !== 1 ? l : Object.assign({}, l, { at: L[0].at, box: L[0].box })));
  planted("two reference labels printed on the same spot pass the silk-overlap rule", !caught(B3, "silk overlap"));
}
/* the BOM names what to buy: every resistor and capacitor row has a tolerance, every capacitor a voltage */
{
  const rows = E.parseBOM(W.files["jnt-bom.csv"]), rc = rows.filter((r) => /^[RC]\d/.test(r.Designators));
  check(`BOM: ${rc.length} resistor and capacitor rows each carry a tolerance, capacitors a voltage rating`, rc.length > 0 && rc.every((r) => r.Tolerance && (!/^C\d/.test(r.Designators) || r.Voltage)), JSON.stringify(rc.find((r) => !r.Tolerance)));
  check("BOM: a row with no part number says so instead of leaving a silent blank", rows.every((r) => r["Part number"] || r["PN status"] === "no part number"));
}
/* fuzz, fixed seeds: random flashes, strokes and regions, and random drill hits, must read back as written */
{
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const bad = []; let prims = 0, hits = 0, last = null;
  for (let seed = 1; seed <= 60; seed++) {
    const r = rng(seed * 7919), q = (lo, hi, n = 6) => +(lo + r() * (hi - lo)).toFixed(n), pt = () => [q(-40, 300), q(-40, 300)];
    const ap = () => { const k = "CRO"[Math.floor(r() * 3)], w = q(0.05, 6); return { kind: k, w, h: k === "C" ? w : q(0.05, 6) }; };
    const P = Array.from({ length: 1 + Math.floor(r() * 80) }, () => { const k = r(); return k < 0.4 ? { type: "flash", ap: ap(), at: pt() } : k < 0.8 ? { type: "stroke", ap: { kind: "C", w: 0, h: 0 }, a: pt(), b: pt() } : { type: "region", pts: Array.from({ length: 3 + Math.floor(r() * 7) }, pt) }; });
    for (const s of P) if (s.type === "stroke") s.ap.w = s.ap.h = q(0.05, 3);
    const txt = E.toGerber("F_Cu", P, { hash: "fuzz" + seed }), d = primDiff(P, E.parseGerber(txt).prims);
    if (d.length) bad.push(`gerber seed ${seed}: ${d[0]}`);
    const H = Array.from({ length: 1 + Math.floor(r() * 60) }, (_, i) => ({ d: q(0.2, 6.3, 3), at: [q(0, 300, 3), q(0, 300, 3)], what: "h" + i })), X = E.parseExcellon(E.toExcellon(H));
    if (X.holes.length !== H.length || !H.every((h) => X.holes.some((k) => Math.abs(k.at[0] - h.at[0]) < 5e-4 && Math.abs(k.at[1] - h.at[1]) < 5e-4 && Math.abs(k.d - h.d) < 5e-4))) bad.push(`excellon seed ${seed}`);
    prims += P.length; hits += H.length; last = { P, txt };
  }
  check(`fuzz: 60 seeded random layers (${prims} primitives) and drill files (${hits} hits) read back as written`, bad.length === 0, bad.slice(0, 3).join("; "));
  const nudged = last.P.map((s, i) => (i ? s : s.type === "flash" ? Object.assign({}, s, { at: [s.at[0] + 2e-6, s.at[1]] }) : s.type === "stroke" ? Object.assign({}, s, { a: [s.a[0] + 2e-6, s.a[1]] }) : Object.assign({}, s, { pts: s.pts.map((p, k) => (k ? p : [p[0] + 2e-6, p[1]])) })));
  planted("a fuzz layer with one coordinate moved 2 nm reads back as the layer that was written", primDiff(nudged, E.parseGerber(last.txt).prims).length === 0);
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
