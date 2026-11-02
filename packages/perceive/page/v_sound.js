// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive page: sound bridges. A bat call heterodyned into hearing; the ring-channel series audified so the
   years can be heard; the law table's 8D signatures played as chords, one voice per axis. */
(function () {
  "use strict";
  const PV = window.PV, P = PV.P, $ = PV.$;
  const FS = 384000, DEC = 8;

  /* Bat detector. */
  const B = { lo: 45000, kind: "fm" };
  const CALLS = { fm: { f0: 75000, f1: 45000, sweepMs: 3, cfMs: 4, name: "a frequency-modulated sweep, 75 to 45 kHz (pipistrelle-like)" },
    cf: { f0: 83000, f1: 83000, sweepMs: 0.01, cfMs: 30, name: "a constant 83 kHz call (horseshoe-bat-like)" } };
  const track = (c, t) => (t < c.sweepMs / 1000 ? c.f0 + (c.f1 - c.f0) * (t / (c.sweepMs / 1000)) : c.f1);
  PV.def({
    id: "bat", bridge: "sound", label: "A bat call's pitch over time, far above hearing, with the detector's tuning line; below, the pitch you hear once it is heterodyned down.",
    init() {
      $("#bat-lo").addEventListener("input", (e) => { B.lo = +e.target.value * 1000; PV.update(); });
      $("#bat-kind").addEventListener("change", (e) => { B.kind = e.target.value; PV.update(); });
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, 0.6), c = CALLS[B.kind], t = PV.tok, dur = (c.sweepMs + c.cfMs) / 1000;
      const top = 20, mid = h * 0.52, bot = h - 30, fmax = 110000;
      const Y1 = (f) => mid - (f / fmax) * (mid - top), Y2 = (f) => bot - (f / 20000) * (bot - mid - 28), X = (s) => 50 + (s / dur) * (w - 70);
      ctx.fillStyle = t.line; ctx.fillRect(50, Y1(20000), w - 70, Y1(0) - Y1(20000));
      PV.text(ctx, "hearing, below 20 kHz", 54, Y1(20000) + 12, { size: 11, color: t.soft });
      PV.text(ctx, "the call, as the bat makes it (0 to 110 kHz)", 50, top - 6, { size: 11, color: t.soft });
      ctx.setLineDash([5, 4]); ctx.strokeStyle = t.tide; ctx.beginPath(); ctx.moveTo(50, Y1(B.lo)); ctx.lineTo(w - 20, Y1(B.lo)); ctx.stroke(); ctx.setLineDash([]);
      PV.text(ctx, "tuned to " + (B.lo / 1000).toFixed(1) + " kHz", w - 22, Y1(B.lo) - 5, { size: 11, color: t.tide, align: "right" });
      const hear = P.bridge(P.window(20, 20000, "log"), P.window(380, 750, "linear"), true);
      ctx.lineWidth = 3;
      for (let i = 0; i < 200; i++) {
        const s0 = (i / 200) * dur, s1 = ((i + 1) / 200) * dur, f0 = track(c, s0), f1 = track(c, s1);
        ctx.strokeStyle = t.ink; ctx.beginPath(); ctx.moveTo(X(s0), Y1(f0)); ctx.lineTo(X(s1), Y1(f1)); ctx.stroke();
        const d0 = Math.abs(f0 - B.lo), d1 = Math.abs(f1 - B.lo);
        if (d0 < 15000 && d0 > 20) { ctx.strokeStyle = P.css(P.spectralRgb(hear.map(Math.max(20, d0))).rgb); ctx.beginPath(); ctx.moveTo(X(s0), Y2(d0)); ctx.lineTo(X(s1), Y2(d1)); ctx.stroke(); }
      }
      ctx.lineWidth = 1; ctx.fillStyle = t.ink; ctx.fillRect(50, bot, w - 70, 1);
      PV.text(ctx, "what you hear: |f - tuning|, 0 to 20 kHz (the detector cuts above 15 kHz)", 50, mid + 20, { size: 11, color: t.soft });
      PV.text(ctx, "0 ms", 50, bot + 16, { size: 11, color: t.soft }); PV.text(ctx, (dur * 1000).toFixed(0) + " ms", w - 20, bot + 16, { size: 11, color: t.soft, align: "right" });
    },
    describe() {
      const c = CALLS[B.kind], a = Math.abs(c.f0 - B.lo), b = Math.abs(c.f1 - B.lo);
      const heard = (d) => (d <= 15000 ? (d / 1000).toFixed(1) + " kHz" : "above the detector's 15 kHz cut, so silent");
      return `The call is ${c.name}, lasting ${(c.sweepMs + c.cfMs).toFixed(0)} ms, far above the 20 kHz top of human hearing. The detector is tuned to ${(B.lo / 1000).toFixed(1)} kHz. The start of the call is heard at ${heard(a)}, the end at ${heard(b)}.`;
    },
    loss() {
      const c = CALLS[B.kind], xs = [];
      for (let f = 20000; f <= 120000; f += 100) xs.push(f);
      const l = P.lossBits(xs, (f) => { const d = Math.abs(f - B.lo); return d > 15000 ? "cut" : Math.round(d / 100); });
      return { map: `heterodyne: multiply by a ${(B.lo / 1000).toFixed(1)} kHz oscillator and low-pass at 15 kHz, leaving |f - f_LO|; time and loudness are kept as they are.`,
        bits: `Over 20 to 120 kHz in 100 Hz steps: ${l.bitsSource.toFixed(2)} bits in, ${l.bitsKept.toFixed(2)} out, ${l.bitsLost.toFixed(2)} lost: tones the same distance above and below the tuning sound alike, and tones more than 15 kHz away are cut.`,
        loses: "which side of the tuning a tone sat on; everything more than 15 kHz from the tuning; the call's own phase", inverse: "Invertible only when you know which side of the tuning the call sits on: then f = f_LO plus or minus the heard pitch." + (c.f0 > B.lo && c.f1 > B.lo ? " Here the whole call is above the tuning, so it is." : "") };
    },
    sound(textOnly) {
      const txt = "the call heterodyned down, repeated about eight times a second like a hunting bat: chirps whose pitch is the distance from the tuning.";
      if (textOnly) return { text: txt };
      const c = CALLS[B.kind], call = P.batCall(FS, c), het = P.decimate(P.heterodyne(call, FS, B.lo, 15000), DEC);
      const rate = FS / DEC, buf = new Float32Array(Math.round(rate * 0.12)), pk = Math.max(1e-9, ...het.map(Math.abs));
      for (let i = 0; i < Math.min(het.length, buf.length); i++) buf[i] = (het[i] / pk) * 0.8;
      return { buffer: [buf], rate, text: txt };
    },
    haptic() { return [1, 0.6, 1, 0.6]; },
  });

  /* Tree rings and Alpine summers. */
  const RN = { rw: "ring width", ew: "early wood width", lw: "late wood width", mind: "minimum density", mxd: "maximum late-wood density" };
  const CN = { temp: "summer temperature", prec: "summer rainfall", sun: "summer sunshine" };
  const R = { ring: "mxd", clim: "temp", read: null };
  let RD = null;
  const zPitch = () => P.bridge(P.window(-3, 3, "linear"), P.window(220, 1760, "mel"));
  const zHue = () => P.bridge(P.window(-3, 3, "linear"), P.window(450, 650, "linear"));
  const corr = (a, b) => { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
  PV.def({
    id: "rings", bridge: "sound", label: "Two lines over the years 1901 to 1974: a tree-ring measure and a summer climate measure, each with a colour strip of its values.",
    init() {
      RD = JSON.parse($("#rings-data").textContent);
      $("#ring-s").addEventListener("change", (e) => { R.ring = e.target.value; PV.update(); });
      $("#clim-s").addEventListener("change", (e) => { R.clim = e.target.value; PV.update(); });
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, 0.6), t = PV.tok, yrs = RD.years, a = RD.ring[R.ring], b = RD.climate[R.clim], hue = zHue();
      const X = (i) => 40 + (i / (yrs.length - 1)) * (w - 60), mid = h * 0.42, sc = h * 0.11;
      ctx.fillStyle = t.line; ctx.fillRect(40, mid, w - 60, 1);
      const line = (arr, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath(); arr.forEach((v, i) => { const y = mid - v * sc; i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y); }); ctx.stroke(); ctx.setLineDash([]); };
      line(b, t.red, [5, 4]); line(a, t.tide, []);
      const strip = (arr, y) => arr.forEach((v, i) => { ctx.fillStyle = P.css(P.spectralRgb(hue.map(Math.max(-3, Math.min(3, v)))).rgb); ctx.fillRect(X(i) - (w - 60) / yrs.length / 2, y, (w - 60) / yrs.length + 1, 14); });
      strip(a, h - 78); strip(b, h - 58);
      PV.text(ctx, RN[R.ring] + " (solid, top strip)", 40, 16, { size: 11, color: t.tide });
      PV.text(ctx, CN[R.clim] + " (dashed, lower strip)", w - 20, 16, { size: 11, color: t.red, align: "right" });
      PV.text(ctx, yrs[0], 40, h - 26, { size: 11, color: t.soft }); PV.text(ctx, yrs[yrs.length - 1], w - 20, h - 26, { size: 11, color: t.soft, align: "right" });
      PV.text(ctx, "strip hue: low values blue, high values red", w / 2, h - 26, { size: 11, color: t.soft, align: "center" });
    },
    describe() {
      const a = RD.ring[R.ring], b = RD.climate[R.clim], y = RD.years, r = corr(a, b);
      const ia = a.indexOf(Math.max(...a)), ib = a.indexOf(Math.min(...a));
      return `${RN[R.ring]} against ${CN[R.clim]}, ${y[0]} to ${y[y.length - 1]}, both as z-scores. Correlation r = ${r.toFixed(2)}. The ring's highest year is ${y[ia]} (z ${a[ia].toFixed(1)}), its lowest ${y[ib]} (z ${a[ib].toFixed(1)}).`;
    },
    loss() {
      const a = RD.ring[R.ring], m = zPitch(), clip = a.filter((v) => Math.abs(v) > 3).length;
      const l = P.lossBits(a.map((v) => Math.round(v * 100)), (c) => { const v = c / 100; return Math.abs(v) > 3 ? (v > 0 ? "hi" : "lo") : Math.round(Math.log(m.map(v)) / Math.log1p(P.JND.pitchRel)); });
      return { quantity: "tree-ring and summer-climate z-scores, one per year (unitless, standard deviations); geometry: two scalar time series.",
        keeps: "the order of years, each year's value to the pitch JND, the rise and fall the two series share",
        loses: "values beyond z = 3, which are clipped; the absolute units behind each z-score",
        map: "one year every 0.15 s; z from -3 to 3 as pitch from 220 Hz to 1.76 kHz on the mel scale, the ring in the left ear and the climate in the right; z as hue from 450 to 650 nm in the strips.",
        bits: `The ring series at 0.01 z steps holds ${l.bitsSource.toFixed(2)} bits per year; pitch at a 0.5% JND keeps ${l.bitsKept.toFixed(2)}, losing ${l.bitsLost.toFixed(2)}. ${clip} of ${a.length} years sit beyond z = 3 and are clipped.`,
        inverse: "Invertible inside z = -3 to 3: a heard pitch maps back to a z-score through the mel scale." };
    },
    sound(textOnly) {
      const a = RD.ring[R.ring], b = RD.climate[R.clim], m = zPitch(), rate = 24000, per = Math.round(rate * 0.15);
      const txt = `${a.length} years in ${(a.length * 0.15).toFixed(0)} s, then again: the ${RN[R.ring]} in the left ear, the ${CN[R.clim]} in the right; a higher note is a higher z-score.`;
      if (textOnly) return { text: txt };
      const L = new Float32Array(per * a.length), Rr = new Float32Array(per * a.length);
      let pa = 0, pb = 0;
      for (let i = 0; i < L.length; i++) {
        const y = Math.min(a.length - 1, Math.floor(i / per)), fa = m.map(Math.max(-3, Math.min(3, a[y]))), fb = m.map(Math.max(-3, Math.min(3, b[y])));
        const env = Math.min(1, (i % per) / 200, (per - (i % per)) / 200);
        pa += 2 * Math.PI * fa / rate; pb += 2 * Math.PI * fb / rate;
        L[i] = 0.5 * env * Math.sin(pa); Rr[i] = 0.4 * env * Math.sin(pb);
      }
      return { buffer: [L, Rr], rate, text: txt };
    },
    haptic() { return RD.ring[R.ring].slice(-12).map((v) => (v + 3) / 6); },
  });

  /* Laws of physics as chords: the law table's 8D signatures (from ndim/data/laws.json). */
  let LD = null;
  const L = { i: 0 };
  const voice = (k) => { const c = 110 * 2 ** (0.75 * k); return P.bridge(P.window(-1, 1, "linear"), P.window(c * 2 ** -0.3, c * 2 ** 0.3, "log")); };
  const sig = (i) => LD.laws[i].slice(3);
  const clampS = (v) => Math.max(-1, Math.min(1, v));
  PV.def({
    id: "laws", bridge: "dimensionality", label: "All 354 laws of the law table as dots on their first two signature axes, the chosen law ringed; beside it, the chosen law's eight coordinates as bars.",
    init() {
      LD = JSON.parse($("#laws-data").textContent);
      const byDom = {};
      LD.laws.forEach((l, i) => (byDom[l[1]] = byDom[l[1]] || []).push(`<option value="${i}">${l[0].replace(/</g, "&lt;")}</option>`));
      $("#law").innerHTML = Object.keys(byDom).sort().map((d) => `<optgroup label="${d}">${byDom[d].join("")}</optgroup>`).join("");
      $("#law").value = "0";
      $("#law").addEventListener("change", (e) => { L.i = +e.target.value; PV.update(); });
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, 0.6), t = PV.tok, sw = w * 0.55;
      const X = (v) => 20 + ((v + 1) / 2) * (sw - 40), Y = (v) => h - 30 - ((v + 1) / 2) * (h - 60);
      for (const l of LD.laws) { ctx.fillStyle = l[1] === LD.laws[L.i][1] ? t.red : t.soft; ctx.globalAlpha = l[1] === LD.laws[L.i][1] ? 0.9 : 0.35; ctx.fillRect(X(clampS(l[3])) - 2, Y(clampS(l[4])) - 2, 4, 4); }
      ctx.globalAlpha = 1; const s = sig(L.i);
      ctx.strokeStyle = t.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(clampS(s[0])), Y(clampS(s[1])), 8, 0, 7); ctx.stroke();
      PV.text(ctx, "axes 1 and 2 of 8; this law's domain in red", 20, 16, { size: 11, color: t.soft });
      const bx = sw + 10, bw = (w - bx - 10) / 8;
      s.forEach((v, k) => {
        const y0 = h / 2, hh = (clampS(v) * (h / 2 - 40));
        ctx.fillStyle = P.css(P.spectralRgb(450 + k * 25).rgb); ctx.fillRect(bx + k * bw + 2, Math.min(y0, y0 - hh), bw - 4, Math.abs(hh));
        PV.text(ctx, String(k + 1), bx + k * bw + bw / 2, h - 12, { size: 11, align: "center", color: t.soft });
      });
      ctx.fillStyle = t.ink; ctx.fillRect(bx, h / 2, w - bx - 10, 1);
    },
    describe() {
      const l = LD.laws[L.i], s = sig(L.i);
      let best = -1, bd = 1e9;
      LD.laws.forEach((m, j) => { if (j !== L.i) { const d = Math.hypot(...m.slice(3).map((v, k) => v - s[k])); if (d < bd) { bd = d; best = j; } } });
      return `${l[0]} (${l[1]}, ${l[2].replace(/_/g, " ")}). Its eight coordinates: ${s.map((v) => v.toFixed(2)).join(", ")}. Its chord sounds most like ${LD.laws[best][0]}, its nearest law in the eight dimensions (distance ${bd.toFixed(2)}).`;
    },
    loss() {
      const codes = LD.laws.map((_, i) => sig(i).map((v) => Math.round(v * 1000)));
      const l = P.lossBits(codes, (c) => c.map((v, k) => Math.round(Math.log(voice(k).map(clampS(v / 1000))) / Math.log1p(P.JND.pitchRel))));
      return { quantity: "law signature: 8 principal axes of a 38-feature description (unitless); geometry: 354 points in R^8.",
        keeps: "all eight coordinates of the chosen law, as eight voices and eight bars; which laws sit near each other",
        map: "eight coordinates, eight voices: voice k sits at 110 Hz x 2^(0.75 k), and its coordinate from -1 to 1 bends it a little under a third of an octave either way; dots on axes 1 and 2; bars for all eight.",
        bits: `The 8 axes keep ${(LD.variance_kept * 100).toFixed(1)}% of the variance of the ${LD.n_features}-feature signature (ndim's principal axes). Across the ${LD.n_laws} laws, chords at a 0.5% pitch JND keep ${l.bitsKept.toFixed(2)} of ${l.bitsSource.toFixed(2)} bits: ${l.bitsLost.toFixed(2)} lost.`,
        loses: `the ${(100 - LD.variance_kept * 100).toFixed(1)}% of signature variance outside the 8 axes; coordinates beyond plus or minus 1, which are clipped`, inverse: "Invertible voice by voice inside plus or minus 1: each pitch maps back to its coordinate." };
    },
    sound() { const s = sig(L.i); return { partials: s.map((v, k) => ({ f: voice(k).map(clampS(v)), g: 1, pan: -0.7 + (1.4 * k) / 7 })), text: `an eight-note chord for ${LD.laws[L.i][0]}, lowest voice for axis 1 on the left, highest for axis 8 on the right.` }; },
    haptic() { return sig(L.i).map((v) => (clampS(v) + 1) / 2); },
  });
})();
