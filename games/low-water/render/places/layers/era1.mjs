// Era 1 (The Exchange, year 0): what the census room, the board room and the loft carry for later eras (design/WORLD-LAYERS.md
// section 3). Game content for the reusable makers in render/props/layers_*.mjs, laid over each place's built world by
// render/props/dress.mjs. World-layers pass, 2026-10-23. Marks named here are the @prop marks in content/quota/e1_layers.lwd.
import { sheet, framedPhoto, palePatch, PICTURES } from "../../props/layers_wall.mjs";
import { spoon, openBook, pamphlet, ring, shelfBoard } from "../../props/layers_things.mjs";
import { ID } from "../../props/prim.mjs";

const HAND = { ink: ["lw tar", 0.22], hand: 0.5 };
export const DRESS = {
  // the registrar's front counter (HX 3.0, HZ 2.2): the rule on the back wall over the clerk's desk, a slip on the counter, a
  // child's thread at the foot of the queue rail
  q1_census: () => [
    { p: sheet("residency_rule", 2.35, 1.95, -2.2, { w: 0.46, h: 0.6, lines: ["NOTICE", "", "BY ORDER OF", "THE BOARD", "", "HANDS SEASONAL", "ARE NOT", "RESIDENTS OF", "THE DISTRICT", "", "E. MOTT, CLERK"], ...HAND, hand: 0.25 }),
      spot: { id: "rule", verb: "read", at: [2.9, 0, -0.45], note: "the residency rule over the clerk's desk, in Edwin Mott's round hand" } },
    { p: sheet("copy_slip_top", 0.62, 1.04, 0.05, { face: "y", a: 0.25, w: 0.15, h: 0.1, lines: ["SALLIS, A.", "HAND, SEASONAL", "NOT RES. 17 IX"], ...HAND, pins: 0 }),
      spot: { id: "slips", verb: "read", at: [1.2, 0, 0.85], note: "the copy slips on the counter: the sevens have no bar" } },
    { p: ring(-2.45, 0.0, 1.95, { r: 0.022, name: "lost_thread" }) },
    { p: sheet("hours_card", -2.75, 1.55, -0.25, { face: "x", w: 0.22, h: 0.14, lines: ["REGISTRAR", "9 TILL 4", "NO HANDS AFTER 3"], ink: ["lw tar", 0.2], pins: 1 }) },
    { p: framedPhoto("councillor_portrait", -3.0, 2.15, -0.25, { face: "x", w: 0.22, h: 0.3, picture: PICTURES.portrait({ long: false }) }) },
  ],
  // the registrar's upstairs room (HX 3.2, HZ 2.4): the professor's pamphlet on the table, the minute book open on the
  // sideboard, the board's photograph between the windows, a print by the high desk
  q1_board: () => [
    { p: pamphlet("calley_pamphlet", -1.32, 0.76, 0.22, { a: 0.35, picture: PICTURES.goatcut({ back: false }), title: ["ON THE", "HILL PEOPLES"] }),
      spot: { id: "pamphlet", verb: "read", at: [-0.5, 0, 2.0], note: "the professor's pamphlet: a woodcut goat on the cover, facing forward" } },
    { p: openBook("minute_book_open", 1.82, 0.9, -1.95, { a: -0.1, w: 0.3, h: 0.22, text: ["RESOLVED THAT", "HANDS SEASONAL", "BE NOT COUNTED", "AS RESIDENT.", "17 IX.  E.M."], cover: ID.oxblood }) },
    { p: framedPhoto("board_photograph", 0, 1.8, -2.4, { w: 0.56, h: 0.36, picture: PICTURES.people({ n: 5 }) }) },
    { p: framedPhoto("exchange_print", -3.2, 1.95, 1.8, { face: "x", w: 0.42, h: 0.3, picture: PICTURES.people({ n: 3 }) }) },
  ],
  // Abel's hayloft (HX 2.6, HZ 2.0): Ilo's carving on the oat barrel by the lantern, shavings, and the beam
  q1_loft: () => [
    { p: [spoon(-2.1, 0.86, -1.5, { a: 0.4, name: "finished_spoon" }), spoon(-1.9, 0.86, -1.3, { a: -0.3, id: ID.timber, name: "roughed_spoon" }), spoon(-1.85, 0.86, -1.55, { a: 1.2, id: ID.timber, name: "roughed_spoon" })],
      spot: { id: "spoons", verb: "look", at: [-1.2, 0, -0.1], note: "Ilo's carving on the oat barrel: one spoon finished, the others roughed out" } },
    { p: sheet("beam_letters", -1.0, 2.35, -0.835, { w: 0.16, h: 0.07, lines: ["B.C.  N"], ink: ["lw tar", 0.12], ground: null, id: ID.beamoak, rough: 0.8, pins: 0, margin: 0.008 }),
      spot: { id: "beam", verb: "look", at: [-1.0, 0, 0.3], note: "the purlin over the hay: letters cut with a knife point, one set scraped out" } },
    { p: palePatch("beam_scrape", -0.83, 2.35, -0.838, { w: 0.09, h: 0.05, id: ID.timber, nail: false }) },
    { p: shelfBoard("loft_shelf", 1.3, 1.25, -1.95, { w: 0.5 }) },
  ],
};

