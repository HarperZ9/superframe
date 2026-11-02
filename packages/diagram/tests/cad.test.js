// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Known-answer tests for the parametric instrument layer.  node tests/cad.test.js [--json out.json]
   Round trips (model to DXF and back; netlist to .net and .kicad_sch and back), drawn dimensions equal to the
   model's values, a changed parameter reaching every view, and planted errors that must be refused. Exit 1 if
   a check fails or a planted error is accepted. */
"use strict";
const fs = require("fs");
const { D, C, IDS, artefacts, pipeline } = require("../cad/load.js");
const out = { pass: 0, fail: 0, planted_rejected: 0, planted_accepted: 0, rows: [] };
const check = (name, ok, detail) => { out[ok ? "pass" : "fail"]++; out.rows.push({ name, ok: !!ok, detail }); if (!ok) console.error("FAIL", name, detail || ""); };
const planted = (name, accepted, detail) => { out[accepted ? "planted_accepted" : "planted_rejected"]++; out.rows.push({ name: "planted: " + name, ok: !accepted, detail }); if (accepted) console.error("PLANTED ACCEPTED", name, detail || ""); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const num = (s) => parseFloat(String(s).replace(/^[^\d-]*/, ""));

/* DXF round trip: same entities, same layers, coordinates to 1e-6 mm, the same words. */
const dxfSame = (S, P) => {
  const bad = [], E = S.E;
  if (E.length !== P.entities.length) return ["entity count " + E.length + " vs " + P.entities.length];
  const near = (a, b) => Math.abs(a - b) <= 1e-6 + 1e-9 * Math.abs(b);
  E.forEach((e, i) => {
    const q = P.entities[i];
    if (e.t !== q.t || e.layer !== q.layer) { bad.push(`#${i}: ${e.t}/${e.layer} came back ${q.t}/${q.layer}`); return; }
    const pts = e.t === "line" ? [e.a, e.b] : e.t === "poly" || e.t === "solid" ? e.pts : e.t === "text" ? [e.at] : [e.c], qp = q.t === "line" ? [q.a, q.b] : q.t === "poly" || q.t === "solid" ? q.pts : q.t === "text" ? [q.at] : [q.c];
    if (pts.length !== qp.length || pts.some((p, k) => !near(p[0], qp[k][0]) || !near(p[1], qp[k][1]))) bad.push(`#${i} ${e.t}: coordinates moved`);
    if (e.t === "text" && e.s !== q.s) bad.push(`#${i}: text "${e.s}" came back "${q.s}"`);
    if ((e.t === "circle" || e.t === "arc") && !near(e.r, q.r)) bad.push(`#${i}: radius`);
    if (e.t === "poly" && !!e.closed !== q.closed) bad.push(`#${i}: closed flag`);
  });
  return bad;
};

for (const id of IDS) {
  const A = artefacts(id), R = A.R, I = R.inst;
  check(`${id}: the default model validates (labels, BOM, assembly, netlist, tolerances, fits)`, R.problems.length === 0, R.problems.join("; "));
  for (const k of I.checks()) check(`${id}: ${k.name}`, k.want === 0 ? Math.abs(k.got) <= k.tol : Math.abs(k.got - k.want) <= k.tol * Math.abs(k.want), `got ${k.got} want ${k.want}`);
  /* 3D */
  const M = D.compile(C.diagDef(R));
  let exact = true;
  for (const P of M.parts) for (const s of [0.2, 0.7, 1]) { const q = D.exploded(P, s), b = D.assembled(P, q, s); if (b.some((x, k) => x !== P.pos[k])) exact = false; }
  check(`${id}: 3D model compiles, ${M.parts.length} parts, exploded poses return bit for bit`, exact && M.parts.length === R.B.parts.length);
  /* drawing dimensions against the model */
  const bad = A.BP.dims.filter((d) => Math.abs(d.value - d.expect) > 1e-6 * Math.max(1, Math.abs(d.expect)));
  check(`${id}: all ${A.BP.dims.length} drawn dimensions, measured from the geometry, equal the model's values`, A.BP.dims.length > 0 && !bad.length, bad.map((d) => `${d.id} ${d.value} vs ${d.expect}`).join("; "));
  check(`${id}: every parts-list item has a balloon on some view`, A.BP.balloons.every((b) => b.view), A.BP.balloons.filter((b) => !b.view).map((b) => b.item).join(","));
  /* DXF round trip */
  const P = C.parseDXF(A.dxf), diff = dxfSame(A.BP.sheet, P);
  check(`${id}: DXF R12 round trip, ${P.entities.length} entities, same type, layer, coordinates and words`, !diff.length, diff.slice(0, 4).join("; "));
  check(`${id}: DXF declares every layer the sheet uses`, [...new Set(A.BP.sheet.E.map((e) => e.layer))].every((l) => P.layers.some((q) => q.name === l)));
  const dtext = A.BP.dims.map((d) => { const t = P.entities.find((e) => e.t === "text" && e.layer === "DIM" && Math.abs(e.at[0] - d.at[0]) < 1e-5 && Math.abs(e.at[1] - d.at[1]) < 1e-5); return { d, t }; });
  check(`${id}: each dimension's words, read back from the DXF, give the model value`, dtext.every(({ d, t }) => t && Math.abs(num(t.s) - Math.round(d.expect * 1000) / 1000) < 0.006), dtext.filter(({ d, t }) => !t || Math.abs(num(t.s) - d.expect) >= 0.006).map(({ d, t }) => d.id + ":" + (t && t.s)).join("; "));
  const dxf2 = artefacts(id).dxf;
  check(`${id}: the same parameters give the same DXF bytes`, C.hashText(dxf2) === C.hashText(A.dxf));
  /* schematic and KiCad */
  check(`${id}: schematic routes every net (${A.SC.wires.length} wires, ${A.SC.labels.length} labels) with no problems`, A.SC.problems.length === 0, A.SC.problems.join("; "));
  if (A.kicadNet) {
    const N = C.parseKicadNet(A.kicadNet), comps = R.B.netlist.components;
    check(`${id}: .net round trip keeps every component, value and footprint`, N.components.length === comps.length && comps.every((c) => N.components.some((q) => q.ref === c.ref && q.value === c.value && q.footprint === (c.fp || ""))));
    const nodesOk = R.B.netlist.nets.every((n) => { const q = N.nets.find((x) => x.name === C.netName(n)); const want = comps.flatMap((c) => Object.entries(c.pins).filter(([, v]) => v === n.name).map(([k]) => c.ref + "." + k)).sort(); return q && JSON.stringify(q.nodes.map((x) => x.ref + "." + x.pin).sort()) === JSON.stringify(want); });
    check(`${id}: .net round trip keeps every net's nodes (${N.nets.length} nets)`, nodesOk && N.nets.length === R.B.netlist.nets.length);
    const S = C.parseKicadSch(A.kicadSch), conn = C.checkConnectivity(R, S);
    check(`${id}: .kicad_sch round trip: connectivity rebuilt from pin, wire and label geometry equals the netlist`, !conn.length, conn.join("; "));
    check(`${id}: .kicad_sch keeps every symbol's reference and value`, comps.every((c) => S.symbols.some((s) => s.ref === c.ref && s.value === c.value)));
  } else check(`${id}: no electrical parts, so no KiCad files are written (optical train only)`, R.B.netlist.nets.every((n) => n.kind === "optical"));
  /* spec sheet */
  check(`${id}: spec sheet has ranges, a budget and every pipeline assumption flagged optional or required`, !A.spec.problems.length && A.spec.ranges.length && A.spec.assumptions.length && A.spec.assumptions.every((a) => typeof a.optional === "boolean"), A.spec.problems.join("; "));
}

/* a changed parameter reaches every view */
{
  const a = artefacts("jnt"), b = artefacts("jnt", { R: 22000, encW: 150 });
  const box = (A) => { const M = D.compile(C.diagDef(A.R)); return (M.hi[0] - M.lo[0]) / A.R.inst.scale3d; };
  check("change: box width 130 to 150 mm widens the 3D model by 20 mm", Math.abs(box(b) - box(a) - 20) < 1e-6, `${box(a)} to ${box(b)}`);
  check("change: the drawing's width dimension reads 150 and the DXF carries it", b.BP.dims.find((d) => d.id === "W").text === "150 ±0.3" && b.dxf.includes("150 %%p0.3") && !b.dxf.includes("130 %%p0.3"));
  check("change: R1 reads 22k in the schematic SVG, the .net and the .kicad_sch", /22k/.test(b.sch) && b.kicadNet.includes('(value "22k")') && b.kicadSch.includes('"22k"') && !/>10k</.test(b.sch.match(/data-ref="R1"[\s\S]*?<\/g>/)[0]));
  check("change: the noise budget and the spec sheet follow R", b.R.phys.v.eR > a.R.phys.v.eR * 1.4 && b.spec.budget[0].value !== a.spec.budget[0].value);
  check("change: the model hash, title block and KiCad comment all move", a.R.hash !== b.R.hash && b.svg.includes(b.R.hash) && b.kicadSch.includes(b.R.hash) && b.kicadNet.includes(b.R.hash));
  const p0 = artefacts("polariscope"), p1 = artefacts("polariscope", { theta: 55, P: 120 });
  check("change: analyser 30 to 55 degrees turns the drawn angle and the optical-train value", p1.BP.dims.find((d) => d.id === "theta").text.startsWith("55°") && /analyser 55 deg/.test(p1.sch) && p0.BP.dims.find((d) => d.id === "theta").text.startsWith("30°"));
  check("change: load 50 to 120 N raises the centre fringe order 2.4 times", Math.abs(p1.R.phys.v.n0 / p0.R.phys.v.n0 - 2.4) < 1e-9);
  const r1 = artefacts("room", { L: 6 });
  check("change: room length 5 to 6 m moves the L dimension, the mode count and the volume", r1.BP.dims.find((d) => d.id === "L").text === "6000 ±10" && r1.R.phys.v.n > artefacts("room").R.phys.v.n);
}

/* planted errors must be refused */
{
  const inst = C.REG.jnt, p = C.defaults(inst), B0 = inst.build(p);
  const B1 = clone(B0); B1.parts[0].label = "";
  planted("a part with no label validates", C.validate(B1).length === 0);
  check("a part with no label is refused, and the error names it", C.validate(B1).some((s) => /part enc: no label/.test(s)));
  const B2 = clone(B0); B2.netlist.nets.push({ name: "STRAY" }); B2.netlist.components.find((c) => c.ref === "J4").pins["1"] = "STRAY";
  planted("a dangling net (one pin) validates", C.validate(B2).length === 0);
  check("a dangling net is refused by name", C.validate(B2).some((s) => /net STRAY: dangling, 1 pin/.test(s)) && C.validate(B2).some((s) => /net INJ: dangling/.test(s)));
  const B3 = clone(B0); delete B3.drawing.dims[0].tol;
  planted("a dimension without a tolerance validates", C.validate(B3).length === 0);
  check("a dimension without a tolerance is refused", C.validate(B3).some((s) => /dimension W: no tolerance/.test(s)));
  const B4 = clone(B0); B4.items[0].parts = [];
  planted("a part in no parts-list item validates", C.validate(B4).length === 0);
  const B5 = clone(B0); delete B5.netlist.components.find((c) => c.ref === "K3").pins["2"];
  planted("an unwired pin validates", C.validate(B5).length === 0);
  const B6 = clone(B0); B6.items.find((i) => i.item === 7).pnStatus = undefined;
  planted("a part number with no verification status validates", C.validate(B6).length === 0);
  const A = artefacts("jnt"), S = C.parseKicadSch(A.kicadSch), w = S.wires.find((x) => Math.abs(x.a[1] - x.b[1]) < 1e-9);
  const lab = S.labels.find((l) => l.name !== "IN"); S.labels.push({ name: "IN", at: lab.at });
  planted("a schematic with two nets joined by a stray label passes the round trip", C.checkConnectivity(A.R, S).length === 0);
  const S2 = C.parseKicadSch(A.kicadSch); S2.wires.splice(S2.wires.indexOf(S2.wires.find((x) => x)), 1);
  planted("a schematic with a wire deleted passes the round trip", C.checkConnectivity(A.R, S2).length === 0);
  const P = C.parseDXF(A.dxf); P.entities[40] = Object.assign({}, P.entities[40]); if (P.entities[40].a) P.entities[40].a = [P.entities[40].a[0] + 0.01, P.entities[40].a[1]]; else if (P.entities[40].at) P.entities[40].at = [P.entities[40].at[0] + 0.01, P.entities[40].at[1]]; else if (P.entities[40].pts) P.entities[40].pts = [[P.entities[40].pts[0][0] + 0.01, P.entities[40].pts[0][1]], ...P.entities[40].pts.slice(1)];
  planted("a DXF with one coordinate moved 0.01 mm passes the round trip", dxfSame(A.BP.sheet, P).length === 0);
  const pipe = clone(pipeline("jnt")); pipe.stages[0].spec.wall_assumptions.push({ assumption: "the moon is not in the band", how_checked: "x", if_broken: "y" });
  planted("an assumption with no optional flag reaches the spec sheet unrefused", C.specSheet(A.R, pipe).problems.length === 0);
  planted("the box parameter outside its range resolves cleanly", C.resolve(inst, { encW: 90 }).problems.length === 0);
  check("a box too narrow for the battery packs is refused as a fit", C.resolve(inst, { encW: 90 }).problems.some((s) => /fit: battery packs/.test(s)));
}

/* one record per instrument: the CAD model and the pipeline example both agree with packages/instruments/records */
{
  const { record } = require("../cad/load.js");
  const wall = (a) => ({ assumption: a.assumption, how_checked: a.how_checked, if_broken: a.if_broken });
  const agree = (id, inst, rec, pipe) => {
    const bad = [];
    if (inst.id !== rec.id || inst.title !== rec.name) bad.push("name");
    for (const q of inst.params) { const d = rec.design[q.id]; if (!d || d.value !== q.value || d.unit !== q.unit) bad.push("param " + q.id); }
    for (const k of Object.keys(rec.design)) if (!inst.params.some((q) => q.id === k)) bad.push("record value " + k + " has no control");
    if (JSON.stringify(inst.fixed || {}) !== JSON.stringify(rec.fixed || {})) bad.push("fixed");
    if (pipe.id !== rec.pipeline_id || pipe.name !== rec.name || pipe.atlas_id !== rec.atlas_id || pipe.summary !== rec.summary) bad.push("pipeline identity");
    const st1 = pipe.stages.find((s) => s.stage === 1);
    if (JSON.stringify(st1.spec.wall_assumptions) !== JSON.stringify(rec.assumptions.map(wall))) bad.push("pipeline stage-1 assumptions");
    if (rec.views.pipeline_example !== "examples/" + inst.pipeline) bad.push("pipeline file");
    return bad;
  };
  for (const id of IDS) {
    const inst = C.REG[id], rec = record(id), bad = agree(id, inst, rec, pipeline(id));
    check(`${id}: the CAD model and the pipeline example agree with the instrument record`, !bad.length, bad.join("; "));
  }
  const rec = clone(record("jnt")); rec.design.R.value = 22000;
  planted("a record whose resistor differs from the CAD default agrees", agree("jnt", C.REG.jnt, rec, pipeline("jnt")).length === 0);
  const pipe = clone(pipeline("room")); pipe.stages[0].spec.wall_assumptions[0].how_checked += " (edited)";
  planted("a pipeline example with an edited assumption agrees with its record", agree("room", C.REG.room, record("room"), pipe).length === 0);
}

/* mesh: the open-top tray is one closed solid */
{
  const vol = D.meshVolume(Float64Array.from(D.build({ t: "tray", size: [4, 2, 3], wall: 0.2 }).pos));
  check("tray volume equals the box minus its cavity", Math.abs(vol - (24 - 3.6 * 1.8 * 2.6)) < 1e-12, vol);
  check("tray cut across its walls: the rim frame's area", Math.abs(D.section(Float64Array.from(D.build({ t: "tray", size: [4, 2, 3], wall: 0.2 }).pos), [0, 1, 0], 0).area - (12 - 3.6 * 2.6)) < 1e-12);
}

console.log(`cad layer: ${out.pass} pass, ${out.fail} fail, planted ${out.planted_rejected} rejected, ${out.planted_accepted} accepted`);
const j = process.argv.indexOf("--json");
if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(Object.assign({ date: new Date().toISOString().slice(0, 10) }, out), null, 1));
process.exit(out.fail || out.planted_accepted ? 1 : 0);
