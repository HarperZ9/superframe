// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* cad page: one parametric instrument, every view drawn from one resolved record. Moving a parameter re-solves
   the model, rebuilds the 3D body, re-solves the physics at once, and regenerates the drawing, the schematic,
   the parts lists and the spec sheet a moment later. Picking a part in any view picks it in all of them. */
(function () {
  "use strict";
  const D = window.Diagram, C = D.CAD, $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const A = (window.CadApp = {});

  A.init = (id) => {
    const inst = C.REG[id], data = JSON.parse($("#cad-data").textContent), lib = data.materials, pipe = data.pipeline;
    const p = C.defaults(inst), ui = { sel: null, cutT: 0.5, drag: "orbit", zoom: 1 };
    let R = C.resolve(inst, p), model = D.compile(C.diagDef(R)), art = null;
    const view = { explode: 0, cut: { on: !!inst.cut3d, n: [0, 1, 0], d: 0 }, xray: false, opacity: {}, selected: null, selIndex: -1, tokens: DStage.tokens(), lib, knobs: {}, overlay: "" };
    const stage = DStage.create($("#stage"), model, () => view);
    const N = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const setCut = () => {
      const ax = $("#cut-axis").value, k = "xyz".indexOf(ax);
      view.cut.n = N[ax]; view.cut.on = $("#cut-on").checked; view.cut.d = D.snap(model.lo[k] + ui.cutT * (model.hi[k] - model.lo[k]));
      $("#cut-d").value = Math.round(ui.cutT * 1000);
    };
    if (inst.cut3d) { const c = inst.cut3d(R.p, inst.scale3d); $("#cut-axis").value = c.axis; $("#cut-on").checked = true; const k = "xyz".indexOf(c.axis); ui.cutT = (c.d - model.lo[k]) / (model.hi[k] - model.lo[k]); }
    setCut();

    /* parameters as faders, each with its value beside it */
    $("#params").innerHTML = inst.params.map((q) => `<label for="p-${q.id}"><span>${esc(q.label)}</span><output id="o-${q.id}" for="p-${q.id}"></output></label><input id="p-${q.id}" type="range" min="${q.min}" max="${q.max}" step="${q.step}" value="${q.value}" aria-describedby="o-${q.id}">`).join("");
    const showP = () => inst.params.forEach((q) => { $("#o-" + q.id).textContent = (q.fmt ? q.fmt(p[q.id]) : +(+p[q.id]).toPrecision(4) + " " + q.unit); });
    inst.params.forEach((q) => $("#p-" + q.id).addEventListener("input", (e) => { p[q.id] = +e.target.value; showP(); solve(); }));
    showP();

    function solve() {
      try { R = C.resolve(inst, p); } catch (e) { console.error("cad: build failed", e); $("#problems").hidden = false; $("#problems").textContent = "The model could not be built: " + e.message; return; }
      $("#problems").hidden = !R.problems.length;
      $("#problems").innerHTML = R.problems.length ? "<strong>The model refuses this set:</strong> " + R.problems.map(esc).join("; ") : "";
      model = D.compile(C.diagDef(R)); stage.setModel(model); setCut();
      physics(); dirty();
      clearTimeout(ui.t); ui.t = setTimeout(regen, 90);
    }
    /* the generated sheets: drawing, schematic, parts lists, spec sheet */
    function regen() {
      const t0 = performance.now(), BP = C.blueprint(R), SC = C.schematic(R), elec = R.B.netlist.components.some((c) => !C.SYM[c.sym].optical);
      art = { BP, SC, spec: C.specSheet(R, pipe), elec };
      $("#bp").innerHTML = C.toSVG(BP.sheet, { inline: true, label: `${inst.title}, assembly drawing ${R.B.drawing.number}, ${BP.size} at ${C.scaleText(BP.scale)}: front, top, right side, isometric and section views with dimensions, balloons and the parts list` });
      $("#sch").innerHTML = C.schematicSVG(SC, { inline: true, crop: true, hash: R.hash, label: `${inst.title}, ${elec ? "schematic" : "optical train"}: ${R.B.netlist.components.length} symbols` });
      $("#bp-meta").textContent = `${R.B.drawing.number}, ${BP.size} at ${C.scaleText(BP.scale)}, ${BP.dims.length} dimensions measured from the geometry, ${BP.balloons.filter((b) => b.view).length} balloons, model ${R.hash}. Regenerated in ${Math.round(performance.now() - t0)} ms.`;
      $("#sch-meta").textContent = elec ? `${SC.wires.length} wires, ${SC.labels.length} net labels, ${SC.power.length} power symbols; KiCad files below re-read to the same connectivity in the tests.` : "Light, not current: an optical train, so no KiCad files are written.";
      bom(); $("#spec").innerHTML = C.specHTML(art.spec); bind(); select(ui.sel);
      zoom(ui.zoom);
    }
    function bom() {
      const it = R.B.items.map((x) => `<tr data-part="${esc(x.parts[0])}" data-item="${x.item}" tabindex="0"><td class="num">${x.item}</td><td class="num">${x.parts.length}</td><td>${esc(x.pn || "-")}${x.pnStatus === "unverified, from memory" ? " <em>(unverified, from memory)</em>" : ""}</td><td>${esc(x.desc)}</td><td>${esc(x.material || "-")}</td></tr>`).join("");
      $("#bom-top tbody").innerHTML = it;
      const el = R.B.netlist.components.map((c) => `<tr data-part="${esc(c.part)}" tabindex="0"><td>${esc(c.ref)}</td><td>${esc(c.value)}</td><td>${esc(c.fp || "-")}</td><td>${esc(c.pn || "-")}${c.pnStatus ? " <em>(" + esc(c.pnStatus) + ")</em>" : ""}</td><td>${esc(c.desc || C.SYM[c.sym].desc)}</td></tr>`).join("");
      $("#bom-el tbody").innerHTML = el;
    }
    function bind() {
      for (const sel of ["#bp [data-part]", "#sch [data-part]", "#bom-top tr[data-part]", "#bom-el tr[data-part]"]) $$(sel).forEach((e) => {
        if (e.dataset.bound) return; e.dataset.bound = 1;
        const go = (ev) => { ev.stopPropagation(); const pid = e.dataset.part; select(pid && pid !== ui.sel ? pid : null); };
        e.addEventListener("click", go);
        e.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(ev); } });
      });
    }
    function select(pid) {
      ui.sel = pid && R.part(pid) ? pid : null;
      view.selected = ui.sel; view.selIndex = ui.sel ? model.index.get(ui.sel).index : -1;
      const it = ui.sel && R.itemOf(ui.sel), comp = ui.sel && R.compOf(ui.sel);
      $$("#bp .sel, #sch .sel, tr.sel").forEach((e) => e.classList.remove("sel"));
      if (ui.sel) {
        $$(`#bp [data-part="${ui.sel}"], #sch [data-part="${ui.sel}"], tr[data-part="${ui.sel}"]`).forEach((e) => e.classList.add("sel"));
        if (it) $$(`#bp [data-item="${it.item}"], #bom-top tr[data-item="${it.item}"]`).forEach((e) => e.classList.add("sel"));
      }
      const P = ui.sel && R.part(ui.sel);
      $("#inspect").innerHTML = P ? `<h3>${esc(P.label)}</h3><dl><dt>What it does</dt><dd>${esc(P.fn)}</dd><dt>Made of</dt><dd>${esc(P.material)}</dd>${it ? `<dt>Parts list</dt><dd>item ${it.item}, ${esc(it.desc)}</dd>` : ""}${comp ? `<dt>Schematic</dt><dd>${esc(comp.ref)}, ${esc(comp.value)}</dd>` : ""}<dt>Text alternative</dt><dd>${esc(P.alt)}</dd></dl>` : "<p>Pick a part in the 3D view, the drawing, the schematic or a parts list. It lights in all of them.</p>";
      dirty();
    }
    function physics() {
      $("#readouts").innerHTML = R.phys.readouts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
      D.drawPanels($("#cv-phys"), R.phys.panels, view.tokens, { panelH: $("#cv-phys").clientWidth < 520 ? 120 : 150 });
    }
    function zoom(z) { ui.zoom = z; const s = $("#bp svg"); if (s) s.style.width = Math.round(z * 100) + "%"; $$("[data-zoom]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.zoom === z))); }
    $$("[data-zoom]").forEach((b) => b.addEventListener("click", () => zoom(+b.dataset.zoom)));

    /* 3D controls */
    $("#explode").addEventListener("input", (e) => { view.explode = +e.target.value / 100; dirty(); });
    $("#cut-on").addEventListener("change", () => { setCut(); dirty(); });
    $("#cut-axis").addEventListener("change", () => { setCut(); dirty(); });
    $("#cut-d").addEventListener("input", (e) => { ui.cutT = +e.target.value / 1000; setCut(); dirty(); });
    $("#drag-cut").addEventListener("click", (e) => { ui.drag = ui.drag === "cut" ? "orbit" : "cut"; e.currentTarget.setAttribute("aria-pressed", String(ui.drag === "cut")); if (ui.drag === "cut" && !$("#cut-on").checked) { $("#cut-on").checked = true; setCut(); dirty(); } });
    $("#xray").addEventListener("click", (e) => { view.xray = !view.xray; e.currentTarget.setAttribute("aria-pressed", String(view.xray)); dirty(); });
    $("#reset").addEventListener("click", () => stage.reset());
    DStage.onDrag = (dx, dy) => { if (ui.drag !== "cut") return false; ui.cutT = D.clamp(ui.cutT - dy / 400, 0, 1); setCut(); dirty(); return true; };
    DStage.onChange = dirty;
    DStage.onPick = (i) => select(i >= 0 ? model.parts[i].id : null);
    window.Kit && Kit.on && Kit.on(() => { view.tokens = DStage.tokens(); physics(); dirty(); });
    window.addEventListener("resize", () => { physics(); dirty(); });

    /* downloads: the files the board and fabrication stages read */
    const save = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    $$("[data-get]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.get;
      if (k === "svg") save(`${id}-drawing.svg`, C.toSVG(art.BP.sheet, { label: inst.title }), "image/svg+xml");
      if (k === "dxf") save(`${id}-drawing.dxf`, C.toDXF(art.BP.sheet), "application/dxf");
      if (k === "sch") save(`${id}-schematic.svg`, C.schematicSVG(art.SC, { hash: R.hash }), "image/svg+xml");
      if (k === "kicad") save(`${id}.kicad_sch`, C.toKicadSch(R, art.SC), "text/plain");
      if (k === "net") save(`${id}.net`, C.toKicadNet(R), "text/plain");
      if (k === "spec") save(`${id}-spec.md`, C.specMD(art.spec), "text/markdown");
    }));
    if (!R.B.netlist.components.some((c) => !C.SYM[c.sym].optical)) $$('[data-get="kicad"], [data-get="net"]').forEach((b) => { b.disabled = true; b.textContent += " (no electronics)"; });

    /* label one part per parts-list item, and only where a small raster of this exact view shows it */
    function labelSet() {
      const c = stage.st.cam, cam = D.camera(c, 200, 125), Rr = D.raster(D.drawList(model, view), cam), seen = new Set();
      for (let i = 0; i < Rr.id.length; i++) if (Rr.id[i] >= 0) seen.add(Rr.id[i]);
      const out = new Set();
      for (const it of R.B.items) { const k = it.parts.map((q) => model.index.get(q).index).find((x) => seen.has(x)); if (k !== undefined) out.add(k); }
      return out;
    }
    let pending = false;
    function dirty() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; render(); }); }
    function render() {
      view.tokens = DStage.tokens();
      view.labelOnly = labelSet();
      stage.draw(view);
      $("#stage .cv-ov").setAttribute("aria-label", `${inst.title}, 3D model of ${model.parts.length} parts${view.explode > 0 ? ", taken apart " + Math.round(view.explode * 100) + " percent" : ""}${view.cut.on ? ", cut open across " + $("#cut-axis").value : ""}. Arrow keys turn it, plus and minus zoom.`);
    }
    physics(); regen(); render();
    A.state = { get R() { return R; }, get art() { return art; }, p, view, ui, stage, select, solve, regen, set: (k, v) => { p[k] = v; const el = $("#p-" + k); if (el) el.value = v; showP(); solve(); } };
  };
})();
