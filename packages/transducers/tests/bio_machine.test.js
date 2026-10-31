"use strict";
const { test, assert, T, needs, near, refuses } = require("./h.js");
const cp = require("node:child_process"), path = require("node:path"), fs = require("node:fs"), os = require("node:os");

test("Hill: half response at K, slope n / 4 per natural log at K", () => {
  const V = 2, K = 3, n = 2.5, e = 1e-5;
  near(T.hillValue(K, V, K, n), V / 2, 1e-12);
  near((T.hillValue(K * Math.exp(e), V, K, n) - T.hillValue(K * Math.exp(-e), V, K, n)) / (2 * e), (V * n) / 4, 1e-6);
  const o = T.run(T.hill(V, K, n, { domain: "sequence", tol: 0.2 }), T.seq("x", Float64Array.from({ length: 256 }, (_, i) => i / 16)));
  assert.equal(o.row.measured, "homomorphism");
  assert.ok(o.row.bitsLost > 0, "saturation costs bits");
});
test("Michaelis-Menten: a Lineweaver-Burk line recovers Km and Vmax", () => {
  const s = [0.5, 1, 2, 4, 8, 16], f = T.seq("s", Float64Array.from(s)), v = Array.from(T.michaelisMenten(7, 2.2).forward(f).values), r = T.lineweaverBurk(s, v);
  near(r.Vmax, 7, 1e-9); near(r.Km, 2.2, 1e-9);
});
test("the cascade's impulse response peaks at (n - 1) tau with unit area", () => {
  const dt = 1e-3, tau = 0.02, n = 4, h = T.gammaIR(n, tau, dt, 400);
  near(h.indexOf(Math.max(...h)) * dt, (n - 1) * tau, dt, "peak");
  near(h.reduce((a, b) => a + b, 0), 1, 1e-3, "area");
});
test("LIF: firing rate matches the closed form", () => {
  const dt = 1e-5, tau = 0.02, I = 1.5, n = 1 << 18, s = T.lifSpikes(new Float64Array(n).fill(I), dt, tau), rate = s.reduce((a, b) => a + b, 0) / (n * dt);
  near(rate / T.lifRate(I, tau), 1, 0.01, "rate");
  assert.equal(T.lifSpikes(new Float64Array(1000).fill(0.9), dt, tau).reduce((a, b) => a + b, 0), 0, "no spikes below threshold");
});
test("film, enzyme and sensor against one curve: fit quality on the measured data", { skip: needs("kodak5219") }, () => {
  const C = T.filmCurves().curves, table = {};
  for (const c of ["R", "G", "B"]) {
    const rows = C[c].filter((_, i) => i % 3 === 0);
    table[c] = T.fitResponse(rows);
    const span = Math.max(...rows.map((r) => r[1])) - Math.min(...rows.map((r) => r[1]));
    assert.ok(table[c].hill.rms < 0.05 * span, `${c}: Hill rms ${table[c].hill.rms} of span ${span}`);
    const ys = T.shuffle(rows.map((r) => r[1]), 5), shuffled = T.fitResponse(rows.map((r, i) => [r[0], ys[i]]));
    assert.ok(shuffled.hill.rms > 5 * table[c].hill.rms, "shuffled density cannot fit");
  }
  fs.mkdirSync(process.env.TRANSDUCERS_OUT || os.tmpdir(), { recursive: true });
  fs.writeFileSync(path.join(process.env.TRANSDUCERS_OUT || os.tmpdir(), "film-curve-fits.json"), JSON.stringify(table, null, 1));
});
test("the shared curve has a limit: a clipped photosite is not a Hill curve", () => {
  const FW = 1000, rows = Array.from({ length: 80 }, (_, i) => { const lx = i / 20 + 0.5; return [lx, Math.log10(T.sensorResponse(10 ** lx, FW))]; }), lin = rows.map((r) => [r[0], 10 ** r[1]]), f = T.fitResponse(lin);
  assert.ok(f.hill.rms / FW > 0.002, "linear with a corner misfits a logistic in log x: " + f.hill.rms / FW);
});

