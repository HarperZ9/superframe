// SPDX-License-Identifier: FSL-1.1-MIT
import { DES } from "./constants.js";
import { courtyard } from "./netlist.js";
import { planeRaster } from "./plane.js";
import { bbox, primDist, prims, sweep } from "./copper.js";
// ======================================================================= Design rule check
export function ipc2221Width(I, dT, t, ext) {
  const k = ext ? 0.048 : 0.024,
    A = Math.pow(I / (k * Math.pow(dT, 0.44)), 1 / 0.725);
  return (A / (t / 0.0254)) * 0.0254;
}
// IPC-2221 current curve: A in mil^2, result in mm
export function drc(d, rules) {
  rules = rules || d.rules;
  const V = [],
    add = (rule, msg, x, y) => V.push({ rule, msg, x, y });
  const f = (n) => n.toFixed(3);
  for (const t of d.tracks) {
    if (t.w < rules.trace - 1e-9)
      add(
        "trace width",
        "track " + f(t.w) + " mm, class minimum " + f(rules.trace),
        (t.x1 + t.x2) / 2,
        (t.y1 + t.y2) / 2
      );
  }
  for (const v of d.vias) {
    if (v.d < rules.drill - 1e-9)
      add("drill", "via drill " + f(v.d) + ", minimum " + f(rules.drill), v.x, v.y);
    if ((v.pad - v.d) / 2 < rules.ring - 1e-9)
      add(
        "annular ring",
        "via ring " + f((v.pad - v.d) / 2) + ", minimum " + f(rules.ring),
        v.x,
        v.y
      );
  }
  for (const p of d.parts)
    for (const q of p.pads)
      if (q.th) {
        if (q.drill < rules.drill - 1e-9)
          add("drill", p.ref + "." + q.pin + " drill " + f(q.drill), q.x, q.y);
        if ((Math.min(q.w, q.h) - q.drill) / 2 < rules.ring - 1e-9)
          add(
            "annular ring",
            p.ref + "." + q.pin + " ring " + f((Math.min(q.w, q.h) - q.drill) / 2),
            q.x,
            q.y
          );
      }
  const outer = d.layers === 2 ? [0, 1] : [0, 3];
  for (const l of outer) {
    const P = prims(d, l);
    for (const p of P) {
      const b = bbox(p);
      const m = Math.min(b[0], b[1], d.W - b[2], d.H - b[3]);
      if (m < rules.edge - 1e-9)
        add(
          "edge clearance",
          p.id + " is " + f(m) + " from the edge, minimum " + f(rules.edge),
          (b[0] + b[2]) / 2,
          (b[1] + b[3]) / 2
        );
    }
    sweep(P, rules.space, (a, b) => {
      if (a.net === b.net && a.net !== 0) return;
      if (a.id === b.id) return;
      const g = primDist(a, b),
        bb = bbox(a),
        mx = (bb[0] + bb[2]) / 2,
        my = (bb[1] + bb[3]) / 2;
      if (g <= 1e-9) add("short", "L" + (l + 1) + " " + a.id + " touches " + b.id, mx, my);
      else if (g < rules.space - 1e-6)
        add(
          "clearance",
          "L" +
            (l + 1) +
            " " +
            a.id +
            " to " +
            b.id +
            " is " +
            f(g) +
            ", minimum " +
            f(rules.space),
          mx,
          my
        );
    });
  }
  const dr = d.vias
    .map((v) => ({ x: v.x, y: v.y, d: v.d }))
    .concat(d.holes)
    .concat(
      d.parts.flatMap((p) =>
        p.pads.filter((q) => q.th).map((q) => ({ x: q.x, y: q.y, d: q.drill }))
      )
    );
  for (let i = 0; i < dr.length; i++)
    for (let j = 0; j < i; j++) {
      const g = Math.hypot(dr[i].x - dr[j].x, dr[i].y - dr[j].y) - dr[i].d / 2 - dr[j].d / 2;
      if (g < rules.space) add("hole spacing", "holes " + f(g) + " apart", dr[i].x, dr[i].y);
    }
  for (const h of d.holes)
    for (const l of outer)
      for (const p of prims(d, l)) {
        const g = primDist({ k: "c", x1: h.x, y1: h.y, x2: h.x, y2: h.y, r: h.d / 2 }, p);
        if (g < rules.space)
          add("hole to copper", "mount hole near " + p.id + ", " + f(g), h.x, h.y);
      }
  const pads = d.parts.flatMap((p) => p.pads);
  for (let i = 0; i < pads.length; i++)
    for (let j = 0; j < i; j++) {
      const a = pads[i],
        b = pads[j];
      if (a.net === b.net && a.net) continue;
      const dx = Math.abs(a.x - b.x) - (a.w + b.w) / 2 - 2 * DES.maskGrow,
        dy = Math.abs(a.y - b.y) - (a.h + b.h) / 2 - 2 * DES.maskGrow,
        g = dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
      if (g < rules.web)
        add(
          "mask web",
          a.ref + "." + a.pin + " to " + b.ref + "." + b.pin + " web " + f(g),
          a.x,
          a.y
        );
    }
  for (let i = 0; i < d.parts.length; i++)
    for (let j = 0; j < i; j++) {
      const A = courtyard(d.parts[i]),
        B = courtyard(d.parts[j]);
      if (
        Math.min(A[2], B[2]) > Math.max(A[0], B[0]) &&
        Math.min(A[3], B[3]) > Math.max(A[1], B[1])
      )
        add(
          "part overlap",
          d.parts[i].ref + " overlaps " + d.parts[j].ref,
          d.parts[i].x,
          d.parts[i].y
        );
    }
  for (const o of connectivity(d).opens)
    add("open", "net " + o.net + " splits into " + o.groups + " pieces, from " + o.first, o.x, o.y);
  for (const c of d.dc || []) {
    const n = d.nets.find((q) => q.name === c.net);
    if (!n) continue;
    for (const t of d.tracks)
      if (t.net === n.id) {
        const req = ipc2221Width(c.I, 10, d.stack.cu[t.l], t.l === 0 || t.l === d.layers - 1);
        if (t.w < req) {
          add(
            "current width",
            c.net + " carries " + c.I + " A; IPC-2221 wants " + f(req) + " mm for a 10 C rise",
            (t.x1 + t.x2) / 2,
            (t.y1 + t.y2) / 2
          );
          break;
        }
      }
  }
  return V;
}
export function connectivity(d) {
  const ids = new Map(),
    par = [];
  const id = (k) => {
      if (!ids.has(k)) {
        ids.set(k, par.length);
        par.push(par.length);
      }
      return ids.get(k);
    },
    fd = (a) => {
      while (par[a] !== a) {
        par[a] = par[par[a]];
        a = par[a];
      }
      return a;
    },
    un = (a, b) => {
      par[fd(a)] = fd(b);
    };
  const outer = d.layers === 2 ? [0, 1] : [0, 3];
  for (const l of outer) {
    const P = prims(d, l);
    sweep(P, 0.001, (a, b) => {
      if (a.net === b.net && a.net && primDist(a, b) <= 1e-6) un(id(a.id), id(b.id));
    });
  }
  for (const pl of d.planes || []) {
    const m = planeRaster(d, pl);
    const own = d.vias
      .map((v, i) => ({ v, k: "v" + i }))
      .filter((o) => o.v.net === pl.net)
      .concat(
        d.parts.flatMap((p) =>
          p.pads
            .filter((q) => q.th && q.net === pl.net)
            .map((q) => ({ v: q, k: p.ref + "." + q.pin }))
        )
      );
    for (const o of own) {
      const c = m.label[m.at(o.v.x, o.v.y)];
      if (c) un(id(o.k), id("plane" + pl.l + "#" + c));
    }
  }
  const opens = [];
  for (const n of d.nets) {
    const roots = new Set(),
      ps = n.pins;
    for (const [r, q] of ps) roots.add(fd(id(r + "." + q)));
    if (ps.length > 1 && roots.size > 1) {
      const p = d.padMap[ps[0][0] + "." + ps[0][1]];
      opens.push({ net: n.name, groups: roots.size, first: ps[0].join("."), x: p.x, y: p.y });
    }
  }
  return { opens };
}
export function cloneDesign(d) {
  const c = Object.assign({}, d);
  c.tracks = d.tracks.map((t) => ({ ...t }));
  c.vias = d.vias.map((v) => ({ ...v }));
  return c;
}
export function plantViolations(d0) {
  const out = [],
    mk = () => cloneDesign(d0),
    R = d0.rules;
  const a = mk();
  a.tracks[0].w = R.trace * 0.6;
  out.push({ name: "thin trace", rule: "trace width", d: a });
  const b = mk();
  const tt = b.tracks.find((t) => Math.hypot(t.x2 - t.x1, t.y2 - t.y1) > 1) || b.tracks[0];
  const ang = Math.atan2(tt.y2 - tt.y1, tt.x2 - tt.x1),
    nx = -Math.sin(ang),
    ny = Math.cos(ang),
    gap = tt.w + R.space * 0.5;
  b.tracks.push({
    net: 999,
    l: tt.l,
    x1: tt.x1 + nx * gap,
    y1: tt.y1 + ny * gap,
    x2: tt.x2 + nx * gap,
    y2: tt.y2 + ny * gap,
    w: tt.w,
  });
  out.push({ name: "tracks too close", rule: "clearance", d: b });
  const c = mk();
  if (c.vias.length) {
    c.vias[0].d = 0.2;
    c.vias[0].pad = 0.5;
  } else c.vias.push({ net: 1, x: d0.W / 2, y: d0.H / 2, d: 0.2, pad: 0.5 });
  out.push({ name: "small drill", rule: "drill", d: c });
  const e = mk();
  if (e.vias.length) e.vias[0].pad = e.vias[0].d + 0.1;
  else e.vias.push({ net: 1, x: d0.W / 2, y: d0.H / 2, d: 0.3, pad: 0.4 });
  out.push({ name: "thin annular ring", rule: "annular ring", d: e });
  const f = mk();
  f.tracks.push({ net: 999, l: 0, x1: 0.1, y1: d0.H / 2, x2: 3, y2: d0.H / 2, w: 0.2 });
  out.push({ name: "copper at the edge", rule: "edge clearance", d: f });
  const g = mk();
  const sig = g.nets.find((n) => n.kind === "signal" && n.pins.length >= 2),
    idx = g.tracks.findIndex((t) => t.net === sig.id);
  g.tracks.splice(idx, 1);
  out.push({ name: "cut track", rule: "open", d: g });
  const h = mk();
  const tb = h.tracks.find((t) => t.l === 0) || h.tracks[0],
    o2 = h.nets.find((n) => n.id !== tb.net);
  h.tracks.push({ net: o2.id, l: tb.l, x1: tb.x1, y1: tb.y1, x2: tb.x2, y2: tb.y2, w: tb.w });
  out.push({ name: "short over a track", rule: "short", d: h });
  return out;
}
