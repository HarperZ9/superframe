/* transducers/core: one interface for every kernel. A kernel takes a field and returns a field, and declares its
   input and output representation with units, its grade, its axes (light, noise, time, space) and its physics.
   run() hands it to the field type's apply(), which measures the grade and refuses a false claim, then refuses
   any kernel whose bits lost came out unmeasured. Randomness follows the superframe seed rule xmur3-mulberry32/1;
   a test checks this stream against superstack, which cannot be loaded as a classic script in a page. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  T.AXES = ["light", "noise", "time", "space"];
  T.SEED_RULE = "xmur3-mulberry32/1";
  const F = () => T.Field();
  const now = () => (g.performance ? g.performance.now() : Date.now());

  const xmur3 = (s) => {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
  /* rng(seed, tag): the node substream seed + "/" + tag. Returns floats in [0, 1). */
  T.rng = (seed, tag) => {
    let a = xmur3(tag === undefined ? String(seed) : String(seed) + "/" + tag);
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  T.gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  T.poisson = (r, m) => {
    if (m > 50) return Math.max(0, Math.round(m + Math.sqrt(m) * T.gauss(r)));
    const L = Math.exp(-m); let k = 0, p = 1;
    do { k++; p *= r(); } while (p > L);
    return k - 1;
  };
  T.shuffle = (a, seed, tag = "shuffle") => {
    const r = T.rng(seed, tag), o = Array.from(a);
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = o[i]; o[i] = o[j]; o[j] = t; }
    return o;
  };

  /* Field constructors, stating what a field must state. */
  const synth = { status: "defined", method: "synthetic" };
  const REP = { kind: "digital", bits: 64, encoding: "float64" };
  T.seq = (name, values, unit = "1", o = {}) => F().make({ name, domain: { kind: "sequence", shape: [values.length / (o.components || 1)], spacing: o.spacing }, values,
    components: o.components, unit, sigma: o.sigma === undefined ? null : o.sigma, prov: o.prov || synth, rep: o.rep || REP });
  T.grid = (name, h, w, values, unit = "1", o = {}) => F().make({ name, domain: { kind: "grid", shape: [h, w], spacing: o.spacing }, values, components: o.components,
    unit, sigma: o.sigma === undefined ? null : o.sigma, prov: o.prov || synth, rep: o.rep || REP });
  T.ANALOG = { kind: "analog" };
  T.gridOf = (f) => ({ h: f.domain.shape[0], w: f.domain.shape[1] });

  /* Estimators. All are measured on the data in hand and named in the ledger. */
  const H = (codes) => T.Perceive().entropy(codes);
  const q = (v, gr) => Array.from(v, (x) => (gr ? Math.round(x / gr) : x));
  T.entropy = (v, gr) => H(q(v, gr));
  T.budgetLoss = (src, out, gx, gy) => {
    const a = src.values.length * H(q(src.values, gx)), b = out.values.length * H(q(out.values, gy));
    return { bits: Math.max(0, a - b), method: `entropy budget at grain ${gx}, ${gy}` };
  };
  T.condLoss = (src, out, gx, gy) => {
    const a = q(src.values, gx), b = q(out.values, gy), j = a.map((x, i) => x + "|" + b[i]);
    return { bits: Math.max(0, H(j) - H(b)) * a.length, method: `H(X|Y) at grain ${gx}, ${gy}` };
  };
  const powerSpectrum = (v, h, w) => {
    const Fd = F(), f = Fd.make({ name: "x", domain: h > 1 ? { kind: "grid", shape: [h, w] } : { kind: "sequence", shape: [w] }, values: Float64Array.from(v), unit: "1", sigma: null, prov: synth, rep: REP });
    return Fd.power(Fd.fft(f)).values;
  };
  T.powerSpectrum = powerSpectrum;
  T.pad2 = (n) => { let m = 1; while (m < n) m *= 2; return m; };
  /* The mode capacity estimate: each real degree of freedom carries 0.5 log2(1 + S / N), so a transfer function
     loses the difference before and after, counted per mode where it falls. N is noise power per sample. */
  T.modeBits = (v, h, w, noise) => {
    const P = powerSpectrum(v, h, w), n = v.length, per = new Float64Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) { per[i] = 0.5 * Math.log2(1 + P[i] / (n * noise)); total += per[i]; }
    return { total, per };
  };
  /* Components are priced one channel at a time. */
  T.capacityLoss = (src, out, noise) => {
    const d = src.domain.kind === "grid" ? T.gridOf(src) : { h: 1, w: src.values.length / src.components }, c = src.components, n = d.h * d.w;
    const pick = (f, k) => (f.components === 1 ? f.values : Float64Array.from({ length: n }, (_, i) => f.values[i * f.components + k]));
    let lost = 0;
    for (let k = 0; k < c; k++) {
      const A = T.modeBits(pick(src, k), d.h, d.w, noise), B = T.modeBits(pick(out, k), d.h, d.w, noise);
      for (let i = 0; i < A.per.length; i++) lost += Math.max(0, A.per[i] - B.per[i]);
    }
    return { bits: lost, method: `mode capacity at noise power ${noise.toPrecision(3)}` };
  };

  T.kernel = (spec) => {
    for (const k of ["id", "group", "axes", "from", "to"]) if (!spec[k]) throw new (F().FieldError)(`kernel ${spec.id || "?"} must declare ${k}`);
    if (!spec.axes.length || !spec.axes.every((a) => T.AXES.includes(a))) throw new (F().FieldError)(spec.id + ": axes are light, noise, time and space");
    const conv = Object.assign({}, spec);
    if (spec.loss && !spec.inverse && !spec.reference) conv.lossEstimate = spec.loss;
    return F().converter(conv);
  };

  const checkRep = (want, f, where) => {
    if (want && want.rep && want.rep !== f.rep.kind) throw new (F().FieldError)(`${where}: expects ${want.rep}, got ${f.rep.kind}`);
  };
  /* A kernel's physics count as inputs: one value held from memory marks everything after it. */
  const weaken = (k, src) => {
    if (!k.physics || !k.physics.length) return src;
    const Fd = F();
    return Fd.derive(src, { prov: Fd.combineProv([src.prov].concat(k.physics), "physics of " + k.id) });
  };

  /* The one call. Returns the output field, with a row of what the crossing cost. */
  T.run = (k, src, opt = {}) => {
    const Fd = F(), t0 = now();
    checkRep(k.from, src, k.id + " input");
    const out = Fd.apply(k, weaken(k, src), opt);
    checkRep(k.to, out, k.id + " output");
    /* A declared structure that fails is refused even when the round trip came back clean: a lossless map can still break
       causality or an invariance. The field type only reads keeps on a lossy map, so the check lives here. */
    if (out.verdict.keeps && !out.verdict.keeps.ok) throw new Fd.ClaimError(`${k.id}: declared structure "${out.verdict.keeps.name}" fails (${out.verdict.keeps.detail})`, out.verdict);
    const v = out.verdict, extra = k.loss && (k.inverse || k.reference) ? k.loss(src, out) : null;
    const bits = extra ? extra.bits : v.bitsLost;
    if (bits === null || !Number.isFinite(bits)) throw new Fd.ClaimError(`${k.id}: bits lost unmeasured (${v.method})`, v);
    out.row = { id: k.id, group: k.group, axes: k.axes, claimed: v.claimed, measured: v.measured, bitsLost: bits, method: extra ? extra.method : v.method,
      roundTripBits: v.bitsLost, n: out.values.length, bytes: T.bytesOf(out), ms: now() - t0, unit: out.unit.name, status: out.prov.status };
    return out;
  };
  T.bytesOf = (f) => (f.values.byteLength !== undefined ? f.values.byteLength : Array.from(f.values).join("").length);
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
