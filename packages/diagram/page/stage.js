// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram page: the 3D stage. One model drawn by WebGL2 when it is there and by the software raster when it is
   not (or when the reader picks CPU, or the single-line drawing). Orbit by drag, arrow keys or the knobs; zoom by
   wheel or + and -. Labels hang from each part and follow it when the model is taken apart. */
(function () {
  "use strict";
  const D = window.Diagram;
  const S = (window.DStage = {});

  S.tokens = () => {
    const cs = getComputedStyle(document.documentElement), v = (k) => cs.getPropertyValue(k).trim();
    const dark = window.Kit && Kit.isDark ? Kit.isDark() : matchMedia("(prefers-color-scheme: dark)").matches;
    return { ink: v("--ink"), soft: v("--soft"), line: v("--line"), wall: v("--wall"), wall2: v("--wall-2"), mat: v("--mat"), red: v("--red"), ochre: v("--ochre"),
      s1: v("--s1"), s2: v("--s2"), s3: v("--s3"), s4: v("--s4"), s5: v("--s5"), tide: v("--tide-2"), verified: v("--verified"), drift: v("--drift"), dark, mono: v("--face-utility") || "monospace" };
  };

  /* Single-line drawing: one stroke where the part under the pixel changes (HPJ 1972's exploded calculator). */
  S.lineArt = (R, ink, bg) => {
    const { w, h, id, rgba } = R, out = new Uint8ClampedArray(rgba.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, a = id[i], e = (x > 0 && id[i - 1] !== a) || (y > 0 && id[i - w] !== a);
      const c = e ? ink : bg, o = i * 4;
      out[o] = c[0] * 255; out[o + 1] = c[1] * 255; out[o + 2] = c[2] * 255; out[o + 3] = 255;
    }
    return out;
  };

  S.create = (host, model, getView) => {
    const gl = host.querySelector(".cv-gl"), cpu = host.querySelector(".cv-cpu"), ov = host.querySelector(".cv-ov");
    let glr = null;
    try { glr = D.glRenderer(gl); } catch (e) { console.error("diagram: WebGL2 renderer failed, using the software raster", e); }
    const cam = D.homeCamera(model, model.def.camera);
    const home = Object.assign({}, cam);
    const st = { cam, path: glr ? "gpu" : "cpu", last: null, size: [0, 0] };
    const size = () => {
      const w = Math.max(280, host.clientWidth), h = Math.round(Math.min(560, Math.max(300, w * 0.62))), r = Math.min(2, window.devicePixelRatio || 1);
      for (const c of [gl, cpu, ov]) { c.style.width = w + "px"; c.style.height = h + "px"; }
      host.style.height = h + "px";
      gl.width = Math.round(w * r); gl.height = Math.round(h * r);
      const cr = st.path === "line" || st.path === "cpu" ? 1 : r;
      cpu.width = Math.round(w * cr); cpu.height = Math.round(h * cr);
      ov.width = Math.round(w * r); ov.height = Math.round(h * r);
      st.size = [w, h, r];
    };
    function draw(view, extra) {
      size();
      const [w, h, r] = st.size, c = D.camera(st.cam, w, h), list = D.drawList(model, view), bg = D.rgb(view.tokens.mat);
      const useGL = st.path === "gpu" && glr;
      gl.hidden = !useGL; cpu.hidden = useGL;
      if (useGL) glr.render(list, c, { bg, dpr: r });
      else {
        const cc = D.camera(st.cam, cpu.width, cpu.height), R = D.raster(list, cc, { bg });
        const px = st.path === "line" ? S.lineArt(R, D.rgb(view.tokens.ink), bg) : R.rgba;
        cpu.getContext("2d").putImageData(new ImageData(px, R.w, R.h), 0, 0);
        st.lastRaster = R;
      }
      st.last = { list, cam: c };
      labels(list, c, view, extra);
      return list;
    }
    function labels(list, c, view, extra) {
      const [w, h, r] = st.size, x = ov.getContext("2d");
      x.setTransform(r, 0, 0, r, 0, 0); x.clearRect(0, 0, w, h);
      x.font = `600 12px ${view.tokens.mono}`; x.textBaseline = "middle";
      const placed = [], all = w >= 640 || view.allLabels;
      const items = list.labels.map((L) => ({ L, s: c.toScreen(L.at) })).filter((o) => o.s[3] > 0 && (!view.labelOnly || view.labelOnly.has(o.L.part) || o.L.part === view.selIndex)).sort((a, b) => (b.L.part === view.selIndex) - (a.L.part === view.selIndex));
      for (const { L, s } of items) {
        const sel = L.part === view.selIndex, text = (all || sel) ? `${L.part + 1}  ${L.text}` : String(L.part + 1);
        const tw = x.measureText(text).width + 10, dx = s[0] < w / 2 ? -1 : 1;
        let bx = s[0] + dx * 18 - (dx < 0 ? tw : 0), by = s[1] - 20;
        bx = D.clamp(bx, 2, w - tw - 2); by = D.clamp(by, 10, h - 12);
        const hit = placed.some((p) => bx < p[0] + p[2] && bx + tw > p[0] && Math.abs(by - p[1]) < 15);
        if (hit && !sel) continue;
        placed.push([bx, by, tw]);
        x.strokeStyle = sel ? view.tokens.red : view.tokens.soft; x.lineWidth = sel ? 1.6 : 1;
        x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(dx < 0 ? bx + tw : bx, by); x.stroke();
        x.fillStyle = view.tokens.mat; x.fillRect(bx, by - 9, tw, 18);
        x.strokeRect(bx + 0.5, by - 8.5, tw - 1, 17);
        x.fillStyle = sel ? view.tokens.red : view.tokens.ink; x.fillText(text, bx + 5, by + 1);
      }
      if (extra) extra(x, w, h);
    }
    /* pointer: drag orbits, a click without a drag picks */
    let drag = null;
    ov.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; ov.setPointerCapture(e.pointerId); });
    ov.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
      if (S.onDrag && S.onDrag(dx, dy, e)) return;   /* a page may claim the drag, e.g. to move a cutting plane */
      st.cam.yaw -= dx * 0.008; st.cam.pitch = D.clamp(st.cam.pitch + dy * 0.008, -1.45, 1.45);
      S.onChange && S.onChange();
    });
    ov.addEventListener("pointerup", (e) => {
      if (drag && drag.moved < 5) { const p = pick(e.offsetX, e.offsetY); S.onPick && S.onPick(p); }
      drag = null;
    });
    ov.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });
    ov.addEventListener("keydown", (e) => {
      const k = e.key, step = e.shiftKey ? 0.3 : 0.08;
      if (k === "ArrowLeft") st.cam.yaw += step; else if (k === "ArrowRight") st.cam.yaw -= step;
      else if (k === "ArrowUp") st.cam.pitch = D.clamp(st.cam.pitch + step, -1.45, 1.45); else if (k === "ArrowDown") st.cam.pitch = D.clamp(st.cam.pitch - step, -1.45, 1.45);
      else if (k === "+" || k === "=") return zoom(1 / 1.1); else if (k === "-") return zoom(1.1); else return;
      e.preventDefault(); S.onChange && S.onChange();
    });
    function zoom(f) { st.cam.dist = D.clamp(st.cam.dist * f, model.radius * 0.8, model.radius * 8); S.onChange && S.onChange(); }
    function pick(x, y) {
      if (!st.last) return -1;
      const view = getView(), small = D.camera(st.cam, Math.round(st.size[0] / 2), Math.round(st.size[1] / 2));
      const R = D.raster(D.drawList(model, view), small);
      const i = Math.floor(y / 2) * R.w + Math.floor(x / 2);
      const p = R.id[i];
      return p >= 0 && p < model.parts.length ? p : -1;
    }
    return {
      draw, zoom, st,
      setModel: (m) => { model = m; },   /* a parametric page swaps in the rebuilt model; the camera stays */
      reset: () => { Object.assign(st.cam, home); S.onChange && S.onChange(); },
      setPath: (p) => { st.path = p === "gpu" && !glr ? "cpu" : p; S.onChange && S.onChange(); return st.path; },
      hasGL: !!glr,
      frameHash: () => { const c = st.path === "gpu" && glr ? null : cpu; if (!c) return null; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; return D.hash(new Uint8Array(d.buffer)); },
    };
  };
})();
