// The inner arena's grounds (design/spine-plan/inferno/02 and 03, each boss's "Arena"), placeholder geometry
// in the arena's row format (combat/sim/field.mjs). All are under shelter (no weather: a dream's room) on the
// test content's sheltered place; the look comes from combat/arena/forms.mjs and the inner palette. One cell is
// one metre. Every ground names the one object that stays in the base look (anchors.anchor, 07-SENSES.md
// section 1, "The anchor rule holds in every fight") and has no way out unless its flaw can be refused.
//   returns   the exchange scale's floor enlarged (Steady Hand): the desk, the racks of iron weights, the clock
//   office    the district office at noon (Only): the long table, eleven chairs and the twelfth, one door
//   kitchen   the Brack kitchen stretched tall (Friday): the table, the dresser, the lamp, the north wall
//   yard      Haldane Yard at night, closing to the end cell (He's With Me)
//   maze      the granary's sack stacks as corridors, opening on the wicket (Nearest One)
//   road      the road post in snow: the hut and its lantern, the dip in the road (Forty Carts)
//   ice       the Cocytus ring, a frozen river under the town's bridge (the Adversary's three movements)
//   street    Mill Street in era 5's look over the allocation square's stones (Order); the wall closes it from the left
//   verge     the ring road's verge at night, the one stone at a wrong angle in the clean edge (Everybody Says)
//   snow      a yard in snow with the stove door open: a Descent ring whose flaw was resolved without force
//   supper    the harvest supper in Orme's barn: the long table, the hat's place at its head, a door at the far end
//             (Fond of Them); the barn door propped against the wall is the anchor
//   fold      Tesk's fold on the hill at night in snow, rock under it; a lantern on the bare rock the anchor (Under the Goats)
//   granary   the granary floor; the chute's throat at the far end, the train beyond (The Long Barn)
//   survey    Pell's surveyor's office over the allocation map, which freezes into the Edd (The Figure)
import { PROPS } from "./props.mjs";

const F = { surface: "wood", h: 60 }, K = { surface: "stone", h: 60, solid: true }, D = { surface: "wood", h: 60, solid: true };
const ST = { surface: "stone", h: 60 }, SN = { surface: "stone", h: 60 }, FR = { surface: "frost", h: 60 }, IC = { surface: "stone", h: 60 };
const PLACE = "weigh_in"; // the test content's sheltered place: no rain, wind or frost reach a dream
const box = (w, h, fill = ".") => Array.from({ length: h }, (_, z) => Array.from({ length: w }, (_, x) => (x === 0 || z === 0 || x === w - 1 || z === h - 1 ? "K" : fill)).join(""));
const put = (rows, x0, z0, block) => { const out = rows.map((r) => r.split("")); block.forEach((line, dz) => [...line].forEach((ch, dx) => { if (ch !== " ") out[z0 + dz][x0 + dx] = ch; })); return out.map((r) => r.join("")); };

// the bowl: rows whose corners close in toward an ellipse (Received's eye, the Golem's walls)
export function bowl(rows, inset) {
  const h = rows.length, w = rows[0].length, cx = (w - 1) / 2, cz = (h - 1) / 2;
  const rx = cx - inset, rz = cz - inset * 0.6;
  return rows.map((r, z) => [...r].map((ch, x) => (ch === "K" || ((x - cx) / Math.max(1, rx)) ** 2 + ((z - cz) / Math.max(1, rz)) ** 2 > 1 ? "K" : ch)).join(""));
}

export const RETURNS = {
  name: "returns", place: PLACE, cell: 1, origin: [0, 0],
  rows: put(box(18, 11), 7, 4, ["DDDD", "DDDD"]),
  legend: { ".": F, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 9, z: 3, r: 7, k: 0.62 }, { x: 4, z: 8, r: 4, k: 0.35 }],
  anchors: { anchor: [[9, 1.3]], clock: [[15.5, 1.3]], desk: [[9, 5]] },
  spawns: { lamb: [9, 8.5], foes: [[4, 4.5]] },
};

// the office: the long table and the chairs round it (the coats' places), the door at the bottom right
const OFFICE_ROWS = put(box(20, 12), 6, 4, ["DDDDDDDD", "DDDDDDDD", "DDDDDDDD"]).map((r, z) => (z === 11 ? r.slice(0, 16) + ".." + r.slice(18) : r));
export const OFFICE = {
  name: "office", place: PLACE, cell: 1, origin: [0, 0],
  rows: OFFICE_ROWS, legend: { ".": F, K, D }, water: null, tideEnds: false,
  exits: [], door: [[16, 10.2, 18, 12.4]], // only the refusal opens it (combat/data/flaws-ned.mjs, Only)
  lights: [{ x: 10, z: 5.5, r: 9, k: 0.72 }],
  anchors: { anchor: [[3, 1.3]], door: [[17, 11]], chair12: [[10, 8.2]] },
  // the eleven chairs round the table: three a long side, the ends, and the twelfth (the player's, empty)
  chairs: [[7, 3.2], [9.5, 3.2], [12, 3.2], [14.6, 3.2], [5.2, 4.6], [5.2, 6.4], [14.8, 4.6], [14.8, 6.4], [7, 7.8], [12.5, 7.8], [14.6, 7.8]],
  spawns: { lamb: [10, 9.6], foes: [[10, 2.2]] },
};

