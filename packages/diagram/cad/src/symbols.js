// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/cad/symbols: the schematic symbol library. Coordinates in millimetres with y up, the KiCad library
   convention, on a 1.27 mm grid so every pin end lands on KiCad's connection grid. A pin's `at` is its
   connection point and `ang` the direction from that point toward the body (0 right, 90 up, 180 left, 270 down).
   Shapes: IEC 60617 for resistors (rectangle), capacitors, switches, cells, ground and connectors; the IEEE 315
   triangle for operational amplifiers. Optical symbols carry light, not current, and never go to KiCad. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const C = (D.CAD = D.CAD || {});
  const pin = (num, name, at, ang, len, type = "passive") => ({ num, name, at, ang, len, type });
  const P = (...pts) => ({ poly: pts });

  C.SYM = {
    R: { desc: "Resistor", refp: "R", units: [{ body: [{ rect: [-1.016, -2.54, 1.016, 2.54] }], pins: [pin("1", "~", [0, 3.81], 270, 1.27), pin("2", "~", [0, -3.81], 90, 1.27)] }], refAt: [2.286, 0.9], valAt: [2.286, -1.4] },
    C: { desc: "Capacitor", refp: "C", units: [{ body: [P([-2.032, 0.762], [2.032, 0.762]), P([-2.032, -0.762], [2.032, -0.762])], pins: [pin("1", "~", [0, 3.81], 270, 3.048), pin("2", "~", [0, -3.81], 90, 3.048)] }], refAt: [2.794, 0.9], valAt: [2.794, -1.4] },
    OPA2: {
      desc: "Dual operational amplifier (unit A carries the supply pins)", refp: "U",
      units: [1, 2].map((u) => ({
        body: [P([-5.08, 5.08], [5.08, 0], [-5.08, -5.08], [-5.08, 5.08]), { text: [-3.81, 2.54, "+"] }, { text: [-3.81, -2.54, "-"] }],
        pins: (u === 1 ? [pin("3", "+", [-7.62, 2.54], 0, 2.54, "input"), pin("2", "-", [-7.62, -2.54], 0, 2.54, "input"), pin("1", "~", [7.62, 0], 180, 2.54, "output"),
          pin("8", "V+", [-2.54, 7.62], 270, 3.81, "power_in"), pin("4", "V-", [-2.54, -7.62], 90, 3.81, "power_in")]
          : [pin("5", "+", [-7.62, 2.54], 0, 2.54, "input"), pin("6", "-", [-7.62, -2.54], 0, 2.54, "input"), pin("7", "~", [7.62, 0], 180, 2.54, "output")]),
      })), refAt: [1.27, 6.35], valAt: [1.27, -6.6],
    },
    SW1: { desc: "Switch contact, one way (reed relay contact; coil not drawn)", refp: "K", units: [{ body: [P([-2.54, 0], [2.032, 2.032]), { circle: [-2.54, 0, 0.4] }, { circle: [2.54, 0, 0.4] }], pins: [pin("1", "~", [-5.08, 0], 0, 2.54), pin("2", "~", [5.08, 0], 180, 2.54)] }], refAt: [0, 3.6], valAt: [0, -2.4] },
    SW2: { desc: "Changeover contact (reed relay; coil not drawn), rests on NC", refp: "K",
      units: [{ body: [P([-2.54, 0], [2.54, 2.286]), { circle: [-2.54, 0, 0.4] }, { circle: [2.54, 2.54, 0.4] }, { circle: [2.54, -2.54, 0.4] }],
        pins: [pin("1", "COM", [-5.08, 0], 0, 2.54), pin("2", "NC", [5.08, 2.54], 180, 2.54), pin("3", "NO", [5.08, -2.54], 180, 2.54)] }], refAt: [0, 4.9], valAt: [0, -4.4] },
    BAT3: { desc: "Split battery pack, plus, midpoint, minus", refp: "BT",
      units: [{ body: [P([-2.54, 2.54], [2.54, 2.54]), P([-1.27, 1.27], [1.27, 1.27]), P([0, 1.27], [0, -1.27]), P([-2.54, -1.27], [2.54, -1.27]), P([-1.27, -2.54], [1.27, -2.54]), { text: [-3.6, 3.4, "+"] }],
        pins: [pin("1", "+", [0, 7.62], 270, 5.08, "power_out"), pin("2", "M", [5.08, 0], 180, 5.08, "power_out"), pin("3", "-", [0, -7.62], 90, 5.08, "power_out")] }], refAt: [-3.3, 0.9], valAt: [-3.3, -1.4], refJust: "right" },
    JACK3: { desc: "Three-contact connector (tip, ring, sleeve)", refp: "J", units: [{ body: [{ rect: [-2.54, -3.81, 2.54, 3.81] }], pins: [pin("T", "T", [-5.08, 2.54], 0, 2.54), pin("R", "R", [-5.08, 0], 0, 2.54), pin("S", "S", [-5.08, -2.54], 0, 2.54)] }], refAt: [0, 5.2], valAt: [0, -5.6], names: true },
    JACK3R: { desc: "Three-contact connector (tip, ring, sleeve), contacts on the right", refp: "J", units: [{ body: [{ rect: [-2.54, -3.81, 2.54, 3.81] }], pins: [pin("T", "T", [5.08, 2.54], 180, 2.54), pin("R", "R", [5.08, 0], 180, 2.54), pin("S", "S", [5.08, -2.54], 180, 2.54)] }], refAt: [0, 5.2], valAt: [0, -5.6], names: true },
    CONN3G: { desc: "Guarded probe connector (signal, guard, shield)", refp: "J", units: [{ body: [{ rect: [-2.54, -3.81, 2.54, 3.81] }], pins: [pin("1", "SIG", [5.08, 2.54], 180, 2.54), pin("2", "GRD", [5.08, 0], 180, 2.54), pin("3", "SHD", [5.08, -2.54], 180, 2.54)] }], refAt: [0, 5.2], valAt: [0, -5.6], names: true },
    CONN2: { desc: "Two-contact connector", refp: "J", units: [{ body: [{ rect: [-2.54, -2.54, 2.54, 2.54] }], pins: [pin("1", "1", [5.08, 1.27], 180, 2.54), pin("2", "2", [5.08, -1.27], 180, 2.54)] }], refAt: [0, 3.9], valAt: [0, -4.3], names: true },
    NT: { desc: "Net tie, the one point where two ground islands meet", refp: "NT", units: [{ body: [{ rect: [-1.27, -0.508, 1.27, 0.508], fill: true }], pins: [pin("1", "~", [-2.54, 0], 0, 1.27), pin("2", "~", [2.54, 0], 180, 1.27)] }], refAt: [0, 1.9], valAt: [0, -2.4] },
    /* optical train: a block per element, light in on the left, out on the right */
    SRC: { desc: "Light source (polarised screen)", refp: "L", optical: true, units: [{ body: [{ rect: [-3.81, -3.81, 3.81, 3.81] }, P([-1.6, -1.6], [1.6, 1.6]), P([-1.6, 1.6], [1.6, -1.6]), { circle: [0, 0, 2.2] }], pins: [pin("o", "out", [6.35, 0], 180, 2.54)] }], refAt: [0, 5.2], valAt: [0, -5.6] },
    POL: { desc: "Linear polariser", refp: "P", optical: true, units: [{ body: [{ circle: [0, 0, 3.81] }, P([-2.69, -2.69], [2.69, 2.69])], pins: [pin("i", "in", [-6.35, 0], 0, 2.54), pin("o", "out", [6.35, 0], 180, 2.54)] }], refAt: [0, 5.2], valAt: [0, -5.6] },
    SPEC: { desc: "Birefringent specimen under load", refp: "S", optical: true, units: [{ body: [{ rect: [-3.81, -3.81, 3.81, 3.81] }, P([-3.81, -1.27], [-1.27, -3.81]), P([-3.81, 1.27], [1.27, -3.81]), P([-3.81, 3.81], [3.81, -3.81]), P([-1.27, 3.81], [3.81, -1.27]), P([1.27, 3.81], [3.81, 1.27])], pins: [pin("i", "in", [-6.35, 0], 0, 2.54), pin("o", "out", [6.35, 0], 180, 2.54)] }], refAt: [0, 5.2], valAt: [0, -5.6] },
    CAM: { desc: "Camera (detector)", refp: "CAM", optical: true, units: [{ body: [{ rect: [-2.54, -3.81, 5.08, 3.81] }, { circle: [-0.254, 0, 1.778] }], pins: [pin("i", "in", [-5.08, 0], 0, 2.54)] }], refAt: [1.27, 5.2], valAt: [1.27, -5.6] },
    /* power symbols: the net name is the symbol's value and its one hidden pin's name */
    GND: { desc: "Ground (signal reference)", power: true, refp: "#PWR", units: [{ body: [P([0, 0], [0, -1.27]), P([-1.524, -1.27], [1.524, -1.27]), P([-0.889, -1.905], [0.889, -1.905]), P([-0.254, -2.54], [0.254, -2.54])], pins: [pin("1", "GND", [0, 0], 270, 0, "power_in")] }], valAt: [0, -4.1] },
    PWR: { desc: "Positive supply rail", power: true, refp: "#PWR", units: [{ body: [P([0, 0], [0, 1.27]), P([-1.27, 1.27], [1.27, 1.27])], pins: [pin("1", "PWR", [0, 0], 90, 0, "power_in")] }], valAt: [0, 2.6] },
    PWRN: { desc: "Negative supply rail", power: true, refp: "#PWR", units: [{ body: [P([0, 0], [0, -1.27]), P([-1.27, -1.27], [1.27, -1.27]), P([-0.762, -1.27], [0, -2.286], [0.762, -1.27])], pins: [pin("1", "PWRN", [0, 0], 270, 0, "power_in")] }], valAt: [0, -3.6] },
  };

  /* The power symbol that draws a power net, from its name. */
  C.powerSym = (net) => (/^GND|GND$|^0V/.test(net) ? "GND" : /-$|^-|NEG/.test(net) ? "PWRN" : "PWR");

  /* Rotate a library point by r degrees counter-clockwise (multiples of 90), then place it on the sheet (y down). */
  C.rotLib = (p, r) => { const k = ((r % 360) + 360) % 360; return k === 90 ? [-p[1], p[0]] : k === 180 ? [-p[0], -p[1]] : k === 270 ? [p[1], -p[0]] : [p[0], p[1]]; };
  C.libToSheet = (at, rot, p) => { const q = C.rotLib(p, rot); return [C.g(at[0] + q[0]), C.g(at[1] - q[1])]; };
  /* Snap to 1e-4 mm so sums of grid values compare exactly. */
  C.g = (x) => Math.round(x * 1e4) / 1e4;

  /* Bounding box of one unit's body and pins, in library coordinates. */
  C.unitBox = (U) => {
    const xs = [], ys = [];
    for (const b of U.body) {
      if (b.rect) { xs.push(b.rect[0], b.rect[2]); ys.push(b.rect[1], b.rect[3]); }
      if (b.poly) for (const q of b.poly) { xs.push(q[0]); ys.push(q[1]); }
      if (b.circle) { xs.push(b.circle[0] - b.circle[2], b.circle[0] + b.circle[2]); ys.push(b.circle[1] - b.circle[2], b.circle[1] + b.circle[2]); }
    }
    for (const p of U.pins) { xs.push(p.at[0]); ys.push(p.at[1]); }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
})(typeof globalThis !== "undefined" ? globalThis : this);
