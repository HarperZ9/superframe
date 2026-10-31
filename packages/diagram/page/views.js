// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram page: the other views of the same model. The schematic and its AN 123 variant panels, the time
   traces, the spacetime (4D) view and the register-state table. Each draws from the model and the shared state. */
(function () {
  "use strict";
  const D = window.Diagram;
  const V = (window.DViews = {});

  V.schematic = (host, def, onPick, onControl) => {
    const S = D.schematicSVG(def, { uid: "main" });
    host.innerHTML = S.svg;
    const svg = host.querySelector("svg"), flow = svg.querySelector(".dg-flow");
    const paths = (def.links || []).map((l) => (S.pos.has(l.from) && S.pos.has(l.to) ? D.linkPath(S.pos, l, def) : null));
    const bind = (root) => {
      root.querySelectorAll("[data-part]").forEach((g) => {
        const go = () => onPick(g.dataset.part);
        g.addEventListener("click", go);
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      });
      root.querySelectorAll("[data-control]").forEach((g) => {
        const go = () => onControl(g.dataset.control);
        g.addEventListener("click", go);
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      });
    };
    bind(host);
    return {
      bind,
      select: (id) => { document.querySelectorAll(".dg-sch [data-part]").forEach((g) => g.classList.toggle("sel", g.dataset.part === id)); },
      flow: (u, state) => {
        if (!flow) return;
        const amp = state && state.flow !== undefined ? state.flow : 0, out = [];
        paths.forEach((p, i) => {
          if (!p || (def.links[i].kind === "data" && !state)) return;
          for (let j = 0; j < 3; j++) { const q = D.alongPath(p, j / 3 + 0.17 + 0.12 * amp); out.push(`<circle class="dg-dot" r="2.6" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}"/>`); }
        });
        flow.innerHTML = out.join("");
      },
    };
  };

  /* One base schematic redrawn per variant, stacked, with the active path heavy and the verdict beside it. */
  V.variants = (host, def) => {
    if (!def.variants) { host.hidden = true; return; }
    host.innerHTML = def.variants.map((vr, i) => {
      const d2 = Object.assign({}, def, { parts: def.parts.map((p) => (vr.relabel && vr.relabel[p.id] ? Object.assign({}, p, { short: vr.relabel[p.id] }) : p)), links: (def.links || []).filter((l) => !(vr.drop || []).includes(l.from + ">" + l.to)), controls: [] });
      const S = D.schematicSVG(d2, { uid: "v" + i, variant: vr, aria: vr.title + ": " + vr.verdict });
      return `<figure class="dg-var"><figcaption><strong>${vr.title}</strong></figcaption><div class="dg-var-row">${S.svg}<p class="dg-verdict" data-verdict="${vr.kind}">${vr.verdict}</p></div></figure>`;
    }).join("");
  };

  V.trace = (cv, sim, u, view) => {
    if (!sim.trace) return;
    D.drawPanels(cv, sim.trace(u, view), view.tokens, { panelH: cv.clientWidth < 520 ? 112 : 132 });
  };

  /* Spacetime: edges coloured by the part they belong to, the instant t0 as red points. */
  V.spacetime = (cv, F, view, opt) => {
    const { ctx, w, h } = D.fitCanvas(cv, Math.round(Math.min(460, Math.max(280, (cv.clientWidth || 600) * 0.62))));
    const P = D.spacetimeProject(F, opt.angles, opt.lens, w, h), tk = view.tokens;
    ctx.lineWidth = 1;
    const groups = new Map();
    F.edges.forEach((e, i) => { const p = F.edgePart ? F.edgePart[i] : -1; if (!groups.has(p)) groups.set(p, []); groups.get(p).push(e); });
    const pal = [tk.ink, tk.s2, tk.s3, tk.s5, tk.soft];
    let gi = 0;
    for (const [p, es] of groups) {
      ctx.strokeStyle = p === view.selIndex ? tk.red : pal[gi++ % pal.length]; ctx.lineWidth = p === view.selIndex ? 1.6 : 0.8;
      ctx.globalAlpha = p === view.selIndex ? 1 : 0.55;
      ctx.beginPath();
      for (const [a, b] of es) { ctx.moveTo(P.pts[a][0], P.pts[a][1]); ctx.lineTo(P.pts[b][0], P.pts[b][1]); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const axes = [[1.15, 0, 0, 0], [0, 1.15, 0, 0], [0, 0, 1.15, 0], [0, 0, 0, 1.15]], o = P.screen([0, 0, 0, 0]);
    ctx.font = `600 12px ${tk.mono}`; ctx.fillStyle = tk.soft; ctx.strokeStyle = tk.line;
    axes.forEach((a, k) => { const s = P.screen(a); ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(s[0], s[1]); ctx.stroke(); ctx.fillText(F.axes[k], s[0] + 4, s[1]); });
    const sl = D.spacetimeSlice(F, opt.t0);
    ctx.fillStyle = tk.red;
    for (const q of sl.pts) { const s = P.screen(q); ctx.beginPath(); ctx.arc(s[0], s[1], 4.5, 0, 7); ctx.fill(); }
    return { P, slice: sl, bits: D.spacetimeBits(F, P) };
  };

  V.table = (host, sim, u, view) => {
    if (!sim.table) { host.hidden = true; return; }
    const T = sim.table(u, view);
    host.hidden = false;
    host.innerHTML = `<table><caption>${T.caption}</caption><thead><tr>${T.head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${T.rows.map((r, i) => `<tr${i === T.now ? ' class="now"' : ""}>${r.map((c) => `<td class="num">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };
})();