// Static dressing that is looked at, not examined: what the people in each room carry, wear, use and leave (2026-10-23).
import { sack, blanket } from "../../props/gear.mjs";
import { jug, cup, knife } from "../../props/food.mjs";
import { roundHat, tinCup, newspaper } from "../../props/layers_things.mjs";
const EXTRA = {
  q1_census: () => [
    { p: [sack(-1.6, 0, 2.2, { s: 0.2, seed: 2, name: "hands_bundle" }), sack(-1.2, 0, 2.35, { s: 0.18, a: 0.8, seed: 3, name: "hands_bundle" })] },
    { p: roundHat(1.2, 0.47, 1.85, { id: ID.canvas, band: ID.canvas, name: "cloth_cap" }) },
    { p: jug(2.3, 0.47, 1.85, { s: 0.8, name: "hands_water_jug" }) },
    { p: cup(1.9, 1.03, -0.25, { id: ID.glass, s: 0.5, name: "ink_bottle" }) },
    { p: sheet("queue_card", 2.85, 1.6, -2.2, { w: 0.2, h: 0.26, lines: ["HANDS", "QUEUE", "AT THE", "RAIL"], ink: ["lw tar", 0.2], pins: 1 }) },
  ],
  q1_board: () => [
    { p: roundHat(-2.7, 1.86, -1.5, { name: "professors_hat", band: ID.tar }) },
    { p: newspaper("arlen_gazette", -1.3, 0.44, 1.6, { a: 0.5, w: 0.3, h: 0.22, lines: ["ARLEN", "HARVEST RECORD"] }) },
    { p: sheet("board_rules", 2.7, 1.8, -2.4, { w: 0.3, h: 0.4, lines: ["BOARD RULES", "", "NO SMOKING", "AT TABLE", "", "MEMBERS", "ONLY"], frame: ID.darkwood, pins: 0 }) },
  ],
  q1_loft: () => [
    { p: sack(1.95, 0, -0.6, { s: 0.2, seed: 9, name: "ilos_bundle", id: ID.canvas }) },
    { p: tinCup(1.95, 0, -0.25, { name: "ilos_cup" }) },
    { p: knife(-1.95, 0.86, -1.7, 0.8) },
    { p: blanket(1.4, 0.2, -0.6, { a: 0.3, name: "ilos_blanket" }) },
  ],
};
for (const k of Object.keys(EXTRA)) { const f = DRESS[k]; DRESS[k] = () => [...f(), ...EXTRA[k]()]; }
