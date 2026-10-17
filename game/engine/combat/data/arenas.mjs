// Arenas as data (see sim/field.mjs for the fields). Heights are metres above chart datum, so
// the night's tide decides where the water stands: at 22:58 on night 1 (-0.55 m) only the gully
// holds water (ankle-deep); by 23:50 (-0.27 m) the gully is at the knee and the weed is wet; by
// 00:20 (+0.12 m) the mud is under and the fight is in the sea.
//
// The floor arena: the harbour floor below Lamp Quay at low water. The quay wall runs along the
// top with one sodium lamp; the gully cuts across from the steps to the drowned lamp; a wreck's
// planks lie on the mud; weed on the lower slabs. Placeholder geometry for the test arena only.
import { ARENAS2 } from "./arenas2.mjs";

export const FLOOR = {
  name: "floor", place: "floor", cell: 1, origin: [0, 0],
  rows: [
    "qqqqqqqqqqqqqqqqqqqqqqqq",
    "qqqqqqqqqqqqqqqqqqqqqqqq",
    "SSSSSSSssqqqSSSSSSSSSSSS",
    "SSSSSSSSssSSSSSSmmmmmSSS",
    "mmmmSSSSSggSSSSmmmmmmmmm",
    "mmmmmmSSSSggSSmmmmmmmmmm",
    "mmmmmmmmmmmggmmmmmddddmm",
    "mmmwwwmmmmmmggmmmmddddmm",
    "mmwwwwwmmmmmmggmmmmmmmmm",
    "mmwwwwwwmmmmmmgggmmmmwww",
    "mmmwwwwmmmmmmmmgggmmwwww",
    "mmmmmmmmmmmmmmmmmggwwwww",
    "wwwmmmmmmmmmmmmmmmmggwww",
    "wwwwwmmmmmmmmmmmmmmmggww",
  ],
  legend: {
    q: { surface: "stone", h: 5.8 },   // the quay (above high water; the Act 3 surge tops it)
    s: { surface: "stone", h: 2.5 },   // the steps
    S: { surface: "stone", h: -0.12 }, // slabs below the wall
    m: { surface: "mud", h: -0.3 },
    w: { surface: "weed", h: -0.42 },
    g: { surface: "mud", h: -0.8 },    // the gully: ankle-deep at low water, knee-deep by 23:50
    d: { surface: "wood", h: -0.05 },  // a wreck's planks
  },
  water: { a: 0, b: 1 },
  lights: [{ x: 10.5, z: 1.2, r: 8, k: 0.55, sodium: true }],
  exits: [[7, 0, 12, 1.2]], tideEnds: true, props: [["lamp", 10.5, 1.2]],
  spawns: { lamb: [6.5, 3.5], steps: [8.5, 2.5], foes: [[12.5, 10.5], [4.5, 11.5], [20.5, 11.5]] },
};

const STONE = { surface: "stone", h: 5.8 }, WOOD = (h) => ({ surface: "wood", h });

// Lamp Quay: sodium on wet stone; the steps down to the floor at the bottom middle.
export const QUAY = {
  name: "quay", place: "quay", cell: 1, origin: [0, 0],
  rows: [
    "SSSSSSSSSSSSSSSSSSSS", "SSSSSSSSSSSSSSSSSSSS", "SSSSSSSSSSSSSSSSSSSS", "SSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSS", "SSSSSSSSSSSSSSSSSSSS", "SSSSSSSSSSSSSSSSSSSS", "SSSSSSSSssSSSSSSSSSS",
    "SSSSSSSSssSSSSSSSSSS",
  ],
  // the quay edge is the arena's south bound: going over into the harbour is not built yet
  legend: { S: STONE, s: { surface: "stone", h: 2.5 } },
  water: { a: 0, b: 1 },
  lights: [{ x: 3.5, z: 2, r: 9, k: 0.6, sodium: true }, { x: 10.5, z: 2, r: 9, k: 0.6, sodium: true }, { x: 17.5, z: 2, r: 9, k: 0.6, sodium: true }],
  exits: [[0, 0, 0.8, 7], [19.2, 0, 20, 7]], tideEnds: false, props: [["lamp", 3.5, 2], ["lamp", 10.5, 2], ["lamp", 17.5, 2]],
  spawns: { lamb: [10, 4], foes: [[5, 5], [15, 5], [10, 1.5]] },
};

