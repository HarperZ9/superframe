// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Known-answer tests for perceive, written before the library.
   node tests/known.test.js [--json out.json]   exit 1 if any check fails or any planted wrong value is accepted.

   Each block compares a computed value with an analytic or published one, then plants one wrong value and
   requires the same comparison to reject it, so a check that accepts anything fails. */
"use strict";
const fs = require("fs");
const P = require("../src/index.js");
const N = require("../../ndim/src/index.js");

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
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
const close = (a, b, tol) => rel(a, b) <= tol;
const fmt = (x) => Number(x).toPrecision(6);

/* 1. Light: Wien's law from the Planck curve, then the shifted hue. */
function light() {
  for (const T of [300, 3000, 5772, 10000]) {
    const peak = P.wienPeak(T), want = P.C.wienB / T;
    check("Wien peak of Planck curve, T=" + T + " K", close(peak, want, 1e-4), `argmax ${fmt(peak)} m, b/T ${fmt(want)} m`);
  }
  // 300 K peaks near 9.66 um. Window 3 to 30 um, log, into 380 to 750 nm linear (long stays red).
  const src = P.window(3e-6, 30e-6, "log"), dst = P.window(380, 750, "linear"), br = P.bridge(src, dst);
  const lam = br.map(P.wienPeak(300)), want = 380 + 370 * Math.log(P.C.wienB / 300 / 3e-6) / Math.log(10);
  check("300 K peak lands at the analytic shifted wavelength", Math.abs(lam - want) < 0.05, `${fmt(lam)} nm vs ${fmt(want)} nm`);
  const hue = P.hueAngle(P.spectralRgb(lam).rgb), name = P.hueName(hue);
  check("shifted 300 K peak shows as yellow-green", name === "yellow-green", `hue ${hue.toFixed(1)} deg, ${name}`);
  planted("300 K peak shown at 450 nm (blue)", Math.abs(lam - 450) < 0.05, `${fmt(lam)} nm`);
  // The Sun (5772 K) peaks inside the visible band with the identity window: no shift, and hue is green-cyan to green.
  const sun = P.wienPeak(5772) * 1e9;
  check("Sun's peak sits in the visible band unshifted", sun > 480 && sun < 520, `${fmt(sun)} nm`);
  // Hue sanity: sodium D is orange-yellow, hydrogen alpha is red.
  check("sodium D (589 nm) reads as orange or yellow", ["orange", "yellow"].includes(P.hueName(P.hueAngle(P.spectralRgb(589).rgb))), P.hueName(P.hueAngle(P.spectralRgb(589).rgb)));
  check("H-alpha (656 nm) reads as red", P.hueName(P.hueAngle(P.spectralRgb(656.28).rgb)) === "red", P.hueName(P.hueAngle(P.spectralRgb(656.28).rgb)));
}

/* 2. Sound: heterodyne output equals |f - f_LO|. */
function heterodyne() {
  const fs = 384000, n = 1 << 15;
  for (const [f, lo] of [[55000, 45000], [40000, 45000], [83000, 80000]]) {
    const y = P.heterodyne(P.tone(f, fs, n), fs, lo, 15000).slice(4096);
    const got = P.peakFrequency(y, fs), want = Math.abs(f - lo);
    check(`heterodyne ${f / 1000} kHz with LO ${lo / 1000} kHz`, Math.abs(got - want) < 20, `peak ${got.toFixed(1)} Hz, |f-LO| ${want} Hz`);
    if (f === 55000) planted("heterodyne output at f + LO (100 kHz)", Math.abs(got - (f + lo)) < 20, `peak ${got.toFixed(1)} Hz`);
  }
  // The bat call's quasi-constant tail (45 kHz) with LO 40 kHz is heard at 5 kHz.
  const call = P.batCall(fs, { f0: 75000, f1: 45000, sweepMs: 3, cfMs: 20 });
  const tail = P.heterodyne(call, fs, 40000, 15000).slice(Math.round(fs * 0.008), Math.round(fs * 0.02));
  const got = P.peakFrequency(tail, fs);
  check("bat call tail 45 kHz, LO 40 kHz, heard at 5 kHz", Math.abs(got - 5000) < 100, `peak ${got.toFixed(0)} Hz`);
}

