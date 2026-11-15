// Ned's line, era 2 (design/spine-plan/inferno/02-BESTIARY-A.md section 3), each a trait of his embodied (design/TRAITS.md,
// 2026-10-23): PRUDENCE as Steady Hand (boss 2; id `prudence`, was `received`, Received and Found Correct, until the traits
// pass: no boss is named for a form of words; design/TRAITS-RENAME.md) and WEARINESS as Only (boss 3). Every spoken line is a PROPOSAL from the bestiary, for the author to approve or cut.
import { like, H, step, beat } from "./flaws-common.mjs";

export const PRUDENCE = {
  id: "prudence", n: 2, era: 2, liar: "ned", line: "furrowe", tool: "w.case", trait: "sum",
  // PRUDENCE embodied: a broad man whose right arm is the exchange scale's iron beam, bolted at the shoulder, the pan
  // swinging off his elbow on its chains; his head a stack of brass weights. He waits until he is sure, and then the
  // beam comes down and stays down on its stop: that is when he can be hit
  town: "Prudence", title: "Steady Hand", sin: "avarice", method: "the careful man's balance made a body: the beam that knows what everything weighs and says nothing; the repeated warning, turned round",
  selflie: "q.sl.signed", hinge: { after: "q_ned", when: "the night after the scale at first light" },
  arena: "returns", anchor: { name: "the lamp on the desk", key: "anchor", draw: "lamp" },
  body: { form: "prudence", defaults: { tool: "w.hammer", standing: 20, breath: 12, poise: 13, speed: 2.6, accel: 16, turn: 5, radius: 0.6, height: 2.3, grip: 8 } },
  specials: {
    // the beam comes down inside a ring that closes as it winds up
    "prudence.hammer": like("foreman.slam", { dmg: 1.5, tell: { at: [6, 41], kind: "slam" } }),
    // the pan swung low on its chains under the player
    "prudence.sweep": like("foreman.sweep", { dmg: 1.2, hits: [H([-120, 60], [0.4, 2.6], { y: [0, 0.6] })], tell: { at: [4, 25], kind: "sweep" } }),
    // the ground shakes in rings going out
    "prudence.call": like("foreman.ringslam", { dmg: 1.3 }),
  },
  phases: [
    { name: "the desk", until: 0.6, rest: 100, pattern: [step("prudence.hammer", 0, 2.4), step("prudence.sweep", 0, 2.6), step("prudence.sweep", 0, 2.6)] },
    { name: "the coats", until: 0.3, rest: 80, pattern: [step("prudence.call", 0, 3), step("prudence.hammer", 0, 2.4), step("prudence.sweep", 0, 2.6)],
      morph: { look: "coats", dim: 0.85 } },
    { name: "the eye", until: 0, rest: 60, pattern: [step("prudence.call", 0, 3), step("prudence.hammer", 0, 2.4), step("prudence.sweep", 0, 2.6), step("prudence.hammer", 0, 2.4)],
      morph: { look: "eye", bowl: 2 } },
  ],
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // put the case down: the fight does not end; the clock runs, the room empties, and at two it gives way
    yield: { lay: 60, after: 60 * 20, act: "puts the case down",
      beat: beat("q_ned", "At two the room gives way to the post road, where Tomas is there before him, stamping his feet. Ned wakes in the chair.") },
    lose: { beat: beat("q_ned", "Ned wakes on the boards by the scale with his arm twisted under him.") },
  },
  force: { ends: "fall", dc: { sum: -1 },
    beat: beat("q_office", "The man goes down across the scale's pan and does not get up. Ned wakes with his right hand aching, as if he had held it shut all night.") },
  boon: { id: "clearhand", name: "A Clear Hand", what: "his heavy blow starts two frames sooner in later inner fights", effect: { quick: 2 },
    cost: { who: "q.mott", scene: "q_office", beat: "In the next office scene Walter Mott comes to Ned before anyone else, and says why: \"You're the one that does as he's told.\"" } },
  faces: ["ned"], objects: ["Anni's scarf caught on one of its hands, if Ned kept it", "Mott's coat on the back of its chair", "an iron wedge the size of a hand"],
  lines: [
    { at: "start", voice: "sum", text: "Good man. You never made a fuss. Lovely steady hand." },
    { at: 1, voice: "sum", text: "You knew it was light before it touched the pan. Nobody can say you didn't. Nobody can say." },
    { at: 2, voice: "sum", text: "Think of the girls. Think of the coal in the shed. Then do what you like." },
    { at: "laid", voice: "sum", text: "Mott's gone home. Put it down, and you can go home too." },
  ].map((l) => ({ ...l, proposal: true })),
  senses: { look: "era 2 woodcut blacks; the coat's collar pale; the shine where the face is", sound: "a low drone in D dorian; applause from an empty room", haptic: "the hammer-fist, strong 0.4, 80 ms per landing", grammar: "the room closes on the desk" },
};

