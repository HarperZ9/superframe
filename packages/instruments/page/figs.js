// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Instrument Pipeline: the three live figures. Each takes (g, W, H, a, b, mode) and returns a readout line.
   Physics in the browser is the same physics as the Python twin, reduced: no noise, no estimator. */
const FIG = (() => {
  const C = 343, KB = globalThis.MeasuredConstants.kB;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888";
  const face = () => css("--face-utility") || "sans-serif";

  function axes(g, L, T, R, B, xt, yt) {
    g.strokeStyle = css("--line"); g.lineWidth = 1; g.strokeRect(L, T, R - L, B - T);
    g.fillStyle = css("--soft"); g.font = "15px " + face(); g.textBaseline = "alphabetic";
    g.fillText(xt, (L + R) / 2 - g.measureText(xt).width / 2, B + 40);
    g.save(); g.translate(L - 46, (T + B) / 2); g.rotate(-Math.PI / 2); g.fillText(yt, -g.measureText(yt).width / 2, 0); g.restore();
  }

  /* Room: counted modes against Weyl's law for a box of volume V (aspect 1.6 : 1.25 : 1). */
  function room(g, W, H, V, t60) {
    const lz = Math.cbrt(V / 2), d = [1.6 * lz, 1.25 * lz, lz], FM = 200, f = [];
    const m = d.map(x => Math.floor(2 * FM * x / C) + 1);
    for (let i = 0; i < m[0]; i++) for (let j = 0; j < m[1]; j++) for (let k = 0; k < m[2]; k++) {
      const v = 0.5 * C * Math.hypot(i / d[0], j / d[1], k / d[2]); if (v > 0 && v < FM) f.push(v);
    }
    f.sort((a, b) => a - b);
    const S = 2 * (d[0] * d[1] + d[1] * d[2] + d[0] * d[2]), Lt = 4 * (d[0] + d[1] + d[2]);
    const weyl = x => 4 * Math.PI * V * x ** 3 / (3 * C ** 3) + Math.PI * S * x ** 2 / (4 * C * C) + Lt * x / (8 * C);
    const B = 2.2 / t60, res = (w) => f.filter((x, i) => (i === 0 || x - f[i - 1] > w) && (i === f.length - 1 || f[i + 1] - x > w));
    const pen = res(0.3 * B), fou = res(2 * B);
    const L = 80, T = 24, R = W - 24, Bt = H - 64, nMax = Math.max(10, weyl(FM) * 1.05);
    const X = x => L + x / FM * (R - L), Y = n => Bt - n / nMax * (Bt - T);
    g.fillStyle = css("--line"); g.globalAlpha = 0.25; g.fillRect(X(20), T, X(150) - X(20), Bt - T); g.globalAlpha = 1;
    axes(g, L, T, R, Bt, "frequency, Hz", "modes below f");
    g.fillStyle = css("--soft");
    for (let x = 0; x <= FM; x += 50) { g.fillText(String(x), X(x) - 10, Bt + 18); g.fillRect(X(x), Bt, 1, 5); }
    for (let n = 0; n <= nMax; n += Math.max(10, Math.round(nMax / 50) * 10)) { g.fillText(String(n), L - 34, Y(n) + 5); }
    const stair = (arr, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(X(0), Y(0));
      arr.forEach((x, i) => { g.lineTo(X(x), Y(i)); g.lineTo(X(x), Y(i + 1)); }); g.lineTo(X(FM), Y(arr.length)); g.stroke(); };
    g.strokeStyle = css("--s1"); g.lineWidth = 2; g.setLineDash([6, 5]); g.beginPath();
    for (let x = 0; x <= FM; x += 1) { const y = Y(weyl(x)); x ? g.lineTo(X(x), y) : g.moveTo(X(x), y); } g.stroke(); g.setLineDash([]);
    stair(f, css("--ink"), 2); stair(pen, css("--tide-2"), 3); stair(fou, css("--soft"), 2);
    const fs = 2000 * Math.sqrt(t60 / V);
    if (fs < FM) { g.fillStyle = css("--ember-1"); g.fillRect(X(fs), T, 2, Bt - T); g.fillText("Schroeder", X(fs) + 4, T + 16); }
    g.font = "14px " + face();
    [["every mode", "--ink"], ["split by the matrix pencil", "--tide-2"], ["split by Fourier peaks", "--soft"], ["Weyl's law", "--s1"]]
      .forEach(([t, c], i) => { g.fillStyle = css(c); g.fillRect(L + 12, T + 12 + i * 20, 18, 4); g.fillStyle = css("--ink"); g.fillText(t, L + 36, T + 18 + i * 20); });
    const n150 = f.filter(x => x < 150).length, p150 = pen.filter(x => x < 150).length, q150 = fou.filter(x => x < 150).length;
    return `Below 150 Hz this room has ${n150} modes; the pencil can split ${p150} of them and Fourier peak picking ${q150}. Schroeder frequency ${Math.round(fs)} Hz.`;
  }

  /* Thermometer: input noise densities and the averaging-time bound. */
  function jnt(g, W, H, Rk, tSec) {
    const R = Rk * 1e3, T = 300, er = Math.sqrt(4 * KB * T * R) * 1e9, en = 5.1, inR = 0.8e-15 * R * 1e9, adc = 0.05;
    const a = en * en / (er * er), Bw = 9e3, dT = (1 + a) / Math.sqrt(Bw * tSec), fc = 1 / (2 * Math.PI * R * 20e-12);
    const bias = 1 - 1 / (1 + (1e4 / fc) ** 2);
    const rows = [["resistor (the signal)", er, "--tide-2"], ["amplifier voltage noise", en, "--s1"], ["amplifier current noise x R", inR, "--s3"], ["converter, referred to input", adc, "--soft"]];
    const L = 250, Tp = 30, Rr = W - 30, Bt = H - 70, lo = -3, hi = 3;
    const X = v => L + (Math.log10(Math.max(v, 1e-3)) - lo) / (hi - lo) * (Rr - L);
    axes(g, L, Tp, Rr, Bt, "noise density, nV per root hertz (log)", "");
    g.fillStyle = css("--soft"); g.font = "15px " + face();
    for (let e = lo; e <= hi; e++) { g.fillText(e >= 0 ? String(10 ** e) : "1e" + e, X(10 ** e) - 12, Bt + 18); g.fillRect(X(10 ** e), Bt, 1, 5); }
    const h = (Bt - Tp) / (rows.length + 1);
    rows.forEach(([t, v, c], i) => { const y = Tp + h * (i + 0.5); g.fillStyle = css(c); g.fillRect(L, y, Math.max(2, X(v) - L), h * 0.55);
      g.fillStyle = css("--ink"); g.fillText(t, 12, y + h * 0.4); g.fillText(v < 0.1 ? v.toExponential(1) : v.toFixed(1), Math.min(X(v) + 6, Rr - 50), y + h * 0.4); });
    const y = Tp + h * (rows.length + 0.4);
    g.fillStyle = css("--ink"); g.fillText(`after ${fmtT(tSec)}: dT/T = ${(100 * dT).toFixed(3)} %  (${(dT * T * 1000).toFixed(0)} mK at 300 K)`, 12, y + 10);
    g.fillText(`input roll-off at 10 kHz with 20 pF: Re Z low by ${(100 * bias).toPrecision(2)} %`, 12, y + 34);
    return `A ${Rk.toFixed(Rk < 10 ? 1 : 0)} kOhm resistor hisses at ${er.toFixed(1)} nV per root hertz; averaged ${fmtT(tSec)}, the reading is good to ${(100 * dT).toFixed(2)} percent. Larger resistors hiss louder but roll off sooner.`;
  }
  const fmtT = s => s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;

  /* Polariscope: isochromatic colours of a disc in diametral compression (Frocht's closed form). */
  const gs = (l, m, s1, s2) => Math.exp(-0.5 * ((l - m) / (l < m ? s1 : s2)) ** 2);
  const cmf = l => [1.056 * gs(l, 599.8, 37.9, 31.0) + 0.362 * gs(l, 442.0, 16.0, 26.7) - 0.065 * gs(l, 501.1, 20.4, 26.2),
    0.821 * gs(l, 568.8, 46.9, 40.5) + 0.286 * gs(l, 530.9, 16.3, 31.1), 1.217 * gs(l, 437.0, 11.8, 36.0) + 0.681 * gs(l, 459.0, 26.0, 13.8)];
  const SRC = { day: l => 1, screen: l => gs(l, 455, 12, 12) + 0.9 * gs(l, 535, 18, 18) + 0.8 * gs(l, 615, 14, 14), green: l => gs(l, 535, 15, 15) };
  const lutCache = {};
  function lut(mode) {
    if (lutCache[mode]) return lutCache[mode];
    const n = 800, out = new Uint8ClampedArray(n * 3), src = SRC[mode];
    let Yw = 0; for (let l = 400; l <= 700; l += 2) Yw += src(l) * cmf(l)[1];
    for (let i = 0; i < n; i++) {
      const G = i * 5; let X = 0, Y = 0, Z = 0;
      for (let l = 400; l <= 700; l += 2) { const s = src(l) * Math.sin(Math.PI * G / l) ** 2, c = cmf(l); X += s * c[0]; Y += s * c[1]; Z += s * c[2]; }
      X /= Yw; Y /= Yw; Z /= Yw;
      const rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
      rgb.forEach((v, k) => { v = Math.max(0, Math.min(1, v)); out[i * 3 + k] = 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055); });
    }
    return (lutCache[mode] = out);
  }
  let off = null;
  function polar(g, W, H, P, fsig, mode) {
    const N = 220, Dmm = 50, R = Dmm / 2, tab = lut(mode);
    if (!off) { off = document.createElement("canvas"); off.width = off.height = N; }
    const o = off.getContext("2d"), img = o.createImageData(N, N), k = 2 * P / Math.PI;
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const x = (px + 0.5) / N * Dmm - R, y = R - (py + 0.5) / N * Dmm, i4 = 4 * (py * N + px);
      if (x * x + y * y > R * R) { img.data[i4 + 3] = 0; continue; }
      const r1 = x * x + (R - y) ** 2, r2 = x * x + (R + y) ** 2;
      const sx = -k * ((R - y) * x * x / (r1 * r1) + (R + y) * x * x / (r2 * r2) - 1 / Dmm);
      const sy = -k * ((R - y) ** 3 / (r1 * r1) + (R + y) ** 3 / (r2 * r2) - 1 / Dmm);
      const txy = k * ((R - y) ** 2 * x / (r1 * r1) - (R + y) ** 2 * x / (r2 * r2));
      const Nf = Math.sqrt((sx - sy) ** 2 + 4 * txy * txy) / fsig, j = Math.min(799, Math.round(Nf * 570 / 5));
      img.data[i4] = tab[3 * j]; img.data[i4 + 1] = tab[3 * j + 1]; img.data[i4 + 2] = tab[3 * j + 2]; img.data[i4 + 3] = 255;
    }
    o.putImageData(img, 0, 0);
    const s = Math.min(W * 0.62, H - 60), x0 = 30, y0 = (H - s) / 2;
    g.fillStyle = "#050505"; g.fillRect(x0 - 6, y0 - 6, s + 12, s + 12);
    g.imageSmoothingEnabled = true; g.drawImage(off, x0, y0, s, s);
    g.fillStyle = css("--ink"); g.beginPath(); g.moveTo(x0 + s / 2, y0 - 6); g.lineTo(x0 + s / 2 - 10, y0 - 22); g.lineTo(x0 + s / 2 + 10, y0 - 22); g.fill();
    g.beginPath(); g.moveTo(x0 + s / 2, y0 + s + 6); g.lineTo(x0 + s / 2 - 10, y0 + s + 22); g.lineTo(x0 + s / 2 + 10, y0 + s + 22); g.fill();
    const Nc = 8 * P / (Math.PI * Dmm * fsig), tx = x0 + s + 30;
    g.font = "16px " + face(); g.fillStyle = css("--ink");
    [`load ${Math.round(P)} N`, `disc 50 mm`, `centre: N = 8P / (pi D f)`, `       = ${Nc.toFixed(2)} fringes`, mode === "green" ? "one colour: count dark rings" : "white: read order by colour"]
      .forEach((t, i) => g.fillText(t, tx, y0 + 24 + i * 26));
    return `Squeezing the disc with ${Math.round(P)} N puts ${Nc.toFixed(2)} fringe orders at its centre; calibration reads this number back to find the sheet's sensitivity.`;
  }
  return { room, jnt, polar };
})();
