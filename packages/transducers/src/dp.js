/* transducers/dp: one dynamic-programming kernel. Given nodes in topological order and the edges into each, it finds
   the cheapest path. Needleman-Wunsch, Smith-Waterman and Knuth-Plass are three edge lists handed to it. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();

  /* n nodes. into(i) gives [{ from, cost }]; from -1 is a free start. Returns best costs and back pointers. */
  T.dpSolve = (n, into) => {
    const best = new Float64Array(n).fill(Infinity), back = new Int32Array(n).fill(-2);
    for (let i = 0; i < n; i++) for (const e of into(i)) {
      const c = (e.from < 0 ? 0 : best[e.from]) + e.cost;
      if (c < best[i]) { best[i] = c; back[i] = e.from; }
    }
    return { best, back };
  };
  T.dpPath = (back, end) => { const p = [end]; while (back[p[p.length - 1]] >= 0) p.push(back[p[p.length - 1]]); return p.reverse(); };

  /* Alignment as a graph over the (i, j) table. Global: one start. Local: every cell may start free and the path may
     end anywhere, which is the "max(0, ...)" of Smith-Waterman, written as an edge. */
  const alignGraph = (a, b, sc, local) => {
    const W = b.length + 1, id = (i, j) => i * W + j;
    return { W, size: (a.length + 1) * W, into: (k) => {
      const i = Math.floor(k / W), j = k % W, e = [];
      if (i === 0 && j === 0) return [{ from: -1, cost: 0 }];
      if (local) e.push({ from: -1, cost: 0 });
      if (i && j) e.push({ from: id(i - 1, j - 1), cost: -(a[i - 1] === b[j - 1] ? sc.match : sc.mismatch) });
      if (i) e.push({ from: id(i - 1, j), cost: -sc.gap });
      if (j) e.push({ from: id(i, j - 1), cost: -sc.gap });
      return e;
    } };
  };
  const traceAlign = (a, b, W, path) => {
    let A = "", B = "";
    for (let s = 1; s < path.length; s++) {
      const p = path[s - 1], q = path[s], i = Math.floor(q / W), j = q % W, pi = Math.floor(p / W), pj = p % W;
      A += i > pi ? a[i - 1] : "-"; B += j > pj ? b[j - 1] : "-";
    }
    return { A, B };
  };
  T.needlemanWunsch = (a, b, sc) => {
    const G = alignGraph(a, b, sc, false), r = T.dpSolve(G.size, G.into), end = G.size - 1;
    return Object.assign({ score: 0 - r.best[end] }, traceAlign(a, b, G.W, T.dpPath(r.back, end)));
  };
  T.smithWaterman = (a, b, sc) => {
    const G = alignGraph(a, b, sc, true), r = T.dpSolve(G.size, G.into); let end = 0;
    for (let i = 1; i < G.size; i++) if (r.best[i] < r.best[end]) end = i;
    return Object.assign({ score: 0 - r.best[end] }, traceAlign(a, b, G.W, T.dpPath(r.back, end)));
  };
  /* Exhaustive enumeration of global alignments, the independent check for short strings. */
  T.bruteGlobal = (a, b, sc) => {
    const go = (i, j) => {
      if (i === a.length && j === b.length) return 0;
      let m = -Infinity;
      if (i < a.length && j < b.length) m = Math.max(m, (a[i] === b[j] ? sc.match : sc.mismatch) + go(i + 1, j + 1));
      if (i < a.length) m = Math.max(m, sc.gap + go(i + 1, j));
      if (j < b.length) m = Math.max(m, sc.gap + go(i, j + 1));
      return m;
    };
    return go(0, 0);
  };
  T.alignKernel = (ref, sc, o = {}) => T.kernel({
    id: `align.${o.local ? "sw" : "nw"}`, group: "bio", axes: ["space"], claims: "homomorphism", from: { domain: "sequence", unit: "symbol" }, to: { domain: "sequence", unit: "symbol" },
    forward: (f) => {
      const a = Array.from(f.values).join(""), r = (o.local ? T.smithWaterman : T.needlemanWunsch)(a, ref, sc), v = Array.from(r.A);
      return { values: v, domain: { kind: "sequence", shape: [v.length] }, unit: "symbol", rep: { kind: "digital", encoding: "alignment", score: r.score, partner: r.B }, sigma: null };
    },
    keeps: { name: "gapless read back is a substring of the query", check: (s, y) => {
      const a = Array.from(s.values).join(""), got = Array.from(y.values).join("").replace(/-/g, "");
      return { ok: a.includes(got), detail: `${got.length} of ${a.length} symbols aligned` };
    } },
    loss: (s, y) => { const a = T.entropy(Array.from(s.values)) * s.values.length, g2 = Array.from(y.values).filter((c) => c !== "-"); return { bits: Math.max(0, a - T.entropy(g2) * g2.length), method: "symbols outside the aligned span, by entropy" }; },
  });

  /* Knuth-Plass as the same solver. Items follow the BuildLang typesetter: box, glue, penalty; widths are integers
     in scaled points, badness and demerits follow tex.web, so results compare exactly. State (break, fitness). */
  const INF_BAD = 10000, INF_PEN = 10000, EJECT = -10000;
  const pyDiv = (a, b) => Math.floor(a / b);
  T.texBadness = (t, s) => {
    if (t === 0) return 0;
    if (s <= 0) return INF_BAD;
    const r = t <= 7230584 ? pyDiv(t * 297, s) : s >= 1663497 ? pyDiv(t, pyDiv(s, 297)) : t;
    return r > 1290 ? INF_BAD : pyDiv(r * r * r + 131072, 262144);
  };
  const kpSums = (items) => {
    const n = items.length, w = new Array(n + 1).fill(0), st = new Array(n + 1).fill(0), sh = new Array(n + 1).fill(0), fil = new Array(n + 1).fill(0);
    items.forEach((it, i) => {
      const glue = it.t === "g" || it.t === "f";
      w[i + 1] = w[i] + (it.t === "b" || glue ? it.w : 0);
      st[i + 1] = st[i] + (it.t === "g" ? it.st : 0); sh[i + 1] = sh[i] + (it.t === "g" ? it.sh : 0); fil[i + 1] = fil[i] + (it.t === "f" ? 1 : 0);
    });
    return { w, st, sh, fil };
  };
  const afterBreak = (items, pos) => { let j = pos + 1; while (j < items.length - 1 && items[j].t !== "b") j++; return j; };
  const lineCost = (S, items, a, b, width) => {
    const start = afterBreak(items, a), it = items[b], len = S.w[b] - S.w[start] + (it.t === "p" ? it.w || 0 : 0);
    if (len < width) {
      if (S.fil[b] - S.fil[start] > 0) return { bad: 0, fit: 2 };
      const bad = T.texBadness(width - len, S.st[b] - S.st[start]);
      return { bad, fit: bad > 99 ? 0 : bad > 12 ? 1 : 2 };
    }
    const shr = S.sh[b] - S.sh[start];
    if (len - width > shr) return null;
    const bad = T.texBadness(len - width, shr);
    return { bad, fit: bad > 12 ? 3 : 2 };
  };
  const breakpoints = (items) => {
    const c = [-1];
    items.forEach((it, i) => { if ((it.t === "p" && it.p < INF_PEN) || ((it.t === "g" || it.t === "f") && i > 0 && items[i - 1].t === "b")) c.push(i); });
    return c;
  };
  const demerits = (o, bad, it, prevNode, fit) => {
    const pen = it.t === "p" ? it.p : 0;
    let d = (o.linePenalty + bad) ** 2;
    if (pen > 0) d += pen * pen; else if (pen > EJECT) d -= pen * pen;
    if (it.t === "p" && it.fl && prevNode.fl) d += 10000;
    if (Math.abs(fit - prevNode.fit) > 1) d += o.adj;
    if (pen === EJECT && prevNode.fl) d += 5000;
    return d;
  };
  /* Nodes: root, then four per breakpoint. A forced break forbids lines that jump it, as in TeX. */
  T.knuthPlass = (items, width, o0 = {}) => {
    const o = Object.assign({ tolerance: 200, linePenalty: 10, adj: 10000 }, o0), S = kpSums(items), B = breakpoints(items), N = 1 + 4 * (B.length - 1);
    const meta = (i) => (i === 0 ? { b: -1, fit: 2, fl: false, bi: 0 } : { b: B[1 + Math.floor((i - 1) / 4)], fit: (i - 1) % 4, fl: items[B[1 + Math.floor((i - 1) / 4)]].fl === 1, bi: 1 + Math.floor((i - 1) / 4) });
    const into = (i) => {
      if (i === 0) return [{ from: -1, cost: 0 }];
      const m = meta(i), e = [], it = items[m.b];
      for (let pi = 0; pi < i; pi++) {
        const p = meta(pi);
        if (p.bi >= m.bi) continue;
        if (B.slice(p.bi + 1, m.bi).some((b) => items[b].t === "p" && items[b].p === EJECT)) continue;
        const c = lineCost(S, items, p.b, m.b, width);
        if (!c || c.fit !== m.fit || c.bad > o.tolerance) continue;
        e.push({ from: pi, cost: demerits(o, c.bad, it, p, c.fit) });
      }
      return e;
    };
    const r = T.dpSolve(N, into); let end = -1;
    for (let i = N - 4; i < N; i++) if (r.best[i] < Infinity && (end < 0 || r.best[i] < r.best[end])) end = i;
    if (end < 0) return { breaks: [], demerits: Infinity, feasible: false };
    return { breaks: T.dpPath(r.back, end).slice(1).map((i) => meta(i).b), demerits: r.best[end], feasible: true };
  };
  /* Items for a paragraph of word widths: box, glue, ..., then fil glue and a forced break. */
  T.paragraphItems = (words, space = { w: 218453, st: 109227, sh: 72818 }) => {
    const it = [];
    words.forEach((w, i) => { it.push({ t: "b", w }); if (i < words.length - 1) it.push({ t: "g", w: space.w, st: space.st, sh: space.sh }); });
    it.push({ t: "p", w: 0, p: 10000, fl: 0 }, { t: "f", w: 0 }, { t: "p", w: 0, p: -10000, fl: 0 });
    return it;
  };
  /* The same text as a field kernel: word widths in, line break positions out. */
  T.lineBreak = (width, o = {}) => T.kernel({
    id: "typeset.knuth-plass", group: "bio", axes: ["space"], claims: "homomorphism", from: { domain: "sequence" }, to: { domain: "sequence", unit: "count" },
    forward: (f) => {
      const r = T.knuthPlass(T.paragraphItems(Array.from(f.values)), width, o);
      if (!r.feasible) throw new (F().FieldError)("typeset: no feasible breaks at this tolerance");
      return { values: Float64Array.from(r.breaks), domain: { kind: "sequence", shape: [r.breaks.length] }, unit: "count", rep: { kind: "digital", grain: 1, encoding: "break index" }, sigma: 0 };
    },
    keeps: { name: "breaks rise and end at the paragraph end", check: (s, y) => {
      const v = y.values, ok = v.every((x, i) => !i || x > v[i - 1]);
      return { ok, detail: `${v.length} lines` };
    } },
    loss: (s, y) => T.budgetLoss(s, y, o.grain || 65536, 1),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
