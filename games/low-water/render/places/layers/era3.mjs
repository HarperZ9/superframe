// Era 3 (Allocation, year 20; Aaron's kitchen at year 46): the Mott house, the counter, the squad room, the Furrowe hall,
// the Brack kitchen, the school and the far bank (design/WORLD-LAYERS.md section 3). Game content for
// render/props/layers_*.mjs, laid over each built world by render/props/dress.mjs. World-layers pass, 2026-10-23. Marks
// named here are the @prop marks in content/quota/e3_layers.lwd.
import { sheet, framedPhoto, palePatch, tideLine, heightMarks, strokeMark, PICTURES } from "../../props/layers_wall.mjs";
import { spoonJar, slipSpike, blotter, spade, locker, mugOnHook, roundHat, ring } from "../../props/layers_things.mjs";
import { ID } from "../../props/prim.mjs";

const HAND = { ink: ["lw tar", 0.22], hand: 0.35 };
export const DRESS = {
  // the old Mott house (HX 3.4, HZ 2.6; the door table at (-0.3, -0.3), the stairs at the right): the door frame of the back
  // room with its heights, the chalk goat low by it, the handbill nailed beside it, Ilo's spoons, Anni's wedding
  q3_mott_house: () => [
    { p: heightMarks("back_room_frame", 1.55, -2.6, { ticks: [0.82, 0.95], old: [1.18, 1.24, 1.31] }),
      spot: { id: "heights", verb: "look", at: [1.4, 0, -1.2], note: "pencil heights up the back room's door frame, new ones under old painted ones" } },
    { p: strokeMark("stair_goat", 1.2, 0.26, -2.6, { s: 0.1, look: "scrubbed" }),
      spot: { id: "chalk_goat", verb: "look", at: [1.0, 0, -1.3], note: "a goat in chalk low on the wall, scrubbed to its legs" } },
    { p: sheet("well_handbill", 0.75, 1.5, -2.6, { w: 0.2, h: 0.28, lines: ["WHO DRINKS", "FROM THE", "HILL?", "", "17 ILL ON", "EXCHANGE ST", "SINCE MONDAY"], ...HAND, pins: 1, peel: 0.03 }),
      spot: { id: "handbill", verb: "read", at: [0.7, 0, -1.4], note: "a handbill nailed up by the back room door, no name on it" } },
    { p: spoonJar(0.62, 0.776, 0.12, { n: 5, name: "spoon_jar" }), spot: { id: "spoons", verb: "look", at: [0.9, 0, 1.0], note: "Ilo's spoons in a jar on the door table" } },
    { p: framedPhoto("anni_wedding", -1.0, 1.66, -2.6, { w: 0.2, h: 0.26, picture: PICTURES.wedding() }),
      spot: { id: "wedding_photo", verb: "look", at: [-1.0, 0, -1.5], note: "Anni and Oren's wedding photograph, at the allocation counter" } },
  ],
  // the allocation counter (HX 3.0, HZ 2.3; the counter along x at z -0.6, top 1.045): the nested pale squares on the left
  // wall, the spike of slips at the right end of the counter, Walter's blotter at the left end
  q3_office: () => [
    { p: palePatch("nested_patch", -3.0, 2.3, 1.3, { face: "x", w: 0.72, h: 0.56, id: ID.bone, nest: { w: 0.46, h: 0.34, dv: 0.01, id: ID.paper } }),
      spot: { id: "patch", verb: "look", at: [-2.2, 0, 1.2], note: "two clean squares on the wall, one inside the other" } },
    { p: slipSpike("unfit_spike", 1.7, 1.045, -0.72, { n: 16, text: ["MILL ST 7", "UNFIT WATER", "VARN, L."] }),
      spot: { id: "unfit_slips", verb: "read", at: [1.7, 0, 0.2], note: "a spike of slips at the end of the counter" } },
    { p: sheet("pulled_slip", 2.3, 2.205, -2.1, { face: "y", w: 0.1, h: 0.07, lines: ["MILL ST 16", "BRACK, W."], ...HAND, pins: 0 }) },
    { p: blotter("walters_blotter", -1.65, 1.045, -0.7, { a: 0.05, lines: ["WHO DRINKS FR", "M THE HILL", "17 ILL ON EX"], w: 0.4, h: 0.28 }),
      spot: { id: "blotter", verb: "look", at: [-1.6, 0, 0.2], note: "the blotter on the counter, written backwards all over" } },
  ],
  // the squad room (HX 2.9, HZ 2.3): Will's locker in the back-left corner, mugs on hooks on the left wall (one turned), the
  // spade by the bench
  q3_squad: () => [
    { p: locker("wills_locker", -2.35, -1.92, { open: 0.45, ring: false }),
      spot: { id: "locker", verb: "look", at: [-1.9, 0, -0.9], note: "Will's locker, the door an inch open" } },
    { p: [mugOnHook("mug_hook_a", -2.9, 1.55, 1.55, { face: "x" }), mugOnHook("mug_hook_b", -2.9, 1.55, 1.75, { face: "x", band: ID.oxblood }), mugOnHook("turned_mug", -2.9, 1.55, 1.95, { face: "x", turned: true })] },
    { p: spade(-2.55, 2.05, [-2.84, 1.2, 2.1], { name: "clay_spade", clay: ID.mustard }) },
    { p: sheet("lost_property_card", -2.9, 2.05, 1.75, { face: "x", w: 0.3, h: 0.16, lines: ["MUGS WASHED", "BY THE MAN", "WHO USED IT"], ink: ["lw tar", 0.2], pins: 1 }) },
  ],
  // the Furrowe hall (HX 1.9, HZ 2.2): Ned at twenty-seven over the hall stand, the hat on the stand, a pale oblong where a
  // bigger picture hung, between the mirror and the stand
  q3_furrowe_hall: () => [
    { p: framedPhoto("ned_at_27", -1.9, 1.62, 1.15, { face: "x", w: 0.2, h: 0.28, picture: PICTURES.portrait({ long: true }) }),
      spot: { id: "ned_photo", verb: "look", at: [-1.0, 0, 1.25], note: "a photograph over the hall stand: a young man in a borrowed collar" } },
    { p: palePatch("hall_oblong", -1.9, 1.7, 0.27, { face: "x", w: 0.46, h: 0.6, id: ID.paper }),
      spot: { id: "pale_oblong", verb: "look", at: [-1.1, 0, 0.3], note: "a paler oblong on the wall by the mirror, a nail at the top" } },
    { p: roundHat(-1.65, 1.0, 1.35, { name: "abels_hat", band: ID.brass }), spot: { id: "hat", verb: "look", at: [-1.0, 0, 1.7], note: "a round hat on the hall stand, its brass band gone dull" } },
  ],
  // the Brack kitchen (HX 2.5, HZ 2.1): the tide line at table height round the back and left walls, newer plaster under it
  q3_brack_kitchen: () => [
    { p: tideLine("tide_back", -2.5, 2.5, -2.1, 0.78, { band: 0.025 }), spot: { id: "tide_line", verb: "look", at: [-0.9, 0, -1.2], note: "a brown line round the kitchen at the height of the table" } },
    { p: tideLine("tide_left", -2.1, 2.1, -2.5, 0.8, { face: "x", band: 0.025 }) },
    { p: sheet("rent_card_e3", -2.5, 1.55, 0.6, { face: "x", w: 0.16, h: 0.22, lines: ["MILL ST 16", "BRACK W.", "RENT PAID"], ...HAND, pins: 1 }) },
  ],
  // the school (HX 3.2, HZ 2.4): the word cut in Mim's desk lid, the Tarnish alphabet over the blackboard
  q3_school: () => [
    { p: sheet("kesh_lid", -1.38, 0.735, 0.4, { face: "y", w: 0.18, h: 0.05, lines: ["KESH"], ink: ["lw navy", 0.15], ground: null, id: ID.darkwood, rough: 0.6, pins: 0, margin: 0.004 }),
      spot: { id: "mims_desk", verb: "look", at: [-2.3, 0, 0.45], note: "a word cut small into a desk lid and inked over" } },
    { p: sheet("alphabet_frieze", -0.2, 2.62, -2.4, { w: 3.6, h: 0.16, lines: ["A B C D E F G H I K L M N O P R S T U W"], ink: ["lw bone", 0.75], ground: ["lw tar", 0.3], pins: 0, margin: 0.01 }) },
  ],
  // Aaron's kitchen on the far bank at year 46 (HX 2.4, HZ 2.0): the long-service paper on the left wall
  q3w_far_bank: () => [
    { p: sheet("long_service", -2.4, 1.6, 0.6, { face: "x", w: 0.36, h: 0.27, lines: ["COMMONWEALTH POLICE", "", "HALDEN, A.", "CONSTABLE", "TWENTY-FIVE YEARS"], ink: ["lw tar", 0.2], ground: ["lw paper", 0.72], frame: ID.darkwood, pins: 0 }),
      spot: { id: "service_paper", verb: "read", at: [-1.5, 0, 0.8], note: "Aaron's long-service paper, framed" } },
    { p: ring(1.1, 0.752, 0.35, { r: 0.02, name: "drawer_thread" }) },
  ],
};

