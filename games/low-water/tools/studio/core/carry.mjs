// Carry a painting to another reference (another age or era record, a moved camera or key) by replaying
// its log through the form: a new sitting is made for the new reference, the old painting's layers are
// set up again (rule masks rebuilt on the new form, moods re-rendered), and every record is replayed with
// its points moved by the correspondence between the two references (reproject.mjs). The carried painting
// is a log in its own right, so it rebuilds exactly like any other. Flags: where the form changed (no near
// match) and where a liquify or transform reshaped the paint.
//   carry(s, newSitting, moodSitting, change) -> { sitting, repaint, flaggedShare }
import { addLayer, composite } from "./doc.mjs";
import { replay } from "./stroke.mjs";
import { maskFill } from "./masks.mjs";
import { correspond, pointMap } from "./reproject.mjs";
import { footprint, reshapes } from "./liquify.mjs";

function setUpLayers(old, s2, moodSitting) {
  const doc = s2.doc;
  for (const mood of [...new Set(old.layers.filter((l) => l.mood).map((l) => l.mood))]) moodSitting(s2, mood);
  for (const L of old.layers) {
    if (doc.layers.some((l) => l.name === L.name)) continue;
    const target = old.layers.find((t) => t.id === L.target)?.name, tid = doc.layers.find((t) => t.name === target)?.id ?? null;
    const nl = addLayer(doc, { name: L.name, kind: L.kind, author: L.author, opacity: L.opacity, locked: L.locked, blend: L.blend, group: L.group, target: tid, fill: L.kind === "mask" && L.rule ? maskFill(L.rule, s2.ref) : null });
    if (L.rule) nl.rule = L.rule; nl.mood = L.mood;
  }
  const at = (l) => old.layers.findIndex((o) => o.name === l.name); doc.layers.sort((a, b) => at(a) - at(b));
  doc.groups = structuredClone(old.groups || {});
}
export function carry(s, newSitting, moodSitting, { who = s.doc.meta.who, cam = s.doc.meta.cam, key = s.doc.meta.key } = {}) {
  const old = s.doc, s2 = newSitting({ members: s.members, who, timing: s.timing, cam, key, w: old.w, h: old.h });
  const corr = correspond(s.ref, s2.ref), map = pointMap(corr);
  setUpLayers(old, s2, moodSitting); composite(s2.doc);
  replay(s2.doc, old.strokes, { map: (x, y) => map(x, y) });
  const repaint = Uint8Array.from(corr.flags, (f, i) => (f && s2.ref.G.id[i] ? 1 : 0));
  for (const r of old.strokes.filter(reshapes)) { const fp = footprint(r, old.w, old.h); for (let i = 0; i < repaint.length; i++) if (fp[i] && s2.ref.G.id[i]) repaint[i] = 1; }
  let flagged = 0, fig = 0; for (let i = 0; i < repaint.length; i++) { if (s2.ref.G.id[i]) fig++; if (repaint[i]) flagged++; }
  for (const L of old.layers) { const n = s2.doc.layers.find((l) => l.name === L.name); if (n) n.visible = L.visible; }
  s2.doc.meta.repaint = repaint; s2.doc.meta.carriedFrom = { who: old.meta.who, cam: old.meta.cam, key: old.meta.key }; composite(s2.doc);
  return { sitting: s2, repaint, flaggedShare: fig ? flagged / fig : 0 };
}
// lay the painting again from its log on a fresh sitting of the same reference (the underpainting, the
// moods and the rule masks regenerated, so a liquify replayed here does not land on one already applied)
export function rebuild(s, newSitting, moodSitting) {
  const old = s.doc, m = old.meta, s2 = newSitting({ members: s.members, who: m.who, timing: s.timing, cam: m.cam, key: m.key, w: old.w, h: old.h, seed: m.seed });
  setUpLayers(old, s2, moodSitting); composite(s2.doc); replay(s2.doc, old.strokes, { history: null });
  for (const L of old.layers) { const n = s2.doc.layers.find((l) => l.name === L.name); if (n) n.visible = L.visible; }
  composite(s2.doc); return s2;
}
