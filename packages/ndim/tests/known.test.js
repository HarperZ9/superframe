// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Known-answer tests for ndim, written before the library.
   node tests/known.test.js     exit 1 if any check fails or any planted wrong value is accepted.

   Each check compares a computed value with a published or analytic one. Each block also plants one
   wrong value and requires the same comparison to reject it, so a check that accepts anything fails. */
"use strict";
const N = require("../src/index.js");

const out = { pass: 0, fail: 0, planted_rejected: 0, planted_accepted: 0, rows: [] };
function check(name, ok, detail) {
  out[ok ? "pass" : "fail"]++;
  out.rows.push({ name, ok, detail });
  if (!ok) console.error("FAIL", name, detail || "");
}
function planted(name, accepted, detail) {
  out[accepted ? "planted_accepted" : "planted_rejected"]++;
  out.rows.push({ name: "planted: " + name, ok: !accepted, detail });
  if (accepted) console.error("PLANTED VALUE ACCEPTED", name, detail || "");
}
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const close = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };

/* 1. f-vectors and Euler characteristic */
function fvectorBlock() {
  const expect = {};
  for (let n = 2; n <= 6; n++) {
    expect["simplex" + n] = [N.polytope("simplex", n), [...Array(n).keys()].map((k) => binom(n + 1, k + 1))];
    expect["cube" + n] = [N.polytope("cube", n), [...Array(n).keys()].map((k) => binom(n, k) * 2 ** (n - k))];
    expect["cross" + n] = [N.polytope("cross", n), [...Array(n).keys()].map((k) => 2 ** (k + 1) * binom(n, k + 1))];
  }
  expect.tesseract = [N.polytope("cube", 4), [16, 32, 24, 8]];
  expect.cell24 = [N.polytope("24-cell"), [24, 96, 96, 24]];
  expect.cell120 = [N.polytope("120-cell"), [600, 1200, 720, 120]];
  expect.cell600 = [N.polytope("600-cell"), [120, 720, 1200, 600]];
  const lat = {};
  for (const [k, [P, f]] of Object.entries(expect)) {
    const L = N.faceLattice(P.verts, P.edges);
    lat[k] = L;
    check("f-vector " + k, eq(L.fvector, f), `got ${L.fvector} want ${f}`);
    check("Euler " + k, N.euler(L.fvector) === 1 - (-1) ** P.n, `chi ${N.euler(L.fvector)}`);
    check("edges agree " + k, L.fvector[1] === P.edges.length, `lattice ${L.fvector[1]} min-distance ${P.edges.length}`);
  }
  planted("tesseract f-vector 16,32,25,8", eq(lat.tesseract.fvector, [16, 32, 25, 8]));
  planted("120-cell f-vector 600,1200,720,121", eq(lat.cell120.fvector, [600, 1200, 720, 121]));
}

/* 2. cross-section volumes against analytic formulas */
function sliceBlock() {
  for (const n of [3, 4, 5]) {
    const P = N.polytope("unitcube", n);
    const L = N.faceLattice(P.verts, P.edges);
    const normal = Array(n).fill(1 / Math.sqrt(n));
    for (const t of [0.5, 1, 1.5, 2.2]) {
      if (t >= n) continue;
      const got = N.sliceVolume(P, L, normal, t / Math.sqrt(n));
      const want = N.cubeSliceAnalytic(n, t);
      check(`unit ${n}-cube slice sum(x)=${t}`, close(got, want, 1e-9), `got ${got} want ${want}`);
      if (n === 4 && t === 1.5) planted(`4-cube slice ${t} at 1.01x analytic`, close(got, want * 1.01, 1e-9));
    }
    const fast = N.sliceVolumeFast(P, L, normal, 1.3 / Math.sqrt(n)).volume, want = N.cubeSliceAnalytic(n, 1.3);
    check(`unit ${n}-cube facet-pyramid volume agrees`, close(fast, want, 1e-9), `got ${fast} want ${want}`);
    const axis = Array(n).fill(0); axis[0] = 1;
    check(`unit ${n}-cube axis slice is a unit ${n - 1}-cube`, close(N.sliceVolume(P, L, axis, 0.37), 1, 1e-9));
  }
  for (const n of [3, 4, 5]) {
    const P = N.polytope("cornersimplex", n);
    const L = N.faceLattice(P.verts, P.edges);
    const axis = Array(n).fill(0); axis[0] = 1;
    for (const t of [0.2, 0.5, 0.8]) {
      const got = N.sliceVolume(P, L, axis, t), want = N.simplexSliceAnalytic(n, t);
      check(`corner ${n}-simplex slice x1=${t}`, close(got, want, 1e-9), `got ${got} want ${want}`);
    }
  }
}