test("the cable decays as exp(-x / lambda) from a point source", () => {
  const n = 1024, dx = 1e-3, lam = 0.02, I = new Float64Array(n); I[512] = 1;
  const o = T.run(T.cable(lam, dx, 1e3), T.seq("i", I, "A"));
  const ratio = o.values[512 + 40] / o.values[512];
  near(ratio, Math.exp(-40 * dx / lam), 0.02, "decay");
  assert.equal(o.row.measured, "embedding");
});
test("Hodgkin-Huxley: rest holds, a strong step fires at the textbook rate, and the output is marked from memory", () => {
  const dt = 0.01, n = 20000, rest = T.hhTrace(new Float64Array(n), dt);
  near(rest[n - 1], -65, 0.2, "rest");
  const v = T.hhTrace(new Float64Array(n * 2).fill(10), dt), s = T.spikesOf(v), r = (s.reduce((a, b) => a + b, 0) / (2 * n * dt)) * 1000;
  assert.ok(r > 50 && r < 90, "about 68 Hz at 10 uA/cm2 (from memory): " + r);
  assert.ok(Math.max(...v) > 20 && Math.max(...v) < 60, "peak");
  const o = T.run(T.hh(dt), T.seq("I", new Float64Array(5000).fill(10), "1"));
  assert.equal(o.prov.status, "from_memory");
  assert.equal(o.unit.name, "V");
});
test("Hodgkin-Huxley spikes stop below rheobase", () => {
  const dt = 0.01, s = T.spikesOf(T.hhTrace(new Float64Array(40000).fill(2), dt));
  assert.ok(s.reduce((a, b) => a + b, 0) <= 1, "a single onset spike at most at 2 uA/cm2");
});

test("Turing: pattern above the closed-form threshold, none below, at the predicted wavelength", () => {
  const A = 4.5, Du = 2, Dv = 16, N = 64, Bc = T.turingThreshold(A, Du, Dv), run = (B, steps) => T.turing({ A, B, Du, Dv, dt: 0.01, steps }).forward(T.grid("x", N, N, T.brusselatorInit(N, A, B), "1", { components: 2 })).values;
  const u = (v) => Float64Array.from({ length: N * N }, (_, i) => v[2 * i]);
  const below = T.dominantWavelength(u(run(Bc * 0.85, 6000)), N), above = T.dominantWavelength(u(run(Bc * 1.15, 6000)), N);
  assert.ok(below.amp < 1e-2, "below threshold decays " + below.amp);
  assert.ok(above.amp > 0.1, "above threshold grows " + above.amp);
  near(above.wavelength / T.turingWavelength(A, Du, Dv), 1, 0.2, "wavelength");
});
test("phyllotaxis: the golden angle's neighbours are Fibonacci; a shuffled control is not", () => {
  const n = 500, idx = T.seq("k", Float64Array.from({ length: n }, (_, i) => i + 1)), o = T.run(T.phyllotaxis(), idx);
  assert.equal(o.row.measured, "embedding");
  const a = T.fibonacciShare(T.neighbourDiffs(o.values)), xy = o.values, order = T.shuffle(Array.from({ length: n }, (_, i) => i), 3), sh = new Float64Array(2 * n);
  order.forEach((j, i) => { sh[2 * i] = xy[2 * j]; sh[2 * i + 1] = xy[2 * j + 1]; });
  assert.ok(a > 0.95, "golden " + a);
  assert.ok(T.fibonacciShare(T.neighbourDiffs(sh)) < 0.2, "shuffled");
  near(T.GOLDEN_ANGLE, 137.5078, 1e-3);
});

