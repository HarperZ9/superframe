// Era 4 (The Closure, year 70; Mira's flat at year 103): the Saro flat, Joss's flat, Pell's kitchen, Davey's flat and the
// police desk (design/WORLD-LAYERS.md section 3). Game content for render/props/layers_*.mjs, laid over each built world by
// render/props/dress.mjs. World-layers pass, 2026-10-23. Marks named here are the @prop marks in content/quota/e4_layers.lwd.
import { sheet, framedPhoto, palePatch, PICTURES } from "../../props/layers_wall.mjs";
import { ring, spoonRack, biscuitTin, roundHat, openBook, shelfBoard, evidenceBag } from "../../props/layers_things.mjs";
import { teaGlass } from "../../props/e4_kit.mjs";
import { ID } from "../../props/prim.mjs";

const HAND = { ink: ["lw tar", 0.22], hand: 0.35 };
export const DRESS = {
  // Mira's flat at year 103 (HX 2.3, HZ 1.9): the biscuit tin on the sideboard, a shelf of six tea glasses and a saucer
  q4w_saro_flat: () => [
    { p: biscuitTin("papers_tin", -1.9, 0.9, 1.35, { a: 0.3, card: ["ELECTRICITY BOARD", "14 THE ROW", "SUPPLY DISCONNECTED", "ARREARS"] }),
      spot: { id: "tin", verb: "look", at: [-1.0, 0, 1.25], note: "a biscuit tin of papers on the sideboard" } },
    { p: [shelfBoard("glass_shelf", -1.2, 1.55, -1.9, { w: 0.8, d: 0.14 }), ...[0, 1, 2, 3, 4, 5].map((k) => teaGlass(-1.52 + k * 0.1, 1.562, -1.82, { name: "shelf_tea_glass" }))] },
    { p: ring(-0.9, 1.562, -1.82, { r: 0.035, th: 0.005, id: ID.bone, name: "empty_saucer" }) },
  ],
  // Joss's flat in Haldane Yard (HX 2.4, HZ 2.0): the spoon rack between the window and the mill photograph, empty, with
  // its ghosts; Joss's clocking card tucked in the photograph's frame
  q4_joss_flat: () => [
    { p: spoonRack("spoon_rack", 0.5, 1.62, -2.0, { n: 6, hung: [], ghost: true }),
      spot: { id: "spoon_rack", verb: "look", at: [0.5, 0, -0.9], note: "a spoon rack with six notches and nothing in them" } },
    { p: sheet("clocking_card", 1.66, 1.78, -1.93, { w: 0.08, h: 0.12, lines: ["HALDANE J", "FOREMAN", "WK 44"], ink: ["red paint", 0.4], pins: 0 }) },
  ],
  // Pell's kitchen (HX 2.4, HZ 2.0): a wall shelf with the hat in its bag, the surveyor's book open on the table
  q4_furrowe_house: () => [
    { p: [shelfBoard("hat_shelf", -1.6, 1.85, -2.0, { w: 0.6, d: 0.26 }), roundHat(-1.6, 1.862, -1.86, { bag: true, name: "hat_in_bag" })],
      spot: { id: "hat", verb: "look", at: [-1.4, 0, -0.9], note: "a paper bag on the high shelf with a hat's brim pushing it out" } },
    { p: openBook("survey_book", -0.25, 0.765, 0.62, { a: 0.2, w: 0.26, h: 0.18, text: ["MOTT HO.", "FRONT RM", "BACK RM", "UNDER ST 2 1"], cover: ID.navy }),
      spot: { id: "survey_book", verb: "read", at: [0.2, 0, 1.4], note: "Pell's old surveyor's book, open on the table" } },
  ],
  // Davey's flat over the Crown (HX 2.4, HZ 2.0): the wedding photograph in its new frame by the sideboard, the Crown in
  // the water over the television
  q4_brack_flat: () => [
    { p: framedPhoto("wedding_reframed", 1.2, 1.55, -2.0, { w: 0.26, h: 0.34, picture: PICTURES.wedding(), glass: "kept", frame: ID.brass }),
      spot: { id: "wedding_photo", verb: "look", at: [1.2, 0, -0.9], note: "Will and Edie's wedding in a new frame" } },
    { p: framedPhoto("crown_flood", -0.9, 1.75, -2.0, { w: 0.42, h: 0.3, picture: PICTURES.flood() }),
      spot: { id: "flood_photo", verb: "look", at: [-0.9, 0, -0.8], note: "a photograph of the Crown with water to its sills" } },
  ],
  // the police desk (HX 2.8, HZ 2.2): the evidence bag on the desk, a pale oblong where a portrait hung
  q4_police: () => [
    { p: evidenceBag("goat_stencil", -0.35, 0.745, -1.82, { a: 0.1, w: 0.3, h: 0.22, label: ["FOUND", "THE ROW", "NO OWNER"] }),
      spot: { id: "stencil", verb: "look", at: [0.0, 0, -0.2], note: "a cardboard stencil in a police bag on the desk" } },
    { p: palePatch("portrait_oblong", -2.35, 1.95, -2.2, { w: 0.45, h: 0.6, id: ID.paper }) },
  ],
};

// Static dressing (2026-10-23): what the people in each room carry, wear, use and leave.
import { sack, winnowBasket } from "../../props/gear.mjs";
import { boots } from "../../props/mill.mjs";
import { newspaper } from "../../props/layers_things.mjs";
import { timber } from "../../props/wood.mjs";
import { mug, pint } from "../../props/e4_kit.mjs";
const EXTRA = {
  q4w_saro_flat: () => [
    { p: sheet("childs_drawing", 1.9, 1.7, -1.9, { w: 0.24, h: 0.18, lines: ["TEO"], ink: ["red paint", 0.5], pins: 2 }) },
    { p: boots(1.3, 1.6, { name: "shoes_by_door" }) },
    { p: sack(-1.9, 0, -1.4, { s: 0.25, name: "laundry_bag", id: ID.canvas }) },
  ],
  q4_joss_flat: () => [
    { p: winnowBasket(2.0, 0, 0.2, { r: 0.15, name: "knitting_basket" }) },
    { p: newspaper("gazette_e4", -0.35, 0.78, 0.65, { a: 0.15, w: 0.3, h: 0.22, lines: ["MILL", "TO CLOSE"] }) },
  ],
  q4_furrowe_house: () => [
    { p: sack(-1.9, 0, 1.2, { s: 0.15, name: "school_bag", id: ID.navy }) },
    { p: sheet("halvard_calendar", -2.4, 1.6, 1.2, { face: "x", w: 0.26, h: 0.36, lines: ["HALVARD", "GRAIN CO.", "", "NOVEMBER"], ink: ["lw navy", 0.3] }) },
  ],
  q4_brack_flat: () => [
    { p: roundHat(1.6, 0.9, -1.7, { id: ID.navy, band: ID.tar, name: "police_cap" }) },
    { p: pint(0.7, 0.9, -1.7) },
  ],
  q4_police: () => [
    { p: mug(2.0, 1.14, 0.2, { name: "counter_mug" }) },
    { p: timber("lost_property_box", [1.5, 0.2, -1.5], [0.25, 0.2, 0.18], ID.mustard) },
    { p: sheet("damage_notice", -2.8, 1.7, 0.8, { face: "x", w: 0.3, h: 0.36, lines: ["REPORT ALL", "DAMAGE TO", "PROPERTY", "", "IN CONFIDENCE"], ink: ["lw tar", 0.2] }) },
  ],
};
for (const k of Object.keys(EXTRA)) { const f = DRESS[k]; DRESS[k] = () => [...f(), ...EXTRA[k]()]; }
