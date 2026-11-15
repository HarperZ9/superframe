// Real fights for the three traits that had no body before the traits pass (design/TRAITS.md, 2026-10-23): JEALOUSY,
// DREAD and SHAME. They are lesser beings: met only in the Descent, where a gate of the trait's compartment fights as
// them or carries their blows (combat/arena/descent.mjs). The grammar is combat/data/fights-a.mjs's: strings with a
// mixup, a grab, unblockable blows with long tells, a signature, rests after strings, phases that escalate. Each
// weakness is the trait's own truth, built into the numbers below and named in TRAITS.md.
import { swing, late, lunge, heavy, sweep, grab, slam } from "./innermoves.mjs";
import { A, F, END } from "./fights-a.mjs";

// JEALOUSY: a hoarding fence that walks, a hole cut at eye height and one eye in it, long arms reaching over the top.
// It reaches for what you hold (the grab takes your breath as it drags you to its hole), its boards come down in a
// lane, and its eye sees only what is straight in front of the hole: every blow it throws is narrow. Stand to its side.
const reach = swing({ s: 24, dmg: 1.2, arc: [-22, 22], r: [0.4, 2.8] });
export const JEALOUSY_FIGHT = {
  tune: { standing: 0.9, harm: 0.95 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 46, speed: 2.3, accel: 14, turn: 2.6, poise: 13, breath: 14 },
  moves: {
    "jealousy.reach": reach, "jealousy.reach.late": late(reach, 22),
    "jealousy.over": swing({ s: 26, rec: 22, dmg: 1.3, arc: [-18, 18], r: [0.8, 3.2], kind: "swing" }),
    "jealousy.take": grab({ s: 34, dmg: 1.6, r: [0.2, 2.2], hits: [{ arc: [-20, 20], r: [0.2, 2.2] }], drain: 2 }),
    "jealousy.lunge": lunge({ s: 28, dmg: 1.3, reach: 7 }),
    "jealousy.boards": slam({ s: 46, dmg: 1.6, r: [0, 2.2], hazard: { kind: "lane", axis: "z", at: "lamb", w: 1.8, lead: 42, dmg: 1.4, id: "boards" } }),
  },
  phases: [
    { name: "the fence", until: 0.6, rest: 70, space: [2.2, 3.6],
      attacks: [A("jealousy.reach", 0, 2.8, 2, { then: [F("jealousy.over", 1, [F("jealousy.take", 1), END(2)]), F("jealousy.reach.late", 1), END(2)] }), A("jealousy.take", 0, 2.0, 0.8, { cool: 240 }), A("jealousy.lunge", 3.0, 7.5, 1.2, { cool: 180 })] },
    { name: "the hole", until: 0.3, rest: 55, space: [2.0, 3.4], morph: { look: "hole" }, signature: { move: "jealousy.boards", every: 540, first: 200, min: 0, max: 8, rest: 110 },
      attacks: [A("jealousy.reach", 0, 2.8, 2, { then: [F("jealousy.over", 1, [F("jealousy.take", 1.2), END(1)]), F("jealousy.reach.late", 1), END(1)] }), A("jealousy.take", 0, 2.0, 1.1, { cool: 200 }),
        A("jealousy.lunge", 3.0, 7.5, 1.3, { cool: 150 })] },
    { name: "the eye", until: -1, rest: 45, space: [1.8, 3.2], morph: { look: "eye", bowl: 1 }, signature: { move: "jealousy.boards", every: 420, first: 100, min: 0, max: 8, rest: 100 },
      attacks: [A("jealousy.reach", 0, 2.8, 2, { then: [F("jealousy.over", 1.5, [F("jealousy.take", 1), F("jealousy.reach.late", 1)]), F("jealousy.reach.late", 1.5), END(1)] }),
        A("jealousy.take", 0, 2.0, 1.3, { cool: 160 }), A("jealousy.lunge", 3.0, 7.5, 1.4, { cool: 120 })] },
  ],
};

