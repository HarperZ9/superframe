// A place as a set of props on a floor-plan grid, so a scene can hold hundreds of props and still
// trace at plate resolution. Original code (Low Water look work, 2026-10-17).
//
//   const W = makeWorld({ cell: 2, margin: 0.6 });
//   W.add(prop)            // prop: { bb: [x0, y0, z0, x1, y1, z1], f(x, y, z, T), kind }
//   W.ground(fn)           // fn(x, y, z, T): unbounded terrain, always evaluated
//   W.build()              // freezes the grid
//   W.map(x, y, z)         // signed distance; W.idOf() the nearest surface id; W.propOf() its prop
//
// T(dist, id) records a candidate surface. A prop's f may call T several times. Props are bucketed
// into floor cells (x, z) by their bounding box grown by the margin; outside its bucket list a
// point is at least (distance to the cell's edge + margin) from any prop not listed, so the
// distance returned never overshoots.
import { box } from "../sdf.mjs";

export function makeWorld({ cell = 2, margin = 0.6 } = {}) {
  const props = [], grounds = [];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, nx = 0, nz = 0, buckets = null, built = false;
  let d = Infinity, id = 0, pr = -1, curProp = -1;
  const T = (t, i) => { if (t < d) { d = t; id = i; pr = curProp; } };
  const W = {
    props,
    add(p) { if (built) throw new Error("world built"); p.index = props.length; props.push(p); return p; },
    ground(fn) { grounds.push(fn); },
    build() {
      for (const p of props) { x0 = Math.min(x0, p.bb[0]); z0 = Math.min(z0, p.bb[2]); x1 = Math.max(x1, p.bb[3]); z1 = Math.max(z1, p.bb[5]); }
      if (!props.length) { x0 = z0 = 0; x1 = z1 = 1; }
      x0 -= margin; z0 -= margin; x1 += margin; z1 += margin;
      nx = Math.max(1, Math.ceil((x1 - x0) / cell)); nz = Math.max(1, Math.ceil((z1 - z0) / cell));
      buckets = Array.from({ length: nx * nz }, () => []);
      for (const p of props) {
        const a = Math.max(0, Math.floor((p.bb[0] - margin - x0) / cell)), b = Math.min(nx - 1, Math.floor((p.bb[3] + margin - x0) / cell));
        const c = Math.max(0, Math.floor((p.bb[2] - margin - z0) / cell)), e = Math.min(nz - 1, Math.floor((p.bb[5] + margin - z0) / cell));
        for (let k = c; k <= e; k++) for (let j = a; j <= b; j++) buckets[k * nx + j].push(p);
      }
      built = true; return W;
    },
    map(x, y, z) {
      d = Infinity; id = 0; pr = -1; curProp = -1;
      for (const g of grounds) g(x, y, z, T);
      const gx = Math.floor((x - x0) / cell), gz = Math.floor((z - z0) / cell);
      if (gx < 0 || gz < 0 || gx >= nx || gz >= nz) {
        // outside the grid: no prop is nearer than the grid's own box
        const out = box(x, 0, z, (x0 + x1) / 2, 0, (z0 + z1) / 2, (x1 - x0) / 2, 1e9, (z1 - z0) / 2);
        if (out < d) { d = Math.max(out, 0.02); id = 0; pr = -1; }
        return d;
      }
      const list = buckets[gz * nx + gx];
      for (let i = 0; i < list.length; i++) {
        const p = list[i], b = p.bb;
        const bd = box(x, y, z, (b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2, (b[3] - b[0]) / 2, (b[4] - b[1]) / 2, (b[5] - b[2]) / 2);
        if (bd > d) continue;
        if (bd > 0.35) { if (bd < d) { d = bd; id = 0; pr = -1; } continue; } // far from it: its box is a safe bound
        curProp = p.index; p.f(x, y, z, T); curProp = -1;
      }
      // the nearest unlisted prop is at least this far
      const cx = x0 + gx * cell, cz = z0 + gz * cell, exit = Math.min(x - cx, cx + cell - x, z - cz, cz + cell - z) + margin;
      if (exit < d) { d = exit; id = 0; pr = -1; }
      return d;
    },
    idOf: () => id,
    propOf: () => pr,
  };
  return W;
}

// Small deterministic hash in [0, 1) for set dressing.
export function rnd(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
// A seeded sequence: const R = seq(7); R() R() ...
export function seq(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
