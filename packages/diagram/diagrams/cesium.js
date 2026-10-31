// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Cesium beam frequency standard (HP 5060A class). Sources: HP-GAPS.md section 2, HP-GAPS-PRIMARY.md section 2. */
(function (g) {
  "use strict";
  const D = g.Diagram;
  const F_CS = 9192631770, F_Q = 5e6, L_M = 0.15, V0 = 200, NAT = 64, SERVO_S = 12, TAU_S = 2.4, D0 = 420, MOD = 0.25;
  const T0 = L_M / V0, FWHM = 1 / (2 * T0);
  const part = (o) => Object.assign({ material: "electronics" }, o);
  const pole = (x, s) => ({ t: "group", items: [{ t: "box", size: [0.9, 0.34, 0.8], pos: [x, 0.42 * s, 0] }, { t: "box", size: [0.9, 0.34, 0.8], pos: [x, -0.42 * s, 0] }] });
  const rnd = D.rng(5060), atoms = Array.from({ length: NAT }, (_, i) => ({ v: 0.55 + 0.9 * (rnd() + rnd()) / 2, ph: rnd() * 9, F: rnd() < 0.5 ? 3 : 4, r: rnd(), z: (rnd() - 0.5) * 0.2, i }));
  /* Ramsey fringe for one atom at speed v (in units of V0), detuning d in Hz: P = (1 + cos(2 pi d T)) / 2, T = L / v. */
  const Pflip = (d, v) => 0.5 * (1 + Math.cos(2 * Math.PI * d * (T0 / v)));
  const Pmean = (d) => { let s = 0; for (const a of atoms) s += Pflip(d, a.v); return s / atoms.length; };
  const delta = (sec) => D0 * Math.exp(-sec / TAU_S);

  const def = {
    id: "cesium", title: "Cesium beam tube", region: "archive", file: "cesium-beam.html", super: "Cs",
    message: "Atoms flip state only at 9 192 631 770 Hz, so the instrument keeps steering its quartz to wherever the most atoms flip.",
    lede: "A cutaway beam tube with its oven, state-selecting magnets, Ramsey cavity and detector, atoms in flight, and the servo that tunes the quartz until the flips peak.",
    camera: { yaw: 0.35, pitch: 0.38, zoom: 2.3 }, cut: { axis: "z", d: 0 }, startU: 0.3, playSeconds: 30,
    parts: [
      part({ id: "tube", label: "Vacuum envelope", alt: "A long steel tube, cut open to show the beam inside.", fn: "Holds the vacuum so atoms fly without collisions.", material: "steel", geom: { t: "tube", r: 1.0, r0: 0.93, h: 10.6, axis: "x", seg: 40 }, pos: [0.2, 0, 0], explode: { axis: [0, 1, 0], dist: 2.4 }, noSchematic: true }),
      part({ id: "oven", label: "Cesium oven", short: "Oven", alt: "A small cylinder at the left end with a nozzle: the oven.", fn: "Warms cesium-133 so a thin beam of atoms leaves the nozzle.", qty: "about 370 K (illustrative); Cs vapour", material: "nickel", geom: { t: "group", items: [{ t: "cyl", r: 0.4, h: 0.8, axis: "x" }, { t: "cyl", r: 0.09, h: 0.4, axis: "x", pos: [0.6, 0, 0] }] }, pos: [-4.4, 0, 0], explode: { axis: [-1, 0, 0], dist: 1.4 } }),
      part({ id: "amag", label: "A magnet (state selector)", short: "A magnet", alt: "Two iron pole pieces above and below the beam near the oven.", fn: "Its strong uneven field bends atoms by hyperfine state, so only one state reaches the cavity.", qty: "passes F = 3", material: "iron", geom: pole(0, 1), pos: [-2.6, 0, 0], explode: { axis: [0, 0, 1], dist: 2 } }),
      part({ id: "cfield", label: "C-field coil", short: "C-field", alt: "A thin copper sleeve around the cavity region.", fn: "A weak steady field that moves the field-sensitive Zeeman lines away from the clock line.", material: "copper", geom: { t: "tube", r: 0.86, r0: 0.81, h: 3.6, axis: "x", seg: 40 }, pos: [0, 0, 0], explode: { axis: [0, 1, 0], dist: 1.4 } }),
      part({ id: "cavity", label: "Ramsey cavity", short: "Ramsey cavity", alt: "A U-shaped copper waveguide whose two arms cross the beam.", fn: "Two separated kicks of microwaves; the flight time T between them sets the line width, about 1 / (2T).", qty: "9 192 631 770 Hz drive", material: "copper", geom: { t: "extrude", profile: [[-1.4, -0.55], [-1.0, -0.55], [-1.0, 0.35], [1.0, 0.35], [1.0, -0.55], [1.4, -0.55], [1.4, 0.7], [-1.4, 0.7]], depth: 0.5 }, pos: [0, 0, 0], explode: { axis: [0, 0, 1], dist: 2.6 } }),
      part({ id: "bmag", label: "B magnet (analyser)", short: "B magnet", alt: "A second pair of iron pole pieces after the cavity.", fn: "Bends the atoms that flipped toward the detector and the rest away.", qty: "passes flipped atoms", material: "iron", geom: pole(0, 1), pos: [2.6, 0, 0], explode: { axis: [0, 0, 1], dist: 2 } }),
      part({ id: "ion", label: "Hot-wire ionizer", short: "Ionizer", alt: "A thin tungsten wire across the beam near the right end.", fn: "Strips an electron from each cesium atom that touches it, making an ion.", qty: "about 1100 K (illustrative)", material: "tungsten", geom: { t: "cyl", r: 0.05, h: 0.8, axis: "z", seg: 10 }, pos: [3.85, 0.35, 0], explode: { axis: [0, 1, 0], dist: 1 } }),
      part({ id: "mult", label: "Electron multiplier", short: "Multiplier", alt: "A cone at the right end of the tube.", fn: "Turns each ion into a pulse of many electrons: the ion current.", material: "electronics", geom: { t: "cone", r: 0.32, r2: 0.12, h: 0.8, axis: "x" }, pos: [4.6, 0.35, 0], explode: { axis: [1, 0, 0], dist: 1.4 } }),
      part({ id: "lockin", label: "Lock-in detector", short: "Lock-in", alt: "A box below the tube: the synchronous detector.", fn: "Compares the ion current with the phase modulation; the sign says which side of the peak the quartz sits.", qty: "error with a sign", geom: { t: "box", size: [1.6, 0.7, 1.0] }, pos: [3.6, -2.4, 0], explode: { axis: [0, -1, 0], dist: 1.2 } }),
      part({ id: "integ", label: "Integrator", alt: "A box below the tube: the integrator.", fn: "Sums the error so the quartz is tuned until the error averages to zero.", geom: { t: "box", size: [1.6, 0.7, 1.0] }, pos: [1.2, -2.4, 0], explode: { axis: [0, -1, 0], dist: 1.2 } }),
      part({ id: "quartz", label: "5 MHz quartz oscillator", short: "Quartz", alt: "A box below the tube: the quartz flywheel.", fn: "Keeps time from moment to moment; the atoms only correct its drift.", qty: "5 MHz", geom: { t: "box", size: [1.6, 0.7, 1.0] }, pos: [-1.2, -2.4, 0], explode: { axis: [0, -1, 0], dist: 1.2 } }),
      part({ id: "synth", label: "Synthesiser", alt: "A box below the tube: the frequency synthesiser.", fn: "Multiplies 5 MHz up to the cesium frequency, with a small phase modulation.", qty: "x 1838.526354", geom: { t: "box", size: [1.6, 0.7, 1.0] }, pos: [-3.6, -2.4, 0], explode: { axis: [0, -1, 0], dist: 1.2 } }),
      part({ id: "out", label: "5 MHz output", short: "5 MHz out", alt: "A connector on the front: the disciplined output.", fn: "The quartz signal, now steered by the atoms.", material: "brass", geom: { t: "cyl", r: 0.2, h: 0.6, axis: "z" }, pos: [-1.2, -2.4, 1.0], explode: { axis: [0, 0, 1], dist: 1 } }),
    ],
    links: [
      { from: "oven", to: "amag", label: "Cs beam, 200 m/s" }, { from: "amag", to: "cavity", label: "F = 3 only" }, { from: "cavity", to: "bmag" }, { from: "bmag", to: "ion", label: "flipped atoms" },
      { from: "ion", to: "mult", label: "Cs+ ions" }, { from: "mult", to: "lockin", label: "ion current" }, { from: "lockin", to: "integ", label: "error, signed" },
      { from: "integ", to: "quartz", label: "tuning V" }, { from: "quartz", to: "synth", label: "5 MHz" }, { from: "synth", to: "cavity", label: "9 192 631 770 Hz", back: true }, { from: "quartz", to: "out", label: "5 MHz" },
    ],
    controls: [{ at: "synth", label: "PHASE MOD", bind: "knob-mod", dy: -2 }],
    knobs: [{ id: "knob-mod", label: "Phase modulation", min: 5, max: 60, step: 5, value: 25, unit: "% of line" }],
  };

  def.sim = (model) => {
    const tubeY = 0, inside = (y) => Math.abs(y) < 0.88;
    return {
      duration: () => SERVO_S,
      state: (u, view) => {
        const sec = u * SERVO_S, d = delta(sec), pts = [], fast = u * 900;
        if ((view.explode || 0) < 0.05) for (const a of atoms) {
          const s = (fast * a.v + a.ph) % 9.2, x = -3.9 + s, pass = Math.floor((fast * a.v + a.ph) / 9.2);
          let y = tubeY, F = a.F;
          if (x > -2.6 && a.F === 4) y += 0.5 * (x + 2.6) ** 2;
          if (!inside(y)) continue;
          const flip = D.rng(a.i * 7919 + pass)() < Pflip(d, a.v);
          if (x > 1.2 && a.F === 3 && flip) F = 4;
          if (x > 2.6) y += F === 4 ? 0.35 * Math.min(1, (x - 2.6) / 1.2) : -0.6 * (x - 2.6) ** 2;
          if (!inside(y) || x > 4.3) continue;
          pts.push({ p: [x, y, a.z], r: 2.6, tok: F === 4 ? "s1" : "s2" });
        }
        return { parts: { oven: { temp: 370, emit: 0.15, glow: [0.9, 0.45, 0.2] }, ion: { temp: 1100, emit: 0.55, glow: [1, 0.55, 0.2] }, tube: { temp: 296 }, cavity: { temp: 296 } }, points: pts, flow: Math.sin(fast), readout: { d } };
      },
      trace: (u, view) => {
        const sec = u * SERVO_S, d = delta(sec), m = (((view.knobs && view.knobs["knob-mod"]) || 25) / 100) * FWHM;
        const xs = Float32Array.from({ length: 241 }, (_, i) => -3 * FWHM + (i / 240) * 6 * FWHM), ys = Float32Array.from(xs, Pmean);
        const ts = Float32Array.from({ length: 200 }, (_, i) => (i / 199) * SERVO_S), off = Float32Array.from(ts, delta);
        const err = Float32Array.from(ts, (t) => Pmean(delta(t) - m) - Pmean(delta(t) + m));
        return [
          { title: "Ramsey fringe, averaged over the atoms' speeds; dots: the two sides the modulation probes", x: { min: xs[0], max: xs[240], label: "Hz detuning" }, y: { min: 0, max: 1, label: "P flip" }, cursor: d,
            series: [{ name: "flips", x: xs, y: ys, tok: "ink", width: 2 }, { x: Float32Array.of(d - m, d + m), y: Float32Array.of(Pmean(d - m), Pmean(d + m)), tok: "s1", dots: true, width: 0.01 }] },
          { title: "Quartz offset from the cesium line, as the servo steers it", x: { min: 0, max: SERVO_S, label: "s" }, y: { min: 0, max: D0 * 1.05, label: "Hz" }, cursor: sec, series: [{ name: "offset at 9.19 GHz", x: ts, y: off, tok: "s2", width: 2 }] },
          { title: "Lock-in error: the difference between the two sides, signed", x: { min: 0, max: SERVO_S, label: "s" }, y: { min: Math.min(0, ...err) * 1.1, max: Math.max(0.05, ...err) * 1.1, label: "dP" }, cursor: sec, series: [{ name: "error", x: ts, y: err, tok: "s1", width: 2 }] },
        ];
      },
      spacetime: () => {
        const verts = [], edges = [], timelike = [], edgePart = [], pid = model.index.get("cavity").index;
        for (const a of atoms.slice(0, 28)) {
          if (a.F === 4) continue;
          for (let k = 0; k <= 30; k++) {
            const x = -3.9 + (k / 30) * 8.2, t = (x + 3.9) / a.v + a.ph * 0.4, y = x > 2.6 ? 0.35 * Math.min(1, (x - 2.6) / 1.2) * (a.r < 0.5 ? 1 : -1) : 0;
            verts.push([x, y, a.z, t]);
            if (k) { edges.push([verts.length - 2, verts.length - 1]); timelike.push(1); edgePart.push(pid); }
          }
        }
        return { verts, edges, timelike, edgePart, axes: ["x (along the tube)", "y", "z", "time"], angles: [0, 0, 0.5, 0, 0, 0.3] };
      },
    };
  };
  def.checks = () => {
    let a = 0, b = 2 * FWHM;   /* half maximum of one atom's central fringe, by bisection */
    for (let i = 0; i < 80; i++) { const m = (a + b) / 2; if (Pflip(m, 1) > 0.5) a = m; else b = m; }
    return [{ name: "Ramsey central fringe: full width at half maximum is 1 / (2T)", got: 2 * a, want: FWHM, tol: 1e-9 },
      { name: "link labels compose: 5 MHz x 1838.526354 = 9 192 631 770 Hz", got: F_Q * 1838.526354, want: F_CS, tol: 1e-9 }];
  };
  def.plain = `<p>A quartz crystal keeps good time from second to second but wanders over days. Cesium atoms are all the same, everywhere, forever, and each one will flip between two inner states only when it is hit with microwaves at 9 192 631 770 Hz. So the instrument makes that frequency from its quartz, shines it on a beam of atoms, and counts how many flip. If the count drops, the quartz has wandered; the electronics nudge it back. The quartz keeps the time; the atoms check it.</p>
<p>The tube does this in a line. The oven boils off a thin beam. The first magnet throws away the atoms already in the upper state. The atoms fly through the two arms of the cavity, and the longer they take between the arms, the sharper the frequency they answer to. The second magnet sends only the flipped atoms to the hot wire, which turns them into ions the detector can count. Cut the model open to see the beam inside, and press play to watch the servo pull the quartz in.</p>`;
  def.working = `<p class="math">f_Cs = 9 192 631 770 Hz (the SI second); synthesiser ratio 9 192 631 770 / 5 000 000 = 1838.526354
One atom at speed v: P_flip(delta) = (1 + cos(2 pi delta T)) / 2, T = L / v; central fringe FWHM = 1 / (2T)
L = 0.15 m, v0 = 200 m/s: T = 0.75 ms, FWHM = 667 Hz (illustrative; HP's tube dimensions are not in our sources)
Speeds: 64 atoms, v / v0 = 0.55 + 0.9 x (mean of two uniforms); averaging washes out the side fringes
Servo: quartz offset delta(t) = 420 Hz x exp(-t / 2.4 s); lock-in error = P(delta - m) - P(delta + m), m set by the modulation knob</p>
<p>Simplified: the servo is drawn as a first-order pull-in rather than integrated from the error; the cavity is two ideal pi/2 kicks with no phase difference between the arms; magnet deflections are parabolas, not trajectories in a measured field gradient; the C-field, Zeeman lines and Rabi pedestal are named but not modelled. Atoms in the 3D view move at a fixed slow-motion rate, about 900 flights over the 12 s servo run, so both time scales fit one scrubber. The oven is drawn in nickel because the library has its conductivity; HP's actual oven material is not in our sources. Oven and hot-wire temperatures are illustrative.</p>
<p>From the primary text (HPJ July 1964, read for HP-GAPS-PRIMARY.md): the 5060A put the NBS III functions in one rack cabinet; the flying-clock article makes no relativistic correction. The NIST-F2 fountain tosses its atoms up through one cavity and lets them fall back through it, for a far longer T.</p>`;
  def.sources = ["HP Memory Project, wall B page 01 (5060A, 1964)", "prc68.com, 5060A", "NIST, how NIST-F2 works", "HP Journal, July 1964 (HP-GAPS-PRIMARY.md section 2)"];
  (g.DiagramDefs = g.DiagramDefs || {}).cesium = def;
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
