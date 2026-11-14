// Real fights for six inner bosses (the author, 2026-10-23: "attack patterns, timing, special attacks, and arena
// mechanics are important, and the combat should be real and palpable"). Each is a duelist's moveset for
// combat/ai/duel.mjs with strings, mixups (a quick follow, a held one, a grab, or nothing), a grab, unblockable
// blows with long tells, a signature, rests after strings (the punish windows), two or three phases that escalate,
// and an arena that fights too (combat/arena/innerhaz.mjs). The theme lives in the moveset and the ground; force
// always works; the non-force endings stay as optional layers once the fight is joined (COMBAT-SPEC section 12). Each
// ground also holds a prop the boss can be baited into for a punish window (combat/arena/innerprop.mjs).
import { swing, late, lunge, heavy, sweep, grab, slam, catcher, call } from "./innermoves.mjs";

export const A = (move, min, max, w = 1, o = {}) => ({ move, min, max, w, ...o });
export const F = (move, w = 1, then = null) => ({ move, w, ...(then ? { then } : {}) });
export const END = (w = 1) => ({ move: null, w });

// Fond of Them: a host who duels with good manners. He catches a careless blow and the catch heals him; his plates
// come down the table; his bow is a grab. Bait the catch (it has a long recovery), then punish.
const fondCut = swing({ s: 24, dmg: 1.3, arc: [-60, 40], r: [0.3, 2.4] });
export const FOND_FIGHT = {
  tune: { standing: 0.9, harm: 0.75 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 46, speed: 2.7, accel: 16, turn: 6, poise: 12, breath: 14 },
  moves: {
    "fond.jab": swing({ s: 22, rec: 18, dmg: 0.9, arc: [-25, 25], r: [0.3, 2.0] }),
    "fond.cut": fondCut, "fond.cut.late": late(fondCut, 22),
    "fond.lunge": lunge({ s: 28, dmg: 1.4, reach: 8 }),
    "fond.plate": { ...swing({ s: 30, a: 2, rec: 26, dmg: 0, r: [0, 0.1], kind: "throw" }), hits: [], hazard: { kind: "spot", at: "lamb", r: 0.9, lead: 34, dmg: 1.2, knock: 1.2, id: "plate" } },
    "fond.catch": catcher({ win: [4, 16], rec: 34 }),
    "fond.riposte": swing({ s: 20, a: 6, rec: 26, dmg: 1.9, poise: 4, r: [0.3, 2.2], tell: { at: [2, 19], kind: "swing" } }),
    "fond.bow": grab({ s: 36, dmg: 2.2, toward: "head" }),
    "fond.toast": slam({ s: 46, dmg: 1.6, r: [0, 2.6], hazard: { kind: "ring", at: "boss", r: 2.8, lead: 40, dmg: 1.2, id: "toast" } }),
    "fond.sweep": sweep({ s: 40, dmg: 1.4 }),
  },
  phases: [
    { name: "the host", until: 0.6, rest: 70, space: [2.0, 3.4], counter: { move: "fond.catch", w: 0.3, reach: 2.6, before: 6, cool: 120, then: "fond.riposte" },
      attacks: [A("fond.jab", 0, 2.0, 2, { then: [F("fond.cut", 2, [F("fond.cut.late", 1), END(2)]), F("fond.cut.late", 1), END(2)] }), A("fond.cut", 0, 2.3, 2, { then: [F("fond.jab", 1), END(2)] }),
        A("fond.lunge", 3.0, 7.0, 1.5, { cool: 150 }), A("fond.plate", 3.4, 10, 1.2, { cool: 200 })] },
    { name: "the strings", until: 0.3, rest: 55, space: [1.8, 3.0], counter: { move: "fond.catch", w: 0.45, reach: 2.6, before: 6, cool: 100, then: "fond.riposte" },
      morph: { look: "strings" }, signature: { move: "fond.toast", every: 540, first: 240, min: 0, max: 3.0, rest: 110 },
      attacks: [A("fond.jab", 0, 2.0, 2, { then: [F("fond.cut", 2, [F("fond.bow", 1), F("fond.cut.late", 1), END(1)]), F("fond.cut.late", 1), END(1)] }), A("fond.cut", 0, 2.3, 1.5, { then: [F("fond.sweep", 1), END(2)] }),
        A("fond.bow", 0, 1.8, 1, { cool: 240 }), A("fond.lunge", 3.0, 7.0, 1.5, { cool: 120 }), A("fond.plate", 3.4, 10, 1.2, { cool: 160 })],
      hazards: [{ kind: "lane", axis: "x", at: "anchor:head", w: 1.6, every: 480, first: 300, lead: 40, dmg: 1.3, knock: 2.4, id: "table" }] },
    { name: "the offer", until: -1, rest: 45, space: [1.6, 2.8], counter: { move: "fond.catch", w: 0.55, reach: 2.6, before: 6, cool: 90, then: "fond.riposte" },
      morph: { look: "offer" }, signature: { move: "fond.toast", every: 420, first: 120, min: 0, max: 3.0, rest: 100 },
      attacks: [A("fond.jab", 0, 2.0, 2, { then: [F("fond.cut", 2, [F("fond.bow", 1.5), F("fond.cut.late", 1), F("fond.sweep", 1)]), F("fond.cut.late", 1.5), END(1)] }),
        A("fond.bow", 0, 1.8, 1.2, { cool: 200 }), A("fond.lunge", 3.0, 7.0, 1.5, { cool: 100 }), A("fond.sweep", 0, 2.6, 1, { cool: 200 })],
      hazards: [{ kind: "spot", at: "lamb", scatter: 2.2, n: 3, r: 0.9, every: 300, first: 120, lead: 38, dmg: 1.1, id: "plate" }] },
  ],
  strike: [{ kind: "parryheal", heal: 2.5 }],
};

