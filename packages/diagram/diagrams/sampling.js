// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Equivalent-time sampling (HP 185A with the 187A plug-in, 1960). Sources: HP-GAPS.md section 1 and the primary
   corrections in HP-GAPS-PRIMARY.md section 1: the held value is fed back so the gate samples only the difference,
   loop gain 1 in Normal and about 0.2 in Smoothed. */
(function (g) {
  "use strict";
  const D = g.Diagram;
  const WIN = 2.0, REP = 4.0, NOISE = 0.06;   /* ns window; the repeat period is shortened to twice the window */
  const sig = (t) => (t < 0.25 ? 0 : 1 - Math.exp(-(t - 0.25) / 0.16) * Math.cos((2 * Math.PI * (t - 0.25)) / 0.42));
  const gauss = (r) => { const a = r(), b = r(); return Math.sqrt(-2 * Math.log(a + 1e-12)) * Math.cos(2 * Math.PI * b); };
  /* The sampler: y_n = y_(n-1) + G (v(n dt) + noise_n - y_(n-1)). G = 1 is complete in one step. */
  const acquire = (N, G, seed = 185) => {
    const r = D.rng(seed), y = new Float64Array(N), v = new Float64Array(N), x = new Float64Array(N);
    let prev = 0;
    for (let n = 0; n < N; n++) { x[n] = (n / N) * WIN; v[n] = sig(x[n]) + NOISE * gauss(r); prev = prev + G * (v[n] - prev); y[n] = prev; }
    return { x, v, y };
  };
  const part = (o) => Object.assign({ material: "electronics" }, o);
  const diode = (x, y, a) => ({ t: "cyl", r: 0.09, h: 0.5, axis: "x", pos: [x, 0, y], rot: [0, a, 0] });
  const def = {
    id: "sampling", title: "Equivalent-time sampling", region: "glitch", file: "equivalent-time.html", super: "185A",
    message: "Take one tiny sample on each repeat of a fast signal, each a little later than the last, and the slow row of samples redraws the fast wave.",
    lede: "The 1960 sampling oscilloscope: a diode gate that opens for under a nanosecond, a loop that feeds the held value back so the gate sees only the difference, and the spacetime surface that equivalent time makes.",
    camera: { yaw: 0.5, pitch: 0.75, zoom: 2.4 }, cut: { axis: "y", d: 0.12 }, startU: 0.55, playSeconds: 20,
    parts: [
      part({ id: "board", label: "Plug-in chassis", alt: "A flat plate under the sampler's parts.", fn: "Holds the parts.", material: "aluminium", geom: { t: "box", size: [10, 0.14, 5.4] }, pos: [0, -0.07, 0], explode: { axis: [0, -1, 0], dist: 1.4 }, noSchematic: true }),
      part({ id: "input", label: "Signal under test", short: "Signal in", alt: "A connector at the left: the repeating fast signal comes in here.", fn: "A wave that repeats exactly; sampling only works because it does.", qty: "repeating step, rings at 2.4 GHz", material: "brass", geom: { t: "cyl", r: 0.25, h: 0.8, axis: "x" }, pos: [-4.4, 0.25, 0], explode: { axis: [-1, 0, 0], dist: 1 } }),
      part({ id: "bridge", label: "Diode sampling gate", short: "Diode gate", alt: "Four small diodes in a diamond: the balanced sampling bridge.", fn: "Four matched diodes, closed by a sub-nanosecond pulse; the bridge cancels switching noise and keeps the pulse out of the circuit under test.", qty: "aperture under 0.7 ns", material: "ceramic", geom: { t: "group", items: [diode(-0.3, -0.3, 45), diode(0.3, -0.3, -45), diode(-0.3, 0.3, -45), diode(0.3, 0.3, 45)] }, pos: [-2.4, 0.15, 0], explode: { axis: [0, 1, 0], dist: 1.4 } }),
      part({ id: "strobe", label: "Strobe pulse generator", short: "Strobe", alt: "A block above the gate: makes the sampling pulse.", fn: "Fires one very short pulse per repeat, later by one step each time.", geom: { t: "box", size: [1.2, 0.5, 0.9] }, pos: [-2.4, 0.25, -1.9], explode: { axis: [0, 0, -1], dist: 1.3 } }),
      part({ id: "timing", label: "Sweep and delay", short: "Sweep, delay", alt: "A block at the back: timing and the slow staircase.", fn: "Counts repeats and sets each sample's delay, n times delta t after the trigger. (The ramp-meets-staircase comparator is general practice; the 1960 article does not describe it.)", qty: "delta t = window / samples", geom: { t: "box", size: [1.6, 0.5, 0.9] }, pos: [0.2, 0.25, -1.9], explode: { axis: [0, 0, -1], dist: 1.3 } }),
      part({ id: "trigger", label: "Trigger pick-off", short: "Trigger", alt: "A small block at the back left.", fn: "Marks the start of each repeat.", geom: { t: "box", size: [0.8, 0.4, 0.6] }, pos: [-4.0, 0.2, -1.9], explode: { axis: [-1, 0, -1], dist: 1 } }),
      part({ id: "hold", label: "Hold capacitance", short: "Hold", alt: "A small block after the gate: the charge store.", fn: "The sample is a charge stored on a cathode follower's input capacitance.", geom: { t: "box", size: [0.5, 0.5, 0.5] }, pos: [-1.0, 0.25, 0], explode: { axis: [0, 1, 0], dist: 1 } }),
      part({ id: "amp", label: "Preamplifier", short: "Preamp", alt: "A triangular block: the amplifier after the gate.", fn: "Amplifies the difference the gate saw; it can be slow, because the gate sets the bandwidth.", geom: { t: "extrude", profile: [[-0.6, -0.55], [0.7, 0], [-0.6, 0.55]], depth: 0.45 }, rot: [-90, 0, 0], pos: [0.4, 0.22, 0], explode: { axis: [0, 1, 0], dist: 1.2 } }),
      part({ id: "store", label: "Second store (stretcher)", short: "Store", alt: "A block after the amplifier: holds the displayed value.", fn: "Holds the value until the next sample and feeds it back to the gate, so the loop nulls the error. Loop gain 1 in Normal, about 0.2 in Smoothed.", qty: "loop gain G", geom: { t: "box", size: [1.2, 0.5, 0.9] }, pos: [2.0, 0.25, 0], explode: { axis: [0, 1, 0], dist: 1 } }),
      part({ id: "crt", label: "Display tube", short: "CRT", alt: "A funnel-shaped tube at the right with a flat screen.", fn: "Draws one dot per sample, stepping across as the delay steps.", material: "glass", geom: { t: "group", items: [{ t: "cone", r: 1.0, r2: 0.25, h: 1.4, axis: "x", rot: [0, 0, 180] }, { t: "box", size: [0.12, 2.0, 2.0], pos: [-0.75, 0, 0] }] }, pos: [4.0, 1.05, 0], explode: { axis: [1, 0, 0], dist: 1.4 } }),
    ],
    links: [
      { from: "input", to: "bridge", label: "v(t), to 500 Mc" }, { from: "trigger", to: "timing", label: "1 per repeat" }, { from: "timing", to: "strobe", label: "delay n dt" },
      { from: "strobe", to: "bridge", label: "pulse < 1 ns" }, { from: "bridge", to: "hold", label: "difference" }, { from: "hold", to: "amp" }, { from: "amp", to: "store", label: "gain G" },
      { from: "store", to: "bridge", back: true, label: "held value fed back", hide3d: true }, { from: "store", to: "crt", label: "vertical" }, { from: "timing", to: "crt", label: "horizontal step" },
    ],
    controls: [{ at: "store", label: "NORMAL / SMOOTHED", bind: "variant-pick", dy: -2 }, { at: "timing", label: "SCANNING", bind: "knob-n", dy: -2 }],
    knobs: [{ id: "knob-n", label: "Samples per trace", min: 50, max: 400, step: 50, value: 100, unit: "" }],
    variants: [
      { mode: "normal", title: "A. Normal: loop gain 1", path: ["bridge", "hold", "amp", "store", "bridge"], kind: "pass", verdict: "Each sample is complete in one step, at any scan density. Noise passes straight through." },
      { mode: "smooth", title: "B. Smoothed: loop gain about 0.2", path: ["bridge", "hold", "amp", "store", "bridge"], kind: "pass", verdict: "Each dot settles over several samples. Noise that differs from cycle to cycle drops by about 3; the repeating wave is unchanged." },
    ],
  };
  const N = (view) => (view.knobs && view.knobs["knob-n"]) || 100, G = (view) => (view.variant === "smooth" ? 0.2 : 1);
  def.sim = (model) => {
    const cache = new Map(), acq = (n, gn) => { const k = n + "|" + gn; if (!cache.has(k)) cache.set(k, acquire(n, gn)); return cache.get(k); };
    return {
      duration: (view) => N(view) * REP * 1e-9,
      state: (u, view) => {
        const n = N(view), A = acq(n, G(view)), k = Math.min(n - 1, Math.floor(u * n)), frac = u * n - Math.floor(u * n), pts = [];
        const crt = model.index.get("crt"), c = D.v3.add(D.v3.add(crt.pos, D.partShift(crt, view)), [-0.84, 0, 0]);
        for (let i = 0; i <= k; i++) pts.push({ p: [c[0], c[1] - 0.8 + 0.8 * A.y[i], c[2] + 0.9 - (1.8 * i) / n], r: i === k ? 3.4 : 2, tok: i === k ? "red" : "s2" });
        const fire = frac < 0.25 ? 1 - frac / 0.25 : 0;
        return { parts: { bridge: { emit: 0.8 * fire, glow: [1, 0.45, 0.2], temp: 310 }, strobe: { emit: 0.4 * fire, glow: [1, 0.45, 0.2] }, hold: { emit: 0.3 * Math.abs(A.y[k]) } }, points: pts, flow: A.y[k], readout: { k } };
      },
      trace: (u, view) => {
        const n = N(view), A = acq(n, G(view)), k = Math.min(n - 1, Math.floor(u * n)), fx = Float32Array.from({ length: 400 }, (_, i) => (i / 399) * WIN);
        const B = acq(n, G(view) === 1 ? 0.2 : 1), idx = Float32Array.from({ length: k + 1 }, (_, i) => i);
        return [
          { title: "(A) The fast wave, repeat after repeat; dots: the sample taken on each repeat", x: { min: 0, max: WIN, label: "ns after trigger" }, y: { min: -0.2, max: 1.8, label: "V" }, cursor: A.x[k],
            series: [{ name: "v(t)", x: fx, y: Float32Array.from(fx, sig), tok: "soft", width: 1.2 }, { x: A.x.slice(0, k + 1), y: A.v.slice(0, k + 1), tok: "s1", dots: true, width: 0.01 }] },
          { title: "(B) The same points as the screen draws them, one per repeat", x: { min: 0, max: n, label: "repeats" }, y: { min: -0.2, max: 1.8, label: "V" }, cursor: k,
            series: [{ name: G(view) === 1 ? "Normal" : "Smoothed", x: idx, y: A.y.slice(0, k + 1), tok: "ink", width: 2, step: true }, { name: G(view) === 1 ? "Smoothed (double exposure)" : "Normal (double exposure)", x: idx, y: B.y.slice(0, k + 1), tok: "s3", dash: true }] },
        ];
      },
      spacetime: () => {
        const rows = 40, pts = 36, verts = [], edges = [], timelike = [], edgePart = [], sI = model.index.get("input").index, hI = model.index.get("hold").index;
        let last = -1;
        for (let r = 0; r < rows; r++) for (let j = 0; j < pts; j++) {
          const t = (j / (pts - 1)) * WIN;
          verts.push([t, sig(t), r, r * REP + t]);
          const me = verts.length - 1;
          if (j > 0 || last >= 0) { edges.push([j > 0 ? me - 1 : last, me]); timelike.push(1); edgePart.push(sI); }
          if (r > 0 && j % 6 === 0) { edges.push([me - pts, me]); timelike.push(0); edgePart.push(sI); }
          if (j === pts - 1) last = me;
        }
        let prev = -1;
        for (let r = 0; r < rows; r++) { const t = (r / rows) * WIN; verts.push([t, sig(t), r, r * REP + t]); if (prev >= 0) { edges.push([prev, verts.length - 1]); timelike.push(0); edgePart.push(hI); } prev = verts.length - 1; }
        return { verts, edges, timelike, edgePart, axes: ["t in the window", "v", "repeat n", "real time"], angles: [0, 0.2, 0, 0, 0, 0.25] };
      },
    };
  };
  def.checks = () => {
    const a = acquire(2000, 1, 9), b = acquire(2000, 0.2, 9);
    let e1 = 0, e2 = 0, m = 0;
    for (let n = 0; n < 2000; n++) { m = Math.max(m, Math.abs(a.y[n] - a.v[n])); }
    for (let n = 200; n < 2000; n++) { e1 += (a.y[n] - sig(a.x[n])) ** 2; e2 += (b.y[n] - sig(b.x[n])) ** 2; }
    return [{ name: "Normal mode: loop gain 1 makes each displayed point exactly its sample", got: m, want: 0, tol: 1e-12 },
      { name: "Smoothed mode, gain 0.2: noise falls to sqrt(G / (2 - G)) = 1/3 of Normal (within 15 percent; the slow wave adds a small lag)", got: Math.sqrt(e2 / e1), want: Math.sqrt(0.2 / 1.8), tol: 0.15 }];
  };
  def.plain = `<p>Some signals change faster than any amplifier of 1960 could follow. If the signal repeats exactly, there is a way round. Open a gate for a tiny moment and catch one value. On the next repeat, catch one value a little later. After a few hundred repeats you hold a few hundred values, each from a different moment of the same wave, and drawn side by side they rebuild it on a slow time scale. That is equivalent time.</p>
<p>The 185A added a loop. The value it holds is fed back to the gate, so on the next sample the gate only has to catch the difference. In Normal the loop gain is 1, so each dot is complete at once. In Smoothed it is about 0.2, so each dot moves a fifth of the way to each new sample: random noise from cycle to cycle averages down, and the repeating wave stays as it was. Press play to watch the dots build up on the screen. The spacetime view stacks the repeats in depth so the wave becomes a surface, and the samples walk diagonally across it.</p>`;
  def.working = `<p class="math">Sample n is taken at t_n = n dt after the n-th trigger, dt = window / N; displayed time is stretched by T_repeat / dt
Loop (HPJ 1960, pp. 3-4): y_n = y_(n-1) + G (v(t_n) + noise_n - y_(n-1)), G = 1 (Normal) or about 0.2 (Smoothed)
Exponential smoothing on white noise: var(y) / var(noise) = G / (2 - G); for G = 0.2 the noise falls by sqrt(9) = 3, as the article reports
Signal: v(t) = 1 - exp(-(t - 0.25) / 0.16) cos(2 pi (t - 0.25) / 0.42) for t > 0.25 ns (illustrative); noise 0.06 V rms, seeded</p>
<p>Simplified: the gate is ideal (a point in time, no aperture smear); the repeat period is drawn as twice the 2 ns window so the spacetime surface fits on screen, where a real repeat is thousands of windows long; the 1960 ramp-meets-staircase comparator is general practice and not from the 185A article. Specifications from the primary text: above 500 Mc at 3 dB, under 0.7 ns rise, at most 100 kc sampling rate, about 1000, 200 or 50 samples per trace, under 0.1 ns jitter.</p>`;
  def.sources = ["HP Journal Vol. 11 No. 5-7, Jan.-Mar. 1960, the 185A/187A article (HP-GAPS-PRIMARY.md section 1)", "HP Memory Project, wall B page 02", "HP-GAPS.md section 1"];
  (g.DiagramDefs = g.DiagramDefs || {}).sampling = def;
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
