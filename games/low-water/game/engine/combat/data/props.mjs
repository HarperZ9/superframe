// The prop on each inner ground (combat/arena/innerprop.mjs): one heavy thing the boss can be baited into. Where it
// stands (PROP_AT, in cells) is on open floor away from the fight's anchor, so the player has to draw the boss to it.
// The name is what the drawer and the design docs call it; it is never a caption.
export const PROPS = {
  returns: { at: [14, 8.5], name: "the iron post" }, office: { at: [3, 9.5], name: "the stove" },
  kitchen: { at: [3, 7.5], name: "the dresser" }, yard: { at: [3, 9.5], name: "the pump" },
  maze: { at: [10, 7], name: "the king post" }, road: { at: [18, 9.5], name: "the milestone" },
  ice: { at: [4, 9], name: "the jetty post" }, street: { at: [3.5, 9], name: "the lamp post" },
  verge: { at: [3.5, 2.5], name: "the crier's post" }, supper: { at: [3, 8.5], name: "the sideboard" },
  fold: { at: [3, 8.5], name: "the trough" }, granary: { at: [16, 9], name: "the pillar" },
  survey: { at: [3, 8.5], name: "the survey stake" },
};
