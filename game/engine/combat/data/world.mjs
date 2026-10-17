// How the world shapes a fight (design/COMBAT-WORLD.md gives each rule, its test and its source).
// Reference values come from cleanroom/spec/WORLD-COMBAT-CONSTRAINTS.md (marked spec) scaled to our
// quays and plates; the rest are chosen and measured with tools/kite.mjs.
// Rules can be switched off for a measurement (an ablation, never in play): COMBAT_WORLD_OFF=
// "ledges,paths,pursuit,leash,run,breakoff,beam" in the environment (tools/kite.mjs --ablate).
const offList = (typeof process !== "undefined" && process.env && process.env.COMBAT_WORLD_OFF) || "";
export const OFF = new Set(offList.split(",").map((s) => s.trim()).filter(Boolean));

export const WORLD = {
  // ground (sim/terrain.mjs). A height step this large between neighbouring cells is a ledge:
  // walking will not cross it, a knockback or a roll will, and the body falls.
  ledge: 1.0,                 // metres; stairs on the plates step 0.2 to 0.3 per half-metre cell
  fall: { knockdown: 1.0, hurtFrom: 1.6, perMetre: 0.7, foeScale: 1.5, waterBreath: 2 },
  slope: { from: 0.2, k: 0.9, noRun: 0.45 },  // speed / (1 + k * (grade - from)); no run above noRun
  hazards: { net: { speed: 0.7, trip: true }, rope: { speed: 0.75, trip: true }, slick: { grip: 0.6 }, loose: { root: 0.8 } },
  trip: { guard: 120, speed: 2.0, blind: 110 }, // frames before the same body trips again; fast and blind (sim/ground.mjs)
  // breath: running costs it only while engaged (spec 6: free out of combat, about 5 s of running)
  run: { engaged: 1.6, free: 0, engageRange: 10 },
  // the kiting clock (spec 4): out of a foe's reach and moving away, or out of reach and far
  kite: { away: 0.8, margin: 0.6, far: 2.5, decay: 2, punishAt: 210, unreachableAt: 60 },
  // a foe's answers to a kiter: a slow, readable throw (spec 4: 6 to 10 s cooldown) and a lunge that
  // only fires from range (spec 5: 5 m and more, scaled to our plates: 4 m and more)
  punish: { throwCool: [360, 600], lungeCool: [300, 420], lungeMin: 4.0, lungeMax: 8.5, throwMin: 3.0, throwMax: 14 },
  // pursuit (spec 3: bursts of about 5 s, cooldown about 5 s): a foe runs while the clock runs
  chase: { from: 60, frames: 240, cool: 300, reserve: 2 },
  // sight leash (spec 2): no home leash; after this long without sight a foe calls the others and
  // holds the way out nearest Lamb's last seen spot
  leash: { lost: 420 },
  // Mother's beam (sim/field.mjs beamAt): a body in an arm is seen within this many metres, fog or not
  // (tools/beam.mjs: without it the beam changed no outcome; design/COMBAT-WORLD.md)
  beam: { reveal: 12 },
  // the time cap's break-off only counts as their yield when Lamb stood in the fight: Lamb spent less than
  // this share of it opening the gap on the nearest opponent while in nobody's reach
  // measured (tools/kiteshare.mjs, 57 fights each): fair play opens the gap 0 to 0.10 of a fight and stands
  // out of reach 0 to 0.53; the kiter 0 to 0.49 (median 0.12) and 0.06 to 1 (median 0.43)
  breakOff: { kitedShare: 0.15, apartShare: 0.6 },
};

// Tuning runs only (never in play): COMBAT_WORLD_SET='{"kite":{"punishAt":150}}' merges into WORLD.
const setJson = (typeof process !== "undefined" && process.env && process.env.COMBAT_WORLD_SET) || "";
if (setJson) for (const [k, v] of Object.entries(JSON.parse(setJson))) Object.assign(WORLD[k], v);