// Under the Goats: a low, heavy thing in a mud fold. Its pits slow the player and its burial pins him; it dives
// into the mud and comes up under him. More of the fold turns to pit as the fight goes on.
const goatSpade = swing({ s: 26, dmg: 1.4, arc: [-55, 55], r: [0.3, 2.5] });
export const GOATS_FIGHT = {
  tune: { standing: 1, harm: 0.9 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 50, speed: 2.4, accel: 14, turn: 5, poise: 14, breath: 14, height: 1.8 },
  moves: {
    "goats.swing": goatSpade, "goats.swing.late": late(goatSpade, 20),
    "goats.heave": sweep({ s: 38, dmg: 1.4, r: [0.3, 2.6] }),
    "goats.fling": { ...swing({ s: 30, a: 2, rec: 28, dmg: 0, r: [0, 0.1], kind: "throw" }), hits: [], hazard: { kind: "spot", at: "lamb", scatter: 1.6, n: 3, r: 0.8, lead: 36, dmg: 0.9, knock: 1, id: "mud" } },
    "goats.dive": { ...lunge({ s: 34, a: 10, rec: 30, dmg: 1.6, reach: 9, r: [0.2, 1.4] }), iframes: [10, 34], parryable: false, tell: { at: [4, 33], kind: "pounce" } },
    "goats.bury": grab({ s: 36, dmg: 2.6, r: [0.2, 1.8] }),
    "goats.heap": slam({ s: 46, dmg: 2.0, r: [0, 2.8], hazard: { kind: "spot", at: "lamb", n: 1, r: 1.6, lead: 40, dmg: 1.5, knockdown: true, id: "sinkhole" } }),
  },
  phases: [
    { name: "the fold", until: 0.65, rest: 70, space: [2.0, 3.6], ground: { cells: { ch: "m", at: [[6, 3, 1.2], [14, 8.5, 1.2]] } },
      attacks: [A("goats.swing", 0, 2.4, 2, { then: [F("goats.swing.late", 1), F("goats.swing", 1), END(2)] }), A("goats.heave", 0, 2.5, 1, { cool: 180 }),
        A("goats.fling", 3.2, 9, 1.4, { cool: 200 }), A("goats.dive", 3.5, 8.5, 1, { cool: 260 })] },
    { name: "the hoard", until: 0.3, rest: 55, space: [1.8, 3.2], morph: { look: "hoard" }, ground: { cells: { ch: "m", at: [[10, 9.5, 1.3], [4, 8.5, 1.3], [12, 2.2, 1.3]] } },
      signature: { move: "goats.heap", every: 540, first: 200, min: 0, max: 3.0, rest: 110 },
      attacks: [A("goats.swing", 0, 2.4, 2, { then: [F("goats.swing.late", 1, [F("goats.bury", 1), END(2)]), F("goats.bury", 1), END(1)] }), A("goats.heave", 0, 2.5, 1, { cool: 160 }),
        A("goats.bury", 0, 1.7, 1, { cool: 240 }), A("goats.fling", 3.2, 9, 1.4, { cool: 160 }), A("goats.dive", 3.5, 8.5, 1.2, { cool: 200 })],
      hazards: [{ kind: "spot", at: "anchor:dig", n: 2, r: 1.2, every: 360, first: 200, lead: 40, dmg: 1.3, knockdown: true, both: true, id: "collapse" }] },
    { name: "the dragon", until: -1, rest: 45, space: [1.6, 3.0], morph: { look: "dragon" }, ground: { cells: { ch: "m", at: [[9, 2.5, 1.5], [16, 6, 1.5], [6, 10, 1.4]] } },
      signature: { move: "goats.heap", every: 420, first: 120, min: 0, max: 3.0, rest: 100 },
      attacks: [A("goats.swing", 0, 2.4, 2, { then: [F("goats.swing.late", 1.5, [F("goats.heave", 1), END(1)]), F("goats.bury", 1.5), F("goats.heave", 1)] }),
        A("goats.bury", 0, 1.7, 1.2, { cool: 200 }), A("goats.fling", 3.2, 9, 1.4, { cool: 120 }), A("goats.dive", 3.5, 8.5, 1.4, { cool: 160 })],
      hazards: [{ kind: "spot", at: "anchor:dig", n: 3, r: 1.2, every: 300, first: 100, lead: 38, dmg: 1.3, knockdown: true, both: true, id: "collapse" }] },
  ],
};

