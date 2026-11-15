// Era 2 (The Quota, year 12; Anni's kitchen at year 38): the cells, the returns room, the two kitchens and Anni's kitchen
// (design/WORLD-LAYERS.md section 3). Game content for render/props/layers_*.mjs, laid over each built world by
// render/props/dress.mjs. World-layers pass, 2026-10-23. Marks named here are the @prop marks in content/quota/q_layers.lwd.
import { sheet, framedPhoto, palePatch, tideLine, strokeMark, PICTURES } from "../../props/layers_wall.mjs";
import { spoonJar, tinCup, newspaper, shelfBoard, openBook } from "../../props/layers_things.mjs";
import { boots } from "../../props/mill.mjs";
import { ID } from "../../props/prim.mjs";

export const DRESS = {
  // the cells (HX 3.6, HZ 2.6; the bars at z -0.45, the end cell x -3.6 to -1.2): the goat low on the end cell's back wall,
  // a shelf over the bench with a cup turned over, a cup the right way up in the women's cell
  q_cells: () => [
    { p: strokeMark("end_cell_goat", -2.75, 0.58, -2.6, { s: 0.11, look: "fresh" }),
      spot: { id: "goat", verb: "look", at: [-2.0, 0, 0.25], note: "low on the end cell's wall, at the height of somebody sitting: a goat scratched in the limewash" } },
    { p: [shelfBoard("cell_shelf", -1.85, 1.25, -2.6, { w: 0.5, d: 0.14 }), tinCup(-1.85, 1.262, -2.53, { up: false, name: "turned_cup" }), tinCup(-1.7, 1.262, -2.53, { name: "tin_cup" })] },
    { p: tinCup(2.6, 0.2, -2.3, { name: "womens_cup" }) },
    { p: sheet("cell_rules", 0.3, 1.6, -0.36, { w: 0.3, h: 0.36, lines: ["PRISONERS", "WILL STAND", "WHEN THE", "OFFICER", "ENTERS"], ink: ["lw tar", 0.2], peel: 0.02 }) },
  ],
  // the returns room (HX 3.4, HZ 2.8): over the left door, the clean square where the Crown Council's arms hung, with the
  // Directorate's notice pasted inside it and not covering the corners
  q_returns: () => [
    { p: palePatch("crown_patch", -3.4, 2.75, 1.8, { face: "x", w: 0.72, h: 0.56, id: ID.bone }) },
    { p: sheet("directorate_notice", -3.4, 2.73, 1.8, { face: "x", w: 0.46, h: 0.34, lines: ["PEOPLE'S", "DIRECTORATE", "DISTRICT", "RETURNS"], ink: ["red paint", 0.4], ground: ["lw paper", 0.66], th: 0.003 }),
      spot: { id: "crown_patch", verb: "look", at: [-2.6, 0, 1.0], note: "over the door: a square of cleaner paint, and the Directorate's notice pasted inside it" } },
    { p: framedPhoto("returns_wall_photo", -3.4, 1.85, -1.75, { face: "x", w: 0.3, h: 0.22, picture: PICTURES.people({ n: 6 }) }) },
  ],
  // the Furrowe kitchen (HX 2.9, HZ 2.3): the Gazette on the table, the sampler on the back wall by the dresser
  q_furrowe_kitchen: () => [
    { p: newspaper("gazette_e2", -0.55, 0.79, 1.2, { a: -0.25, lines: ["PLAIN RETURNS", "ABOVE PLAN"], picture: PICTURES.people({ n: 2 }) }),
      spot: { id: "gazette", verb: "read", at: [-0.5, 0, 2.0], note: "the Gazette on the table: PLAIN RETURNS ABOVE PLAN, and the back page round the dripping" } },
    { p: sheet("church_sampler", -1.55, 1.7, -2.3, { w: 0.34, h: 0.28, lines: ["THE FIELD", "IS A GIFT", "M.F. AGED 11"], ink: ["lw oxblood", 0.4], ground: ["lw canvas", 0.7], stitch: true, frame: ID.darkwood, pins: 0 }) },
    { p: palePatch("range_soot", -2.9, 2.35, -1.05, { face: "x", w: 0.9, h: 0.5, id: ID.tar, nail: false }) },
  ],
  // the Brack kitchen (HX 2.3, HZ 2.0): the wedding photograph between the window and the stairs, Will's boots on the
  // fender in front of the range, the damp low on the river walls
  q_brack_kitchen: () => [
    { p: framedPhoto("brack_wedding", 0.1, 1.68, -2.0, { w: 0.26, h: 0.34, picture: PICTURES.wedding() }),
      spot: { id: "wedding_photo", verb: "look", at: [0.1, 0, -0.9], note: "Will and Edie's wedding photograph over the table" } },
    { p: boots(-1.2, -0.95, { name: "wills_boots" }), spot: { id: "boots", verb: "look", at: [-0.9, 0, -0.2], note: "Will's boots on the fender" } },
    { p: tideLine("river_damp_back", -2.3, 0.6, -2.0, 0.32, { band: 0.06, below: null, bandId: ID.mud }) },
    { p: tideLine("river_damp_left", -2.0, 1.9, -2.3, 0.3, { face: "x", band: 0.06, below: null, bandId: ID.mud }) },
  ],
  // Anni's kitchen at year 38 (HX 2.6, HZ 2.2): the spoon jar and the rent book on the table
  q_anni_room: () => [
    { p: spoonJar(1.55, 0.78, 0.3, { n: 5, name: "spoon_jar" }), spot: { id: "spoons", verb: "look", at: [1.6, 0, 1.2], note: "a jar of Ilo's spoons on the table" } },
    { p: openBook("rent_book", 0.55, 0.78, 0.3, { a: -0.2, w: 0.2, h: 0.14, text: ["ORME ESTATES", "HALDENE YD", "PAID", "PAID", "PAID"], cover: ID.mustard }),
      spot: { id: "rent_book", verb: "read", at: [0.4, 0, 1.25], note: "the rent book, open on the table" } },
  ],
};

