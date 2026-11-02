// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive page: the spectral window over the electromagnetic spectrum (blackbody and line sources) and the
   materials library's n and k spectra. One operator: a window [lo, hi] on wavelength, log scale, into
   380 to 750 nm for sight and 20 Hz to 20 kHz for sound (short waves high, long waves low). */
(function () {
  "use strict";
  const PV = window.PV, P = PV.P, $ = PV.$;
  const AX = [-14, 4]; // log10 metres shown on the ruler
  const S = { c: -5, wd: 1, sp: "linear", T: 300, read: null };
  const lo = () => 10 ** (S.c - S.wd / 2), hi = () => 10 ** (S.c + S.wd / 2);
  const src = () => P.window(lo(), hi(), "log");
  const eye = () => P.bridge(src(), P.window(380, 750, S.sp));
  const ear = () => P.bridge(src(), P.window(60, 6000, "log"), true);
  const SOURCES = {
    bb: { label: "Thermal glow", lines: null },
    h: { label: P.LINES.hydrogen.name, lines: P.LINES.hydrogen.lines },
    na: { label: P.LINES.sodium.name, lines: P.LINES.sodium.lines },
    au: { label: P.LINES.aurora.name, lines: P.LINES.aurora.lines },
  };
  /* Samples in the window: [wavelength m, power 0..1, name]. */
  function samples(id) {
    const s = SOURCES[id];
    if (s.lines) {
      const all = s.lines.map(([nm, p, n]) => [nm * 1e-9, p, n]).filter(([l]) => l >= lo() && l <= hi());
      return all;
    }
    const out = [], n = 48;
    for (let i = 0; i < n; i++) { const l = lo() * (hi() / lo()) ** ((i + 0.5) / n); out.push([l, P.planck(l, S.T), ""]); }
    const mx = Math.max(...out.map((o) => o[1])) || 1;
    return out.map(([l, p, nm]) => [l, p / mx, nm]);
  }
  const xOf = (l, w) => ((Math.log10(l) - AX[0]) / (AX[1] - AX[0])) * w;
  const fmtL = (l) => PV.si(l, "m");

  function draw(id, el) {
    const { ctx, w, h } = PV.canvas(el, 0.6), t = PV.tok, br = eye();
    // ruler
    const y0 = 34, rh = 30;
    P.EM_BANDS.forEach(([a, b, name], i) => {
      const xa = Math.max(0, xOf(a, w)), xb = Math.min(w, xOf(b, w));
      ctx.fillStyle = i % 2 ? t.line : "transparent"; ctx.globalAlpha = 0.5; ctx.fillRect(xa, y0, xb - xa, rh); ctx.globalAlpha = 1;
      if (name !== "visible light" && xb - xa > 40) PV.text(ctx, name, Math.max(32, Math.min(w - 32, (xa + xb) / 2)), y0 - 8, { align: "center", size: 11, color: t.soft });
    });
    const xv0 = xOf(380e-9, w), xv1 = xOf(750e-9, w);
    for (let x = Math.floor(xv0); x <= xv1; x++) { const nm = 380 + ((x - xv0) / (xv1 - xv0)) * 370; ctx.fillStyle = P.css(P.spectralRgb(nm).rgb); ctx.fillRect(x, y0, 1.5, rh); }
    PV.text(ctx, "visible", (xv0 + xv1) / 2, y0 + rh + 14, { align: "center", size: 11, color: t.soft });
    const wa = xOf(lo(), w), wb = xOf(hi(), w);
    ctx.strokeStyle = t.red; ctx.lineWidth = 2; ctx.strokeRect(wa, y0 - 3, Math.max(2, wb - wa), rh + 6);
    // zoom lines from the window down to the spectrum
    const y1 = 96, y2 = h * 0.64;
    ctx.lineWidth = 1; ctx.strokeStyle = t.soft; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(wa, y0 + rh + 3); ctx.lineTo(0, y1); ctx.moveTo(wb, y0 + rh + 3); ctx.lineTo(w, y1); ctx.stroke(); ctx.setLineDash([]);
    // the window's contents, each bar in the hue it is mapped to
    const sm = samples(id), lw = SOURCES[id].lines ? 3 : Math.max(2, w / 48 - 1);
    for (const [l, p] of sm) {
      const x = ((Math.log10(l) - Math.log10(lo())) / S.wd) * w, nm = br.map(l), c = P.spectralRgb(nm).rgb;
      ctx.fillStyle = P.css(c); ctx.fillRect(x - lw / 2, y2 - p * (y2 - y1 - 10), lw, p * (y2 - y1 - 10));
    }
    ctx.fillStyle = t.ink; ctx.fillRect(0, y2, w, 1);
    PV.text(ctx, fmtL(lo()), 2, y2 + 14, { size: 11 }); PV.text(ctx, fmtL(hi()), w - 2, y2 + 14, { size: 11, align: "right" });
    // what the eye gets: the window stretched over 380 to 750 nm, brightness by power
    const y3 = y2 + 26, sh = h - y3 - 26;
    let peakRaw = 1;
    if (!SOURCES[id].lines) { peakRaw = 0; for (let i = 0; i < 96; i++) peakRaw = Math.max(peakRaw, P.planck(lo() * (hi() / lo()) ** ((i + 0.5) / 96), S.T)); peakRaw = peakRaw || 1; }
    const pw = (x) => { // power at strip position x, 0..1
      if (SOURCES[id].lines) { let p = 0; for (const [l, q] of sm) { const xl = ((Math.log10(l) - Math.log10(lo())) / S.wd) * w; p += q * Math.exp(-(((x - xl) / 2.5) ** 2)); } return Math.min(1, p); }
      return P.planck(lo() * (hi() / lo()) ** (x / w), S.T) / peakRaw;
    };
    for (let x = 0; x < w; x += 2) {
      const l = lo() * (hi() / lo()) ** (x / w), c = P.spectralRgb(br.map(l), Math.sqrt(Math.max(0, pw(x)))).rgb;
      ctx.fillStyle = P.css(c); ctx.fillRect(x, y3, 2, sh);
    }
    ctx.strokeStyle = t.line; ctx.strokeRect(0, y3, w, sh);
    PV.text(ctx, "seen as: 380 nm", 2, y3 + sh + 15, { size: 11, color: t.soft }); PV.text(ctx, "750 nm", w - 2, y3 + sh + 15, { size: 11, color: t.soft, align: "right" });
    if (S.read != null) { const x = S.read * w; ctx.fillStyle = t.ink; ctx.fillRect(x - 1, y3 - 6, 2, sh + 12); }
  }

  function describe(id) {
    const br = eye(), sm = samples(id), band = P.bandOf(P.EM_BANDS, Math.sqrt(lo() * hi()));
    let s = `Window ${fmtL(lo())} to ${fmtL(hi())} (${band}, ${S.wd.toFixed(1)} decades), stretched over the visible band from 380 to 750 nm. `;
    if (id === "bb") {
      const pk = P.wienPeak(S.T), nm = br.map(pk);
      s += `A body at ${Math.round(S.T)} K glows brightest at ${fmtL(pk)}` + (br.contains(pk) ? `, shown as ${nm.toFixed(0)} nm, ${P.hueName(P.hueAngle(P.spectralRgb(nm).rgb))}.` : `, outside this window, so the strip is brightest at the ${pk < lo() ? "short" : "long"} end.`);
    } else if (!sm.length) s += "No lines of this source fall in the window. Slide it.";
    else s += sm.map(([l, p, n]) => `${n} ${fmtL(l)} shown as ${br.map(l).toFixed(0)} nm (${P.hueName(P.hueAngle(P.spectralRgb(br.map(l)).rgb))})`).join("; ") + ".";
    if (S.read != null) { const x = lo() * (hi() / lo()) ** S.read, y = br.map(x); s += ` You pointed at ${y.toFixed(1)} nm of the strip; the inverse map reads it back as ${fmtL(br.inverse(y))}.`; }
    return s;
  }
  function loss() {
    const l = P.windowLoss(src(), P.window(380, 750, S.sp), lo(), hi()), out = 1 - S.wd / (AX[1] - AX[0]);
    return {
      map: `wavelength in [${fmtL(lo())}, ${fmtL(hi())}] on a log scale, into 380 to 750 nm (${P.SCALE_NAMES[S.sp]}); power as brightness; the same window into 60 Hz to 6 kHz, short waves high.`,
      bits: `At 0.1% source steps the window holds ${l.bitsSource.toFixed(1)} bits per sample; hue at a ${l.jnd} JND keeps ${l.bitsKept.toFixed(1)}, so ${l.bitsLost.toFixed(1)} bits are lost to squeezing. ${(out * 100).toFixed(0)}% of the chart's decades sit outside the window.`,
      inverse: "Invertible inside the window: tap the bottom strip and the page reads back the wavelength it stands for.",
    };
  }
  function sound(id) {
    const a = ear(), sm = samples(id).filter((_, i, arr) => arr.length < 25 || i % 2 === 0);
    const partials = sm.map(([l, p]) => ({ f: a.map(l), g: p, pan: 0 }));
    return { partials, text: sm.length ? `${partials.length} tones from ${Math.round(Math.min(...partials.map((q) => q.f)))} Hz to ${Math.round(Math.max(...partials.map((q) => q.f)))} Hz, each one a slice of the window; louder tones carry more power.` : "silence: nothing in the window." };
  }
  const haptic = (id) => samples(id).slice(0, 12).map((s) => s[1]);

  function bind() {
    const set = () => { S.c = +$("#w-c").value; S.wd = +$("#w-wd").value; S.sp = $("#w-sp").value; S.T = 10 ** +$("#w-t").value; PV.update(); };
    for (const k of ["#w-c", "#w-wd", "#w-t"]) $(k).addEventListener("input", set);
    $("#w-sp").addEventListener("change", set);
    document.querySelectorAll("[data-win]").forEach((b) => b.addEventListener("click", () => {
      const [c, wd] = b.dataset.win.split(",").map(Number);
      PV.Kit_set("#w-c", c); PV.Kit_set("#w-wd", wd); set();
    }));
  }
  PV.Kit_set = (sel, v) => { const el = $(sel); if (window.Kit && Kit.setRange) Kit.setRange(el, v); else el.value = v; };
  let bound = false;
  for (const id of Object.keys(SOURCES)) {
    PV.def({
      id, bridge: "light", label: "The whole electromagnetic spectrum as a ruler with a red window on it; below, what the window holds, each part drawn in the colour it is mapped to; at the bottom, the window stretched over the visible band.",
      init() { if (!bound) { bind(); bound = true; } },
      draw: (el) => draw(id, el), describe: () => describe(id), loss, sound: () => sound(id), haptic: () => haptic(id),
      pointer(kind, x, y) { if (kind === "up") return false; if (y > 0.72) { S.read = Math.max(0, Math.min(1, x)); return true; } return false; },
    });
  }

  /* The materials library: n and k across the visible band, heard as an absorption chord. */
  const M = { i: 0 };
  function mats() { return JSON.parse($("#mat-data").textContent); }
  let MD = null;
  const refl = (n, k) => ((n - 1) ** 2 + k * k) / ((n + 1) ** 2 + k * k);
  PV.def({
    id: "mat", bridge: "light", label: "Refractive index n and extinction k of the chosen material across the visible band, with the colour of its polished surface.",
    init() {
      MD = mats();
      $("#mat").innerHTML = MD.materials.map((m, i) => `<option value="${i}">${m.name}</option>`).join("");
      $("#mat").addEventListener("change", (e) => { M.i = +e.target.value; PV.update(); });
    },
    draw(el) {
      const { ctx, w, h } = PV.canvas(el, 0.6), m = MD.materials[M.i], g = MD.grid_nm, t = PV.tok;
      const kmax = Math.max(1, ...m.k), nmax = Math.max(2, ...m.n), top = 20, bot = h - 60;
      const X = (i) => 40 + (i / (g.length - 1)) * (w - 60);
      for (let i = 0; i < g.length - 1; i++) { ctx.fillStyle = P.css(P.spectralRgb(g[i]).rgb); ctx.fillRect(X(i), bot + 8, X(i + 1) - X(i) + 1, 10); }
      const line = (arr, mx, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.beginPath(); arr.forEach((v, i) => { const y = bot - (v / mx) * (bot - top); i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y); }); ctx.stroke(); ctx.setLineDash([]); };
      line(m.n, nmax, t.tide, []); line(m.k, kmax, t.red, [6, 4]);
      PV.text(ctx, "n (solid, top = " + nmax.toFixed(1) + ")", 44, 14, { size: 11, color: t.tide });
      PV.text(ctx, "k (dashed, top = " + kmax.toFixed(1) + ")", w - 20, 14, { size: 11, color: t.red, align: "right" });
      PV.text(ctx, "380 nm", X(0), bot + 34, { size: 11, color: t.soft }); PV.text(ctx, "780 nm", X(g.length - 1), bot + 34, { size: 11, color: t.soft, align: "right" });
      const c = P.spectrumRgb(g.map((nm, i) => [nm, refl(m.n[i], m.k[i])]));
      ctx.fillStyle = P.css(c.rgb); ctx.fillRect(w - 70, bot - 60, 50, 50); ctx.strokeStyle = t.ink; ctx.strokeRect(w - 70, bot - 60, 50, 50);
    },
    describe() {
      const m = MD.materials[M.i], g = MD.grid_nm, R = g.map((_, i) => refl(m.n[i], m.k[i]));
      const kmax = Math.max(...m.k), at = g[m.k.indexOf(kmax)];
      return `${m.name}: n runs from ${Math.min(...m.n).toFixed(2)} to ${Math.max(...m.n).toFixed(2)}; k peaks at ${kmax.toFixed(2)} near ${at} nm. Reflectance at normal incidence runs ${(Math.min(...R) * 100).toFixed(0)}% to ${(Math.max(...R) * 100).toFixed(0)}%. The square shows that reflectance's colour under equal-energy light, brightness set to full.`;
    },
    loss: () => ({ quantity: "refractive index n and extinction coefficient k against wavelength (unitless, against nm); geometry: two scalar functions on a line.", keeps: "n and k at every tabulated wavelength in the plot; k at 17 wavelengths in the chord", loses: "n in the sound; the swatch's brightness; anything outside 380 to 780 nm, where this table has no data", map: "n as the solid line, k as the dashed line, against wavelength 380 to 780 nm (no shift: this band is already visible); k across the band as a chord, 380 nm high, 780 nm low, each tone's loudness its k.", bits: "The chord carries k at 17 wavelengths of the 81; n is shown but not heard. The swatch keeps hue and saturation of the reflectance and drops its overall brightness.", inverse: "The plotted lines are exact data; the chord is invertible at its 17 sample points." }),
    sound() {
      const m = MD.materials[M.i], g = MD.grid_nm, kmax = Math.max(1e-6, ...m.k), a = P.bridge(P.window(380e-9, 780e-9, "log"), P.window(60, 6000, "log"), true);
      const partials = g.filter((_, i) => i % 5 === 0).map((nm, j) => ({ f: a.map(nm * 1e-9), g: m.k[j * 5] / kmax, pan: 0 }));
      return { partials, text: `${MD.materials[M.i].name}'s absorption as a chord of 17 tones, violet high and red low; a loud tone means light at that colour is absorbed strongly.` };
    },
    haptic() { const m = MD.materials[M.i], kmax = Math.max(1e-6, ...m.k); return m.k.filter((_, i) => i % 10 === 0).map((k) => k / kmax); },
  });
})();
