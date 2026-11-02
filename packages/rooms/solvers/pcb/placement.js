// SPDX-License-Identifier: FSL-1.1-MIT
import { rng32 } from "./constants.js";
import { courtyard, padGeo } from "./netlist.js";
// ======================================================================= Placement: annealed wirelength with fixed parts honoured
export function place(d, seed) {
  const R = rng32(seed || 7),
    mv = d.parts.filter((p) => !p.fixed),
    m = 1.2,
    edge = 0.9;
  const netsOf = new Map();
  d.nets.forEach((n) =>
    n.pins.forEach(([r]) => {
      if (!netsOf.has(r)) netsOf.set(r, []);
      netsOf.get(r).push(n);
    })
  );
  const byRef = Object.fromEntries(d.parts.map((p) => [p.ref, p]));
  const hp = (n) => {
    let a = 1e9,
      b = -1e9,
      c = 1e9,
      e = -1e9;
    for (const [r, q] of n.pins) {
      const p = byRef[r],
        g = padGeo(
          p,
          p.f.pads.find((z) => z.pin === q)
        );
      a = Math.min(a, g.x);
      b = Math.max(b, g.x);
      c = Math.min(c, g.y);
      e = Math.max(e, g.y);
    }
    return (b - a + e - c) * (n.kind === "power" ? 0.2 : 1);
  };
  const ov = (a, b) => {
    const A = courtyard(a),
      B = courtyard(b),
      w = Math.min(A[2], B[2]) - Math.max(A[0], B[0]) + m,
      h = Math.min(A[3], B[3]) - Math.max(A[1], B[1]) + m;
    return w > 0 && h > 0 ? w * h : 0;
  };
  const hol = (p) => {
    const A = courtyard(p);
    let s = 0;
    for (const h of d.holes) {
      const dx = Math.max(A[0] - h.x, 0, h.x - A[2]),
        dy = Math.max(A[1] - h.y, 0, h.y - A[3]);
      const k = 2.2 + 0.6 - Math.hypot(dx, dy);
      if (k > 0) s += k * k * 4;
    }
    return s;
  };
  const out = (p) => {
    const A = courtyard(p);
    return (
      Math.max(0, edge - A[0]) +
      Math.max(0, edge - A[1]) +
      Math.max(0, A[2] - d.W + edge) +
      Math.max(0, A[3] - d.H + edge)
    );
  };
  const cost = (p) => {
    let c = 0;
    for (const n of netsOf.get(p.ref) || []) c += hp(n);
    for (const o of d.parts) if (o !== p) c += 30 * ov(p, o);
    return c + 30 * hol(p) + 60 * out(p);
  };
  mv.forEach((p) => {
    p.x = d.W * (0.3 + 0.4 * R());
    p.y = d.H * (0.3 + 0.4 * R());
    p.rot = 0;
  });
  const N = Math.min(12000, mv.length * 1200);
  let T = Math.max(d.W, d.H) / 4;
  const dec = Math.pow(0.02 / T, 1 / Math.max(1, N));
  for (let i = 0; i < N && mv.length; i++) {
    const p = mv[Math.floor(R() * mv.length)],
      x = p.x,
      y = p.y,
      r = p.rot,
      c0 = cost(p);
    if (R() < 0.15) p.rot = (p.rot + 90) % 360;
    else {
      p.x += (R() - 0.5) * T * 2;
      p.y += (R() - 0.5) * T * 2;
    }
    p.x = Math.max(0.5, Math.min(d.W - 0.5, p.x));
    p.y = Math.max(0.5, Math.min(d.H - 0.5, p.y));
    const c1 = cost(p);
    if (c1 > c0 && R() > Math.exp((c0 - c1) / T)) {
      p.x = x;
      p.y = y;
      p.rot = r;
    }
    T *= dec;
  }
  mv.forEach((p) => {
    p.x = Math.round(p.x * 10) / 10;
    p.y = Math.round(p.y * 10) / 10;
  });
  for (const p of d.parts)
    p.pads = p.f.pads.map((q) => {
      const g = padGeo(p, q);
      g.pin = q.pin;
      g.ref = p.ref;
      g.net = 0;
      return g;
    });
  const pm = Object.fromEntries(
    d.parts.flatMap((p) => p.pads.map((g) => [p.ref + "." + g.pin, g]))
  );
  d.nets.forEach((n) =>
    n.pins.forEach(([r, q]) => {
      pm[r + "." + q].net = n.id;
    })
  );
  d.padMap = pm;
  return d;
}
