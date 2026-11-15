// Glyph's side of the shared light model (the light lead's; interface proposed in design/state/glyph.md,
// 2026-10-21, glyph lead). Both styles read one model; this file turns it into what type needs and,
// until the model lands, derives the same shape from what the scene already carries (the hour, the
// place's lamps, the era from the content). Original code.
//
// The shape both styles read (proposal):
//   model = { era, hour, day (0..1 sun up), snow (0..1 cover on up-facing outdoor ground),
//             sun: { dir, c }  (the moon at night)   sky: { amb, ground }   lamps: [{ at, c, I, reach, kind }],
//             atmosphere: { fog, col },
//             figure(at, facing) -> { key: { dir, c, wrap }, fill: { dir, c }, rim: { dir, c }, amb, ground } }
//   dir are world unit vectors pointing toward the light; c linear RGB (1 = a well lit surface).
//   figure() has the same fields as characters/proto/portrait_light.mjs's rigs, so a dialogue portrait and
//   the figure in the world are lit by one description.
// Where it comes from: globalThis.__lwLightModel.at(scene) when the light lead's model is installed, else
// derive(scene) below.
//   glyphLight(scene) -> model (with era and look filled in)
import { skyOf } from "./light.mjs";
import { eraLook } from "./eras.mjs";

const KIND_RGB = { sodium: [1.0, 0.56, 0.18], paraffin: [1.0, 0.72, 0.42], white: [0.86, 0.92, 1.0], arc: [0.86, 0.95, 1.0], candle: [1.0, 0.75, 0.4], stove: [1.0, 0.5, 0.15] };
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

// the era of the content in play: the content's own @meta era, else 2 for the Quota slice (its meta carries
// community-day; systems is asked in design/state/glyph.md to add `era: 2`), else 0 (Low Water's night, no grade)
export function eraOf(G) {
  const m = (G && G.book && G.book.meta) || {};
  if (m.era != null) return +m.era;
  return m["community-day"] != null || m.communityDay != null ? 2 : 0;
}

// the derived model: the sun or moon by the hour (light.mjs skyOf), tinted by the era's sky; lamps from the
// place; a figure's key is the strongest light reaching it, its rim the next strongest from behind, its fill the sky
export function derive(scene) {
  const era = scene.era ?? 0, look = eraLook(era), sky = skyOf(scene.hour ?? 23), tint = look.sky;
  const lamps = (scene.lightsPlace || []).map((L) => ({ at: L.at, c: KIND_RGB[L.kind] || KIND_RGB.paraffin, I: Math.sqrt(L.I || 1) * 0.3, reach: L.reach || 6, kind: L.kind || "paraffin" }));
  const day = sky.col[1] > 0.3 ? Math.min(1, sky.col[1]) : 0;
  const sun = { dir: sky.dir, c: sky.col.map((v, i) => v * tint[i]) }, amb = sky.amb.map((v, i) => v * tint[i]);
  const outdoor = !!(scene.place && scene.place.walk && scene.place.walk.outdoor) || (scene.place && /square|post|hill|yard|granary|exchange|quay/.test(scene.place.place || ""));
  const snow = scene.terms && scene.terms.snow != null ? +scene.terms.snow : look.snow * (outdoor ? 1 : 0);
  return { era, hour: scene.hour ?? 23, day, snow, sun, sky: { amb, ground: amb.map((v) => v * 0.4) }, lamps, atmosphere: { fog: (scene.terms && scene.terms.fog) || 0, col: amb.map((v) => v * 3) }, figure: (at) => figureRig(at, sun, amb, lamps, scene.lantern) };
}

// the lights at a figure: every lamp in reach and the carried lantern, with the sun or moon, sorted by
// what they give; the strongest is the key, the strongest from the far side of the figure is the rim
function figureRig(at, sun, amb, lamps, lantern) {
  const cands = [{ dir: sun.dir, c: sun.c, e: Math.hypot(...sun.c) }];
  for (const L of lamps) {
    const d = [L.at[0] - at[0], L.at[1] - (at[1] + 1.2), L.at[2] - at[2]], r = Math.hypot(...d); if (r >= L.reach) continue;
    const e = L.I * (1 - r / L.reach) ** 2 * 6; cands.push({ dir: norm(d), c: L.c.map((v) => v * e), e });
  }
  if (lantern) { const d = [lantern[0] - at[0], lantern[1] - (at[1] + 1.2), lantern[2] - at[2]], r = Math.hypot(...d); if (r < 4.5) { const e = 0.9 * (1 - r / 4.5) ** 2; cands.push({ dir: norm(d), c: KIND_RGB.paraffin.map((v) => v * e), e }); } }
  cands.sort((a, b) => b.e - a.e);
  const key = cands[0], rim = cands.slice(1).find((c) => c.dir[0] * key.dir[0] + c.dir[2] * key.dir[2] < 0.2) || { dir: [-key.dir[0], 0.3, -key.dir[2]], c: amb.map((v) => v * 1.5) };
  return { key: { ...key, wrap: 0.3 }, fill: { dir: [-key.dir[0], 0.5, -key.dir[2]], c: amb.map((v) => v * 1.2) }, rim, amb, ground: amb.map((v) => v * 0.4) };
}

// the light lead's model as it landed on feat/light (game/engine/light/install.mjs): __lwLightModel.ready() and
// .rig(at, t, cam) give a figure's rig ({ rig: { amb, ground, key, fill, rim } } or the rig itself). Glyph takes
// the figures' key, fill and rim from it when it is ready, and keeps its own world light until the cell
// record (light/consume.mjs cellsFromField) is wired.
const sharedRig = (L, at, cam) => { try { const r = L.rig(at, performance.now() / 1000, cam), g = r && (r.rig || r); return g && g.key && g.key.dir && g.key.c && g.fill && g.rim && g.amb ? { key: { wrap: 0.3, ...g.key }, fill: g.fill, rim: g.rim, amb: g.amb, ground: g.ground || g.amb } : null; } catch (e) { console.warn(`glyph: the light model's rig failed (${e.message})`); return null; } };
export function glyphLight(scene) {
  const L = globalThis.__lwLightModel, m = derive(scene);
  if (L && L.at) { const M = L.at(scene); return { ...M, era: M.era ?? scene.era ?? 0, look: eraLook(M.era ?? scene.era ?? 0), shared: true }; }
  const shared = !!(L && L.rig && (!L.ready || L.ready()));
  if (shared) { const own = m.figure, cam = scene.place && scene.place.camera; m.figure = (at, f) => sharedRig(L, at, cam) || own(at, f); }
  return { ...m, era: m.era ?? scene.era ?? 0, look: eraLook(m.era ?? scene.era ?? 0), shared };
}