// The Long Barn: a grappler as big as a barn, in a granary that falls in. Its drag hauls the player to the throat;
// its hug crushes; it charges and dazes itself on a wall; beams fall (they hurt it too); in its last phase the floor
// goes from the far end.
export const BARN_FIGHT = {
  tune: { standing: 1, harm: 0.8 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 60, speed: 2.0, accel: 10, turn: 4, poise: 18, breath: 16, height: 2.8, radius: 0.85 },
  moves: {
    "barn.slap": swing({ s: 24, dmg: 1.2, arc: [-60, 30], r: [0.4, 2.6] }),
    "barn.rib": heavy({ s: 36, dmg: 2.0, r: [0.4, 2.8] }), "barn.rib.late": late(heavy({ s: 36, dmg: 2.0, r: [0.4, 2.8] }), 18),
    "barn.drag": grab({ s: 38, dmg: 1.6, r: [0.6, 4.0], toward: "throat", root: [] }),
    "barn.hug": grab({ s: 36, dmg: 3.0, r: [0.2, 1.9] }),
    "barn.charge": { ...lunge({ s: 34, a: 40, rec: 34, dmg: 1.8, reach: 8.0, r: [0.2, 1.6] }), knockdown: true, parryable: false, armor: [0, 74, 5], wallStun: "foreman.dazed", tell: { at: [0, 33], kind: "pounce" } },
    "barn.whistle": slam({ s: 48, dmg: 1.4, r: [0, 2.4], hazard: { kind: "lane", axis: "z", at: "lamb", w: 2.2, lead: 42, dmg: 1.6, knockdown: true, id: "whistle" } }),
  },
  phases: [
    { name: "the barn", until: 0.6, rest: 75, space: [1.8, 3.6],
      attacks: [A("barn.slap", 0, 2.5, 2, { then: [F("barn.slap", 1, [F("barn.rib", 1), END(2)]), F("barn.rib.late", 1), END(2)] }), A("barn.rib", 0, 2.7, 1, { cool: 160 }),
        A("barn.drag", 2.0, 4.0, 1.2, { cool: 220 }), A("barn.charge", 4.0, 12, 1, { cool: 300 })] },
    { name: "the whistle", until: 0.3, rest: 60, space: [1.6, 3.2], morph: { look: "whistle" }, signature: { move: "barn.whistle", every: 540, first: 200, min: 0, max: 4, rest: 110 },
      attacks: [A("barn.slap", 0, 2.5, 2, { then: [F("barn.hug", 1), F("barn.rib.late", 1), F("barn.slap", 1), END(1)] }), A("barn.hug", 0, 1.8, 1, { cool: 220 }),
        A("barn.drag", 2.0, 4.0, 1.4, { cool: 180 }), A("barn.charge", 4.0, 12, 1.2, { cool: 240 })],
      hazards: [{ kind: "spot", at: "lamb", scatter: 2.5, n: 2, r: 1.1, every: 300, first: 150, lead: 40, dmg: 1.5, knockdown: true, both: true, id: "beam" }] },
    { name: "itself", until: -1, rest: 45, space: [1.4, 3.0], morph: { look: "itself" }, ground: { walls: [[15, 0, 21, 11]] }, signature: { move: "barn.whistle", every: 420, first: 100, min: 0, max: 4, rest: 100 },
      attacks: [A("barn.slap", 0, 2.5, 2, { then: [F("barn.hug", 1.5), F("barn.rib.late", 1), F("barn.rib", 1)] }), A("barn.hug", 0, 1.8, 1.2, { cool: 180 }),
        A("barn.drag", 2.0, 4.0, 1.2, { cool: 160 }), A("barn.charge", 4.0, 12, 1.4, { cool: 200 })],
      hazards: [{ kind: "spot", at: "lamb", scatter: 2.5, n: 3, r: 1.1, every: 260, first: 80, lead: 38, dmg: 1.5, knockdown: true, both: true, id: "beam" }] },
  ],
};

