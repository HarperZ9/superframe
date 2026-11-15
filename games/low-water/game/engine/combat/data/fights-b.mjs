// Real fights for the seven era 2 bosses (see combat/data/fights-a.mjs for the grammar). Each keeps its old ground
// and form; the theme is carried by what it does and where.
import { swing, late, lunge, heavy, sweep, grab, slam, call } from "./innermoves.mjs";
import { A, F, END } from "./fights-a.mjs";

// Steady Hand (PRUDENCE; was Received and Found Correct): a broad man whose arm is the scale's beam, who fights from behind his desk. His hammer-fist breaks a guard;
// his cuffs come in strings; he seizes the player's arm; in the second phase two men in coats come in at his call;
// his signature brings the ceiling's plaster down where the player stands, and the room closes on the desk.
const cuff = swing({ s: 24, dmg: 1.2, arc: [-50, 50], r: [0.3, 2.4] });
export const PRUDENCE_FIGHT = {
  tune: { standing: 0.85, harm: 0.7 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 50, speed: 2.5, accel: 15, turn: 5, poise: 13, breath: 14 },
  moves: {
    "prudence.cuff": cuff, "prudence.cuff.late": late(cuff, 20), "prudence.backhand": swing({ s: 22, rec: 20, dmg: 1.0, arc: [-60, 30], r: [0.3, 2.2] }),
    "prudence.hammer": heavy({ s: 38, dmg: 2.0, r: [0.3, 2.5] }),
    "prudence.sweep": sweep({ s: 38, dmg: 1.3 }),
    "prudence.lunge": lunge({ s: 28, dmg: 1.3, reach: 8 }),
    "prudence.seize": grab({ s: 36, dmg: 2.2 }),
    "prudence.call": call({ s: 36, summon: { n: 2, style: "swarm", form: "coat", def: { hp: 2 }, max: 4 } }),
    "prudence.quake": slam({ s: 46, dmg: 1.8, hazard: { kind: "spot", at: "lamb", scatter: 2.0, n: 3, r: 1.0, lead: 40, dmg: 1.2, id: "plaster" } }),
  },
  phases: [
    { name: "the desk", until: 0.6, rest: 70, space: [2.0, 3.4],
      attacks: [A("prudence.cuff", 0, 2.3, 2, { then: [F("prudence.backhand", 1, [F("prudence.hammer", 1), END(2)]), F("prudence.cuff.late", 1), END(2)] }), A("prudence.hammer", 0, 2.4, 1, { cool: 180 }),
        A("prudence.sweep", 0, 2.6, 0.8, { cool: 240 }), A("prudence.lunge", 3.0, 7.5, 1.2, { cool: 180 })] },
    { name: "the coats", until: 0.3, rest: 55, space: [1.8, 3.2], morph: { look: "coats" }, opening: ["prudence.call"], signature: { move: "prudence.quake", every: 540, first: 200, min: 0, max: 3.0, rest: 110 },
      attacks: [A("prudence.cuff", 0, 2.3, 2, { then: [F("prudence.backhand", 1, [F("prudence.seize", 1), END(1)]), F("prudence.cuff.late", 1), END(1)] }), A("prudence.seize", 0, 1.8, 1, { cool: 220 }),
        A("prudence.hammer", 0, 2.4, 1, { cool: 150 }), A("prudence.lunge", 3.0, 7.5, 1.2, { cool: 150 }), A("prudence.call", 0, 20, 0.5, { cool: 900 })] },
    { name: "the eye", until: -1, rest: 45, space: [1.6, 3.0], morph: { look: "eye", bowl: 2 }, signature: { move: "prudence.quake", every: 420, first: 100, min: 0, max: 3.0, rest: 100 },
      attacks: [A("prudence.cuff", 0, 2.3, 2, { then: [F("prudence.backhand", 1.5, [F("prudence.seize", 1), F("prudence.hammer", 1)]), F("prudence.cuff.late", 1.5), END(1)] }),
        A("prudence.seize", 0, 1.8, 1.2, { cool: 180 }), A("prudence.sweep", 0, 2.6, 1, { cool: 200 }), A("prudence.lunge", 3.0, 7.5, 1.4, { cool: 120 })],
      hazards: [{ kind: "spot", at: "lamb", scatter: 2.0, n: 2, r: 1.0, every: 300, first: 120, lead: 38, dmg: 1.1, id: "plaster" }] },
  ],
};

