/* transducers/pixels: sampling, quantisation, dither, Bayer, entropy coding, bit planes. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();
  const digital = (bits, grain, enc = "uint") => ({ kind: "digital", bits, grain, encoding: enc });
  const meanOf = (v) => v.reduce((p, x) => p + x, 0) / v.length;

  /* Keep every k-th sample. A sample-and-hold rebuild measures what the gap costs. */
  const shapeOf = (f) => (f.domain.kind === "grid" ? T.gridOf(f) : { h: 1, w: f.values.length });
  const decimate = (f, k) => {
    const { h, w } = shapeOf(f), grid = f.domain.kind === "grid", ky = grid ? k : 1, H = Math.ceil(h / ky), W = Math.ceil(w / k), v = new Float64Array(H * W);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) v[y * W + x] = f.values[y * ky * w + x * k];
    return { values: v, domain: grid ? { kind: "grid", shape: [H, W] } : { kind: "sequence", shape: [W] }, sigma: f.sigma };
  };
  T.sample = (k, o = {}) => {
    let src = null;
    return T.kernel({
      id: `sample /${k}`, group: "pixels", axes: o.axes || ["space", "time"], claims: "homomorphism", tol: o.grain || 1 / 256, from: { rep: "digital" }, to: { rep: "digital" },
      forward: (f) => { src = shapeOf(f); return decimate(f, k); },
      inverse: (y) => {
        const grid = y.domain.kind === "grid", H = grid ? y.domain.shape[0] : 1, W = grid ? y.domain.shape[1] : y.values.length, ky = grid ? k : 1, v = new Float64Array(src.h * src.w);
        for (let a = 0; a < src.h; a++) for (let b = 0; b < src.w; b++) v[a * src.w + b] = y.values[Math.min(H - 1, Math.floor(a / ky)) * W + Math.min(W - 1, Math.floor(b / k))];
        return v;
      },
      keeps: { name: "the kept samples are the source's own", check: (s, y) => { const ok = y.values[0] === s.values[0]; return { ok, detail: "first sample " + (ok ? "same" : "differs") }; } },
    });
  };
  /* Where a tone at f lands after sampling at fs. */
  T.aliasOf = (f, fs) => Math.abs(f - fs * Math.round(f / fs));

  T.quantise = (bits, lo = 0, hi = 1) => {
    const L = 2 ** bits - 1, lsb = (hi - lo) / L;
    return T.kernel({
      id: `quantise ${bits}b`, group: "pixels", axes: ["noise"], claims: "homomorphism", from: { rep: "digital" }, to: { unit: "count", rep: "digital" },
      forward: (f) => ({ values: Float64Array.from(f.values, (x) => Math.round((Math.min(hi, Math.max(lo, x)) - lo) / lsb)), unit: "count", rep: digital(bits, 1), sigma: 1 / Math.sqrt(12) }),
      keeps: { name: "monotone", check: (s, y) => {
        const I = Array.from(s.values.keys()).sort((a, b) => s.values[a] - s.values[b]);
        for (let i = 1; i < I.length; i++) if (y.values[I[i]] < y.values[I[i - 1]]) return { ok: false, detail: "order broken" };
        return { ok: true, detail: "codes follow the input order" };
      } },
      loss: (s, y) => T.condLoss(s, y, lsb / 256, 1),
    });
  };
  const meanKept = (lsb, lo) => ({ name: "mean follows the input", check: (s, y) => {
    const a = meanOf(s.values), b = meanOf(y.values) * lsb + lo;
    return { ok: Math.abs(a - b) < lsb, detail: `mean shift ${(a - b).toExponential(2)}` };
  } });
  /* Noise-shaped quantisers. TPDF adds two uniform draws of one LSB; the diffuser pushes each error to its neighbours. */
  T.ditherTPDF = (bits, seed = 1, lo = 0, hi = 1) => {
    const L = 2 ** bits - 1, lsb = (hi - lo) / L;
    return T.kernel({
      id: `dither.tpdf ${bits}b`, group: "pixels", axes: ["noise"], claims: "homomorphism", from: { rep: "digital" }, to: { unit: "count", rep: "digital" },
      forward: (f) => { const r = T.rng(seed, "tpdf"); return { values: Float64Array.from(f.values, (x) => Math.max(0, Math.min(L, Math.round((x - lo) / lsb + r() - r())))), unit: "count", rep: digital(bits, 1), sigma: 0.5 }; },
      keeps: meanKept(lsb, lo), loss: (s, y) => T.condLoss(s, y, lsb / 256, 1),
    });
  };
  T.diffuse = (bits, lo = 0, hi = 1) => {
    const L = 2 ** bits - 1, lsb = (hi - lo) / L;
    return T.kernel({
      id: `dither.diffuse ${bits}b`, group: "pixels", axes: ["noise", "space"], claims: "homomorphism", from: { domain: "grid", rep: "digital" }, to: { unit: "count", rep: "digital" },
      forward: (f) => {
        const { h, w } = T.gridOf(f), e = Float64Array.from(f.values, (x) => (x - lo) / lsb), o = new Float64Array(e.length);
        const push = (y, x, a, q) => { if (y < h && x >= 0 && x < w) e[y * w + x] += (q * a) / 16; };
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x, c = Math.max(0, Math.min(L, Math.round(e[i]))), er = e[i] - c; o[i] = c;
          push(y, x + 1, 7, er); push(y + 1, x - 1, 3, er); push(y + 1, x, 5, er); push(y + 1, x + 1, 1, er);
        }
        return { values: o, unit: "count", rep: digital(bits, 1), sigma: 0.5 };
      },
      keeps: meanKept(lsb, lo), loss: (s, y) => T.condLoss(s, y, lsb / 256, 1),
    });
  };

  /* Bayer RGGB. Mosaic keeps one colour per site; demosaic interpolates the other two and never touches the sampled
     one, so a demosaic followed by a mosaic returns the raw frame bit for bit: an embedding. */
  const site = (y, x) => (y % 2 === 0 ? (x % 2 === 0 ? 0 : 1) : x % 2 === 0 ? 1 : 2);
  T.mosaicOf = (v, h, w) => { const o = new Float64Array(h * w); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = v[3 * (y * w + x) + site(y, x)]; return o; };
  const demosaicOf = (v, h, w) => {
    const o = new Float64Array(3 * h * w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sum = [0, 0, 0], cnt = [0, 0, 0], own = site(y, x);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const Y = (y + a + h) % h, X = (x + b + w) % w, s = site(Y, X);
        sum[s] += v[Y * w + X]; cnt[s]++;
      }
      for (let c = 0; c < 3; c++) o[3 * (y * w + x) + c] = c === own ? v[y * w + x] : sum[c] / cnt[c];
    }
    return o;
  };
  T.bayer = (grain = 1 / 256) => T.kernel({
    id: "bayer.mosaic", group: "pixels", axes: ["light", "space"], claims: "homomorphism", tol: grain, from: { domain: "grid", rep: "digital" }, to: { domain: "grid", rep: "digital" },
    forward: (f) => {
      if (f.components !== 3) throw new (F().FieldError)("bayer.mosaic takes three colour components");
      const { h, w } = T.gridOf(f);
      return { values: T.mosaicOf(f.values, h, w), components: 1, sigma: typeof f.sigma === "number" ? f.sigma : null };
    },
    inverse: (y) => demosaicOf(y.values, y.domain.shape[0], y.domain.shape[1]),
    keeps: { name: "one sampled colour per site, exact", check: (s, y) => {
      const { h, w } = T.gridOf(s); let bad = 0;
      for (let a = 0; a < h; a++) for (let b = 0; b < w; b++) if (y.values[a * w + b] !== s.values[3 * (a * w + b) + site(a, b)]) bad++;
      return { ok: !bad, detail: bad + " sites changed" };
    } },
  });
  T.demosaic = () => T.kernel({
    id: "bayer.demosaic", group: "pixels", axes: ["light", "space"], claims: "embedding", from: { domain: "grid", rep: "digital" }, to: { domain: "grid", rep: "digital" },
    forward: (f) => { const { h, w } = T.gridOf(f); return { values: demosaicOf(f.values, h, w), components: 3, sigma: typeof f.sigma === "number" ? f.sigma : null }; },
    inverse: (y) => { const { h, w } = T.gridOf(y); return T.mosaicOf(y.values, h, w); },
  });

  /* Canonical Huffman on integer symbols. The stream holds a small header and the packed bits as bytes. */
  const codeLengths = (counts) => {
    const nodes = [...counts].map(([s, c]) => ({ c, s, kids: null }));
    if (nodes.length === 1) return new Map([[nodes[0].s, 1]]);
    nodes.sort((a, b) => a.c - b.c || a.s - b.s);
    const q2 = []; let i = 0, j = 0;
    const pop = () => (i < nodes.length && (j >= q2.length || nodes[i].c <= q2[j].c) ? nodes[i++] : q2[j++]);
    while (nodes.length - i + q2.length - j > 1) { const a = pop(), b = pop(); q2.push({ c: a.c + b.c, kids: [a, b] }); }
    const L = new Map(), walk = (n, d) => { if (n.kids) { walk(n.kids[0], d + 1); walk(n.kids[1], d + 1); } else L.set(n.s, d); };
    walk(pop(), 0);
    return L;
  };
  const canonical = (L) => {
    const syms = [...L].sort((a, b) => a[1] - b[1] || a[0] - b[0]), codes = new Map();
    let code = 0, prev = syms.length ? syms[0][1] : 0;
    for (const [s, l] of syms) { code *= 2 ** (l - prev); codes.set(s, [code, l]); code++; prev = l; }
    return { syms, codes };
  };
  T.huffmanEncode = (ints) => {
    const counts = new Map();
    for (const x of ints) counts.set(x, (counts.get(x) || 0) + 1);
    const { syms, codes } = canonical(codeLengths(counts)), head = [ints.length, syms.length];
    for (const [s, l] of syms) head.push(s, l);
    let total = 0;
    for (const x of ints) total += codes.get(x)[1];
    const bytes = new Uint8Array(Math.ceil(total / 8)); let p = 0;
    for (const x of ints) { const [c, l] = codes.get(x); for (let b = l - 1; b >= 0; b--, p++) if (Math.floor(c / 2 ** b) % 2) bytes[p >> 3] |= 128 >> (p & 7); }
    return { head, bytes, bits: total };
  };
  T.huffmanDecode = (e) => {
    const n = e.head[0], m = e.head[1], L = new Map();
    for (let i = 0; i < m; i++) L.set(e.head[2 + 2 * i], e.head[3 + 2 * i]);
    const rev = new Map();
    for (const [s, [c, l]] of canonical(L).codes) rev.set(l + ":" + c, s);
    const o = new Float64Array(n); let p = 0;
    for (let i = 0; i < n; i++) {
      let c = 0, l = 0, s;
      do { c = c * 2 + ((e.bytes[p >> 3] >> (7 - (p & 7))) & 1); p++; l++; s = rev.get(l + ":" + c); } while (s === undefined && l < 64);
      if (s === undefined) throw new (F().FieldError)("huffman: bad stream");
      o[i] = s;
    }
    return o;
  };
  /* Stream layout as a field of byte values: header numbers as 8-byte floats, then the packed bytes. */
  const packStream = (e) => { const h = new Uint8Array(new Float64Array([e.head.length].concat(e.head)).buffer), o = new Float64Array(h.length + e.bytes.length); o.set(h); o.set(e.bytes, h.length); return o; };
  const unpackStream = (v) => { const b = Uint8Array.from(v), len = new Float64Array(b.slice(0, 8).buffer)[0]; return { head: Array.from(new Float64Array(b.slice(8, 8 + 8 * len).buffer)), bytes: b.slice(8 + 8 * len) }; };
  T.entropyCode = () => T.kernel({
    id: "code.huffman", group: "pixels", axes: ["noise"], claims: "embedding", from: { rep: "digital" }, to: { unit: "byte", rep: "digital" },
    forward: (f) => {
      if (!f.values.every((x) => Number.isInteger(x))) throw new (F().FieldError)("code.huffman codes integers: quantise first");
      const s = packStream(T.huffmanEncode(f.values));
      return { values: Uint8Array.from(s), domain: { kind: "sequence", shape: [s.length] }, components: 1, unit: "byte", rep: { kind: "digital", bits: 8, encoding: "huffman stream" }, sigma: 0 };
    },
    inverse: (y) => T.huffmanDecode(unpackStream(y.values)),
  });

  T.bitplanes = (bits = 8) => T.kernel({
    id: `bitplanes ${bits}`, group: "pixels", axes: ["noise"], claims: "isomorphism", from: { unit: "count", rep: "digital" }, to: { unit: "bit", rep: "digital" },
    forward: (f) => {
      const n = f.values.length, o = new Float64Array(n * bits);
      for (let i = 0; i < n; i++) {
        if (f.values[i] < 0 || f.values[i] >= 2 ** bits || f.values[i] % 1) throw new (F().FieldError)("bitplanes: value outside the depth");
        for (let b = 0; b < bits; b++) o[i * bits + b] = (f.values[i] >>> b) & 1;
      }
      return { values: o, components: bits, unit: "bit", rep: digital(1, 1, "bit"), sigma: 0 };
    },
    inverse: (y) => { const n = y.values.length / bits, o = new Float64Array(n); for (let i = 0; i < n; i++) { let v = 0; for (let b = 0; b < bits; b++) v |= y.values[i * bits + b] << b; o[i] = v; } return o; },
    targets: (s, y) => { const r = T.rng(7, "planes"); return F().derive(y, { values: Float64Array.from(y.values, () => (r() < 0.5 ? 0 : 1)), method: "random planes" }); },
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
