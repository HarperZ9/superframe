/* transducers/bio: word spectra, motifs in bits and tree likelihood. All sequences here are synthetic. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const ALPHA = "ACGT", IDX = { A: 0, C: 1, G: 2, T: 3 };
  const symbolField = (name, s) => T.seq(name, Array.from(s), "symbol", { rep: { kind: "digital", encoding: "symbol" } });
  T.dna = (name, s) => symbolField(name, s);
  T.randomDNA = (n, seed, tag = "dna", gc = 0.5) => {
    const r = T.rng(seed, tag); let s = "";
    for (let i = 0; i < n; i++) { const u = r(); s += u < gc / 2 ? "G" : u < gc ? "C" : u < gc + (1 - gc) / 2 ? "A" : "T"; }
    return s;
  };
  T.mutate = (s, rate, seed) => { const r = T.rng(seed, "mutate"); return Array.from(s, (c) => (r() < rate ? ALPHA[Math.floor(r() * 4)] : c)).join(""); };
  T.plantMotif = (s, motif, every) => { const a = Array.from(s); for (let i = 7; i + motif.length < a.length; i += every) for (let k = 0; k < motif.length; k++) a[i + k] = motif[k]; return a.join(""); };

  /* Word counts over any alphabet: DNA, or text chars. Returned sorted by word, so the spectrum is canonical. */
  T.kmerCounts = (seq, k) => {
    const c = new Map(), s = Array.isArray(seq) ? seq : Array.from(seq);
    for (let i = 0; i + k <= s.length; i++) { const w = s.slice(i, i + k).join(""); c.set(w, (c.get(w) || 0) + 1); }
    return c;
  };
  T.kmer = (k, o = {}) => T.kernel({
    id: `kmer ${k}`, group: "bio", axes: ["space"], claims: "homomorphism", from: { domain: "sequence" }, to: { domain: "sequence", unit: "count" },
    forward: (f) => {
      const c = T.kmerCounts(Array.from(f.values), k), keys = [...c.keys()].sort(), v = Float64Array.from(keys, (w) => c.get(w));
      return { values: v, domain: { kind: "sequence", shape: [v.length], words: keys }, unit: "count", rep: { kind: "digital", grain: 1, encoding: "word count" }, sigma: 0 };
    },
    keeps: { name: "counts sum to the number of windows", check: (s, y) => {
      const t = y.values.reduce((a, b) => a + b, 0), want = s.values.length - k + 1;
      return { ok: t === want, detail: `${t} of ${want}` };
    } },
    loss: (s, y) => ({ bits: Math.max(0, T.entropy(Array.from(s.values).map(String)) * s.values.length - T.entropy(y.values) * y.values.length), method: "entropy budget, symbols against word counts" }),
  });
  /* Over-represented words against shuffles of the same symbols. Returns the best word and its z. */
  T.spectrumZ = (seq, k, seed = 1, shuffles = 100) => {
    const a = Array.from(seq), real = T.kmerCounts(a, k), sum = new Map(), sq = new Map();
    for (let s = 0; s < shuffles; s++) for (const [w, c] of T.kmerCounts(T.shuffle(a, seed, "kmer" + s), k)) { sum.set(w, (sum.get(w) || 0) + c); sq.set(w, (sq.get(w) || 0) + c * c); }
    let best = { z: -Infinity, word: null };
    for (const [w, c] of real) {
      const m = (sum.get(w) || 0) / shuffles, v = (sq.get(w) || 0) / shuffles - m * m, z = (c - m) / Math.sqrt(Math.max(v, 1 / shuffles));
      if (z > best.z) best = { z, word: w, count: c, mean: m };
    }
    return best;
  };
  /* The period of a sequence from its indicator spectrum: power at each lag across the four letters. */
  T.indicatorSpectrum = (seq) => {
    const a = Array.from(seq), n = T.pad2(a.length) / (T.pad2(a.length) > a.length ? 2 : 1), P = new Float64Array(n);
    for (const c of new Set(a)) { const x = Float64Array.from({ length: n }, (_, i) => (a[i] === c ? 1 : 0)), m = T.powerSpectrum(x, 1, n); for (let k = 1; k < n; k++) P[k] += m[k]; }
    return P;
  };
  T.peakPeriod = (P) => { let b = 1; for (let k = 2; k < P.length / 2; k++) if (P[k] > P[b]) b = k; return { period: P.length / b, snr: P[b] / (P.reduce((a, x) => a + x, 0) / P.length) }; };

  /* Position weight matrix. Input: n sites of length L as symbols in a grid. Output: L x 4 information in bits, the
     height of each letter in a logo. IC = 2 + sum p log2 p per column, with the small-sample correction left off so a
     closed form holds; shuffled columns in a test show the sampling floor. */
  T.pwm = () => T.kernel({
    id: "motif.pwm", group: "bio", axes: ["space"], claims: "homomorphism", from: { domain: "grid", unit: "symbol" }, to: { domain: "grid", unit: "bit" },
    forward: (f) => {
      const { h, w } = T.gridOf(f), o = new Float64Array(w * 4);
      for (let c = 0; c < w; c++) {
        const cnt = [0, 0, 0, 0];
        for (let r = 0; r < h; r++) cnt[IDX[f.values[r * w + c]]]++;
        let ic = 2;
        for (const x of cnt) if (x) ic += (x / h) * Math.log2(x / h);
        for (let a = 0; a < 4; a++) o[c * 4 + a] = (cnt[a] / h) * ic;
      }
      return { values: o, domain: { kind: "grid", shape: [w, 4] }, unit: "bit", rep: { kind: "digital", bits: 64, encoding: "bits per letter" }, sigma: null };
    },
    keeps: { name: "each column holds at most two bits", check: (s, y) => {
      let m = 0;
      for (let c = 0; c < y.values.length / 4; c++) m = Math.max(m, y.values[c * 4] + y.values[c * 4 + 1] + y.values[c * 4 + 2] + y.values[c * 4 + 3]);
      return { ok: m <= 2 + 1e-9, detail: `largest column ${m.toFixed(3)} bits` };
    } },
    loss: (s, y) => ({ bits: Math.max(0, T.entropy(Array.from(s.values)) * s.values.length - T.entropy(y.values, 1 / 64) * y.values.length), method: "entropy budget at 1/64 bit" }),
  });
  T.motifBits = (out) => { let t = 0; for (const v of out.values) t += v; return t; };
  T.sitesGrid = (sites) => T.grid("sites", sites.length, sites[0].length, Array.from(sites.join("")), "symbol", { rep: { kind: "digital", encoding: "symbol" } });

  /* Felsenstein pruning under Jukes-Cantor. A tree node is { left, right, tl, tr } or a leaf { leaf: i }. */
  const jc = (t) => { const e = Math.exp((-4 * t) / 3); return { same: 0.25 + 0.75 * e, diff: 0.25 - 0.25 * e }; };
  const prune = (node, site) => {
    if (node.leaf !== undefined) { const l = [0, 0, 0, 0]; l[IDX[site[node.leaf]]] = 1; return l; }
    const L = prune(node.left, site), R = prune(node.right, site), a = jc(node.tl), b = jc(node.tr), o = [0, 0, 0, 0];
    for (let x = 0; x < 4; x++) {
      let pl = 0, pr = 0;
      for (let y = 0; y < 4; y++) { pl += (x === y ? a.same : a.diff) * L[y]; pr += (x === y ? b.same : b.diff) * R[y]; }
      o[x] = pl * pr;
    }
    return o;
  };
  T.siteLikelihood = (tree, site) => prune(tree, site).reduce((s, x) => s + x * 0.25, 0);
  /* Summing over all ancestral states by hand, the check on pruning. */
  T.bruteLikelihood = (tree, site) => {
    const inner = []; const walk = (n) => { if (n.leaf === undefined) { inner.push(n); walk(n.left); walk(n.right); } }; walk(tree);
    const edge = (x, y, t) => { const c = jc(t); return x === y ? c.same : c.diff; }; let tot = 0;
    const assign = new Map();
    const stateOf = (n) => (n.leaf !== undefined ? IDX[site[n.leaf]] : assign.get(n));
    const score = () => { let p = 0.25; for (const n of inner) p *= edge(assign.get(n), stateOf(n.left), n.tl) * edge(assign.get(n), stateOf(n.right), n.tr); return p; };
    const go = (i) => { if (i === inner.length) { tot += score(); return; } for (let x = 0; x < 4; x++) { assign.set(inner[i], x); go(i + 1); } };
    go(0);
    return tot;
  };
  T.simulateAlignment = (tree, taxa, sites, seed) => {
    const r = T.rng(seed, "evolve"), out = Array.from({ length: taxa }, () => "");
    const fall = (n, s, cols) => { if (n.leaf !== undefined) { cols[n.leaf] = ALPHA[s]; return; } for (const [ch, t] of [[n.left, n.tl], [n.right, n.tr]]) { const c = jc(t), u = r(); let ns = s; if (u >= c.same) ns = (s + 1 + Math.floor(((u - c.same) / (1 - c.same)) * 3)) % 4; fall(ch, ns, cols); } };
    for (let i = 0; i < sites; i++) { const cols = []; fall(tree, Math.floor(r() * 4), cols); for (let t = 0; t < taxa; t++) out[t] += cols[t]; }
    return out;
  };
  T.felsenstein = (tree, o = {}) => T.kernel({
    id: "tree.felsenstein", group: "bio", axes: ["time"], claims: "homomorphism", from: { domain: "grid", unit: "symbol" }, to: { domain: "sequence", unit: "bit" },
    forward: (f) => {
      const { h: taxa, w: sites } = T.gridOf(f), v = new Float64Array(sites);
      for (let c = 0; c < sites; c++) { let site = ""; for (let t = 0; t < taxa; t++) site += f.values[t * sites + c]; v[c] = -Math.log2(T.siteLikelihood(tree, site)); }
      return { values: v, domain: { kind: "sequence", shape: [sites] }, unit: "bit", rep: { kind: "digital", bits: 64, encoding: "bits per site" }, sigma: null };
    },
    keeps: { name: "each site's cost is finite and at least the free letter", check: (s, y) => ({ ok: y.values.every((v) => Number.isFinite(v) && v >= 2 - 1e-9), detail: "at least 2 bits a site" }) },
    loss: (s, y) => ({ bits: Math.max(0, T.entropy(Array.from(s.values)) * s.values.length - T.entropy(y.values, o.grain || 1 / 64) * y.values.length), method: "entropy budget" }),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
