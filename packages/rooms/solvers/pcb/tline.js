// SPDX-License-Identifier: FSL-1.1-MIT
import { RHO_CU, layerZ } from "./constants.js";
import { fieldZ0 } from "./field-solve.js";
// ======================================================================= Transmission lines: leapfrog on a graph of series L, R and shunt C
export function TLine(N, edges, nodeC, opt) {
  this.N = N;
  this.e = edges;
  this.C = nodeC;
  this.V = new Float64Array(N);
  this.I = new Float64Array(edges.length);
  this.t = 0;
  this.Rs = opt.Rs;
  this.src = opt.src;
  this.tr = opt.tr || 0;
  this.Vs = opt.Vs || 1;
  this.G = new Float64Array(N);
  this.CL = nodeC.slice();
  if (opt.loads)
    for (const l of opt.loads) {
      if (l.R > 0) this.G[l.n] += 1 / l.R;
      if (l.C > 0) this.CL[l.n] += l.C;
    }
  this.G[this.src] += 1 / this.Rs;
  let dt = 1e9;
  for (const e of edges) {
    const c = Math.min(this.CL[e.a], this.CL[e.b]);
    dt = Math.min(dt, Math.sqrt(e.L * c));
  }
  this.dt = dt * (opt.courant || 0.9);
}
TLine.prototype.step = function () {
  const V = this.V,
    I = this.I,
    e = this.e,
    dt = this.dt,
    N = this.N,
    Q = this.q || (this.q = new Float64Array(N));
  for (let k = 0; k < e.length; k++) {
    const E = e[k],
      a = (E.R * dt) / (2 * E.L);
    I[k] = (I[k] * (1 - a) + (dt / E.L) * (V[E.a] - V[E.b])) / (1 + a);
  }
  Q.fill(0);
  for (let k = 0; k < e.length; k++) {
    Q[e[k].a] -= I[k];
    Q[e[k].b] += I[k];
  }
  this.t += dt;
  const tn = this.t,
    s = this.tr > 0 ? Math.min(1, Math.max(0, tn / this.tr)) : 1;
  Q[this.src] += (this.Vs * s) / this.Rs;
  for (let i = 0; i < N; i++) {
    const b = this.CL[i] / dt;
    V[i] = (V[i] * (b - this.G[i] / 2) + Q[i]) / (b + this.G[i] / 2);
  }
};
export function uniformLine(segs, opt) {
  const dx = opt.dx || 0.25,
    edges = [];
  let nodes = [];
  const C = [];
  let n = 0;
  C[0] = 0;
  for (const s of segs) {
    const m = Math.max(2, Math.round(s.L / dx)),
      cell = s.L / m,
      L = (s.Z0 / s.v) * cell * 1e-3,
      Cc = (cell * 1e-3) / (s.Z0 * s.v);
    for (let i = 0; i < m; i++) {
      edges.push({ a: n, b: n + 1, L, R: s.R ? s.R * cell : 0 });
      C[n] = (C[n] || 0) + Cc / 2;
      C[n + 1] = (C[n + 1] || 0) + Cc / 2;
      n++;
    }
  }
  const last = n;
  return new TLine(n + 1, edges, Float64Array.from(C), {
    Rs: opt.Rs,
    src: 0,
    tr: opt.tr,
    loads: [{ n: last, R: opt.RL || 0, C: opt.CL || 0 }],
    courant: opt.courant,
  });
}
export function netTraceInfo(d, t) {
  const zz = d.stack;
  let h,
    er = zz.er;
  if (d.layers === 4) {
    h = zz.diel[t.l === 0 ? 0 : 2];
  } else h = zz.diel[0];
  return fieldZ0(t.w, h, zz.cu[t.l], er);
}
export function buildNetLine(d, netId, fromKey, toKey, opt) {
  const ts = d.tracks.filter((t) => t.net === netId);
  if (!ts.length) return null;
  const nodes = [],
    map = new Map(),
    nid = (x, y) => {
      const k = Math.round(x * 1e3) + "_" + Math.round(y * 1e3);
      if (!map.has(k)) {
        map.set(k, nodes.length);
        nodes.push({ x, y });
      }
      return map.get(k);
    };
  const edges = [],
    C = [],
    add = (n, c) => {
      C[n] = (C[n] || 0) + c;
    };
  const dx = 0.3;
  const segInfo = [];
  for (const t of ts) {
    const len = Math.hypot(t.x2 - t.x1, t.y2 - t.y1);
    if (len < 1e-6) continue;
    const f = netTraceInfo(d, t),
      m = Math.max(1, Math.round(len / dx)),
      cell = len / m;
    let prev = nid(t.x1, t.y1);
    for (let i = 1; i <= m; i++) {
      const u = i / m,
        n = i === m ? nid(t.x2, t.y2) : nid(t.x1 + (t.x2 - t.x1) * u, t.y1 + (t.y2 - t.y1) * u);
      edges.push({
        a: prev,
        b: n,
        L: (f.z / f.v) * cell * 1e-3,
        R: (RHO_CU * cell) / (t.w * d.stack.cu[t.l]),
        Zc: f.z,
      });
      const c = (cell * 1e-3) / (f.z * f.v);
      add(prev, c / 2);
      add(n, c / 2);
      prev = n;
    }
    segInfo.push({ z: f.z, v: f.v, len, w: t.w, l: t.l });
  }
  const viaL = d.vias.filter((v) => v.net === netId);
  for (const v of viaL) {
    const hIn = layerZ(d.layers).total / 25.4;
    const Lv = (hIn / 5) * (1 + Math.log((4 * hIn) / (v.d / 25.4))) * 1e-9;
    segInfo.via = (segInfo.via || 0) + 1;
    const near = nodes
      .map((q, i) => [Math.hypot(q.x - v.x, q.y - v.y), i])
      .filter((q) => q[0] < 1e-6);
    if (near.length < 2) continue;
  }
  const padIn = (k) => {
    const q = d.padMap[k],
      a = [];
    nodes.forEach((n, i) => {
      if (Math.abs(n.x - q.x) <= q.w / 2 + 1e-6 && Math.abs(n.y - q.y) <= q.h / 2 + 1e-6) a.push(i);
    });
    if (!a.length) {
      let b = -1,
        bd = 1e9;
      nodes.forEach((n, i) => {
        const e = Math.hypot(n.x - q.x, n.y - q.y);
        if (e < bd) {
          bd = e;
          b = i;
        }
      });
      a.push(b);
    }
    return a;
  };
  const net = d.nets.find((n) => n.id === netId);
  const tinyL = 1e-11;
  for (const [r, q] of net.pins) {
    const a = padIn(r + "." + q);
    for (let i = 1; i < a.length; i++) edges.push({ a: a[0], b: a[i], L: tinyL, R: 0, pad: 1 });
  }
  for (let i = 0; i < nodes.length; i++) if (!C[i]) C[i] = 1e-15;
  const src = padIn(fromKey)[0],
    load = padIn(toKey)[0];
  const loads = [{ n: load, R: opt.RL || 0, C: opt.CL || 0 }];
  const others = net.pins.map(([r, q]) => r + "." + q).filter((k) => k !== fromKey && k !== toKey);
  for (const k of others) loads.push({ n: padIn(k)[0], C: opt.Cpin || 1e-12 });
  for (const e of edges) if (e.pad) e.L = Math.max(e.L, 1e-11);
  const tl = new TLine(nodes.length, edges, Float64Array.from(C), {
    Rs: opt.Rs,
    src,
    tr: opt.tr,
    loads,
    courant: 0.45,
  });
  tl.nodes = nodes;
  tl.load = load;
  tl.srcN = src;
  tl.seg = segInfo;
  tl.segs = ts;
  tl.map = map;
  return tl;
}
