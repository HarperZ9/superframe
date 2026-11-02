// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/sim/spice: a SPICE-format netlist, written and read here. It is the interchange path to any SPICE
   (and the differential check against ngspice when one happens to be installed). The op-amp macro is written as its
   expanded primitives, so the file needs no vendor model. Waves: DC, AC, PULSE-free step as PWL, SIN. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const S = (D.SIM = D.SIM || {});
  const num = (x) => (Number.isInteger(x) ? String(x) : x.toPrecision(12).replace(/\.?0+(e|$)/, "$1"));
  const nn = (s) => String(s).replace(/[^A-Za-z0-9_+\-.]/g, "_");
  const PFX = { R: "R", C: "C", L: "L", V: "V", I: "I", D: "D", E: "E", G: "G", S: "R" };

  S.toSpice = (elements, title = "diagram sim netlist") => {
    const L = ["* " + title];
    const flat = elements.flatMap((e) => (e.t === "OA" ? S.expandOA(e) : [e]));
    for (const e of flat) {
      const id = PFX[e.t] + "_" + nn(e.name), n = e.n.map(nn).join(" ");
      if (e.t === "R") L.push(`${id} ${n} ${num(e.R)}`);
      else if (e.t === "S") L.push(`${id} ${n} ${num(S.switchR(e, 0))}`);
      else if (e.t === "C") L.push(`${id} ${n} ${num(e.C)}`);
      else if (e.t === "L") L.push(`${id} ${n} ${num(e.L)}`);
      else if (e.t === "V" || e.t === "I") {
        let s = `${id} ${n} DC ${num(e.dc || 0)}`;
        if (e.ac) s += ` AC ${num(e.ac)}`;
        const w = e.wave;
        if (w && w.type === "step") s += ` PWL(0 ${num(w.v0 || 0)} ${num(w.t0 || 0)} ${num(w.v0 || 0)} ${num((w.t0 || 0) + (w.rise || 1e-12))} ${num(w.v1)})`;
        if (w && w.type === "sin") s += ` SIN(${num(w.vo || 0)} ${num(w.va)} ${num(w.f)})`;
        L.push(s);
      } else if (e.t === "D") L.push(`${id} ${n} DMOD_${nn(e.name)}`, `.model DMOD_${nn(e.name)} D(IS=${num(e.Is || 1e-14)} N=${num(e.N || 1)})`);
      else if (e.t === "E") L.push(`${id} ${n} ${e.c.map(nn).join(" ")} ${num(e.gain)}`);
      else if (e.t === "G") L.push(`${id} ${n} ${e.c.map(nn).join(" ")} ${num(e.gm)}`);
    }
    L.push(".end");
    return L.join("\n") + "\n";
  };

  const SUF = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
  S.spiceNum = (s) => {
    const m = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)(meg|[tgkmunpf])?/i.exec(s);
    if (!m) throw new Error("spice: not a number: " + s);
    return parseFloat(m[1]) * (m[2] ? SUF[m[2].toLowerCase()] : 1);
  };

  /* Read back the subset written above into elements (names lose their prefix, models are resolved). */
  S.parseSpice = (txt) => {
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("*")), models = {}, els = [];
    for (const l of lines) if (/^\.model/i.test(l)) {
      const m = /^\.model\s+(\S+)\s+D\s*\((.*)\)/i.exec(l), p = {};
      for (const kv of m[2].split(/\s+/)) { const [k, v] = kv.split("="); p[k.toUpperCase()] = S.spiceNum(v); }
      models[m[1]] = p;
    }
    for (const l of lines) {
      if (l.startsWith(".")) continue;
      const tok = l.split(/\s+/), id = tok[0], t = id[0].toUpperCase(), name = id.slice(2), n = [tok[1], tok[2]];
      if (t === "R") els.push({ t, name, n, R: S.spiceNum(tok[3]) });
      else if (t === "C") els.push({ t, name, n, C: S.spiceNum(tok[3]) });
      else if (t === "L") els.push({ t, name, n, L: S.spiceNum(tok[3]) });
      else if (t === "E" || t === "G") els.push(Object.assign({ t, name, n, c: [tok[3], tok[4]] }, t === "E" ? { gain: S.spiceNum(tok[5]) } : { gm: S.spiceNum(tok[5]) }));
      else if (t === "D") { const p = models[tok[3]]; els.push({ t, name, n, Is: p.IS, N: p.N }); }
      else if (t === "V" || t === "I") {
        const e = { t, name, n, dc: 0 }, rest = tok.slice(3).join(" ");
        const dc = /DC\s+(\S+)/i.exec(rest), ac = /AC\s+(\S+)/i.exec(rest), pwl = /PWL\(([^)]*)\)/i.exec(rest), sin = /SIN\(([^)]*)\)/i.exec(rest);
        if (dc) e.dc = S.spiceNum(dc[1]);
        if (ac) e.ac = S.spiceNum(ac[1]);
        if (pwl) { const q = pwl[1].split(/\s+/).map(S.spiceNum); e.wave = { type: "step", v0: q[1], t0: q[2], rise: q[4] - q[2], v1: q[5] }; }
        if (sin) { const q = sin[1].split(/\s+/).map(S.spiceNum); e.wave = { type: "sin", vo: q[0], va: q[1], f: q[2] }; }
        els.push(e);
      } else throw new Error("spice: unsupported card " + l);
    }
    return els;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = S;
})(typeof globalThis !== "undefined" ? globalThis : this);
