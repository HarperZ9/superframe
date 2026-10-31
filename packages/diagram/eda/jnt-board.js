// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* The thermometer's board: outline from the model's pcb part, zones for the two chains and the input switch
   matrix, two bottom-layer ground islands that meet only at the net tie NT1, then place, route, pour and check.
   Board coordinates: millimetres, origin at the back-left corner, y toward the front panel. */
"use strict";
const { C, E } = require("./load.js");

const ZONE = (P) => {
  const n = Object.values(P.comp.pins).join(" ");
  if (/\b(B_\w+|VB[+-]|GND_B)\b/.test(n)) return "B";
  if (/\b(A_\w+|VA[+-])\b/.test(n)) return "A";
  return "IN";
};

const build = (over = {}, opt = {}) => {
  const R = C.resolve(C.REG.jnt, over);
  const B = E.makeBoard(R, { classMap: { IN: "input", SENSE_R: "input", REF_R: "input", INJ: "input" } });
  const mid = B.w / 2;
  B.pours = [{ net: "GND_A", layer: "B", rect: [0, 0, mid - 0.4, B.h] }, { net: "GND_B", layer: "B", rect: [mid + 0.4, 0, B.w, B.h] }];
  E.place(B, {
    zones: { A: [2, 2, mid - 3, B.h * 0.62], B: [mid + 3, 2, B.w - 2, B.h * 0.62], IN: [mid - 30, B.h * 0.62, mid + 30, B.h - 2] },
    zoneOf: ZONE,
    anchors: { BT1: [9, 5, 0], BT2: [B.w - 9, 5, 0], J1: [10, B.h - 5, 0], NT1: [mid, B.h * 0.3, 0] },
  });
  if (opt.route !== false) E.autoroute(B, opt);
  return { R, B };
};

module.exports = { build, ZONE };
