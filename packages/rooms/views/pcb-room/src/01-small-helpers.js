// ======================================================================= Small helpers
const $ = (id) => document.getElementById(id);
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MASKS = {
  purple: [0.17, 0.045, 0.3],
  green: [0.025, 0.16, 0.075],
  black: [0.012, 0.012, 0.016],
};
const lerp = (a, b, t) => a + (b - a) * t,
  clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const CMAP = (() => {
  const st = [
      [0, 3, 4, 30],
      [0.25, 70, 20, 110],
      [0.5, 180, 50, 90],
      [0.75, 250, 140, 40],
      [1, 252, 245, 170],
    ],
    L = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < 3 && t > st[k + 1][0]) k++;
    const a = st[k],
      b = st[k + 1],
      u = (t - a[0]) / (b[0] - a[0]);
    for (let c = 0; c < 3; c++) L[i * 3 + c] = lerp(a[c + 1], b[c + 1], u);
  }
  return L;
})();
const DIV = (v) => {
  v = clamp(v, 0, 1);
  const u = v < 0.5 ? v * 2 : (v - 0.5) * 2,
    a = v < 0.5 ? [20, 50, 120] : [235, 235, 225],
    b = v < 0.5 ? [235, 235, 225] : [210, 60, 40];
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
};
