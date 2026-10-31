/* transducers/structure: invariants of graphs and meshes, persistent homology of a field, contact maps, motif counts
   against rewired networks, and the hollow: empty space as a measured quantity. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();

  const find = (p, x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
  T.graphField = (name, n, edges, values) => F().make({ name, domain: { kind: "graph", nodes: n, edges }, values: values || new Float64Array(n), unit: "1", sigma: null, prov: { status: "defined", method: "synthetic" }, rep: { kind: "digital", bits: 64, encoding: "float64" } });
  T.meshField = (name, n, faces, values) => F().make({ name, domain: { kind: "mesh", nodes: n, faces }, values: values || new Float64Array(n), unit: "1", sigma: null, prov: { status: "defined", method: "synthetic" }, rep: { kind: "digital", bits: 64, encoding: "float64" } });

  /* Edges of a mesh's faces, deduplicated; the boundary is every edge used once. */
  T.meshEdges = (faces) => {
    const c = new Map();
    for (const f of faces) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], k = a < b ? a + "," + b : b + "," + a; c.set(k, (c.get(k) || 0) + 1); }
    return c;
  };
  T.graphInvariants = (n, edges) => {
    const p = Array.from({ length: n }, (_, i) => i), adj = Array.from({ length: n }, () => new Set());
    for (const [a, b] of edges) { p[find(p, a)] = find(p, b); adj[a].add(b); adj[b].add(a); }
    let comps = 0, tri = 0, wedge = 0;
    for (let i = 0; i < n; i++) if (find(p, i) === i) comps++;
    for (const [a, b] of edges) for (const c of adj[a]) if (c !== b && adj[b].has(c)) tri++;
    for (const s of adj) wedge += (s.size * (s.size - 1)) / 2;
    const deg = adj.map((s) => s.size).sort((a, b) => a - b);
    return { V: n, E: edges.length, components: comps, cycleRank: edges.length - n + comps, triangles: tri / 3, clustering: wedge ? tri / wedge : 0, degMax: deg[n - 1] };
  };
  T.meshInvariants = (n, faces) => {
    const E = T.meshEdges(faces); let bd = 0;
    for (const c of E.values()) if (c === 1) bd++;
    return { V: n, E: E.size, F: faces.length, euler: n - E.size + faces.length, boundaryEdges: bd };
  };
  const permuted = (n, seed) => T.shuffle(Array.from({ length: n }, (_, i) => i), seed, "relabel");
  /* calc takes a domain and returns a flat record. The check relabels the nodes and demands the same record. */
  T.invariantKernel = (calc, o = {}) => T.kernel({
    id: o.id || "structure.invariants", group: "structure", axes: ["space"], claims: "homomorphism", from: { domain: o.domain || "graph" }, to: { domain: "sequence" },
    forward: (f) => { const r = calc(f.domain), keys = Object.keys(r), v = Float64Array.from(keys, (k) => r[k]); return { values: v, domain: { kind: "sequence", shape: [v.length], keys }, components: 1, sigma: 0 }; },
    keeps: { name: "unchanged by relabelling the nodes", check: (s, y) => {
      const n = s.domain.nodes, P = permuted(n, 5), d = s.domain, q = d.kind === "graph" ? { kind: "graph", nodes: n, edges: d.edges.map(([a, b]) => [P[a], P[b]]) } : { kind: "mesh", nodes: n, faces: d.faces.map((fc) => fc.map((x) => P[x])) };
      const a = calc(q), keys = Object.keys(a), same = keys.every((k, i) => Math.abs(a[k] - y.values[i]) < 1e-12);
      return { ok: same, detail: same ? "same record" : "record changed under relabelling" };
    } },
    loss: (s, y) => ({ bits: Math.max(0, (s.domain.edges || s.domain.faces).length * 2 * Math.log2(Math.max(2, s.domain.nodes)) - y.values.length * 64), method: "structure description against 64-bit record" }),
  });
  T.graphLaplacianSpectrum = (n, edges) => {
    const A = new Float64Array(n * n);
    for (const [a, b] of edges) { A[a * n + a]++; A[b * n + b]++; A[a * n + b]--; A[b * n + a]--; }
    return T.jacobiEig(A, n).lam;
  };

  /* Sublevel persistence on a grid. H0 with 8-neighbour merging and the elder rule; H1 by duality: the H0 of the negated
     field with 4-neighbour merging, with the outside as one always-present component, so loops are born at the rim and
     die at the hole's floor. Pairs below minPersist are dropped. */
  const persist0 = (v, h, w, conn, outside) => {
    const n = h * w, ord = Array.from({ length: n }, (_, i) => i).sort((a, b) => v[a] - v[b] || a - b), p = new Int32Array(n + 1).fill(-1), birth = new Float64Array(n + 1).fill(Infinity), pairs = [];
    const OUT = n; if (outside) { p[OUT] = OUT; birth[OUT] = -Infinity; }
    const nbr = conn === 8 ? [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] : [[-1, 0], [0, -1], [0, 1], [1, 0]];
    const merge = (a, b, at) => {
      a = find(p, a); b = find(p, b); if (a === b) return;
      if (birth[a] > birth[b]) { const t = a; a = b; b = t; }
      if (at > birth[b]) pairs.push([birth[b], at]);
      p[b] = a;
    };
    for (const i of ord) {
      p[i] = i; birth[i] = v[i];
      const y = Math.floor(i / w), x = i % w;
      for (const [dy, dx] of nbr) { const Y = y + dy, X = x + dx; if (Y < 0 || Y >= h || X < 0 || X >= w) { if (outside) merge(i, OUT, v[i]); continue; } const j = Y * w + X; if (p[j] >= 0) merge(i, j, v[i]); }
    }
    let root = null;
    for (let i = 0; i < n; i++) if (p[i] === i) { root = i; break; }
    return { pairs, essential: outside ? null : birth[root] };
  };
  T.persistence = (v, h, w) => {
    const A = persist0(v, h, w, 8, false), B = persist0(Float64Array.from(v, (x) => -x), h, w, 4, true);
    return { h0: A.pairs, essential: A.essential, h1: B.pairs.map(([b, d]) => [-d, -b]) };
  };
  T.persistKernel = (o = {}) => T.kernel({
    id: "structure.persistence", group: "structure", axes: ["space"], claims: "homomorphism", from: { domain: "grid" }, to: { domain: "sequence" },
    forward: (f) => {
      const { h, w } = T.gridOf(f), r = T.persistence(f.values, h, w), minP = o.minPersist || 0, keep = (P) => P.filter(([b, d]) => d - b > minP);
      const a = keep(r.h0), c = keep(r.h1), vals = new Float64Array(3 * (a.length + c.length));
      a.forEach((x, i) => { vals[3 * i] = 0; vals[3 * i + 1] = x[0]; vals[3 * i + 2] = x[1]; });
      c.forEach((x, i) => { const k = a.length + i; vals[3 * k] = 1; vals[3 * k + 1] = x[0]; vals[3 * k + 2] = x[1]; });
      return { values: vals, domain: { kind: "sequence", shape: [a.length + c.length], essential: r.essential }, components: 3, sigma: null };
    },
    keeps: { name: "every pair dies after it is born", check: (s, y) => { for (let i = 0; i < y.values.length; i += 3) if (y.values[i + 2] < y.values[i + 1]) return { ok: false, detail: "negative persistence" }; return { ok: true, detail: y.values.length / 3 + " pairs" }; } },
    loss: (s, y) => T.budgetLoss(s, y, o.grain || 1 / 256, o.grain || 1 / 256),
  });

  /* Contact map: 3D chain to an N x N map at a cutoff. A rigid motion leaves it unchanged. */
  T.contactOf = (xyz, cutoff) => {
    const n = xyz.length / 3, o = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) o[i * n + j] = Math.hypot(xyz[3 * i] - xyz[3 * j], xyz[3 * i + 1] - xyz[3 * j + 1], xyz[3 * i + 2] - xyz[3 * j + 2]) < cutoff && i !== j ? 1 : 0;
    return o;
  };
  /* An ideal helix, 3.6 residues a turn, 1.5 rise, 2.3 radius (from memory, in angstrom, textbook alpha helix). */
  T.helix = (n, turn = 3.6, rise = 1.5, radius = 2.3) => { const v = new Float64Array(3 * n); for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / turn; v[3 * i] = radius * Math.cos(a); v[3 * i + 1] = radius * Math.sin(a); v[3 * i + 2] = rise * i; } return v; };
  T.rotateZ = (v, th, dz = 0) => { const o = new Float64Array(v.length), c = Math.cos(th), s = Math.sin(th); for (let i = 0; i < v.length; i += 3) { o[i] = c * v[i] - s * v[i + 1]; o[i + 1] = s * v[i] + c * v[i + 1]; o[i + 2] = v[i + 2] + dz; } return o; };
  T.contactMap = (cutoff = 6.5) => T.kernel({
    id: `structure.contact ${cutoff}`, group: "structure", axes: ["space"], claims: "homomorphism", physics: [{ status: "from_memory", source: "helix geometry 3.6 / 1.5 / 2.3 A, textbook, not read" }], from: { domain: "sequence" }, to: { domain: "grid" },
    forward: (f) => { const n = f.values.length / 3; return { values: T.contactOf(f.values, cutoff), domain: { kind: "grid", shape: [n, n] }, components: 1, unit: "1", rep: { kind: "digital", bits: 1, grain: 1 }, sigma: 0 }; },
    keeps: { name: "unchanged by a rigid motion", check: (s, y) => { const a = T.contactOf(T.rotateZ(s.values, 0.7, 3), cutoff), same = a.every((x, i) => x === y.values[i]); return { ok: same, detail: same ? "same map" : "map moved" }; } },
    loss: (s, y) => T.budgetLoss(s, y, 0.1, 1),
  });

  /* Directed triads: feed-forward loops and 3-cycles, against rewired networks with the same in and out degrees. */
  T.motifCounts = (n, edges) => {
    const out = Array.from({ length: n }, () => new Set());
    for (const [a, b] of edges) out[a].add(b);
    let ffl = 0, cycle = 0;
    for (const [a, b] of edges) for (const c of out[b]) { if (c === a) continue; if (out[a].has(c)) ffl++; if (out[c].has(a)) cycle++; }
    return { ffl, cycle: cycle / 3 };
  };
  T.rewire = (n, edges, swaps, seed) => {
    const E = edges.map((e) => e.slice()), S = new Set(E.map(([a, b]) => a + ">" + b)), r = T.rng(seed, "rewire");
    for (let s = 0; s < swaps; s++) {
      const i = Math.floor(r() * E.length), j = Math.floor(r() * E.length), [a, b] = E[i], [c, d] = E[j];
      if (i === j || a === d || c === b || S.has(a + ">" + d) || S.has(c + ">" + b)) continue;
      S.delete(a + ">" + b); S.delete(c + ">" + d); S.add(a + ">" + d); S.add(c + ">" + b);
      E[i] = [a, d]; E[j] = [c, b];
    }
    return E;
  };
  T.miloZ = (n, edges, o = {}) => {
    const real = T.motifCounts(n, edges), samples = o.samples || 100, swaps = o.swaps || edges.length * 10, keys = Object.keys(real), sum = {}, sq = {};
    for (const k of keys) { sum[k] = 0; sq[k] = 0; }
    for (let s = 0; s < samples; s++) { const c = T.motifCounts(n, T.rewire(n, edges, swaps, (o.seed || 1) + "/" + s)); for (const k of keys) { sum[k] += c[k]; sq[k] += c[k] * c[k]; } }
    const out = {};
    for (const k of keys) { const m = sum[k] / samples, sd = Math.sqrt(Math.max(1e-12, sq[k] / samples - m * m)); out[k] = { count: real[k], mean: m, z: (real[k] - m) / sd }; }
    return out;
  };
  T.randomDigraph = (n, p, seed) => { const r = T.rng(seed, "er"), e = []; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b && r() < p) e.push([a, b]); return e; };
  T.motifKernel = (o = {}) => T.kernel({
    id: "structure.milo-z", group: "structure", axes: ["space", "noise"], claims: "homomorphism", from: { domain: "graph" }, to: { domain: "sequence" },
    forward: (f) => { const z = T.miloZ(f.domain.nodes, f.domain.edges, o), keys = Object.keys(z); return { values: Float64Array.from(keys, (k) => z[k].z), domain: { kind: "sequence", shape: [keys.length], keys }, sigma: null, components: 1 }; },
    keeps: { name: "rewiring keeps every in and out degree", check: (s) => {
      const d = (E) => { const x = {}; for (const [a, b] of E) { x["o" + a] = (x["o" + a] || 0) + 1; x["i" + b] = (x["i" + b] || 0) + 1; } return JSON.stringify(Object.entries(x).sort()); };
      const same = d(s.domain.edges) === d(T.rewire(s.domain.nodes, s.domain.edges, 200, 9));
      return { ok: same, detail: same ? "degrees kept" : "degrees changed" };
    } },
    loss: (s, y) => ({ bits: Math.max(0, s.domain.edges.length * 2 * Math.log2(s.domain.nodes) - y.values.length * 64), method: "edge list description against the z record" }),
  });

  /* The hollow: a structure with a void against the solid it came from. The record holds the void fraction, the
     largest empty radius from the SDF and the first K eigenvalue shifts, per square metre. */
  T.hollow = (solidModes, K = 8) => T.kernel({
    id: `structure.hollow K=${K}`, group: "structure", axes: ["space"], claims: "homomorphism", from: { domain: "grid" }, to: { domain: "sequence" },
    forward: (f) => {
      const { h, w } = T.gridOf(f), M = T.modes(f.values, h, w, solidModes.h); let live = 0;
      for (const x of f.values) if (x) live++;
      const hole = Float64Array.from(f.values, (x) => (x ? 0 : 1)), dist = T.edt2(f.values, h, w); let r2 = 0;
      for (let i = 0; i < hole.length; i++) if (hole[i]) r2 = Math.max(r2, dist[i]);
      const v = new Float64Array(2 + K); v[0] = 1 - live / (h * w); v[1] = Math.sqrt(r2);
      for (let k = 0; k < K; k++) v[2 + k] = M.lam[k] - solidModes.lam[k];
      return { values: v, domain: { kind: "sequence", shape: [v.length] }, unit: "1", sigma: null };
    },
    keeps: { name: "void fraction in 0..1", check: (s, y) => ({ ok: y.values[0] >= 0 && y.values[0] < 1, detail: "void " + y.values[0].toFixed(4) }) },
    loss: (s, y) => T.budgetLoss(s, y, 1, 1e-6),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
