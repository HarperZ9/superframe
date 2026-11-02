// SPDX-License-Identifier: FSL-1.1-MIT
import { DES } from "./constants.js";
// ======================================================================= Plane geometry, shared by Gerber, raster and textures
export function planeClears(d, pl) {
  const out = [],
    isBot = d.layers === 2,
    clr = DES.pourClr;
  for (const h of d.holes)
    out.push({ x1: h.x, y1: h.y, x2: h.x, y2: h.y, r: h.d / 2 + DES.antipad });
  for (const v of d.vias)
    if (v.net !== pl.net)
      out.push({
        x1: v.x,
        y1: v.y,
        x2: v.x,
        y2: v.y,
        r: isBot ? v.pad / 2 + clr : v.d / 2 + DES.antipad,
      });
  for (const p of d.parts)
    for (const q of p.pads)
      if (q.th && q.net !== pl.net)
        out.push({
          x1: q.x,
          y1: q.y,
          x2: q.x,
          y2: q.y,
          r: isBot
            ? (Math.max(q.w, q.h) / 2) * (q.round ? 1 : 1.42) + clr
            : q.drill / 2 + DES.antipad,
        });
  if (isBot)
    for (const t of d.tracks)
      if (t.l === pl.l && t.net !== pl.net)
        out.push({ x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, r: t.w / 2 + clr });
  return out;
}
export function segD(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1,
    dy = y2 - y1,
    L = dx * dx + dy * dy;
  let t = L > 0 ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}
export function planeRaster(d, pl, res) {
  res = res || 0.2;
  const nx = Math.ceil(d.W / res),
    ny = Math.ceil(d.H / res),
    m = new Uint8Array(nx * ny),
    I = DES.planeInset;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * res,
        y = (j + 0.5) * res;
      if (x > I && y > I && x < d.W - I && y < d.H - I) m[j * nx + i] = 1;
    }
  for (const c of planeClears(d, pl)) {
    const a = Math.max(0, Math.floor((Math.min(c.x1, c.x2) - c.r) / res)),
      b = Math.min(nx - 1, Math.ceil((Math.max(c.x1, c.x2) + c.r) / res)),
      e = Math.max(0, Math.floor((Math.min(c.y1, c.y2) - c.r) / res)),
      f = Math.min(ny - 1, Math.ceil((Math.max(c.y1, c.y2) + c.r) / res));
    for (let j = e; j <= f; j++)
      for (let i = a; i <= b; i++)
        if (segD((i + 0.5) * res, (j + 0.5) * res, c.x1, c.y1, c.x2, c.y2) < c.r) m[j * nx + i] = 0;
  }
  const label = new Int32Array(nx * ny);
  let n = 0;
  const st = [];
  for (let s = 0; s < nx * ny; s++) {
    if (!m[s] || label[s]) continue;
    n++;
    label[s] = n;
    st.push(s);
    while (st.length) {
      const u = st.pop(),
        j = Math.floor(u / nx),
        i = u - j * nx;
      for (const [x, y] of [
        [i + 1, j],
        [i - 1, j],
        [i, j + 1],
        [i, j - 1],
      ])
        if (x >= 0 && y >= 0 && x < nx && y < ny) {
          const v = y * nx + x;
          if (m[v] && !label[v]) {
            label[v] = n;
            st.push(v);
          }
        }
    }
  }
  return {
    res,
    nx,
    ny,
    mask: m,
    label,
    n,
    at: (x, y) =>
      Math.min(ny - 1, Math.max(0, Math.floor(y / res))) * nx +
      Math.min(nx - 1, Math.max(0, Math.floor(x / res))),
  };
}
