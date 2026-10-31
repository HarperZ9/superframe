// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* CORDIC and the HP-35's decimal pseudo-division. Sources: HP-GAPS.md section 6 and HP-GAPS-PRIMARY.md section 4
   (Cochran, HPJ June 1972: pseudo-division traced to Briggs, 1624; the binary gain 1.6468 does not apply to decimal). */
(function (g) {
  "use strict";
  const D = g.Diagram;
  const NB = 16;
  /* Binary CORDIC, rotation mode: x' = x - d y 2^-i, y' = y + d x 2^-i, z' = z - d atan(2^-i). */
  const binary = (th) => {
    let x = 1, y = 0, z = th;
    const rows = [{ i: "-", d: "", x, y, z }];
    for (let i = 0; i < NB; i++) {
      const d = z >= 0 ? 1 : -1, s = 2 ** -i;
      [x, y, z] = [x - d * y * s, y + d * x * s, z - d * Math.atan(s)];
      rows.push({ i, d: d > 0 ? "+" : "-", x, y, z });
    }
    return rows;
  };
  /* Decimal pseudo-division (Briggs; Volder; Meggitt): for k = 0..4 subtract atan(10^-k) while it fits, rotating
     (x, y) by the same constant with shifts and adds each time. tan = y / x; the stretch cancels in the ratio. */
  const decimal = (th) => {
    let x = 1, y = 0, z = th, gain = 1;
    const rows = [{ i: "-", d: "", x, y, z, q: "" }];
    for (let k = 0; k <= 4; k++) {
      const a = Math.atan(10 ** -k), s = 10 ** -k;
      let q = 0;
      while (z >= a) { [x, y] = [x - y * s, y + x * s]; z -= a; q++; gain *= Math.sqrt(1 + s * s); rows.push({ i: k, d: "q" + q, x, y, z, q }); }
    }
    [x, y] = [x - z * y, y + z * x];   /* the last residual is below 1e-4: one more turn by tan z = z, error of order z^2 */
    rows.push({ i: "end", d: "", x, y, z: 0, q: "" });
    return { rows, gain, tan: y / x };
  };
  const part = (o) => Object.assign({ material: "electronics" }, o);
  const cells = (n) => ({ t: "group", items: Array.from({ length: n }, (_, i) => ({ t: "box", size: [0.26, 0.2, 0.42], pos: [-((n - 1) * 0.3) / 2 + i * 0.3, 0, 0] })) });
  const def = {
    id: "cordic", title: "CORDIC, step by step", region: "deco", file: "cordic.html", super: "HP-35",
    message: "A sine or a tangent from nothing but shifts and adds: turn a vector by smaller and smaller fixed angles until the angle left over is gone.",
    lede: "The rotation staircase of binary CORDIC, the HP-35's decimal pseudo-division as stacked steps, and the register table at every step.",
    camera: { yaw: 0.7, pitch: 0.42, zoom: 2.5 }, cut: null, startU: 0.6, playSeconds: 24,
    parts: [
      part({ id: "rom", label: "Constant ROM", short: "ROM, 2560 bits", alt: "A round block: the table of arctangent constants.", fn: "Holds atan(10^-k) (decimal) or atan(2^-i) (binary); one constant per step.", qty: "ROM capacity 2560 bits per chip (HPJ 1972, Fig. 3)", geom: { t: "cyl", r: 0.55, h: 0.3 }, pos: [-3.2, 0.15, -1.2], explode: { axis: [0, 1, 0], dist: 1.2 } }),
      part({ id: "zreg", label: "Z register (angle left)", short: "Z register", alt: "A row of ten cells: the angle still to turn.", fn: "Starts at the angle; each step subtracts a constant from it.", geom: cells(10), pos: [-0.8, 0.12, -1.2], explode: { axis: [0, 0, -1], dist: 1.2 } }),
      part({ id: "xreg", label: "X register", short: "X register", alt: "A row of ten cells: the x part of the vector.", fn: "x' = x - y 10^-k: a shifted copy subtracted.", geom: cells(10), pos: [-0.8, 0.12, 0], explode: { axis: [0, 1, 0], dist: 0.8 } }),
      part({ id: "yreg", label: "Y register", short: "Y register", alt: "A row of ten cells: the y part of the vector.", fn: "y' = y + x 10^-k: a shifted copy added.", geom: cells(10), pos: [-0.8, 0.12, 1.2], explode: { axis: [0, 0, 1], dist: 1.2 } }),
      part({ id: "shift", label: "Shifter", alt: "A block: moves digits right.", fn: "Multiplies by 10^-k (or 2^-i) by moving digits, with no multiplier.", geom: { t: "box", size: [0.9, 0.3, 0.9] }, pos: [2.2, 0.15, 0.6], explode: { axis: [1, 0, 0], dist: 1 } }),
      part({ id: "adder", label: "Serial adder", short: "Adder", alt: "A block: adds or subtracts one digit at a time.", fn: "The only arithmetic the method needs.", geom: { t: "box", size: [0.9, 0.3, 0.9] }, pos: [2.2, 0.15, -0.6], explode: { axis: [1, 0, 0], dist: 1 } }),
      part({ id: "seq", label: "Sequencer", alt: "A block at the back: steps through the constants.", fn: "Counts how many times each constant fits (q_k) and moves to the next.", geom: { t: "box", size: [1.2, 0.3, 0.8] }, pos: [-3.2, 0.15, 1.2], explode: { axis: [-1, 0, 0], dist: 1 } }),
      part({ id: "stair", label: "Staircase stand (a drawing aid)", short: "Staircase", alt: "A thin post on a disc at the right; the rotation staircase climbs it.", fn: "Not hardware: each step of the staircase is one turn of the vector, drawn at its own height.", material: "plastic", geom: { t: "group", items: [{ t: "cyl", r: 1.4, h: 0.04, seg: 40 }, { t: "cyl", r: 0.03, h: 4.6, seg: 8, pos: [0, 2.3, 0] }] }, pos: [4.6, 0.02, 0], explode: { axis: [1, 0, 0], dist: 1.2 }, noSchematic: true }),
      part({ id: "chip", label: "Chip carrier", alt: "A flat board under the registers.", fn: "Holds the parts.", material: "board", geom: { t: "box", size: [8, 0.1, 4] }, pos: [-0.4, -0.05, 0], explode: { axis: [0, -1, 0], dist: 1.2 }, noSchematic: true }),
    ],
    links: [
      { from: "rom", to: "zreg", label: "atan(10^-k)" }, { from: "zreg", to: "seq", label: "sign, fits?" }, { from: "seq", to: "shift", label: "k" }, { from: "xreg", to: "shift" }, { from: "yreg", to: "shift" },
      { from: "shift", to: "adder", label: "x 10^-k" }, { from: "adder", to: "xreg", back: true, hide3d: true }, { from: "adder", to: "yreg", back: true, hide3d: true },
    ],
    controls: [{ at: "zreg", label: "ANGLE KEY", bind: "knob-th", dy: -2 }],
    knobs: [{ id: "knob-th", label: "Angle", min: 1, max: 89, step: 1, value: 35, unit: " deg" }],
    variants: [{ mode: "decimal", title: "Decimal, as the HP-35 does it", path: ["rom", "zreg", "seq", "shift", "adder", "yreg"], kind: "pass", verdict: "Subtract each constant as many times as it fits. tan = Y / X; the stretch cancels in the ratio." },
      { mode: "binary", title: "Binary CORDIC (Volder, 1959)", path: ["rom", "zreg", "seq", "shift", "adder", "xreg"], kind: "pass", verdict: "One step per bit, either sign. The vector grows by a fixed K = 1.6468." }],
  };
  const TH = (view) => (((view.knobs && view.knobs["knob-th"]) || 35) * Math.PI) / 180;
  const f6 = (x) => (typeof x === "number" ? x.toFixed(6) : x);
  def.sim = (model) => {
    const get = (view) => (view.variant === "binary" ? { rows: binary(TH(view)) } : decimal(TH(view)));
    const stepOf = (u, n) => Math.min(n - 1, Math.floor(u * n));
    return {
      duration: null,
      state: (u, view) => {
        const R = get(view).rows, k = stepOf(u, R.length), boxes = [], lines = [], base = [4.6, 0.3, 0], dec = view.variant !== "binary";
        for (let i = 0; i <= k; i++) {
          const r = R[i], L = Math.hypot(r.x, r.y) || 1, h = base[1] + 0.22 * i, s = 1.25 / (dec ? Math.max(1, L) : 1.6468);
          const tip = [base[0] + r.x * s, h, base[2] - r.y * s];
          lines.push({ pts: [[base[0], h, base[2]], tip], tok: i === k ? "red" : "s2", width: i === k ? 3 : 1 });
          boxes.push({ pos: [(base[0] + tip[0]) / 2, h - 0.06, (base[2] + tip[2]) / 2], size: [Math.abs(tip[0] - base[0]) + 0.06, 0.04, Math.abs(tip[2] - base[2]) + 0.06], tok: i === k ? "red" : "wall2" });
        }
        const t = TH(view);
        lines.push({ pts: [[base[0], base[1], base[2]], [base[0] + 1.35 * Math.cos(t), base[1], base[2] - 1.35 * Math.sin(t)]], tok: "s5", width: 2 });
        const busy = { zreg: { emit: 0.25 }, adder: { emit: 0.25 * (k % 2) }, shift: { emit: 0.25 * ((k + 1) % 2) } };
        return { parts: busy, lines, boxes, flow: (k % 4) / 4, readout: { k } };
      },
      table: (u, view) => {
        const R = get(view).rows, k = stepOf(u, R.length), dec = view.variant !== "binary";
        return { caption: dec ? "HP-35 registers at each step: k is the constant atan(10^-k), q how many times it has fitted so far" : "Binary CORDIC registers: i is the step, d the sign chosen", head: dec ? ["k", "q", "X", "Y", "Z (rad left)"] : ["i", "d", "X", "Y", "Z (rad left)"],
          rows: R.map((r) => [r.i, dec ? r.q : r.d, f6(r.x), f6(r.y), f6(r.z)]), now: k };
      },
      trace: (u, view) => {
        const R = get(view).rows, k = stepOf(u, R.length), xs = Float32Array.from(R, (_, i) => i);
        const ang = Float32Array.from(R, (r) => (Math.atan2(r.y, r.x) * 180) / Math.PI), zz = Float32Array.from(R, (r) => Math.max(1e-9, Math.abs(r.z)));
        return [
          { title: "Angle turned so far, against the target", x: { min: 0, max: R.length - 1, label: "steps" }, y: { min: 0, max: 95, label: "deg" }, cursor: k,
            series: [{ name: "vector angle", x: xs, y: ang, tok: "ink", width: 2, step: true }, { name: "target", x: Float32Array.of(0, R.length - 1), y: Float32Array.of((TH(view) * 180) / Math.PI, (TH(view) * 180) / Math.PI), tok: "s5", dash: true }] },
          { title: "Angle left in Z (log scale): each new constant takes off about one more digit", x: { min: 0, max: R.length - 1, label: "steps" }, y: { min: 1e-9, max: 2, label: "rad", log: true }, cursor: k, series: [{ name: "|Z|", x: xs, y: zz, tok: "s2", width: 2, step: true }] },
        ];
      },
      spacetime: () => {
        const R = binary((35 * Math.PI) / 180), verts = R.map((r, i) => [r.x, r.y, r.z, i]), pid = model.index.get("zreg").index;
        const edges = R.slice(1).map((_, i) => [i, i + 1]);
        return { verts, edges, timelike: edges.map(() => 1), edgePart: edges.map(() => pid), axes: ["X", "Y", "Z left", "step"], angles: [0, 0, 0.35, 0, 0.3, 0] };
      },
    };
  };
  def.checks = () => {
    let K = 1;
    for (let i = 0; i < NB; i++) K *= Math.sqrt(1 + 4 ** -i);
    const th = (35 * Math.PI) / 180, b = binary(th).slice(-1)[0], d1 = decimal(th), d2 = decimal((80 * Math.PI) / 180);
    return [{ name: "binary gain K over 16 steps is 1.6468", got: K, want: 1.646760258, tol: 1e-6 },
      { name: "binary: the final vector points at the angle (within 2^-15 rad)", got: Math.abs(Math.atan2(b.y, b.x) - th), want: 0, tol: 2 ** -15 },
      { name: "decimal: Y / X equals tan(35 deg)", got: d1.tan, want: Math.tan(th), tol: 1e-9 },
      { name: "decimal: the stretch depends on the angle, so 1.6468 does not apply (gain at 80 deg over gain at 35 deg is not 1)", got: Math.abs(d2.gain / d1.gain - 1) > 0.05 ? 1 : 0, want: 1, tol: 0 }];
  };
  def.plain = `<p>A pocket calculator in 1972 had no multiplier and no room for long series, yet it had to give sines, tangents and logarithms in under a second. The trick is very old. Keep a short list of special angles whose tangents are 1, 0.1, 0.01 and so on. To reach an angle, turn a pointer by the biggest special angle that still fits, as many times as it fits, then by the next smaller one, and so on. Turning by an angle whose tangent is 0.01 needs only "shift the digits two places and add". After five sizes the angle left over is tiny.</p>
<p>The 3D view draws each turn as a step of a staircase, the pointer swinging round as it climbs. Switch to binary to see Volder's 1959 version, which turns either way at every step by angles whose tangents are halves, quarters and eighths. The table shows the registers at every step, as HP's own articles did.</p>`;
  def.working = `<p class="math">Binary (Volder 1959): x' = x - d y 2^-i, y' = y + d x 2^-i, z' = z - d atan(2^-i), d = sign(z); |v| grows by K = prod sqrt(1 + 2^-2i) = 1.6468 (16 steps)
Decimal (HP-35; Cochran, HPJ June 1972, pp. 10-11): for k = 0..4, while z >= atan(10^-k): x' = x - y 10^-k, y' = y + x 10^-k, z -= atan(10^-k), q_k += 1
Then one last turn by the residual, tan z = z (|z| < 10^-4, error of order z^2), and tan = y / x. The stretch prod (1 + 10^-2k)^(q_k / 2) changes with the angle; it cancels in the ratio, so it is never computed</p>
<p>Cochran traces the method to Henry Briggs (1624), then to Volder (CORDIC) and Meggitt (pseudo-division and pseudo-multiplication). The HP-35 works in BCD with shifts of whole digits; this page uses floating point to show the same steps, so its digits beyond the tenth are not the calculator's. Quadrant reduction and the sin and cos that follow from tan are left out. The ROM capacity on the block is from the HPJ 1972 block diagram.</p>`;
  def.sources = ["Cochran, Algorithms and Accuracy in the HP-35, HP Journal, June 1972 (HP-GAPS-PRIMARY.md section 4)", "hpcalc.org, The Secret of the Algorithms", "Volder, IRE Trans. EC-8(3), 1959"];
  (g.DiagramDefs = g.DiagramDefs || {}).cordic = def;
  if (typeof module !== "undefined" && module.exports) module.exports = def;
})(typeof globalThis !== "undefined" ? globalThis : this);
