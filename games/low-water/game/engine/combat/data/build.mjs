// Character building on one sheet (design/SYSTEMS-FULL.md section 19, approved 2026-10-17). The
// four compartments are the four attributes and each owns a combat pillar; voices scale tools.
// Names and structure are the director's; constants are the combat engineer's (TUNING.md), to be
// re-set against cleanroom/spec/CHARACTER-BUILDING.md when it lands. Content can override any
// tool, piece or move with @weapon, @item and @move records (encounter.mjs reads them).
//
//   COAT  endure   Standing, poise from clothing, the load limit, heavy tools' requirements
//   NOSE  evade    dodge windows lengthen with THE DARK and SALT; footing; sneak openings
//   PEN   read     telegraphs shown earlier (UNDERTOW, CARBON); a blow in the read window finds a
//                  weak point (CARBON, PRECEDENT); swings cost less Breath with SUM
//   HAT   end      opponents yield sooner (CONDOLENCE, FORM LETTER, HEARSAY); Composure 4 + 2 x HAT
//                  pays for learned moves and talk exits; PRIDE scales the case's catch
// Soft cap: above 6, a compartment or voice counts half (19.2).
export const soft = (v) => (v <= 6 ? v : 6 + (v - 6) / 2);

export const DERIVED = {
  standing: { base: 4, perCoat: 2 },          // section 19 says 10 + 2 x COAT; 4 + protection keeps a middling Lamb at 10 and fights short (TUNING.md)
  breath: { base: 4, nose: 0.5 },             // + KNEES + NOSE / 2 (19.2 says 6 +; tuned to 4 for the same reason)
  sumOff: { per: 0.06, max: 0.4 },            // Breath per swing falls 6% a SUM point above 3, at most 40%
  composure: { base: 4, perHat: 2 },
  read: { per: 1.5, max: 14 },                // frames earlier a telegraph shows, per UNDERTOW + CARBON point above 6
  weak: { per: 0.05, max: 0.5 },              // weak point: +5% a CARBON + PRECEDENT point above 6, at most +50%
  evade: { per: 1 / 3, max: 6, heavy: -2 },   // dodge window frames per THE DARK + SALT point above 6; heavy load -2
  end: { per: 0.15, max: 3 },                 // yield line raised per HAT-voice point above 9 (three voices), at most +3 Standing
  pride: { perCatch: 0.5 },                   // the case's catch: +1 frame per 2 PRIDE above 3
  protectionK: 18,                            // protection p softens a blow by p / (p + 18): 10% at 2, 25% at 6 (diminishing, CHARACTER-BUILDING 5)
};

// Scaling grades (19.3): the share of a tool's base added per voice point above 3 (soft-capped).
export const GRADES = { strongly: 0.12, fairly: 0.07, slightly: 0.03 };

// The 21 tools (19.5). cls: the moveset family (data/tools.mjs class profiles); over: what makes
// this tool's moves its own; fittings: its list (19.7); art: its special, paid in Composure.
export const TOOLS21 = {
  "w.case": { cls: "shield", needs: { coat: 1 }, scale: { pride: "strongly", formletter: "slightly" }, fittings: ["copper_wrap", "tin_cap"], art: "brace" },
  "w.stick": { cls: "light", needs: {}, scale: { sum: "fairly", dark: "slightly" }, fittings: ["weighted_head", "copper_wrap"], art: "lash" },
  "w.knife": { cls: "short", needs: { nose: 3 }, scale: { dark: "strongly", grip: "slightly" }, fittings: ["oiled_edge", "copper_wrap"], art: "open" },
  "w.boathook": { cls: "long", needs: { coat: 2 }, scale: { grip: "fairly", salt: "fairly" }, fittings: ["hooked_tip", "weighted_head"], art: "haul", over: { special: "pull" } },
  "w.pole": { cls: "long", needs: { coat: 3 }, scale: { ballast: "fairly", formletter: "slightly" }, fittings: ["tin_cap", "hooked_tip"], art: "ring", over: { special: "sweep", arc: 30 } },
  "w.hammer": { cls: "heavy", needs: { coat: 5 }, scale: { grip: "strongly", ballast: "fairly" }, fittings: ["weighted_head", "copper_wrap"], art: "break" },
  "w.marlinspike": { cls: "short", needs: { pen: 2 }, scale: { carbon: "fairly", grip: "slightly" }, fittings: ["oiled_edge", "copper_wrap"], art: "open", over: { reach: 0.9, arc: 20 } },
  "w.eelspear": { cls: "long", needs: { nose: 3 }, scale: { salt: "strongly", smell: "slightly" }, fittings: ["hooked_tip", "oiled_edge"], art: "haul", over: { arc: 14, reach: 2.8, speed: 1.0 } },
  "w.crowbar": { cls: "bar", needs: { coat: 4 }, scale: { grip: "fairly", undertow: "slightly" }, fittings: ["hooked_tip", "weighted_head"], art: "pry", over: { special: "pull" } },
  "w.chain": { cls: "long", needs: { coat: 4 }, scale: { ballast: "strongly" }, fittings: ["weighted_head", "hooked_tip"], art: "haul", over: { special: "pull", arc: 60, toward: "water" } },
  "w.oar": { cls: "long", needs: { coat: 3 }, scale: { knees: "fairly", salt: "fairly" }, fittings: ["copper_wrap", "tin_cap"], art: "ring", over: { special: "sweep", arc: 70, speed: 1.25 } },
  "w.belljar": { cls: "shield", needs: { coat: 2 }, scale: { pride: "slightly", condolence: "fairly" }, fittings: ["tin_cap", "copper_wrap"], art: "brace", over: { catch: [5, 14] } },
  "w.beetle": { cls: "heavy", needs: { coat: 6 }, scale: { grip: "strongly", knees: "fairly" }, fittings: ["weighted_head", "copper_wrap"], art: "break", over: { speed: 1.8, heavy: [3.6, 3.5], weight: 7 } },
  "w.fid": { cls: "short", needs: { pen: 3 }, scale: { sum: "fairly", carbon: "fairly" }, fittings: ["oiled_edge", "copper_wrap"], art: "lash" },
  "w.key": { cls: "shield", needs: { coat: 3 }, scale: { pride: "fairly", salt: "fairly" }, fittings: ["copper_wrap", "weighted_head"], art: "brace", over: { light: [1.2, 1.2] } },
  "w.spanner": { cls: "bar", needs: { coat: 5 }, scale: { grip: "fairly", sum: "fairly" }, fittings: ["weighted_head", "copper_wrap"], art: "break", over: { heavy: [2.4, 2.5] } },
  "w.tiller": { cls: "long", needs: { coat: 3 }, scale: { salt: "strongly", ballast: "slightly" }, fittings: ["copper_wrap", "hooked_tip"], art: "ring", over: { special: "sweep", arc: 50 } },
  "w.hands": { cls: "unarmed", needs: {}, scale: { grip: "fairly", knees: "fairly" }, fittings: [], art: "shoulder" },
};
// The use class (19.5): thrown or spent from the pocket, not held (body moves use_*).
export const USE_TOOLS = { "i.lantern": "lantern", "w.rope": "rope", "w.salt": "salt", "w.glass": "glass" };