export const ONLY = {
  id: "only", n: 3, era: 2, liar: "ned", line: "furrowe", tool: "w.case",
  // WEARINESS embodied: a chairman made of eleven empty coats round a long table at noon, and the twelfth chair kept
  // for you; the light never moves. It sits the moment it can, and it gets up slowly
  trait: "knees", town: "Weariness", title: "Only", sin: "acedia", method: "the noonday demon: the sun does not move and the day is fifty hours long",
  selflie: "q.sl.add_up", hinge: { after: "q_office", when: "the night after the weighing on the square" },
  arena: "office", anchor: { name: "the clock, stopped", key: "anchor", draw: "clock" },
  body: { form: "coat", defaults: { tool: "w.hands", standing: 14, breath: 10, poise: 8, speed: 1.4, accel: 10, turn: 4, radius: 0.5, height: 1.9, grip: 5 } },
  specials: {
    // the eleven sit; the first one calls the others to their feet with a clap (a call: their next attack comes at once)
    "only.clap": { startup: 36, active: 2, recovery: 30, stamina: 1, shout: { r: 20, cool: true, poise: 2 }, armor: [0, 38, 4], tell: { at: [4, 36], kind: "shout" } },
    // a coat leans in on the body in front of it: slow, heavy, a push
    "only.press": like("sergeant.bash", { guardBreak: false, dmg: 1.0, poise: 3, armor: [0, 30, 3], tell: { at: [4, 29], kind: "swing" } }),
    "only.seat": { startup: 30, active: 2, recovery: 20, stamina: 0, summon: { n: 10, at: "chairs", form: "coat", style: "holder", def: { hp: 3, speed: 0.6, accel: 6 } }, iframes: [0, 32], tell: { at: [2, 30], kind: "shout" } },
  },
  phases: [
    { name: "the meeting", until: 0.66, rest: 120, still: true, hands: { still: true }, opening: [step("only.seat", 0, 99)], pattern: [step("only.press", 0, 1.6), step("only.clap", 0, 99)] },
    { name: "noon", until: 0.33, rest: 90, pattern: [step("only.clap", 0, 99), step("only.press", 0, 1.6)], hands: { speed: 0.35, still: false }, morph: { look: "noon" } },
    { name: "the chair", until: 0, rest: 60, pattern: [step("only.press", 0, 1.6), step("only.clap", 0, 99)], hands: { still: true }, morph: { look: "chair" } },
  ],
  // when the player strikes one, the rest clap, and noon gets longer
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  floor: 0, meantToLose: false, limit: 60 * 180,
  // the trap: endure is offered by nothing; noon has no end, and the game lets the player find that out
  trap: { endure: "noon has no end: enduring only lengthens it" },
  verbs: {
    refuse: { door: "door", beat: beat("q_office", "Ned wakes cold in his own chair with nothing changed. The weighing in the morning is the same weighing.") },
    lose: { beat: beat("q_office", "Ned wakes in the twelfth chair. The coat on it is his.") },
  },
  force: { ends: "fall", dc: { knees: -1 }, beat: beat("q_office", "The chairman goes down under the scale's arm and the coats sit back in their chairs. Ned wakes before the weighing with his knuckles split.") },
  boon: { id: "patience", name: "Patience", what: "Breath recovers faster", effect: { st: 1 },
    cost: { who: "q.mary", scene: "q_coda", beat: "At the coda Ned's speech gains one more \"only\", and Mary does not answer it; the scene holds the silence." } },
  faces: [], objects: ["eleven chairmen's coats with nobody in them", "the twelfth chair, the character's own"],
  lines: [
    { at: "start", voice: "knees", text: "You only do what they send you to do. Then you sit down." },
    { at: 1, voice: "knees", text: "It's only noon. It's been noon a while. Nobody's in a hurry." },
    { at: 2, voice: "knees", text: "Only a desk. Only till the spring. Your legs are gone, look at them." },
    { at: "end", voice: "knees", text: "Sit down. Your chair's still warm." },
  ].map((l) => ({ ...l, proposal: true })),
  senses: { look: "flat noon light, dust standing still", sound: "one bell at the start and never again; a room tone that does not change", haptic: "none: stillness is the sense", grammar: "time held: the sun and the dust stop; only the coats and the player move" },
};