// The Figure: a mirror duelist. It answers the player's last string with the same string, its own tells drawn out;
// it takes a careless player's rhythm and turns it back. Its signature is a shock across the floor; the floor
// freezes, and in the last phase the ice cracks in rings round the player.
const figAsk = swing({ s: 24, dmg: 1.2, arc: [-45, 45], r: [0.3, 2.3] });
export const FIGURE_FIGHT = {
  tune: { standing: 1, harm: 1.15 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 52, speed: 2.8, accel: 16, turn: 6, poise: 12, breath: 14 },
  moves: {
    "figure.jab": figAsk, "figure.jab.late": late(figAsk, 20),
    "figure.hook": swing({ s: 28, dmg: 1.4, arc: [-70, 30], r: [0.3, 2.5], kind: "swing" }),
    "figure.step": lunge({ s: 28, dmg: 1.3, reach: 8.5 }),
    "figure.grab": grab({ s: 36, dmg: 2.4 }),
    "figure.echo.light": swing({ s: 22, rec: 18, dmg: 1.0, arc: [-40, 40], r: [0.3, 2.2] }),
    "figure.echo.heavy": heavy({ s: 34, dmg: 1.8 }),
    "figure.echo.charged": heavy({ s: 40, dmg: 2.3, r: [0.3, 2.8], knockdown: true }),
    "figure.quake": slam({ s: 46, dmg: 1.6, r: [0, 2.6], hazard: { kind: "lane", axis: "x", at: "lamb", w: 1.8, lead: 42, dmg: 1.5, id: "crack" } }),
  },
  phases: [
    { name: "the visitor", until: 0.65, rest: 70, space: [2.0, 3.4], mirror: { light: "figure.echo.light", heavy: "figure.echo.heavy", charged: "figure.echo.charged", reach: 2.6, cool: 360 },
      attacks: [A("figure.jab", 0, 2.2, 2, { then: [F("figure.hook", 1), F("figure.jab.late", 1), END(2)] }), A("figure.hook", 0, 2.4, 1, { cool: 120 }), A("figure.step", 3.0, 7.5, 1.2, { cool: 180 })] },
    { name: "the river", until: 0.3, rest: 55, space: [1.8, 3.0], morph: { look: "river" }, ground: { cells: { ch: "f", at: [[10, 6, 4.5]] } },
      mirror: { light: "figure.echo.light", heavy: "figure.echo.heavy", charged: "figure.echo.charged", reach: 2.6, cool: 240 }, signature: { move: "figure.quake", every: 540, first: 200, min: 0, max: 3.0, rest: 110 },
      attacks: [A("figure.jab", 0, 2.2, 2, { then: [F("figure.hook", 1, [F("figure.grab", 1), END(1)]), F("figure.jab.late", 1), END(1)] }), A("figure.grab", 0, 1.8, 1, { cool: 220 }),
        A("figure.hook", 0, 2.4, 1, { cool: 100 }), A("figure.step", 3.0, 7.5, 1.2, { cool: 150 })] },
    { name: "the ice", until: -1, rest: 45, space: [1.6, 2.8], morph: { look: "ice", frost: true },
      mirror: { light: "figure.echo.light", heavy: "figure.echo.heavy", charged: "figure.echo.charged", reach: 2.6, cool: 160 }, signature: { move: "figure.quake", every: 420, first: 100, min: 0, max: 3.0, rest: 100 },
      attacks: [A("figure.jab", 0, 2.2, 2, { then: [F("figure.hook", 1.5, [F("figure.grab", 1), F("figure.jab.late", 1)]), F("figure.jab.late", 1.5), END(1)] }), A("figure.grab", 0, 1.8, 1.2, { cool: 180 }),
        A("figure.step", 3.0, 7.5, 1.4, { cool: 120 })],
      hazards: [{ kind: "ring", at: "lamb", r: 2.2, every: 360, first: 160, lead: 42, dmg: 1.4, knockdown: true, id: "crack" }] },
  ],
  strike: [{ kind: "mirror" }],
};

