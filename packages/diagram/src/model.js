// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/model: one model, every view. A part carries geometry, a material, a label, a text alternative, what it
   does, the physical quantity it carries, and where it goes when the model is taken apart. Links join parts.
   validate() refuses a model whose parts lack a label or a text alternative, so a screen reader always has words. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const v = D.v3;

  D.REQUIRED = ["id", "label", "alt", "fn", "geom"];

  /* Returns a list of problems; an empty list means the model is fit to draw. */
  D.validate = (def) => {
    const bad = [], ids = new Set();
    if (!def || !Array.isArray(def.parts) || !def.parts.length) return ["model has no parts"];
    def.parts.forEach((p, i) => {
      for (const k of D.REQUIRED) if (p[k] === undefined || p[k] === null || (typeof p[k] === "string" && !p[k].trim())) bad.push(`part ${p.id || "#" + i}: no ${k}`);
      if (p.id && ids.has(p.id)) bad.push(`part ${p.id}: duplicate id`);
      ids.add(p.id);
    });
    for (const l of def.links || []) for (const end of [l.from, l.to]) if (!ids.has(end)) bad.push(`link ${l.from} to ${l.to}: no part ${end}`);
    return bad;
  };

  /* Build every part's mesh in model space at its assembled pose, and its assembly axis. */
  D.compile = (def) => {
    const bad = D.validate(def);
    if (bad.length) throw new Error("model " + (def && def.id) + " refused: " + bad.join("; "));
    const parts = def.parts.map((p, i) => {
      const local = D.build(p.geom), pos = D.snap3(p.pos || [0, 0, 0]);
      const m = D.transformMesh(local, D.euler(p.rot), [0, 0, 0]);
      return { def: p, index: i, id: p.id, pos, base: Float64Array.from(m.pos), nrm: Float32Array.from(m.nrm), box: D.meshBox(m.pos) };
    });
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const P of parts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P.box.lo[k] + P.pos[k]); hi[k] = Math.max(hi[k], P.box.hi[k] + P.pos[k]); }
    const mid = lo.map((x, k) => (x + hi[k]) / 2), radius = 0.5 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
    for (const P of parts) {
      const e = P.def.explode || {};
      let axis = e.axis ? v.norm(e.axis) : v.norm(v.sub(v.add(P.pos, P.box.mid), mid));
      if (!v.len(axis)) axis = [0, 1, 0];
      P.axis = axis;
      P.dist = e.dist !== undefined ? e.dist : radius * 0.55;
      P.centroid = v.add(P.box.mid, [0, 0, 0]);
    }
    const index = new Map(parts.map((P) => [P.id, P]));
    return { def, parts, index, lo, hi, mid, radius, links: (def.links || []).map((l) => Object.assign({}, l)) };
  };

  /* Offset of a part at explode fraction s in [0, 1], on the snap grid. */
  D.offset = (P, s) => D.snap3(v.scale(P.axis, D.snap(s) * P.dist));
  /* Pose at fraction s; assembled() inverts it exactly. */
  D.exploded = (P, s) => { const o = D.offset(P, s); return [P.pos[0] + o[0], P.pos[1] + o[1], P.pos[2] + o[2]]; };
  D.assembled = (P, q, s) => { const o = D.offset(P, s); return [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; };

  /* World-space triangles of a part at a given translation (extra is a dynamic offset from the simulation). */
  D.worldTris = (P, t) => {
    const b = P.base, o = new Float64Array(b.length);
    for (let i = 0; i < b.length; i += 3) { o[i] = b[i] + t[0]; o[i + 1] = b[i + 1] + t[1]; o[i + 2] = b[i + 2] + t[2]; }
    return o;
  };

  /* Where a part's label hangs: the top of its box, at its current pose. */
  D.anchor = (P, t) => [P.box.mid[0] + t[0], P.box.hi[1] + t[1], P.box.mid[2] + t[2]];

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
