// Act 2 fight areas (content/act2: the Hill, the Spit, the Gasholder, the Ropewalk). Placeholder
// geometry until the painted plates exist; heights in metres above chart datum (sim/field.mjs).
// anchors: where a prop written at `0 0` goes (sim/props.mjs anchorProps): cut (every light it
// puts out), lamp, snare, sluice.
const S = (h) => ({ surface: "stone", h }), W = (h) => ({ surface: "wood", h });
const rows = (w, h, ch) => Array.from({ length: h }, () => ch.repeat(w));

// The Lamplighters' station on Chancel Hill: a stone room under white trial lamps, no dark in it
// until the lamps go (`param: white-light`). The door at the bottom.
export const HILL = {
  name: "hill", place: "station", cell: 1, origin: [0, 0], rows: rows(14, 10, "S"),
  legend: { S: S(40) }, water: null,
  lights: [{ x: 3, z: 1, r: 7, k: 0.85 }, { x: 7, z: 1, r: 7, k: 0.85 }, { x: 11, z: 1, r: 7, k: 0.85 }],
  exits: [[6, 9.3, 8, 10]], tideEnds: false,
  anchors: { cut: [[3, 1], [7, 1], [11, 1]], lamp: [[7, 1]], snare: [[7, 5]] },
  spawns: { lamb: [7, 8], foes: [[4, 2.5], [10, 2.5], [7, 2], [2, 5], [12, 5]] },
};

// The Spit at the second low water: two barges on their sides (tilted planks), mud between, weed
// at the edges, a channel the tide fills first. The painter line between the barges is where a
// rigged rope goes. The boat is at the left edge.
export const SPIT = {
  name: "spit", place: "patience", cell: 1, origin: [0, 0],
  rows: [
    "wwwwwwwwwwwwwwwwwwwwww", "wwmmmmmddddddmmmmmmwww", "wmmmmmmddddddmmmddddmw", "wmmmmmmddddddmmmddddmw",
    "cmmmmmmddddddmmmddddmw", "ccmmmmmmmmmmmmmmddddmw", "cccmmmmmmmmmmmmmddddmw", "ccmmmmmmmmmmmmmmddddmw",
    "cmmmmmmmmmmmmmmmmmmmmw", "wmmmmmmmmmmmmmmmmmmmww", "wwmmmmmmmmmmmmmmmmmwww", "wwwwwwwwwwwwwwwwwwwwww",
  ],
  legend: { w: { surface: "weed", h: -0.7 }, m: { surface: "mud", h: -0.5 }, d: W(0.2), c: { surface: "mud", h: -1.1 } },
  water: { a: 0, b: 1 }, lights: [{ x: 18, z: 4, r: 5, k: 0.4 }], exits: [[0, 4, 0.8, 8]], tideEnds: true,
  anchors: { snare: [[14.5, 4.5]], lamp: [[18, 4]], cut: [[18, 4]] },
  spawns: { lamb: [5, 6], foes: [[15, 3], [17.5, 6.5], [13, 8], [19, 8]] },
};

// Under the gasholder frame: a ring of shingle round the Old Bulb's altar, candles in jars round
// the ring. The Old Bulb is the lamp that can be put out.
export const GASHOLDER = {
  name: "gasholder", place: "gas_frame", cell: 1, origin: [0, 0],
  rows: [
    "....................", "..gggggggggggggggg..", ".gggggggggggggggggg.", ".gggggggggggggggggg.", ".ggggggaaaaaaggggggg",
    ".ggggggaaaaaaggggggg", ".ggggggaaaaaaggggggg", ".gggggggggggggggggg.", ".gggggggggggggggggg.", "..gggggggggggggggg..",
    "....................",
  ],
  legend: { ".": { surface: "stone", h: 8 }, g: { surface: "shingle", h: 8 }, a: S(8.3) },
  water: null,
  lights: [{ x: 10, z: 5, r: 8, k: 0.55 }, { x: 3, z: 2, r: 3, k: 0.4 }, { x: 17, z: 2, r: 3, k: 0.4 }, { x: 3, z: 8.5, r: 3, k: 0.4 }, { x: 17, z: 8.5, r: 3, k: 0.4 }],
  exits: [[0, 4, 0.8, 7], [19.2, 4, 20, 7]], tideEnds: false,
  anchors: { lamp: [[10, 5]], cut: [[10, 5]], snare: [[10, 8.5]] },
  spawns: { lamb: [2.5, 5.5], foes: [[12, 3], [12, 8], [16, 5], [14, 5.5]] },
};

// The Ropewalk: a long narrow lane of cobbles, one paraffin lamp a street; after 01:00 the
// frost makes the cobbles glass (the night's frost does that here). Exits at both ends.
export const ROPEWALK = {
  name: "ropewalk", place: "rope_lane", cell: 1, origin: [0, 0], rows: rows(26, 6, "S"),
  legend: { S: S(9) }, water: null,
  lights: [{ x: 6, z: 1, r: 6, k: 0.5 }, { x: 19, z: 1, r: 6, k: 0.5 }],
  exits: [[0, 0, 0.8, 6], [25.2, 0, 26, 6]], tideEnds: false,
  anchors: { lamp: [[6, 1]], cut: [[6, 1], [19, 1]], snare: [[13, 3]] },
  spawns: { lamb: [13, 4], foes: [[3, 3], [23, 3], [2, 1.5], [24, 1.5]] },
};

// Act 3: inside the Old Light in the storm's eye, the low room: stone just above the low water,
// a flooded well in the middle, weed at the door, the stair up one wall. The strippers' lantern
// is the only light. When the eye passes the water comes back (`tideEnds`).
export const OLDLIGHT = {
  name: "oldlight", place: "oldlight_low", cell: 1, origin: [0, 0],
  rows: ["..ssss....", ".SSSSSSSS.", "SSSSSSSSSS", "SSSccccSSS", "SSSccccSSS", "SSSSSSSSSS", "SSSSSSSSSS", ".wwwwwwww.", "..wwwwww.."],
  legend: { ".": S(3), s: S(1.2), S: S(-0.05), c: { surface: "stone", h: -0.9 }, w: { surface: "weed", h: -0.3 } },
  water: { a: 0, b: 1 }, lights: [{ x: 7.5, z: 1.5, r: 4, k: 0.35 }], exits: [[3, 8.3, 7, 9]], tideEnds: true,
  anchors: { snare: [[5, 6.2]], lamp: [[7.5, 1.5]], cut: [[7.5, 1.5]] },
  spawns: { lamb: [5, 7.6], foes: [[7.5, 2.2], [2.5, 2.5], [6, 1.5]] },
};

export const ARENAS2 = { hill: HILL, spit: SPIT, gasholder: GASHOLDER, ropewalk: ROPEWALK, oldlight: OLDLIGHT };