// Only What They Send: a chairman and his coats. The coats sit until called, then crowd the player and come at once
// when he claps; the chairman's gavel breaks a guard; the vote sweeps the long table; his chair is a grab.
const press = swing({ s: 24, dmg: 1.1, arc: [-45, 45], r: [0.3, 2.3] });
export const ONLY_FIGHT = {
  tune: { standing: 0.8, harm: 0.6 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 44, speed: 2.3, accel: 14, turn: 5, poise: 12, breath: 14 },
  moves: {
    "only.press": press, "only.press.late": late(press, 20), "only.press2": swing({ s: 22, rec: 20, dmg: 1.0, arc: [-30, 60], r: [0.3, 2.2] }),
    "only.gavel": heavy({ s: 38, dmg: 1.9 }),
    "only.motion": lunge({ s: 28, dmg: 1.2, reach: 8 }),
    "only.chair": grab({ s: 36, dmg: 2.0, toward: "chair12" }),
    "only.seat": call({ s: 34, summon: { n: 2, at: "chairs", form: "coat", style: "holder", def: { hp: 3, speed: 1.6, accel: 10, harm: 0.35 }, max: 2 } }),
    "only.clap": call({ s: 36, shout: { r: 20, cool: true, poise: 3 } }),
    "only.vote": slam({ s: 46, dmg: 1.4, r: [0, 2.4], hazard: { kind: "lane", axis: "x", at: "lamb", w: 2.0, lead: 42, dmg: 1.5, id: "vote" } }),
  },
  phases: [
    { name: "the meeting", until: 0.66, rest: 70, space: [2.0, 3.4], opening: ["only.seat"],
      attacks: [A("only.press", 0, 2.2, 2, { then: [F("only.press2", 1, [F("only.gavel", 1), END(2)]), F("only.press.late", 1), END(2)] }), A("only.gavel", 0, 2.5, 1, { cool: 180 }), A("only.motion", 3.0, 7.5, 1.2, { cool: 180 })] },
    { name: "noon", until: 0.33, rest: 55, space: [1.8, 3.2], morph: { look: "noon" }, signature: { move: "only.vote", every: 540, first: 200, min: 0, max: 8, rest: 110 },
      attacks: [A("only.press", 0, 2.2, 2, { then: [F("only.press2", 1, [F("only.chair", 1), END(1)]), F("only.press.late", 1), END(1)] }), A("only.chair", 0, 1.8, 1, { cool: 220 }),
        A("only.clap", 0, 20, 0.8, { cool: 420 }), A("only.seat", 0, 20, 0.6, { cool: 600 }), A("only.motion", 3.0, 7.5, 1.2, { cool: 150 })] },
    { name: "the chair", until: -1, rest: 45, space: [1.6, 3.0], morph: { look: "chair" }, signature: { move: "only.vote", every: 420, first: 100, min: 0, max: 8, rest: 100 },
      attacks: [A("only.press", 0, 2.2, 2, { then: [F("only.press2", 1.5, [F("only.chair", 1), F("only.gavel", 1)]), F("only.press.late", 1.5), END(1)] }), A("only.chair", 0, 1.8, 1.2, { cool: 180 }),
        A("only.clap", 0, 20, 1, { cool: 300 }), A("only.gavel", 0, 2.5, 1, { cool: 150 }), A("only.motion", 3.0, 7.5, 1.4, { cool: 120 })] },
  ],
};

