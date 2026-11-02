// SPDX-License-Identifier: FSL-1.1-MIT
import { planeClears } from "./plane.js";
// ======================================================================= An independent reader, shares nothing with the writer
export function readGerber(txt) {
  const ap = {},
    fl = [],
    dr = [],
    rg = [];
  let pol = "D",
    ax = null,
    x = 0,
    y = 0,
    inR = false,
    poly = null,
    fx = 6;
  const words = txt.replace(/G04[^*]*\*/g, "").match(/%[^%]*%|[^*%\s]+\*/g) || [];
  for (let w of words) {
    if (w[0] === "%") {
      const a = /^%ADD(\d+)([CR]),([\d.]+)(?:X([\d.]+))?\*%$/.exec(w);
      if (a) ap[a[1]] = { t: a[2], a: +a[3], b: a[4] ? +a[4] : +a[3] };
      const fs = /^%FSLAX\d(\d)Y/.exec(w);
      if (fs) fx = +fs[1];
      const lp = /^%LP([CD])\*%$/.exec(w);
      if (lp) pol = lp[1];
      continue;
    }
    w = w.slice(0, -1);
    if (w === "G36") {
      inR = true;
      poly = [];
      continue;
    }
    if (w === "G37") {
      inR = false;
      rg.push({ pts: poly, pol });
      continue;
    }
    if (w === "G01" || w === "M02") continue;
    const sel = /^D(\d+)$/.exec(w);
    if (sel && +sel[1] >= 10) {
      ax = sel[1];
      continue;
    }
    const m = /^(?:X(-?\d+))?(?:Y(-?\d+))?D0([123])$/.exec(w);
    if (!m) throw new Error("reader cannot parse " + w);
    const nx = m[1] !== undefined ? +m[1] / 10 ** fx : x,
      ny = m[2] !== undefined ? +m[2] / 10 ** fx : y,
      op = m[3];
    if (inR) {
      if (op === "2" && poly.length) throw new Error("multi contour region");
      poly.push([nx, ny]);
    } else if (op === "3") fl.push({ x: nx, y: ny, ap: ap[ax], pol });
    else if (op === "1") dr.push({ x1: x, y1: y, x2: nx, y2: ny, ap: ap[ax], pol });
    x = nx;
    y = ny;
  }
  return { ap, fl, dr, rg };
}
export function compareGerber(d, l, txt) {
  const r = readGerber(txt),
    inner = d.layers === 4 && (l === 1 || l === 2);
  let miss = 0,
    maxe = 0;
  const dark = r.dr.filter((q) => q.pol === "D");
  const used = new Uint8Array(dark.length);
  const want = inner ? [] : d.tracks.filter((t) => t.l === l);
  for (const t of want) {
    let ok = false;
    for (let i = 0; i < dark.length; i++) {
      if (used[i]) continue;
      const q = dark[i];
      const e = Math.max(
        Math.abs(q.x1 - t.x1),
        Math.abs(q.y1 - t.y1),
        Math.abs(q.x2 - t.x2),
        Math.abs(q.y2 - t.y2)
      );
      if (e < 0.001 && Math.abs(q.ap.a - t.w) < 0.001) {
        used[i] = 1;
        ok = true;
        maxe = Math.max(maxe, e);
        break;
      }
    }
    if (!ok) miss++;
  }
  const padsW = [];
  if (!inner) {
    for (const v of d.vias) padsW.push([v.x, v.y, v.pad, v.pad]);
    for (const p of d.parts)
      for (const q of p.pads) if (l === 0 || q.th) padsW.push([q.x, q.y, q.w, q.h]);
  }
  const fd = r.fl.filter((q) => q.pol === "D");
  const fu = new Uint8Array(fd.length);
  let missF = 0;
  for (const a of padsW) {
    let ok = false;
    for (let i = 0; i < fd.length; i++) {
      if (fu[i]) continue;
      const q = fd[i],
        e = Math.max(Math.abs(q.x - a[0]), Math.abs(q.y - a[1]));
      if (e < 0.001 && Math.abs(q.ap.a - a[2]) < 0.001 && Math.abs(q.ap.b - a[3]) < 0.001) {
        fu[i] = 1;
        ok = true;
        maxe = Math.max(maxe, e);
        break;
      }
    }
    if (!ok) missF++;
  }
  const pl = (d.planes || []).find((p) => p.l === l);
  return {
    missT: miss,
    missF,
    extraT: dark.length - used.reduce((a, b) => a + b, 0),
    extraF: fd.length - fu.reduce((a, b) => a + b, 0),
    maxe,
    regions: r.rg.length,
    clears: r.fl.filter((q) => q.pol === "C").length + r.dr.filter((q) => q.pol === "C").length,
    wantClears: pl ? planeClears(d, pl).length : 0,
  };
}
export function readExcellon(txt) {
  const t = {},
    out = [];
  let cur = null,
    head = true;
  for (const line of txt.split(/\r?\n/)) {
    if (line[0] === ";") continue;
    const a = /^T(\d+)C([\d.]+)$/.exec(line);
    if (a) {
      t[a[1]] = +a[2];
      continue;
    }
    if (line === "%") {
      head = false;
      continue;
    }
    const s = /^T(\d+)$/.exec(line);
    if (s && !head) {
      cur = t[s[1]];
      continue;
    }
    const m = /^X(-?[\d.]+)Y(-?[\d.]+)$/.exec(line);
    if (m) out.push({ x: +m[1], y: +m[2], d: cur });
  }
  return out;
}
