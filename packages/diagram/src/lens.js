// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/lens: every view states what it keeps and what it drops, and how many bits that costs.
   The measure follows perceive/loss: take seeded samples of the model's surface, code each one by its voxel
   (1/24 of the model's radius per axis), and code what the view still shows of it. The bits lost are
   H(X | Y) = H(X, Y) - H(Y), computed with Perceive.entropy: what a reader of this view cannot recover about
   where the sample is. The number holds for this sample and this quantisation, and says nothing finer. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});

  D.LENS = {
    schematic: { name: "2D schematic", keeps: ["which part joins which", "what each part does", "the order a signal passes through"], drops: ["shape, size and depth", "where parts sit in the box", "anything inside a part"] },
    model: { name: "3D model", keeps: ["shape and placement", "the near surface of every part"], drops: ["whatever hides behind a nearer surface", "the inside of every solid", "one axis of depth, flattened onto the screen"] },
    exploded: { name: "Exploded view", keeps: ["every part's shape", "the assembly axis each part leaves along", "the order of assembly"], drops: ["true distances between parts", "contact: parts that touch are drawn apart"] },
    section: { name: "Cross-section", keeps: ["the exact outline of every solid in the cutting plane", "wall thickness and cavities, hatched"], drops: ["everything on the cut-away side of the plane"] },
    xray: { name: "X-ray", keeps: ["every part at once, hidden ones included", "which part covers which pixel"], drops: ["which surface is in front: depth order is lost", "surface shading and colour, washed out"] },
    time: { name: "Time", keeps: ["the order and rate of change", "the values the model computes at each step"], drops: ["detail between computed steps", "noise and effects the model leaves out (see the working)"] },
    spacetime: { name: "Spacetime (4D)", keeps: ["the whole history at once, time as a fourth axis", "which events come before which"], drops: ["the instant: every moment is shown together", "one axis, after the 4D turn, flattened by the lens"] },
  };

  /* Seeded, area-weighted surface samples of the assembled model. */
  D.surfaceSamples = (model, n = 2400, seed = 7) => {
    const rnd = D.rng(seed), areas = [], refs = [];
    let total = 0;
    model.parts.forEach((Pt, i) => {
      const b = Pt.base;
      for (let k = 0; k < b.length; k += 9) {
        const e1 = [b[k + 3] - b[k], b[k + 4] - b[k + 1], b[k + 5] - b[k + 2]], e2 = [b[k + 6] - b[k], b[k + 7] - b[k + 1], b[k + 8] - b[k + 2]];
        const a = 0.5 * D.v3.len(D.v3.cross(e1, e2));
        total += a; areas.push(total); refs.push([i, k]);
      }
    });
    const out = [];
    for (let s = 0; s < n; s++) {
      const r = rnd() * total;
      let lo = 0, hi = areas.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (areas[m] < r) lo = m + 1; else hi = m; }
      const [i, k] = refs[lo], b = model.parts[i].base;
      let u = rnd(), w = rnd();
      if (u + w > 1) { u = 1 - u; w = 1 - w; }
      const p = [0, 1, 2].map((c) => b[k + c] + u * (b[k + 3 + c] - b[k + c]) + w * (b[k + 6 + c] - b[k + c]));
      out.push({ part: i, p: D.v3.add(p, model.parts[i].pos) });
    }
    return out;
  };

  const condBits = (D.condBits = (xs, ys) => {
    const H = g.Perceive && g.Perceive.entropy;
    if (!H) return null;
    const joint = xs.map((x, i) => x + "#" + ys[i]);
    const hx = H(xs), hy = H(ys), hxy = H(joint), lost = hxy - hy;
    return { source: hx, kept: hx - lost, lost: Math.abs(lost) < 1e-12 ? 0 : lost };
  });

  /* Bits lost by a view. kind: schematic, or a 3D view kind; for 3D views a small raster gives occlusion. */
  D.lensBits = (model, view, kind, orbit, aspect, samples) => {
    samples = samples || (model._samples = model._samples || D.surfaceSamples(model));
    const q = model.radius / 24, code = (p) => p.map((x) => Math.floor(x / q)).join(",");
    const xs = samples.map((s) => code(s.p));
    if (kind === "schematic") return condBits(xs, samples.map((s) => model.parts[s.part].id));
    const small = D.camera(orbit, 160, Math.max(60, Math.round(160 / (aspect || 1.6))));
    const list = D.drawList(model, view), R = D.raster(list, small);
    const cut = view.cut && view.cut.on ? view.cut : null, n = cut && D.v3.norm(cut.n);
    const ys = samples.map((s) => {
      const Pt = model.parts[s.part], p = D.v3.add(s.p, D.partShift(Pt, view));
      if (cut && D.v3.dot(n, p) > cut.d) return "cut away";
      const sc = small.toScreen(p), x = Math.floor(sc[0]), y = Math.floor(sc[1]);
      if (x < 0 || y < 0 || x >= small.w || y >= small.h || sc[3] <= 0) return "off screen";
      const pix = x + "," + y;
      if (view.xray) return pix + "|" + s.part;
      const z = R.depth[y * small.w + x];
      const tol = (0.04 * model.radius * 0.2) / (sc[3] * sc[3]);   /* 4% of the radius, in NDC depth at this distance */
      return Math.abs(sc[2] - z) < tol ? pix + "|" + Math.round(sc[2] * 4096) : "hidden";
    });
    return condBits(xs, ys);
  };

  D.lensText = (kind, bits) => {
    const L = D.LENS[kind];
    const b = bits ? ` Bits lost: ${bits.lost.toFixed(1)} of ${bits.source.toFixed(1)} per sample.` : "";
    return { name: L.name, keeps: L.keeps, drops: L.drops, line: `Keeps ${L.keeps.join("; ")}. Drops ${L.drops.join("; ")}.${b}` };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
