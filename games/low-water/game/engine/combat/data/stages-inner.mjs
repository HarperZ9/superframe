// How each inner ground is staged on the arena page (combat/arena/innerstage.mjs draws it). After the author's
// references of 2026-10-22 (design/art/references/2026-10-22/REFERENCES.md: "The arena and the Host are John
// Martin"; Schinkel's cave temple, 62; the Trafalgar paintings, 26 to 29, for smoke and staging):
//   - black-velvet tone, with one shaft of light that has a source the player can see (03-SURREAL.md rule 5:
//     light keeps telling the truth about its source; the shaft lands on the room's own first lamp, `pool`);
//   - the colossal scale is in the building, never in a boss: no boss is taller than the Brack kitchen's ceiling
//     except Friday's Saturn phase (inferno/06-SYSTEMS.md, "Intensity without volume"). The rooms are dreams of
//     real rooms, "enlarged", "stretched tall", "larger inside than out" (02-BESTIARY-A, 03-BESTIARY-B);
//   - smoke as a mass at the foot of the building, debris that drifts, and a raw-rock frame where it fits.
// One entry per ground in combat/data/arenas-inner.mjs. Values are in the arena's ink-to-paper scale (0 to 1).
//   shaft   { from: [x, y] as fractions of the view (off the top is fine), w0 source width px, w1 pool width m,
//             k strength, still: dust that does not move (Only's noon) }
//   back    the building behind the room, back to front: shelves, tiers, pilasters, window, dresser, beam,
//           cells, stacks, sky, posts, bridge
//   floor   boards | flags | cobbles | snow | ice;  smoke  sources [x, z] on the floor;  debris  paper | dust |
//           ash | snow | grain | shards;  rock  a cave mouth round the frame;  ceiling  metres, when drawn
export const STAGES = {
  returns: { shaft: { from: [0.16, -0.2], w0: 22, w1: 3.0, k: 0.55, pool: 0 }, back: ["tiers", "shelves", "pilasters"], haze: 0.2,
    floor: "boards", smoke: [[1.5, 1.6], [16.5, 1.6], [3, 1.4], [14, 1.3]], debris: "grain", rock: false, side: true },
  office: { shaft: { from: [0.8, 0.12], w0: 30, w1: 4.0, k: 0.62, pool: 0, still: true }, back: ["tiers", "window", "pilasters"], haze: 0.18,
    floor: "boards", smoke: [[1.5, 1.5], [18.5, 1.5]], debris: "dust", rock: false, side: false, window: [0.8, 0.12] },
  kitchen: { shaft: { from: [0.6, 0.17], w0: 14, w1: 2.6, k: 0.5, pool: 0 }, back: ["dresser", "beam"], haze: 0.2, ceiling: 4.3,
    floor: "flags", smoke: [[2.5, 1.5], [13.5, 1.6]], debris: "ash", rock: false, side: false, window: [0.6, 0.17] },
  yard: { shaft: { from: [0.82, -0.25], w0: 20, w1: 3.2, k: 0.42, pool: 0 }, back: ["cells"], haze: 0.26,
    floor: "cobbles", smoke: [[1.5, 1.5], [18.5, 1.8], [10, 1.2]], debris: "snow", rock: true, side: false },
  maze: { shaft: { from: [1.05, 0.05], w0: 16, w1: 2.4, k: 0.5, pool: 1 }, back: ["stacks"], haze: 0.16,
    floor: "boards", smoke: [[2, 1.5], [19, 1.5], [10, 1.4]], debris: "grain", rock: false, side: false },
  road: { shaft: { from: [0.3, -0.3], w0: 40, w1: 5.0, k: 0.4, pool: 0 }, back: ["sky", "posts"], haze: 0.3,
    floor: "snow", smoke: [[1.5, 1.6], [20.5, 1.8]], debris: "snow", rock: false, side: false },
  ice: { shaft: { from: [0.55, -0.3], w0: 16, w1: 3.0, k: 0.55, pool: 0 }, back: ["bridge"], haze: 0.32,
    floor: "ice", smoke: [[1.5, 1.6], [18.5, 1.6], [5, 1.4], [15, 1.4]], debris: "shards", rock: true, side: false },
  // era 5 (2026-10-23): Mill Street over the square's stones, the van's light the shaft's source; the verge under
  // sodium with the phone mast where the bell hung; the snow yard of a Descent ring, its stove door the one light
  street: { shaft: { from: [0.92, 0.3], w0: 26, w1: 3.4, k: 0.5, pool: 1 }, back: ["pilasters", "window"], haze: 0.22,
    floor: "cobbles", smoke: [[1.5, 1.5], [20.5, 1.6], [11, 1.3]], debris: "dust", rock: false, side: true, window: [0.92, 0.3] },
  verge: { shaft: { from: [0.3, -0.3], w0: 30, w1: 4.0, k: 0.42, pool: 0 }, back: ["sky", "posts"], haze: 0.28,
    floor: "flags", smoke: [[1.5, 1.6], [18.5, 1.6]], debris: "dust", rock: false, side: false },
  snow: { shaft: { from: [0.86, 0.1], w0: 18, w1: 2.6, k: 0.48, pool: 0 }, back: ["cells"], haze: 0.24,
    floor: "snow", smoke: [[1.5, 1.4]], debris: "snow", rock: true, side: false },
  // the last four (2026-10-23): the supper's lamps along the table; the fold under a cold moon; the granary's chute
  // lit from the train beyond; Pell's lamp over his board, then the river
  supper: { shaft: { from: [0.55, -0.2], w0: 24, w1: 3.6, k: 0.55, pool: 0 }, back: ["beam", "tiers"], haze: 0.2,
    floor: "boards", smoke: [[1.5, 1.5], [20.5, 1.5]], debris: "dust", rock: false, side: false },
  fold: { shaft: { from: [0.7, -0.3], w0: 30, w1: 4.0, k: 0.4, pool: 0 }, back: ["sky", "posts"], haze: 0.3,
    floor: "snow", smoke: [[1.5, 1.6], [18.5, 1.6]], debris: "snow", rock: true, side: false },
  granary: { shaft: { from: [0.95, 0.1], w0: 20, w1: 3.0, k: 0.5, pool: 1 }, back: ["stacks", "beam"], haze: 0.24,
    floor: "boards", smoke: [[1.5, 1.5], [20.5, 1.5], [11, 1.3]], debris: "grain", rock: false, side: false },
  survey: { shaft: { from: [0.45, 0.05], w0: 16, w1: 2.6, k: 0.52, pool: 0 }, back: ["shelves", "window"], haze: 0.2,
    floor: "boards", smoke: [[1.5, 1.4], [16.5, 1.4]], debris: "dust", rock: false, side: false, window: [0.45, 0.05] },
  "control-wide": { shaft: { from: [0.5, -0.2], w0: 20, w1: 3, k: 0.4, pool: 0 }, back: ["pilasters"], haze: 0.14, floor: "boards", smoke: [], debris: "dust", rock: false, side: false },
};
export const stageOf = (A) => STAGES[A.name] || STAGES.returns;
