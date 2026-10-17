// Tool specials (paid in Composure, data/build.mjs COMPOSURE) and running strikes, per tool. PROVISIONAL
// names and numbers (see data/build.mjs). Frames at 60 a second; fields as in sim/moves.mjs, plus
// grit (what the move spends) and pierce (armour does not soften it).
const F = (n, s) => Math.max(1, Math.round(n * s));

export function artMoves(P, art, prefix) {
  const s = P.speed, r = P.reach, id = `${prefix}art`, base = { composure: 3, stamina: 0, anim: `${P.cls}.art_${art}` };
  const A = {
    // the case held up for half a second: anything from the front is caught
    brace: { kind: "parry", startup: 4, active: 30, recovery: 16, parry: [4, 33] },
    // the stick, three times, too fast to answer
    lash: { startup: F(8, s), active: 14, recovery: 20, dmg: 2.2, poise: 2, hits: [{ arc: [-80, 80], r: [0.2, r + 0.5] }], root: [[0, 20, 1.6]], track: 10, hitstop: 3, knock: 1.6, shake: 0.2 },
    // the boathook's reach and the pull: a person off their feet and at Lamb's boots
    haul: { startup: F(20, s), active: 6, recovery: 30, dmg: 1.5, poise: 3, hits: [{ arc: [-15, 15], r: [0.5, r + 1] }], parryable: false, blockable: false, knockdown: true, track: 6, hitstop: 6, knock: -4.5, shake: 0.4 },
    // the pole round in a circle at knee height
    ring: { startup: F(16, s), active: 8, recovery: 30, dmg: 1.6, poise: 3, hits: [{ arc: [-180, 180], r: [0.2, r + 0.3] }], knockdown: true, hitstop: 5, knock: 2.8, shake: 0.45 },
    // the knife in and out, past a guard and through armour
    open: { startup: F(10, s), active: 4, recovery: 26, dmg: 3, poise: 1, hits: [{ arc: [-25, 25], r: [0.2, r + 0.5] }], root: [[2, 12, 8]], blockable: false, pierce: true, track: 8, hitstop: 4, knock: 1, shake: 0.2 },
    // the hammer from overhead: no guard holds it and no one keeps their feet
    break: { startup: F(24, s), active: 6, recovery: 34, dmg: 4, poise: 6, hits: [{ arc: [-30, 30], r: [0.3, r + 0.4] }], guardBreak: true, knockdown: true, armor: [4, 28, 3], track: 3, hitstop: 7, knock: 3.5, shake: 0.8 },
    // the crowbar under a tool or an arm: the tool comes away
    pry: { startup: F(12, s), active: 4, recovery: 26, dmg: 0, poise: 0, hits: [{ arc: [-30, 30], r: [0.2, r + 0.2] }], grapple: true, parryable: false, blockable: false, track: 8, hitstop: 6 },
    // the shoulder, at a run
    shoulder: { startup: 10, active: 6, recovery: 22, dmg: 0.5, poise: 2, hits: [{ arc: [-40, 40], r: [0.2, 1.3] }], shove: true, root: [[0, 16, 7]], track: 8, hitstop: 4, knock: 6, shake: 0.3 },
  }[art];
  return A ? { [id]: { ...A, ...base } } : {};
}

// The running strike: a light press while running, carried by the run into a lunge.
export function runMove(P, prefix) {
  return {
    [`${prefix}run`]: { startup: 12, active: 5, recovery: 24, stamina: 1, dmg: P.light[0] * 1.2, poise: P.light[1] * 1.3, hits: [{ arc: [-P.arc, P.arc], r: [0.25, P.reach + 0.5] }],
      root: [[0, 14, 5]], cancel: { step: [24, 40], roll: [24, 40] }, track: 4, hitstop: 3, knock: 2.4, shake: 0.2, anim: `${P.cls}.run` },
  };
}
