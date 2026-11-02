// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram page: one shared state, every view drawn from it. Selecting a part in any view selects it in all of
   them; each view's lens line says what it keeps and drops. */
(function () {
  "use strict";
  const D = window.Diagram, $ = (s) => document.querySelector(s);
  const A = (window.DApp = {});

  A.init = (id) => {
    const def = window.DiagramDefs[id], lib = JSON.parse($("#mat-data").textContent).materials;
    const model = D.compile(def), sim = def.sim ? def.sim(model) : null;
    const F = sim && sim.spacetime ? D.spacetimeFit(sim.spacetime()) : null;
    const view = { explode: 0, cut: { on: !!def.cut, n: [0, 0, 1], d: 0 }, xray: false, opacity: {}, selected: null, selIndex: -1, tokens: DStage.tokens(), lib, knobs: {}, variant: def.variants ? def.variants[0].mode || null : null, overlay: "" };
    const ui = { u: def.startU || 0.62, playing: false, last: 0, stAngles: F ? (F.angles || [0, 0, 0, 0, 0, 0]).slice() : null, stLens: "perspective", follow: true, t0: 0 };
    const axisN = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const setCut = () => {
      const ax = $("#cut-axis").value, n = axisN[ax], k = "xyz".indexOf(ax), lo = model.lo[k], hi = model.hi[k];
      view.cut.n = n; view.cut.on = $("#cut-on").checked;
      view.cut.d = D.snap(lo + ((+$("#cut-d").value + 100) / 200) * (hi - lo));
    };
    if (def.cut) { $("#cut-axis").value = def.cut.axis; $("#cut-d").value = Math.round((((def.cut.d - model.lo["xyz".indexOf(def.cut.axis)]) / (model.hi["xyz".indexOf(def.cut.axis)] - model.lo["xyz".indexOf(def.cut.axis)])) * 200) - 100); }
    $("#cut-on").checked = !!def.cut;
    setCut();
    const stage = DStage.create($("#stage"), model, () => fullView());
    const sch = DViews.schematic($("#sch"), def, (pid) => select(pid), (ctl) => { const el = document.getElementById(ctl); if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus(); } });
    DViews.variants($("#variants"), def);
    sch.bind($("#variants"));

    /* parts list */
    $("#parts").innerHTML = def.parts.map((p, i) => `<li><button type="button" data-pick="${p.id}" aria-pressed="false"><span class="n">${i + 1}</span> ${p.label}</button></li>`).join("");
    $("#parts").addEventListener("click", (e) => { const b = e.target.closest("[data-pick]"); if (b) select(b.dataset.pick === view.selected ? null : b.dataset.pick); });
    if ($("#variant-pick") && def.variants) {
      $("#variant-pick").innerHTML = def.variants.map((v, i) => `<option value="${v.mode || i}">${v.title}</option>`).join("");
      $("#variant-pick").addEventListener("change", (e) => { view.variant = e.target.value; dirty(); });
    } else if ($("#variant-pick")) $("#variant-pick").closest("label").hidden = true;

    function fullView() {
      const v = Object.assign({}, view);
      if (view.overlay) { const oc = D.overlayContext(model, Object.assign({}, v, { state: sim ? sim.state(ui.u, v) : null }), view.overlay); v.overlayStyle = oc.style; v.oc = oc; }
      return v;
    }
    function select(pid) {
      view.selected = pid; view.selIndex = pid ? model.index.get(pid).index : -1;
      document.querySelectorAll("[data-pick]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pick === pid)));
      sch.select(pid);
      const P = pid && model.index.get(pid);
      $("#opacity").disabled = !P;
      $("#opacity").value = P && view.opacity[pid] !== undefined ? Math.round(view.opacity[pid] * 100) : 100;
      inspect();
      dirty();
    }
    function inspect() {
      const P = view.selected && model.index.get(view.selected);
      if (!P) { $("#inspect").innerHTML = `<p>Pick a part in any view, or in this list, to read what it does. It lights up in every view at once.</p>`; return; }
      const p = P.def, rec = D.MATERIALS[p.material] && D.MATERIALS[p.material].lib && lib[D.MATERIALS[p.material].lib];
      const v = fullView(), read = v.oc ? D.readingText(v.oc.readings.get(p.id), view.overlay) : "";
      $("#inspect").innerHTML = `<h3>${P.index + 1}. ${p.label}</h3><dl><dt>What it does</dt><dd>${p.fn}</dd>${p.qty ? `<dt>Carries</dt><dd>${p.qty}</dd>` : ""}<dt>Made of</dt><dd>${rec ? rec.name + " (materials library)" : p.material + " (no library record)"}</dd>${read ? `<dt>Now</dt><dd>${read}</dd>` : ""}<dt>Text alternative</dt><dd>${p.alt}</dd></dl>`;
    }

    /* controls */
    const on = (sel, ev, f) => { const e = $(sel); if (e) e.addEventListener(ev, f); };
    on("#explode", "input", (e) => { view.explode = +e.target.value / 100; dirty(); });
    on("#cut-on", "change", () => { setCut(); dirty(); });
    on("#cut-axis", "change", () => { setCut(); dirty(); });
    on("#cut-d", "input", () => { setCut(); dirty(); });
    on("#xray", "click", (e) => { view.xray = !view.xray; e.currentTarget.setAttribute("aria-pressed", String(view.xray)); dirty(); });
    on("#opacity", "input", (e) => { if (view.selected) { view.opacity[view.selected] = +e.target.value / 100; dirty(); } });
    on("#overlay", "change", (e) => { view.overlay = e.target.value; inspect(); dirty(); });
    on("#time", "input", (e) => { ui.u = +e.target.value / 1000; dirty(); });
    on("#reset", "click", () => stage.reset());
    on("#play", "click", () => {
      if (window.Kit && Kit.still()) { ui.u = (ui.u + 0.05) % 1; $("#time").value = Math.round(ui.u * 1000); dirty(); return; }
      ui.playing = !ui.playing; $("#play").textContent = ui.playing ? "Pause" : "Play"; ui.last = performance.now(); if (ui.playing) requestAnimationFrame(tick);
    });
    document.querySelectorAll("[data-path]").forEach((b) => b.addEventListener("click", () => {
      const got = stage.setPath(b.dataset.path);
      document.querySelectorAll("[data-path]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.path === got)));
    }));
    if (!stage.hasGL) { const g = document.querySelector('[data-path="gpu"]'); if (g) { g.disabled = true; g.textContent = "GPU (not available here)"; } document.querySelectorAll("[data-path]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.path === "cpu"))); }
    for (const k of def.knobs || []) { view.knobs[k.id] = k.value; on("#" + k.id, "input", (e) => { view.knobs[k.id] = +e.target.value; dirty(); }); }
    if (F) {
      document.querySelectorAll("[data-plane]").forEach((el) => { const i = +el.dataset.plane; el.value = Math.round((ui.stAngles[i] * 180) / Math.PI); el.addEventListener("input", () => { ui.stAngles[i] = (+el.value * Math.PI) / 180; dirty(); }); });
      on("#st-lens", "change", (e) => { ui.stLens = e.target.value; dirty(); });
      on("#st-follow", "change", (e) => { ui.follow = e.target.checked; dirty(); });
      on("#st-t", "input", (e) => { ui.follow = false; $("#st-follow").checked = false; ui.t0 = F.lo[3] + (+e.target.value / 1000) * (F.hi[3] - F.lo[3]); dirty(); });
      $("#cv-st").addEventListener("click", (e) => {
        const r = e.target.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, P = ui.stP;
        if (!P) return;
        let best = -1, bd = 144;
        P.pts.forEach((s, i) => { const d = (s[0] - x) ** 2 + (s[1] - y) ** 2; if (d < bd) { bd = d; best = i; } });
        if (best < 0) return;
        const ei = F.edges.findIndex((e2) => e2[0] === best || e2[1] === best), pi = ei >= 0 && F.edgePart ? F.edgePart[ei] : -1;
        if (pi >= 0) select(model.parts[pi].id);
      });
    } else { const s = $("#spacetime"); if (s) s.hidden = true; }
    DStage.onChange = dirty;
    DStage.onPick = (i) => select(i >= 0 ? model.parts[i].id : null);
    window.Kit && Kit.on && Kit.on(() => { view.tokens = DStage.tokens(); dirty(); });
    window.addEventListener("resize", dirty);

    function tick(now) {
      if (!ui.playing) return;
      const dt = Math.min(0.1, (now - ui.last) / 1000); ui.last = now;
      ui.u = (ui.u + dt / (def.playSeconds || 24)) % 1;
      $("#time").value = Math.round(ui.u * 1000);
      render();
      requestAnimationFrame(tick);
    }
    let pending = false, lensTimer = 0;
    function dirty() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; render(); }); }
    function legend(x, w, h, v) {
      if (!v.oc) return;
      const L = 18, T = h - 40, W = Math.min(220, w - 40);
      for (let i = 0; i < W; i++) { const c = D.ramp(i / W); x.fillStyle = `rgb(${c.map((q) => Math.round(q * 255)).join(",")})`; x.fillRect(L + i, T, 1, 10); }
      x.fillStyle = view.tokens.ink; x.font = `600 11px ${view.tokens.mono}`;
      const f = (q) => (v.oc.log ? D.fmt(10 ** q) : q.toFixed(0));
      x.fillText(`ramp, ${v.oc.info.name}: ${f(v.oc.lo)} to ${f(v.oc.hi)} ${v.oc.info.unit}`, L, T - 8);
    }
    function render() {
      view.tokens = DStage.tokens();
      const v = fullView(), state = sim ? sim.state(ui.u, v) : null;
      v.state = state;
      stage.draw(v, (x, w, h) => legend(x, w, h, v));
      sch.flow(ui.u, state);
      if (sim) DViews.trace($("#cv-trace"), sim, ui.u, v);
      if (sim) DViews.table($("#table"), sim, ui.u, v);
      const dur = sim && sim.duration ? sim.duration(v) : null;
      $("#t-read").textContent = dur ? `t = ${D.fmt(ui.u * dur * 1e3, "ms")} of ${D.fmt(dur * 1e3, "ms")}` : `step ${Math.round(ui.u * 1000)} of 1000`;
      if (F) {
        if (ui.follow) ui.t0 = F.lo[3] + ui.u * (F.hi[3] - F.lo[3]);
        const out = DViews.spacetime($("#cv-st"), F, v, { angles: ui.stAngles, lens: ui.stLens, t0: ui.t0 });
        ui.stP = out.P;
        const L = D.spacetimeLens(ui.stLens);
        $("#lens-st").textContent = `Lens: ${ui.stLens}, then the slice at t. Keeps ${L.keeps.join("; ")}. Drops ${L.drops.join("; ")}.` + (out.bits ? ` Bits lost: ${out.bits.lost.toFixed(1)} of ${out.bits.source.toFixed(1)} per point.` : "") + ` The instant shows ${out.slice.pts.length} point${out.slice.pts.length === 1 ? "" : "s"}.`;
        $("#cv-st").setAttribute("aria-label", `Spacetime view of ${def.title}: ${F.axes.join(", ")}; the red points are the instant now, the same moment the time view shows.`);
      }
      if (view.overlay) inspect();
      clearTimeout(lensTimer);
      lensTimer = setTimeout(() => lenses(v), 220);
    }
    function lenses(v) {
      const kind = v.cut.on ? "section" : v.xray ? "xray" : v.explode > 0 ? "exploded" : "model";
      const asp = (stage.st.size[0] || 640) / (stage.st.size[1] || 400);
      const t3 = D.lensText(kind, D.lensBits(model, v, kind, stage.st.cam, asp)), ts = D.lensText("schematic", D.lensBits(model, v, "schematic", stage.st.cam, asp)), tt = D.lensText("time");
      const ov = v.oc ? ` Layer: ${v.oc.info.name}. It keeps ${v.oc.info.keeps.join("; ")}, and drops ${v.oc.info.drops.join("; ")}.` : "";
      $("#lens-3d").textContent = `Lens: ${t3.name}. ${t3.line}${ov}`;
      $("#lens-sch").textContent = `Lens: ${ts.name}. ${ts.line}`;
      $("#lens-time").textContent = `Lens: ${tt.name}. ${tt.line}`;
      $("#stage .cv-ov").setAttribute("aria-label", `${def.title}, ${t3.name.toLowerCase()}${v.explode > 0 ? ", taken apart " + Math.round(v.explode * 100) + " percent" : ""}${v.cut.on ? ", cut open" : ""}${v.xray ? ", seen through" : ""}${v.oc ? ", showing " + v.oc.info.name : ""}. ${model.parts.length} parts; arrow keys turn it, plus and minus zoom, the parts list names each one.`);
    }
    select(null);
    $("#time").value = Math.round(ui.u * 1000);
    render();
    A.state = { model, view, ui, sim, stage, render, F, select };
  };
})();
