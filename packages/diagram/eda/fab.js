// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Fab outputs for a routed board, every one written and read back here: Gerber RS-274X per layer, Excellon drill,
   pick-and-place and BOM CSV, a board-outline DXF (through the CAD layer's own DXF writer and reader), and the
   comparison of each copper Gerber, rendered back to pixels, with the board view rasterised from the geometry. */
"use strict";
const { C, E } = require("./load.js");

const near = (a, b, tol = 6e-7) => Math.abs(a - b) <= tol;   /* half a 1 nm format step plus float noise */
const samePt = (p, q) => near(p[0], q[0]) && near(p[1], q[1]);
const apSame = (a, b) => a.kind === b.kind && near(a.w, b.w) && near(a.h, b.h);

/* written primitives against parsed ones, in order; returns a list of differences */
const primDiff = (W, P) => {
  if (W.length !== P.length) return [`count ${W.length} written, ${P.length} read`];
  const bad = [];
  W.forEach((w, i) => {
    const p = P[i];
    if (w.type !== p.type) { bad.push(`#${i} type ${w.type} read as ${p.type}`); return; }
    if (w.type === "flash" && !(samePt(w.at, p.at) && apSame(w.ap, p.ap))) bad.push(`#${i} flash moved or changed aperture`);
    if (w.type === "stroke" && !(samePt(w.a, p.a) && samePt(w.b, p.b) && near(w.ap.w, p.ap.w))) bad.push(`#${i} stroke moved`);
    if (w.type === "region" && !(w.pts.length === p.pts.length && w.pts.every((q, k) => samePt(q, p.pts[k])))) bad.push(`#${i} region vertices changed`);
  });
  return bad;
};

const boardDXF = (B, holes) => {
  const Ent = [], o = [[0, 0], [B.w, 0], [B.w, B.h], [0, B.h]];
  o.forEach((p, i) => Ent.push({ t: "line", layer: "OUTLINE", a: p, b: o[(i + 1) % 4] }));
  for (const h of holes) Ent.push({ t: "circle", layer: "CENTER", c: h.at, r: h.d / 2 });
  for (const P of B.parts) { const c = E.courtyard(P.fp, P.at, P.rot, 0); Ent.push({ t: "poly", layer: "HIDDEN", closed: true, pts: [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]] }); Ent.push({ t: "text", layer: "TEXT", at: [c[0], c[3] + 0.4], h: 0.8, s: P.ref }); }
  return { w: B.w, h: B.h, E: Ent };
};

/* every file as text, plus the round-trip results */
const writeAll = (B, meta = {}) => {
  const fab = (B.fab = E.fabLayers(B)), files = {}, trips = [];
  for (const [name, prims] of Object.entries(fab)) {
    const txt = E.toGerber(name, prims, meta), P = E.parseGerber(txt), d = primDiff(prims, P.prims);
    files[`${B.id}-${name}.gbr`] = txt;
    trips.push({ file: `${B.id}-${name}.gbr`, kind: "gerber", prims: prims.length, ok: !d.length, diff: d.slice(0, 3), fileFunction: P.attrs.FileFunction });
  }
  const holes = E.holes(B), drl = E.toExcellon(holes, meta), X = E.parseExcellon(drl);
  const hOk = X.holes.length === holes.length && holes.every((h) => X.holes.some((q) => near(q.at[0], h.at[0], 5e-4) && near(q.at[1], h.at[1], 5e-4) && near(q.d, h.d, 5e-4)));
  files[`${B.id}.drl`] = drl; trips.push({ file: `${B.id}.drl`, kind: "excellon", holes: holes.length, tools: Object.keys(X.tools).length, ok: hOk });
  const pnp = E.toPnP(B), PP = E.parsePnP(pnp);
  const pOk = PP.length === B.parts.length && B.parts.every((P) => PP.some((r) => r.Designator === P.ref && near(+r["Mid X (mm)"], P.at[0], 5e-5) && near(+r["Mid Y (mm)"], P.at[1], 5e-5) && +r.Rotation === P.rot && r.Value === P.value));
  files[`${B.id}-pnp.csv`] = pnp; trips.push({ file: `${B.id}-pnp.csv`, kind: "pick-and-place", rows: PP.length, ok: pOk });
  const bom = E.toBOM(B), BB = E.parseBOM(bom), refs = BB.flatMap((r) => r.Designators.split(" "));
  const bOk = refs.length === B.parts.length && B.parts.every((P) => refs.includes(P.ref)) && BB.every((r) => +r.Qty === r.Designators.split(" ").length);
  files[`${B.id}-bom.csv`] = bom; trips.push({ file: `${B.id}-bom.csv`, kind: "bom", rows: BB.length, ok: bOk });
  const sheet = boardDXF(B, holes), dxf = C.toDXF(sheet), DP = C.parseDXF(dxf);
  const dOk = DP.entities.length === sheet.E.length && sheet.E.every((e, i) => DP.entities[i].t === e.t && DP.entities[i].layer === e.layer);
  files[`${B.id}-board.dxf`] = dxf; trips.push({ file: `${B.id}-board.dxf`, kind: "dxf", entities: DP.entities.length, ok: dOk });
  return { files, trips, fab, holes };
};

/* board view (geometry) against Gerber (rendered back) for one copper layer */
const compareLayer = (B, gerberTxt, L, ppm = 25) => {
  const win = [0, 0, B.w, B.h], shapes = E.copper(B).filter((o) => o.layers.includes(L) && (L === 0 || o.kind !== "bridge"));
  const view = E.rasterShapes(shapes, win, ppm), back = E.rasterPrims(E.parseGerber(gerberTxt).prims, win, ppm);
  return Object.assign({ view, back }, E.compareMasks(view, back));
};

module.exports = { writeAll, compareLayer, primDiff, boardDXF };
