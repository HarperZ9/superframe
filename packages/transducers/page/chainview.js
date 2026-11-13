/* The live chain: steps you can drag, or move with the arrow keys, each with what comes out of it and what it costs. A step
   that does not fit is refused where it stands, with the reason from the field type. */
(function (g) {
  "use strict";
  const T = g.Transducers, V = g.TView, UI = (g.TChain = {});
  const PRESETS = { camera: () => T.demoCamera(64), retina: () => T.demoRetina(4096), text: () => T.demoText({ chars: 2000 }), dna: () => T.demoDNA() };
  let demo = null, order = [], off = new Set(), box = null, sumEl = null, dragging = null;

  const refusal = (e) => (e.name === "ClaimError" || e.name === "UnitError" || e.name === "FieldError" ? e.message : e.name + ": " + e.message);
  /* Run step by step, so a refusal stops the chain where it stood and the steps before it still show. */
  const runAll = () => {
    const kept = order.filter((k) => !off.has(k.id));
    const r = { rows: [], outs: [demo.src], error: null };
    let n = kept.length;
    while (n >= 0) {
      try { const c = T.chain(demo.src, kept.slice(0, n), demo.opt); r.rows = c.rows; r.worst = c.worstMeasured || c.worst; r.out = c.out; break; }
      catch (e) { r.error = { at: n - 1, text: refusal(e), id: kept[n - 1] && kept[n - 1].id }; n--; }
    }
    return r;
  };
  const stepEl = (k, i) => {
    const li = document.createElement("li"); li.className = "tr-step"; li.draggable = true; li.dataset.i = i; li.tabIndex = 0;
    li.setAttribute("aria-label", `${k.id}. Arrow keys move it.`);
    li.innerHTML = `<canvas width="1" height="1"></canvas><div class="tr-meta"><b>${k.id}</b><div class="tr-bar"><i></i></div><span class="tr-num k-mono"></span></div><label class="tr-on"><input type="checkbox" ${off.has(k.id) ? "" : "checked"}><span class="sr-only">Use ${k.id}</span></label>`;
    li.querySelector("input").addEventListener("change", (e) => { if (e.target.checked) off.delete(k.id); else off.add(k.id); UI.render(); });
    li.addEventListener("dragstart", (e) => { dragging = i; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); li.classList.add("is-drag"); });
    li.addEventListener("dragend", () => li.classList.remove("is-drag"));
    li.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
    li.addEventListener("drop", (e) => { e.preventDefault(); move(dragging, i); });
    li.addEventListener("keydown", (e) => { if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); move(i, i - 1, true); } if (e.key === "ArrowDown" && i < order.length - 1) { e.preventDefault(); move(i, i + 1, true); } });
    touchDrag(li, i);
    return li;
  };
  /* Touch: drag along a step to carry it up or down the list. */
  const touchDrag = (li, i) => {
    let y0 = null;
    li.addEventListener("touchstart", (e) => { if (e.target.closest(".tr-on")) return; y0 = e.touches[0].clientY; }, { passive: true });
    li.addEventListener("touchend", (e) => { if (y0 === null) return; const d = e.changedTouches[0].clientY - y0, st = Math.round(d / li.offsetHeight); y0 = null; if (st) move(i, Math.max(0, Math.min(order.length - 1, i + st))); });
  };
  const move = (a, b, refocus) => {
    if (a === b || a === null) return;
    const [k] = order.splice(a, 1); order.splice(b, 0, k); UI.render();
    if (refocus) box.children[b + 1].focus();
  };
  const paintRow = (li, row, head, worst) => {
    const w = V.barWidth(row.keptMeasured !== null && row.keptMeasured !== undefined ? row.keptMeasured : row.keptCapped, head);
    li.querySelector(".tr-bar i").style.width = (w * 100).toFixed(1) + "%";
    li.querySelector(".tr-num").textContent = `${V.fmt(row.keptMeasured !== null && row.keptMeasured !== undefined ? row.keptMeasured : row.keptCapped)} bits kept / ${V.fmt(row.bytes)} bytes / ${row.ms.toFixed(1)} ms`;
    li.classList.toggle("is-over", !!row.overBudget);
    if (row.id === worst) li.classList.add("is-worst");
  };
  UI.render = () => {
    const r = runAll();
    box.innerHTML = "";
    const src = document.createElement("li"); src.className = "tr-step is-source";
    src.innerHTML = `<canvas></canvas><div class="tr-meta"><b>${demo.src.name}</b><div class="tr-bar"><i style="width:100%"></i></div><span class="tr-num k-mono">${V.fmt(r.rows[0].bitsKept)} bits / ${V.fmt(r.rows[0].bytes)} bytes</span></div>`;
    box.appendChild(src);
    V.field(src.querySelector("canvas"), demo.src, 84, 84);
    let f = demo.src, ri = 1;
    order.forEach((k, i) => {
      const li = stepEl(k, i); box.appendChild(li);
      const c = li.querySelector("canvas");
      if (off.has(k.id)) { li.classList.add("is-off"); V.setup(c, 84, 84); return; }
      if (r.error && r.error.id === k.id) { li.classList.add("is-refused"); li.querySelector(".tr-num").textContent = r.error.text; V.setup(c, 84, 84); f = null; return; }
      if (!f || ri >= r.rows.length) { li.classList.add("is-off"); V.setup(c, 84, 84); return; }
      const row = r.rows[ri++];
      try { f = T.run(k, f); V.field(c, f, 84, 84); } catch (e) { console.error("view", e); }
      paintRow(li, row, r.rows[0].bitsKept, r.worst);
    });
    const last = r.rows[r.rows.length - 1];
    sumEl.textContent = r.error ? `Refused at ${r.error.id}` : `Most lost at ${r.worst}. ${V.fmt(last.keptMeasured === null ? last.keptCapped : last.keptMeasured)} bits left of ${V.fmt(r.rows[0].bitsKept)}.`;
    sumEl.classList.toggle("is-refused", !!r.error);
  };
  UI.load = (name) => { demo = PRESETS[name](); order = demo.kernels.slice(); off = new Set(); document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === name))); UI.render(); };
  UI.init = (listEl, summaryEl) => { box = listEl; sumEl = summaryEl; document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => UI.load(b.dataset.preset))); UI.load("camera"); };
  UI.PRESETS = PRESETS;
})(globalThis);
