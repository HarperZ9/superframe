// SPDX-License-Identifier: FSL-1.1-MIT
import { DES } from "./constants.js";
import { planeRaster } from "./plane.js";
// ======================================================================= Router: A* on a 0.2 mm grid over two signal levels
export function heap(cap) {
  let k = new Int32Array(cap),
    v = new Float32Array(cap),
    n = 0;
  return {
    push(a, c) {
      if (n >= k.length) {
        const K = new Int32Array(n * 2),
          V = new Float32Array(n * 2);
        K.set(k);
        V.set(v);
        k = K;
        v = V;
      }
      let i = n++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (v[p] <= c) break;
        k[i] = k[p];
        v[i] = v[p];
        i = p;
      }
      k[i] = a;
      v[i] = c;
    },
    pop() {
      const t = k[0];
      n--;
      if (n > 0) {
        const a = k[n],
          c = v[n];
        let i = 0;
        for (;;) {
          let l = 2 * i + 1;
          if (l >= n) break;
          if (l + 1 < n && v[l + 1] < v[l]) l++;
          if (v[l] >= c) break;
          k[i] = k[l];
          v[i] = v[l];
          i = l;
        }
        k[i] = a;
        v[i] = c;
      }
      return t;
    },
    get size() {
      return n;
    },
    clear() {
      n = 0;
    },
  };
}
export const DX = [1, -1, 0, 0, 1, 1, -1, -1],
  DY = [0, 0, 1, -1, 1, -1, 1, -1],
  DC = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