// Never Once (Friday): a father who grabs, holds and leans. His backhand is quick; his reach is a grab; the table
// slam sends a shock along the table; the belt is his signature. In the last phase the kitchen closes round him.
const over = heavy({ s: 36, dmg: 2.0, r: [0.3, 2.6] });
export const FRIDAY_FIGHT = {
  loseEnds: true, // going under the arm on purpose (the lay) stays this fight's own ending without force
  tune: { standing: 1, harm: 1 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 56, speed: 2.4, accel: 14, turn: 5, poise: 15, breath: 14 },
  moves: {
    "friday.backhand": swing({ s: 22, rec: 20, dmg: 1.1, arc: [-60, 30], r: [0.3, 2.3] }),
    "friday.cuff": swing({ s: 26, dmg: 1.3, arc: [-30, 60], r: [0.3, 2.3] }),
    "friday.overhead": over, "friday.overhead.late": late(over, 18),
    "friday.reach": grab({ s: 34, dmg: 2.0, r: [0.3, 2.2] }),
    "friday.lean": grab({ s: 40, a: 20, dmg: 2.8, r: [0.2, 1.8], knockdown: true }),
    "friday.slam": slam({ s: 44, dmg: 1.6, r: [0, 2.4], hazard: { kind: "lane", axis: "x", at: "anchor:anchor", w: 1.8, lead: 40, dmg: 1.4, id: "table" } }),
    "friday.belt": slam({ s: 48, dmg: 2.0, r: [0.4, 4.2], hits: [{ arc: [-30, 30], r: [0.4, 4.2] }] }),
  },
  phases: [
    { name: "the father", until: 0.6, rest: 70, space: [1.8, 3.2],
      attacks: [A("friday.backhand", 0, 2.2, 2, { then: [F("friday.cuff", 1, [F("friday.overhead", 1), END(2)]), F("friday.overhead.late", 1), END(2)] }), A("friday.reach", 0, 2.0, 1, { cool: 220 }),
        A("friday.overhead", 0, 2.5, 1, { cool: 160 }), A("friday.slam", 0, 3.0, 0.8, { cool: 360 })] },
    { name: "Saturn", until: 0.3, rest: 55, space: [1.6, 3.0], morph: { look: "saturn", scale: 1.25 }, signature: { move: "friday.belt", every: 540, first: 200, min: 1.5, max: 4.0, rest: 110 },
      attacks: [A("friday.backhand", 0, 2.2, 2, { then: [F("friday.cuff", 1, [F("friday.reach", 1), F("friday.overhead.late", 1)]), F("friday.reach", 1), END(1)] }), A("friday.lean", 0, 1.7, 1, { cool: 260 }),
        A("friday.overhead", 0, 2.5, 1, { cool: 140 }), A("friday.slam", 0, 3.0, 1, { cool: 300 })] },
    { name: "the arm", until: -1, rest: 45, space: [1.4, 2.8], morph: { look: "arm", scale: 1.4, bowl: 1 }, signature: { move: "friday.belt", every: 420, first: 100, min: 1.5, max: 4.0, rest: 100 },
      attacks: [A("friday.backhand", 0, 2.2, 2, { then: [F("friday.lean", 1.5), F("friday.cuff", 1, [F("friday.overhead.late", 1), F("friday.reach", 1)]), END(1)] }),
        A("friday.lean", 0, 1.7, 1.4, { cool: 200 }), A("friday.reach", 0, 2.0, 1.2, { cool: 180 }), A("friday.slam", 0, 3.0, 1, { cool: 260 })] },
  ],
};