// Everybody Says (SPITE): a crowd boss. The crier's horn calls heads that multiply, close round the player and chant each
// other's next blows on; the horn is the leader, and breaking it sends the heads home. Its signature spreads a line of
// posts across the verge; the verge narrows in the last phase.
export const SAYS_FIGHT = {
  tune: { standing: 0.6, harm: 0.85 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 44, speed: 1.8, accel: 12, turn: 5, poise: 30, breath: 14 },
  moves: {
    "says.push": swing({ s: 24, dmg: 1.1, arc: [-50, 50], r: [0.3, 2.3] }), "says.push.late": late(swing({ s: 24, dmg: 1.1, arc: [-50, 50], r: [0.3, 2.3] }), 20),
    "says.sink": heavy({ s: 38, dmg: 1.9, r: [0.3, 2.6] }),
    "says.grab": grab({ s: 36, dmg: 2.0 }),
    "says.throng": lunge({ s: 28, dmg: 1.2, reach: 8 }),
    "says.post": call({ s: 36, summon: { n: 2, at: "verge", style: "swarm", form: "head", def: { hp: 2.2, harm: 0.55 }, max: 4 } }),
    "says.chorus": call({ s: 36, shout: { r: 20, cool: true, poise: 3 } }),
    "says.spread": slam({ s: 46, dmg: 1.4, r: [0, 2.4], hazard: { kind: "lane", axis: "x", at: "lamb", w: 2.0, lead: 42, dmg: 1.4, id: "posts" } }),
  },
  phases: [
    { name: "the crier", until: 0.65, rest: 75, space: [2.4, 4.0], opening: ["says.post"],
      attacks: [A("says.push", 0, 2.2, 2, { then: [F("says.push.late", 1), F("says.push", 1), END(2)] }), A("says.sink", 0, 2.5, 1, { cool: 180 }), A("says.post", 2.5, 12, 0.8, { cool: 600 }), A("says.throng", 3.0, 7.5, 1, { cool: 200 })] },
    { name: "the heads", until: 0.3, rest: 60, space: [2.2, 3.6], morph: { look: "heads" }, signature: { move: "says.spread", every: 540, first: 200, min: 0, max: 6, rest: 110 },
      attacks: [A("says.push", 0, 2.2, 2, { then: [F("says.grab", 1), F("says.push.late", 1), END(2)] }), A("says.sink", 0, 2.5, 1, { cool: 160 }), A("says.grab", 0, 1.8, 1, { cool: 240 }),
        A("says.post", 2.5, 12, 1, { cool: 420 }), A("says.chorus", 0, 12, 1, { cool: 360 })] },
    { name: "the verge", until: -1, rest: 45, space: [2.0, 3.2], morph: { look: "verge", bowl: 2 }, signature: { move: "says.spread", every: 420, first: 100, min: 0, max: 6, rest: 100 },
      attacks: [A("says.push", 0, 2.2, 2, { then: [F("says.grab", 1.2), F("says.push.late", 1.2), F("says.sink", 1)] }), A("says.grab", 0, 1.8, 1.2, { cool: 200 }),
        A("says.post", 2.5, 12, 1, { cool: 360 }), A("says.chorus", 0, 12, 1.2, { cool: 300 })] },
  ],
};

