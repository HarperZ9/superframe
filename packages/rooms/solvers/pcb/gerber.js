// SPDX-License-Identifier: FSL-1.1-MIT
import { DES, UNBUILT } from "./constants.js";
import { bodyBox } from "./netlist.js";
import { planeClears, segD } from "./plane.js";
// ======================================================================= Gerber RS-274X writer
export function G6(v) {
  return String(Math.round(v * 1e6));
}
export function gerberLayer(d, name, fn) {
  const ap = new Map(),
    body = [];
  const code = (k) => {
    if (!ap.has(k)) ap.set(k, 10 + ap.size);
    return ap.get(k);
  };
  let cur = -1;
  const sel = (c) => {
    if (c !== cur) {
      body.push("D" + c + "*");
      cur = c;
    }
  };
  const api = {
    line(x1, y1, x2, y2, w) {
      sel(code("C," + w.toFixed(4)));
      body.push("X" + G6(x1) + "Y" + G6(y1) + "D02*");
      body.push("X" + G6(x2) + "Y" + G6(y2) + "D01*");
    },
    flashC(x, y, dia) {
      sel(code("C," + dia.toFixed(4)));
      body.push("X" + G6(x) + "Y" + G6(y) + "D03*");
    },
    flashR(x, y, w, h) {
      sel(code("R," + w.toFixed(4) + "X" + h.toFixed(4)));
      body.push("X" + G6(x) + "Y" + G6(y) + "D03*");
    },
    region(pts) {
      body.push("G36*");
      body.push("X" + G6(pts[0][0]) + "Y" + G6(pts[0][1]) + "D02*");
      for (let i = 1; i < pts.length; i++)
        body.push("X" + G6(pts[i][0]) + "Y" + G6(pts[i][1]) + "D01*");
      body.push("X" + G6(pts[0][0]) + "Y" + G6(pts[0][1]) + "D01*");
      body.push("G37*");
    },
    pol(c) {
      body.push(c ? "%LPC*%" : "%LPD*%");
    },
  };
  fn(api);
  const hd = [
    "G04 " + name + "*",
    "G04 " + d.title + " generated in PCB Room*",
    "G04 " + UNBUILT + "*",
    "%FSLAX46Y46*%",
    "%MOMM*%",
    "%LPD*%",
  ];
  for (const [k, c] of ap) hd.push("%ADD" + c + k + "*%");
  hd.push("G01*");
  return hd.concat(body, "M02*").join("\n") + "\n";
}
export function drawPads(d, g, l, grow) {
  for (const p of d.parts)
    for (const q of p.pads) {
      if (l !== 0 && !q.th) continue;
      if (q.round) g.flashC(q.x, q.y, q.w + 2 * (grow || 0));
      else g.flashR(q.x, q.y, q.w + 2 * (grow || 0), q.h + 2 * (grow || 0));
    }
}
export function copperGerber(d, l, name) {
  return gerberLayer(d, name, (g) => {
    const I = DES.planeInset,
      pl = (d.planes || []).find((p) => p.l === l),
      inner = d.layers === 4 && (l === 1 || l === 2);
    if (pl) {
      g.region([
        [I, I],
        [d.W - I, I],
        [d.W - I, d.H - I],
        [I, d.H - I],
      ]);
      g.pol(true);
      for (const c of planeClears(d, pl)) {
        if (c.x1 === c.x2 && c.y1 === c.y2) g.flashC(c.x1, c.y1, 2 * c.r);
        else g.line(c.x1, c.y1, c.x2, c.y2, 2 * c.r);
      }
      g.pol(false);
    }
    if (!inner) {
      for (const t of d.tracks) if (t.l === l) g.line(t.x1, t.y1, t.x2, t.y2, t.w);
      drawPads(d, g, l);
      for (const v of d.vias) g.flashC(v.x, v.y, v.pad);
    }
  });
}
export function silkLines(d) {
  const L = [],
    blocked = (x1, y1, x2, y2) => {
      for (const p of d.parts)
        for (const q of p.pads) {
          const m = 0.2;
          for (let s = 0; s <= 8; s++) {
            const x = x1 + ((x2 - x1) * s) / 8,
              y = y1 + ((y2 - y1) * s) / 8;
            if (Math.abs(x - q.x) < q.w / 2 + m && Math.abs(y - q.y) < q.h / 2 + m) return true;
          }
        }
      for (const v of d.vias) {
        if (segD(v.x, v.y, x1, y1, x2, y2) < v.pad / 2 + 0.1) return true;
      }
      for (const h of d.holes) if (segD(h.x, h.y, x1, y1, x2, y2) < h.d / 2 + 0.2) return true;
      return false;
    };
  const seg = (a, b, c, e) => {
    const n = Math.ceil(Math.hypot(c - a, e - b) / 0.5);
    for (let i = 0; i < n; i++) {
      const x1 = a + ((c - a) * i) / n,
        y1 = b + ((e - b) * i) / n,
        x2 = a + ((c - a) * (i + 1)) / n,
        y2 = b + ((e - b) * (i + 1)) / n;
      if (!blocked(x1, y1, x2, y2)) L.push([x1, y1, x2, y2]);
    }
  };
  for (const p of d.parts) {
    const b = bodyBox(p);
    if (p.f.kind === "hdr" || p.f.kind === "ic" || p.f.kind === "pdl") {
      const x0 = p.x - b.w / 2,
        x1 = p.x + b.w / 2,
        y0 = p.y - b.h / 2,
        y1 = p.y + b.h / 2;
      seg(x0, y0, x1, y0);
      seg(x1, y0, x1, y1);
      seg(x1, y1, x0, y1);
      seg(x0, y1, x0, y0);
    }
    if (p.arr) continue;
    const h = 0.7,
      w = p.ref.length * h * 0.8,
      cands = [
        [p.x, p.y + b.h / 2 + 0.6],
        [p.x, p.y - b.h / 2 - 0.6 - h],
        [p.x + b.w / 2 + 0.5 + w / 2, p.y - h / 2],
        [p.x - b.w / 2 - 0.5 - w / 2, p.y - h / 2],
      ];
    for (const c of cands) {
      const S = textStrokes(p.ref, c[0] - w / 2, c[1], h);
      if (
        S.every(
          (s) =>
            !blocked(s[0], s[1], s[2], s[3]) &&
            s[0] > 0.5 &&
            s[2] < d.W - 0.5 &&
            s[1] > 0.5 &&
            s[3] < d.H - 0.5
        )
      ) {
        L.push(...S);
        break;
      }
    }
  }
  return L;
}
export const GLYPH = {
  A: "00 03 14 23 20|02 22",
  B: "00 04 14 23 12 02|12 21 10 00",
  C: "24 04 00 20",
  D: "00 04 13 11 00",
  E: "24 04 00 20|02 12",
  F: "24 04 00|02 12",
  G: "24 04 00 20 22 12",
  H: "00 04|24 20|02 22",
  I: "10 14",
  J: "24 20 00 01",
  K: "00 04|24 02 20",
  L: "04 00 20",
  M: "00 04 12 24 20",
  N: "00 04 20 24",
  O: "00 04 24 20 00",
  P: "00 04 24 22 02",
  Q: "00 04 24 20 00|11 20",
  R: "00 04 24 22 02|12 20",
  S: "24 04 02 22 20 00",
  T: "04 24|14 10",
  U: "04 00 20 24",
  V: "04 10 24",
  W: "04 00 12 20 24",
  X: "00 24|04 20",
  Y: "04 12 24|12 10",
  Z: "04 24 00 20",
  0: "00 04 24 20 00|03 21",
  1: "03 14 10",
  2: "04 24 22 02 00 20",
  3: "04 24 20 00|02 22",
  4: "04 02 22|24 20",
  5: "24 04 02 22 20 00",
  6: "24 04 00 20 22 02",
  7: "04 24 10",
  8: "00 04 24 20 00|02 22",
  9: "22 02 04 24 20 00",
  "-": "02 22",
  ".": "10 11",
};
export function textStrokes(s, x, y, h) {
  const u = h / 4,
    out = [];
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = GLYPH[ch];
    if (g)
      for (const st of g.split("|")) {
        const P = st.split(" ").map((a) => [cx + +a[0] * u, y + +a[1] * u]);
        for (let i = 1; i < P.length; i++) out.push([P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]]);
      }
    cx += 3.2 * u;
  }
  return out;
}
export function excellon(d, plated) {
  const all = plated
    ? d.vias
        .map((v) => [v.x, v.y, v.d])
        .concat(d.parts.flatMap((p) => p.pads.filter((q) => q.th).map((q) => [q.x, q.y, q.drill])))
    : d.holes.map((h) => [h.x, h.y, h.d]);
  const sizes = [...new Set(all.map((a) => a[2].toFixed(3)))].sort();
  const L = [
    "M48",
    "; " + d.title + (plated ? " plated" : " non-plated") + " holes, PCB Room",
    "; " + UNBUILT,
    "; FORMAT={-:-/ absolute / metric / decimal}",
    "METRIC,TZ",
  ];
  sizes.forEach((s, i) => L.push("T" + (i + 1) + "C" + s));
  L.push("%", "G90", "G05");
  sizes.forEach((s, i) => {
    L.push("T" + (i + 1));
    for (const a of all)
      if (a[2].toFixed(3) === s) L.push("X" + a[0].toFixed(4) + "Y" + a[1].toFixed(4));
  });
  L.push("M30");
  return L.join("\n") + "\n";
}
export function csvq(s) {
  s = String(s);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function bomCsv(d) {
  const m = new Map();
  for (const p of d.parts) {
    const k = p.fp + "|" + p.value;
    if (!m.has(k)) m.set(k, { v: p.value, f: p.fp, r: [] });
    m.get(k).r.push(p.ref);
  }
  const L = ["# " + UNBUILT, "Qty,Value,Footprint,Refs"];
  for (const e of m.values()) L.push([e.r.length, csvq(e.v), e.f, csvq(e.r.join(" "))].join(","));
  return L.join("\n") + "\n";
}
export function pnpCsv(d) {
  const L = ["# " + UNBUILT, "Ref,Value,Footprint,X_mm,Y_mm,Rotation,Side"];
  for (const p of d.parts)
    L.push([p.ref, csvq(p.value), p.fp, p.x.toFixed(3), p.y.toFixed(3), p.rot, "top"].join(","));
  return L.join("\n") + "\n";
}
export function exportAll(d) {
  const f = {},
    nm = d.layers === 2 ? ["F_Cu", "B_Cu"] : ["F_Cu", "In1_Cu", "In2_Cu", "B_Cu"];
  nm.forEach((n, l) => (f[n + ".gbr"] = copperGerber(d, l, n)));
  f["F_Mask.gbr"] = gerberLayer(d, "F_Mask", (g) => drawPads(d, g, 0, DES.maskGrow));
  f["B_Mask.gbr"] = gerberLayer(d, "B_Mask", (g) => drawPads(d, g, d.layers - 1, DES.maskGrow));
  const S = silkLines(d);
  f["F_Silk.gbr"] = gerberLayer(d, "F_Silk", (g) => {
    for (const s of S) g.line(s[0], s[1], s[2], s[3], 0.12);
  });
  f["Edge.gbr"] = gerberLayer(d, "Edge", (g) => {
    const P = [
      [0, 0],
      [d.W, 0],
      [d.W, d.H],
      [0, d.H],
      [0, 0],
    ];
    for (let i = 1; i < P.length; i++) g.line(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], 0.1);
  });
  f["PTH.drl"] = excellon(d, true);
  f["NPTH.drl"] = excellon(d, false);
  f["BOM.csv"] = bomCsv(d);
  f["PickPlace.csv"] = pnpCsv(d);
  return f;
}
