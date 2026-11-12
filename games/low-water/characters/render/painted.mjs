// Prototype C's look: the engine's own paint-over painter (raw-native web/shaders/paintover/painter.mjs,
// the pass that painted the plates) run over a figure's neutral-lit G-buffer, then our ink on top,
// so a figure is painted by the same hand as the place it stands in. The painted layer is relit at
// run time from the normal layer: out = painted * L(N) / L_neutral(N).
import { rn } from "./io.mjs";
import { albedo, light, ink, compose, NEUTRAL, INK } from "./shade.mjs";
const { paint } = await import(rn("web/shaders/paintover/painter.mjs"));

// G at supersampled size. Returns { rgb (painted, neutral light), En (neutral irradiance), I (ink), alpha }.
// G at supersampled size. The painter is fed the banded, brush-edged light (not a smooth gradient), so
// its strokes have planes to follow and show; radii scale with the figure. bold > 1 widens strokes.
export function paintFigure(G, palette, { seed = 3, scale = 1, radii, bold = 1, rig = NEUTRAL, bands = 4 } = {}) {
  const n = G.w * G.h, A = albedo(G, palette), En = light(G, NEUTRAL, palette), E = rig === NEUTRAL ? En : light(G, rig, palette);
  const C = compose(G, A, E, null, { bands }), src = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) src[i * 3 + c] = Math.min(1, G.id[i] ? C[i * 4 + c] : 0);
  const id = new Uint8Array(n); for (let i = 0; i < n; i++) id[i] = G.id[i] || 255;
  const H = G.h, r = radii || [H / 34, H / 60, H / 110, H / 200].map((x) => Math.max(1.2, x * scale * bold));
  const P = paint({ w: G.w, h: G.h, rgb: src }, { id, N: G.N }, { seed, radii: r, ink: false, relief: 0.35 });
  // the painted layer already holds the place's light when rig is given; relight then divides by itself
  return { rgb: P.rgb, En: E, A, I: ink(G, { scale: Math.max(1, Math.round(G.h / 600)) }) };
}

// Relight a painted figure under a rig; returns float RGBA at G size. tone(rgb) -> rgb maps light to
// the place (the sodium ramp on the quay, nothing indoors).
export function relight(G, F, rig, palette, tone = null) {
  const n = G.w * G.h, E = rig === NEUTRAL ? F.En : light(G, rig, palette), out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const k = F.I[i];
    if (!G.id[i]) { if (k > 0) { out.set([INK[0], INK[1], INK[2], k * 0.9], i * 4); } continue; }
    let rgb = [0, 1, 2].map((c) => F.rgb[i * 3 + c] * (E[i * 3 + c] / Math.max(0.05, F.En[i * 3 + c])));
    if (tone) rgb = tone(rgb);
    for (let c = 0; c < 3; c++) out[i * 4 + c] = rgb[c] * (1 - k * 0.85) + INK[c] * k * 0.85;
    out[i * 4 + 3] = Math.max(F.A.alpha[i], k * 0.9);
  }
  return out;
}

export { sodiumTone } from "./shade.mjs";
