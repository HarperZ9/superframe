// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/fabcsv: pick-and-place and bill of materials as CSV (RFC 4180 quoting), written and read here. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});

  const cell = (x) => { const s = String(x === undefined || x === null ? "" : x); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  E.toCSV = (rows) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  E.parseCSV = (txt) => {
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
      if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && txt[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; } else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows;
  };

  E.PNP_HEAD = ["Designator", "Value", "Package", "Mid X (mm)", "Mid Y (mm)", "Rotation", "Layer", "Mount"];
  E.toPnP = (B) => E.toCSV([E.PNP_HEAD, ...B.parts.map((P) => [P.ref, P.value, P.fp.name, P.at[0].toFixed(4), P.at[1].toFixed(4), P.rot, P.side === "F" ? "Top" : "Bottom", P.fp.smd ? "SMD" : "THT"])]);
  E.parsePnP = (txt) => { const [h, ...r] = E.parseCSV(txt); return r.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };

  E.BOM_HEAD = ["Item", "Qty", "Designators", "Value", "Footprint", "Part number", "PN status", "Description"];
  E.toBOM = (B) => {
    const groups = new Map();
    for (const P of B.parts) { const k = [P.value, P.fp.name, P.pn].join("|"); (groups.get(k) || groups.set(k, []).get(k)).push(P); }
    const rows = [...groups.values()].map((ps, i) => [i + 1, ps.length, ps.map((p) => p.ref).join(" "), ps[0].value, ps[0].fp.name, ps[0].pn || "", ps[0].pnStatus || (ps[0].pn ? "" : "no part number"), ps[0].comp.desc || ""]);
    return E.toCSV([E.BOM_HEAD, ...rows]);
  };
  E.parseBOM = (txt) => { const [h, ...r] = E.parseCSV(txt); return r.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);
