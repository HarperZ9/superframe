// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/excellon: the drill file (Excellon, metric, decimal coordinates, plated holes), written and read here. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});

  E.holes = (B) => {
    const H = [];
    for (const q of E.pads(B)) if (q.pad.drill) H.push({ d: q.pad.drill, at: q.at, what: q.P.ref + "." + q.pad.num });
    for (const v of B.vias) H.push({ d: v.drill, at: v.at, what: "via " + v.net });
    return H;
  };

  const f3 = (v) => v.toFixed(3);
  E.toExcellon = (holes, meta = {}) => {
    const sizes = [...new Set(holes.map((h) => f3(h.d)))].sort((a, b) => +a - +b), o = ["M48", "; diagram-eda drill file" + (meta.hash ? ", model " + meta.hash : ""), "; plated through holes", "FMAT,2", "METRIC,TZ"];
    sizes.forEach((s, i) => o.push(`T${i + 1}C${s}`));
    o.push("%", "G90", "G05");
    sizes.forEach((s, i) => { o.push(`T${i + 1}`); for (const h of holes) if (f3(h.d) === s) o.push(`X${f3(h.at[0])}Y${f3(h.at[1])}`); });
    o.push("T0", "M30");
    return o.join("\n") + "\n";
  };

  E.parseExcellon = (txt) => {
    const tools = {}, holes = [];
    let header = false, cur = null, metric = false;
    for (let l of txt.replace(/\r/g, "").split("\n")) {
      l = l.trim();
      if (!l || l.startsWith(";")) continue;
      if (l === "M48") { header = true; continue; }
      if (l === "%" || l === "M95") { header = false; continue; }
      if (/^METRIC/.test(l)) { metric = true; continue; }
      if (/^INCH/.test(l)) throw new Error("excellon: inch files are not read here");
      let m;
      if (header && (m = /^T(\d+)C([\d.]+)/.exec(l))) { tools[+m[1]] = +m[2]; continue; }
      if (header) continue;
      if ((m = /^T(\d+)$/.exec(l))) { cur = +m[1]; continue; }
      if ((m = /^X([-\d.]+)Y([-\d.]+)$/.exec(l))) { if (!l.includes(".")) throw new Error("excellon: implicit-decimal coordinates are not read here"); holes.push({ d: tools[cur], at: [+m[1], +m[2]], tool: cur }); continue; }
      if (/^(G90|G05|M30|FMAT)/.test(l)) continue;
      throw new Error("excellon: line not read: " + l);
    }
    if (!metric) throw new Error("excellon: no METRIC header");
    return { tools, holes };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);
