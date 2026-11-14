// Portrait moods: directions in the voice bible's own terms (an emotion, an intensity, the lie flag), turned
// into a face by its portraitCue (game/engine/dialogue/direction.mjs), then into the units of whichever head
// the sitter has: the sculpted head reads the cue's sliders directly; the old head has no slider for the
// mouth's corners, so they widen the mouth instead, and the brows and lids are scaled into its units.
// Intensity 3 for every baked mood: the portrait is read at panel size, about 160 x 200 pixels at 720p.
export const MOODS = { neutral: {}, warm: { emo: "warm", int: 3 }, anxious: { emo: "anxious", int: 3 }, angry: { emo: "angry", int: 3 }, grieving: { emo: "grieving", int: 3 }, afraid: { emo: "afraid", int: 3 }, contempt: { emo: "contempt", int: 3 }, lying: { emo: "warm", int: 1, lie: true } };
export const OPEN = +(globalThis.process?.env?.LW_PORTRAIT_OPEN ?? -0.2);   // portraits keep the eyes a little wider than the in-world head (lids up)
export function exprFor(portraitCue, EXPRESSIONS, dir, sculpted) {
  const q = portraitCue(dir, {}), base = { ...(EXPRESSIONS[q.preset] || {}) };
  if (sculpted) return { ...base, lidsAdd: (base.lidsAdd || 0) + OPEN, brow: q.brow, browInner: q.browInner, lids: q.lids, corners: q.corners, cue: q };
  return { ...base, browY: (base.browY || 0) + q.brow * 0.09, browIn: (base.browIn || 0) + q.browInner * 0.07, lidsAdd: (base.lidsAdd || 0) + q.lids * 0.6 + OPEN, mouthW: (base.mouthW || 1) * (1 + 0.12 * q.corners), cue: q };
}
