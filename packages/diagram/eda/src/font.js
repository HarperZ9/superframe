// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/eda/font: a single-stroke font for silkscreen, drawn here on a 4 x 6 grid (baseline 0, cap height 6),
   so reference designators can be plotted as strokes in a Gerber. Capitals, digits and + - . / _ only. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const E = (D.EDA = D.EDA || {});
  const S = (s) => s.split(" ").map((p) => p.split(";").map((q) => q.split(",").map(Number)));
  E.GLYPH = {
    A: S("0,0;0,4;2,6;4,4;4,0 0,3;4,3"), B: S("0,0;0,6;3,6;4,5;4,4;3,3;0,3 3,3;4,2;4,1;3,0;0,0"), C: S("4,1;3,0;1,0;0,1;0,5;1,6;3,6;4,5"),
    D: S("0,0;0,6;3,6;4,5;4,1;3,0;0,0"), E: S("4,0;0,0;0,6;4,6 0,3;3,3"), F: S("0,0;0,6;4,6 0,3;3,3"), G: S("4,5;3,6;1,6;0,5;0,1;1,0;3,0;4,1;4,3;2,3"),
    H: S("0,0;0,6 4,0;4,6 0,3;4,3"), I: S("1,0;3,0 2,0;2,6 1,6;3,6"), J: S("0,1;1,0;3,0;4,1;4,6"), K: S("0,0;0,6 4,6;0,2 1,3;4,0"),
    L: S("0,6;0,0;4,0"), M: S("0,0;0,6;2,3;4,6;4,0"), N: S("0,0;0,6;4,0;4,6"), O: S("1,0;0,1;0,5;1,6;3,6;4,5;4,1;3,0;1,0"),
    P: S("0,0;0,6;3,6;4,5;4,4;3,3;0,3"), Q: S("1,0;0,1;0,5;1,6;3,6;4,5;4,1;3,0;1,0 2,2;4,0"), R: S("0,0;0,6;3,6;4,5;4,4;3,3;0,3 2,3;4,0"),
    S: S("4,5;3,6;1,6;0,5;0,4;1,3;3,3;4,2;4,1;3,0;1,0;0,1"), T: S("0,6;4,6 2,6;2,0"), U: S("0,6;0,1;1,0;3,0;4,1;4,6"), V: S("0,6;2,0;4,6"),
    W: S("0,6;1,0;2,3;3,0;4,6"), X: S("0,0;4,6 0,6;4,0"), Y: S("0,6;2,3;4,6 2,3;2,0"), Z: S("0,6;4,6;0,0;4,0"),
    0: S("1,0;0,1;0,5;1,6;3,6;4,5;4,1;3,0;1,0 0,1;4,5"), 1: S("1,5;2,6;2,0 1,0;3,0"), 2: S("0,5;1,6;3,6;4,5;4,4;0,0;4,0"), 3: S("0,5;1,6;3,6;4,5;4,4;3,3;4,2;4,1;3,0;1,0;0,1 1,3;3,3"),
    4: S("3,0;3,6;0,2;4,2"), 5: S("4,6;0,6;0,3;3,3;4,2;4,1;3,0;0,0"), 6: S("4,5;3,6;1,6;0,5;0,1;1,0;3,0;4,1;4,2;3,3;0,3"), 7: S("0,6;4,6;1,0"),
    8: S("1,3;0,4;0,5;1,6;3,6;4,5;4,4;3,3;1,3;0,2;0,1;1,0;3,0;4,1;4,2;3,3"), 9: S("0,1;1,0;3,0;4,1;4,5;3,6;1,6;0,5;0,4;1,3;4,3"),
    "+": S("0,3;4,3 2,1;2,5"), "-": S("0,3;4,3"), ".": S("2,0;2,0.4"), "/": S("0,0;4,6"), _: S("0,0;4,0"), " ": [],
  };
  /* strokes for a string, left-bottom at `at`, cap height h (mm); returns [[x, y], ...] polylines */
  E.textStrokes = (s, at, h) => {
    const k = h / 6, out = [];
    [...String(s).toUpperCase()].forEach((ch, i) => {
      const gl = E.GLYPH[ch] || E.GLYPH["-"];
      for (const pl of gl) out.push(pl.map(([x, y]) => [at[0] + (i * 5.5 + x) * k, at[1] + y * k]));
    });
    return out;
  };
  E.textWidth = (s, h) => (String(s).length * 5.5 - 1.5) * h / 6;

  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof globalThis !== "undefined" ? globalThis : this);