// He's With Me: a clay guard that grows by phase as the yard closes round it. Heavy fists, a hold, a charge that
// dazes it on the wall, and a stomp that rings out.
const fist = swing({ s: 26, dmg: 1.4, arc: [-45, 45], r: [0.3, 2.5] });
export const WITHME_FIGHT = {
  layers: { yield: { follow: { hold: 60, from: 0 } } }, // the word rubbed out in one of its rests, from the first phase
  tune: { standing: 1, harm: 1.15 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 56, speed: 2.1, accel: 12, turn: 4, poise: 18, breath: 16 },
  moves: {
    "withme.fist": fist, "withme.fist.late": late(fist, 20), "withme.fist2": swing({ s: 24, rec: 22, dmg: 1.2, arc: [-60, 30], r: [0.3, 2.4] }),
    "withme.sweep": sweep({ s: 40, dmg: 1.5 }),
    "withme.hold": grab({ s: 36, dmg: 2.4 }),
    "withme.charge": { ...lunge({ s: 34, a: 36, rec: 34, dmg: 1.8, reach: 7.5 }), knockdown: true, parryable: false, armor: [0, 70, 5], wallStun: "foreman.dazed", tell: { at: [0, 33], kind: "pounce" } },
    "withme.stomp": slam({ s: 46, dmg: 1.8, hazard: { kind: "ring", at: "boss", r: 2.6, lead: 42, dmg: 1.3, id: "stomp" } }),
  },
  phases: [
    { name: "the guard", until: 0.65, rest: 75, space: [1.8, 3.4],
      attacks: [A("withme.fist", 0, 2.4, 2, { then: [F("withme.fist2", 1, [F("withme.fist.late", 1), END(2)]), F("withme.fist.late", 1), END(2)] }), A("withme.sweep", 0, 2.6, 0.8, { cool: 240 }), A("withme.charge", 4, 12, 1, { cool: 300 })] },
    { name: "the cell", until: 0.3, rest: 55, space: [1.6, 3.2], morph: { look: "cell", scale: 1.3, bowl: 1 }, signature: { move: "withme.stomp", every: 540, first: 200, min: 0, max: 3, rest: 110 },
      attacks: [A("withme.fist", 0, 2.4, 2, { then: [F("withme.fist2", 1, [F("withme.hold", 1), END(1)]), F("withme.hold", 1), END(1)] }), A("withme.hold", 0, 1.8, 1, { cool: 220 }),
        A("withme.sweep", 0, 2.6, 1, { cool: 200 }), A("withme.charge", 4, 12, 1.2, { cool: 240 })] },
    { name: "the walls", until: -1, rest: 45, space: [1.4, 3.0], morph: { look: "walls", scale: 1.6, bowl: 2 }, signature: { move: "withme.stomp", every: 420, first: 100, min: 0, max: 3, rest: 100 },
      attacks: [A("withme.fist", 0, 2.4, 2, { then: [F("withme.fist2", 1.5, [F("withme.hold", 1), F("withme.sweep", 1)]), F("withme.fist.late", 1.5), END(1)] }), A("withme.hold", 0, 1.8, 1.2, { cool: 180 }),
        A("withme.charge", 4, 12, 1.4, { cool: 200 })] },
  ],
};

// Nearest One: a beast in the granary's maze. It charges down the corridors and dazes itself on the stacks; it gores
// in strings and tosses with its horns; it pounces; its bellow brings sacks down where the player stands.
const gore = swing({ s: 24, dmg: 1.3, arc: [-40, 40], r: [0.3, 2.4] });
export const NEAREST_FIGHT = {
  tune: { standing: 1, harm: 1.15 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 50, speed: 3.0, accel: 18, turn: 6, poise: 13, breath: 14 },
  moves: {
    "nearest.gore": gore, "nearest.gore.late": late(gore, 20), "nearest.gore2": swing({ s: 22, rec: 20, dmg: 1.1, arc: [-20, 60], r: [0.3, 2.2] }),
    "nearest.horns": heavy({ s: 36, dmg: 2.0, knockdown: true }),
    "nearest.charge": { ...lunge({ s: 32, a: 40, rec: 34, dmg: 1.8, reach: 9 }), knockdown: true, parryable: false, armor: [0, 72, 5], wallStun: "foreman.dazed", tell: { at: [0, 31], kind: "pounce" } },
    "nearest.pounce": grab({ s: 36, dmg: 2.4, root: [[30, 44, 6]] }),
    "nearest.bellow": slam({ s: 46, dmg: 1.2, r: [0, 2.2], hazard: { kind: "spot", at: "lamb", scatter: 2.0, n: 3, r: 1.0, lead: 40, dmg: 1.3, knockdown: true, id: "sacks" } }),
  },
  phases: [
    { name: "the maze", until: 0.6, rest: 70, space: [2.0, 3.6],
      attacks: [A("nearest.gore", 0, 2.3, 2, { then: [F("nearest.gore2", 1, [F("nearest.horns", 1), END(2)]), F("nearest.gore.late", 1), END(2)] }), A("nearest.horns", 0, 2.4, 1, { cool: 180 }), A("nearest.charge", 4, 14, 1.4, { cool: 260 })] },
    { name: "the beast", until: 0.3, rest: 55, space: [1.8, 3.2], morph: { look: "beast" }, signature: { move: "nearest.bellow", every: 540, first: 200, min: 0, max: 6, rest: 110 },
      attacks: [A("nearest.gore", 0, 2.3, 2, { then: [F("nearest.gore2", 1, [F("nearest.pounce", 1), END(1)]), F("nearest.gore.late", 1), END(1)] }), A("nearest.pounce", 0, 2.6, 1, { cool: 220 }),
        A("nearest.horns", 0, 2.4, 1, { cool: 160 }), A("nearest.charge", 4, 14, 1.4, { cool: 220 })] },
    { name: "the gap", until: -1, rest: 45, space: [1.6, 3.0], morph: { look: "gap" }, signature: { move: "nearest.bellow", every: 420, first: 100, min: 0, max: 6, rest: 100 },
      attacks: [A("nearest.gore", 0, 2.3, 2, { then: [F("nearest.gore2", 1.5, [F("nearest.pounce", 1), F("nearest.horns", 1)]), F("nearest.gore.late", 1.5), END(1)] }), A("nearest.pounce", 0, 2.6, 1.2, { cool: 180 }),
        A("nearest.charge", 4, 14, 1.6, { cool: 180 })],
      hazards: [{ kind: "spot", at: "lamb", scatter: 2.5, n: 2, r: 1.0, every: 300, first: 120, lead: 38, dmg: 1.2, knockdown: true, both: true, id: "sacks" }] },
  ],
};

