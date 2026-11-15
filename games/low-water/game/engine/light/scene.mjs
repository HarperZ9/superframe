// A place's light, assembled: the model (model.mjs) over the place's annotated lights (places.mjs) and the
// windows found in its geo buffers (windows.mjs), and its baked field (field.mjs). What the in-game service
// (install.mjs) and the proof tools build per place, variant and street state.
//   const S = buildScene({ pj, geo, variant, hour, read, era })  -> { M, F, entry, owners }
//   S.compose({ hour, t })  -> F.E for that clock and time
//   sceneModel({ pj, g, ... }) -> { M, entry }   (steps.mjs builds the same scene in bands)
import { createLightModel } from "./model.mjs";
import { prepGeo, bakeField, composeField } from "./field.mjs";
import { lightPlace, annotate } from "./places.mjs";
import { findWindows, emitOwners } from "./windows.mjs";
import { eraOf } from "./eras.mjs";

// the model for a place: its annotated lights, the windows found in its geometry (g: prepGeo's result)
export function sceneModel({ pj, g, variant = null, hour = null, read = null, era = null, terms = null, windows = true }) {
  const entry = lightPlace(pj), v = variant || (pj.variants && pj.variants[0]), E = era ?? entry.era;
  const lights = annotate(pj, v, entry), extra = windows && !entry.indoor ? findWindows(g, { source: eraOf(E).poor, streetOf: (at) => entry.streetOf(at) || entry.street }) : [];
  const M = createLightModel({ place: { ...pj, train: entry.train || pj.train }, variant: v, era: E, hour, terms: { ...entry.terms, ...(terms || {}) }, read, street: entry.street, households: entry.household ? { [entry.street]: entry.household } : {}, lights, extra, indoor: !!entry.indoor });
  return { M, entry };
}
export function buildScene({ pj, geo, variant = null, hour = null, read = null, era = null, terms = null, G = null, windows = true }) {
  const g = G || prepGeo(pj, geo), { M, entry } = sceneModel({ pj, g, variant, hour, read, era, terms, windows });
  const F = bakeField(pj, geo, M, { G: g }), owners = emitOwners(F, M.lights);
  return { M, F, G: g, entry, owners, compose: (o = {}) => composeField(F, M, { indoor: !!entry.indoor, ...o }) };
}
