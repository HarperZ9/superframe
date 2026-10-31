// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim page, toy layer: spin a polytope with one knob per rotation plane, slide a cutting hyperplane
   through it, change the lens, and the powers-of-dimension strip. */
(function () {
  "use strict";
  const N = window.NDim, D = window.NDraw, $ = (s) => document.querySelector(s);
  const SHAPES = { tesseract: ["cube", 4], "5-cell": ["simplex", 4], "16-cell": ["cross", 4], "24-cell": ["24-cell"],
    "600-cell": ["600-cell"], "120-cell": ["120-cell"], penteract: ["cube", 5], "5-simplex": ["simplex", 5], "5-orthoplex": ["cross", 5] };
  /* Knob order: the six 4D planes first, then the four planes that need a fifth axis. */
  const KNOB_PLANES = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3], [0, 4], [1, 4], [2, 4], [3, 4]];
  const cache = new Map();
  const st = { shape: "tesseract", lens: "perspective", cut: 0, show: true, sweeping: 0 };

  function shape(name) {
    if (!cache.has(name)) {
      const [k, n] = SHAPES[name], P = N.polytope(k, n);
      cache.set(name, { P, L: N.faceLattice(P.verts, P.edges), R0: Math.max(...P.verts.map(N.norm)) });
    }
    return cache.get(name);
  }
  function rotation(n) {
    const angles = N.planes(n).map(() => 0);
    KNOB_PLANES.forEach(([i, j], k) => {
      if (j >= n) return;
      const idx = N.planes(n).findIndex(([a, b]) => a === i && b === j);
      angles[idx] = (+$("#k" + k).value * Math.PI) / 180;
    });
    return N.rotationFromAngles(n, angles);
  }
  function lensView(S, R) {
    const { P, L } = S, n = P.n;
    if (st.lens === "schlegel") {
      const sch = N.schlegel(P, L, 0);
      const R3 = rotation(3), pts = sch.pts.map((p) => N.matVec(R3, D.toThree(p, "perspective", 3.2).slice(0, 3)));
      const r = P.edges.map(([a, b]) => N.dist(pts[a], pts[b]) / N.dist(P.verts[a], P.verts[b]));
      const hi = Math.max(...r), lo = Math.min(...r);
      return { pts3: pts, lens: sch.lens, spread: (hi - lo) / hi, note: " Only the xy, xz and yz knobs turn this view." };
    }
    const v = N.view(P, st.lens, n, { R });
    const pts3 = (st.lens === "stereographic" ? P.verts.map((p) => N.matVec(R, N.normalize(p))) : P.verts.map((p) => N.matVec(R, p))).map((p) => D.toThree(p, st.lens, 1.9 * S.R0));
    const v3 = N.view(P, st.lens, 3, { R, d: 1.9 * S.R0 });
    return { pts3, lens: v.lens, spread: v3.distortion.value, note: "" };
  }
  function drawMain() {
    const S = shape(st.shape), { P, L, R0 } = S, n = P.n, T = D.tokens();
    const R = rotation(n), V = P.verts.map((p) => N.matVec(R, p));
    const { ctx, w, h } = D.fit($("#cv-main"), 0.62);
    const view = lensView(S, R), cam = D.camera();
    const c3 = view.pts3.map(cam), scale = D.autoscale(c3, w, h, 0.84), scr = D.screen(w, h, scale);
    const P2 = c3.map(scr);
    D.edges(ctx, P2, P.edges, T.ink, P.verts.length > 200 ? 0.7 : 1.6, P.verts.length > 200 ? 0.6 : 1);
    const u = N.zeros(n); u[n - 1] = 1;
    const s = (st.cut / 200) * R0;
    let segs = [];
    if (st.show) segs = N.sliceSegments(V, L, u, s);
    if (st.show && st.lens !== "schlegel") {
      for (const [a, b] of segs) {
        const to = (p) => scr(cam(D.toThree(st.lens === "stereographic" ? N.normalize(p) : p, st.lens, 1.9 * R0)));
        const A = to(a), B = to(b);
        D.path(ctx, [A, B], T.red, 3);
      }
    }
    const k = view.lens;
    $("#cap-main").textContent = `Lens: ${k.name}. Keeps ${k.keeps.join("; ")}. Loses ${k.loses.join("; ")}. Edge spread ${D.fmt(view.spread)} (0 means every edge scales alike).${view.note}` + (st.show && st.lens === "schlegel" ? " The slice is drawn in the panel beside." : "");
    drawSlice(S, V, segs, s, u);
  }
  function drawSlice(S, V, segs, s, u) {
    const { P, L } = S, n = P.n, T = D.tokens();
    const { ctx, w, h } = D.fit($("#cv-slice"), 0.93);
    if (!st.show || !segs.length) {
      D.label(ctx, st.show ? "The plane misses the shape here." : "Slice hidden.", w / 2, h / 2, T.soft, 13, "center");
      $("#cap-slice").textContent = st.show ? `The plane sits at ${"xyzwv"[n - 1]} = ${D.fmt(s)}, outside the shape: nothing to cut.` : "The slice is hidden.";
      return;
    }
    const cam = D.camera(0.55, 0.32, 7);
    const to3 = (p) => D.toThree(p.slice(0, n - 1), "perspective", 4);
    const segs3 = segs.map(([a, b]) => [cam(to3(a)), cam(to3(b))]);
    const flat = segs3.flat(), scale = D.autoscale(flat, w, h, 0.8), scr = D.screen(w, h, Math.min(scale, (Math.min(w, h) / 2) * 0.8 / S.R0));
    for (const [a, b] of segs3) D.path(ctx, [scr(a), scr(b)], T.red, 2.2);
    const vol = N.sliceVolumeFast({ verts: V, n }, Object.assign({}, L, { facets: L.facets.map((f) => ({ ids: f.ids, normal: N.matVec(rotation(n), f.normal), offset: f.offset })) }), u, s);
    const unit = n - 1 === 3 ? "volume" : n - 1 === 4 ? "4-volume" : "size";
    $("#cap-slice").textContent = `The cut at ${"xyzwv"[n - 1]} = ${D.fmt(s)}: a ${n - 1}D solid with ${vol.vertices} corners and ${segs.length} edges, ${unit} ${D.fmt(vol.volume, 4)} (exact, by pyramids over its faces). Lens: slice, so lengths inside the cut are true.`;
  }

  function sweep() {
    if (st.sweeping) { cancelAnimationFrame(st.sweeping); st.sweeping = 0; return; }
    const f = $("#cut");
    if (window.Kit && Kit.still()) { set(f, +f.value + 25 > 200 ? -200 : +f.value + 25); return; }
    const t0 = performance.now(), v0 = -200;
    const step = (t) => {
      const v = v0 + ((t - t0) / 6000) * 400;
      if (v > 200) { st.sweeping = 0; set(f, 0); return; }
      set(f, Math.round(v)); st.sweeping = requestAnimationFrame(step);
    };
    st.sweeping = requestAnimationFrame(step);
  }
  function set(f, v) { if (window.Kit && Kit.setRange) Kit.setRange(f, v); else f.value = v; st.cut = +f.value; drawMain(); }

  /* Powers of dimension: the same family drawn from 1D to 5D. */
  const FAMILY = { cube: ["segment", "square", "cube", "tesseract", "penteract"], simplex: ["segment", "triangle", "tetrahedron", "5-cell", "5-simplex"], cross: ["segment", "square", "octahedron", "16-cell", "5-orthoplex"] };
  const FACES = ["corners", "edges", "faces", "cells", "4-faces"];
  let fam = "cube", spin = 0, raf = 0;
  function drawPowers() {
    const T = D.tokens();
    for (let n = 1; n <= 5; n++) {
      const cv = $("#pw" + n), P = N.polytope(fam, n), { ctx, w, h } = D.fit(cv, 1);
      const angles = N.planes(n).map(([i, j], k) => 0.42 + 0.21 * k + (j === n - 1 && n > 3 ? spin : 0));
      const R = n > 1 ? N.rotationFromAngles(n, angles) : [[1]];
      const pts = P.verts.map((p) => N.matVec(R, p)).map((p) => D.camera(0.5, 0.3)(D.toThree(p, "perspective", 2.6 * Math.sqrt(n))));
      const scr = D.screen(w, h, D.autoscale(pts, w, h, 0.78));
      const P2 = pts.map(scr);
      D.edges(ctx, P2, P.edges, T.ink, 1.5); D.dots(ctx, P2, T.red, 2);
      const f = n > 1 ? N.faceLattice(P.verts, P.edges).fvector : [2];
      const txt = `${n}D ${FAMILY[fam][n - 1]}: ` + f.map((x, k) => `${x} ${FACES[k]}`).join(", ");
      cv.setAttribute("aria-label", txt);
      $("#pwc" + n).textContent = txt;
    }
  }
  function loopPowers() {
    cancelAnimationFrame(raf);
    if (window.Kit && Kit.still()) { spin = 0; drawPowers(); return; }
    const tick = () => { spin += 0.006; drawPowers(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  }

  function init() {
    $("#shape").addEventListener("change", (e) => { st.shape = e.target.value; const n = shape(st.shape).P.n; document.querySelectorAll(".k5").forEach((el) => (el.hidden = n < 5)); drawMain(); });
    document.querySelectorAll("[data-lens]").forEach((b) => b.addEventListener("click", () => {
      st.lens = b.dataset.lens; document.querySelectorAll("[data-lens]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); drawMain();
    }));
    $("#cut").addEventListener("input", (e) => { st.cut = +e.target.value; drawMain(); });
    $("#cut-on").addEventListener("change", (e) => { st.show = e.target.checked; drawMain(); });
    $("#sweep").addEventListener("click", sweep);
    KNOB_PLANES.forEach((_, k) => $("#k" + k).addEventListener("input", drawMain));
    document.querySelectorAll("[data-fam]").forEach((b) => b.addEventListener("click", () => {
      fam = b.dataset.fam; document.querySelectorAll("[data-fam]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); drawPowers();
    }));
    addEventListener("resize", () => { drawMain(); drawPowers(); });
    if (window.Kit) Kit.on(() => { drawMain(); loopPowers(); });
    drawMain(); loopPowers();
  }
  window.NToy = { init, shape, SHAPES };
})();
