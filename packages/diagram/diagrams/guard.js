// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Guarding in a precision voltmeter. Sources: HP-GAPS.md section 3; AN 123 (1970) via HP-GAPS-PRIMARY.md section 3:
   guard to source low holds for a floating supply; for a bridge, guard to ground at the bridge is usually best. */
(function (g) {
  "use strict";
  const D = g.Diagram;
  const F = 60, VCM = 10, RLO = 1e3, RG = 1e3, R1 = 1e12, C1 = 5e-12, R2 = 1e9, C2 = 200e-12;
  /* complex numbers as [re, im] */
  const c = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]],
    div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }, abs: (a) => Math.hypot(a[0], a[1]) };
  const Y = (R, C, f) => [1 / R, 2 * Math.PI * f * C];   /* admittance of R parallel C */
  /* Node voltages. Guarded: unknowns Lo (L) and guard (G); L-Vcm via R_lo, G-Vcm via R_g, L-G via Z1, G-case via Z2.
     Unguarded (guard left at the meter's Lo): L and G are one node, tied to the case through Z2. Returns error = I(R_lo) R_lo. */
  const solve = (guarded, f = F, vcm = VCM) => {
    const V = [vcm, 0], yl = [1 / RLO, 0], yg = [1 / RG, 0], y1 = Y(R1, C1, f), y2 = Y(R2, C2, f);
    if (!guarded) { const L = c.div(c.mul(yl, V), c.add(yl, y2)), I = c.mul(c.sub(V, L), yl); return { L, G: L, I, err: c.abs(I) * RLO, Icm: c.abs(I) }; }
    const a11 = c.add(yl, y1), a12 = c.mul([-1, 0], y1), a22 = c.add(c.add(yg, y1), y2), b1 = c.mul(yl, V), b2 = c.mul(yg, V);
    const det = c.sub(c.mul(a11, a22), c.mul(a12, a12));
    const L = c.div(c.sub(c.mul(b1, a22), c.mul(a12, b2)), det), G = c.div(c.sub(c.mul(a11, b2), c.mul(a12, b1)), det);
    const I = c.mul(c.sub(V, L), yl), Ig = c.mul(c.sub(V, G), yg);
    return { L, G, I, err: c.abs(I) * RLO, Icm: c.abs(Ig) };
  };
  const part = (o) => Object.assign({ material: "electronics" }, o);
  const def = {
    id: "guard", title: "Guarding a voltmeter", region: "print", file: "guard.html", super: "AN 123",
    message: "A shield held at the source's low side gives leakage current its own way home, so it never flows through the Lo lead and never shows up in the reading.",
    lede: "A guarded voltmeter input, nested shells you can slice: the case, the guard and the measuring circuit, with the common-mode current shown on the path it takes, guarded and not.",
    camera: { yaw: 0.7, pitch: 0.45, zoom: 2.4 }, cut: { axis: "y", d: 0.3 }, startU: 0.25, playSeconds: 16,
    parts: [
      part({ id: "case", label: "Case (earth)", short: "Case", alt: "The outer metal box, at earth potential.", fn: "The instrument's outer shell, tied to the mains earth.", qty: "0 V", material: "steel", geom: { t: "shell", size: [6, 3.2, 4.4], wall: 0.08 }, pos: [0, 0, 0], explode: { axis: [0, 1, 0], dist: 3.4 } }),
      part({ id: "guard", label: "Guard shield", short: "Guard", alt: "A second metal box inside the case, around the measuring circuit.", fn: "Held at the source's low side, so almost no voltage sits across the insulation inside it.", qty: "about Vcm", material: "copper", geom: { t: "shell", size: [3.8, 2.2, 3.0], wall: 0.06 }, pos: [0, 0, 0], explode: { axis: [0, 1, 0], dist: 2.0 } }),
      part({ id: "circ", label: "Measuring circuit", short: "Meter Lo side", alt: "A small board with a chip, inside the guard.", fn: "The input amplifier and converter; its common is the Lo terminal.", geom: { t: "group", items: [{ t: "box", size: [2.4, 0.08, 1.8] }, { t: "box", size: [0.8, 0.25, 0.6], pos: [0, 0.16, 0] }] }, pos: [0, -0.5, 0], explode: { axis: [0, 1, 0], dist: 0.8 } }),
      part({ id: "z1", label: "Insulation, Lo to guard (Z1)", short: "Z1", alt: "A small post between the circuit and the guard wall.", fn: "Leakage path from the circuit to the guard: 10^12 Ohm in parallel with 5 pF (illustrative).", qty: "almost no voltage across it when guarded", material: "ceramic", geom: { t: "cyl", r: 0.12, h: 0.45 }, pos: [1.4, -0.8, 0], explode: { axis: [1, 0, 0], dist: 0.6 } }),
      part({ id: "z2", label: "Insulation, guard to case (Z2)", short: "Z2", alt: "A post between the guard and the case floor.", fn: "Leakage from the guard to earth: 10^9 Ohm in parallel with 200 pF (illustrative). Common-mode current crosses here.", qty: "Icm flows here", material: "ceramic", geom: { t: "cyl", r: 0.14, h: 0.42 }, pos: [1.4, -1.36, 0], explode: { axis: [1, -1, 0], dist: 0.8 } }),
      part({ id: "lo", label: "Lo lead and terminal", short: "Lo lead", alt: "A copper rod from the front of the meter out to the source.", fn: "Its resistance R_lo turns any current through it into a false reading.", qty: "R_lo = 1 kOhm (lead plus source, illustrative)", material: "copper", cond: { L: 1.5, d: 0.6e-3 }, geom: { t: "cyl", r: 0.07, h: 4.2, axis: "z", seg: 10 }, pos: [-0.3, -0.5, 3.2], explode: { axis: [0, 0, 1], dist: 1.4 } }),
      part({ id: "hi", label: "Hi lead and terminal", short: "Hi", alt: "A copper rod beside the Lo lead.", fn: "Carries the signal; the reading is Hi minus Lo.", material: "copper", cond: { L: 1.5, d: 0.6e-3 }, geom: { t: "cyl", r: 0.07, h: 4.2, axis: "z", seg: 10 }, pos: [-1.0, -0.5, 3.2], explode: { axis: [0, 0, 1], dist: 1.4 }, noSchematic: true }),
      part({ id: "glead", label: "Guard lead", short: "Guard lead", alt: "A copper rod from the guard terminal out to the source's low side.", fn: "Gives the common-mode current its own way back.", qty: "R_g = 1 kOhm (illustrative)", material: "copper", cond: { L: 1.5, d: 0.6e-3 }, geom: { t: "cyl", r: 0.07, h: 4.2, axis: "z", seg: 10 }, pos: [0.6, -0.5, 3.2], explode: { axis: [0, 0, 1], dist: 1.4 } }),
      part({ id: "src", label: "Floating source", short: "Source", alt: "A block outside the meter: the voltage being measured.", fn: "Floats at Vcm above earth; its low side is where the guard should go.", qty: "Vcm = 10 V at 60 Hz", geom: { t: "box", size: [2.4, 0.9, 0.9] }, pos: [-0.2, -0.5, 5.8], explode: { axis: [0, 0, 1], dist: 1 } }),
      part({ id: "vcm", label: "Common-mode voltage", short: "Vcm", alt: "A block under the source, joined to earth.", fn: "Whatever lifts the source above earth: a ground loop, a supply, a bridge excitation.", qty: "10 V rms, 60 Hz", geom: { t: "cyl", r: 0.4, h: 0.6 }, pos: [-0.2, -1.6, 5.8], explode: { axis: [0, -1, 1], dist: 1 } }),
    ],
    links: [
      { from: "vcm", to: "src", label: "10 V, 60 Hz" }, { from: "src", to: "lo", label: "I through R_lo" }, { from: "src", to: "glead", label: "Icm, 0.75 uA" },
      { from: "lo", to: "circ" }, { from: "glead", to: "guard" }, { from: "circ", to: "z1" }, { from: "z1", to: "guard" }, { from: "guard", to: "z2" }, { from: "z2", to: "case", label: "to earth" },
    ],
    controls: [{ at: "guard", label: "GUARD", bind: "variant-pick", dy: -2 }],
    variants: [
      { mode: "guarded", title: "A. Floating supply: guard to the source's low side", path: ["vcm", "src", "glead", "guard", "z2", "case"], kind: "pass", verdict: "Icm returns through the guard lead. Almost no voltage across Z1, so almost no current in R_lo." },
      { mode: "open", title: "B. Guard left at the meter's Lo", path: ["vcm", "src", "lo", "circ", "z1", "guard", "z2", "case"], kind: "fail", relabel: { z1: "Z1 shorted" }, verdict: "All of Icm runs through R_lo: 0.75 uA x 1 kOhm, a 0.75 mV error." },
      { mode: "bridge", title: "C. Bridge: guard to ground at the bridge (AN 123, Fig. 9)", path: ["vcm", "src", "glead", "guard"], kind: "open", verdict: "For a bridge the usual best is guard to ground at the bridge, or a driven guard. Drawn, not simulated here." },
    ],
  };
  def.sim = (model) => {
    const A = solve(true), B = solve(false);
    return {
      duration: () => 4 / F,
      state: (u, view) => {
        const t = (u * 4) / F, s = Math.sin(2 * Math.PI * F * t), open = view.variant === "open";
        const R = open ? B : A, Ilo = R.I && c.abs(R.I) * Math.SQRT2 * s;
        return { parts: { lo: { current: c.abs(R.I), tok: open ? "red" : undefined }, glead: { current: open ? 0 : A.Icm, tok: open ? undefined : "verified" }, hi: { current: 0 }, guard: { emit: open ? 0 : 0.12 * Math.abs(s) } }, flow: s, readout: { Ilo } };
      },
      trace: (u, view) => {
        const n = 400, ts = Float32Array.from({ length: n }, (_, i) => ((i / (n - 1)) * 4) / F * 1e3), open = view.variant === "open";
        const R = open ? B : A, sc = Math.SQRT2;
        return [
          { title: "Common-mode voltage at the source", x: { min: 0, max: ts[n - 1], label: "ms" }, y: { min: -15, max: 15, label: "V" }, cursor: u * ts[n - 1], series: [{ name: "Vcm", x: ts, y: Float32Array.from(ts, (t) => VCM * sc * Math.sin(2 * Math.PI * F * t * 1e-3)), tok: "ink", width: 2 }] },
          { title: "Reading error, this connection (" + (open ? "guard at Lo" : "guarded") + ")", x: { min: 0, max: ts[n - 1], label: "ms" }, y: { min: -1.2 * R.err * sc * 1e6, max: 1.2 * R.err * sc * 1e6, label: "uV" }, cursor: u * ts[n - 1], series: [{ name: "error", x: ts, y: Float32Array.from(ts, (t) => R.err * sc * 1e6 * Math.sin(2 * Math.PI * F * t * 1e-3 + 1.5)), tok: open ? "s1" : "s2", width: 2 }] },
          { title: "Error magnitude, both connections, and the rejection", y: { min: 1e-10, max: 1e-2, label: "V rms", unit: "V" }, bars: [{ name: "guard at Lo", value: B.err, tok: "s1" }, { name: "guarded", value: A.err, tok: "s2" }] },
        ];
      },
      spacetime: () => {
        const verts = [], edges = [], timelike = [], edgePart = [], nodes = [["src", 1, A.L], ["guard", 0.5, A.G], ["case", 0, [0, 0]]];
        nodes.forEach(([id, x, ph], k) => {
          const pid = model.index.get(id).index, amp = id === "case" ? 0 : c.abs(ph) / VCM, phs = Math.atan2(ph[1], ph[0]);
          for (let i = 0; i <= 80; i++) { const t = (i / 80) * (4 / F); verts.push([x, amp * Math.sin(2 * Math.PI * F * t + phs), k, t]); if (i) { edges.push([verts.length - 2, verts.length - 1]); timelike.push(1); edgePart.push(pid); } }
        });
        return { verts, edges, timelike, edgePart, axes: ["node", "potential / Vcm", "which node", "time"], angles: [0, 0, 1.0, 0, 0, 0.3] };
      },
    };
  };
  def.checks = () => {
    const B = solve(false), y2 = Y(R2, C2, F), z2 = c.div([1, 0], y2), want = (VCM / c.abs(c.add(z2, [RLO, 0]))) * RLO, A = solve(true);
    return [{ name: "unguarded error equals Vcm R_lo / |R_lo + Z2| (single-loop formula)", got: B.err, want, tol: 1e-9 },
      { name: "guarded rejection lies in AN 123's line-frequency range, 60 to 100 dB or better (here " + (20 * Math.log10(VCM / A.err)).toFixed(0) + " dB)", got: 20 * Math.log10(VCM / A.err) >= 60 ? 1 : 0, want: 1, tol: 0 }];
  };
  def.overlayNotes = "<p>On this page the current layer shows the leads: with the guard at Lo the common-mode current runs in the Lo lead; guarded, it runs in the guard lead and the Lo lead carries almost none.</p>";
  def.plain = `<p>A voltmeter reads the difference between its Hi and Lo terminals. Often the thing being measured floats some volts above earth. That common-mode voltage pushes a tiny current through the meter's insulation to its case and back to earth, and on the way it passes through the Lo lead. Any current in the Lo lead makes a small voltage across the lead's resistance, and the meter cannot tell that voltage from the signal.</p>
<p>The guard is a second metal box inside the meter, around the measuring circuit, wired to the low side of the source. The circuit and the guard then sit at almost the same voltage, so almost no current crosses the insulation between them. The leakage still flows, but from the guard to the case, and it gets home through the guard lead instead of the Lo lead. Cut the model open to see the shells nested inside each other, and switch the guard connection to see the current change paths.</p>`;
  def.working = `<p class="math">Unguarded (guard at the meter's Lo): I = Vcm / (R_lo + Z2), error = I R_lo
Guarded: nodal analysis on Lo (L) and guard (G): (y_lo + y1) L - y1 G = y_lo Vcm;  -y1 L + (y_g + y1 + y2) G = y_g Vcm; error = |Vcm - L| y_lo R_lo
y = 1/R + j 2 pi f C. Values (illustrative): Vcm = 10 V rms at 60 Hz, R_lo = R_g = 1 kOhm, Z1 = 10^12 Ohm || 5 pF, Z2 = 10^9 Ohm || 200 pF
Result: guard at Lo 0.75 mV; guarded 1.4 nV, about 114 dB better, roughly the ratio R_g / |Z1| in this network</p>
<p>From AN 123 (1970): wire the guard to the source low for a floating supply (Fig. 7A, p. 9). For a bridge, guard to ground at the bridge is usually best (Fig. 9, p. 11), and a driven guard set by a divider can carry over 90 percent of the common-mode current (Fig. 10). A floating meter rejects 80 to 120 dB at dc and 60 to 100 dB at line frequency (p. 5). The lumped network leaves out distributed capacitance, the Hi lead's own leakage and the meter's input impedance.</p>`;
  def.sources = ["HP Application Note 123 (1970), floating measurements and guarding (HP-GAPS-PRIMARY.md section 3)", "Fluke 8588A manual, guard use (manualslib, p. 24)", "HP-GAPS.md section 3"];
  (g.DiagramDefs = g.DiagramDefs || {}).guard = def;
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