// Static dressing (2026-10-23): what the people in each room carry, wear, use and leave.
import { sack, blanket, winnowBasket } from "../../props/gear.mjs";
import { bucket } from "../../props/wood.mjs";
import { roundHat, ring } from "../../props/layers_things.mjs";
import { paperStack } from "../../props/civic.mjs";
import { bottle } from "../../props/e4_kit.mjs";
const EXTRA = {
  q_cells: () => [
    { p: bucket(-1.55, 0, -0.75, { name: "slop_bucket" }) },
    { p: blanket(-3.0, 0.2, -1.0, { name: "cell_blanket" }) },
    { p: newspaper("guard_paper", 1.3, 0.76, 0.78, { a: 0.2, w: 0.3, h: 0.22, lines: ["PLAIN RETURNS", "ABOVE PLAN"] }) },
    { p: tinCup(2.05, 0.76, 0.78, { name: "guard_cup" }) },
  ],
  q_returns: () => [
    { p: sheet("noon_notice", -3.4, 1.6, -1.8, { face: "x", w: 0.3, h: 0.36, lines: ["RETURNS IN", "BY NOON", "", "NO ADMITTANCE", "PAST THE", "COUNTER"], ink: ["lw tar", 0.2] }) },
    { p: sack(1.0, 0, 0.75, { s: 0.22, seed: 5, name: "sample_sack" }) },
    { p: paperStack(0.3, 0.5, 2.4, { n: 4, name: "village_papers" }) },
    { p: roundHat(-0.6, 0.5, 2.4, { id: ID.canvas, band: ID.canvas, name: "cloth_cap" }) },
  ],
  q_furrowe_kitchen: () => [
    { p: sheet("pells_slate", 2.21, 0.495, 0.26, { face: "y", a: 0.3, w: 0.2, h: 0.14, lines: ["9 X 7 63", "8 X 7 56"], ink: ["lw bone", 0.7], ground: ["lw tar", 0.3], pins: 0 }) },
    { p: bucket(-1.8, 0, -0.05, { name: "coal_bucket" }) },
    { p: sheet("church_calendar", 2.3, 1.75, -2.3, { w: 0.28, h: 0.38, lines: ["FURROW", "CHURCH", "", "HARVEST", "TO FROST"], ink: ["lw tar", 0.2] }) },
  ],
  q_brack_kitchen: () => [
    { p: winnowBasket(1.8, 0, 0.8, { r: 0.16, name: "sewing_basket" }) },
    { p: bottle(0.9, 0.78, 0.6, { name: "brack_bottle" }) },
    { p: sheet("bless_this_house", -1.9, 1.7, -2.0, { w: 0.3, h: 0.22, lines: ["BLESS", "THIS HOUSE"], ink: ["lw navy", 0.35], ground: ["lw canvas", 0.7], stitch: true, frame: ID.darkwood, pins: 0 }) },
  ],
  q_anni_room: () => [
    { p: ring(-2.4, 1.4, -2.18, { flat: false, r: 0.03, name: "thread_on_nail" }) },
    { p: framedPhoto("ilo_and_bet", -1.0, 2.15, -2.2, { w: 0.22, h: 0.16, picture: PICTURES.wedding() }) },
    { p: sheet("orme_calendar", -2.6, 1.85, -0.1, { face: "x", w: 0.2, h: 0.26, lines: ["ORME", "ESTATES", "RENT DUE", "MONDAYS"], ink: ["lw tar", 0.2] }) },
    { p: [tinCup(1.2, 0.78, 0.3, { name: "tin_cup" }), tinCup(1.35, 0.78, 0.12, { name: "tin_cup" })] },
  ],
};
for (const k of Object.keys(EXTRA)) { const f = DRESS[k]; DRESS[k] = () => [...f(), ...EXTRA[k]()]; }
