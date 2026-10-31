// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* diagram/overlay: physical-property layers that recolour any view (schematic, 3D, exploded, section, time).
   Material values come from packages/materials (data/materials.json here, copied by build/materials_export.py);
   a value the library lacks stays missing and the part is drawn as "no data". Planck's law is perceive's.
   - temperature: the heat model's true temperature, on a ramp.
   - thermal: what a long-wave thermal camera (8 to 14 um) reports: emissivity times Planck band radiance plus
     the reflected room, inverted as if the surface were black. Polished metal looks cold; that is the lesson.
   - current: current density J = I / A and resistive heating P = I^2 R, R = L / (sigma A) from the library's
     conductivity, or the circuit's own R for parts the library does not hold. */
(function (g) {
  "use strict";
  const D = (g.Diagram = g.Diagram || {});
  const P = () => g.Perceive;

  D.BAND = [8e-6, 14e-6];
  /* Simpson's rule over [lo, hi] of Planck spectral radiance: W sr^-1 m^-2. */
  D.bandRadiance = (T, lo = D.BAND[0], hi = D.BAND[1], n = 240) => {
    const f = (l) => P().planck(l, T), h = (hi - lo) / n;
    let s = f(lo) + f(hi);
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(lo + i * h);
    return (s * h) / 3;
  };
  /* The black-body temperature with the same band radiance: what the camera's readout says. */
  D.apparentT = (L) => {
    let a = 100, b = 5000;
    for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (D.bandRadiance(m) < L) a = m; else b = m; }
    return (a + b) / 2;
  };
  /* A false-colour ramp (dark to light), labelled as a ramp: it codes a number, not a colour of light. */
  D.RAMP = [[0.02, 0.02, 0.08], [0.23, 0.06, 0.44], [0.55, 0.16, 0.51], [0.87, 0.29, 0.41], [0.99, 0.62, 0.43], [0.99, 0.99, 0.75]];
  D.ramp = (x) => {
    x = D.clamp(x, 0, 1) * (D.RAMP.length - 1);
    const i = Math.min(D.RAMP.length - 2, Math.floor(x));
    return D.mix(D.RAMP[i], D.RAMP[i + 1], x - i);
  };

  D.OVERLAY = {
    temperature: { name: "Temperature (heat model)", unit: "K", keeps: ["each part's temperature from the heat model, as a number on a ramp"], drops: ["gradients inside a part: one temperature per part", "colour of the real object"] },
    thermal: { name: "Thermal camera, 8 to 14 um", unit: "K apparent", keeps: ["band radiance: emissivity times Planck plus the reflected room", "what a real long-wave camera would report"], drops: ["true temperature where emissivity is low (shiny metal reads cold)", "parts with no emissivity in the library (drawn as no data)"] },
    current: { name: "Current density and heating", unit: "A/m^2", keeps: ["J = I / A in every conductor", "P = I^2 R per part, R from the library's conductivity"], drops: ["J varying across a section (uniform J assumed; no skin effect)", "parts with no conductivity in the library or circuit"] },
  };

  const libOf = (Pt, lib) => { const M = D.MATERIALS[Pt.def.material]; return M && M.lib && lib ? lib[M.lib] : null; };
  const val = (f) => (f && f.value !== undefined && f.value !== null ? f.value : null);

  /* Physics per part for one overlay. state.parts[id] carries temp (K) and current (A, rms). */
  D.overlayReadings = (model, view, kind) => {
    const S = (view.state && view.state.parts) || {}, amb = view.ambient || 296, out = new Map();
    for (const Pt of model.parts) {
      const s = S[Pt.id] || {}, rec = libOf(Pt, view.lib), r = { id: Pt.id };
      if (kind === "temperature" || kind === "thermal") {
        r.T = s.temp !== undefined ? s.temp : amb;
        r.eps = val(rec && rec.emissivity_lwir);
        if (r.eps === null && Pt.def.emissivity) { r.eps = Pt.def.emissivity.value; r.epsSource = Pt.def.emissivity.source; }
        if (kind === "thermal" && r.eps !== null) { r.L = r.eps * D.bandRadiance(r.T) + (1 - r.eps) * D.bandRadiance(amb); r.Tapp = D.apparentT(r.L); }
        r.value = kind === "thermal" ? r.Tapp : r.T;
      } else if (kind === "current") {
        const c = Pt.def.cond, I = s.current;
        if (c && I !== undefined) {
          const sigma = val(rec && rec.sigma), A = c.A || (Math.PI * c.d * c.d) / 4;
          r.I = I; r.A = A; r.J = Math.abs(I) / A;
          r.R = sigma ? (c.L / (sigma * A)) * (s.Rfactor || 1) : c.R !== undefined ? c.R : null;
          r.Rsource = sigma ? "L / (sigma A), sigma at room temperature from " + rec.sigma.source + (s.Rfactor ? ", times the heat model's rise " + s.Rfactor.toFixed(2) : "") : "circuit value";
          r.P = r.R !== null ? I * I * r.R : null;
          r.value = r.J;
        } else r.value = null;
      }
      out.set(Pt.id, r);
    }
    return out;
  };

  /* A style function for scene.styles, the ramp's range, and the readings. */
  D.overlayContext = (model, view, kind) => {
    const R = D.overlayReadings(model, view, kind), vals = [...R.values()].map((r) => r.value).filter((x) => x !== null && x !== undefined && isFinite(x));
    const log = kind === "current";
    const f = (x) => (log ? Math.log10(Math.max(1e-30, x)) : x);
    let lo = vals.length ? Math.min(...vals.map(f)) : 0, hi = vals.length ? Math.max(...vals.map(f)) : 1;
    if (kind !== "current") lo = Math.min(lo, (view.ambient || 296) - 4);
    if (hi - lo < 1e-9) hi = lo + 1;
    const ghost = D.mix(D.tokenColor(view.tokens, "soft"), D.tokenColor(view.tokens, "mat"), 0.5);
    const style = (Pt) => {
      const r = R.get(Pt.id);
      if (!r || r.value === null || r.value === undefined) return { rgb: ghost, alpha: kind === "current" ? 0.14 : 0.3 };
      return { rgb: D.ramp((f(r.value) - lo) / (hi - lo)), alpha: 1 };
    };
    return { kind, readings: R, lo, hi, log, style, info: D.OVERLAY[kind] };
  };

  D.fmt = (x, u) => {
    if (x === null || x === undefined || !isFinite(x)) return "no data";
    const a = Math.abs(x), s = a !== 0 && (a < 1e-3 || a >= 1e5) ? x.toExponential(2).replace("e", " x 10^").replace("^+", "^") : (+x.toPrecision(4)).toString();
    return s + (u ? " " + u : "");
  };
  D.readingText = (r, kind) => {
    if (!r) return "";
    if (kind === "temperature") return `T = ${D.fmt(r.T, "K")} (heat model)`;
    if (kind === "thermal") return r.eps === null ? `T = ${D.fmt(r.T, "K")}; no long-wave emissivity in the library, so no camera reading` : `T = ${D.fmt(r.T, "K")} true, ${D.fmt(r.Tapp, "K")} on the camera; emissivity ${r.eps.toFixed(3)} at 10 um${r.epsSource ? " (" + r.epsSource + ")" : ""}`;
    if (kind === "current") return r.J === undefined ? "not a conductor in this model" : `I = ${D.fmt(r.I, "A")} rms, J = ${D.fmt(r.J, "A/m^2")}, R = ${D.fmt(r.R, "ohm")} (${r.Rsource}), P = I^2 R = ${D.fmt(r.P, "W")}`;
    return "";
  };

  if (typeof module !== "undefined" && module.exports) module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