export function makeGrid(d) {
  const g = DES.g,
    nx = Math.floor(d.W / g) + 1,
    ny = Math.floor(d.H / g) + 1,
    N = nx * ny;
  const G = {
    g,
    nx,
    ny,
    N,
    occ0: new Int32Array(N * 2),
    occ: null,
    cost: new Float32Array(N * 2),
    par: new Int32Array(N * 2),
    stamp: new Int32Array(N * 2),
    tgt: new Int32Array(N * 2),
    st: 0,
    tgs: 0,
    hp: heap(4096),
  };
  const stampRect = (lv, x, y, hw, hh, net, own) => {
    const a = Math.max(0, Math.ceil((x - hw) / g)),
      b = Math.min(nx - 1, Math.floor((x + hw) / g)),
      c = Math.max(0, Math.ceil((y - hh) / g)),
      e = Math.min(ny - 1, Math.floor((y + hh) / g)),
      o = lv * N;
    for (let j = c; j <= e; j++)
      for (let i = a; i <= b; i++) {
        const k = o + j * nx + i;
        if (own) G.occ0[k] = net;
        else G.occ0[k] = G.occ0[k] === 0 || G.occ0[k] === net ? net : -1;
      }
  };
  const R = DES.clr + DES.w / 2 + 0.01,
    ed = d.rules.edge + DES.w / 2 + 0.02;
  for (let lv = 0; lv < 2; lv++) {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = i * g,
          y = j * g;
        if (x < ed || y < ed || x > d.W - ed || y > d.H - ed) G.occ0[lv * N + j * nx + i] = -1;
      }
    for (const h of d.holes) {
      const r = h.d / 2 + R;
      for (let j = 0; j < ny; j++)
        for (let i = 0; i < nx; i++)
          if (Math.hypot(i * g - h.x, j * g - h.y) < r) G.occ0[lv * N + j * nx + i] = -1;
    }
  }
  const pads = d.parts.flatMap((p) => p.pads);
  for (const q of pads) {
    const n = q.net || -2;
    stampRect(0, q.x, q.y, q.w / 2 + R, q.h / 2 + R, n, false);
    if (q.th) stampRect(1, q.x, q.y, q.w / 2 + R, q.h / 2 + R, n, false);
  }
  for (const q of pads) {
    if (!q.net) continue;
    const ins = 0.05;
    stampRect(0, q.x, q.y, q.w / 2 - ins, q.h / 2 - ins, q.net, true);
    if (q.th) stampRect(1, q.x, q.y, q.w / 2 - ins, q.h / 2 - ins, q.net, true);
  }
  G.disc = (r) => {
    const a = [],
      m = Math.ceil(r / g);
    for (let j = -m; j <= m; j++)
      for (let i = -m; i <= m; i++) if (Math.hypot(i, j) * g <= r) a.push([i, j]);
    return a;
  };
  return G;
}
export function paint(G, lv, i0, j0, disc, net) {
  const o = lv * G.N;
  for (let k = 0; k < disc.length; k++) {
    const i = i0 + disc[k][0],
      j = j0 + disc[k][1];
    if (i < 0 || j < 0 || i >= G.nx || j >= G.ny) continue;
    const a = o + j * G.nx + i,
      c = G.occ[a];
    G.occ[a] = c === 0 || c === net ? net : -1;
  }
}
export function nodeFree(G, idx, net, samp) {
  const lv = idx >= G.N ? 1 : 0,
    b = idx - lv * G.N,
    c = G.occ[idx];
  if (c !== 0 && c !== net) return false;
  if (!samp) return true;
  const j = Math.floor(b / G.nx),
    i = b - j * G.nx;
  for (let k = 0; k < samp.length; k++) {
    const x = i + samp[k][0],
      y = j + samp[k][1];
    if (x < 0 || y < 0 || x >= G.nx || y >= G.ny) return false;
    const q = G.occ[lv * G.N + y * G.nx + x];
    if (q !== 0 && q !== net) return false;
  }
  return true;
}
export function viaOk(G, b, net) {
  for (let lv = 0; lv < 2; lv++) if (!nodeFree(G, lv * G.N + b, net, G.viaSamp)) return false;
  return true;
}
export function samples(r, g) {
  if (r <= 0.001) return null;
  const m = Math.max(1, Math.ceil(r / g)),
    a = [];
  for (let k = 0; k < 8; k++)
    a.push([
      Math.round((DX[k] * m) / (k > 3 ? Math.SQRT2 : 1)),
      Math.round((DY[k] * m) / (k > 3 ? Math.SQRT2 : 1)),
    ]);
  return a;
}
export function astar(G, net, sources, tx, ty, botCost, samp) {
  const { nx, ny, N, g } = G;
  G.st++;
  const st = G.st,
    H = G.hp;
  H.clear();
  const tgi = tx / g,
    tgj = ty / g,
    hh = (i, j) => {
      const a = Math.abs(i - tgi),
        b = Math.abs(j - tgj);
      return Math.max(a, b) + (Math.SQRT2 - 1) * Math.min(a, b);
    };
  for (const s of sources) {
    if (G.stamp[s] === st) continue;
    G.stamp[s] = st;
    G.cost[s] = 0;
    G.par[s] = -1;
    const b = s >= N ? s - N : s,
      j = Math.floor(b / nx);
    H.push(s, hh(b - j * nx, j));
  }
  let pops = 0;
  while (H.size) {
    const u = H.pop();
    pops++;
    if (pops > 150000) return null;
    if (G.tgt[u] === G.tgtStamp) {
      const p = [];
      let a = u;
      while (a >= 0) {
        p.push(a);
        a = G.par[a];
      }
      return p.reverse();
    }
    const lv = u >= N ? 1 : 0,
      b = u - lv * N,
      j = Math.floor(b / nx),
      i = b - j * nx,
      cu = G.cost[u],
      pu = G.par[u];
    let pdx = 0,
      pdy = 0;
    if (pu >= 0 && pu >= N === u >= N) {
      const pb = pu >= N ? pu - N : pu,
        pj = Math.floor(pb / nx);
      pdx = i - (pb - pj * nx);
      pdy = j - pj;
    }
    const lc = lv ? botCost : 1;
    for (let k = 0; k < 8; k++) {
      const x = i + DX[k],
        y = j + DY[k];
      if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
      const v = lv * N + y * nx + x;
      if (!nodeFree(G, v, net, samp)) continue;
      let c = cu + DC[k] * lc;
      if (pdx || pdy) {
        const dt = pdx * DX[k] + pdy * DY[k];
        if (dt === 0) c += 1.6;
        else if (dt < 0) continue;
        else if (pdx !== DX[k] || pdy !== DY[k]) c += 0.5;
      }
      if (G.stamp[v] !== st || c < G.cost[v]) {
        G.stamp[v] = st;
        G.cost[v] = c;
        G.par[v] = u;
        H.push(v, c + hh(x, y));
      }
    }
    const w = lv ? b : N + b;
    if (viaOk(G, b, net)) {
      const c = cu + 14;
      if (G.stamp[w] !== st || c < G.cost[w]) {
        G.stamp[w] = st;
        G.cost[w] = c;
        G.par[w] = u;
        H.push(w, c + hh(i, j));
      }
    }
  }
  return null;
}
export function padNodes(G, q) {
  const { g, nx, ny, N } = G,
    ins = 0.05,
    a = [];
  for (
    let j = Math.max(0, Math.ceil((q.y - q.h / 2 + ins) / g));
    j <= Math.min(ny - 1, Math.floor((q.y + q.h / 2 - ins) / g));
    j++
  )
    for (
      let i = Math.max(0, Math.ceil((q.x - q.w / 2 + ins) / g));
      i <= Math.min(nx - 1, Math.floor((q.x + q.w / 2 - ins) / g));
      i++
    ) {
      a.push(j * nx + i);
      if (q.th) a.push(N + j * nx + i);
    }
  return a;
}
export function emitPath(G, d, net, path, w, tree) {
  const { g, nx, N } = G,
    cuBot = d.layers - 1;
  let run = [];
  const flush = () => {
    if (run.length < 2) {
      run = [];
      return;
    }
    let s = run[0];
    for (let k = 1; k < run.length; k++) {
      const a = run[k - 1],
        b = run[k],
        c = run[k + 1];
      if (c === undefined || b - a !== c - b) {
        const lv = s >= N ? 1 : 0,
          sb = s - lv * N,
          bb = b - lv * N,
          sj = Math.floor(sb / nx),
          bj = Math.floor(bb / nx);
        d.tracks.push({
          net: net.id,
          l: lv ? cuBot : 0,
          x1: (sb - sj * nx) * g,
          y1: sj * g,
          x2: (bb - bj * nx) * g,
          y2: bj * g,
          w,
        });
        s = b;
      }
    }
    run = [];
  };
  const disc = G.disc(w / 2 + DES.clr + DES.w / 2 + 0.03),
    vdisc = G.disc(DES.viaPad / 2 + DES.clr + DES.w / 2 + 0.03);
  for (let k = 0; k < path.length; k++) {
    const u = path[k],
      lv = u >= N ? 1 : 0,
      b = u - lv * N,
      j = Math.floor(b / nx),
      i = b - j * nx;
    tree.push(u);
    paint(G, lv, i, j, disc, net.id);
    if (k > 0 && path[k - 1] >= N !== u >= N) {
      flush();
      d.vias.push({ net: net.id, x: i * g, y: j * g, d: DES.via, pad: DES.viaPad });
      paint(G, 0, i, j, vdisc, net.id);
      paint(G, 1, i, j, vdisc, net.id);
      tree.push(u >= N ? u - N : u + N);
    }
    run.push(u);
  }
  flush();
}
export function routeNet(G, d, net, botCost, fail) {
  const pins = net.pins.map(([r, q]) => d.padMap[r + "." + q]);
  if (pins.length < 2) return;
  const samp = samples((net.width - DES.w) / 2, G.g),
    tree = [];
  padNodes(G, pins[0]).forEach((n) => tree.push(n));
  const left = pins.slice(1);
  while (left.length) {
    let bi = 0,
      bd = 1e9;
    const c0 = pins[0];
    for (let i = 0; i < left.length; i++) {
      const q = left[i],
        dd = Math.hypot(q.x - c0.x, q.y - c0.y);
      if (dd < bd) {
        bd = dd;
        bi = i;
      }
    }
    const q = left.splice(bi, 1)[0];
    G.tgtStamp = ++G.tgs;
    const tn = padNodes(G, q);
    for (const t of tn) G.tgt[t] = G.tgtStamp;
    const p = astar(G, net.id, tree, q.x, q.y, botCost, samp);
    if (!p) {
      fail.push(net.name);
      return;
    }
    emitPath(G, d, net, p, net.width, tree);
    tn.forEach((n) => tree.push(n));
  }
}
export function planStub(G, d, net, q) {
  const { g, nx, ny, N } = G;
  const start = padNodes(G, q).filter((n) => n < N);
  if (!start.length) return false;
  G.st++;
  const st = G.st,
    sq = [];
  for (const s of start) {
    G.stamp[s] = st;
    G.par[s] = -1;
    G.cost[s] = 0;
    sq.push(s);
  }
  for (let h = 0; h < sq.length && h < 6000; h++) {
    const u = sq[h],
      j = Math.floor(u / nx),
      i = u - j * nx;
    if (G.cost[u] >= 3 && viaOk(G, u, net.id) && G.occ[N + u] === 0) {
      const p = [];
      let a = u;
      while (a >= 0) {
        p.push(a);
        a = G.par[a];
      }
      p.reverse();
      emitPath(G, d, { id: net.id }, p, Math.min(net.width, 0.3), []);
      d.vias.push({ net: net.id, x: i * g, y: j * g, d: DES.via, pad: DES.viaPad });
      const vd = G.disc(DES.viaPad / 2 + DES.clr + DES.w / 2 + 0.03);
      paint(G, 0, i, j, vd, net.id);
      paint(G, 1, i, j, vd, net.id);
      return true;
    }
    for (let k = 0; k < 4; k++) {
      const x = i + DX[k],
        y = j + DY[k];
      if (x < 0 || y < 0 || x >= nx || y >= ny) continue;
      const v = y * nx + x;
      if (G.stamp[v] === st || !nodeFree(G, v, net.id)) continue;
      G.stamp[v] = st;
      G.par[v] = u;
      G.cost[v] = G.cost[u] + 1;
      sq.push(v);
    }
  }
  return false;
}
export function route(d) {
  for (const _ of routeGen(d));
  return d;
}
export function* routeGen(d) {
  const t0 = Date.now(),
    PASSES = d.passLimit || 14;
  const G = makeGrid(d);
  G.viaSamp = samples(DES.viaPad / 2 - DES.w / 2 + 0.02, G.g);
  const gnd = d.nets.find((n) => /^(GND|VSS)$/i.test(n.name) && n.kind === "power");
  const pwr = d.layers === 4 ? d.nets.find((n) => n.kind === "power" && n !== gnd) : null;
  d.planes = [];
  if (gnd) d.planes.push({ net: gnd.id, l: 1 });
  if (pwr) d.planes.push({ net: pwr.id, l: 2 });
  else if (gnd && d.layers === 4) d.planes.push({ net: gnd.id, l: 2 });
  const planeNets = new Set(d.planes.map((p) => p.net));
  const hp = (n) => {
    const P = n.pins.map(([r, q]) => d.padMap[r + "." + q]);
    if (!P.length) return 0;
    return (
      Math.max(...P.map((p) => p.x)) -
      Math.min(...P.map((p) => p.x)) +
      Math.max(...P.map((p) => p.y)) -
      Math.min(...P.map((p) => p.y))
    );
  };
  let order = d.nets
    .filter((n) => !planeNets.has(n.id))
    .sort((a, b) => (b.kind === "power") - (a.kind === "power") || hp(a) - hp(b));
  const botCost = d.layers === 2 ? 1.5 : 1.1;
  let fail = [],
    pass = 0,
    best = null;
  for (; pass < PASSES; pass++) {
    G.occ = G.occ0.slice();
    d.tracks = [];
    d.vias = [];
    fail = [];
    for (const n of d.nets)
      if (planeNets.has(n.id))
        for (const [r, q] of n.pins) {
          const P = d.padMap[r + "." + q];
          if (!P.th && !planStub(G, d, n, P)) fail.push(n.name + " via at " + r + "." + q);
        }
    for (const n of order) {
      routeNet(G, d, n, botCost, fail);
      yield { pass: pass + 1, net: n.name };
      if (fail.length && pass < PASSES - 1) break;
    }
    if (!fail.length) break;
    if (pass === PASSES - 1) best = { fail: fail.slice(), t: d.tracks, v: d.vias };
    const fs = new Set(fail);
    order = order.filter((n) => fs.has(n.name)).concat(order.filter((n) => !fs.has(n.name)));
  }
  if (fail.length && best) {
    d.tracks = best.t;
    d.vias = best.v;
    fail = best.fail;
  }
  d.routeFail = fail;
  d.routePasses = Math.min(pass + 1, PASSES);
  if (d.layers === 2 && gnd && !fail.length) joinPour(G, d, gnd);
  d.routeMs = Date.now() - t0;
}
export function joinPour(G, d, gnd) {
  for (let t = 0; t < 12; t++) {
    const m = planeRaster(d, d.planes[0]),
      own = d.vias
        .filter((v) => v.net === gnd.id)
        .concat(gnd.pins.map(([r, q]) => d.padMap[r + "." + q]).filter((p) => p.th));
    const lab = new Map();
    for (const v of own) {
      const c = m.label[m.at(v.x, v.y)] || 0;
      if (!lab.has(c)) lab.set(c, v);
    }
    if (lab.size < 2) return;
    const ks = [...lab.values()];
    const a = ks[0],
      b = ks[1],
      g = G.g;
    const nd = (p, lv) => lv * G.N + Math.round(p.y / g) * G.nx + Math.round(p.x / g);
    G.tgtStamp = ++G.tgs;
    G.tgt[nd(b, 0)] = G.tgtStamp;
    G.tgt[nd(b, 1)] = G.tgtStamp;
    const p = astar(G, gnd.id, [nd(a, 0), nd(a, 1)], b.x, b.y, 1, null);
    if (!p) return;
    emitPath(G, d, gnd, p, DES.w, []);
  }
}