test("machine: a linear probe reads XOR from the hidden layer and not from the raw input, on held-out data", () => {
  const m = T.trainTiny({ seed: 1 }), test2 = T.xorData(400, 8, 2, "heldout"), train = T.xorData(400, 8, 1);
  assert.ok(T.modelAcc(m, test2) > 0.95, "model " + T.modelAcc(m, test2));
  const raw = T.fitProbe(train.X, train.y, 400, 8), a = T.probePredict(raw, test2.X, 400).filter((p, i) => p === test2.y[i]).length / 400;
  near(a, 0.5, 0.1, "XOR is out of reach for a linear read of the input");
  const hTr = T.hiddenLayer(m, train.X, 400), hTe = T.hiddenLayer(m, test2.X, 400), pr = T.fitProbe(hTr, train.y, 400, m.H), b = T.probePredict(pr, hTe, 400).filter((p, i) => p === test2.y[i]).length / 400;
  assert.ok(b > 0.9, "hidden probe " + b);
});
test("machine: a neuron and a photosite share one ledger", () => {
  const m = T.trainTiny({ seed: 1 }), D = T.xorData(400, 8, 2, "heldout"), f = T.grid("bits", 400, 8, D.X), h = T.run(T.neuronLayer(m), f);
  const train = T.xorData(400, 8, 1), pr = T.fitProbe(T.hiddenLayer(m, train.X, 400), train.y, 400, m.H), p = T.run(T.probeKernel(pr, D.y), h);
  const r = T.chain(f, [T.neuronLayer(m), T.probeKernel(pr, D.y)], { grain: 1 });
  assert.deepEqual(Object.keys(r.rows[1]).sort(), Object.keys(T.chain(T.seq("x", new Float64Array(8)), [T.mirror(1)], {}).rows[1]).sort());
  assert.ok(r.rows[1].bitsLost >= 0 && p.row.bitsLost > 0);
  assert.ok(T.condBitsPerLabel(D.y, p.values) < 0.5);
});
test("planted: a probe that reads nothing fails its shuffled control", () => {
  const D = T.xorData(400, 8, 2, "heldout"), n = 400, f = T.grid("bits", n, 8, D.X), blind = { w: new Float64Array(8), b: 1, d: 8 };
  refuses(() => T.run(T.probeKernel(blind, D.y), f), "ClaimError");
});

