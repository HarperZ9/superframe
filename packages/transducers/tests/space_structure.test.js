"use strict";
const { test, assert, T, needs, near, refuses, whiteGrid, F } = require("./h.js");
const cp = require("node:child_process");

const square = new Uint8Array(12 * 12).fill(1);
const M = T.modes(square, 12, 12);
test("a square's Neumann eigenvalues are the closed form", () => {
  const want = []; for (let p = 0; p < 12; p++) for (let q = 0; q < 12; q++) want.push(T.neumannSquare(p, q, 12));
  want.sort((a, b) => a - b);
  want.forEach((v, i) => near(M.lam[i], v, 1e-10, "mode " + i));
});
test("modes are orthonormal and full rank round trips", () => {
  let s = 0; for (let i = 0; i < M.n; i++) s += M.vec[i * M.n + 5] * M.vec[i * M.n + 5];
  near(s, 1, 1e-10);
  const f = whiteGrid(12, 4), o = T.run(T.modal(M, M.n), f);
  assert.equal(o.row.measured, "embedding");
  assert.equal(T.run(T.modal(M, 30), whiteGrid(12, 6)).row.measured, "homomorphism", "white noise loses in a truncated basis");
  assert.equal(T.run(T.modal(M, 30), T.grid("smooth", 12, 12, T.nodeToGrid(M, Float64Array.from({ length: 144 }, (_, i) => M.vec[i * 144 + 3])))).row.measured, "embedding", "a low mode does not");
});
test("one basis: heat, fog and sound against direct solves", () => {
  const f = whiteGrid(12, 5), v = T.gridToNode(M, f.values), N = M.n;
  const fog = T.run(T.modalFilter(M, "fog", T.FILTERS.fog(0.5)), f), d = T.denseSolve(M.A, N, v.map((x) => 0.5 * x), 0.5);
  d.forEach((x, i) => near(fog.values[i], x, 1e-8, "fog"));
  const heat = T.modalFilter(M, "heat", T.FILTERS.heat(0.5)).forward(f).values, mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  near(mean(heat), mean(f.values), 1e-10, "Neumann heat keeps total");
  const k2 = 0.3, sound = T.modalFilter(M, "sound", T.FILTERS.sound(k2, 1e-9)).forward(f).values, ds = T.denseSolve(M.A, N, v, -k2);
  ds.forEach((x, i) => near(sound[i], x, 1e-5, "sound"));
});
test("a truncated basis misses short-time heat first, as the study found", () => {
  const f = T.grid("pulse", 12, 12, (() => { const a = new Float64Array(144); a[66] = 1; return a; })());
  const err = (K, t) => { const a = T.modalFilter(M, "h", T.FILTERS.heat(t), K).forward(f).values, b = T.modalFilter(M, "h", T.FILTERS.heat(t)).forward(f).values; let s = 0, n = 0; a.forEach((x, i) => { s += (x - b[i]) ** 2; n += b[i] ** 2; }); return Math.sqrt(s / n); };
  assert.ok(err(30, 0.1) > 10 * err(30, 4), `${err(30, 0.1)} vs ${err(30, 4)}`);
});
test("Varadhan: distance from the heat kernel is close to true distance inside d_max", () => {
  const N = 20, m = T.modes(new Uint8Array(N * N).fill(1), N, N), c = 10 * N + 10, f = T.grid("x", N, N, new Float64Array(N * N)), t = 4, o = T.run(T.varadhan(m, c, t), f), dmax = T.dMax(m, m.n, t);
  assert.ok(dmax > 8, "range " + dmax);
  let e = 0, cnt = 0;
  for (let y = 7; y < 14; y++) for (let x = 7; x < 14; x++) { const d = Math.hypot(y - 10, x - 10); if (d > 2) { e += Math.abs(o.values[y * N + x] - d) / d; cnt++; } }
  assert.ok(e / cnt < 0.3, "mean relative error " + e / cnt);
});
test("the study's Python basis and this one agree on the L room", { skip: (() => { if (!T.hasData("schott")) return "field package not at the root"; try { cp.execFileSync("python", ["-c", "import scipy"]); return false; } catch { return "no scipy for the reference"; } })() }, () => {
  const n = 16, P = `import sys,json\nsys.path.insert(0,sys.argv[1])\nimport modal_basis as M\nL,P,h=M.room(${n})\nlam,phi,_=M.eigbasis(L,12)\nprint(json.dumps({'lam':list(map(float,lam)),'h':float(h),'n':L.shape[0]}))`;
  const r = JSON.parse(cp.execFileSync("python", ["-B", "-c", P, T.rootPath("field/py")], { encoding: "utf8" })), mask = T.lShape(n);
  const m = T.modes(mask, n, n, r.h);
  assert.equal(m.n, r.n, "same node count");
  r.lam.forEach((v, i) => near(m.lam[i], v, 1e-6 + 1e-6 * v, "lambda " + i));
});
test("spherical-harmonic irradiance through the study's code: order 2 holds on a smooth sky", { skip: T.hasData("kernels") ? false : "field package not at the root" }, () => {
  const a = T.shIrradiance(2), sky = Float64Array.from({ length: 4096 }, (_, i) => 1 + 0.5 * a.dirs[3 * i + 2]), o = T.run(a.kernel, T.seq("sky", sky));
  const v = o.values, zs = a.normals;
  for (let i = 0; i < 512; i += 37) near(v[i], Math.PI * (1 + (2 / 3) * 0.5 * zs[3 * i + 2]), 0.02, "closed form for a linear sky");
});
test("SDF: exact against brute force, the eikonal holds, the sign returns the mask bit for bit", () => {
  const N = 48, v = new Float64Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) v[y * N + x] = (x - 24) ** 2 + (y - 24) ** 2 < 100 ? 1 : 0;
  const o = T.run(T.sdf(), T.grid("disc", N, N, v));
  assert.equal(o.row.measured, "embedding");
  const brute = (y, x) => { let b = Infinity; for (let a = 0; a < N; a++) for (let c = 0; c < N; c++) if (v[a * N + c]) b = Math.min(b, Math.hypot(a - y, c - x)); return b; };
  for (const [y, x] of [[0, 0], [24, 40], [5, 30], [47, 13]]) near(o.values[y * N + x], brute(y, x) - 0.5, 1e-9);
  near(o.values[0], Math.hypot(24, 24) - 10, 1, "analytic circle");
});
const latticeErr = (kind, n, N = 128, kmax = 6) => {
  let e = 0;
  for (const seed of [1, 2, 3]) { const fi = T.grid("band", N, N, T.bandNoise(N, kmax, seed)), k = T.lattice(kind, n, { seed, kmax, tol: 10 }), y = T.run(k, fi), back = k.inverse(y); let s = 0; back.forEach((b, i) => { s += (b - fi.values[i]) ** 2; }); e += s / back.length; }
  return e / 3;
};
test("lattices: at the square's critical density the square aliases and the hexagon does not; jitter removes the aliasing", () => {
  const err = { sq144: latticeErr("square", 144), hex135: latticeErr("hex", 135), jit144: latticeErr("jitter", 144), white144: latticeErr("white", 144), hex121: latticeErr("hex", 121), jit121: latticeErr("jitter", 121) };
  require("node:fs").writeFileSync(require("node:path").join(process.env.TRANSDUCERS_OUT || require("node:os").tmpdir(), "lattice-errors.json"), JSON.stringify(err, null, 1));
  assert.ok(err.hex135 * 100 < err.sq144, "hexagon at fewer points beats the aliased square: " + JSON.stringify(err));
  assert.ok(err.jit144 * 100 < err.sq144, "irregular sampling removes the alias");
  assert.ok(err.jit121 * 10 < err.hex121, "below the hexagon's critical density jitter still rebuilds");
  near(1 - Math.sqrt(3) / 2, 0.134, 0.001, "Petersen-Middleton saving");
});

