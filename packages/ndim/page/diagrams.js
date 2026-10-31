// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim page, working layer: Coxeter-Dynkin diagrams from computed simple roots, the face lattice as a
   Hasse diagram, the f-vector table computed in this page, and the known-answer test record. */
(function () {
  "use strict";
  const N = window.NDim, $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const NS = "http://www.w3.org/2000/svg";

  /* name, polytope maker args, group, ringed node in diagram order */
  const DYN = [["5-cell", ["simplex", 4], "A4", 0], ["tesseract", ["cube", 4], "B4", 0], ["16-cell", ["cross", 4], "B4", 3],
    ["24-cell", ["24-cell"], "F4", 0], ["120-cell", ["120-cell"], "H4", 0], ["600-cell", ["600-cell"], "H4", 3],
    ["5-simplex", ["simplex", 5], "A5", 0], ["penteract", ["cube", 5], "B5", 0], ["5-orthoplex", ["cross", 5], "B5", 4]];
  function dynkinSvg(group, ring) {
    const ch = N.chainOrder(N.dynkin(N.simpleRoots(N.rootSystem(group)))), k = ch.order.length, gap = 46, W = gap * (k - 1) + 28;
    let s = `<svg viewBox="0 0 ${W} 40" width="${W}" height="40" role="img" aria-label="Coxeter-Dynkin diagram of ${group}: ${k} nodes, labels ${ch.labels.join(", ")}, node ${ring + 1} ringed"><title>${group}: ${ch.labels.join(" ")}</title>`;
    for (let i = 0; i < k - 1; i++) {
      const x = 14 + i * gap;
      s += `<line x1="${x}" y1="24" x2="${x + gap}" y2="24" class="dy-edge"/>`;
      if (ch.labels[i] > 3) s += `<text x="${x + gap / 2}" y="15" class="dy-lab">${ch.labels[i]}</text>`;
    }
    for (let i = 0; i < k; i++) {
      const x = 14 + i * gap;
      if (i === ring) s += `<circle cx="${x}" cy="24" r="9" class="dy-ring"/>`;
      s += `<circle cx="${x}" cy="24" r="5" class="dy-node"/>`;
    }
    return { svg: s + "</svg>", labels: ch.labels };
  }

  function fTable() {
    const rows = [];
    const add = (label, P, want) => {
      const t0 = performance.now(), L = N.faceLattice(P.verts, P.edges), ms = performance.now() - t0;
      const chi = N.euler(L.fvector), chiWant = 1 - (-1) ** P.n, ok = (!want || want.join() === L.fvector.join()) && chi === chiWant;
      rows.push(`<tr><th scope="row">${esc(label)}</th><td>${esc(P.schlafli || "")}</td><td class="num">${L.fvector.join(", ")}</td><td class="num">${want ? want.join(", ") : "formula"}</td><td class="num">${chi} (want ${chiWant})</td><td class="num">${ms.toFixed(0)}</td><td data-verdict="${ok ? "pass" : "fail"}">${ok ? "pass" : "fail"}</td></tr>`);
    };
    const b = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };
    for (let n = 2; n <= 5; n++) {
      add(`${n}-simplex`, N.polytope("simplex", n), [...Array(n).keys()].map((k) => b(n + 1, k + 1)));
      add(`${n}-cube`, N.polytope("cube", n), [...Array(n).keys()].map((k) => b(n, k) * 2 ** (n - k)));
      add(`${n}-orthoplex`, N.polytope("cross", n), [...Array(n).keys()].map((k) => 2 ** (k + 1) * b(n, k + 1)));
    }
    add("24-cell", N.polytope("24-cell"), [24, 96, 96, 24]);
    add("600-cell", N.polytope("600-cell"), [120, 720, 1200, 600]);
    add("120-cell (Wythoff)", N.polytope("120-cell"), [600, 1200, 720, 120]);
    $("#ftable tbody").innerHTML = rows.join("");
  }

  /* Hasse diagram: every face, one row per dimension, a line for each containment. Large lattices show the
     interval above vertex 0 (the faces that hold it), which is the vertex figure's lattice turned upside down. */
  function hasse() {
    const name = $("#hasse-shape").value, [k, n] = name.split(":"), P = N.polytope(k, n ? +n : undefined), L = N.faceLattice(P.verts, P.edges), d = L.d;
    const total = L.fvector.reduce((a, x) => a + x, 0), full = total <= 260;
    let keep = L.faces.map((F) => F.map((_, i) => i));
    if (!full) keep = L.faces.map((F) => F.map((f, i) => (f.includes(0) ? i : -1)).filter((i) => i >= 0));
    const W = 680, H = 60 + 70 * (d + 1), pos = [];
    const xs = (m) => (i) => (m === 1 ? W / 2 : 24 + (i * (W - 48)) / (m - 1));
    const levelY = (lv) => H - 30 - lv * 70;
    pos[0] = new Map(keep[0].map((id, i) => [id, xs(keep[0].length)(i)]));
    for (let lv = 1; lv < d; lv++) {
      const kids = (fi) => L.faces[lv][fi].filter((v) => lv === 1 ? pos[0].has(v) : true);
      const order = keep[lv].map((fi) => [fi, lv === 1 ? avg(kids(fi).map((v) => pos[0].get(v))) : avgChildren(L, lv, fi, pos[lv - 1])]).sort((a, b) => a[1] - b[1]);
      pos[lv] = new Map(order.map(([fi], i) => [fi, xs(order.length)(i)]));
    }
    let lines = "", dots = "";
    for (const [v, x] of pos[0]) lines += `<line x1="${W / 2}" y1="${H - 10}" x2="${x}" y2="${levelY(0)}" class="hs-e"/>`;
    for (let lv = 0; lv < d - 1; lv++) for (const [fi, x] of pos[lv]) for (const pj of L.parents[lv][fi] || []) if (pos[lv + 1].has(pj)) lines += `<line x1="${x}" y1="${levelY(lv)}" x2="${pos[lv + 1].get(pj)}" y2="${levelY(lv + 1)}" class="hs-e"/>`;
    for (const [, x] of pos[d - 1]) lines += `<line x1="${x}" y1="${levelY(d - 1)}" x2="${W / 2}" y2="${levelY(d)}" class="hs-e"/>`;
    for (let lv = 0; lv < d; lv++) for (const [, x] of pos[lv]) dots += `<circle cx="${x}" cy="${levelY(lv)}" r="${pos[lv].size > 60 ? 1.6 : 3}" class="hs-n"/>`;
    dots += `<circle cx="${W / 2}" cy="${H - 10}" r="4" class="hs-end"/><circle cx="${W / 2}" cy="${levelY(d)}" r="4" class="hs-end"/>`;
    const labels = ["vertices", "edges", "faces", "cells", "4-faces"].slice(0, d).map((t, lv) => `<text x="4" y="${levelY(lv) - 8}" class="hs-t">${pos[lv].size} ${t}</text>`).join("");
    const label = $("#hasse-shape").selectedOptions[0].textContent;
    const what = full ? `the whole face lattice of the ${label}: ${L.fvector.join(", ")} faces by dimension` : `the ${pos.map((m) => m.size).join(", ")} faces that hold one vertex (the full lattice of the ${label} has ${total} faces)`;
    $("#hasse").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hasse diagram: ${esc(what)}"><title>Hasse diagram</title>${lines}${dots}${labels}</svg>`;
    $("#cap-hasse").textContent = `Hasse diagram, ${what}. Bottom: the empty face; top: the polytope itself; a line means "is a face of".`;
  }
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  function avgChildren(L, lv, fi, below) {
    const xs = [];
    below.forEach((x, ci) => { if ((L.parents[lv - 1][ci] || []).includes(fi)) xs.push(x); });
    return avg(xs);
  }

  function tests() {
    let t = null;
    try { t = JSON.parse($("#tests-data").textContent); } catch (e) { console.error("test record failed to parse", e); return; }
    const s = t.summary;
    $("#test-sum").innerHTML = `<b>${s.pass}</b> checks pass, <b>${s.fail}</b> fail; <b>${s.planted_rejected}</b> planted wrong values rejected, <b>${s.planted_accepted}</b> accepted. Run ${esc(t.date.slice(0, 16).replace("T", " "))} UTC with <code>node tests/known.test.js</code>.`;
    $("#test-rows").innerHTML = t.rows.filter((r) => !/ time$/.test(r.name)).map((r) => `<tr><td>${esc(r.name)}</td><td data-verdict="${r.ok ? "pass" : "fail"}">${r.ok ? (r.name.startsWith("planted") ? "rejected" : "pass") : "fail"}</td><td>${esc(r.detail == null ? "" : r.detail)}</td></tr>`).join("");
  }
  function lenses() {
    $("#lens-rows").innerHTML = Object.entries(N.LENSES).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v.keeps.join("; "))}</td><td>${esc(v.loses.join("; "))}</td></tr>`).join("");
  }
  function init() {
    $("#dynkin").innerHTML = DYN.map(([name, , g, ring]) => { const d = dynkinSvg(g, ring); return `<figure class="dy"><div>${d.svg}</div><figcaption><b>${esc(name)}</b> ${esc(g)}</figcaption></figure>`; }).join("");
    fTable(); tests(); lenses(); hasse();
    $("#hasse-shape").addEventListener("change", hasse);
  }
  window.NDiagrams = { init };
})();