// DREAD: a black door frame walking in a long coat, the door open on nothing. Every blow is a wait: its wind-ups are
// the longest in the arena and the big ones (the door, the dark) carry no armour, so a player who walks into the wait
// with a heavy blow stops it before it comes; a man who only stands in its face swinging gets the hand out of the door
// and the coat swung round, which do not stop. What comes when it does come is ordinary. Its signature is the dark itself: patches of the floor
// go out where the player stands.
const wait = swing({ s: 30, dmg: 1.1, arc: [-50, 50], r: [0.3, 2.4] });
export const DREAD_FIGHT = {
  tune: { standing: 0.9, harm: 1.25 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 44, speed: 1.9, accel: 11, turn: 4, poise: 16, breath: 14 },
  moves: {
    "dread.wait": late(wait, 34), "dread.wait.short": wait,
    "dread.door": heavy({ s: 56, dmg: 2.2, r: [0.3, 2.6], armor: null }),
    "dread.come": lunge({ s: 40, dmg: 1.4, reach: 9 }),
    // the two blows that answer a man who stands in its face: the hand out of the door, and the coat swung round
    "dread.take": grab({ s: 40, dmg: 2.2, armor: [0, 48, 4] }),
    "dread.round": sweep({ s: 46, dmg: 1.4 }),
    "dread.dark": slam({ s: 60, dmg: 1.3, armor: null, hazard: { kind: "spot", at: "lamb", scatter: 2.4, n: 3, r: 1.1, lead: 52, dmg: 1.3, id: "dark" } }),
  },
  phases: [
    { name: "the door", until: 0.6, rest: 80, space: [2.4, 4.0],
      attacks: [A("dread.wait", 0, 2.4, 2, { then: [F("dread.wait.short", 1, [F("dread.door", 1), END(2)]), END(2)] }), A("dread.door", 0, 2.6, 1, { cool: 200 }), A("dread.come", 3.5, 9, 1.4, { cool: 160 })] },
    { name: "the stair", until: 0.3, rest: 60, space: [2.2, 3.6], morph: { look: "stair", dim: 0.85 }, signature: { move: "dread.dark", every: 520, first: 200, min: 0, max: 9, rest: 110 },
      attacks: [A("dread.wait", 0, 2.4, 2, { then: [F("dread.wait.short", 1, [F("dread.take", 1), END(1)]), F("dread.door", 1), END(1)] }), A("dread.take", 0, 1.9, 1, { cool: 220 }),
        A("dread.round", 0, 2.6, 0.8, { cool: 260 }), A("dread.come", 3.5, 9, 1.4, { cool: 140 })] },
    { name: "the open door", until: -1, rest: 50, space: [2.0, 3.4], morph: { look: "open", dim: 0.75, bowl: 1 }, signature: { move: "dread.dark", every: 400, first: 100, min: 0, max: 9, rest: 100 },
      attacks: [A("dread.wait", 0, 2.4, 2, { then: [F("dread.wait.short", 1.5, [F("dread.take", 1), F("dread.door", 1)]), F("dread.round", 1), END(1)] }),
        A("dread.take", 0, 1.9, 1.2, { cool: 180 }), A("dread.round", 0, 2.6, 1, { cool: 200 }), A("dread.come", 3.5, 9, 1.5, { cool: 110 })] },
  ],
};

// SHAME: a hunched figure in wet sheets, its head turned away over its shoulder so it never looks at you. It pulls you
// in from across the room (the undertow), strikes with its back and elbows half turned, and throws a sheet over you (a
// grab that puts you down). It cannot stand to be looked at: blows to its front, to the face it keeps turned away, land
// half again as hard (frontGuard below zero; combat/sim/hits.mjs). The answer is to stand square in front of it, the
// last place you want to be.
const back = swing({ s: 24, dmg: 1.2, arc: [-60, 40], r: [0.3, 2.4] });
export const SHAME_FIGHT = {
  tune: { standing: 0.9, harm: 0.85 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 48, speed: 2.2, accel: 13, turn: 3.2, poise: 12, breath: 14, frontGuard: -0.5 },
  moves: {
    "shame.back": back, "shame.back.late": late(back, 20),
    "shame.elbow": swing({ s: 22, rec: 20, dmg: 1.0, arc: [-20, 70], r: [0.3, 2.0] }),
    "shame.pull": grab({ s: 36, dmg: 1.4, r: [0.4, 3.4], hits: [{ arc: [-40, 40], r: [0.4, 3.4] }], toward: "anchor", knockdown: false }),
    "shame.sheet": grab({ s: 34, dmg: 2.2, hits: [{ arc: [-45, 45], r: [0.2, 1.9] }] }),
    "shame.turn": sweep({ s: 40, dmg: 1.3 }),
    "shame.wet": slam({ s: 48, dmg: 1.4, hazard: { kind: "ring", at: "boss", r: 1.6, lead: 44, dmg: 1.3, id: "wet" } }),
  },
  phases: [
    { name: "the back", until: 0.6, rest: 70, space: [1.8, 3.2],
      attacks: [A("shame.back", 0, 2.3, 2, { then: [F("shame.elbow", 1, [F("shame.sheet", 1), END(2)]), F("shame.back.late", 1), END(2)] }), A("shame.pull", 2.4, 3.4, 1.1, { cool: 200 }), A("shame.turn", 0, 2.6, 0.8, { cool: 240 })] },
    { name: "the sheets", until: 0.3, rest: 55, space: [1.6, 3.0], morph: { look: "sheets" }, signature: { move: "shame.wet", every: 540, first: 200, min: 0, max: 3, rest: 110 },
      attacks: [A("shame.back", 0, 2.3, 2, { then: [F("shame.elbow", 1, [F("shame.sheet", 1.2), END(1)]), F("shame.back.late", 1), END(1)] }), A("shame.sheet", 0, 1.8, 1, { cool: 200 }),
        A("shame.pull", 2.4, 3.4, 1.3, { cool: 160 }), A("shame.turn", 0, 2.6, 1, { cool: 200 })] },
    { name: "the face", until: -1, rest: 45, space: [1.4, 2.8], morph: { look: "face", bowl: 1 }, signature: { move: "shame.wet", every: 420, first: 100, min: 0, max: 3, rest: 100 },
      attacks: [A("shame.back", 0, 2.3, 2, { then: [F("shame.elbow", 1.5, [F("shame.sheet", 1), F("shame.turn", 1)]), F("shame.back.late", 1.5), END(1)] }),
        A("shame.sheet", 0, 1.8, 1.2, { cool: 170 }), A("shame.pull", 2.4, 3.4, 1.4, { cool: 130 }), A("shame.turn", 0, 2.6, 1, { cool: 180 })] },
  ],
};