// The lamp room at Mother: a small round floor, frost on the gallery side, the lens in the middle.
export const LAMP = {
  name: "lamp", place: "mole", cell: 1, origin: [0, 0],
  rows: ["..ffff..", ".ffffff.", "ffffffff", "fffLLfff", "fffLLfff", "SSSSSSSS", ".SSSSSS.", "..SSSS.."],
  legend: { ".": STONE, f: { surface: "stone", h: 30 }, S: { surface: "wood", h: 30 }, L: { surface: "stone", h: 30, solid: true } },
  water: null, lights: [{ x: 4, z: 4, r: 6, k: 0.5 }], exits: [[3, 7.3, 5, 8]], tideEnds: false,
  spawns: { lamb: [4, 6.5], foes: [[4, 1.5]] },
};

// The weigh-house floor in the after-vote: boards, benches at the walls, lights out.
export const WEIGH = {
  name: "weigh", place: "weigh_in", cell: 1, origin: [0, 0],
  rows: ["WWWWWWWWWWWWWW", "WWWWWWWWWWWWWW", "WWWWWWWWWWWWWW", "WWWWWWWWWWWWWW", "WWWWWWWWWWWWWW", "WWWWWWWWWWWWWW", "WWWWWWWWWWWWWW", "WWWWWWWWWWWWWW", "WWWWWWWWWWWWWW", "WWWWWWWWWWWWWW"],
  legend: { W: WOOD(6.5) }, water: null, lights: [], exits: [[6, 9.3, 8, 10]], tideEnds: false,
  spawns: { lamb: [7, 7], foes: [[7, 2], [3, 3], [11, 3]] },
};

// The Gut's lanes: mud between smokehouse walls, a gutter down the middle.
export const GUT = {
  name: "gut", place: "gut", cell: 1, origin: [0, 0],
  rows: ["mmmmmmmmmmmmmmmm", "mmmmmmmmmmmmmmmm", "mmmmmmmggmmmmmmm", "mmmmmmmggmmmmmmm", "mmmmmmmggmmmmmmm", "mmmmmmmggmmmmmmm", "mmmmmmmmmmmmmmmm", "mmmmmmmmmmmmmmmm"],
  legend: { m: { surface: "mud", h: 6.2 }, g: { surface: "stone", h: 6.0 } }, water: null,
  lights: [{ x: 4, z: 1, r: 5, k: 0.45 }, { x: 12, z: 6, r: 5, k: 0.45 }], exits: [[0, 0, 0.8, 8], [15.2, 0, 16, 8]], tideEnds: false,
  spawns: { lamb: [8, 6], foes: [[3, 2], [13, 2], [8, 1]] },
};

// The Brine's bar room in the Wet Hour: boards, the stove warm on one side.
export const BRINE = {
  name: "brine", place: "brine", cell: 1, origin: [0, 0],
  rows: ["WWWWWWWWWWWW", "WWWWWWWWWWWW", "WWWWWWWWWWWW", "WWWWWWWWWWWW", "WWWWWWWWWWWW", "WWWWWWWWWWWW", "WWWWWWWWWWWW", "WWWWWWWWWWWW"],
  legend: { W: WOOD(6.5) }, water: null, lights: [{ x: 2, z: 2, r: 6, k: 0.6 }], exits: [[5, 7.3, 7, 8]], tideEnds: false,
  spawns: { lamb: [6, 6], foes: [[3, 2], [9, 2], [6, 1]] },
};

// Encounter areas to arenas (the area: key of every @encounter, Acts 1 and 2).
export const ARENAS = { floor: FLOOR, quay: QUAY, lamp: LAMP, weigh: WEIGH, gut: GUT, brine: BRINE, ...ARENAS2 };