const SC = { match: 1, mismatch: -1, gap: -1 };
test("one DP solver gives the textbook Needleman-Wunsch answer", () => {
  assert.equal(T.needlemanWunsch("GCATGCG", "GATTACA", SC).score, 0, "textbook example");
  const r = T.rng(1, "brute");
  for (let i = 0; i < 40; i++) { const a = T.randomDNA(1 + Math.floor(r() * 6), i, "a"), b = T.randomDNA(1 + Math.floor(r() * 6), i, "b"); assert.equal(T.needlemanWunsch(a, b, SC).score, T.bruteGlobal(a, b, SC), a + "/" + b); }
});
test("the same solver gives the textbook Smith-Waterman answer", () => {
  const r = T.smithWaterman("TGTTACGG", "GGTTGACTA", { match: 3, mismatch: -3, gap: -2 });
  assert.equal(r.score, 13);
  assert.equal(r.A.replace(/-/g, ""), "GTTAC");
  const k = T.smithWaterman("AAAA", "TTTT", SC);
  assert.equal(k.score, 0, "nothing in common scores nothing");
});
test("align kernel on a mutated read beats the same read shuffled", () => {
  const d = T.demoDNA(), o = T.run(d.kernels[0], d.src), sh = T.run(T.alignKernel(d.ref, { match: 2, mismatch: -1, gap: -2 }, { local: true }), T.dna("shuffled", T.shuffle(Array.from(d.src.values), 3).join("")));
  assert.ok(o.rep.score > 2 * sh.rep.score, `${o.rep.score} vs ${sh.rep.score}`);
});
const widths = (n, seed) => { const r = T.rng(seed, "w"); return Array.from({ length: n }, () => Math.round(300000 + r() * 500000)); };
test("Knuth-Plass on the same solver: breaks are in order and the kernel prices them", () => {
  const f = T.seq("words", Float64Array.from(widths(60, 1))), o = T.run(T.lineBreak(9000000), f);
  assert.ok(o.values.length >= 3);
  o.values.forEach((v, i) => i && assert.ok(v > o.values[i - 1]));
});
const PY = `
import sys, json
sys.path.insert(0, sys.argv[1])
from engine.breaker import Box, Glue, Penalty, Params, break_lines
d = json.load(sys.stdin); out = []
for c in d:
    it = []
    for x in c["items"]:
        if x["t"] == "b": it.append(Box(x["w"]))
        elif x["t"] == "g": it.append(Glue(x["w"], x["st"], x["sh"]))
        elif x["t"] == "f": it.append(Glue(0, 1, 0, 1))
        else: it.append(Penalty(x["w"], x["p"], bool(x["fl"])))
    r = break_lines(it, c["width"], Params(pretolerance=-1, tolerance=c["tolerance"]))
    out.append({"breaks": r.breaks, "demerits": r.demerits})
print(json.dumps(out))
`;
test("agreement with the BuildLang typesetter's Python breaker on synthetic paragraphs", { skip: T.typesetPath() ? false : "TRANSDUCERS_TYPESET not set" }, () => {
  const cases = []; for (let s = 1; s <= 40; s++) { const w = widths(30 + (s % 50), s), width = 7000000 + s * 137000; cases.push({ items: T.paragraphItems(w), width, tolerance: 200, words: w }); }
  const res = JSON.parse(cp.execFileSync("python", ["-B", "-c", PY, T.typesetPath()], { input: JSON.stringify(cases), encoding: "utf8", maxBuffer: 1 << 26 }));
  let same = 0, diff = [];
  cases.forEach((c, i) => { const r = T.knuthPlass(c.items, c.width, { tolerance: 200 }); if (r.feasible && JSON.stringify(r.breaks) === JSON.stringify(res[i].breaks) && r.demerits === res[i].demerits) same++; else diff.push({ i, ours: [r.demerits, r.breaks.length], py: [res[i].demerits, res[i].breaks.length] }); });
  fs.writeFileSync(path.join(process.env.TRANSDUCERS_OUT || os.tmpdir(), "kp-agreement.json"), JSON.stringify({ same, total: cases.length, diff }, null, 1));
  assert.ok(same >= 36, `${same} of ${cases.length} agree; first differences ${JSON.stringify(diff.slice(0, 3))}`);
});
test("agreement with the compiled BuildLang breaker, run from a temp folder and left unedited", { skip: T.typesetPath() && fs.existsSync(path.join(T.typesetPath(), "kp", "knuth_plass.exe")) ? false : "no compiled BuildLang breaker bound" }, () => {
  const exe = path.join(T.typesetPath(), "kp", "knuth_plass.exe"), dir = fs.mkdtempSync(path.join(os.tmpdir(), "kp-")); let same = 0;
  const text = (it, width) => [`w ${width}`, "t 200"].concat(it.map((x) => (x.t === "b" ? `b ${x.w}` : x.t === "f" ? `f ${x.w}` : x.t === "g" ? `g ${x.w} ${x.st} ${x.sh}` : `p ${x.w} ${x.p} ${x.fl}`))).join("\n") + "\n";
  for (let s = 1; s <= 12; s++) {
    const it = T.paragraphItems(widths(30 + s * 3, s)), width = 7000000 + s * 137000, r = T.knuthPlass(it, width, { tolerance: 200 });
    fs.writeFileSync(path.join(dir, "items.txt"), text(it, width));
    cp.execFileSync(exe, [], { cwd: dir, stdio: "ignore" });
    const L = fs.readFileSync(path.join(dir, "breaks.txt"), "utf8").trim().split(/\s+/), dem = +L[L.length - 1], br = L.slice(0, -2).map(Number);
    if (dem === r.demerits && JSON.stringify(br) === JSON.stringify(r.breaks)) same++;
  }
  assert.equal(same, 12);
});

