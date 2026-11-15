// The Quota's fight areas (design/quota/03-STORY.md). Placeholder geometry until the rendering lead's
// plates exist; heights in metres (no tide on the plain: water null).
//   granary   the district granary (place q_granary, under its roof: no frost or wind): a stone floor between sack stacks (solid), the grain chute
//             along the east wall (anchors.chute: where the Captain's drag pulls), the door at the bottom
const S = { surface: "stone", h: 60 }, K = { surface: "wood", h: 60, solid: true };
export const GRANARY = {
  name: "granary", place: "q_granary", cell: 1, origin: [0, 0],
  rows: [
    "KKKKKKKKKKKKKKKK", "K..............K", "K..KK......KK..K", "K..KK......KK..K", "K..............K",
    "K..............K", "K..KK......KK..K", "K..KK......KK..K", "K..............K", "KKKKKK....KKKKKK",
  ].map((r) => r.replace(/\./g, "S")),
  legend: { S, K }, water: null,
  lights: [{ x: 8, z: 1.5, r: 6, k: 0.5 }, { x: 8, z: 8, r: 4, k: 0.35 }], exits: [[6, 9.2, 10, 10]], tideEnds: false,
  anchors: { chute: [[14.5, 4.5]], lamp: [[8, 1.5]], cut: [[8, 1.5]] },
  spawns: { lamb: [8, 8], foes: [[8, 3], [5, 4.5], [11, 4.5]] },
  // where each class stands when the door goes, read from the script's q_class (the story lead's q_granary.lwd puts
  // both inside with the Captain: the Sergeant on the door, the Inspector by the sacks with his book)
  standsBy: "q_class", stands: { militia: [8, 8], inspector: [12.5, 4.5] },
};
// The arena's venues (design/quota/05-ARENA.md), placeholder geometry: the mill yard at night with braziers
// (the bread fights, eras 2 and 3; the mill's grain chute in the wall is anchors.chute, for the Requisition
// Captain), and the ring under the old hoist (the boxing club, eras 4 and 5; anchors.ropes, for the Debt Man).
// Neither has a way out: the arena's ring.
const M = { surface: "mud", h: 60 }, Y = { surface: "stone", h: 60 }, Wd = { surface: "wood", h: 60.4 };
export const MILLYARD = {
  name: "millyard", place: "millyard", cell: 1, origin: [0, 0],
  rows: Array.from({ length: 12 }, (_, z) => Array.from({ length: 20 }, (_, x) => (x === 0 || z === 0 || x === 19 || z === 11 ? "K" : (x + z) % 5 === 0 ? "M" : "Y")).join("")),
  legend: { Y, M, K }, water: null,
  lights: [{ x: 4, z: 3, r: 5, k: 0.55 }, { x: 15, z: 3, r: 5, k: 0.55 }, { x: 10, z: 9, r: 5, k: 0.5 }], exits: [], tideEnds: false,
  anchors: { chute: [[18.5, 6]], lamp: [[4, 3]], cut: [[4, 3], [15, 3], [10, 9]] },
  spawns: { lamb: [10, 9], foes: [[10, 3], [5, 5], [15, 5]] },
};
export const CLUBRING = {
  name: "clubring", place: "clubring", cell: 1, origin: [0, 0],
  rows: Array.from({ length: 12 }, (_, z) => Array.from({ length: 12 }, (_, x) => (x === 0 || z === 0 || x === 11 || z === 11 ? "K" : "W")).join("")),
  legend: { W: Wd, K }, water: null,
  lights: [{ x: 6, z: 6, r: 7, k: 0.8 }], exits: [], tideEnds: false,
  anchors: { ropes: [[1.2, 6], [10.8, 6], [6, 1.2], [6, 10.8]], lamp: [[6, 6]], cut: [[6, 6]] },
  spawns: { lamb: [6, 9], foes: [[6, 3], [3, 4], [9, 4]] },
};
export const ARENAS_QUOTA = { granary: GRANARY, millyard: MILLYARD, clubring: CLUBRING };
