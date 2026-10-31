// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* The board page's live 3D view: the routed board from eda/run-jnt.js, drawn by the engine's WebGL2 path when it
   is there and by its software raster when not. Drag or arrow keys orbit, wheel or + and - zoom; the mask
   switch shows the copper under the solder mask. */
(function () {
  "use strict";
  const D = window.Diagram, E = D.EDA, data = JSON.parse(document.getElementById("eda-data").textContent);
  const B = data.board, MAT = data.materials, cv = document.getElementById("b3d"), cpu = document.getElementById("b3d-cpu");
  let glr = null;
  try { glr = D.glRenderer(cv); } catch (e) { console.error("eda page: WebGL2 failed, using the software raster", e); }
  if (!glr) { cv.hidden = true; cpu.hidden = false; }
  const cam = { yaw: 0.55, pitch: 0.62, zoom: 0.95 }, opt = { mask: true };
  let list = E.boardDrawList(B, MAT, opt), queued = false;
  const bg = () => { const c = getComputedStyle(document.documentElement).getPropertyValue("--wall").trim() || "#f4f1ea"; return D.rgb(c); };
  const draw = () => {
    queued = false;
    const host = cv.parentElement, w = Math.max(280, host.clientWidth), h = Math.round(Math.min(560, Math.max(260, w * 0.6))), r = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [cv, cpu]) { c.style.width = w + "px"; c.style.height = h + "px"; }
    if (glr) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); glr.render(list, D.camera(E.boardCamera(B, cam), cv.width, cv.height), { bg: bg() }); }
    else { cpu.width = w; cpu.height = h; const img = D.raster(list, D.camera(E.boardCamera(B, cam), w, h), { bg: bg() }); cpu.getContext("2d").putImageData(new ImageData(img.rgba, w, h), 0, 0); }
    document.getElementById("b3d-path").textContent = glr ? "WebGL2" : "software raster";
  };
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
  const target = glr ? cv : cpu;
  let drag = null;
  for (const t of [cv, cpu]) {
    t.addEventListener("pointerdown", (e) => { drag = [e.clientX, e.clientY]; t.setPointerCapture(e.pointerId); });
    t.addEventListener("pointermove", (e) => { if (!drag) return; cam.yaw -= (e.clientX - drag[0]) * 0.008; cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch + (e.clientY - drag[1]) * 0.008)); drag = [e.clientX, e.clientY]; ask(); });
    t.addEventListener("pointerup", () => (drag = null));
    t.addEventListener("wheel", (e) => { e.preventDefault(); cam.zoom = Math.max(0.3, Math.min(3, cam.zoom * (e.deltaY > 0 ? 1.1 : 0.9))); ask(); }, { passive: false });
    t.addEventListener("keydown", (e) => {
      const k = { ArrowLeft: () => (cam.yaw += 0.1), ArrowRight: () => (cam.yaw -= 0.1), ArrowUp: () => (cam.pitch = Math.min(1.5, cam.pitch + 0.1)), ArrowDown: () => (cam.pitch = Math.max(-1.5, cam.pitch - 0.1)), "+": () => (cam.zoom *= 0.9), "-": () => (cam.zoom *= 1.1) }[e.key];
      if (k) { e.preventDefault(); k(); ask(); }
    });
  }
  document.getElementById("b3d-mask").addEventListener("change", (e) => { opt.mask = e.target.checked; list = E.boardDrawList(B, MAT, opt); ask(); });
  for (const [id, c] of [["b3d-top", { yaw: 0.0001, pitch: 1.5, zoom: 1.0 }], ["b3d-iso", { yaw: 0.55, pitch: 0.62, zoom: 0.95 }], ["b3d-under", { yaw: 0.4, pitch: -0.9, zoom: 1.0 }]])
    document.getElementById(id).addEventListener("click", () => { Object.assign(cam, c); ask(); });
  addEventListener("resize", ask);
  target.setAttribute("tabindex", "0");
  window.EdaPage = { cam, redraw: draw, list: () => list };
  draw();
})();