export const KITCHEN = {
  name: "kitchen", place: PLACE, cell: 1, origin: [0, 0],
  rows: put(put(box(16, 10), 6, 4, ["DDDD", "DDDD"]), 2, 1, ["DDDDDD"]),
  legend: { ".": F, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 8, z: 4.5, r: 6, k: 0.6 }],
  anchors: { anchor: [[8, 5]], wall: [[8, 0.6]], lamp: [[8, 4.5]] },
  spawns: { lamb: [8, 8], foes: [[12.5, 3]] },
};

export const YARD = {
  name: "yard", place: PLACE, cell: 1, origin: [0, 0],
  rows: put(box(20, 12, "."), 15, 1, ["DDDD", "D  D", "DDDD"]),
  legend: { ".": ST, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 4, z: 3, r: 5, k: 0.4 }, { x: 10, z: 8, r: 4, k: 0.28 }],
  anchors: { anchor: [[16.5, 2.5]], cell: [[16.5, 2.5]] },
  spawns: { lamb: [6, 8], foes: [[8, 7]] },
};

export const MAZE = {
  name: "maze", place: PLACE, cell: 1, origin: [0, 0],
  // stacks two sacks square with aisles between, so a body steering round one finds the aisle (corridors of
  // solid stacks a cell wide trapped both the beast and the player on either side of a stack)
  rows: [
    "KKKKKKKKKKKKKKKKKKKKK",
    "K...................K",
    "K..SS...SS...SS.....K",
    "K..SS...SS...SS.....K",
    "K...................K",
    "K.....SS...SS...SS..K",
    "K.....SS...SS...SS...",
    "K...................K",
    "K..SS...SS...SS.....K",
    "K..SS...SS...SS.....K",
    "K...................K",
    "K.....SS...SS...SS..K",
    "K.....SS...SS...SS..K",
    "K...................K",
    "KKKKKKKKKKKKKKKKKKKKK",
  ],
  legend: { ".": F, K, S: D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 6, z: 12.5, r: 5, k: 0.5 }, { x: 18, z: 8.5, r: 5, k: 0.42 }, { x: 12, z: 1.5, r: 5, k: 0.38 }],
  anchors: { anchor: [[2.5, 12.5]], wicket: [[20, 6.5]], gap: [[18.5, 6.5]] },
  spawns: { lamb: [2.5, 12.5], foes: [[17, 1.8]] },
};

export const ROAD = {
  name: "road", place: PLACE, cell: 1, origin: [0, 0],
  rows: put(box(22, 12, "."), 2, 1, ["DDD", "DDD"]).map((r, z) => (z % 4 === 2 ? r.replace(/\.\.\.\.(?=\.\.K$)/, "ffff") : r)),
  legend: { ".": SN, f: FR, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 4, z: 4.5, r: 6, k: 0.5 }, { x: 16, z: 6, r: 6, k: 0.32 }],
  anchors: { anchor: [[3, 3.4]], line: [[1.4, 6]], dip: [[20.5, 6]], pole: [[11, 6]] },
  spawns: { lamb: [7, 8], foes: [[12, 6]] },
};

export const ICE = {
  name: "ice", place: PLACE, cell: 1, origin: [0, 0],
  rows: box(20, 12, "."), legend: { ".": IC, f: FR, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 10, z: 4, r: 6, k: 0.55 }],
  anchors: { anchor: [[10, 1.2]], lamp: [[11.8, 3.6]], desk: [[10, 3]] },
  spawns: { lamb: [10, 9], foes: [[10, 4.5]] },
};

export const STREET = {
  name: "street", place: PLACE, cell: 1, origin: [0, 0],
  rows: put(box(22, 11, "."), 9, 1, ["DDDD"]), legend: { ".": ST, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 6, z: 3, r: 6, k: 0.5 }, { x: 16, z: 6, r: 6, k: 0.45 }],
  anchors: { anchor: [[11, 5.5]], kerb: [[16, 2.2], [16, 8.8]], van: [[20, 5.5]] },
  spawns: { lamb: [5, 5.5], foes: [[15, 5.5]] },
};

