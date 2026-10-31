// SPDX-License-Identifier: FSL-1.1-MIT
// Each space writes per-cell speed ratio, wall and edge absorption.
export const inside = (x, y, a, b, w, h) => x >= a && x < a + w && y >= b && y < b + h;
export const rooms = {
  "Open air": {
    f(x, y) {
      return {};
    },
    s: [256, 256],
    m: [400, 256],
    open: 1,
  },
  "Parabolic dish": {
    f(x, y) {
      const X = x - 110,
        Y = y - 256;
      const d = X - (Y * Y) / (4 * 70);
      return { w: d > -8 && d < 0 && Math.abs(Y) < 170 };
    },
    s: [180, 256],
    m: [180, 256],
    open: 1,
    src2: [470, 256],
  },
  "Elliptical whisper room": {
    f(x, y) {
      const a = 225,
        b = 150,
        c = Math.sqrt(a * a - b * b),
        q = ((x - 256) / a) ** 2 + ((y - 256) / b) ** 2;
      return { w: q > 1 };
    },
    s: [256 - 168, 256],
    m: [256 + 168, 256],
  },
  "Sound lens (Luneburg)": {
    f(x, y) {
      const R = 120,
        r = Math.hypot(x - 256, y - 256) / R;
      return { k: r < 1 ? 1 / Math.sqrt(2 - r * r) : 1 };
    },
    s: [60, 256],
    m: [376, 256],
    open: 1,
  },
  "Sonic crystal": {
    f(x, y) {
      const a = 28;
      if (x < 190 || x > 360 || y < 60 || y > 452) return {};
      const u = ((x - 190 + a * 50) % a) - a / 2,
        v = ((y - 60 + a * 50) % a) - a / 2;
      return { w: Math.hypot(u, v) < 9 };
    },
    s: [90, 256],
    m: [430, 256],
    open: 1,
    bragg: 28,
  },
  "Helmholtz resonator": {
    f(x, y) {
      const bx = inside(x, y, 200, 190, 120, 120),
        ins = inside(x, y, 208, 198, 104, 104),
        neck = inside(x, y, 318, 250, 60, 12),
        nk2 = inside(x, y, 312, 256, 66, 6 - 6);
      const nw = inside(x, y, 312, 244, 60, 6) || inside(x, y, 312, 262, 60, 6);
      return { w: (bx && !ins && !inside(x, y, 312, 250, 8, 12)) || nw };
    },
    s: [440, 256],
    m: [256, 256],
    open: 1,
  },
  "Tapered canal (cochlea)": {
    f(x, y) {
      const w = 70 * (1 - (x - 40) / 430) + 7;
      const yc = 256;
      return {
        w:
          (x > 30 && x < 480 && Math.abs(y - yc) > w && Math.abs(y - yc) < w + 8) ||
          (x >= 480 && x < 488 && Math.abs(y - yc) < w + 8),
        k: x > 30 && x < 480 && Math.abs(y - yc) <= w ? 1 : 1,
      };
    },
    s: [50, 256],
    m: [300, 256],
    open: 1,
  },
  "Double slit": {
    f(x, y) {
      return { w: x > 200 && x < 208 && !(Math.abs(y - 226) < 9 || Math.abs(y - 286) < 9) };
    },
    s: [70, 256],
    m: [420, 256],
    open: 1,
  },
  "Chladni plate": {
    f(x, y) {
      return { w: !inside(x, y, 56, 56, 400, 400) };
    },
    s: [256, 256],
    m: [140, 140],
    view: 1,
  },
  "Rectangular room": {
    f(x, y) {
      return { w: !inside(x, y, 40, 100, 432, 300) };
    },
    s: [60, 120],
    m: [420, 360],
  },
};