// Forty Carts: the pole on the road post. Its hook pulls the player in, its drag hauls him to the district line;
// its thrusts come in strings; its whistle sends carts down the road in lanes, and the road freezes by phase.
const thrust = swing({ s: 24, dmg: 1.2, arc: [-15, 15], r: [0.6, 3.2], kind: "thrust" });
export const FORTY_FIGHT = {
  tune: { standing: 1, harm: 1.15 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 50, speed: 2.7, accel: 16, turn: 6, poise: 13, breath: 14 },
  moves: {
    "forty.thrust": thrust, "forty.thrust.late": late(thrust, 20), "forty.thrust2": swing({ s: 22, rec: 20, dmg: 1.0, arc: [-20, 20], r: [0.6, 3.0], kind: "thrust" }),
    "forty.hook": { startup: 32, active: 6, recovery: 22, stamina: 2, dmg: 0.9, poise: 3, hits: [{ arc: [-12, 12], r: [1, 5] }], knock: -6.5, blockable: false, parryable: false, tell: { at: [2, 31], kind: "throw" }, track: 10, trackUntil: 24, hitstop: 8, shake: 0.35 },
    "forty.drag": grab({ s: 38, dmg: 1.6, r: [0.6, 3.8], toward: "line", root: [] }),
    "forty.sweep": sweep({ s: 38, dmg: 1.3, r: [0.4, 3.0] }),
    "forty.whistle": slam({ s: 46, dmg: 1.2, r: [0, 2.2], hazard: { kind: "lane", axis: "x", at: "lamb", w: 2.0, lead: 44, dmg: 1.8, knock: 4, knockdown: true, id: "cart" } }),
  },
  phases: [
    { name: "the pole", until: 0.65, rest: 70, space: [2.4, 3.8],
      attacks: [A("forty.thrust", 0, 3.1, 2, { then: [F("forty.thrust2", 1, [F("forty.thrust.late", 1), END(2)]), F("forty.thrust.late", 1), END(2)] }), A("forty.hook", 3.2, 5, 1.2, { cool: 200, then: [F("forty.thrust", 1), END(1)] }),
        A("forty.sweep", 0, 2.9, 0.8, { cool: 240 }), A("forty.drag", 0, 3.8, 0.6, { cool: 300 })] },
    { name: "the host", until: 0.3, rest: 55, space: [2.2, 3.6], morph: { look: "host" }, signature: { move: "forty.whistle", every: 540, first: 200, min: 0, max: 8, rest: 110 }, ground: { cells: { ch: "f", at: [[11, 6, 3.5]] } },
      attacks: [A("forty.thrust", 0, 3.1, 2, { then: [F("forty.thrust2", 1, [F("forty.drag", 1), END(1)]), F("forty.thrust.late", 1), END(1)] }), A("forty.hook", 3.2, 5, 1.2, { cool: 160, then: [F("forty.drag", 1), F("forty.thrust", 1)] }),
        A("forty.drag", 2.0, 3.8, 1, { cool: 220 }), A("forty.sweep", 0, 2.9, 1, { cool: 200 })],
      hazards: [{ kind: "lane", axis: "x", at: "anchor:dip", w: 2.0, every: 420, first: 260, lead: 44, dmg: 1.6, knock: 4, knockdown: true, id: "cart" }] },
    { name: "the line", until: -1, rest: 45, space: [2.0, 3.4], morph: { look: "line" }, signature: { move: "forty.whistle", every: 420, first: 100, min: 0, max: 8, rest: 100 }, ground: { cells: { ch: "f", at: [[11, 6, 7]] } },
      attacks: [A("forty.thrust", 0, 3.1, 2, { then: [F("forty.thrust2", 1.5, [F("forty.drag", 1), F("forty.sweep", 1)]), F("forty.thrust.late", 1.5), END(1)] }), A("forty.hook", 3.2, 5, 1.4, { cool: 120, then: [F("forty.drag", 1), F("forty.thrust", 1)] }),
        A("forty.drag", 2.0, 3.8, 1.2, { cool: 180 })],
      hazards: [{ kind: "lane", axis: "x", at: "lamb", w: 2.0, every: 360, first: 160, lead: 42, dmg: 1.6, knock: 4, knockdown: true, id: "cart" }] },
  ],
};

