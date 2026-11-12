// Moves learned from people (SYSTEMS-FULL 18.5 and 19.9), unlocked by flags `<district>.move_<name>`
// and paid in Composure when used. Two kinds:
//   variant  replaces a move while Lamb can pay for it: `of` names the action it rides on (heavy,
//            shove, step, use), `tools` the tool classes it works with, `patch` what changes
//   passive  always on once learned (the effect is in the simulation where it applies)
// Costs and patches are the combat engineer's (TUNING.md); names and teachers are the director's.
export const LEARNED = {
  hookpull: { from: "merrow", kind: "variant", of: "heavy", tools: ["long", "bar"], cost: 2, patch: { knockdown: true, knock: -3.6 } },
  feint: { from: "marrow", kind: "variant", of: "tap", tools: null, cost: 1, patch: {} },
  stool: { from: "sabine", kind: "passive", note: "the brawl's chair as a shield once (brawl props are not built)" },
  mudstep: { from: "cockle", kind: "passive", note: "no lurch and no water or mud penalty on footwork" },
  sweep: { from: "gorm", kind: "variant", of: "heavy", tools: ["long"], cost: 2, patch: { knockdown: true, wide: 75 } },
  shovethrough: { from: "lugg", kind: "variant", of: "shove", tools: null, cost: 1, patch: { knock: 8, through: true } },
  oarsweep: { from: "dace", kind: "variant", of: "heavy", tools: ["long"], cost: 2, patch: { wide: 100, knock: 2.6 } },
  snare: { from: "fisk", kind: "variant", of: "use", tools: null, cost: 1, patch: { snare: true } },
  recall: { from: "rook", kind: "variant", of: "step", tools: null, cost: 2, patch: { resetRead: true } },
  tuberunner: { from: "pip", kind: "variant", of: "step", tools: null, cost: 1, patch: { behind: true } },
  carriage: { from: "hester", kind: "passive", note: "after a catch, the next strike lands in the read window (weak point)" },
  lampguard: { from: "hobb", kind: "passive", note: "the guard no longer shutters a lit lantern" },
  countedge: { from: "tobit", kind: "passive", note: "the first three telegraphs of a fight read twice as early" },
  galleryhold: { from: "bright", kind: "passive", note: "a shove or a pull does not move Lamb" },
  wardensdrag: { from: "keel", kind: "variant", of: "heavy", tools: ["long"], cost: 2, patch: { knockdown: true, toward: "water", knock: 3.6 } },
};