/* 3. Map and inverse round-trip wherever the map is invertible. */
function roundTrip() {
  const cases = [
    ["EM wavelength log into visible linear", P.window(1e-7, 1e-3, "log"), P.window(380, 750, "linear"), [2e-7, 5e-6, 9e-4]],
    ["EM into visible, CIE perceptual spacing", P.window(1e-7, 1e-3, "log"), P.window(380, 750, "cie"), [2e-7, 5e-6, 9e-4]],
    ["ultrasound log into audible log", P.window(20000, 200000, "log"), P.window(20, 20000, "log"), [25000, 61000, 199000]],
    ["infrasound linear into audible mel", P.window(0.01, 20, "linear"), P.window(20, 20000, "mel"), [0.02, 3.3, 19.5]],
    ["radio log into audible mel, reversed", P.window(1e6, 1e9, "log"), P.window(20, 20000, "mel"), [2e6, 7.7e7, 9e8], true],
  ];
  for (const [name, s, d, xs, flip] of cases) {
    const br = P.bridge(s, d, flip);
    const worst = Math.max(...xs.map((x) => rel(br.inverse(br.map(x)), x)));
    check("round trip: " + name, worst < 1e-9, `worst relative error ${worst.toExponential(2)}`);
  }
  const s = P.ellipseToStokes(0.4, -0.2), back = P.jonesToStokes(...P.stokesToJones(s));
  const err = Math.max(...s.map((v, i) => Math.abs(v - back[i])));
  check("round trip: Stokes to Jones to Stokes", err < 1e-12, `max error ${err.toExponential(2)}`);
  const br = P.bridge(P.window(1e-7, 1e-3, "log"), P.window(380, 750, "linear"));
  planted("a value outside the window round-trips", br.contains(5e-2) && rel(br.inverse(br.map(5e-2)), 5e-2) < 1e-9, "5 cm is outside 100 nm to 1 mm");
}

/* 4. Loss reporter: 0 bits for an identity map, more than 0 for a projection. */
function loss() {
  const r = P.rng(7), xs = [];
  for (let i = 0; i < 4000; i++) xs.push([Math.floor(r() * 8), Math.floor(r() * 8), Math.floor(r() * 8)]);
  const id = P.lossBits(xs, (x) => x), proj = P.lossBits(xs, (x) => [x[0], x[1]]);
  check("identity map loses 0 bits", id.bitsLost === 0, `H(X) ${id.bitsSource.toFixed(3)}, lost ${id.bitsLost}`);
  check("dropping the phase knob loses about 3 bits", proj.bitsLost > 2.5 && proj.bitsLost <= 3.0001, `lost ${proj.bitsLost.toFixed(3)} bits`);
  planted("projection reported as lossless", proj.bitsLost === 0, `lost ${proj.bitsLost.toFixed(3)}`);
  const all = P.knobsReport(["amplitude", "frequency"]);
  check("knob report names the dropped knobs", all.dropped.includes("phase") && all.dropped.includes("polarisation"), all.dropped.join(", "));
  // A wide window squeezed into the visible band loses bits to hue discrimination; a narrow one keeps more.
  const wide = P.windowLoss(P.window(1e-7, 1e-3, "log"), P.window(380, 750, "linear"), 1e-7, 1e-3);
  const narrow = P.windowLoss(P.window(1e-6, 2e-6, "log"), P.window(380, 750, "linear"), 1e-6, 2e-6);
  check("wide window loses more than a narrow one", wide.bitsLost > narrow.bitsLost, `wide ${wide.bitsLost.toFixed(2)}, narrow ${narrow.bitsLost.toFixed(2)} bits`);
}

