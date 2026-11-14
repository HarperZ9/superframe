// A sitting: one reference, its underpainting as layer 1 (procedural, locked, regenerated from its
// parameters, never painted on), a first paint layer for a person, the sitter's palette, and undo.
// Shared by the browser app and the Node scripts, so a scripted portrait goes through the same code a
// person's does.
//   castOf(quotaModule) -> members     catalogue(members) -> [{ person, records: [{ key, era, age, name }] }]
//   newSitting({ members, who, timing, mood, cam, key, w, h, seed }) -> sitting
//   moodSitting(sitting, mood) adds a mood override     revariant(sitting, change) -> new sitting (re-projected)
import { sit, CAM, KEY } from "./sitter.mjs";
import { paintPortrait } from "../../../game/engine/paint/portrait/painter.mjs";
import { createDoc, addLayer, composite } from "./doc.mjs";
import { createHistory } from "./history.mjs";
import { sitterPalette } from "./palette.mjs";
import { moodRegion, addMoodOverride } from "./variants.mjs";
import { carry, rebuild } from "./carry.mjs";
import { formTones } from "./form.mjs";
import { peopleOf, tintTones, peopleSwatches } from "./peoples.mjs";

export { castOf, eraOf, personOf } from "./cast.mjs";
import { eraOf, personOf } from "./cast.mjs";
export function catalogue(members) {
  const by = new Map();
  for (const [key, m] of Object.entries(members)) {
    const p = personOf(key); if (!by.has(p)) by.set(p, []);
    by.get(p).push({ key, era: eraOf(key), age: m.info?.quota?.age ?? null, name: m.info?.name || key });
  }
  return [...by].map(([person, records]) => ({ person, records: records.sort((a, b) => a.era - b.era) }));
}
export const seedOf = (who) => [...who].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);

// layer 1: the rendering lead's portrait painter (paintPortrait({ G, A, face, seed, opts })), told where the
// key is in the world and on screen, and the mood's cue (lids, mouth corners)
export function underpaint(ref, seed) {
  const kd = ref.meta.keyDir, n = Math.hypot(kd[0], kd[1]) || 1;
  return paintPortrait({ G: ref.G, A: ref.A, face: ref.face, seed, opts: { key: { dir: kd, c: [1.0, 0.84, 0.64] }, keyScreen: [kd[0] / n, -kd[1] / n], cue: ref.cue } });
}
export function newSitting({ members, who, timing, mood = "neutral", cam = CAM, key = KEY, w = 768, h = 960, seed = null }) {
  const ref = sit({ members, who, timing, mood, w, h, cam, key }), sd = seed ?? seedOf(who), under = underpaint(ref, sd);
  ref.mouthLine = under.info?.mouth || null;   // the painter's mouth line, for the scripted mouth
  const doc = createDoc(w, h, { ...ref.meta, era: eraOf(who), person: personOf(who), seed: sd, info: { neutral: under.info || null } });
  addLayer(doc, { name: "underpainting", author: "procedural", locked: true, fill: under });
  addLayer(doc, { name: "paint", author: "human" });
  const people = peopleOf(members[who]); doc.meta.people = people;   // the people's palette leans the tones, a little
  doc.ref = ref; doc.meta.formTones = tintTones(formTones(ref), people); composite(doc);   // doc.ref: the reference the blend regions and rule masks read
  return { members, timing, ref, under, doc, history: createHistory(doc), palette: [...sitterPalette(ref), ...peopleSwatches(people)], moodRefs: {} };
}
// a mood as an override on the base portrait (see variants.mjs)
export function moodSitting(s, mood) {
  const m = s.moodRefs[mood] || (s.moodRefs[mood] = sit({ members: s.members, who: s.doc.meta.who, timing: s.timing, mood, w: s.doc.w, h: s.doc.h, cam: s.doc.meta.cam, key: s.doc.meta.key, dy: s.ref.meta.dy }));
  const region = moodRegion(s.ref, m), under = underpaint(m, s.doc.meta.seed); m.mouthLine = under.info?.mouth || null; (s.doc.meta.info ||= {})[mood] = under.info || null;
  return addMoodOverride(s.doc, mood, region, under);
}
// change the sitter (another age or era record), the camera or the key; carry the paint across by
// replaying its log through the form (carry.mjs)
export function revariant(s, change = {}) {
  const r = carry(s, newSitting, moodSitting, change);
  return { ...r, doc: r.sitting.doc };
}
export const rebuildSitting = (s) => rebuild(s, newSitting, moodSitting);