const K4 = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const C5 = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]];
test("graph invariants: complete graph, cycle, two components", () => {
  const a = T.graphInvariants(4, K4), b = T.graphInvariants(5, C5), c = T.graphInvariants(6, [[0, 1], [1, 2], [2, 0], [3, 4]]);
  assert.deepEqual([a.E, a.components, a.cycleRank, a.triangles, a.clustering], [6, 1, 3, 4, 1]);
  assert.deepEqual([b.cycleRank, b.triangles], [1, 0]);
  assert.deepEqual([c.components, c.cycleRank], [3, 1]);
  const lam = T.graphLaplacianSpectrum(4, K4); near(lam[0], 0, 1e-10); near(lam[3], 4, 1e-10); near(lam[1], 4, 1e-10);
});
test("mesh invariants: a tetrahedron's chi is 2, a torus 0, a square patch has a boundary", () => {
  assert.equal(T.meshInvariants(4, [[0, 1, 2], [0, 3, 1], [1, 3, 2], [0, 2, 3]]).euler, 2);
  const n = 5, faces = [], id = (i, j) => ((i + n) % n) * n + ((j + n) % n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { faces.push([id(i, j), id(i + 1, j), id(i + 1, j + 1)]); faces.push([id(i, j), id(i + 1, j + 1), id(i, j + 1)]); }
  assert.equal(T.meshInvariants(n * n, faces).euler, 0);
  const p = T.meshInvariants(4, [[0, 1, 2], [0, 2, 3]]); assert.equal(p.boundaryEdges, 4); assert.equal(p.euler, 1);
});
test("invariant kernels pass relabelling; a planted label-dependent record is refused", () => {
  const g2 = T.graphField("k4", 4, K4), o = T.run(T.invariantKernel((d) => T.graphInvariants(d.nodes, d.edges)), g2);
  assert.equal(o.values[0], 4);
  const m = T.meshField("tet", 4, [[0, 1, 2], [0, 3, 1], [1, 3, 2], [0, 2, 3]]);
  assert.equal(T.run(T.invariantKernel((d) => T.meshInvariants(d.nodes, d.faces), { domain: "mesh" }), m).values[3], 2);
  const lie = T.invariantKernel((d) => ({ first: d.edges[0][0] * 7 + d.edges[0][1] }), { id: "planted.labelled" });
  refuses(() => T.run(lie, T.graphField("c5", 5, C5)), "ClaimError");
});
test("persistence: two bumps give one finite H0 pair at the textbook values", () => {
  const n = 40, v = new Float64Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) v[y * n + x] = Math.min((x - 10) ** 2 + (y - 20) ** 2 + 1, (x - 30) ** 2 + (y - 20) ** 2 + 5);
  const r = T.persistence(v, n, n), big = r.h0.filter(([b, d]) => d - b > 1);
  assert.equal(big.length, 1, JSON.stringify(big));
  assert.equal(big[0][0], 5, "born at the higher minimum");
  near(big[0][1], 103, 4, "dies where they meet near x = 20");
  assert.equal(r.essential, 1);
  assert.equal(r.h1.filter(([b, d]) => d - b > 1).length, 0, "no loops");
});
test("persistence: a ring has one loop, born at the rim's height and dying at its floor", () => {
  const n = 40, v = new Float64Array(n * n).fill(1);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const d = Math.hypot(x - 20, y - 20); if (d > 8 && d < 14) v[y * n + x] = 0; else if (d <= 8) v[y * n + x] = 0.7; }
  const r = T.persistence(v, n, n), big = r.h1.filter(([b, d]) => d - b > 0.1);
  assert.equal(big.length, 1, JSON.stringify(r.h1.slice(0, 5)));
  near(big[0][0], 0, 1e-9); near(big[0][1], 0.7, 1e-9);
});
test("persistence is stable: a small perturbation moves every big pair by at most its size; noise makes no big pair", () => {
  const n = 32, r = T.rng(3, "p"), base = T.bandNoise(n, 4, 2), eps = 0.01, pert = base.map((x) => x + eps * (2 * r() - 1));
  const big = (P) => P.filter(([a, b]) => b - a > 0.3).sort((a, b) => a[0] - b[0]), A = big(T.persistence(base, n, n).h0), B = big(T.persistence(pert, n, n).h0);
  assert.equal(A.length, B.length);
  A.forEach((x, i) => { near(x[0], B[i][0], 2 * eps); near(x[1], B[i][1], 2 * eps); });
  const sh = Float64Array.from(T.shuffle(base, 4)), bigS = big(T.persistence(sh, n, n).h0);
  assert.ok(bigS.length > A.length, "a shuffled field has many more pairs, all of it noise");
});
test("contact map: an alpha helix contacts i + 3 and i + 4, a rigid motion changes nothing", () => {
  const n = 20, h = T.helix(n), o = T.run(T.contactMap(), T.seq("helix", h, "1", { components: 3 })), m = o.values;
  assert.equal(m[5 * n + 9], 1); assert.equal(m[5 * n + 8], 1); assert.equal(m[5 * n + 15], 0);
  near(Math.hypot(h[0] - h[12], h[1] - h[13], h[2] - h[14]), 6.2, 0.2, "i to i + 4 is about 6.2 A");
  assert.equal(o.prov.status, "from_memory");
  const lie = T.kernel(Object.assign({}, T.contactMap(), { id: "planted.absolute", forward: (f) => { const c = T.contactMap().forward(f); c.values = c.values.map((v, i) => (f.values[0] > 0 ? v : 1 - v)); return c; }, keeps: { name: "rigid", check: (s, y) => { const a = T.rotateZ(s.values, 2.5); return { ok: (a[0] > 0) === (s.values[0] > 0), detail: "sign moved" }; } } }));
  refuses(() => T.run(lie, T.seq("helix", h, "1", { components: 3 })), "ClaimError");
});
test("Milo z: planted feed-forward loops stand out; a random graph's do not; rewiring keeps degrees", () => {
  const n = 60, p = 0.04, er = T.randomDigraph(n, p, 1), e = er.slice(), S = new Set(er.map(([a, b]) => a + ">" + b)), r = T.rng(2, "ffl");
  const add = (a, b) => { const k = a + ">" + b; if (a !== b && !S.has(k)) { S.add(k); e.push([a, b]); } };
  for (let i = 0; i < 40; i++) { const a = Math.floor(r() * n), b = Math.floor(r() * n), c = Math.floor(r() * n); add(a, b); add(b, c); add(a, c); }
  const z = T.miloZ(n, e, { samples: 60 }), ctrl = T.miloZ(n, er, { samples: 60 });
  assert.ok(z.ffl.z > 3, "planted " + JSON.stringify(z.ffl));
  assert.ok(Math.abs(ctrl.ffl.z) < 3, "control " + JSON.stringify(ctrl.ffl));
  near(ctrl.ffl.mean / (n * (n - 1) * (n - 2) * p ** 3), 1, 0.35, "random expected count");
  assert.ok(T.run(T.motifKernel({ samples: 20 }), T.graphField("net", n, e)).values[0] > 0);
});
test("the hollow: at an antinode a void raises a Neumann eigenvalue, at a node it lowers it, and the shift grows with its area", () => {
  const H = 16, W = 24, mask = () => new Uint8Array(H * W).fill(1), solid = T.modes(mask(), H, W), k = 4;
  near(solid.lam[k], T.neumannSquare(2, 0, W) + 0, 1e-9, "mode (2,0) of the bar");
  const punch = (cx, cy, r) => { const m = mask(); for (let y = cy - r; y < cy + r; y++) for (let x = cx - r; x < cx + r; x++) m[y * W + x] = 0; return m; };
  const shift = (cx, cy, r) => T.modes(punch(cx, cy, r), H, W).lam[k] - solid.lam[k];
  assert.ok(shift(12, 8, 1) > 0, "antinode raises: " + shift(12, 8, 1));
  assert.ok(shift(6, 8, 1) < 0, "node lowers: " + shift(6, 8, 1));
  assert.ok(Math.abs(shift(12, 8, 2)) > 2.5 * Math.abs(shift(12, 8, 1)), "area scaling");
  const o = T.run(T.hollow(solid, 6), T.grid("void", H, W, Float64Array.from(punch(12, 8, 2))));
  near(o.values[0], 16 / 384, 1e-12, "void fraction");
  near(o.values[1], 2, 1e-9, "largest empty radius");
  near(o.values[2 + k], shift(12, 8, 2), 1e-9, "the record holds the same shift");
});
test("a modal basis on a mesh would need a sphere or mesh domain: FFT refuses, loudly", () => {
  refuses(() => F.fft(T.graphField("g", 4, K4)), "FieldError");
});