/* 3. rotations are orthogonal and keep norms */
function rotationBlock() {
  let worstO = 0, worstN = 0;
  const rng = N.rng(20261030);
  for (let n = 2; n <= 7; n++) {
    const angles = N.planes(n).map(() => (rng() - 0.5) * 7);
    const R = N.rotationFromAngles(n, angles);
    worstO = Math.max(worstO, N.orthogonalityError(R));
    for (let k = 0; k < 20; k++) {
      const v = Array.from({ length: n }, () => rng() * 4 - 2);
      worstN = Math.max(worstN, Math.abs(N.norm(N.matVec(R, v)) - N.norm(v)));
    }
  }
  check("planes count n(n-1)/2", [2, 3, 4, 5, 6].every((n) => N.planes(n).length === (n * (n - 1)) / 2));
  check("rotations orthogonal to 1e-12", worstO < 1e-12, `max |RtR-I| ${worstO}`);
  check("rotations keep norms to 1e-12", worstN < 1e-12, `max norm change ${worstN}`);
  const S = N.rotationFromAngles(4, [0.3, 0.1, 0, 0, 0.7, 0]).map((r) => r.map((x) => x * (1 + 1e-9)));
  planted("a matrix scaled by 1+1e-9 passes as a rotation", N.orthogonalityError(S) < 1e-12);
}

/* 4. Coxeter number from the Coxeter element and from the Petrie projection's symmetry */
function petrieBlock() {
  const cases = [["5-cell", N.polytope("simplex", 4), "A4", 5], ["tesseract", N.polytope("cube", 4), "B4", 8],
    ["16-cell", N.polytope("cross", 4), "B4", 8], ["24-cell", N.polytope("24-cell"), "F4", 12],
    ["120-cell", N.polytope("120-cell"), "H4", 30], ["600-cell", N.polytope("600-cell"), "H4", 30]];
  const got = {};
  for (const [name, P, group, h] of cases) {
    const pet = N.petrie(P, group);
    got[name] = pet;
    check(`Coxeter element order ${group}`, pet.h === h, `got ${pet.h} want ${h}`);
    check(`Petrie projection of ${name} has ${h}-fold symmetry`, pet.symmetry === h, `got ${pet.symmetry}`);
  }
  planted("tesseract h = 4 (the figure in the brief)", got.tesseract.h === 4 || got.tesseract.symmetry === 4);
  const dyn = { A4: [3, 3, 3], B4: [3, 3, 4], F4: [3, 4, 3], H4: [5, 3, 3] };
  for (const [g, m] of Object.entries(dyn)) {
    const d = N.dynkin(N.simpleRoots(N.rootSystem(g)));
    const labels = N.chainLabels(d);
    check(`Coxeter-Dynkin ${g} is a chain ${m}`, eq(labels, m) || eq(labels, [...m].reverse()), `got ${labels}`);
  }
  const h4 = N.simpleRoots(N.rootSystem("H4"));
  check("H4 orbit of a simple root has 120 points", N.orbit(h4[0], h4).length === 120);
  const w120 = N.wythoff("H4", [1, 0, 0, 0]), w600 = N.wythoff("H4", [0, 0, 0, 1]);
  check("Wythoff o-5-o-3-o-3-o ringed at the 5 end gives 600 points (120-cell)", w120.length === 600, w120.length);
  check("Wythoff ringed at the far end gives 120 points (600-cell)", w600.length === 120, w600.length);
  check("Wythoff 600-cell equals the coordinate 600-cell", N.sameDirections(w600, N.polytope("600-cell").verts));
  const c120 = N.polytope("120-cell-coords");
  check("Wythoff 120-cell is congruent to the published 120-cell coordinates", N.distanceSpectrum(w120) === N.distanceSpectrum(c120.verts));
  check("published 120-cell coordinates: f-vector 600,1200,720,120", eq(N.faceLattice(c120.verts, c120.edges).fvector, [600, 1200, 720, 120]));
  planted("Wythoff 120-cell equals the 24-cell", N.sameDirections(w120, N.polytope("24-cell").verts));
}

