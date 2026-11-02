// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/kicad: the schematic and netlist in KiCad's own formats, written and read back here because KiCad
   is not installed. .kicad_sch is the KiCad 8 s-expression schematic (version 20231120) with its symbols
   embedded in lib_symbols, so it opens without our library; .net is the KiCad "E" netlist the board editor
   imports. The reader re-derives connectivity from geometry alone (pin ends, wire ends, a point on a wire,
   labels by name, power symbols by value), the way the schematic editor does, and compares it with the
   netlist. Optical nets are left out: light does not go to a board. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});
  const Q = (s) => ({ q: String(s) });
  C.sQ = Q;

  /* write: arrays are lists, {q} is a quoted string, numbers and bare strings are atoms */
  C.sexpr = (x, ind = "") => {
    if (!Array.isArray(x)) return typeof x === "object" ? '"' + x.q.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"' : typeof x === "number" ? String(Math.round(x * 1e4) / 1e4) : String(x);
    const deep = x.some((y) => Array.isArray(y) && y.some(Array.isArray));
    if (!deep) return "(" + x.map((y) => C.sexpr(y, ind)).join(" ") + ")";
    /* order is kept: an atom stays on the line it follows, each list starts a new line */
    return "(" + x.map((y, i) => (i === 0 ? C.sexpr(y) : Array.isArray(y) ? "\n" + ind + "  " + C.sexpr(y, ind + "  ") : " " + C.sexpr(y))).join("") + ")";
  };
  /* read: lists become arrays, every atom and string becomes a JS string */
  C.sparse = (txt) => {
    let i = 0;
    const ws = () => { while (i < txt.length && /\s/.test(txt[i])) i++; };
    const item = () => {
      ws();
      if (txt[i] === "(") { i++; const L = []; for (;;) { ws(); if (txt[i] === ")") { i++; return L; } if (i >= txt.length) throw new Error("s-expression: unclosed list"); L.push(item()); } }
      if (txt[i] === '"') { i++; let s = ""; while (txt[i] !== '"') { if (i >= txt.length) throw new Error("s-expression: unclosed string"); if (txt[i] === "\\") { i++; s += txt[i] === "n" ? "\n" : txt[i]; } else s += txt[i]; i++; } i++; return s; }
      let s = ""; while (i < txt.length && !/[\s()]/.test(txt[i])) s += txt[i++]; return s;
    };
    const top = item(); ws();
    if (i < txt.length) throw new Error("s-expression: trailing text");
    return top;
  };
  C.sFind = (L, name) => L.find((y) => Array.isArray(y) && y[0] === name);
  C.sAll = (L, name) => L.filter((y) => Array.isArray(y) && y[0] === name);

  C.uuid = (seed) => { const h = C.hashText(seed) + C.hashText(seed + "#"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
  const font = (sz = 1.27) => ["effects", ["font", ["size", sz, sz]]];
  const hidden = () => ["effects", ["font", ["size", 1.27, 1.27]], "hide"];
  const stroke = (w = 0.254) => ["stroke", ["width", w], ["type", "default"]];
  const libName = (s) => (C.SYM[s].power ? "instr_pwr:" : "instr:") + s;

  const libSymbol = (id, S, powerNet) => {
    const short = id.split(":")[1], L = ["symbol", Q(id)];
    if (S.power) L.push(["power"]);
    if (S.power || ["R", "C", "NT"].includes(id.split(":")[1])) L.push(["pin_numbers", "hide"]);
    L.push(S.power ? ["pin_names", ["offset", 0], "hide"] : ["pin_names", ["offset", 0.508]], ["exclude_from_sim", "no"], ["in_bom", S.power ? "no" : "yes"], ["on_board", "yes"]);
    L.push(["property", Q("Reference"), Q(S.refp), ["at", 0, 0, 0], S.power ? hidden() : font()], ["property", Q("Value"), Q(powerNet || short), ["at", 0, 0, 0], font()]);
    L.push(["property", Q("Footprint"), Q(""), ["at", 0, 0, 0], hidden()], ["property", Q("Datasheet"), Q("~"), ["at", 0, 0, 0], hidden()], ["property", Q("Description"), Q(S.desc), ["at", 0, 0, 0], hidden()]);
    S.units.forEach((U, ui) => {
      const u = ["symbol", Q(`${short}_${ui + 1}_1`)];
      for (const b of U.body) {
        if (b.rect) u.push(["rectangle", ["start", b.rect[0], b.rect[1]], ["end", b.rect[2], b.rect[3]], stroke(), ["fill", ["type", b.fill ? "outline" : "none"]]]);
        if (b.poly) u.push(["polyline", ["pts", ...b.poly.map((p) => ["xy", p[0], p[1]])], stroke(), ["fill", ["type", "none"]]]);
        if (b.circle) u.push(["circle", ["center", b.circle[0], b.circle[1]], ["radius", b.circle[2]], stroke(), ["fill", ["type", "none"]]]);
        if (b.text) u.push(["text", Q(b.text[2]), ["at", b.text[0], b.text[1], 0], font()]);
      }
      for (const p of U.pins) {
        const pin = ["pin", p.type, "line", ["at", p.at[0], p.at[1], p.ang], ["length", p.len]];
        if (S.power) pin.push("hide");
        pin.push(["name", Q(S.power ? powerNet : p.name), font()], ["number", Q(p.num), font()]);
        u.push(pin);
      }
      L.push(u);
    });
    return L;
  };

  C.toKicadSch = (R, SC) => {
    const proj = R.inst.id, root = C.uuid(proj + R.hash + "root"), U = (s) => ["uuid", Q(C.uuid(proj + R.hash + s))];
    const libs = new Map();
    for (const s of SC.syms) libs.set(libName(s.sym), libSymbol(libName(s.sym), C.SYM[s.sym]));
    for (const p of SC.power) { const id = "instr_pwr:" + p.net; if (!libs.has(id)) libs.set(id, libSymbol(id, C.SYM[p.sym], p.net)); }
    const top = ["kicad_sch", ["version", 20231120], ["generator", Q("diagram_cad")], ["generator_version", Q("0.1")], ["uuid", Q(root)], ["paper", Q("A3")],
      ["title_block", ["title", Q(SC.title)], ["date", Q("2026-10-31")], ["rev", Q("A")], ["company", Q(R.inst.owner || "Zain Dana Harper")], ["comment", 1, Q("model hash " + R.hash)], ["comment", 2, Q("generated from the parametric model; nothing ordered")]],
      ["lib_symbols", ...libs.values()]];
    SC.junctions.forEach((j, i) => top.push(["junction", ["at", j.at[0], j.at[1]], ["diameter", 0], ["color", 0, 0, 0, 0], U("j" + i)]));
    SC.noconn.forEach((n, i) => top.push(["no_connect", ["at", n.at[0], n.at[1]], U("nc" + i)]));
    SC.wires.forEach((w, i) => top.push(["wire", ["pts", ["xy", w.a[0], w.a[1]], ["xy", w.b[0], w.b[1]]], ["stroke", ["width", 0], ["type", "default"]], U("w" + i)]));
    SC.labels.forEach((L, i) => top.push(["label", Q(L.net), ["at", L.at[0], L.at[1], L.ang], ["fields_autoplaced", "yes"], ["effects", ["font", ["size", 1.27, 1.27]], ["justify", L.ang === 180 || L.ang === 270 ? "right" : "left", "bottom"]], U("l" + i)]));
    const inst = (ref, unit) => ["instances", ["project", Q(proj), ["path", Q("/" + root), ["reference", Q(ref)], ["unit", unit]]]];
    SC.syms.forEach((s) => {
      const c = s.comp;
      top.push(["symbol", ["lib_id", Q(libName(s.sym))], ["at", s.at[0], s.at[1], s.rot], ["unit", s.unit], ["exclude_from_sim", "no"], ["in_bom", "yes"], ["on_board", "yes"], ["dnp", "no"], U("s" + s.key),
        ["property", Q("Reference"), Q(s.ref), ["at", s.at[0] + 2.54, s.at[1] - 1.27, 0], font()], ["property", Q("Value"), Q(s.value), ["at", s.at[0] + 2.54, s.at[1] + 1.27, 0], font()],
        ["property", Q("Footprint"), Q(c.fp || ""), ["at", s.at[0], s.at[1], 0], hidden()], ["property", Q("Datasheet"), Q("~"), ["at", s.at[0], s.at[1], 0], hidden()],
        ["property", Q("Description"), Q(c.desc || C.SYM[s.sym].desc), ["at", s.at[0], s.at[1], 0], hidden()], ["property", Q("PN"), Q(c.pn ? c.pn + (c.pnStatus ? " (" + c.pnStatus + ")" : "") : ""), ["at", s.at[0], s.at[1], 0], hidden()],
        ...s.pins.map((p) => ["pin", Q(p.num), U("p" + s.key + "." + p.num)]), inst(s.ref, s.unit)]);
    });
    SC.power.forEach((p, i) => {
      const ref = "#PWR" + String(i + 1).padStart(3, "0");
      top.push(["symbol", ["lib_id", Q("instr_pwr:" + p.net)], ["at", p.at[0], p.at[1], p.rot], ["unit", 1], ["exclude_from_sim", "no"], ["in_bom", "no"], ["on_board", "yes"], ["dnp", "no"], U("pw" + i),
        ["property", Q("Reference"), Q(ref), ["at", p.at[0], p.at[1], 0], hidden()], ["property", Q("Value"), Q(p.net), ["at", p.at[0], p.at[1] + 3.2, 0], font()],
        ["property", Q("Footprint"), Q(""), ["at", p.at[0], p.at[1], 0], hidden()], ["property", Q("Datasheet"), Q(""), ["at", p.at[0], p.at[1], 0], hidden()], ["pin", Q("1"), U("pwp" + i)], inst(ref, 1)]);
    });
    top.push(["sheet_instances", ["path", Q("/"), ["page", Q("1")]]]);
    return C.sexpr(top) + "\n";
  };

  /* KiCad "E" netlist from the model's netlist (electrical nets only). Local nets carry the sheet path "/". */
  C.netName = (n) => (n.power ? n.name : "/" + n.name);
  C.toKicadNet = (R) => {
    const N = R.B.netlist, elec = N.nets.filter((n) => n.kind !== "optical"), comps = N.components.filter((c) => !C.SYM[c.sym].optical);
    const top = ["export", ["version", Q("E")],
      ["design", ["source", Q(R.inst.id + ".kicad_sch")], ["date", Q("2026-10-31")], ["tool", Q("diagram_cad 0.1")], ["sheet", ["number", Q("1")], ["name", Q("/")], ["tstamps", Q("/")],
        ["title_block", ["title", Q(R.B.sch.title || R.inst.title)], ["company", Q(R.inst.owner || "Zain Dana Harper")], ["rev", Q("A")], ["date", Q("2026-10-31")], ["source", Q(R.inst.id + ".kicad_sch")], ["comment", ["number", Q("1")], ["value", Q("model hash " + R.hash)]]]]],
      ["components", ...comps.map((c) => ["comp", ["ref", Q(c.ref)], ["value", Q(c.value)], ["footprint", Q(c.fp || "")], ["datasheet", Q("~")], ["description", Q(c.desc || C.SYM[c.sym].desc)],
        ["fields", ["field", ["name", Q("PN")], Q(c.pn ? c.pn + (c.pnStatus ? " (" + c.pnStatus + ")" : "") : "")]],
        ["libsource", ["lib", Q("instr")], ["part", Q(c.sym)], ["description", Q(C.SYM[c.sym].desc)]], ["sheetpath", ["names", Q("/")], ["tstamps", Q("/")]], ["tstamps", Q(C.uuid(R.inst.id + R.hash + "s" + c.ref + (C.SYM[c.sym].units.length > 1 ? ":1" : "")))]])],
      ["libparts", ...[...new Set(comps.map((c) => c.sym))].map((s) => ["libpart", ["lib", Q("instr")], ["part", Q(s)], ["description", Q(C.SYM[s].desc)], ["pins", ...C.symPins(C.SYM[s]).map((p) => ["pin", ["num", Q(p.num)], ["name", Q(p.name)], ["type", Q(p.type)]])]])],
      ["libraries"],
      ["nets", ...elec.map((n, i) => ["net", ["code", Q(String(i + 1))], ["name", Q(C.netName(n))], ...comps.flatMap((c) => Object.entries(c.pins).filter(([, v]) => v === n.name).map(([k]) => ["node", ["ref", Q(c.ref)], ["pin", Q(k)], ["pintype", Q(C.symPins(C.SYM[c.sym]).find((p) => p.num === k).type)]]))])]];
    return C.sexpr(top) + "\n";
  };

  C.parseKicadNet = (txt) => {
    const T = C.sparse(txt);
    if (T[0] !== "export") throw new Error("not a KiCad netlist");
    const comps = C.sAll(C.sFind(T, "components"), "comp").map((c) => ({ ref: C.sFind(c, "ref")[1], value: C.sFind(c, "value")[1], footprint: (C.sFind(c, "footprint") || [])[1] || "", part: C.sFind(C.sFind(c, "libsource"), "part")[1] }));
    const nets = C.sAll(C.sFind(T, "nets"), "net").map((n) => ({ code: C.sFind(n, "code")[1], name: C.sFind(n, "name")[1], nodes: C.sAll(n, "node").map((x) => ({ ref: C.sFind(x, "ref")[1], pin: C.sFind(x, "pin")[1] })) }));
    return { version: C.sFind(T, "version")[1], components: comps, nets };
  };

  /* Read a .kicad_sch and rebuild which pins join which, from geometry and names only. */
  C.parseKicadSch = (txt) => {
    const T = C.sparse(txt);
    if (T[0] !== "kicad_sch") throw new Error("not a KiCad schematic");
    const libs = new Map();
    for (const L of C.sAll(C.sFind(T, "lib_symbols"), "symbol")) {
      const id = L[1], units = new Map(), power = !!C.sFind(L, "power");
      for (const u of C.sAll(L, "symbol")) {
        const m = /_(\d+)_(\d+)$/.exec(u[1]), unit = +m[1];
        const pins = C.sAll(u, "pin").map((p) => ({ num: C.sFind(p, "number")[1], name: C.sFind(p, "name")[1], at: [+C.sFind(p, "at")[1], +C.sFind(p, "at")[2]] }));
        units.set(unit, (units.get(unit) || []).concat(pins));
      }
      libs.set(id, { power, units });
    }
    const prop = (s, k) => { const p = C.sAll(s, "property").find((q) => q[1] === k); return p ? p[2] : undefined; };
    const symbols = C.sAll(T, "symbol").map((s) => { const at = C.sFind(s, "at"); return { lib: C.sFind(s, "lib_id")[1], at: [+at[1], +at[2]], rot: +(at[3] || 0), unit: +C.sFind(s, "unit")[1], ref: prop(s, "Reference"), value: prop(s, "Value") }; });
    const wires = C.sAll(T, "wire").map((w) => { const p = C.sAll(C.sFind(w, "pts"), "xy"); return { a: [+p[0][1], +p[0][2]], b: [+p[1][1], +p[1][2]] }; });
    const labels = C.sAll(T, "label").map((l) => ({ name: l[1], at: [+C.sFind(l, "at")[1], +C.sFind(l, "at")[2]] }));
    const junctions = C.sAll(T, "junction").map((j) => [+C.sFind(j, "at")[1], +C.sFind(j, "at")[2]]);
    const noconn = C.sAll(T, "no_connect").map((j) => [+C.sFind(j, "at")[1], +C.sFind(j, "at")[2]]);
    return { version: C.sFind(T, "version")[1], libs, symbols, wires, labels, junctions, noconn, title: (C.sFind(C.sFind(T, "title_block") || [], "title") || [])[1] };
  };

  /* Union-find over points: returns { group(pinKey), names(groupId) } and per-pin keys "REF.PIN". */
  C.kicadConnectivity = (P) => {
    const par = new Map(), find = (x) => { while (par.get(x) !== x) { par.set(x, par.get(par.get(x))); x = par.get(x); } return x; };
    const node = (k) => { if (!par.has(k)) par.set(k, k); return k; }, join = (a, b) => { const x = find(node(a)), y = find(node(b)); if (x !== y) par.set(x, y); };
    const pk = (p) => "P" + Math.round(p[0] * 1e3) + "," + Math.round(p[1] * 1e3);
    const points = [];
    for (const w of P.wires) { join(pk(w.a), pk(w.b)); points.push(w.a, w.b); }
    const pins = [];
    for (const s of P.symbols) {
      const L = P.libs.get(s.lib);
      if (!L) throw new Error("schematic: symbol " + s.ref + " uses " + s.lib + ", not in lib_symbols");
      for (const q of (L.units.get(s.unit) || []).concat(s.unit !== 0 ? L.units.get(0) || [] : [])) {
        const p = C.libToSheet(s.at, s.rot, q.at);
        node(pk(p)); points.push(p);
        if (L.power) join(pk(p), "N" + s.value); else pins.push({ key: s.ref + "." + q.num, p });
      }
    }
    for (const L of P.labels) { join(pk(L.at), "N" + L.name); points.push(L.at); }
    for (const p of points) for (const w of P.wires) if (C.onSeg(p, w.a, w.b)) join(pk(p), pk(w.a));
    const group = new Map(pins.map((q) => [q.key, find(pk(q.p))]));
    const names = new Map();
    for (const k of par.keys()) if (k[0] === "N") { const r = find(k); names.set(r, (names.get(r) || []).concat(k.slice(1))); }
    return { group, names, pins };
  };

  /* Compare a parsed schematic's connectivity with the model's netlist. Returns a list of problems. */
  C.checkConnectivity = (R, P) => {
    const N = R.B.netlist, K = C.kicadConnectivity(P), bad = [], seen = new Map();
    for (const n of N.nets) {
      if (n.kind === "optical") continue;
      const keys = N.components.flatMap((c) => Object.entries(c.pins).filter(([, v]) => v === n.name).map(([k]) => c.ref + "." + k));
      const gs = new Set(keys.map((k) => K.group.get(k)));
      if (keys.some((k) => !K.group.has(k))) bad.push(`net ${n.name}: a pin is missing from the schematic`);
      if (gs.size !== 1) bad.push(`net ${n.name}: split into ${gs.size} pieces`);
      for (const gid of gs) { if (seen.has(gid) && seen.get(gid) !== n.name) bad.push(`nets ${seen.get(gid)} and ${n.name} are joined`); seen.set(gid, n.name); }
      const nm = K.names.get([...gs][0]) || [];
      if (nm.some((x) => x !== n.name)) bad.push(`net ${n.name}: carries the name(s) ${nm.join(", ")}`);
    }
    return bad;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);
