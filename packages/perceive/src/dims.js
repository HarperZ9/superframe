// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive/dims: the bridge to ndim. A shape in n dimensions is turned with ndim's plane rotations, its first
   three coordinates are kept as space, and each further coordinate is carried by a sense the reader picks:
   time (a slice sweeping through), colour (hue), sound (pitch) or touch (pulse length). The loss reporter
   counts how many corners land on top of each other once the senses have had their say.
   ndim is passed in (P.dimBridge(NDim, ...)), never copied: packages/ndim/src. */
(function (g) {
  "use strict";
  const P = (g.Perceive = g.Perceive || {});
  P.AXIS_NAMES = "xyzwvu";

  /* A channel maps a coordinate in [-r, r] to a sense and back. Each has its quantum (the step a person can
     tell apart), used by the loss reporter. */
  P.channel = (name, r) => {
    const src = P.window(-r, r, "linear");
    const spec = {
      colour: [P.window(440, 640, "linear"), (y) => Math.round(y / P.JND.visibleNm), "nm"],
      sound: [P.window(220, 880, "log"), (y) => Math.round(Math.log(y) / Math.log1p(P.JND.pitchRel)), "Hz"],
      touch: [P.window(10, 90, "linear"), (y) => Math.round(y / 10), "ms pulse"],
      time: [P.window(0, 4, "linear"), (y) => Math.round(y * 30), "s into the sweep"],
    }[name];
    if (!spec) return null;
    const br = P.bridge(src, spec[0]);
    return { name, unit: spec[2], map: br.map, inverse: br.inverse, quantum: spec[1] };
  };

  P.dimBridge = (N, poly, angles, assign = {}) => {
    const n = poly.n, R = angles && angles.length ? N.rotationFromAngles(n, angles) : N.identity(n);
    const rmax = Math.max(...poly.verts.map((v) => N.norm(v)));
    const verts = poly.verts.map((v) => N.matVec(R, v));
    const chans = [];
    for (let k = 3; k < n; k++) chans.push(P.channel(assign[P.AXIS_NAMES[k]] || "none", rmax));
    const q = (x) => Math.round(x * 1e6);
    const loss = P.lossBits(verts, (v) => v.slice(0, 3).map(q).concat(chans.map((c, i) => (c ? c.quantum(c.map(v[3 + i])) : "-"))));
    loss.bitsSource = P.entropy(verts.map((v) => v.map(q).join("|")));
    loss.bitsLost = loss.bitsSource - loss.bitsKept;
    if (Math.abs(loss.bitsLost) < 1e-12) loss.bitsLost = 0;
    const rows = verts.map((v) => ({ p: v.slice(0, 3), extra: v.slice(3), out: chans.map((c, i) => (c ? c.map(v[3 + i]) : null)) }));
    return { rows, chans, rmax, R, loss, lens: N.LENSES.orthographic };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof globalThis !== "undefined" ? globalThis : this);
