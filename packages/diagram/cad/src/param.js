// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/param: the parametric instrument model, one source of truth. An instrument is a list of parameters
   and a build(p) that returns parts (geometry in millimetres, material, tolerances), the assembly tree, the
   bill-of-materials items, the netlist, the schematic placement and the drawing's dimensions. resolve() runs
   build() for one set of values and validates what comes back, so every view (3D, blueprint, schematic, BOM,
   spec sheet, exports) is drawn from the same resolved record. No dependencies beyond diagram/core and mesh. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});
  C.REG = C.REG || {};
  C.register = (inst) => { C.REG[inst.id] = inst; return inst; };
  C.defaults = (inst) => Object.fromEntries(inst.params.map((q) => [q.id, q.value]));
  /* One record per instrument (packages/instruments/records/ID.json) holds its name, design values, fixed values
     and stage-1 assumptions; the pipeline example and this CAD model both read it. In Node it is required from
     the instruments package; a built page inlines the records as globalThis.InstrumentRecords. */
  C.record = (id) => {
    if (g.InstrumentRecords && g.InstrumentRecords[id]) return g.InstrumentRecords[id];
    if (typeof module !== "undefined" && module.exports && typeof require === "function") return require("../../../instruments/records/" + id + ".json");
    throw new Error("instrument record " + id + " is not loaded");
  };
  /* Copy the record into a model: title, parameter defaults, fixed values and the assumption flags. A parameter
     the record does not hold is refused, so the model cannot carry a default the record lacks. */
  C.fromRecord = (inst, rec) => {
    inst.record = rec;
    inst.title = rec.name;
    inst.pipeline = rec.views.pipeline_example.split("/").pop();
    for (const q of inst.params) {
      const d = rec.design[q.id];
      if (!d) throw new Error(`${rec.id}: parameter ${q.id} is not in the record`);
      q.value = d.value; q.unit = d.unit; q.label = d.label;
    }
    if (rec.fixed && Object.keys(rec.fixed).length) inst.fixed = Object.assign({}, rec.fixed);
    inst.assumptions = rec.assumptions.map((a) => ({ match: a.assumption, optional: a.optional, door: a.door }));
    return inst;
  };

  /* Materials the engine did not map yet. */
  Object.assign(D.MATERIALS, {
    polycarbonate: { lib: "polycarbonate", alpha: 0.5, hatch: { angle: 90, gap: 7 } },
    gypsum: { tok: "wall2", hatch: { angle: 45, gap: 10 } },
    polariser: { tok: "s2", alpha: 0.55, hatch: { angle: 0, gap: 6 } },
  });

  /* A tolerance is explicit or the dimension is refused: plus-minus, unilateral, basic (GD&T), reference or limits. */
  C.hasTol = (t) => !!t && (t.pm !== undefined || (t.plus !== undefined && t.minus !== undefined) || t.basic === true || t.ref === true || (Array.isArray(t.limits) && t.limits.length === 2));
  C.PN_STATUS = ["unverified, from memory", "commodity", "ours", "existing device", "generic"];
  C.VIEW_NAMES = ["front", "top", "right", "iso", "section"];

  const blank = (s) => s === undefined || s === null || (typeof s === "string" && !s.trim());

  /* Every problem in a built record, as sentences. An empty list means it is fit to draw. */
  C.validate = (B) => {
    const bad = [], ids = new Set();
    if (!B || !Array.isArray(B.parts) || !B.parts.length) return ["instrument has no parts"];
    B.parts.forEach((p, i) => {
      for (const k of ["id", "label", "alt", "fn", "geom", "material"]) if (blank(p[k])) bad.push(`part ${p.id || "#" + i}: no ${k}`);
      if (p.id && ids.has(p.id)) bad.push(`part ${p.id}: duplicate id`);
      ids.add(p.id);
      if (p.material && !D.MATERIALS[p.material]) bad.push(`part ${p.id}: material ${p.material} is not in the engine's table`);
    });
    /* BOM items: every part in exactly one item; part numbers carry their status */
    const inItem = new Map();
    for (const it of B.items || []) {
      if (blank(it.desc)) bad.push(`BOM item ${it.item}: no description`);
      if (!it.parts || !it.parts.length) bad.push(`BOM item ${it.item}: no parts`);
      for (const pid of it.parts || []) { if (!ids.has(pid)) bad.push(`BOM item ${it.item}: no part ${pid}`); if (inItem.has(pid)) bad.push(`part ${pid}: in BOM items ${inItem.get(pid)} and ${it.item}`); inItem.set(pid, it.item); }
      if (it.pn && !C.PN_STATUS.includes(it.pnStatus)) bad.push(`BOM item ${it.item}: part number ${it.pn} has no status`);
    }
    for (const id of ids) if (!inItem.has(id)) bad.push(`part ${id}: in no BOM item`);
    /* assembly tree: every part exactly once */
    const seen = new Map();
    const walk = (n, path) => {
      if (typeof n === "string") { if (!ids.has(n)) bad.push(`assembly ${path}: no part ${n}`); seen.set(n, (seen.get(n) || 0) + 1); return; }
      if (blank(n.label)) bad.push(`assembly node ${n.id || path}: no label`);
      for (const c of n.children || []) walk(c, path + "/" + (n.id || "?"));
    };
    if (B.assembly) walk(B.assembly, ""); else bad.push("no assembly tree");
    for (const id of ids) if (seen.get(id) !== 1) bad.push(`part ${id}: appears ${seen.get(id) || 0} times in the assembly tree`);
    bad.push(...C.validateNetlist(B.netlist, ids));
    /* dimensions */
    for (const dm of (B.drawing && B.drawing.dims) || []) {
      const tag = `dimension ${dm.id}`;
      if (!C.hasTol(dm.tol)) bad.push(`${tag}: no tolerance`);
      if (!C.VIEW_NAMES.includes(dm.view)) bad.push(`${tag}: no view ${dm.view}`);
      for (const ref of [dm.part, dm.a && dm.a.part, dm.b && dm.b.part]) if (ref && !ids.has(ref)) bad.push(`${tag}: no part ${ref}`);
      if (typeof dm.expect !== "number" || !isFinite(dm.expect)) bad.push(`${tag}: no model value to check against`);
    }
    for (const f of B.fits || []) if (!f.ok) bad.push(`fit: ${f.what} (needs ${f.need}, has ${f.have})`);
    return bad;
  };

  /* Netlist: symbols exist, every pin is wired or marked NC, every net has two or more pins (no dangling net). */
  C.validateNetlist = (N, ids) => {
    const bad = [];
    if (!N) return bad;
    const nets = new Map((N.nets || []).map((n) => [n.name, 0])), refs = new Set();
    for (const c of N.components || []) {
      const S = C.SYM && C.SYM[c.sym];
      if (refs.has(c.ref)) bad.push(`component ${c.ref}: duplicate reference`);
      refs.add(c.ref);
      if (blank(c.value)) bad.push(`component ${c.ref}: no value`);
      if (!S) { bad.push(`component ${c.ref}: no symbol ${c.sym}`); continue; }
      if (ids && c.part && !ids.has(c.part)) bad.push(`component ${c.ref}: no 3D part ${c.part}`);
      for (const pin of C.symPins(S)) {
        const net = c.pins[pin.num];
        if (net === undefined) bad.push(`component ${c.ref}: pin ${pin.num} (${pin.name}) is not wired and not marked NC`);
        else if (net !== "NC") { if (!nets.has(net)) bad.push(`component ${c.ref}: pin ${pin.num} on undeclared net ${net}`); else nets.set(net, nets.get(net) + 1); }
      }
      for (const k of Object.keys(c.pins)) if (!C.symPins(S).some((q) => q.num === k)) bad.push(`component ${c.ref}: symbol ${c.sym} has no pin ${k}`);
    }
    for (const [n, k] of nets) if (k < 2) bad.push(`net ${n}: dangling, ${k} pin${k === 1 ? "" : "s"}`);
    return bad;
  };

  /* All pins of a symbol, every unit. */
  C.symPins = (S) => S.units.flatMap((u, i) => u.pins.map((p) => Object.assign({ unit: i + 1 }, p)));

  /* Scale a geometry record by k (millimetres to engine units for the 3D view). */
  C.scaleGeom = (gm, k) => {
    const o = Object.assign({}, gm), s = (x) => (x === undefined ? x : x * k);
    if (gm.size) o.size = gm.size.map((x) => x * k);
    for (const key of ["r", "r0", "r2", "h", "wall", "depth"]) if (gm[key] !== undefined) o[key] = s(gm[key]);
    if (gm.profile) o.profile = gm.profile.map((q) => [q[0] * k, q[1] * k]);
    if (gm.pos) o.pos = gm.pos.map((x) => x * k);
    if (gm.items) o.items = gm.items.map((it) => C.scaleGeom(it, k));
    return o;
  };

  /* One part's triangles in model millimetres, at its assembled pose. */
  C.partMesh = (p) => {
    const m = D.transformMesh(D.build(p.geom), D.euler(p.rot), p.pos || [0, 0, 0]);
    return { pos: Float64Array.from(m.pos) };
  };

  C.hashText = (s) => D.hash(typeof TextEncoder !== "undefined" ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, "utf8")));

  /* Resolve one parameter set: build, validate, solve the physics. */
  C.resolve = (inst, over) => {
    const p = Object.assign(C.defaults(inst), over || {}), problems = [];
    for (const q of inst.params) if (!(p[q.id] >= q.min && p[q.id] <= q.max)) problems.push(`parameter ${q.id} = ${p[q.id]} is outside ${q.min} to ${q.max}`);
    const B = inst.build(p);
    problems.push(...C.validate(B));
    const phys = inst.physics(p, B);
    const hash = C.hashText(inst.id + JSON.stringify(p));
    const R = { inst, p, B, phys, problems, hash, meshes: new Map() };
    R.mesh = (id) => { if (!R.meshes.has(id)) R.meshes.set(id, C.partMesh(B.parts.find((q) => q.id === id))); return R.meshes.get(id); };
    R.part = (id) => B.parts.find((q) => q.id === id);
    R.itemOf = (pid) => (B.items || []).find((it) => it.parts.includes(pid));
    R.compOf = (pid) => ((B.netlist && B.netlist.components) || []).find((c) => c.part === pid);
    return R;
  };

  /* The diagram engine's model definition for the 3D stage, in engine units. */
  C.diagDef = (R) => {
    const k = R.inst.scale3d, I = R.inst;
    return {
      id: I.id, title: I.title, camera: I.camera, cut: I.cut3d ? I.cut3d(R.p, k) : null,
      parts: R.B.parts.map((p) => ({ id: p.id, label: p.label, short: p.short || p.label, alt: p.alt, fn: p.fn, qty: p.qty || "", material: p.material,
        geom: C.scaleGeom(p.geom, k), pos: (p.pos || [0, 0, 0]).map((x) => x * k), rot: p.rot, noSchematic: true,
        explode: p.explode ? { axis: p.explode.axis, dist: p.explode.dist * k } : undefined })),
      links: [],
    };
  };

  /* Numbers: engineering prefixes for component values, plain decimals for drawings (ASME: no trailing zeros). */
  C.eng = (x, unit = "") => {
    if (x === 0) return "0" + unit;
    const P = [[1e9, "G"], [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "u"], [1e-9, "n"], [1e-12, "p"], [1e-15, "f"]];
    for (const [m, s] of P) if (Math.abs(x) >= m * 0.999999) return +(x / m).toPrecision(3) + s + unit;
    return x.toExponential(2) + unit;
  };
  C.dec = (x, places = 3) => { const s = (+x).toFixed(places).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""); return s === "-0" ? "0" : s; };
  C.ascii = (s) => String(s).replace(/[−–—]/g, "-").replace(/Ω/g, "Ohm").replace(/[µμ]/g, "u").replace(/[^\x20-\x7e±Ø°]/g, "?");

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);
