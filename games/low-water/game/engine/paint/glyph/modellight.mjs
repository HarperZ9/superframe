// The world's light in type from the shared light model (game/engine/light/, interface in design/state/light.md),
// and an exposure that follows the clock (design/art/GLYPH-LANGUAGE.md section 4).
//   modelCells(S, scene)   when __lwLightModel is ready for this place: the model's field composed for the clock,
//                          reduced to the renderer's light cells (light/consume.mjs cellsFromField), kept until the
//                          game clock moves a minute or the model rebuilds; else null (the renderer's own bake stands)
//   adaptOf(E, hour)       the exposure for a light-cell array at an hour: the eye adapts to the frame's bright end
//                          (the 95th percentile of lit cells), so a lamp pool at night reaches the top of the ramp
//                          while the rest stays low and the night floor carries form in faint type; held lower at
//                          night than by day, so night is darker than dawn at the same light
// Original code.
import { cellsFromField } from "../../light/consume.mjs";
import { glyphCells } from "../../light/adapters.mjs";

const DAY_KEY = 0.62, NIGHT_KEY = 0.42;   // the value the adapted bright end lands on, by day and at night
export function dayness(hour) { const h = ((hour % 24) + 24) % 24; return h > 6.5 && h < 19 ? Math.min(1, Math.min(h - 6.5, 19 - h) / 1.2) : 0; }
export function adaptOf(E, hour) {
  const v = []; for (let i = 0; i < E.length; i += 3) { const l = 0.2126 * E[i] + 0.7152 * E[i + 1] + 0.0722 * E[i + 2]; if (l > 1e-4) v.push(l); }
  if (v.length < 16) return 1;
  v.sort((a, b) => a - b); const p95 = v[Math.floor(v.length * 0.95)], d = dayness(hour), key = NIGHT_KEY + (DAY_KEY - NIGHT_KEY) * d;
  adaptOf.last = { p95: +p95.toFixed(4), d };
  return Math.max(0.6, Math.min(12, key / Math.max(1e-3, p95)));
}
export function modelCells(S, scene) {
  const L = globalThis.__lwLightModel; if (!L || !L.ready || !L.ready() || !L.scene || !L.scene.F || !S.C) return null;
  const sc = L.scene, key = `${S.key}|${sc.M && sc.M.place && sc.M.place.place}|${Math.round((scene.hour ?? 0) * 60)}`;
  if (sc.M && sc.M.place && sc.M.place.place !== S.C.pj.place) return null;   // the model is still on the last place
  if (S.modelKey === key && S.modelE) return S.modelE;
  // expose: "glyph" (cellsFromField, then glyph's own adaptOf) or "light" (the light lead's glyphCells, exposed by its
  // clockExposure; glyph then adapts no further)
  const t0 = performance.now(), E = L.compose() || sc.F.E, cells = S.expose === "light" ? glyphCells(S.C, sc.F, E) : cellsFromField(S.C, sc.F, E);
  S.modelKey = key; S.modelE = cells; S.stats.modelMs = +(performance.now() - t0).toFixed(1);
  return cells;
}
