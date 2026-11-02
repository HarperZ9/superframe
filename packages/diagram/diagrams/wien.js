// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Wien bridge with Hewlett's lamp (HP 200A, US 2,268,872). Sources: HP-GAPS.md section 5 and the patent. */
(function (g) {
  "use strict";
  const D = g.Diagram;
  const TMAX = 1500, DT = 0.02, KEEP = 5, T0 = 296;
  /* Tungsten resistivity, Desai, James and Ho 1984 (J. Phys. Chem. Ref. Data 13, 1069) Table 5, not corrected for
     thermal expansion, in 1e-8 ohm m; tools/measured data/tungsten_desai1984.json carries the sha256 and rows. */
  const W_T = [250, 273, 293, 298, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2200, 2400, 2600, 2800, 3000];
  const W_RHO = [4.30, 4.82, 5.28, 5.40, 5.44, 7.83, 10.34, 12.98, 15.73, 18.56, 21.47, 24.43, 27.46, 30.54, 33.68, 36.86, 40.09, 43.36, 46.67, 50.02, 53.41, 56.83, 63.76, 70.81, 77.98, 85.26, 92.66];
  const rhoW = (t) => { for (let i = 1; i < W_T.length; i++) if (t <= W_T[i]) return W_RHO[i - 1] + ((t - W_T[i - 1]) / (W_T[i] - W_T[i - 1])) * (W_RHO[i] - W_RHO[i - 1]); return W_RHO[W_RHO.length - 1]; };
  const RHO0 = rhoW(T0);
  /* Invert R(T) / R(296 K) = ratio on the monotonic table (linear between rows). */
  const tempW = (ratio) => { const want = ratio * RHO0; for (let i = 1; i < W_T.length; i++) if (want <= W_RHO[i]) return W_T[i - 1] + ((want - W_RHO[i - 1]) / (W_RHO[i] - W_RHO[i - 1])) * (W_T[i] - W_T[i - 1]); return W_T[W_T.length - 1]; };
  const R_OHM = 15.9e3, LAMP_COLD = 100, RAIL = 3;

  /* Wien network, normalised R = C = 1, time in units of RC. vc: series capacitor, x: v+, r: lamp's resistance rise. */
  function run(mode) {
    const Rc = 1, Rf = 6, n = Math.round(TMAX / DT), out = { v: new Float32Array(n / KEEP + 1), r: new Float32Array(n / KEEP + 1), i: new Float32Array(n / KEEP + 1) };
    const Rg = mode === "lamp" ? null : mode === "high" ? 2.79 : 3.1;
    const f = (s) => {
      const [vc, x, r] = s, Rl = Rg || Rc * (1 + r), K = 1 + Rf / Rl, v = Math.max(-RAIL, Math.min(RAIL, K * x));
      const i = v - vc - x, vl = (v * Rl) / (Rf + Rl), P = (vl * vl) / Rl;
      return { d: [i, i - x, Rg ? 0 : ((P * 108) - r) / 100], v, i };
    };
    let s = [0, 0.01, 0];
    for (let k = 0; k <= n; k++) {
      const a = f(s);
      if (k % KEEP === 0) { out.v[k / KEEP] = a.v; out.r[k / KEEP] = s[2]; out.i[k / KEEP] = a.i; }
      const b = f(s.map((x, j) => x + 0.5 * DT * a.d[j])), c = f(s.map((x, j) => x + 0.5 * DT * b.d[j])), d = f(s.map((x, j) => x + DT * c.d[j]));
      s = s.map((x, j) => x + (DT / 6) * (a.d[j] + 2 * b.d[j] + 2 * c.d[j] + d.d[j]));
    }
    const per = Math.round((2 * Math.PI) / (DT * KEEP));
    out.env = new Float32Array(out.v.length);
    for (let k = 0; k < out.v.length; k++) { let m = 0; for (let j = Math.max(0, k - per); j <= k; j++) m = Math.max(m, Math.abs(out.v[j])); out.env[k] = m; }
    return out;
  }

  const part = (o) => Object.assign({ material: "electronics" }, o);
  const def = {
    id: "wien", title: "Hewlett's lamp", region: "grid", file: "wien-lamp.html", super: "200A",
    message: "A small bulb in the feedback loop warms as the signal grows, cuts the gain back to exactly 3, and holds the oscillation at one steady level.",
    lede: "The Wien bridge oscillator of the HP 200A, 1939: a 3D model you can take apart and cut open, the lamp heating and cooling as the amplitude settles, and the same run without the lamp beside it.",
    camera: { yaw: 0.55, pitch: 0.7, zoom: 1.9 },
    cut: { axis: "z", d: 1.9 },
    parts: [
      part({ id: "board", label: "Chassis", alt: "A flat plate that holds the parts.", fn: "Holds the parts and carries the ground return.", material: "aluminium", geom: { t: "box", size: [9.6, 0.16, 6] }, pos: [0, -0.08, 0], explode: { axis: [0, -1, 0], dist: 1.6 }, noSchematic: true }),
      part({ id: "amp", label: "Amplifier", short: "Amplifier", alt: "A triangular block: the amplifier, gain set by its feedback.", fn: "Amplifies the difference between its + and - inputs. Hewlett used two triodes; an op-amp stands in here.", qty: "voltage gain 1 + Rf / R_lamp, 3 at balance", geom: { t: "extrude", profile: [[-0.7, -0.65], [0.85, 0], [-0.7, 0.65]], depth: 0.5 }, rot: [-90, 0, 0], pos: [1.2, 0.25, 0], explode: { axis: [0, 1, 0], dist: 1.4 }, sch: { x: 0, y: 1.5, kind: "amp" } }),
      part({ id: "rs", label: "Series resistor R", short: "R series", alt: "A small cylinder: the series resistor of the Wien arm.", fn: "With the series capacitor, passes high frequencies and blocks low ones.", qty: "15.9 kOhm", material: "ceramic", cond: { R: R_OHM, d: 0.4e-3 }, geom: { t: "cyl", r: 0.17, h: 0.9, axis: "x" }, pos: [-1.2, 0.2, -1.8], explode: { axis: [0, 0, -1], dist: 1.3 }, sch: { x: 1, y: 0, kind: "res" } }),
      part({ id: "cs", label: "Series capacitor C", short: "C series", alt: "A block: the series capacitor, one section of the ganged tuning capacitor.", fn: "Sets the frequency with R: f0 = 1 / (2 pi R C).", qty: "10 nF (turned by the frequency dial)", material: "plastic", geom: { t: "box", size: [0.6, 0.62, 0.3] }, pos: [0.2, 0.31, -1.8], explode: { axis: [0, 0, -1], dist: 1.3 }, sch: { x: 2, y: 0, kind: "cap" } }),
      part({ id: "rp", label: "Shunt resistor R", short: "R shunt", alt: "A small cylinder: the shunt resistor from the + input to ground.", fn: "With the shunt capacitor, passes low frequencies and blocks high ones.", qty: "15.9 kOhm", material: "ceramic", cond: { R: R_OHM, d: 0.4e-3 }, geom: { t: "cyl", r: 0.17, h: 0.9, axis: "z" }, pos: [-2.7, 0.2, -0.4], explode: { axis: [-1, 0, 0], dist: 1.3 }, sch: { x: 3, y: 0, kind: "res" } }),
      part({ id: "cp", label: "Shunt capacitor C", short: "C shunt", alt: "A block: the shunt capacitor, the other section of the ganged capacitor.", fn: "Together the four parts return one third of the output, in phase, at f0 only.", qty: "10 nF", material: "plastic", geom: { t: "box", size: [0.3, 0.62, 0.6] }, pos: [-2.7, 0.31, 0.9], explode: { axis: [-1, 0, 0], dist: 1.3 }, sch: { x: 3, y: 1, kind: "cap" } }),
      part({ id: "rf", label: "Feedback resistor Rf", short: "Rf", alt: "A small cylinder: the feedback resistor from the output to the - input.", fn: "Sets the gain with the lamp: gain = 1 + Rf / R_lamp.", qty: "600 Ohm (twice the lamp's hot resistance)", material: "ceramic", cond: { R: 600, d: 0.4e-3 }, geom: { t: "cyl", r: 0.17, h: 0.9, axis: "x" }, pos: [1.0, 0.2, 1.9], explode: { axis: [0, 0, 1], dist: 1.3 }, sch: { x: 1, y: 3, kind: "res" } }),
      part({ id: "bulb", label: "Lamp bulb", alt: "A glass sphere around the filament.", fn: "Keeps air off the filament and slows how fast it cools.", qty: "glass envelope", material: "glass", geom: { t: "sphere", r: 0.52 }, pos: [-0.9, 0.82, 1.9], explode: { axis: [0, 1, 0], dist: 1.9 }, noSchematic: true }),
      part({ id: "lamp", label: "Lamp filament", short: "Lamp", alt: "A thin tungsten wire inside the bulb; it glows warmer as the signal grows.", fn: "Sensor, comparator and actuator in one: its resistance rises with the power it absorbs, which lowers the gain.", qty: "about 100 Ohm cold, 300 Ohm at balance (illustrative)", material: "tungsten", cond: { L: 0.036, d: 5e-6 }, geom: { t: "cyl", r: 0.05, h: 0.5, axis: "x", seg: 10 }, pos: [-0.9, 0.82, 1.9], explode: { axis: [0, 1, 0], dist: 1.1 }, sch: { x: 2, y: 3, kind: "lamp" } }),
      part({ id: "base", label: "Lamp base", alt: "A short metal cylinder under the bulb.", fn: "Holds the bulb and joins the filament to the circuit.", material: "brass", geom: { t: "cyl", r: 0.26, h: 0.3 }, pos: [-0.9, 0.15, 1.9], explode: { axis: [0, 1, 0], dist: 0.4 }, noSchematic: true }),
      part({ id: "wire", label: "Hook-up wire", alt: "Thin copper wire joining the parts.", fn: "Carries current between parts; its resistance is tiny next to the parts'.", material: "copper", cond: { L: 0.3, d: 0.5e-3 }, geom: { t: "group", items: [{ t: "box", size: [3.6, 0.05, 0.05], pos: [-0.5, 0.05, 2.6] }, { t: "box", size: [0.05, 0.05, 4.4], pos: [-3.4, 0.05, 0.4] }, { t: "box", size: [4.6, 0.05, 0.05], pos: [-1.1, 0.05, -2.5] }] }, pos: [0, 0, 0], explode: { axis: [0, -1, 0], dist: 0.6 }, noSchematic: true }),
      part({ id: "gnd", label: "Ground", short: "Ground", alt: "The ground lug, the circuit's zero volts.", fn: "The common return for the shunt arm and the lamp.", qty: "0 V", material: "brass", geom: { t: "cyl", r: 0.2, h: 0.4 }, pos: [-3.6, 0.2, 2.4], explode: { axis: [-1, 0, 1], dist: 1 }, sch: { x: 4, y: 2, kind: "gnd" } }),
      part({ id: "out", label: "Output terminal", short: "Output", alt: "The output binding post.", fn: "Where the sine wave leaves the instrument.", qty: "about 1 V peak at 1 kHz", material: "brass", geom: { t: "cyl", r: 0.2, h: 0.6 }, pos: [3.8, 0.3, 0], explode: { axis: [1, 0, 0], dist: 1 }, sch: { x: 5, y: 1.5, kind: "block" } }),
    ],
    links: [
      { from: "amp", to: "rs", label: "v out, 1 V pk" }, { from: "rs", to: "cs" }, { from: "cs", to: "rp", label: "v+ = v out / 3" }, { from: "cs", to: "cp" },
      { from: "rp", to: "gnd" }, { from: "cp", to: "gnd" }, { from: "cs", to: "amp", back: true, label: "0 deg at f0", hide3d: true },
      { from: "amp", to: "rf" }, { from: "rf", to: "lamp", label: "i = 0.8 mA rms" }, { from: "lamp", to: "gnd" }, { from: "amp", to: "out", label: "f0 = 1.00 kHz" },
    ],
    controls: [{ at: "cs", label: "FREQUENCY", bind: "knob-c", dy: -2 }, { at: "lamp", label: "LAMP OR FIXED R", bind: "variant-pick", dy: -2 }],
    knobs: [{ id: "knob-c", label: "C", min: 1, max: 100, step: 1, value: 10, unit: " nF" }],
    variants: [
      { mode: "lamp", title: "A. Lamp in the negative arm", path: ["amp", "rf", "lamp", "gnd"], kind: "pass", verdict: "The lamp warms until the gain is 3. Amplitude holds near 1 V; the wave stays clean." },
      { mode: "high", title: "B. Fixed resistor, gain 3.15", path: ["amp", "rf", "lamp", "gnd"], kind: "fail", relabel: { lamp: "Rg 279 Ohm" }, verdict: "Gain above 3 forever: the wave grows until the rails flatten its peaks." },
      { mode: "low", title: "C. Fixed resistor, gain 2.94", path: ["amp", "rf", "lamp", "gnd"], kind: "fail", relabel: { lamp: "Rg 310 Ohm" }, verdict: "Gain below 3: each cycle is smaller than the last, and the wave dies." },
    ],
  };

  def.sim = (model) => {
    const runs = { lamp: run("lamp"), high: run("high"), low: run("low") }, n = runs.lamp.v.length, dtk = DT * KEEP;
    const idx = (u) => Math.min(n - 1, Math.max(0, Math.round(u * (n - 1))));
    const RC = (view) => R_OHM * ((view.knobs && view.knobs["knob-c"]) || 10) * 1e-9;
    const temp = (r) => tempW(1 + r);
    return {
      duration: (view) => TMAX * RC(view),
      runs,
      state: (u, view) => {
        const k = idx(u), mode = view.variant || "lamp", R = runs[mode] || runs.lamp, v = R.v[k], r = R.r[k];
        const Vrms = R.env[k] / Math.SQRT2, Ilamp = Vrms / (600 + LAMP_COLD * (1 + r));
        const T = mode === "lamp" ? temp(r) : T0 + 8;
        const parts = {
          lamp: { emit: mode === "lamp" ? D.clamp((T - T0) / 520, 0, 1) * 0.85 : 0, glow: [0.95, 0.42, 0.16], temp: T, current: Ilamp, Rfactor: 1 + r, tok: mode === "lamp" ? undefined : "soft" },
          rf: { current: Ilamp, temp: T0 + 600 * Ilamp * Ilamp * 400 }, rs: { current: R.env[k] / 3 / R_OHM / Math.SQRT2, temp: T0 + 2 }, rp: { current: R.env[k] / 3 / R_OHM / Math.SQRT2, temp: T0 + 1 },
          wire: { current: Ilamp, temp: T0 }, amp: { temp: T0 + 14 + 6 * R.env[k] }, bulb: { temp: mode === "lamp" ? T0 + 0.35 * (T - T0) : T0 + 4 },
          base: { temp: mode === "lamp" ? T0 + 0.12 * (T - T0) : T0 + 2 },
        };
        const pts = [], sh = (id) => { const P = model.index.get(id); return D.v3.add(D.v3.add(P.pos, D.partShift(P, view)), P.box.mid); };
        for (const [a, b] of [["amp", "rf"], ["rf", "lamp"], ["lamp", "gnd"], ["amp", "rs"], ["rs", "cs"], ["cs", "rp"], ["rp", "gnd"]]) {
          const A = sh(a), B = sh(b);
          for (let j = 0; j < 4; j++) { const f = D.clamp((j + 0.5) / 4 + 0.09 * v, 0.02, 0.98); pts.push({ p: D.v3.lerp(A, B, f), r: 2.4, tok: "s5" }); }
        }
        return { parts, points: pts, flow: v / RAIL, readout: { v, env: R.env[k], T, t: k * dtk } };
      },
      trace: (u, view) => {
        const k = idx(u), ms = RC(view) * 1e3, tAxis = (len) => Float32Array.from({ length: len }, (_, i) => i * dtk * ms);
        const step = 12, sub = (a) => Float32Array.from({ length: Math.ceil(a.length / step) }, (_, i) => a[i * step]);
        const tx = sub(tAxis(n)), per = Math.round((2 * Math.PI) / dtk), w0 = Math.max(0, k - 3 * per), w1 = Math.min(n, w0 + 6 * per);
        const win = (a) => a.slice(w0, w1), wx = Float32Array.from({ length: w1 - w0 }, (_, i) => (w0 + i) * dtk * ms);
        const T = Float32Array.from(sub(runs.lamp.r), temp);
        return [
          { title: "Amplitude, cycle by cycle: the lamp settles it, a fixed resistor cannot", x: { min: 0, max: TMAX * ms, label: "ms" }, y: { min: 0, max: 3.3, label: "V pk" }, cursor: k * dtk * ms,
            series: [{ name: "lamp", x: tx, y: sub(runs.lamp.env), tok: "ink", width: 2.2 }, { name: "fixed, gain 3.15", x: tx, y: sub(runs.high.env), tok: "s1", dash: true }, { name: "fixed, gain 2.94", x: tx, y: sub(runs.low.env), tok: "s2", dash: true }] },
          { title: "The wave itself, six cycles around the playhead", x: { min: w0 * dtk * ms, max: w1 * dtk * ms, label: "ms" }, y: { min: -3.3, max: 3.3, label: "V" }, cursor: k * dtk * ms,
            series: [{ name: "lamp", x: wx, y: win(runs.lamp.v), tok: "ink", width: 2 }, { name: "fixed, gain 3.15", x: wx, y: win(runs.high.v), tok: "s1", dash: true }] },
          { title: "Filament temperature (heat model)", x: { min: 0, max: TMAX * ms, label: "ms" }, y: { min: 280, max: 1000, label: "K" }, cursor: k * dtk * ms, series: [{ name: "filament", x: tx, y: T, tok: "s5", width: 2 }] },
        ];
      },
      spacetime: () => {
        const verts = [], edges = [], timelike = [], edgePart = [], lampI = model.index.get("lamp").index, rfI = model.index.get("rf").index;
        for (const [mode, pid] of [["lamp", lampI], ["high", rfI]]) {
          const R = runs[mode], st = mode === "lamp" ? 6 : 24;
          for (let k = 0; k < n; k += st) {
            verts.push([R.v[k], k > 0 ? (R.v[k] - R.v[k - 1]) / dtk : 0, mode === "lamp" ? R.r[k] : 3.2, k * dtk]);
            if (k > 0) { edges.push([verts.length - 2, verts.length - 1]); timelike.push(1); edgePart.push(pid); }
          }
        }
        return { verts, edges, timelike, edgePart, axes: ["v out", "dv/dt", "lamp R rise", "time"], angles: [0, 0, 0.35, 0, 0.25, 0], tUnit: (view) => RC(view) * 1e3, tLabel: "ms" };
      },
    };
  };

  def.plain = `<p>An amplifier that feeds part of its own output back to its input will ring at one frequency if the returned part arrives in step and at full strength. The four parts on the left, two resistors and two capacitors, return exactly one third of the output in step, at one frequency only. So the amplifier must multiply by exactly 3. A little more and the wave grows until it hits the supply and its tops flatten. A little less and it dies.</p>
<p>No resistor holds a gain of exactly 3 through warm-up, ageing and a turn of the dial. Hewlett put a small light bulb where one resistor would go. When the wave grows, more power reaches the bulb, the filament warms, and its resistance rises. That lowers the gain. When the wave shrinks, the filament cools and the gain rises. The bulb takes many cycles to warm, so it follows the average level and leaves the shape of each wave alone.</p>
<p>Press play and watch the filament: it heats as the amplitude overshoots, then settles. The traces show the same start with a fixed resistor instead: one run grows into clipping, the other fades away.</p>`;

  def.working = `<p class="math">f0 = 1 / (2 pi R C) = 1 / (2 pi x 15.9 kOhm x 10 nF) = 1.00 kHz
Wien network at f0: v+ / v out = 1/3, phase 0, so steady oscillation needs K = 1 + Rf / R_lamp = 3 (Barkhausen)
Network ODE (R = C = 1, time in RC): d vc/dt = i, dx/dt = i - x, i = v - vc - x, v = clamp(K x, -3, 3)
Lamp: R_lamp = R_cold (1 + r), dr/dt = (P / P0 - r) / tau_th, P = v_lamp^2 / R_lamp, tau_th = 100 RC
Filament temperature: T solves rho(T) / rho(296 K) = 1 + r on the measured tungsten table (Desai, James and Ho 1984, Table 5, 3% near room temperature); a linear law with alpha_W = 4.5 x 10^-3 per K would read 1088 K for a 1000 K filament</p>
<p>Integrated with fourth-order Runge-Kutta at a step of 0.02 RC for 1500 RC, every fifth step kept; three runs (lamp, fixed resistor at gain 3.15, fixed resistor at gain 2.94). The patent gives no lamp data, so R_cold = 100 Ohm, the 3:1 hot-to-cold ratio at balance and tau_th are chosen to show the mechanism, not measured. Real lamps take tens of milliseconds to respond; at 1 kHz that is many cycles, as here. The model leaves out the amplifier's own nonlinearity below the rails, the lamp's T^4 radiation law (a first-order lag stands in) and noise. The op-amp stands in for the patent's two triodes, as in the 2D drawing.</p>
<p>The patent's own frequency formula is garbled in the OCR, so f0 = 1/(2 pi R C) is from memory, high confidence. Patent facts (RC network sets frequency; a ballast lamp in negative feedback; amplitude set below grid current; frequency as 1/C, 10:1 per dial) are from US 2,268,872, read 2026-10-30.</p>`;
  def.sources = ["US 2,268,872 (filed 1939-07-11, issued 1942-01-06), patents.google.com/patent/US2268872", "SMECC, the 200A page", "HP-GAPS.md section 5",
    "Desai, James, Ho 1984, Electrical resistivity of selected elements, J. Phys. Chem. Ref. Data 13, 1069, Table 5 (tungsten)"];
  def.tempW = tempW;

  (g.DiagramDefs = g.DiagramDefs || {}).wien = def;
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
