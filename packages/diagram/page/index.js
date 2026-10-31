// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram index: every model drawn small by the software raster, all taken apart and cut by two faders. */
(function () {
  "use strict";
  const D = window.Diagram, lib = JSON.parse(document.getElementById("mat-data").textContent).materials;
  const cards = [...document.querySelectorAll("[data-card]")].map((cv) => {
    const def = window.DiagramDefs[cv.dataset.card], model = D.compile(def), sim = def.sim ? def.sim(model) : null;
    return { cv, def, model, sim };
  });
  const ex = document.getElementById("all-explode"), cu = document.getElementById("all-cut");
  function draw() {
    const tk = DStage.tokens();
    for (const c of cards) {
      const w = Math.max(200, c.cv.clientWidth), h = Math.round(w * 0.62);
      c.cv.width = w; c.cv.height = h; c.cv.style.height = h + "px";
      const ax = (c.def.cut && c.def.cut.axis) || "z", k = "xyz".indexOf(ax), n = [0, 0, 0]; n[k] = 1;
      const d = c.model.lo[k] + (+cu.value / 100) * (c.model.hi[k] - c.model.lo[k]);
      const view = { explode: +ex.value / 100, cut: { on: +cu.value < 100, n, d }, tokens: tk, lib, knobs: {}, opacity: {} };
      for (const kn of c.def.knobs || []) view.knobs[kn.id] = kn.value;
      const cam = D.camera(D.homeCamera(c.model, c.def.camera), w, h);
      const R = D.raster(D.frame(c.model, c.sim, c.def.startU || 0.62, view), cam, { bg: D.rgb(tk.mat) });
      c.cv.getContext("2d").putImageData(new ImageData(R.rgba, R.w, R.h), 0, 0);
    }
  }
  let p = false;
  const dirty = () => { if (!p) { p = true; requestAnimationFrame(() => { p = false; draw(); }); } };
  ex.addEventListener("input", dirty); cu.addEventListener("input", dirty); window.addEventListener("resize", dirty);
  window.Kit && Kit.on && Kit.on(dirty);
  draw();
})();