export const VERGE = {
  name: "verge", place: PLACE, cell: 1, origin: [0, 0],
  rows: box(20, 12, "."), legend: { ".": ST, f: FR, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 6, z: 4, r: 6, k: 0.42 }, { x: 15, z: 8, r: 5, k: 0.3 }],
  anchors: { anchor: [[16.5, 9]], verge: [[4, 10.2], [7, 10.4], [10, 10.2], [13, 10.4]] },
  spawns: { lamb: [4, 6], foes: [[10, 4]] },
};

export const SNOW = {
  name: "snow", place: PLACE, cell: 1, origin: [0, 0],
  rows: box(16, 10, "."), legend: { ".": FR, K }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 13.5, z: 5, r: 4, k: 0.5 }],
  anchors: { anchor: [[14, 5]], stove: [[14, 5]] },
  spawns: { lamb: [2, 5], foes: [[8, 5]] },
};

const SUPPER_ROWS = put(box(22, 11), 6, 4, ["DDDDDDDDDD", "DDDDDDDDDD"]).map((r, z) => (z === 10 ? r.slice(0, 19) + ".." + r.slice(21) : r));
export const SUPPER = {
  name: "supper", place: PLACE, cell: 1, origin: [0, 0],
  rows: SUPPER_ROWS, legend: { ".": F, K, D }, water: null, tideEnds: false,
  exits: [], door: [[19, 9.2, 21, 11.4]], // only the refusal opens it (Fond of Them)
  lights: [{ x: 11, z: 4.5, r: 8, k: 0.68 }, { x: 18, z: 8, r: 4, k: 0.35 }],
  anchors: { anchor: [[1.3, 2.2]], head: [[16.8, 4.6]], hat: [[16.8, 4.6]], door: [[20, 10.2]] },
  spawns: { lamb: [8, 8.2], foes: [[16.8, 4.6]] },
};

export const FOLD = {
  name: "fold", place: PLACE, cell: 1, origin: [0, 0],
  rows: put(box(20, 12, "."), 13, 1, ["DDD"]), legend: { ".": SN, f: FR, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 11, z: 5, r: 6, k: 0.42 }],
  anchors: { anchor: [[16.5, 2.6]], dig: [[6, 3], [10, 9.5], [14, 8.5], [4, 8.5], [9, 2.5], [16, 6], [12, 2.2], [6, 10]] },
  spawns: { lamb: [6, 7], foes: [[11, 5]] },
};

export const GRANARY = {
  name: "granary", place: PLACE, cell: 1, origin: [0, 0],
  rows: put(box(22, 11, "."), 20, 4, ["D", " ", " ", "D"]), legend: { ".": F, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 10, z: 5, r: 7, k: 0.55 }, { x: 19, z: 5.5, r: 3, k: 0.4 }],
  anchors: { anchor: [[2.5, 2.2]], throat: [[19.6, 5.5]] },
  spawns: { lamb: [6, 5.5], foes: [[15, 5.5]] },
};

export const SURVEY = {
  name: "survey", place: PLACE, cell: 1, origin: [0, 0],
  rows: put(box(18, 11, "."), 7, 2, ["DDD", "DDD"]), legend: { ".": F, f: FR, K, D }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 8, z: 4, r: 6, k: 0.6 }],
  anchors: { anchor: [[8, 1.4]] },
  spawns: { lamb: [9, 8], foes: [[13, 4.5]] },
};

// a control for the framing check (combat/tools/inner-capture.mjs, bound F6): a 40 m room with the boss at the far
// end, wider than the view, so a camera that follows the character alone must lose the boss
export const CONTROL_WIDE = {
  name: "control-wide", place: PLACE, cell: 1, origin: [0, 0], rows: box(42, 10), legend: { ".": F, K }, water: null, tideEnds: false, exits: [],
  lights: [{ x: 6, z: 5, r: 8, k: 0.6 }, { x: 36, z: 5, r: 8, k: 0.6 }], anchors: { anchor: [[3, 1.3]], desk: [[20, 5]] }, spawns: { lamb: [3, 5], foes: [[38, 5]] },
};

export const INNER_ARENAS = { returns: RETURNS, office: OFFICE, kitchen: KITCHEN, yard: YARD, maze: MAZE, road: ROAD, ice: ICE, street: STREET, verge: VERGE, snow: SNOW, supper: SUPPER, fold: FOLD, granary: GRANARY, survey: SURVEY };
// where the prop stands on each ground (combat/data/props.mjs, combat/arena/innerprop.mjs)
for (const [k, P] of Object.entries(PROPS)) if (INNER_ARENAS[k]) INNER_ARENAS[k].anchors.prop = [P.at];
