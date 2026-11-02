// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/scene: one draw list from the compiled model and the view's settings. Every renderer (GPU, CPU,
   picking, lens samples, frame hash) reads this list, so every view shows the same thing.
   view = { explode: 0..1, cut: { on, n, d }, xray, opacity: { id: a }, selected, state, tokens, overlay } */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});

  /* Materials name a record in packages/materials (lib) or a kit token (tok) for parts the library does not
     hold. hatch follows the drawing convention: a different angle or spacing per material class. */
  D.MATERIALS = {
    tungsten: { lib: "tungsten", hatch: { angle: 45, gap: 4 } },
    copper: { lib: "copper", hatch: { angle: 45, gap: 6 } },
    nickel: { lib: "nickel", hatch: { angle: 45, gap: 6 } },
    iron: { lib: "iron", hatch: { angle: 135, gap: 6 } },
    aluminium: { lib: "aluminium", hatch: { angle: 45, gap: 9 } },
    steel: { lib: "stainless_steel", hatch: { angle: 135, gap: 7 } },
    brass: { lib: "brass", hatch: { angle: 45, gap: 5 } },
    glass: { lib: "soda_lime_glass", alpha: 0.3, hatch: { angle: 0, gap: 8 } },
    silica: { lib: "fused_silica", alpha: 0.3, hatch: { angle: 0, gap: 8 } },
    pmma: { lib: "pmma", alpha: 0.45, hatch: { angle: 90, gap: 8 } },
    kapton: { lib: "kapton", hatch: { angle: 90, gap: 5 } },
    magnet: { tok: "s1", hatch: { angle: 135, gap: 4 } },
    ceramic: { tok: "wall2", hatch: { angle: 60, gap: 6 } },
    board: { tok: "s2", hatch: { angle: 30, gap: 8 } },
    electronics: { tok: "soft", hatch: { angle: 120, gap: 7 } },
    plastic: { tok: "line", hatch: { angle: 90, gap: 6 } },
    gas: { lib: "air", alpha: 0.12, hatch: { angle: 0, gap: 12 } },
  };

  D.tokenColor = (tokens, name) => D.rgb(tokens[name] || tokens.ink || "#16130f");

  /* Base colour: the library's sRGB preview, toned so metals read on the wall; otherwise the token. */
  D.baseColor = (mat, tokens, lib) => {
    const M = D.MATERIALS[mat] || D.MATERIALS.electronics;
    const rec = M.lib && lib && lib[M.lib];
    if (rec && rec.srgb && rec.srgb.value) return rec.srgb.value.map((x) => x * (tokens.dark ? 0.62 : 0.66));
    return D.tokenColor(tokens, M.tok || "soft");
  };

  D.styles = (model, view) => {
    const tk = view.tokens, st = (view.state && view.state.parts) || {}, accent = D.tokenColor(tk, "red");
    return model.parts.map((P) => {
      const M = D.MATERIALS[P.def.material] || D.MATERIALS.electronics, s = st[P.id] || {};
      let rgb = s.tok ? D.tokenColor(tk, s.tok) : s.rgb || D.baseColor(P.def.material, tk, view.lib);
      let alpha = s.alpha !== undefined ? s.alpha : M.alpha !== undefined ? M.alpha : 1;
      if (view.overlayStyle) { const o = view.overlayStyle(P, s); rgb = o.rgb; if (o.alpha !== undefined) alpha = o.alpha; }
      if (view.xray) alpha = Math.min(alpha, 0.28);
      if (view.opacity && view.opacity[P.id] !== undefined) alpha = view.opacity[P.id];
      if (view.selected === P.id) rgb = D.mix(rgb, accent, 0.45);
      return { rgb, alpha, emit: view.overlayStyle ? 0 : s.emit || 0, glow: s.glow, hatch: M.hatch, hidden: !!s.hidden };
    });
  };

  /* Current translation of a part: explode offset plus the simulation's own motion. */
  D.partShift = (P, view) => {
    const o = D.offset(P, view.explode || 0), s = view.state && view.state.parts && view.state.parts[P.id];
    return s && s.move ? [o[0] + s.move[0], o[1] + s.move[1], o[2] + s.move[2]] : o;
  };
  const pt = (P, sh) => D.v3.add(D.v3.add(P.pos, sh), P.box.mid);

  D.drawList = (model, view) => {
    const style = D.styles(model, view), cut = view.cut && view.cut.on ? view.cut : null, tk = view.tokens;
    const tris = [], triPart = [], caps = [], lines = [], points = [], labels = [];
    const ink = D.tokenColor(tk, "ink");
    const shifts = model.parts.map((P) => D.partShift(P, view));
    const n = cut ? D.v3.norm(cut.n) : null;
    model.parts.forEach((P, i) => {
      if (style[i].hidden) return;
      const W = D.worldTris(P, D.v3.add(P.pos, shifts[i])), before = triPart.length;
      for (let k = 0; k < W.length; k += 9) {
        const a = [W[k], W[k + 1], W[k + 2]], b = [W[k + 3], W[k + 4], W[k + 5]], c = [W[k + 6], W[k + 7], W[k + 8]];
        const out = cut ? D.clipTri(a, b, c, n, cut.d) : [[a, b, c]];
        for (const t of out) { tris.push(...t[0], ...t[1], ...t[2]); triPart.push(i); }
      }
      if (cut) {
        const sec = D.section(W, n, cut.d);
        if (sec.loops.length) caps.push({ part: i, loops: sec.loops, area: sec.area, rgb: D.mix(style[i].rgb, [1, 1, 1], tk.dark ? 0.05 : 0.25), ink, hatch: style[i].hatch });
      }
      if (triPart.length === before) return;   /* wholly cut away: no label */
      labels.push({ part: i, at: D.anchor(P, D.v3.add(P.pos, shifts[i])), text: P.def.label });
    });
    for (const L of model.links) {
      if (L.hide3d) continue;
      const a = model.index.get(L.from), b = model.index.get(L.to);
      lines.push({ pts: [pt(a, shifts[a.index]), pt(b, shifts[b.index])], rgb: D.mix(D.tokenColor(tk, "soft"), D.tokenColor(tk, "mat"), 0.25), alpha: 0.85, part: -1 });
    }
    const S = view.state || {};
    for (const l of S.lines || []) lines.push({ pts: l.pts, rgb: l.tok ? D.tokenColor(tk, l.tok) : l.rgb || ink, width: l.width || 1, part: l.part !== undefined ? l.part : -1 });
    for (const p of S.points || []) points.push({ p: p.p, r: p.r || 3, rgb: p.tok ? D.tokenColor(tk, p.tok) : p.rgb || ink, part: -1 });
    for (const b of S.boxes || []) {
      const m = D.build({ t: "box", size: b.size }), st = { rgb: b.tok ? D.tokenColor(tk, b.tok) : b.rgb || ink, alpha: b.alpha || 1, emit: 0 };
      style.push(st);
      const idx = style.length - 1;
      for (let k = 0; k < m.pos.length; k += 9) {
        const t = [0, 3, 6].map((o) => [m.pos[k + o] + b.pos[0], m.pos[k + o + 1] + b.pos[1], m.pos[k + o + 2] + b.pos[2]]);
        const out = cut ? D.clipTri(t[0], t[1], t[2], n, cut.d) : [t];
        for (const q of out) { tris.push(...q[0], ...q[1], ...q[2]); triPart.push(idx); }
      }
    }
    return { tris: Float64Array.from(tris), triPart: Int32Array.from(triPart), style, caps, lines, points, labels, nParts: model.parts.length };
  };

  /* The frame for a time and a view: the simulation's state, then the draw list. Pure: same input, same list. */
  D.frame = (model, sim, u, view) => D.drawList(model, Object.assign({}, view, { state: sim ? sim.state(u, view) : null }));

  /* Camera that frames the model. */
  D.homeCamera = (model, c = {}) => ({ yaw: c.yaw !== undefined ? c.yaw : 0.6, pitch: c.pitch !== undefined ? c.pitch : 0.42, dist: (c.zoom || 2.6) * model.radius, target: model.mid.slice(), fov: 0.7 });

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
