// Body moves: footwork, catching, shoving, grappling and the pocket thing (SYSTEMS-FULL 18.3).
// The roll takes one of three forms by load (cleanroom/spec/COMBAT-FEEL.md 1.1): a light load
// dashes, a medium load rolls and slides out of it (the slide can be hit), a heavy load hops short
// and gets up slowly. In knee-deep water or mud any roll is a lurch with a small window (18.3).
// The sidestep is a separate, cheap, short step.
// Frames re-tuned 2026-10-17 toward the reference's proportions (COMBAT-FEEL v2 1.2: the light
// dodge mostly invulnerable up front, the roll trading commitment for distance, the heavy form
// keeping its window but doubling the recovery), scaled to Low Water's smaller arenas. A strike
// may come out of a dodge once the dodge allows it (cancel windows); TUNING.md has the sources.
export const BODY = {
  step: { kind: "dodge", recovery: 26, stamina: 1, iframes: [2, 10], root: [[0, 10, 7.0]], dir: "input", cancel: { light: [14, 25], heavy: [14, 25], step: [18, 25], roll: [18, 25], catch: [16, 25] } },
  roll_dash: { kind: "dodge", recovery: 36, stamina: 2, iframes: [3, 17], root: [[0, 12, 8.0]], dir: "input", cancel: { light: [15, 35], heavy: [15, 35], step: [28, 35], roll: [28, 35], catch: [30, 35] } },
  roll: { kind: "dodge", recovery: 60, stamina: 2, iframes: [6, 26], root: [[0, 26, 7.4], [27, 40, 2.4]], dir: "input", cancel: { light: [38, 59], heavy: [38, 59], step: [38, 59], roll: [38, 59], catch: [40, 59] } },
  roll_hop: { kind: "dodge", recovery: 110, stamina: 2, iframes: [9, 25], root: [[4, 28, 6.0]], dir: "input", cancel: { light: [60, 109], roll: [60, 109], catch: [64, 109] } },
  lurch: { kind: "dodge", recovery: 56, stamina: 2, iframes: [6, 12], root: [[0, 30, 2.4]], dir: "input", cancel: { light: [44, 55], roll: [46, 55] } },
  riposte: { kind: "riposte", startup: 10, active: 3, recovery: 26, dmg: 3, poise: 0, hits: [{ arc: [-40, 40], r: [0.2, 2.4] }],
    iframes: [0, 30], root: [[0, 8, 1.6]], knockdown: true, track: 12, hitstop: 8, knock: 2.0, shake: 0.6 },
  // from behind on an unaware opponent (sim/stealth.mjs): the small go down, the big are struck
  takedown: { kind: "attack", startup: 8, active: 3, recovery: 34, stamina: 1, dmg: 4, poise: 4, hits: [{ arc: [-45, 45], r: [0.2, 1.7] }], takedown: true,
    parryable: false, blockable: false, knockdown: true, root: [[0, 8, 1.5]], track: 20, hitstop: 8, knock: 0.5, shake: 0.4 },
  shove: { startup: 8, active: 3, recovery: 16, stamina: 1, dmg: 0, poise: 1, hits: [{ arc: [-40, 40], r: [0.2, 1.3] }], shove: true,
    root: [[2, 10, 2.5]], track: 8, hitstop: 3, knock: 5.0, shake: 0.15 },
  grapple: { startup: 10, active: 3, recovery: 28, stamina: 2, dmg: 0, poise: 0, hits: [{ arc: [-30, 30], r: [0.2, 1.2] }], grapple: true,
    parryable: false, blockable: false, root: [[0, 12, 2.5]], track: 8, hitstop: 8, knock: 0, shake: 0.2 },
  use_lantern: { kind: "item", startup: 14, active: 1, recovery: 18, stamina: 0, track: 10, cancel: { step: [22, 32], roll: [22, 32] },
    item: { use: "lantern", proj: { speed: 9, mass: 1.2, dmg: 0.5, poise: 1, r: 0.25, light: { r: 4.5, k: 0.55, frames: 2400 } } } },
  use_rope: { kind: "item", startup: 16, active: 1, recovery: 20, stamina: 0, track: 10, cancel: { step: [26, 36], roll: [26, 36] },
    item: { use: "rope", proj: { speed: 10, mass: 1.5, dmg: 0.3, poise: 2, r: 0.45, knockdown: true, parryable: false, blockable: false } } },
  use_salt: { kind: "item", startup: 12, active: 1, recovery: 18, stamina: 0, track: 10, cancel: { step: [22, 32], roll: [22, 32] },
    item: { use: "salt", proj: { speed: 9, mass: 0.8, dmg: 0, poise: 0.5, r: 0.5, blind: 120 } } },
  use_bottle: { kind: "item", startup: 14, active: 1, recovery: 18, stamina: 0, track: 10, cancel: { step: [22, 32], roll: [22, 32] },
    item: { use: "bottle", proj: { speed: 11, mass: 0.6, dmg: 1, poise: 1.5, r: 0.25 } } },
};

export const BODY_MOVESET = {
  step: "step", riposte: "riposte", shove: "shove", grapple: "grapple", takedown: "takedown",
  roll: { light: "roll_dash", medium: "roll", heavy: "roll_hop", lurch: "lurch" },
  use: ["use_lantern", "use_bottle"],
};