// Order: a riot shield in a street that closes. Blows into the shield glance (front guard); the player has to get
// round it. Its bash and drag clear room; its call brings constables; its signature is the shield line driven down
// the street. Each phase walls off more of the street from the left.
const baton = swing({ s: 24, dmg: 1.2, arc: [-40, 50], r: [0.3, 2.3] });
export const ORDER_FIGHT = {
  tune: { standing: 0.8, harm: 0.45 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 50, speed: 2.4, accel: 14, turn: 5, poise: 14, breath: 14, frontGuard: 0.65 },
  moves: {
    "order.baton": baton, "order.baton.late": late(baton, 20),
    "order.backhand": swing({ s: 22, rec: 20, dmg: 1.0, arc: [-60, 20], r: [0.3, 2.1] }),
    "order.bash": { ...lunge({ s: 30, dmg: 1.4, reach: 7, r: [0.2, 1.5] }), guardBreak: true, parryable: false, tell: { at: [0, 29], kind: "pounce" }, knock: 3.6 },
    "order.drag": grab({ s: 38, dmg: 1.6, r: [0.6, 3.8], toward: "van", root: [] }),
    "order.sweep": sweep({ s: 38, dmg: 1.4 }),
    "order.call": call({ s: 36, summon: { n: 2, at: "kerb", form: "lantern", style: "shield", def: { hp: 4, speed: 1.6, harm: 0.4 }, max: 2 } }),
    "order.line": slam({ s: 46, dmg: 1.5, r: [0, 2.4], hazard: { kind: "lane", axis: "z", at: "lamb", w: 2.2, lead: 42, dmg: 1.6, knockdown: true, id: "line" } }),
  },
  phases: [
    { name: "one", until: 0.66, rest: 70, space: [2.0, 3.4],
      attacks: [A("order.baton", 0, 2.2, 2, { then: [F("order.backhand", 1, [F("order.baton.late", 1), END(2)]), F("order.baton.late", 1), END(2)] }), A("order.bash", 2.4, 7, 1.2, { cool: 200 }), A("order.sweep", 0, 2.6, 0.8, { cool: 240 }), A("order.drag", 0, 3.8, 0.6, { cool: 300 })] },
    { name: "three", until: 0.33, rest: 55, space: [1.8, 3.2], opening: ["order.call"], ground: { walls: [[1, 1, 3, 9]] },
      attacks: [A("order.baton", 0, 2.2, 2, { then: [F("order.backhand", 1, [F("order.drag", 1), END(1)]), F("order.baton.late", 1), END(1)] }), A("order.bash", 2.4, 7, 1.2, { cool: 160 }),
        A("order.drag", 2.0, 3.8, 1, { cool: 220 }), A("order.sweep", 0, 2.6, 1, { cool: 200 })] },
    { name: "the wall", until: -1, rest: 45, space: [1.6, 3.0], ground: { walls: [[1, 1, 6, 9]] }, signature: { move: "order.line", every: 420, first: 100, min: 0, max: 8, rest: 100 },
      attacks: [A("order.baton", 0, 2.2, 2, { then: [F("order.backhand", 1, [F("order.drag", 1), F("order.sweep", 1)]), F("order.baton.late", 1.5), END(1)] }), A("order.bash", 2.4, 7, 1.4, { cool: 120 }),
        A("order.drag", 2.0, 3.8, 1.2, { cool: 180 }), A("order.call", 0, 20, 0.6, { cool: 900 })] },
  ],
};