// Nobody Checks (the Descent only): a stack of sacks behind a painted front. Front blows glance; it shoves, bashes
// and crushes, and topples sacks round the player. Two phases: the stack, then the stack coming down.
const shove = swing({ s: 26, dmg: 1.3, arc: [-50, 50], r: [0.3, 2.4] });
export const CHECK_FIGHT = {
  tune: { standing: 1, harm: 0.85 }, // tools/innerduel.mjs, 2026-10-23
  body: { standing: 48, speed: 2.0, accel: 12, turn: 4, poise: 18, breath: 16, frontGuard: 0.65 },
  moves: {
    "check.shove": shove, "check.shove.late": late(shove, 20),
    "check.bash": { ...lunge({ s: 30, dmg: 1.5, reach: 7, r: [0.2, 1.6] }), guardBreak: true, parryable: false, tell: { at: [0, 29], kind: "pounce" }, knock: 3.6 },
    "check.slam": heavy({ s: 38, dmg: 2.0 }),
    "check.sweep": sweep({ s: 40, dmg: 1.4 }),
    "check.crush": grab({ s: 36, dmg: 2.6 }),
    "check.topple": slam({ s: 46, dmg: 1.4, hazard: { kind: "spot", at: "lamb", scatter: 2.2, n: 4, r: 1.0, lead: 40, dmg: 1.3, knockdown: true, id: "sacks" } }),
  },
  phases: [
    { name: "the stack", until: 0.5, rest: 70, space: [1.8, 3.4], signature: { move: "check.topple", every: 600, first: 300, min: 0, max: 5, rest: 110 },
      attacks: [A("check.shove", 0, 2.3, 2, { then: [F("check.shove.late", 1), F("check.slam", 1), END(2)] }), A("check.bash", 2.4, 7, 1.2, { cool: 200 }), A("check.sweep", 0, 2.6, 0.8, { cool: 240 })] },
    { name: "the fall", until: -1, rest: 45, space: [1.4, 3.0], morph: { look: "fall" }, signature: { move: "check.topple", every: 420, first: 100, min: 0, max: 5, rest: 100 },
      attacks: [A("check.shove", 0, 2.3, 2, { then: [F("check.crush", 1.2), F("check.shove.late", 1.2), F("check.slam", 1)] }), A("check.crush", 0, 1.8, 1.2, { cool: 200 }),
        A("check.bash", 2.4, 7, 1.4, { cool: 140 }), A("check.sweep", 0, 2.6, 1, { cool: 200 })] },
  ],
};
