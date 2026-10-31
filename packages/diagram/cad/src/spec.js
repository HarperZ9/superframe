// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/spec: the spec sheet, generated from the resolved model and the pipeline's own stage records.
   Ranges and the accuracy budget come from the instrument's physics; the assumptions come from stage 1 of the
   pipeline example (the one place they are written) and each carries a flag saying whether it is optional:
   an optional assumption is a door, a design choice that a different build could drop. An assumption without
   a flag refuses the sheet, so the two files cannot drift apart. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  C.specSheet = (R, pipeline) => {
    const I = R.inst, sp = I.spec(R.p, R.phys, R.B), problems = [];
    const st1 = pipeline && pipeline.stages && pipeline.stages.find((s) => s.stage === 1);
    const walls = (st1 && st1.spec && st1.spec.wall_assumptions) || [];
    if (!walls.length) problems.push("spec: the pipeline record has no stage-1 assumptions");
    const assumptions = walls.map((w) => {
      const f = (I.assumptions || []).find((a) => w.assumption.toLowerCase().includes(a.match.toLowerCase()));
      if (!f) problems.push(`spec: assumption "${w.assumption}" has no optional flag`);
      return { text: w.assumption, how_checked: w.how_checked, if_broken: w.if_broken, optional: f ? !!f.optional : null, door: f ? f.door : "" };
    });
    for (const a of I.assumptions || []) if (!walls.some((w) => w.assumption.toLowerCase().includes(a.match.toLowerCase()))) problems.push(`spec: flag "${a.match}" matches no pipeline assumption`);
    const rss = Math.sqrt(sp.budget.filter((b) => typeof b.value === "number" && b.combine !== false).reduce((s, b) => s + b.value * b.value, 0));
    return { id: I.id, title: I.title, hash: R.hash, law: st1 && st1.spec.law ? st1.spec.law.form : "", ranges: sp.ranges, budget: sp.budget, combined: { value: rss, unit: sp.budgetUnit, note: sp.combinedNote || "root sum of squares of the numeric terms; terms marked unknown are not in it" }, assumptions, problems, params: R.p };
  };

  const fmt = (v, u) => (typeof v === "number" ? +v.toPrecision(3) + (u ? " " + u : "") : v === null || v === undefined ? "unknown" : String(v));
  C.specHTML = (S) => {
    const ranges = S.ranges.map((r) => `<tr><td>${esc(r.quantity)}</td><td class="num">${fmt(r.min)}</td><td class="num">${fmt(r.max)}</td><td>${esc(r.unit)}</td><td>${esc(r.limit)}</td></tr>`).join("");
    const budget = S.budget.map((b) => `<tr data-basis="${esc(b.basis)}"><td>${esc(b.term)}</td><td class="num">${fmt(b.value)}</td><td>${esc(b.basis)}</td><td>${esc(b.note || "")}</td></tr>`).join("");
    const as = S.assumptions.map((a, i) => `<li><strong>${a.optional ? "Optional" : "Required"}.</strong> ${esc(a.text)}. <span class="sp-how">Checked by: ${esc(a.how_checked)}.</span>${a.optional && a.door ? ` <span class="sp-door">Door: ${esc(a.door)}</span>` : ""}</li>`).join("");
    return `<div class="sp"><h3>Ranges</h3><div class="k-scroll"><table><thead><tr><th scope="col">Quantity</th><th scope="col">From</th><th scope="col">To</th><th scope="col">Unit</th><th scope="col">Set by</th></tr></thead><tbody>${ranges}</tbody></table></div>` +
      `<h3>Accuracy budget (${esc(S.combined.unit)})</h3><div class="k-scroll"><table><thead><tr><th scope="col">Term</th><th scope="col">Size</th><th scope="col">Basis</th><th scope="col">Note</th></tr></thead><tbody>${budget}<tr class="sp-sum"><td>Combined</td><td class="num">${fmt(S.combined.value)}</td><td>computed</td><td>${esc(S.combined.note)}</td></tr></tbody></table></div>` +
      `<h3>Assumptions</h3><ol class="sp-as">${as}</ol><p class="k-meta">Model hash ${esc(S.hash)}.</p></div>`;
  };
  C.specMD = (S) => {
    const L = [`# ${S.title}: spec sheet`, "", `Generated from model hash ${S.hash}. Law: ${S.law}`, "", "## Ranges", "", "| Quantity | From | To | Unit | Set by |", "|---|---|---|---|---|"];
    for (const r of S.ranges) L.push(`| ${r.quantity} | ${fmt(r.min)} | ${fmt(r.max)} | ${r.unit} | ${r.limit} |`);
    L.push("", `## Accuracy budget (${S.combined.unit})`, "", "| Term | Size | Basis | Note |", "|---|---|---|---|");
    for (const b of S.budget) L.push(`| ${b.term} | ${fmt(b.value)} | ${b.basis} | ${b.note || ""} |`);
    L.push(`| Combined | ${fmt(S.combined.value)} | computed | ${S.combined.note} |`, "", "## Assumptions", "");
    S.assumptions.forEach((a, i) => L.push(`${i + 1}. ${a.optional ? "**Optional.**" : "**Required.**"} ${a.text}. Checked by: ${a.how_checked}.${a.optional && a.door ? " Door: " + a.door : ""}`));
    L.push("", "## Parameters", "", "| Parameter | Value |", "|---|---|", ...Object.entries(S.params).map(([k, v]) => `| ${k} | ${v} |`), "");
    return L.join("\n");
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);
