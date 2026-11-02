// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim page, plain layer figures: Petrie polygons, Schlegel diagrams, the Hopf fibration on the Clifford
   torus, and the law table's signatures as an 8D point cloud you can turn and slice. */
(function () {
  "use strict";
  const N = window.NDim, D = window.NDraw, $ = (s) => document.querySelector(s);
  const GROUPS = { "5-cell": "A4", tesseract: "B4", "16-cell": "B4", "24-cell": "F4", "120-cell": "H4", "600-cell": "H4" };
  const pcache = new Map();
  const spread = (pts, edges, verts) => { const r = edges.map(([a, b]) => N.dist(pts[a], pts[b]) / N.dist(verts[a], verts[b])); const hi = Math.max(...r), lo = Math.min(...r); return hi > 0 ? (hi - lo) / hi : 0; };
  const lensText = (k, name) => `Lens: ${name || k.name}. Keeps ${k.keeps.join("; ")}. Loses ${k.loses.join("; ")}.`;

  function drawPetrie() {
    const name = $("#pet-shape").value, S = window.NToy.shape(name), T = D.tokens();
    if (!pcache.has(name)) pcache.set(name, N.petrie(S.P, GROUPS[name]));
    const pet = pcache.get(name), { ctx, w, h } = D.fit($("#cv-petrie"), 1);
    const sc = (Math.min(w, h) / 2) * 0.9, P2 = pet.pts.map(([x, y]) => [w / 2 + x * sc, h / 2 - y * sc, 0]);
    D.edges(ctx, P2, S.P.edges, T.ink, S.P.verts.length > 200 ? 0.5 : 1, S.P.verts.length > 200 ? 0.5 : 0.9);
    D.dots(ctx, P2, T.red, S.P.verts.length > 200 ? 1.4 : 2.6);
    $("#cap-petrie").textContent = `${name} on its Coxeter plane (${GROUPS[name]}). The Coxeter element has order h = ${pet.h}; turning the picture by 1/${pet.symmetry} of a circle maps it onto itself (measured). ` + lensText(N.LENSES.petrie, "Petrie (orthographic onto the Coxeter plane)") + ` Edge spread ${D.fmt(spread(pet.pts, S.P.edges, S.P.verts))}.`;
  }

  function drawSchlegel() {
    const name = $("#sch-shape").value, S = window.NToy.shape(name), T = D.tokens();
    const sch = N.schlegel(S.P, S.L, 0), yaw = (+$("#sch-turn").value * Math.PI) / 180;
    const { ctx, w, h } = D.fit($("#cv-schlegel"), 1), cam = D.camera(yaw, 0.38, 8);
    const c3 = sch.pts.map(cam), scr = D.screen(w, h, D.autoscale(c3, w, h, 0.86)), P2 = c3.map(scr);
    const frame = new Set(sch.facet), inFrame = S.P.edges.filter(([a, b]) => frame.has(a) && frame.has(b));
    D.edges(ctx, P2, S.P.edges, T.ink, S.P.verts.length > 200 ? 0.6 : 1.3, 0.85);
    D.edges(ctx, P2, inFrame, T.red, 2.4);
    $("#cap-schlegel").textContent = `Schlegel diagram of the ${name}: looking into one cell (red, the frame) from just outside it, every other cell sits inside, and no edge crosses another. ` + lensText(N.LENSES.schlegel, "Schlegel") + ` Edge spread ${D.fmt(spread(sch.pts, S.P.edges, S.P.verts))}.`;
  }

  let hopfOn = true;
  function hopfPaths(turn, count) {
    const R = N.rotation(4, 0, 3, turn), lat = [-0.62, 0, 0.62], out = [];
    lat.forEach((z, li) => {
      const r = Math.sqrt(1 - z * z);
      for (let k = 0; k < count; k++) {
        const a = (2 * Math.PI * (k + 0.5 * li)) / count;
        out.push({ ring: li, pts: N.hopfFiber([r * Math.cos(a), r * Math.sin(a), z], 120).map((p) => N.stereographic(N.matVec(R, p))) });
      }
    });
    return out;
  }
  function drawHopf() {
    const T = D.tokens(), turn = (+$("#hopf-turn").value * Math.PI) / 180, count = +$("#hopf-n").value;
    const { ctx, w, h } = D.fit($("#cv-hopf"), 1), cam = D.camera(0.4, 0.5, 9), sc = Math.min(w, h) / 6.2, scr = D.screen(w, h, sc);
    const cols = [T.s[1] || T.tide, T.red, T.tide];
    const clip = (p) => Math.max(-40, Math.min(40, p));
    if (hopfOn) {
      const R = N.rotation(4, 0, 3, turn);
      for (const [nu, nv, alongU] of [[18, 90, true], [18, 90, false]]) {
        for (let i = 0; i < nu; i++) {
          const pts = [];
          for (let j = 0; j <= nv; j++) {
            const u = (2 * Math.PI * (alongU ? i / nu : j / nv)), v = (2 * Math.PI * (alongU ? j / nv : i / nu)), s = Math.SQRT1_2;
            pts.push(scr(cam(N.stereographic(N.matVec(R, [s * Math.cos(u), s * Math.sin(u), s * Math.cos(v), s * Math.sin(v)])).map(clip))));
          }
          D.path(ctx, pts, T.soft, 0.6, 0.35);
        }
      }
    }
    let smin = Infinity, smax = 0;
    const R4 = N.rotation(4, 0, 3, turn);
    for (const p of N.cliffordTorus(12, 12).concat(N.hopfFiber([0.6, 0, 0.8], 24))) { const sc4 = 1 / (1 - N.matVec(R4, p)[3]); smin = Math.min(smin, sc4); smax = Math.max(smax, sc4); }
    for (const f of hopfPaths(turn, count)) {
      const pts = f.pts.map((p) => scr(cam(p.map(clip))));
      let seg = [pts[0]];
      for (let i = 1; i <= pts.length; i++) {
        const p = pts[i % pts.length], q = seg[seg.length - 1];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) > w / 3) { D.path(ctx, seg, cols[f.ring], 1.6); seg = [p]; } else seg.push(p);
      }
      D.path(ctx, seg, cols[f.ring], 1.6);
    }
    $("#cap-hopf").textContent = `Hopf fibration: ${3 * count} great circles of the 3-sphere, one over each of ${3 * count} points on three latitudes of the ordinary sphere. Every pair of circles links exactly once. The middle latitude's circles lie on the Clifford torus (grey mesh), where |z1| = |z2|. ` + lensText(N.LENSES.stereographic, "stereographic, S3 to R3") + ` Length scale on the torus and one fibre runs from ${D.fmt(smin)} to ${D.fmt(smax)} (ratio ${D.fmt(smax / smin)}); angles are exact.`;
  }

  /* The law table's signatures, as 8 principal components: rotate in a chosen plane and cut a slab. */
  let laws = null, lawPts = [];
  function drawLaws() {
    if (!laws) return;
    const T = D.tokens(), [i, j] = $("#law-plane").value.split(",").map(Number), ang = (+$("#law-turn").value * Math.PI) / 180;
    const slabOn = $("#law-slab-on").checked, s = +$("#law-slab").value / 100, dom = $("#law-dom").value;
    let R = N.rotationFromAngles(8, N.planes(8).map((_, k) => (k < 3 ? 0.3 : 0)));
    R = N.matMul(N.rotation(8, i, j, ang), R);
    const { ctx, w, h } = D.fit($("#cv-laws"), 0.8), cam = D.camera(0.5, 0.3, 6), scr = D.screen(w, h, Math.min(w, h) * 0.36);
    lawPts = [];
    let inSlab = 0, inDom = 0;
    const v8 = N.zeros(8);
    for (const L of laws.laws) { const p = N.matVec(R, L.slice(3)); p.forEach((x, k) => { v8[k] += x * x; }); }
    const shown = (v8[0] + v8[1] + v8[2]) / v8.reduce((a, x) => a + x, 0);
    for (const L of laws.laws) {
      const p = N.matVec(R, L.slice(3)), keep = !slabOn || Math.abs(p[7] - s) < 0.12;
      const q = scr(cam(p.slice(0, 3)));
      if (keep) inSlab++;
      const hit = dom && L[1] === dom;
      if (hit && keep) inDom++;
      ctx.globalAlpha = keep ? 1 : 0.12;
      ctx.fillStyle = hit ? T.red : T.ink;
      ctx.beginPath(); ctx.arc(q[0], q[1], hit ? 3.6 : 2.4, 0, 7); ctx.fill();
      if (keep) lawPts.push([q[0], q[1], L[0], L[1], L[2]]);
    }
    ctx.globalAlpha = 1;
    $("#cap-laws").textContent = `${laws.n_laws} laws, each a point in the first 8 principal components of its ${laws.n_features}-feature signature (${Math.round(laws.variance_kept * 100)}% of the variance). ` +
      (slabOn ? `The cut keeps the ${inSlab} laws within 0.12 of ${D.fmt(s)} on the 8th turned axis. ` : "") + (dom ? `${inDom} shown from domain ${dom}. ` : "") +
      `Lens: orthographic, 8D to 3D after the turn, then a 3D camera. Loses the other 5 kept axes and the ${laws.n_features - 8} dropped components; nearby dots can be far apart in the full signature. The three shown axes carry ${Math.round(shown * 100)}% of the 8D spread.`;
  }
  function pickLaw(e) {
    const r = $("#cv-laws").getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 400;
    for (const p of lawPts) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = p; } }
    $("#law-read").textContent = best ? `${best[2]} (domain ${best[3]}, main form ${best[4]})` : "No law under the pointer.";
  }

  function init() {
    $("#pet-shape").addEventListener("change", drawPetrie);
    $("#sch-shape").addEventListener("change", drawSchlegel);
    $("#sch-turn").addEventListener("input", drawSchlegel);
    $("#hopf-turn").addEventListener("input", drawHopf);
    $("#hopf-n").addEventListener("input", drawHopf);
    $("#hopf-torus").addEventListener("click", (e) => { hopfOn = !hopfOn; e.target.setAttribute("aria-pressed", String(hopfOn)); drawHopf(); });
    try { laws = JSON.parse($("#laws-data").textContent); } catch (err) { console.error("law data failed to parse", err); }
    if (laws) {
      $("#law-dom").insertAdjacentHTML("beforeend", laws.domains.map((d) => `<option value="${d}">${d}</option>`).join(""));
      ["#law-plane", "#law-dom", "#law-slab-on"].forEach((s) => $(s).addEventListener("change", drawLaws));
      ["#law-turn", "#law-slab"].forEach((s) => $(s).addEventListener("input", drawLaws));
      $("#cv-laws").addEventListener("pointermove", pickLaw);
      $("#cv-laws").addEventListener("click", pickLaw);
    }
    const all = () => { drawPetrie(); drawSchlegel(); drawHopf(); drawLaws(); };
    addEventListener("resize", all);
    if (window.Kit) Kit.on(all);
    all();
  }
  window.NGallery = { init };
})();
