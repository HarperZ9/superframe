// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive page: state and shape bridges. Polarisation on the Poincare sphere; Gaussian curvature on a
   surface, heard along a path; extra dimensions through ndim, each extra axis carried by a sense. */
(function () {
  "use strict";
  const PV = window.PV, P = PV.P, N = PV.N, $ = PV.$;
  const deg = Math.PI / 180;
  /* Turn a 3D point for display: yaw about the vertical (third) axis, then tilt toward the viewer. */
  const view = (p, yaw, tilt) => { const x = p[0] * Math.cos(yaw) - p[1] * Math.sin(yaw), d = p[0] * Math.sin(yaw) + p[1] * Math.cos(yaw); return [x, p[2] * Math.cos(tilt) - d * Math.sin(tilt), p[2] * Math.sin(tilt) + d * Math.cos(tilt)]; };
  const hsl = (h, l = 45) => `hsl(${((h % 360) + 360) % 360},70%,${PV.tok.dark ? 65 : l}%)`;

  /* Polarisation */
  const Po = { psi: 0, chi: 20, dop: 1, yaw: 0.6, ph: 0 };
  const PRE = { H: [0, 0], V: [90, 0], D: [45, 0], A: [-45, 0], R: [0, 45], L: [0, -45] };
  const stokes = () => P.ellipseToStokes(Po.psi * deg, Po.chi * deg, Po.dop);
  PV.def({
    id: "pol", bridge: "polarisation", label: "Left: the Poincare sphere with the light's state as a point. Right: the tip of the light's electric field tracing its ellipse, coloured by orientation.",
    init() {
      const set = () => { Po.psi = +$("#p-psi").value; Po.chi = +$("#p-chi").value; Po.dop = +$("#p-dop").value / 100; PV.update(); };
      for (const k of ["#p-psi", "#p-chi", "#p-dop"]) $(k).addEventListener("input", set);
      document.querySelectorAll("[data-pol]").forEach((b) => b.addEventListener("click", () => {
        const [a, c] = PRE[b.dataset.pol]; PV.Kit_set("#p-psi", a); PV.Kit_set("#p-chi", c); PV.Kit_set("#p-dop", 100); set();
      }));
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, 0.6), t = PV.tok, S = stokes(), r = Math.min(w * 0.22, h * 0.4), cx = w * 0.27, cy = h * 0.5, tilt = 0.4;
      const sc = (p) => { const v = view(p, Po.yaw, tilt); return [cx + r * v[0], cy - r * v[1], v[2]]; };
      ctx.strokeStyle = t.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      const ring = (f) => { let prev = null; for (let i = 0; i <= 72; i++) { const p = sc(f((i / 72) * 2 * Math.PI)); if (prev) { ctx.globalAlpha = p[2] < 0 ? 0.25 : 0.7; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); } prev = p; } ctx.globalAlpha = 1; };
      ctx.lineWidth = 1; ring((a) => [Math.cos(a), Math.sin(a), 0]); ring((a) => [Math.cos(a), 0, Math.sin(a)]); ring((a) => [0, Math.cos(a), Math.sin(a)]);
      for (const [p, lab] of [[[1, 0, 0], "H"], [[-1, 0, 0], "V"], [[0, 1, 0], "D"], [[0, -1, 0], "A"], [[0, 0, 1], "S3 +1"], [[0, 0, -1], "S3 -1"]]) { const q = sc(p.map((v) => v * 1.14)); PV.text(ctx, lab, q[0], q[1], { size: 11, align: "center", base: "middle", color: t.soft }); }
      const pt = sc(P.poincare(S)), o = sc([0, 0, 0]);
      ctx.strokeStyle = t.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
      ctx.fillStyle = hsl(Po.psi * 2); ctx.strokeStyle = t.ink; ctx.beginPath(); ctx.arc(pt[0], pt[1], 8, 0, 7); ctx.fill(); ctx.stroke();
      const ex = w * 0.75, ey = h * 0.5, er = Math.min(w * 0.2, h * 0.38), pts = P.ellipsePoints(P.ellipseToStokes(Po.psi * deg, Po.chi * deg, 1));
      ctx.strokeStyle = t.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - er, ey); ctx.lineTo(ex + er, ey); ctx.moveTo(ex, ey - er); ctx.lineTo(ex, ey + er); ctx.stroke();
      ctx.strokeStyle = hsl(Po.psi * 2); ctx.lineWidth = 3; ctx.globalAlpha = 0.3 + 0.7 * Po.dop; ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(ex + er * x, ey - er * y) : ctx.moveTo(ex + er * x, ey - er * y))); ctx.stroke(); ctx.globalAlpha = 1;
      const k = Math.floor((Po.ph / (2 * Math.PI)) * (pts.length - 1)) % (pts.length - 1), tip = pts[k];
      ctx.strokeStyle = t.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + er * tip[0], ey - er * tip[1]); ctx.stroke();
      PV.text(ctx, "the field's tip over one cycle", ex, h - 10, { size: 11, align: "center", color: t.soft });
    },
    tick(dt) { Po.yaw += dt * 0.25; Po.ph = (Po.ph + dt * 2.5) % (2 * Math.PI); return true; },
    describe() {
      const S = stokes(), c = Math.abs(Po.chi), turn = Po.chi > 0 ? "anticlockwise as seen facing the source, with this page's sign" : "clockwise as seen facing the source, with this page's sign";
      const shape = c < 1 ? "a straight line (linear)" : c > 44 ? "a circle (circular)" : "an ellipse";
      return `Orientation ${Po.psi.toFixed(0)} degrees, ellipticity ${Po.chi.toFixed(0)} degrees, ${(Po.dop * 100).toFixed(0)}% polarised. The field traces ${shape}` + (c >= 1 ? `, turning ${turn}` : "") + `. On the sphere: S1 ${S[1].toFixed(2)}, S2 ${S[2].toFixed(2)}, S3 ${S[3].toFixed(2)}` + (Po.dop < 1 ? ", inside the sphere because part of the light is unpolarised." : ", on the surface.");
    },
    loss() {
      const xs = [];
      for (let a = -90; a < 90; a += 2) for (let c = -45; c <= 45; c += 1) xs.push([a, c]);
      const l = P.lossBits(xs, ([a, c]) => P.poincare(P.ellipseToStokes(a * deg, c * deg)).map((v) => Math.round(v * 1e6)));
      return { map: "Stokes vector as a point on the sphere (S1 across, S2 into the page, S3 up); orientation as hue; the field's tip as moving ellipse; S3 as pitch from 330 to 660 Hz; S1 as stereo pan (horizontal left, vertical right); degree of polarisation as loudness.",
        bits: `Over orientations every 2 degrees and ellipticities every degree, ${l.bitsSource.toFixed(2)} bits go in and ${l.bitsKept.toFixed(2)} come out: ${l.bitsLost.toFixed(2)} bits are lost, all at the two poles, where circular light has no orientation to lose.`,
        inverse: "Invertible: the point gives back orientation, ellipticity and degree of polarisation exactly; only the wave's absolute phase is not in the Stokes vector." };
    },
    sound() { const S = stokes(), f = P.bridge(P.window(-1, 1, "linear"), P.window(330, 660, "log")).map(S[3]); return { partials: [{ f, g: 0.3 + 0.7 * Po.dop, pan: -S[1] }], text: `one tone at ${f.toFixed(0)} Hz (S3 ${S[3].toFixed(2)}), placed ${S[1] > 0.3 ? "left" : S[1] < -0.3 ? "right" : "centre"} by S1.` }; },
    haptic() { const S = stokes(); return [(S[3] + 1) / 2, Po.dop]; },
  });

  /* Curvature */
  const G = { kind: "torus", s: 0.3, yaw: 0.5, run: false };
  const SURF = { sphere: [P.surfaces.sphere(1), 1], torus: [P.surfaces.torus(1, 0.45), 1.45], saddle: [P.surfaces.saddle(0.6), 1.4], bump: [P.surfaces.bump(0.8), 2.2] };
  const path = (kind, s) => {
    const [u0, u1, v0, v1] = P.SURFACE_RANGES[kind];
    if (kind === "sphere") return [u0 + (u1 - u0) * 2 * s, 0.25 + (Math.PI - 0.5) * s];
    if (kind === "torus") return [2 * Math.PI * s, 4 * Math.PI * s];
    return [u0 + (u1 - u0) * s, (v0 + v1) / 2 + ((v1 - v0) / 3) * Math.sin(3 * Math.PI * s)];
  };
  let Kmax = 1;
  PV.def({
    id: "geo", bridge: "geometry", label: "A curved surface coloured by Gaussian curvature, warm where it bends like a dome and cool where it bends like a saddle, with a path and a moving point.",
    init() {
      $("#g-kind").addEventListener("change", (e) => { G.kind = e.target.value; PV.update(); });
      $("#g-s").addEventListener("input", (e) => { G.s = e.target.value / 1000; PV.update(); });
      $("#g-run").addEventListener("click", () => { G.run = !G.run; $("#g-run").setAttribute("aria-pressed", String(G.run)); PV.loop(); });
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, 0.6), [f, R] = SURF[G.kind], [u0, u1, v0, v1] = P.SURFACE_RANGES[G.kind], nu = 44, nv = 26, tilt = 0.55, sc = Math.min(w, h) * 0.4 / R;
      const sp = (p) => { const v = view(p, G.yaw, tilt); return [w / 2 + sc * v[0], h / 2 - sc * v[1], v[2]]; };
      const quads = []; Kmax = 1e-9;
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const ua = u0 + ((u1 - u0) * i) / nu, ub = u0 + ((u1 - u0) * (i + 1)) / nu, va = v0 + ((v1 - v0) * j) / nv, vb = v0 + ((v1 - v0) * (j + 1)) / nv;
        const c = P.curvature(f, (ua + ub) / 2, (va + vb) / 2), q = [f(ua, va), f(ub, va), f(ub, vb), f(ua, vb)].map(sp);
        Kmax = Math.max(Kmax, Math.abs(c.K));
        quads.push({ q, K: c.K, z: q.reduce((s, p) => s + p[2], 0) / 4, n: view(c.normal, G.yaw, tilt) });
      }
      quads.sort((a, b) => a.z - b.z);
      for (const d of quads) {
        const t = Math.sign(d.K) * Math.sqrt(Math.abs(d.K) / Kmax), c = PV.diverge(t), lit = 0.6 + 0.4 * Math.abs(d.n[2]);
        ctx.fillStyle = PV.rgb(c.map((v) => Math.round(v * lit))); ctx.beginPath(); d.q.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      }
      // closed surfaces: draw the path faint where it runs on the far side (outward normal facing away)
      const closed = G.kind === "sphere" || G.kind === "torus", ref = P.curvature(f, 0, Math.PI / 2 * (G.kind === "sphere" ? 1 : 0));
      const orient = Math.sign(ref.normal[0] * ref.point[0] + ref.normal[1] * ref.point[1] + ref.normal[2] * ref.point[2]) || 1;
      const front = (s) => !closed || view(P.curvature(f, ...path(G.kind, s)).normal.map((v) => v * orient), G.yaw, tilt)[2] > 0;
      ctx.strokeStyle = PV.tok.ink; ctx.lineWidth = 2;
      let prev = sp(f(...path(G.kind, 0)));
      for (let k = 1; k <= 200; k++) { const p = sp(f(...path(G.kind, k / 200))); ctx.globalAlpha = front(k / 200) ? 1 : 0.2; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); prev = p; }
      ctx.globalAlpha = 1;
      const p = sp(f(...path(G.kind, G.s)));
      ctx.fillStyle = PV.tok.red; ctx.strokeStyle = PV.tok.wall; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.fill(); ctx.stroke();
    },
    tick(dt) { G.yaw += dt * 0.15; if (G.run) { G.s = (G.s + dt / 8) % 1; PV.Kit_set("#g-s", Math.round(G.s * 1000)); $("#desc").textContent = this.describe(); } return true; },
    describe() {
      const c = P.curvature(SURF[G.kind][0], ...path(G.kind, G.s)), kind = Math.abs(c.K) < 1e-6 ? "flat in one direction at least (K = 0)" : c.K > 0 ? "dome-like: it bends the same way in every direction" : "saddle-like: it bends up one way and down the other";
      return `A ${G.kind}. At ${(G.s * 100).toFixed(0)}% along the path the surface is ${kind}. Gaussian curvature K = ${c.K.toFixed(3)} per square unit, mean curvature H = ${c.H.toFixed(3)} per unit.`;
    },
    loss: () => ({ map: "K as a diverging colour on the surface (square-root scale, warm positive, cool negative); shading by the surface's tilt; the point's K as pitch, 150 Hz at the most saddle-like to 1.5 kHz at the most dome-like (mel).",
      bits: "The colour keeps the sign of K everywhere and its size to the ramp's steps; the pitch keeps K along the path to the 0.5% JND; H is in the text only. The view hides the far side of the surface.",
      inverse: "Invertible along the path: pitch maps back to K inside the surface's range." }),
    sound() { const c = P.curvature(SURF[G.kind][0], ...path(G.kind, G.s)), f = P.bridge(P.window(-Kmax, Kmax, "linear"), P.window(150, 1500, "mel")).map(Math.max(-Kmax, Math.min(Kmax, c.K))); return { partials: [{ f, g: 1, pan: 0 }], text: `one tone at ${f.toFixed(0)} Hz for K = ${c.K.toFixed(3)}; press Walk the path to hear it rise over domes and fall through saddles.` }; },
    haptic() { const c = P.curvature(SURF[G.kind][0], ...path(G.kind, G.s)); return [Math.abs(c.K) / Kmax]; },
  });

  /* Extra dimensions, through ndim */
  const D = { shape: "cube:4", ang: { xw: 30, zw: 20 }, assign: { w: "colour", v: "sound" }, s: 0, yaw: 0.6 };
  const PLANES = ["xw", "yw", "zw", "xv", "yv", "zv", "wv"];
  let poly = null, lat = null;
  const load = () => { const [n, d] = D.shape.split(":"); poly = d ? N.polytope(n, +d) : N.polytope(n); lat = N.faceLattice(poly.verts, poly.edges); };
  const angles = () => N.planes(poly.n).map(([i, j]) => (D.ang[N.planeName(i, j)] || 0) * deg);
  const bridge = () => P.dimBridge(N, poly, angles(), D.assign);
  PV.def({
    id: "dims", bridge: "dimensionality", label: "A four- or five-dimensional shape: its first three coordinates drawn as space; its extra coordinates carried by colour, a moving slice, sound or touch.",
    init() {
      load();
      $("#d-shape").addEventListener("change", (e) => { D.shape = e.target.value; load(); document.querySelectorAll(".kn5").forEach((k) => (k.hidden = poly.n < 5)); $("#d-v-wrap").hidden = poly.n < 5; PV.update(); });
      for (const p of PLANES) $("#d-" + p).addEventListener("input", (e) => { D.ang[p] = +e.target.value; PV.update(); });
      for (const a of ["w", "v"]) $("#d-" + a).addEventListener("change", (e) => { D.assign[a] = e.target.value; PV.update(); });
      $("#d-s").addEventListener("input", (e) => { D.s = e.target.value / 100; PV.update(); });
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, 0.6), b = bridge(), sc = Math.min(w, h) * 0.24, tilt = 0.45;
      const sp = (p) => { const v = view(p, D.yaw, tilt), f = 5 / (5 - v[2]); return [w / 2 + sc * f * v[0], h / 2 - sc * f * v[1]]; };
      const pts = b.rows.map((r) => sp(r.p));
      const colOf = (r) => { const k = ["w", "v"].findIndex((a, i) => D.assign[a] === "colour" && r.out[i] != null); return k >= 0 ? P.css(P.spectralRgb(r.out[k]).rgb) : PV.tok.ink; };
      ctx.lineWidth = 1.5; ctx.globalAlpha = D.assign.w === "time" ? 0.3 : 0.8;
      for (const [a, c] of poly.edges) { ctx.strokeStyle = colOf(b.rows[a]); ctx.beginPath(); ctx.moveTo(...pts[a]); ctx.lineTo(...pts[c]); ctx.stroke(); }
      ctx.globalAlpha = 1;
      b.rows.forEach((r, i) => { ctx.fillStyle = colOf(r); ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 4, 0, 7); ctx.fill(); });
      const timeAxis = ["w", "v"].findIndex((a, i) => D.assign[a] === "time" && i < poly.n - 3);
      if (timeAxis >= 0) {
        const nrm = new Array(poly.n).fill(0); nrm[3 + timeAxis] = 1;
        const verts = b.rows.map((r) => r.p.concat(r.extra)), off = D.s * b.rmax;
        ctx.strokeStyle = PV.tok.red; ctx.lineWidth = 3;
        for (const [p, q] of N.sliceSegments(verts, lat, nrm, off)) { ctx.beginPath(); ctx.moveTo(...sp(p.slice(0, 3))); ctx.lineTo(...sp(q.slice(0, 3))); ctx.stroke(); }
      }
    },
    tick(dt) { D.yaw += dt * 0.2; if (["w", "v"].some((a) => D.assign[a] === "time")) { D.s = Math.sin(performance.now() / 2500); PV.Kit_set("#d-s", Math.round(D.s * 100)); } return true; },
    describe() {
      const b = bridge(), ax = poly.n === 5 ? ["w", "v"] : ["w"];
      const say = { colour: "as colour (440 nm blue at one end to 640 nm red at the other)", sound: "as sound (one note per corner, 220 to 880 Hz)", touch: "as touch (pulse length)", time: "as time (a slice sweeps along it, drawn in red)", none: "by nothing: it is flattened away" };
      return `A ${poly.name.replace("cube", "hypercube").replace("cross", "cross-polytope")} in ${poly.n}D: ${poly.verts.length} corners, ${poly.edges.length} edges. x, y and z are drawn as space; ` + ax.map((a) => `${a} is carried ${say[D.assign[a]]}`).join("; ") + `. ${b.loss.bitsLost === 0 ? "Every corner stays distinct." : `${b.loss.bitsLost.toFixed(2)} bits are lost: some corners land on top of each other.`}`;
    },
    loss() {
      const b = bridge();
      return { map: `ndim plane rotations, then x, y, z as space (ndim's orthographic lens: "${b.lens.keeps[0]}"); each extra axis into the sense picked for it.`,
        bits: `${b.loss.bitsSource.toFixed(2)} bits name the corners; after the senses, ${b.loss.bitsKept.toFixed(2)} remain distinct, so ${b.loss.bitsLost.toFixed(2)} bits are lost. Give an unassigned axis a sense and the loss falls.`,
        loses: b.chans.some((c) => !c) ? "the axes left without a sense: " + b.lens.loses[0] : "only what each sense cannot tell apart at its step (2 nm of hue, 0.5% of pitch, 10 ms of pulse, one frame of time)",
        inverse: "Invertible per axis: each colour, note, pulse or moment maps back to its coordinate." };
    },
    sound() {
      const b = bridge(), k = ["w", "v"].findIndex((a, i) => D.assign[a] === "sound" && i < poly.n - 3);
      if (k < 0) return { partials: [], text: "silence: no axis is given to sound. Pick sound for w or v." };
      const fs = [...new Set(b.rows.map((r) => Math.round(r.out[k])))].slice(0, 24);
      return { partials: fs.map((f) => ({ f, g: 1, pan: 0 })), text: `a chord of ${fs.length} notes, one for each distinct ${"wv"[k]} value among the corners, from ${Math.min(...fs)} to ${Math.max(...fs)} Hz; turn a ${"wv"[k]}-plane knob and it shifts.` };
    },
    haptic() { const b = bridge(), k = ["w", "v"].findIndex((a, i) => D.assign[a] === "touch" && i < poly.n - 3); return k < 0 ? [0.2] : b.rows.slice(0, 12).map((r) => (r.out[k] - 10) / 80); },
  });
})();
