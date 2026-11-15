// The light model's reading of each Quota plate: which era, which street each part stands on, which
// household's table a kitchen is, what each plate light is as a source (the bake calls most of them
// paraffin), the weather terms the plate was painted under, and the export train's line. Plate files stay
// the painted lead's; this is the light lead's annotation of them, keyed by plate name.
//   LIGHT_PLACES[plate] -> { era, street, streetOf(at), household, indoor, terms, sources: { index: source }, train, add: [lights] }
//   lightPlace(pj)      -> the entry for a place.json (by pj.place), or a plain era-2 default
const squareStreet = (at) => (at[0] > 5 && at[2] > 12 ? "mill" : at[0] < -15 && at[2] > 8 ? "haldane_yard" : "square");
// the export line: in from the south along the siding (x 22), braking into the dock under the hill
const SIDING = { path: [[22, 0, 70], [22, 0, 30], [22, 0, -22]], speed: 6, dwell: 25, height: 2.6, I: 70, reach: 46, beamDeg: 24 };

export const LIGHT_PLACES = {
  q_square_wide: { era: 2, street: "square", streetOf: squareStreet, terms: { frost: 0.55, mist: 0.004, snow: 0.8, snowfall: 0.3 },
    sources: { 0: "paraffin" },
    // effects (fx/ground.mjs): the brigade's cart road from the south entry to the siding, the spill by the loading plank
    ruts: [[[2, 0, 16], [8, 0, 8], [14, 0, 3], [17.5, 0, 1]], [[-18, 0, -1], [-6, 0, 2], [8, 0, 3], [17, 0, 1.5]]], spill: [[17.6, 0, -2.5], [16.4, 0, 0.6]],
    // the requisition lamps at the district office's door and at the siding's guard post; the guards' brazier
    add: [{ at: [-18.2, 2.6, -2.2], kind: "paraffin", source: "carbide", I: 10, reach: 11, group: "lamp", decay: false },
      { at: [18.2, 2.4, 3.2], kind: "paraffin", source: "carbide", I: 8, reach: 10, group: "lamp", decay: false },
      { at: [17.6, 0.6, -6.6], kind: "paraffin", group: "fire", source: "brazier", I: 6, reach: 6 }] },
  q_square_wide_quiet: { era: 2, street: "square", streetOf: squareStreet, terms: { frost: 0.55, mist: 0.004, snow: 0.8 }, sources: { 0: "paraffin" }, train: SIDING,
    add: [{ at: [-18.2, 2.6, -2.2], kind: "paraffin", source: "carbide", I: 10, reach: 11, group: "lamp", decay: false }] },
  q_granary: { era: 2, street: "haldane_yard", ruts: [[[-9, 0, 3.5], [-3, 0, 1.5], [3, 0, 0.5], [5, 0, -1]]], spill: [[5.2, 0, -0.8]], terms: { frost: 0.8, mist: 0.004, snow: 0.8, snowfall: 0.25 }, sources: { 0: "carbide", 1: "brazier", 2: "paraffin" } },
  q_haldane: { era: 2, street: "haldane_yard", household: "haldane", indoor: true, terms: { frost: 0.3 }, sources: { 0: "embers", 1: "window" } },
  q_haldane_coda: { era: 2, street: "haldane_yard", household: "haldane", indoor: true, terms: { frost: 0.3 }, sources: { 0: "embers", 1: "tallow", 2: "window" } },
  q_furrowe_kitchen: { era: 2, street: "square", household: "furrowe", indoor: true, terms: {}, sources: { 0: "stove", 1: "paraffin", 2: "window" } },
  q_brack_kitchen: { era: 2, street: "mill", household: "brack", indoor: true, terms: {}, sources: { 0: "stove", 1: "tallow", 2: "window" } },
  q_exchange: { era: 2, street: "square", indoor: true, terms: {}, sources: { 5: "window" } },
  q_post: { era: 2, street: "haldane_yard", terms: { frost: 0.9 }, sources: { 0: "carbide", 1: "brazier" } },
  q_returns: { era: 2, street: "square", indoor: true, terms: {}, sources: { 0: "paraffin", 1: "window" } },
};
export function lightPlace(pj) {
  const e = LIGHT_PLACES[pj && pj.place] || { era: 2, street: null, terms: {}, sources: {} };
  return { streetOf: () => e.street, household: null, indoor: false, add: [], train: null, ...e };
}
// the place's lights as the model reads them: each with its source and street, plus the added ones
export function annotate(pj, variant, entry = lightPlace(pj)) {
  const L = (pj.lights && pj.lights[variant]) || [];
  return [...L.map((q, i) => ({ ...q, source: entry.sources[i] || q.source, street: q.street || entry.streetOf(q.at) || entry.street, household: entry.household || undefined })),
    ...entry.add.map((q) => ({ ...q, street: q.street || entry.streetOf(q.at) || entry.street }))];
}
