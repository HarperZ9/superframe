// SPDX-License-Identifier: FSL-1.1-MIT
import { heap } from "./router.js";
// ======================================================================= Schematic from the netlist
export function schematic(d) {
  const kindOf = (p) => {
    const k = p.f.kind;
    return k === "ic" || k === "sot"
      ? "amp"
      : k === "hdr"
        ? "conn"
        : k === "res"
          ? "res"
          : k === "cap"
            ? "cap"
            : "diode";
  };
  const syms = [],
    byRef = {},
    dense = d.nets.filter((n) => n.kind === "signal").length > 12;
  const adj = new Map(d.parts.map((p) => [p.ref, new Set()]));
  for (const n of d.nets)
    if (n.kind === "signal")
      for (const [a] of n.pins) for (const [b] of n.pins) if (a !== b) adj.get(a).add(b);
  const col = {};
  const starts = d.parts.filter(
    (p) => (p.f.kind === "hdr" && p === d.parts[0]) || p.f.kind === "pdl" || p.f.kind === "pd"
  );
  let q = starts.map((p) => p.ref);
  q.forEach((r) => (col[r] = 0));
  while (q.length) {
    const nq = [];
    for (const r of q)
      for (const o of adj.get(r))
        if (col[o] === undefined) {
          col[o] = col[r] + 1;
          nq.push(o);
        }
    q = nq;
  }
  let mc = 0;
  for (const k in col) mc = Math.max(mc, col[k]);
  for (const p of d.parts)
    if (col[p.ref] === undefined)
      col[p.ref] = p.f.kind === "cap" || p.f.kind === "res" ? Math.max(0, mc) : mc + 1;
  for (const p of d.parts) mc = Math.max(mc, col[p.ref]);
  if (dense) for (const p of d.parts) col[p.ref] = p.f.kind === "hdr" ? 1 : 0;
  const cols = [];
  for (const p of d.parts) {
    (cols[col[p.ref]] = cols[col[p.ref]] || []).push(p);
  }
  const sW = dense ? 1 : 1,
    CW = 22,
    RH = dense ? 5 : 13;
  let maxR = 0;
  const wrap = dense ? 6 : 99;
  cols.forEach((c, i) => {
    if (!c) return;
    c.forEach((p, j) => {
      const k = kindOf(p);
      let x, y;
      if (dense && i === 0) {
        x = 8 + (j % wrap) * 19;
        y = 6 + Math.floor(j / wrap) * 8;
      } else if (dense) {
        x = 8 + wrap * 19 + 6;
        y = 6;
      } else {
        x = 10 + i * CW;
        y = 9 + j * RH;
      }
      maxR = Math.max(maxR, y);
      const s = { ref: p.ref, kind: k, value: p.value, x, y, pins: [] };
      const Pn = (pin, dx, dy, side, name) => {
        s.pins.push({ pin, x: x + dx, y: y + dy, side, name });
      };
      if (k === "res" || k === "cap" || k === "diode") {
        Pn("1", -5, 0, "l");
        Pn("2", 5, 0, "r");
        s.box = [x - 3, y - 2, x + 3, y + 2];
      } else if (k === "amp") {
        const so = p.f.kind === "sot";
        if (so) {
          Pn("3", -5, 2, "l", "+");
          Pn("4", -5, -2, "l", "-");
          Pn("1", 6, 0, "r", "o");
          Pn("5", 0, -5, "t", "V+");
          Pn("2", 0, 5, "b", "V-");
        } else {
          Pn("3", -5, 2, "l", "+");
          Pn("2", -5, -2, "l", "-");
          Pn("6", 6, 0, "r", "o");
          Pn("7", 0, -5, "t", "V+");
          Pn("4", 0, 5, "b", "V-");
        }
        s.box = [x - 4, y - 4, x + 5, y + 4];
      } else {
        const n = p.f.pads.length;
        p.f.pads.forEach((g, u) => {
          const yy = y + u * (dense ? 1 : 2);
          Pn(g.pin, dense ? -4 : 5, yy - y, dense ? "l" : "r");
        });
        s.box = [x - 2, y - 1, x + 2, y + n * (dense ? 1 : 2) - 1];
        maxR = Math.max(maxR, y + n * (dense ? 1 : 2));
      }
      byRef[p.ref] = s;
      syms.push(s);
    });
  });
  let W = 0,
    H = maxR + 10;
  for (const s of syms) {
    W = Math.max(W, s.box[2] + 12);
    H = Math.max(H, s.box[3] + 10);
  }
  W = Math.ceil(W);
  H = Math.ceil(H);
  const pinOf = {};
  for (const s of syms) for (const p of s.pins) pinOf[s.ref + "." + p.pin] = p;
  const wires = [],
    labels = [],
    dots = [],
    blocked = new Uint8Array(W * H),
    hOcc = new Int32Array(W * H),
    vOcc = new Int32Array(W * H),
    tomb = [];
  for (const s of syms) {
    for (let y = Math.floor(s.box[1]); y <= Math.ceil(s.box[3]); y++)
      for (let x = Math.floor(s.box[0]); x <= Math.ceil(s.box[2]); x++)
        if (x >= 0 && y >= 0 && x < W && y < H) blocked[y * W + x] = 1;
  }
  const unconnected = [];
  const stubs = (p) =>
    p.side === "l" ? [-1, 0] : p.side === "r" ? [1, 0] : p.side === "t" ? [0, -1] : [0, 1];
  for (const n of d.nets) {
    const ps = n.pins
      .map(([r, q]) => ({ k: r + "." + q, p: pinOf[r + "." + q] }))
      .filter((o) => o.p);
    for (const o of d.nets.length ? [] : []) void o;
    if (n.kind === "power" || dense) {
      for (const { p } of ps) {
        const [dx, dy] = stubs(p);
        const lx = p.x + dx * 2,
          ly = p.y + dy * 2;
        wires.push({
          net: n.name,
          pts: [
            [p.x, p.y],
            [lx, ly],
          ],
        });
        labels.push({
          x: lx,
          y: ly,
          text: n.name,
          kind: n.kind === "power" ? (/GND/i.test(n.name) ? "gnd" : "rail") : "label",
          side: p.side,
        });
      }
      continue;
    }
    if (ps.length < 2) {
      for (const { p } of ps)
        labels.push({ x: p.x, y: p.y, text: n.name, kind: "label", side: p.side });
      continue;
    }
    const treeC = new Set(),
      tk = (x, y) => y * W + x,
      first = ps[0].p;
    treeC.add(tk(first.x, first.y));
    for (let i = 1; i < ps.length; i++) {
      const tp = ps[i].p,
        res = schemRoute(W, H, blocked, hOcc, vOcc, n.id, treeC, tp);
      if (!res) {
        unconnected.push(ps[i].k);
        labels.push({ x: tp.x, y: tp.y, text: n.name, kind: "label", side: tp.side });
        labels.push({ x: first.x, y: first.y, text: n.name, kind: "label", side: first.side });
        continue;
      }
      wires.push({ net: n.name, pts: res.pts });
      if (treeC.has(tk(res.pts[0][0], res.pts[0][1])) && ps.length > 2 && i > 1)
        dots.push(res.pts[0]);
      for (const a of res.cells) treeC.add(a);
    }
  }
  return { W, H, syms, wires, labels, dots, dense, unconnected };
}
export function schemRoute(W, H, bl, hOcc, vOcc, net, src, tp) {
  const N = W * H * 4,
    dist = new Float32Array(N).fill(1e9),
    par = new Int32Array(N).fill(-1),
    H2 = heap(1024),
    DXs = [1, -1, 0, 0],
    DYs = [0, 0, 1, -1];
  for (const c of src) {
    for (let dr = 0; dr < 4; dr++) {
      dist[c * 4 + dr] = 0;
      H2.push(c * 4 + dr, 0);
    }
  }
  const goal = tp.y * W + tp.x;
  let end = -1,
    n = 0;
  while (H2.size && n++ < 400000) {
    const s = H2.pop(),
      dr = s & 3,
      c = s >> 2;
    if (c === goal) {
      end = s;
      break;
    }
    const y = Math.floor(c / W),
      x = c - y * W,
      dc = dist[s];
    for (let k = 0; k < 4; k++) {
      const nx = x + DXs[k],
        ny = y + DYs[k];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const v = ny * W + nx;
      if (bl[v] && v !== goal) continue;
      const horiz = k < 2,
        o = horiz ? hOcc[v] : vOcc[v],
        xo = horiz ? vOcc[v] : hOcc[v];
      if (o && o !== net) continue;
      let cst = 1 + (k !== dr ? 3 : 0) + (xo && xo !== net ? 5 : 0);
      if (xo && xo !== net && k !== dr) continue;
      const ns = v * 4 + k;
      if (dist[ns] > dc + cst) {
        dist[ns] = dc + cst;
        par[ns] = s;
        H2.push(ns, dc + cst);
      }
    }
  }
  if (end < 0) return null;
  const cs = [];
  let s = end;
  while (s >= 0) {
    cs.push(s);
    s = par[s];
  }
  cs.reverse();
  const pts = [],
    cells = [];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i] >> 2,
      y = Math.floor(c / W),
      x = c - y * W;
    cells.push(c);
    const k = cs[i] & 3;
    if (i > 0) {
      if (k < 2) hOcc[c] = net;
      else vOcc[c] = net;
      const pc = cs[i - 1] >> 2;
      if (k < 2) hOcc[pc] = hOcc[pc] || net;
      else vOcc[pc] = vOcc[pc] || net;
    }
    if (i === 0 || i === cs.length - 1 || (cs[i + 1] & 3) !== k) pts.push([x, y]);
  }
  return { pts, cells };
}