// Static dressing (2026-10-23): what the people in each room carry, wear, use and leave.
import { sack, blanket } from "../../props/gear.mjs";
import { bucket } from "../../props/wood.mjs";
import { cup, cloth } from "../../props/food.mjs";
import { boots } from "../../props/mill.mjs";
import { tinCup, newspaper } from "../../props/layers_things.mjs";
import { paperStack } from "../../props/civic.mjs";
import { bottle } from "../../props/e4_kit.mjs";
const EXTRA = {
  q3_mott_house: () => [
    { p: [boots(-0.1, -2.35, { name: "childrens_boots" }), boots(0.35, -2.4, { name: "childrens_boots" })] },
    { p: [tinCup(-0.95, 0.776, 0.15, { name: "tin_cup" }), tinCup(0.22, 0.776, 0.12, { name: "tin_cup" })] },
    { p: sheet("house_rules", -3.4, 1.9, 0.3, { face: "x", w: 0.28, h: 0.36, lines: ["NO. 4", "EXCHANGE ST", "", "TEN FAMILIES", "WATER BY", "THE TURN"], ink: ["lw tar", 0.2] }) },
  ],
  q3_office: () => [
    { p: sheet("wait_here", -1.0, 0.95, 0.66, { w: 0.14, h: 0.1, lines: ["WAIT", "HERE"], ink: ["lw tar", 0.2], pins: 0 }) },
    { p: cup(1.2, 1.045, -0.82, { id: ID.slate, s: 0.5, name: "stamp_pad" }) },
    { p: blanket(-1.6, 0.47, 2.0, { name: "waiting_coat" }) },
    { p: sheet("allocation_calendar", 1.25, 2.0, -2.3, { w: 0.28, h: 0.36, lines: ["SEPTEMBER", "", "ALLOCATION", "WEEK"], ink: ["red paint", 0.4] }) },
  ],
  q3_squad: () => [
    { p: bucket(2.3, 0, 1.9, { name: "baton_bucket" }) },
    { p: newspaper("squad_paper", -0.6, 0.77, 0.75, { a: 0.2, w: 0.3, h: 0.22, lines: ["ALLOCATION", "A SUCCESS"] }) },
    { p: boots(-1.2, 2.0, { name: "spare_boots" }) },
  ],
  q3_furrowe_hall: () => [
    { p: paperStack(0.6, 0.0, -1.45, { n: 3, a: 0.4, name: "post_on_mat" }) },
    { p: bucket(-1.6, 0, -1.6, { name: "umbrella_stand" }) },
  ],
  q3_brack_kitchen: () => [
    { p: bucket(1.9, 0, 0.9, { name: "mop_bucket" }) },
    { p: cloth(0.5, 0.47, 0.5, 0.18, 0.15, { drop: 0.1, name: "mending" }) },
    { p: bottle(0.9, 0.78, 0.3, { name: "brack_bottle" }) },
  ],
  q3_school: () => [
    { p: [[0.4, -0.55], [-1.2, 0.4], [0.4, 1.35], [-1.2, 1.35]].map(([x, z]) => sheet("slate", x, 0.79, z, { face: "y", w: 0.2, h: 0.14, lines: ["CAT", "MAT"], ink: ["lw bone", 0.7], ground: ["lw tar", 0.3], pins: 0 })) },
    { p: cup(1.6, 0.79, -1.9, { id: ID.brass, s: 0.6, name: "hand_bell" }) },
  ],
  q3w_far_bank: () => [
    { p: roundHat(-0.35, 0.47, 0, { id: ID.navy, band: ID.navy, name: "police_cap" }) },
    { p: sack(1.6, 0, 0.9, { s: 0.16, name: "school_bag", id: ID.canvas }) },
    { p: newspaper("far_bank_paper", 0.9, 0.76, -0.3, { a: 0.4, w: 0.3, h: 0.22, lines: ["ESTATE", "OPENS"] }) },
  ],
};
for (const k of Object.keys(EXTRA)) { const f = DRESS[k]; DRESS[k] = () => [...f(), ...EXTRA[k]()]; }