/* 5. Electricity: point-charge potential and a dipole's zero midplane. */
function electricity() {
  const v = P.potential([{ x: 0, y: 0, q: 1e-9 }], 1, 0);
  // CODATA 2022: ke = 1 / (4 pi eps0) = 8.9875517862e9 N m^2 C^-2. CODATA 2018 gave 8.9875517923e9 (planted below).
  check("1 nC at 1 m gives k q / r = 8.9875517862 V (CODATA 2022)", close(v, 8.9875517862, 1e-10), `${fmt(v)} V`);
  planted("the CODATA 2018 Coulomb constant (8.9875517923 V)", close(v, 8.9875517923, 1e-10), `${v} V`);
  const d = P.potential([{ x: -1, y: 0, q: 1e-9 }, { x: 1, y: 0, q: -1e-9 }], 0, 3.7);
  check("dipole midplane sits at 0 V", Math.abs(d) < 1e-12, `${d.toExponential(2)} V`);
  const v2 = P.potential([{ x: 0, y: 0, q: 1e-9 }], 2, 0);
  planted("potential falls as 1/r^2", close(v2, v / 4, 1e-6), `V(2)/V(1) = ${(v2 / v).toFixed(4)}`);
}

/* 6. Magnetism: Biot-Savart on a long straight wire falls as 1/r. */
function magnetism() {
  const B = (r) => Math.hypot(...P.biotSavart(1, [0, 0, -1000], [0, 0, 1000], [r, 0, 0], 200000));
  const b1 = B(1), b2 = B(2), b4 = B(4);
  check("wire field at 1 m, 1 A equals mu0 I / 2 pi r = 2e-7 T", close(b1, 2e-7, 1e-4), `${fmt(b1)} T`);
  check("B r is constant (1/r falloff)", close(b2 * 2, b1, 1e-4) && close(b4 * 4, b1, 1e-4), `B r: ${fmt(b1)}, ${fmt(2 * b2)}, ${fmt(4 * b4)}`);
  planted("wire field falls as 1/r^2", close(b2, b1 / 4, 1e-3), `B(2)/B(1) = ${(b2 / b1).toFixed(4)}`);
  const w = P.wireB([{ x: 0, y: 0, I: 1 }], 1, 0);
  check("2D wire field matches Biot-Savart", close(Math.hypot(...w), b1, 1e-4), `${fmt(Math.hypot(...w))} T`);
}

/* 7. Polarisation: circular light sits on a pole of the Poincare sphere. */
function polarisation() {
  const s = 1 / Math.sqrt(2);
  const circ = P.poincare(P.jonesToStokes([s, 0], [0, s]));
  check("circular (1, i)/sqrt2 sits on the north pole", Math.abs(circ[2] - 1) < 1e-12, `S3/S0 ${circ[2]}`);
  const horiz = P.poincare(P.jonesToStokes([1, 0], [0, 0]));
  check("horizontal linear sits on the equator at S1 = 1", Math.abs(horiz[0] - 1) < 1e-12 && Math.abs(horiz[2]) < 1e-12, horiz.join(", "));
  planted("horizontal linear sits on the pole", Math.abs(Math.abs(horiz[2]) - 1) < 1e-6, `S3/S0 ${horiz[2]}`);
  const e = P.stokesToEllipse(P.jonesToStokes([s, 0], [s, 0]));
  check("diagonal linear has orientation 45 degrees", Math.abs(e.psi - Math.PI / 4) < 1e-12, `${(e.psi * 180 / Math.PI).toFixed(6)} deg`);
}

/* 8. Heat: a Gaussian spreads with variance sigma^2 + 2 D t. */
function heat() {
  const dx = 0.1, D = 0.5, dt = 0.004, t = 2, xs = [], u = [];
  for (let x = -30; x <= 30 + 1e-9; x += dx) { xs.push(x); u.push(Math.exp(-x * x / 2)); }
  const v = P.diffuse1D(u, D, dx, dt, Math.round(t / dt));
  let m0 = 0, m2 = 0;
  v.forEach((y, i) => { m0 += y; m2 += y * xs[i] * xs[i]; });
  const varr = m2 / m0;
  check("diffused variance equals 1 + 2 D t = 3", close(varr, 3, 0.01), `${fmt(varr)}`);
  planted("diffused variance equals 1 + D t = 2", close(varr, 2, 0.01), `${fmt(varr)}`);
}