/* 5. stereographic projection preserves angles; orthographic does not */
function conformalBlock() {
  const rng = N.rng(7);
  let worst = 0, orthoWorst = 0;
  for (let k = 0; k < 50; k++) {
    const p = N.normalize(Array.from({ length: 4 }, () => rng() * 2 - 1));
    if (p[3] > 0.9) continue;
    const [u, v] = N.tangentPair(p, rng);
    worst = Math.max(worst, Math.abs(N.imageAngle(N.stereographic, p, u, v) - N.angle(u, v)));
    orthoWorst = Math.max(orthoWorst, Math.abs(N.imageAngle((x) => N.orthographic(x, 3), p, u, v) - N.angle(u, v)));
  }
  check("stereographic S3 to R3 keeps angles to 1e-6", worst < 1e-6, `max angle error ${worst}`);
  planted("orthographic S3 to R3 is conformal", orthoWorst < 1e-6, `max angle error ${orthoWorst}`);
}

/* 6. every view reports its lens and a finite distortion number */
function lensBlock() {
  const P = N.polytope("cube", 4);
  for (const name of ["orthographic", "perspective", "stereographic"]) {
    const v = N.view(P, name, 3);
    const ok = v.lens && v.lens.keeps.length > 0 && v.lens.loses.length > 0 && Number.isFinite(v.distortion.value);
    check(`view ${name} reports lens and distortion`, ok, JSON.stringify(v.lens && v.distortion));
  }
  const id = N.view(P, "orthographic", 4);
  check("orthographic 4D to 4D has zero distortion", Math.abs(id.distortion.value) < 1e-12, id.distortion.value);
  const L = N.faceLattice(P.verts, P.edges), sch = N.schlegel(P, L, 0);
  const B = N.complementBasis(L.facets[0].normal), ctr = N.mean(L.facets[0].ids.map((i) => P.verts[i]));
  check("Schlegel keeps the frame cell's vertices in place", L.facets[0].ids.every((i) => N.dist(sch.pts[i], B.map((b) => N.dot(b, N.sub(P.verts[i], ctr)))) < 1e-12));
  planted("orthographic 4D to 3D has zero distortion", Math.abs(N.view(P, "orthographic", 3).distortion.value) < 1e-12);
}

/* 7. fields: Clifford torus, Hopf fibres, SDF slice, quaternion Julia */
function fieldBlock() {
  const T = N.cliffordTorus(24, 24);
  check("Clifford torus lies on |z1| = |z2| = 1/sqrt2", T.every((p) => close(p[0] ** 2 + p[1] ** 2, 0.5, 1e-12) && close(p[2] ** 2 + p[3] ** 2, 0.5, 1e-12)));
  const base = [0.3, -0.5, Math.sqrt(1 - 0.34)];
  const fib = N.hopfFiber(base, 64);
  const back = fib.map(N.hopfMap);
  check("Hopf fibre maps back to its base point", back.every((b) => N.norm(N.sub(b, base)) < 1e-12));
  check("Hopf fibre is a great circle", fib.every((p) => close(N.norm(p), 1, 1e-12)) && N.affineRank(fib.concat([[0, 0, 0, 0]])) === 2);
  const r = N.sdfSliceRadius(N.sdf.hypersphere(1), 4, 0.6);
  check("4-ball sliced at w = 0.6 is a ball of radius 0.8", close(r, 0.8, 1e-6), r);
  planted("4-ball slice radius 0.6", close(r, 0.6, 1e-6));
  check("quaternion Julia c = 0: the origin is inside", N.juliaInside([0, 0, 0, 0], [0, 0, 0, 0], 64));
  check("quaternion Julia c = 0: [1.2,0,0,0] escapes", !N.juliaInside([1.2, 0, 0, 0], [0, 0, 0, 0], 64));
  const hit = N.marchRay(N.sdf.hypersphere(1), [0, 0, -3], [0, 0, 1], N.sliceFrame(4, 0.6));
  check("ray-march hits the 0.8 slice at distance 2.2", hit && close(hit.t, 2.2, 1e-4), hit && hit.t);
}

const blocks = { fvectorBlock, sliceBlock, rotationBlock, petrieBlock, conformalBlock, lensBlock, fieldBlock };
for (const [name, f] of Object.entries(blocks)) {
  const t0 = Date.now();
  try { f(); } catch (e) { check(name + " ran", false, e.stack); }
  out.rows.push({ name: name + " time", ok: true, detail: `${Date.now() - t0} ms` });
}
const summary = { pass: out.pass, fail: out.fail, planted_rejected: out.planted_rejected, planted_accepted: out.planted_accepted };
console.log(JSON.stringify(summary));
if (process.argv.includes("--json")) require("fs").writeFileSync(process.argv[process.argv.indexOf("--json") + 1], JSON.stringify({ date: new Date().toISOString(), summary, rows: out.rows }, null, 1));
process.exit(out.fail || out.planted_accepted ? 1 : 0);
