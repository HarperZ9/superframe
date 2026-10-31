// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/footprints: land patterns, generated here. Pad sizes for the standard packages follow the common
   IPC-7351 nominal lands as remembered (from memory, unverified against the standard; no part is ordered from them).
   Off-board parts (panel connectors, battery holders, probe leads) land on through-hole wire pads.
   A footprint: { name, pads: [{ num, at: [x, y], w, h, shape, drill?, side: "F" | "both" }], body: [w, h], height, tie? } */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});

  const chip = (name, pitch, w, h, body, height) => ({ name, pads: [{ num: "1", at: [-pitch / 2, 0], w, h, shape: "rect", side: "F" }, { num: "2", at: [pitch / 2, 0], w, h, shape: "rect", side: "F" }], body, height, smd: true });
  const soic8 = () => {
    const pads = [];
    for (let i = 0; i < 4; i++) pads.push({ num: String(i + 1), at: [-2.475, 1.905 - i * 1.27], w: 1.95, h: 0.6, shape: "rect", side: "F" });
    for (let i = 0; i < 4; i++) pads.push({ num: String(8 - i), at: [2.475, 1.905 - i * 1.27], w: 1.95, h: 0.6, shape: "rect", side: "F" });
    return { name: "SOIC-8", pads, body: [3.9, 4.9], height: 1.75, smd: true, pin1: [-2.475, 1.905] };
  };
  const wire = (name, nums, pitch = 2.54, dia = 2.0, drill = 1.0) => ({
    name, pads: nums.map((n, i) => ({ num: n, at: [(i - (nums.length - 1) / 2) * pitch, 0], w: i === 0 ? dia : dia, h: dia, shape: i === 0 ? "rect" : "circle", drill, side: "both" })),
    body: [nums.length * pitch + 0.6, dia + 0.8], height: 0.1, smd: false,
  });
  const reed = (name, nums) => Object.assign(wire(name, nums, 5.08, 1.6, 0.8), { body: [nums.length * 5.08 + 2, 5], height: 7, note: "coil pins are not in the netlist; the drive is not modelled" });

  E.FP = {
    R0805: chip("R_0805", 1.825, 1.025, 1.4, [2.0, 1.25], 0.5),
    C1206: chip("C_1206", 2.925, 1.125, 1.75, [3.2, 1.6], 1.0),
    SOIC8: soic8(),
    NETTIE: { name: "NetTie-2", pads: [{ num: "1", at: [-0.4, 0], w: 0.5, h: 0.5, shape: "rect", side: "F" }, { num: "2", at: [0.4, 0], w: 0.5, h: 0.5, shape: "rect", side: "F" }], bridge: [[-0.4, 0], [0.4, 0], 0.3], body: [1.5, 0.8], height: 0.035, tie: true, smd: true },
    W2: wire("WirePad-2", ["1", "2"]), W3: wire("WirePad-3", ["1", "2", "3"]), J3: wire("WirePad-3", ["T", "R", "S"]),
    K2: reed("Reed-SIP-2", ["1", "2"]), K3: reed("Reed-SIP-3", ["1", "2", "3"]),
  };
  E.FP_SOURCE = "IPC-7351 nominal lands for 0805, 1206 and SOIC-8, from memory, unverified; wire pads and reed relay pitch are this board's own choice";

  /* netlist component to footprint: by the KiCad footprint name it carries, else by its symbol */
  E.footprintFor = (c) => {
    if (/R_0805/.test(c.fp || "")) return E.FP.R0805;
    if (/C_1206/.test(c.fp || "")) return E.FP.C1206;
    if (/SOIC-8/.test(c.fp || "")) return E.FP.SOIC8;
    if (/NetTie/.test(c.fp || "")) return E.FP.NETTIE;
    return { CONN2: E.FP.W2, BAT3: E.FP.W3, JACK3: E.FP.J3, SW1: E.FP.K2, SW2: E.FP.K3 }[c.sym] || null;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);
