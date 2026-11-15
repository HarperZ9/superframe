// The three traits that had no body before the traits pass (design/TRAITS.md, 2026-10-23): JEALOUSY, DREAD and SHAME.
// Each is a lesser being, like Nobody Checks: never armed at a hinge of its own, met only in the Descent, where the
// gate of its compartment fights as it when it is the trait the run fed most (combat/arena/descent.mjs). The moves,
// phases and body numbers are the real fights in combat/data/fights-c.mjs, laid over these records by flaws.mjs. Every
// spoken line is a PROPOSAL for the author; the self-lies are NEW LINES not yet in the scenes.
import { beat } from "./flaws-common.mjs";

const proposal = (ls) => ls.map((l) => ({ ...l, proposal: true }));
const descent = { after: null, descent: true, when: "the Descent only, inside its compartment's gate" };

export const JEALOUSY = {
  id: "jealousy", n: 14, era: 5, liar: "the line", line: "both", tool: "w.stick", lesser: true, trait: "chit",
  // JEALOUSY embodied: a hoarding fence that walks, one eye in a hole cut at eye height, long arms over the top
  town: "Jealousy", title: "Two Rooms and a Tap", sin: "envy", method: "the evil eye: the one who looks through the fence at what the other has, and the look that spoils it",
  selflie: "e5.sl.jealousy", pending: { kind: "NEW LINE", voice: "chit", text: "Two rooms and a tap. They got two rooms and a tap, and they've not been here five minutes." },
  hinge: descent, arena: "street", anchor: { name: "the square's cobbles under Mill Street", key: "anchor", draw: "cobbles" },
  body: { form: "jealousy", defaults: { tool: "w.hands", standing: 24, breath: 12, poise: 12, speed: 2.2, accel: 14, turn: 3, radius: 0.6, height: 2.3, grip: 8 } },
  specials: {}, phases: [], strike: [], floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // stand at its side, out of its eye, without striking: it looks for you through the hole, and stops
    endure: { stand: { anchor: "anchor", r: 1.4, every: 240 }, beat: beat("e5_day", "The fence stands in the street with its hole on nothing. He walks round it.") },
    lose: { beat: beat("e5_day", "He wakes at the window with the curtain held back an inch, looking at next door's van.") },
  },
  force: { ends: "fall", dc: { chit: -1 }, beat: beat("e5_day", "The boards come down flat in the road, and behind them is only the street, the same as his.") },
  boon: null,
  faces: [], objects: ["a hoarding fence with a hole cut at eye height", "an eye in the hole", "arms long enough to reach over"],
  lines: proposal([
    { at: "start", voice: "chit", text: "Look at his coat. Look at the tap. Two rooms and a tap." },
    { at: 1, voice: "chit", text: "You'd have done more with it. You know you would." },
    { at: 2, voice: "chit", text: "Who said he could have that? Who said?" },
    { at: "end", voice: "chit", text: "It should have been yours. All of it." },
  ]),
  senses: { look: "raw boards, one eye wet in the hole, the street's sodium on the boards' edges", sound: "a board creaking as it leans; breathing behind the fence", haptic: "a tug, weak 0.2, each time it takes", grammar: "it sees one thing through one hole" },
};

export const DREAD = {
  id: "dread", n: 15, era: 2, liar: "the line", line: "both", tool: "w.stick", lesser: true, trait: "dark",
  // DREAD embodied: a black door frame walking in a long coat, the door open on nothing; every blow is a wait
  town: "Dread", title: "Coming Up the Stairs", sin: "flight from the field", method: "the night-hag on the chest; the thing on the stair that the child hears and the adult still hears",
  selflie: "q.sl.dread", pending: { kind: "NEW LINE", voice: "dark", text: "You've seen that table. That's where this is going, and you knew it before you sat down." },
  hinge: descent, arena: "road", anchor: { name: "the lantern on the hut door", key: "anchor", draw: "lamp" },
  body: { form: "dread", defaults: { tool: "w.hands", standing: 22, breath: 12, poise: 9, speed: 1.9, accel: 11, turn: 4, radius: 0.55, height: 2.5, grip: 8 } },
  specials: {}, phases: [], strike: [], floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // stand by the lantern and let the waits run out, every one of them, without striking
    endure: { rounds: 4, beat: beat("e5_day", "The door stands open in the snow with nothing in it. Nothing came. He goes in.") },
    lose: { beat: beat("e5_day", "He wakes sitting up, his back to the headboard, listening to the stairs.") },
  },
  force: { ends: "fall", dc: { dark: -1 }, beat: beat("e5_day", "The frame goes over in the snow, and what was behind the door was the road.") },
  boon: null,
  faces: [], objects: ["a door frame with the door open on black", "a long coat on no shoulders", "the road post's lantern"],
  lines: proposal([
    { at: "start", voice: "dark", text: "You've seen that table. That's where this is going." },
    { at: 1, voice: "dark", text: "Not yet. Not yet. Count yours. Anni. Aaron by the lamp post." },
    { at: 2, voice: "dark", text: "It's on the stairs. You can hear it. It's been on the stairs since you were six." },
    { at: "end", voice: "dark", text: "It'll come when you're not looking. It always does." },
  ]),
  senses: { look: "a door's black oblong in the snow light, the lantern behind it", sound: "a stair creaking under a weight that never arrives; the player's own heart", haptic: "a heartbeat, weak 0.15, quickening through each wait", grammar: "the wait is longer than the blow" },
};

export const SHAME = {
  id: "shame", n: 16, era: 3, liar: "the line", line: "both", tool: "w.stick", lesser: true, trait: "undertow",
  // SHAME embodied: a hunched figure in wet sheets, its face turned away over its shoulder; it pulls you in
  town: "Shame", title: "Put Your Hand in Your Lap", sin: "concealment", method: "the drowned washerwoman of the ford who washes the shroud of the one who sees her; the undertow",
  selflie: "q.sl.shame", pending: { kind: "NEW LINE", voice: "undertow", text: "Your hand's shaking. Put it in your lap. Nobody saw." },
  hinge: descent, arena: "kitchen", anchor: { name: "the table", key: "anchor", draw: "table" },
  body: { form: "shame", defaults: { tool: "w.hands", standing: 24, breath: 12, poise: 12, speed: 2.2, accel: 13, turn: 3.2, radius: 0.6, height: 2.2, grip: 9 } },
  specials: {}, phases: [], strike: [], floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // take its pull and its sheets without striking back, round after round: it lets go of you
    endure: { rounds: 4, beat: beat("e5_day", "The sheets go slack on the kitchen floor, a heap of washing. He sits down at the table with his hands on it.") },
    lose: { beat: beat("e5_day", "He wakes wet through with the blanket over his face.") },
  },
  force: { ends: "fall", dc: { undertow: -1 }, beat: beat("e5_day", "The sheets come away in his hands and there is a face under them, and he looks at it.") },
  boon: null,
  faces: [], objects: ["wet sheets wound round a hunched back", "a face turned away over the shoulder", "water on the kitchen floor"],
  lines: proposal([
    { at: "start", voice: "undertow", text: "Your hand's shaking. Put it in your lap." },
    { at: 1, voice: "undertow", text: "He thanked you. He'll thank people for the rest of his life." },
    { at: 2, voice: "undertow", text: "Don't look at me. Don't. Come here, then. Closer." },
    { at: "end", voice: "undertow", text: "Nobody saw. Nobody has to." },
  ]),
  senses: { look: "grey wet sheets in lamplight, water spreading on the boards", sound: "dripping; a wrung cloth; a breath held", haptic: "a slow pull, low 0.25, while it drags", grammar: "it will not face you" },
};
