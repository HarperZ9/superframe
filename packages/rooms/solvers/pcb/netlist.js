// SPDX-License-Identifier: FSL-1.1-MIT
import { DES, RULES, STACKS } from "./constants.js";
import { footprint, rot } from "./footprints.js";
// ======================================================================= Netlist text to design
export function arrayPositions(n, shape, pitch) {
  const p = [];
  if (shape === "honeycomb") {
    const q = [];
    for (let a = -9; a <= 9; a++)
      for (let b = -9; b <= 9; b++) q.push([pitch * (a + b / 2), (pitch * b * Math.sqrt(3)) / 2]);
    q.sort(
      (u, v) =>
        u[0] * u[0] + u[1] * u[1] - (v[0] * v[0] + v[1] * v[1]) ||
        Math.atan2(u[1], u[0]) - Math.atan2(v[1], v[0])
    );
    return q.slice(0, n);
  }
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < n; k++) {
    const r = Math.sqrt(k + 0.5);
    p.push([r * Math.cos(k * ga), r * Math.sin(k * ga)]);
  }
  let m = 1e9;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < i; j++) m = Math.min(m, Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]));
  return p.map((a) => [(a[0] * pitch) / m, (a[1] * pitch) / m]);
}
export function parseNetlist(text, forceLayers) {
  const d = {
      title: "board",
      W: 30,
      H: 20,
      layers: 2,
      parts: [],
      nets: [],
      dc: [],
      errors: [],
      arrayInfo: null,
      mask: "purple",
    },
    byRef = {},
    kv = (t) => {
      const o = {},
        a = [];
      for (const s of t) {
        const m = /^(\w+)=(.+)$/.exec(s);
        if (m) o[m[1]] = m[2];
        else a.push(s);
      }
      return [a, o];
    };
  const addPart = (ref, fp, o, line) => {
    const f = footprint(fp);
    if (!f) {
      d.errors.push("line " + line + ": unknown footprint " + fp);
      return;
    }
    if (byRef[ref]) {
      d.errors.push("line " + line + ": " + ref + " declared twice");
      return;
    }
    const p = {
      ref,
      fp,
      value: o.value || "",
      P: +(o.P || 0),
      x: 0,
      y: 0,
      rot: 0,
      fixed: false,
      f,
    };
    byRef[ref] = p;
    d.parts.push(p);
    return p;
  };
  const addNet = (name, kind, o, pins, line) => {
    const pl = [];
    for (const s of pins) {
      const m = /^(\w+)\.(\w+)$/.exec(s);
      if (!m || !byRef[m[1]]) {
        d.errors.push("line " + line + ": bad pin " + s);
        continue;
      }
      if (!byRef[m[1]].f.pads.some((q) => q.pin === m[2])) {
        d.errors.push("line " + line + ": " + m[1] + " has no pad " + m[2]);
        continue;
      }
      pl.push([m[1], m[2]]);
    }
    d.nets.push({ name, id: d.nets.length + 1, kind, width: +(o.width || DES.w), pins: pl });
  };
  const L = text.split(/\r?\n/);
  L.forEach((raw, i) => {
    const ln = i + 1,
      s = raw.replace(/#.*/, "").trim();
    if (!s) return;
    const t = s.split(/\s+/),
      c = t[0],
      [a, o] = kv(t.slice(1));
    if (c === "board") {
      d.W = +a[0];
      d.H = +a[1];
      if (!(d.W >= 8 && d.W <= 120 && d.H >= 8 && d.H <= 120))
        d.errors.push("line " + ln + ": board size must be 8 to 120 mm");
      if (o.layers) d.layers = +o.layers;
      if (o.title) d.title = o.title;
      if (o.mask) d.mask = o.mask;
      if (d.layers !== 2 && d.layers !== 4) d.errors.push("line " + ln + ": layers must be 2 or 4");
    } else if (c === "part") {
      addPart(a[0], a[1], o, ln);
    } else if (c === "fix") {
      const p = byRef[a[0]];
      if (!p) d.errors.push("line " + ln + ": unknown part " + a[0]);
      else {
        p.x = +a[1];
        p.y = +a[2];
        p.rot = +(a[3] || 0);
        p.fixed = true;
      }
    } else if (c === "net") {
      addNet(a[0], "signal", o, a.slice(1), ln);
    } else if (c === "power") {
      addNet(a[0], "power", o, a.slice(1), ln);
    } else if (c === "dc") {
      d.dc.push({ net: a[0], I: +a[1], from: a[2], to: a[3] });
    } else if (c === "array") {
      const n = +a[1],
        shape = a[2],
        pitch = +(o.pitch || 5),
        fp = o.part || "PD0805",
        cx = +(o.cx || d.W / 2),
        cy = +(o.cy || d.H / 2),
        rA = (+(o.rot || 0) * Math.PI) / 180,
        P = arrayPositions(n, shape, pitch).map((q) => [
          q[0] * Math.cos(rA) - q[1] * Math.sin(rA),
          q[0] * Math.sin(rA) + q[1] * Math.cos(rA),
        ]);
      let mind = 1e9;
      for (let u = 0; u < n; u++)
        for (let v = 0; v < u; v++)
          mind = Math.min(mind, Math.hypot(P[u][0] - P[v][0], P[u][1] - P[v][1]));
      d.arrayInfo = {
        n,
        shape,
        pitch: mind,
        radius: Math.max(...P.map((q) => Math.hypot(q[0], q[1]))),
        prefix: a[0],
      };
      P.forEach((q, k) => {
        const ref = a[0] + (k + 1),
          pp = addPart(ref, fp, { value: o.value || "sensor", P: o.P || 0 }, ln);
        if (pp) {
          pp.x = Math.round((cx + q[0]) * 100) / 100;
          pp.y = Math.round((cy + q[1]) * 100) / 100;
          pp.fixed = true;
          pp.rot = 0;
          pp.arr = true;
        }
      });
    } else d.errors.push("line " + ln + ": unknown word " + c);
  });
  if (forceLayers) d.layers = forceLayers;
  const seen = {};
  d.nets.forEach((n) =>
    n.pins.forEach(([r, q]) => {
      const k = r + "." + q;
      if (seen[k]) d.errors.push("pin " + k + " is on two nets, " + seen[k] + " and " + n.name);
      seen[k] = n.name;
    })
  );
  d.stack = STACKS[d.layers];
  d.rules = RULES[d.layers];
  d.holes = [];
  if (d.W >= 20 && d.H >= 20)
    for (const [x, y] of [
      [2.5, 2.5],
      [d.W - 2.5, 2.5],
      [2.5, d.H - 2.5],
      [d.W - 2.5, d.H - 2.5],
    ])
      d.holes.push({ x, y, d: 2.2 });
  return d;
}
export function padGeo(p, q) {
  const [x, y] = rot(q.x, q.y, p.rot),
    sw = p.rot % 180 !== 0;
  return {
    x: p.x + x,
    y: p.y + y,
    w: sw ? q.h : q.w,
    h: sw ? q.w : q.h,
    th: !!q.th,
    drill: q.drill || 0,
    round: !!q.round,
  };
}
export function bodyBox(p) {
  const b = p.f.body,
    sw = p.rot % 180 !== 0;
  return { x: p.x, y: p.y, w: sw ? b[1] : b[0], h: sw ? b[0] : b[1], z: b[2] };
}
export function courtyard(p) {
  const bb = bodyBox(p);
  let a = p.x - bb.w / 2,
    b = p.x + bb.w / 2,
    c = p.y - bb.h / 2,
    e = p.y + bb.h / 2;
  for (const q of p.f.pads) {
    const g = padGeo(p, q);
    a = Math.min(a, g.x - g.w / 2);
    b = Math.max(b, g.x + g.w / 2);
    c = Math.min(c, g.y - g.h / 2);
    e = Math.max(e, g.y + g.h / 2);
  }
  return [a, c, b, e];
}