/* 9. Geometry: Gaussian curvature of a sphere is 1/R^2; a torus's outer equator is 1/(r (R + r)). */
function geometry() {
  const R = 2, f = P.surfaces.sphere(R);
  const ks = [[0.3, 0.7], [2.1, 1.4], [4.0, 2.2]].map(([u, v]) => P.curvature(f, u, v).K);
  const worst = Math.max(...ks.map((k) => rel(k, 1 / (R * R))));
  check("sphere R = 2 has K = 1/R^2 = 0.25", worst < 1e-5, ks.map(fmt).join(", "));
  planted("sphere has K = 1/R = 0.5", ks.every((k) => close(k, 1 / R, 1e-3)), ks.map(fmt).join(", "));
  const t = P.curvature(P.surfaces.torus(3, 1), 0.5, 0).K;
  check("torus R=3 r=1 outer equator K = 1/4", close(t, 0.25, 1e-5), fmt(t));
  const ti = P.curvature(P.surfaces.torus(3, 1), 0.5, Math.PI).K;
  check("torus inner equator K = -1/2", close(ti, -0.5, 1e-5), fmt(ti));
}

/* 10. Dimensionality, through ndim: a tesseract's shadow loses exactly 1 bit; carrying w in colour keeps it. */
function dimensionality() {
  const T = N.polytope("cube", 4);
  const plain = P.dimBridge(N, T, [], { w: "none" }), coloured = P.dimBridge(N, T, [], { w: "colour" });
  check("tesseract shadow in xyz loses 1 bit (16 corners on 8 points)", Math.abs(plain.loss.bitsLost - 1) < 1e-12, `${plain.loss.bitsLost} bits`);
  check("w carried as hue: 0 bits lost", coloured.loss.bitsLost === 0, `${coloured.loss.bitsLost} bits`);
  planted("the plain shadow is lossless", plain.loss.bitsLost === 0, `${plain.loss.bitsLost} bits`);
  const vol = N.sliceVolume(T, null, [0, 0, 0, 1], 0);
  check("slice of the tesseract at w = 0 is a cube of volume 8 (ndim)", close(vol, 8, 1e-9), fmt(vol));
  const ch = P.channel("sound", 2), w = 0.37;
  check("w to pitch and back round-trips", rel(ch.inverse(ch.map(w)), w) < 1e-12, `${ch.map(w).toFixed(3)} Hz`);
}

/* 11. Haptics and registry. */
function misc() {
  const pat = P.haptic([0, 0.5, 1], { pulseMs: 80, gapMs: 40 });
  check("haptic pattern: louder value, longer pulse", pat.length === 6 && pat[0] < pat[2] && pat[2] < pat[4], pat.join(","));
  const ids = P.BRIDGES.map((b) => b.id);
  for (const need of ["light", "sound", "electricity", "magnetism", "polarisation", "heat", "geometry", "dimensionality"])
    check("registry has the " + need + " bridge", ids.includes(need), ids.join(","));
  check("every bridge states quantity, units, geometry, map, keeps, loses, plain, test",
    P.BRIDGES.every((b) => ["quantity", "units", "geometry", "map", "keeps", "loses", "plain", "test"].every((k) => b[k] && String(b[k]).length)), "");
}

const t0 = Date.now();
[light, heterodyne, roundTrip, loss, electricity, magnetism, polarisation, heat, geometry, dimensionality, misc].forEach((f) => f());
out.ms = Date.now() - t0;
console.log(`${out.pass} pass, ${out.fail} fail; planted wrong values: ${out.planted_rejected} rejected, ${out.planted_accepted} accepted; ${out.ms} ms`);
const j = process.argv.indexOf("--json");
if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(out, null, 1));
process.exit(out.fail || out.planted_accepted ? 1 : 0);
