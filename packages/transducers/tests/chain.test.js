"use strict";
const { test, assert, T, near, refuses, F } = require("./h.js");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), url = require("node:url");
const OUT = process.env.TRANSDUCERS_OUT || os.tmpdir();
const run = (d) => T.chain(d.src, d.kernels, d.opt);

test("the seed stream equals superframe's vendored superstack rule", async () => {
  const p = path.join(__dirname, "..", "..", "..", "substrate", "lib", "vendor", "superstack.mjs"), m = await import(url.pathToFileURL(p).href);
  const a = new m.Mulberry32(m.xmur3("7/lens")), b = T.rng(7, "lens");
  for (let i = 0; i < 1000; i++) assert.equal(b(), a.nextFloat());
  assert.equal(T.SEED_RULE, m.SEED_RULE);
});
test("all four chains run, keep their ledger whole and name a worst step", () => {
  for (const d of [T.demoCamera(), T.demoRetina(), T.demoText(), T.demoDNA()]) {
    const r = run(d);
    assert.ok(r.ledgerOk, d.name);
    assert.ok(r.worst, d.name);
    for (const x of r.rows) assert.ok(Number.isFinite(x.bitsLost) && x.bytes > 0, x.id);
  }
});
test("same seeds, same bytes: every chain's final hash is reproducible", () => {
  for (const f of [T.demoCamera, T.demoRetina, T.demoText, T.demoDNA]) {
    const a = run(f()), b = run(f());
    assert.equal(F.hashValues(a.out), F.hashValues(b.out), f.name);
    assert.equal(a.out.ledger[a.out.ledger.length - 1].hash, b.out.ledger[b.out.ledger.length - 1].hash);
  }
});
test("editing a ledger row breaks the chain", () => {
  const r = run(T.demoDNA()), l = r.out.ledger.map((e) => Object.assign({}, e));
  l[0].bitsLost = 0;
  assert.equal(F.verifyLedger(l).ok, false);
});
test("a chain in the wrong order is refused with a named reason", () => {
  const c = T.demoCamera();
  assert.throws(() => T.chain(c.src, [T.adc(8, 1)], {}), /expects analog/);
});
test("coherence bits: identical copies are large, an independent copy is near zero, a Gaussian channel meets the closed form", () => {
  const n = 1 << 14, r = T.rng(1, "c"), x = Float64Array.from({ length: n }, () => T.gauss(r)), f = T.seq("x", x), shuffled = T.seq("s", Float64Array.from(T.shuffle(x, 2))), snr = 3, y = T.seq("y", x.map((v) => v + Math.sqrt(1 / snr) * T.gauss(r)));
  assert.ok(T.coherenceBits(f, f) > 10 * n, "copy");
  assert.ok(T.coherenceBits(f, shuffled) < 0.01 * n, "shuffled control " + T.coherenceBits(f, shuffled));
  near(T.coherenceBits(f, y) / n, 0.5 * Math.log2(1 + snr), 0.05, "bits per sample");
});
test("the entropy-coded step keeps the measured bits of the step before it", () => {
  const r = run(T.demoCamera()), a = r.rows[r.rows.length - 1], b = r.rows[r.rows.length - 2];
  assert.equal(a.id, "code.huffman");
  assert.equal(a.keptMeasured, b.keptMeasured);
  assert.ok(a.bytes < b.bytes, "and fewer bytes");
});
/* The prediction: I = sbw * tbw * log2(1 + SNR) bounds the bits kept at every step. */
test("the prediction: the budget bounds the measured bits on every camera step", () => {
  const r = run(T.demoCamera()), over = r.rows.filter((x) => x.overBudget);
  fs.writeFileSync(path.join(OUT, "budget-camera.json"), JSON.stringify(r.rows.map(summary), null, 1));
  assert.deepEqual(over.map((x) => x.id), []);
});
test("the prediction FAILS at the retina's spike step: the Gaussian floor of a 1-bit grain says zero and the spikes still carry bits", () => {
  const r = run(T.demoRetina()), over = r.rows.filter((x) => x.overBudget);
  fs.writeFileSync(path.join(OUT, "budget-retina.json"), JSON.stringify(r.rows.map(summary), null, 1));
  assert.deepEqual(over.map((x) => x.id), ["spike.lif tau=0.02"], "the failure is this step and no other");
  const spike = over[0];
  assert.equal(spike.budget.I, 0);
  assert.ok(spike.keptMeasured > 0);
});
test("every other retina step sits inside the budget and inside the running minimum, except where the spike already ruined it", () => {
  const rows = run(T.demoRetina()).rows.slice(1, -1);
  for (const x of rows) { assert.ok(!x.overBudget, x.id); assert.ok(x.keptMeasured <= x.budget.I, x.id); }
});
test("the running budget: measured bits never climb above the smallest budget upstream, on the camera", () => {
  const rows = run(T.demoCamera()).rows.slice(1);
  for (const x of rows) assert.ok(!x.overRunning, `${x.id}: ${x.keptMeasured} > ${x.running}`);
});
test("the measured bits never rise along either chain, as data processing demands", () => {
  for (const f of [T.demoCamera, T.demoRetina]) { let p = Infinity; for (const x of run(f()).rows.slice(1)) { assert.ok(x.keptMeasured <= p * 1.02, `${x.id}: ${x.keptMeasured} after ${p}`); p = x.keptMeasured; } }
});
test("the prediction also FAILS in dim light: a low global SNR says zero while low modes still carry bits; the per-mode form holds there", () => {
  const d = T.demoRetina(4096, { mean: 5 }), r = T.chain(d.src, d.kernels, d.opt), c = r.rows.find((x) => x.id.startsWith("retina.catch"));
  assert.equal(c.budget.I, 0);
  assert.ok(c.keptMeasured > 0 && c.overBudget, "formula over");
  assert.ok(c.keptMeasured < c.budget.tight, "per-mode bound holds");
});
test("the per-mode form is not a bound either: it fails at shot noise in bright scenes, where the noise follows the signal", () => {
  const r = run(T.demoCamera()), s = r.rows.find((x) => x.id === "noise.shot");
  assert.ok(s.overTight && !s.overBudget);
  assert.ok(s.keptMeasured < 1.3 * s.budget.tight, "by less than a third");
});
/* A step that crushes everything to one number, and says it kept everything. */
const overclaim = () => {
  const k = T.kernel({ id: "planted.superres", group: "lens", axes: ["space"], claims: "homomorphism", from: { domain: "grid" }, to: { domain: "grid" },
    forward: (f) => { const m = f.values.reduce((a, b) => a + b, 0) / f.values.length; return { values: new Float64Array(f.values.length).fill(m), sigma: 1, components: f.components }; },
    keeps: { name: "mean", check: () => ({ ok: true, detail: "mean kept" }) }, loss: () => ({ bits: 0, method: "claims no loss" }) });
  k.claimKept = (rows) => rows[0].bitsKept;
  return k;
};
test("planted over-claim: a step that keeps everything on paper while its budget is nothing is refused", () => {
  const c = T.demoCamera(16), honest = T.chain(c.src, c.kernels.slice(0, 1), c.opt);
  assert.ok(!honest.rows[1].overBudget);
  refuses(() => T.chain(c.src, [overclaim()], Object.assign({ strict: true }, c.opt)), "BudgetError");
  const soft = T.chain(c.src, [overclaim()], c.opt);
  assert.ok(soft.rows[1].overBudget);
});
test("the budget's own controls: more read noise, fewer bits; a stopped-down pixel, fewer photons", () => {
  const base = { A: 1, D: 1, L: 1e6, p: 0.01, t: 0.01, r: 2 }, a = T.fourAxes(base);
  assert.ok(T.fourAxes(Object.assign({}, base, { r: 20 })).I < a.I);
  near(T.fourAxes(Object.assign({}, base, { p: 0.02 })).photons, 4 * a.photons, 1e-9);
  near(T.fourAxes(Object.assign({}, base, { t: 0.02 })).tbw, a.tbw / 2, 1e-9);
});
test("closed form: with shot noise alone, fine cells approach 1 / ln 2 bits per photon", () => {
  const b = { A: 1, D: 1, L: 1e6, r: 0, t: 1e-3 }, coarse = T.fourAxes(Object.assign({ p: 0.1 }, b)), fine = T.fourAxes(Object.assign({ p: 1e-4 }, b));
  near(fine.bitsPerPhoton, 1 / Math.LN2, 0.01, "limit");
  assert.ok(coarse.bitsPerPhoton < fine.bitsPerPhoton);
});
test("closed form: read noise makes a best pixel size; four axes trade", () => {
  const b = { A: 1, D: 1, L: 1e6, r: 3, t: 1e-2 }, ps = [1e-3, 2e-3, 4e-3, 8e-3, 1.6e-2, 3.2e-2, 6.4e-2], Is = ps.map((p) => T.fourAxes(Object.assign({ p }, b)).I), best = Is.indexOf(Math.max(...Is));
  assert.ok(best > 0 && best < ps.length - 1, Is.join());
});
test("the kernels contract maps every kernel, with no name collisions in its registry", { skip: T.hasData("kernels") ? false : "no kernels registry bound" }, () => {
  const names = new Set(T.kernelsRegistry().kernels.map((k) => k.name));
  const row = T.toKernelsRow(T.mirror(1));
  assert.ok(row.spec.axes.length && !names.has(row.name));
  assert.equal(row.gpu, null);
});
test("each source file stays under 300 lines and each function under 50", () => {
  const dir = path.join(__dirname, "..", "src");
  for (const f of fs.readdirSync(dir)) {
    const L = fs.readFileSync(path.join(dir, f), "utf8").split("\n");
    assert.ok(L.length <= 300, f + " is " + L.length);
    let d = 0, start = -1;
    L.forEach((l, i) => { if (/^  T\.\w+ = /.test(l) || /^  const \w+ = \(/.test(l)) { start = i; d = 0; } if (start >= 0 && /^  [}\]];?$|^  \}\);?$/.test(l)) { assert.ok(i - start <= 50, `${f}:${start + 1} runs ${i - start} lines`); start = -1; } });
  }
});
function summary(x) { return { id: x.id, grade: x.grade, bytes: x.bytes, ms: +x.ms.toFixed(2), bitsLost: +x.bitsLost.toFixed(1), ledgerKept: +x.bitsKept.toFixed(1), measuredKept: x.keptMeasured === null ? null : +x.keptMeasured.toFixed(1), budget: +x.budget.I.toFixed(1), running: +(x.running || 0).toFixed(1), tight: x.budget.tight === null ? null : +x.budget.tight.toFixed(1), signal: x.budget.signal, noiseFloor: x.budget.noise, dt: x.budget.dt, dx: x.budget.dx, sbw: x.budget.sbw, tbw: x.budget.tbw, over: !!x.overBudget, overTight: !!x.overTight, overLedger: !!x.overLedger }; }