test("k-mer: counts sum to n - k + 1; a planted word stands out and its shuffled control does not", () => {
  const base = T.randomDNA(2000, 3), s = T.plantMotif(base, "GATTACAGA", 50), o = T.run(T.kmer(4), T.dna("s", s));
  assert.equal(o.values.reduce((a, b) => a + b, 0), s.length - 3);
  const z = T.spectrumZ(s, 8, 1, 60), c = T.spectrumZ(T.shuffle(Array.from(s), 9), 8, 1, 60);
  assert.ok(z.z > 10, "planted z " + z.z);
  assert.ok(z.word.includes("GATTA") || z.word.includes("TTACA"), z.word);
  assert.ok(c.z < z.z / 2, "control z " + c.z);
});
test("the DNA-word spectrum finds a planted period; a shuffled copy has no peak", () => {
  const s = T.plantMotif(T.randomDNA(4096, 4), "GGGGGG", 64), a = T.peakPeriod(T.indicatorSpectrum(s)), b = T.peakPeriod(T.indicatorSpectrum(T.shuffle(Array.from(s), 5)));
  near(a.period % 64 === 0 ? 64 : a.period, 64, 33, "period family");
  assert.ok(a.snr > 3 * b.snr, `${a.snr} vs ${b.snr}`);
});
test("PWM: a fixed column holds 2 bits, a uniform one 0, and shuffling columns collapses the motif", () => {
  const f = T.sitesGrid(["AAC", "AGC", "ATC", "ACC"]), o = T.run(T.pwm(), f), col = (k) => o.values[k * 4] + o.values[k * 4 + 1] + o.values[k * 4 + 2] + o.values[k * 4 + 3];
  near(col(0), 2, 1e-12); near(col(1), 0, 1e-12); near(col(2), 2, 1e-12);
  const r = T.rng(7, "sites"), sites = Array.from({ length: 200 }, () => (r() < 0.95 ? "TATAAT" : T.randomDNA(6, Math.floor(r() * 1e6)))), real = T.motifBits(T.run(T.pwm(), T.sitesGrid(sites))), all = T.shuffle(Array.from(sites.join("")), 8).join(""), sh = Array.from({ length: 200 }, (_, i) => all.slice(i * 6, i * 6 + 6));
  assert.ok(real > 8, "planted " + real);
  assert.ok(T.motifBits(T.run(T.pwm(), T.sitesGrid(sh))) < real / 2, "shuffled keeps only the composition");
});
const tree4 = { left: { left: { leaf: 0 }, right: { leaf: 1 }, tl: 0.1, tr: 0.2 }, right: { left: { leaf: 2 }, right: { leaf: 3 }, tl: 0.15, tr: 0.05 }, tl: 0.1, tr: 0.1 };
test("Felsenstein: two taxa give the Jukes-Cantor closed form; pruning equals brute force", () => {
  const t = { left: { leaf: 0 }, right: { leaf: 1 }, tl: 0.1, tr: 0.2 }, d = 0.3, same = 0.25 * (0.25 + 0.75 * Math.exp((-4 * d) / 3));
  near(T.siteLikelihood(t, "AA"), same, 1e-12); near(T.siteLikelihood(t, "AC"), 0.25 * (0.25 - 0.25 * Math.exp((-4 * d) / 3)), 1e-12);
  for (const s of ["AAAA", "ACGT", "AATT", "GGGC"]) near(T.siteLikelihood(tree4, s), T.bruteLikelihood(tree4, s), 1e-14, s);
  let sum = 0; for (const a of "ACGT") for (const b of "ACGT") for (const c of "ACGT") for (const e of "ACGT") sum += T.siteLikelihood(tree4, a + b + c + e);
  near(sum, 1, 1e-12, "site patterns sum to one");
});
test("Felsenstein: a true alignment beats its columns shuffled across taxa", () => {
  const taxa = T.simulateAlignment(tree4, 4, 800, 11), g = T.grid("aln", 4, 800, Array.from(taxa.join("")), "symbol", { rep: { kind: "digital", encoding: "symbol" } }), real = T.run(T.felsenstein(tree4), g).values.reduce((a, b) => a + b, 0);
  const sh = taxa.map((s, i) => T.shuffle(Array.from(s), 20 + i).join("")), g2 = T.grid("sh", 4, 800, Array.from(sh.join("")), "symbol", { rep: { kind: "digital", encoding: "symbol" } }), ctrl = T.run(T.felsenstein(tree4), g2).values.reduce((a, b) => a + b, 0);
  assert.ok(real < 0.8 * ctrl, `${real} vs ${ctrl} bits`);
});
