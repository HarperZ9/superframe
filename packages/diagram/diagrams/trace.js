// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Calibration traceability as a hierarchy you can walk. Sources: HP-GAPS.md section 4 (NIST traceability policy). */
(function (g) {
  "use strict";
  const D = g.Diagram;
  /* id, label, short, position, fractional uncertainty this link adds (illustrative), calibrated (year), due (year) */
  const N = [
    ["si", "SI second", "SI second", [0, 6.4, 0], 0, 2019.4, 2100, "The definition: 9 192 631 770 periods of the cesium-133 hyperfine transition. Exact by definition."],
    ["nist", "National lab primary (NIST-F2)", "NIST-F2", [-1.8, 5.0, 0], 1e-16, 2024.0, 2027.0, "A cesium fountain realises the second."],
    ["nmi", "Another national lab", "other NMI", [1.8, 5.0, 0], 2e-16, 2024.0, 2027.0, "Other national labs realise the second too and compare with each other."],
    ["gps", "Transfer: GPS common view", "GPS common view", [-2.6, 3.6, 0.8], 1e-13, 2024.6, 2025.6, "Both ends watch the same satellite at once, so its clock error cancels."],
    ["carry", "Transfer: carried clock", "carried clock", [0.4, 3.6, -0.8], 3e-13, 2024.5, 2025.5, "A clock carried between labs, as HP did in 1964."],
    ["acc", "Accredited calibration lab", "accredited lab", [-1.6, 2.2, 0], 1e-12, 2024.8, 2025.8, "Issues certificates with a stated uncertainty."],
    ["ws", "Working standard (rubidium)", "working standard", [-1.6, 0.8, 0], 5e-11, 2024.9, 2025.4, "The bench reference, dated, with a due date."],
    ["inst", "Your frequency counter", "your counter", [-2.8, -0.6, 0], 1e-7, 2025.0, 2026.0, "Its reading plus uncertainty is what you use."],
    ["inst2", "A second instrument", "signal generator", [-0.4, -0.6, 0], 1e-9, 2025.0, 2026.0, "Shares the same working standard."],
  ];
  const E = [["si", "nist"], ["si", "nmi"], ["nist", "gps"], ["nist", "carry"], ["nmi", "carry"], ["gps", "acc"], ["acc", "ws"], ["ws", "inst"], ["ws", "inst2"]];
  const CHAIN = ["inst", "ws", "acc", "gps", "nist", "si"];
  const byId = Object.fromEntries(N.map((n) => [n[0], n]));
  const width = (u) => (u ? 0.9 + 0.12 * (Math.log10(u) + 17) : 0.9);
  const part = (o) => Object.assign({ material: "electronics" }, o);
  const parts = N.map(([id, label, short, pos, u, cal, due, fn]) => part({ id, label, short, alt: `A platform labelled ${label}; its width grows with the uncertainty carried down to it.`, fn, qty: u ? `adds ${u.toExponential(0)} (fractional, illustrative)` : "exact", material: id === "si" ? "brass" : "ceramic", geom: { t: "box", size: [width(u) * 1.2, 0.16, 1.1] }, pos, explode: { axis: [0, pos[1] > 3 ? 1 : -1, 0], dist: 0.6 } }));
  const postParts = E.map(([a, b]) => {
    const A = byId[a][3], B = byId[b][3], mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz);
    const rz = (Math.atan2(-dx, dy) * 180) / Math.PI, rx = (Math.atan2(dz, Math.hypot(dx, dy)) * 180) / Math.PI;
    return part({ id: `cal-${a}-${b}`, label: `Calibration: ${byId[a][2]} to ${byId[b][2]}`, alt: `A post joining ${byId[a][1]} to ${byId[b][1]}: one calibration link.`, fn: "One documented calibration; it adds its own uncertainty and has a due date.", material: "steel", noSchematic: true, geom: { t: "cyl", r: 0.06, h: L - 0.2, seg: 10 }, rot: [rx, 0, rz], pos: mid, explode: { axis: [0, 0, 1], dist: 0.4 } });
  });
  const def = {
    id: "trace", title: "The traceability chain", region: "surreal", file: "traceability.html", super: "SI",
    message: "A reading means something only if every link back to the definition of the unit is unbroken, and each link adds its own uncertainty.",
    lede: "From your instrument up to the SI second, a hierarchy you can walk: each calibration a post, each standard a platform whose width grows with the uncertainty carried down to it.",
    camera: { yaw: 0.5, pitch: 0.25, zoom: 2.3 }, cut: { axis: "z", d: 0.3 }, startU: 0.4, playSeconds: 20,
    parts: parts.concat(postParts),
    links: E.map(([a, b]) => ({ from: b, to: a, label: b === "ws" ? "cert, due 2025.4" : "" })),
    variants: [
      { mode: "intact", title: "A. Every certificate in date", path: CHAIN, kind: "pass", verdict: "Unbroken chain: the counter's reading traces to the SI second, with u = 1.0 x 10^-7." },
      { mode: "expired", title: "B. The working standard's certificate has lapsed", path: CHAIN, kind: "fail", relabel: { ws: "ws, EXPIRED" }, verdict: "One lapsed link breaks the claim for everything below it, however good the labs above." },
    ],
  };
  const rss = (ids) => Math.sqrt(ids.reduce((s, i) => s + byId[i][4] ** 2, 0));
  def.sim = (model) => {
    const P = (id) => { const p = model.index.get(id); return D.v3.add(p.pos, [0, 0.2, 0]); };
    return {
      duration: null,
      state: (u, view) => {
        const broken = view.variant === "expired", seg = u * (CHAIN.length - 1), i = Math.min(CHAIN.length - 2, Math.floor(seg)), f = seg - i;
        const stop = broken ? 1 : CHAIN.length - 1;
        const at = seg >= stop ? P(CHAIN[stop]) : D.v3.lerp(P(CHAIN[i]), P(CHAIN[i + 1]), f);
        const parts = {};
        CHAIN.forEach((id, k) => { if (k <= Math.min(seg, stop)) parts[id] = { emit: 0.2, glow: [0.9, 0.35, 0.2] }; });
        if (broken) { parts["cal-acc-ws"] = { tok: "red", move: [0, 0, 0.6] }; parts.ws = { tok: "drift" }; }
        return { parts, points: [{ p: at, r: 6, tok: "red" }], flow: u, readout: { seg } };
      },
      trace: (u, view) => {
        const broken = view.variant === "expired", k = Math.min(CHAIN.length - 1, Math.round(u * (CHAIN.length - 1)));
        const bars = CHAIN.map((id, j) => ({ name: byId[id][2], value: Math.max(1e-17, rss(CHAIN.slice(j))), text: id === "si" ? "exact" : undefined, tok: broken && j <= 1 ? "s1" : j === k ? "red" : "s2" }));
        return [{ title: broken ? "Combined uncertainty from each level up to the SI second: broken below the lapsed link" : "Combined uncertainty from each level up to the SI second (root sum of squares)", y: { min: 1e-17, max: 1e-5, label: "u, fractional" }, bars }];
      },
      spacetime: () => {
        const verts = [], edges = [], timelike = [], edgePart = [];
        for (const [id, , , pos, , cal, due] of N) {
          const pid = model.index.get(id).index, end = Math.min(due, 2027.5);
          const ww = id === "ws" ? 2025.4 : end;
          verts.push([pos[0], pos[1], pos[2], cal], [pos[0], pos[1], pos[2], ww]);
          edges.push([verts.length - 2, verts.length - 1]); timelike.push(1); edgePart.push(pid);
        }
        for (const [a, b] of E) {
          const A = byId[a], B = byId[b], t = B[5];
          verts.push([A[3][0], A[3][1], A[3][2], t], [B[3][0], B[3][1], B[3][2], t]);
          edges.push([verts.length - 2, verts.length - 1]); timelike.push(0); edgePart.push(model.index.get(b).index);
        }
        return { verts, edges, timelike, edgePart, axes: ["x", "level", "z", "date"], angles: [0, 0, 0.6, 0, 0, 0] };
      },
    };
  };
  def.checks = () => [
    { name: "independent links add in quadrature: 3 and 4 make 5", got: Math.sqrt(3e-12 ** 2 + 4e-12 ** 2), want: 5e-12, tol: 1e-12 },
    { name: "the counter's combined uncertainty is dominated by its own link", got: rss(CHAIN), want: 1e-7, tol: 1e-6 },
  ];
  def.plain = `<p>When an instrument says 10.000 000 MHz, the number is only as good as whatever the instrument was last checked against. That reference was checked against a better one, and so on, up to a national lab that realises the second itself, and finally to the definition of the second. Each check is a link. Each link adds a little doubt, and each has a date after which it no longer counts.</p>
<p>Press play to walk up the chain from your counter to the SI second. The platforms get narrower as the doubt shrinks toward the top. Pick the lapsed-certificate circuit and the walk stops at the broken link: everything below it has lost its claim, however good the labs above. The spacetime view turns dates into a fourth axis; slice at any date to see which links were valid then.</p>`;
  def.working = `<p class="math">VIM, as NIST adopts it: traceability is a documented, unbroken chain of calibrations, each contributing to the measurement uncertainty
Independent links: u_total = sqrt(sum u_i^2) (GUM); correlated links need the covariance terms
Counter: sqrt((1e-7)^2 + (5e-11)^2 + (1e-12)^2 + (1e-13)^2 + (1e-16)^2) = 1.00 x 10^-7</p>
<p>All uncertainties and dates on this page are illustrative, chosen to show the structure; they are not anyone's certificate. NIST's policy (fetched 2026-10-30): the provider of a result supports the traceability claim and the user judges it; NIST does not certify anyone else's traceability; and traceability "does not signify or guarantee fitness for purpose". The check that follows the chain is fitness for purpose: compare u_total with the tolerance the decision needs.</p>`;
  def.sources = ["NIST, metrological traceability policy (nist.gov/calibrations/traceability)", "HP-GAPS.md section 4"];
  (g.DiagramDefs = g.DiagramDefs || {}).trace = def;
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