// Fittings (19.7): one per tool, from its list; each changes the tool's moves.
export const FITTINGS = {
  weighted_head: { speed: 1.2, light: 1.35, heavy: 1.25, poise: 1.4 },  // a light becomes a half-heavy
  hooked_tip: { special: "pull" },                                       // any long tool pulls
  oiled_edge: { speed: 0.85 },                                           // faster (and dulls sooner)
  copper_wrap: { rainProof: true },                                      // the grip does not slip in rain
  tin_cap: { rings: true },                                              // rings like a bell: everyone near hears it
};

// Clothing as armour (19.6): protection (Standing, and blows softened), weight, and soaked weight.
export const CLOTHING = {
  "c.shelf_coat": { protection: 2, weight: 3, soaked: 6 }, "c.oilskin": { protection: 1, weight: 2, soaked: 2 },
  "c.keeper_coat": { protection: 2, weight: 3, soaked: 5 }, "c.lamplighter_coat": { protection: 3, weight: 4, soaked: 6 },
  "c.waders": { protection: 1, weight: 3, soaked: 3 }, "c.belljar": { protection: 3, weight: 2, soaked: 2 },
  "c.mittens": { protection: 0, weight: 0, soaked: 0.5 }, "c.apron": { protection: 3, weight: 3, soaked: 4 },
  "c.seaboots": { protection: 2, weight: 3, soaked: 3 }, "c.guernsey": { protection: 1, weight: 1, soaked: 1 },
  "c.shelf_hat": { protection: 0, weight: 0.5, soaked: 0.5 },
};
export const START_GEAR = ["c.shelf_coat", "c.shelf_hat"];

// The load (19.6): weight against a limit set by COAT; bands from COMBAT-FEEL v2 1.1 [D].
// Light: the quick step-dodge; medium: the roll; heavy: the lurching hop with a long recovery.
export const LOAD = { base: 6, perCoat: 2.5, bands: [0.35, 0.6, 1], regen: { light: 1.2, medium: 1, heavy: 0.8, over: 0.6 } };

// Temper (19.7): 0 to 5, each step paid in salvage at a bench; +8% damage a step.
export const TEMPER = [
  { needs: { "s.tin": 1 }, minutes: 10 }, { needs: { "s.cork": 1, "s.tin": 1 }, minutes: 15 },
  { needs: { "s.brass": 1 }, minutes: 15 }, { needs: { "s.brass": 1, "s.copper_wire": 1 }, minutes: 20 },
  { needs: { "s.old_bronze": 1 }, minutes: 30 },
];
export const TEMPER_STEP = { dmg: 0.08, poise: 0.06 };

// Composure (19.2): filled by landing blows, catching and ripostes; spent on learned moves, tool
// specials and talk exits.
// Composure (19.2): filled by blows, catches, ripostes; and (director, 2026-10-17) by held ground and
// words: each blow Lamb blocks or slips while not striking back (block, evade), each HAT-voice bark
// (words). A talk exit costs talk, or talkHat when HAT is HAT_TALK or more. Fill amounts chosen so a
// Tongue or Hands Lamb holding its ground about ten seconds can pay one exit (design/COMBAT-WORLD.md).
export const COMPOSURE = { hit: 0.5, catch: 1.5, riposte: 1, art: 3, talk: 2, talkHat: 1, block: 0.35, evade: 0.35, words: 0.5 };
export const HAT_TALK = 4;

// Running: hold run for 1.55 times the walk, 0.6 Breath a second.
export const RUN = { speed: 1.55, breath: 0.6 };
