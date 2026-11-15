// The last four inner bosses (design/spine-plan/inferno/02-BESTIARY-A.md bosses 1 and 10, 03-BESTIARY-B.md bosses 8
// and 9), each a trait of the character embodied (design/TRAITS.md, 2026-10-23): VANITY as Fond of Them (era 1, Abel,
// the root), DISGUST as Under the Goats (era 2 Will, returning in era 4 for Ann as CHAFFERS OUT), COWARDICE as The Long
// Barn (era 2, returning in era 4 for Ruth) and GUILT as The Figure (era 3, Pell). Every spoken line is a
// PROPOSAL from the bestiary. Telegraphs follow COMBAT-SPEC T9. Since the rework of 2026-10-23 (the author: "Is this some sort of poetry battle?") the moves,
// phases and ground below are replaced by the real fights in combat/data/fights-a.mjs; the old rules (a blow that
// bows, digs, is swallowed or is answered with a telling; the hat as the force ending) are retired, and force is a
// fall. What stays from these records: the names, the ground, the lines (PROPOSAL) and the optional layers (refuse,
// endure, yield).
import { like, H, step, beat } from "./flaws-common.mjs";

const proposal = (ls) => ls.map((l) => ({ ...l, proposal: true }));

export const FOND = {
  id: "fond", n: 1, era: 1, liar: "abel", line: "furrowe", tool: "w.hands", trait: "pride",
  // VANITY embodied: a good hat and a good coat with nobody in them, hung on the hands' strings from the barn's beams;
  // it bows, and it needs to be struck at, because a blow it catches is a blow that looked at it
  town: "Vanity", title: "Fond of Them", sin: "pride", method: "Gregory's queen of the vices; Iblis's 'I am better than him'; a son carved to bow; the hunger to be seen made into a puppet",
  selflie: "e1.sl.fond", hinge: { after: "e1_board", when: "the night after the census board and the harvest supper's toast" },
  arena: "supper", anchor: { name: "the barn door, unpainted, propped against the wall", key: "anchor", draw: "door" },
  body: { form: "hatcoat", defaults: { tool: "w.hands", standing: 22, breath: 10, poise: 10, speed: 1.6, accel: 12, turn: 4, radius: 0.55, height: 2.0, grip: 6 } },
  specials: {
    // a plate passed down the table lands as a blow (lead 22)
    "fond.plate": like("foreman.sweep", { dmg: 1.0 }),
    // the bow it makes him make: the strings pull him down (unparryable, the grab cue, lead 34)
    "fond.bow": like("captain.drag", { dmg: 0.8, toward: "head" }),
    "fond.toast": { startup: 36, active: 2, recovery: 30, stamina: 1, shout: { r: 20, cool: true, poise: 2 }, armor: [0, 38, 4], tell: { at: [4, 36], kind: "shout" } },
  },
  phases: [
    { name: "the host", until: -1, rest: 100, pattern: [step("fond.plate", 0, 2.6), step("fond.plate", 0, 2.6), step("fond.toast", 0, 99)] },
    { name: "the strings", until: -1, rest: 80, trigger: { kind: "time", frames: 900 }, pattern: [step("fond.bow", 0.6, 4.0), step("fond.plate", 0, 2.6)], morph: { look: "strings" } },
    { name: "the offer", until: -1, rest: 140, still: true, trigger: { kind: "time", frames: 1800 }, pattern: [step("fond.plate", 0, 2.6)], morph: { look: "offer" } },
  ],
  // every blow becomes a bow, and the bow heals it: courtesy cannot be beaten by force, only taken on
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  floor: 0.5, meantToLose: false, limit: 60 * 180,
  verbs: {
    refuse: { door: "door", beat: beat("e1_board", "He wakes cold in the loft. The hands are still in the yard.") },
    endure: { rounds: 3, beat: beat("e1_board", "The hat is left on the table at the head of the supper, nobody's. He did not bow.") },
    lose: { beat: beat("e1_board", "He wakes at the long table with his head down, as if he had bowed and stayed bowed.") },
  },
  force: { ends: "fall", dc: { pride: -1 }, beat: beat("e1_board", "The host goes down among his own plates. He wakes with the good hat on his head, and the hat goes down the line.") },
  boon: { id: "goodhat", name: "The Good Hat", what: "poise up: the first blow of a flurry does not move him", effect: { poise: 3 },
    cost: { who: "q.ilo", scene: "e1_board", beat: "At the supper's second sitting Ilo Haldane is not asked in, and eats in the yard with his plate on his knees; through the window the player sees it." } },
  faces: ["abel"], objects: ["the good hat", "the long table and the carving knife at its head", "a young man singing in the yard, never seen"],
  lines: proposal([
    { at: "start", voice: "pride", text: "Sit down, sit down. There's plenty. There's always plenty if people are sensible." },
    { at: 1, voice: "pride", text: "They're fond of you, the hands. Every one of them. Swing at me, go on. They're all watching." },
    { at: 2, voice: "pride", text: "There. You see? You bow lovely. Your father bowed lovely." },
    { at: "bow", voice: "pride", text: "I had one in my loft all winter. Ask him. He'll tell you what I am." },
  ]),
  senses: { look: "harvest lamplight on a long table; the hat's line across his forehead", sound: "a warm man of sixty-three; the hat's rising fourth; in the yard, Ilo singing", haptic: "a soft pull at each bow, weak 0.15", grammar: "a blow becomes a bow" },
};

export const GOATS = {
  id: "goats", n: 8, era: 2, liar: "will", line: "brack", tool: "w.stick", trait: "smell",
  // DISGUST embodied: a low heavy thing of wet fleece and soot crouched in a mud fold, a dragon on a hoard it dreamed;
  // it fouls the ground and comes up under you, and it cannot stand you close
  town: "Disgust", title: "Under the Goats", sin: "envy", method: "Fafnir turned round: envy imagines the hoard in the neighbour, and the one who digs for it becomes the dragon",
  // era 4's return for Ann (CHAFFERS OUT) is the tagged lie; Will's era 2 line is still a NEW LINE
  selflie: "e4.sl.goats", pending: { kind: "NEW LINE", voice: "smell", text: "You can smell it on the wind. Fat and grain. They're sitting on it." },
  hinge: { after: "e4_night", when: "the night after the picket (Ann); for Will, the night after the weighing, once his line is written" },
  arena: "fold", anchor: { name: "a lantern on the bare rock of the fold", key: "anchor", draw: "lamp" },
  body: { form: "hoard", defaults: { tool: "w.hands", standing: 26, breath: 10, poise: 99, speed: 1.0, accel: 8, turn: 4, radius: 0.7, height: 1.6, grip: 8 } },
  specials: {
    // the grain glow rises under him and comes down as a weight (unparryable, ring cue, lead 36)
    "goats.heave": like("foreman.slam", { dmg: 1.1 }),
    // a sack swung (lead 26)
    "goats.swing": like("sergeant.bash", { dmg: 1.0 }),
  },
  phases: [
    { name: "the fold", until: -1, rest: 120, pattern: [step("goats.heave", 0, 3.0)] },
    { name: "the hoard", until: -1, rest: 80, trigger: { kind: "load", n: 3 }, pattern: [step("goats.heave", 0, 3.0), step("goats.swing", 0.4, 2.6)], morph: { look: "hoard" } },
    { name: "the dragon", until: -1, rest: 60, trigger: { kind: "load", n: 6 }, pattern: [step("goats.swing", 0.4, 2.6), step("goats.heave", 0, 3.0)], morph: { look: "dragon", dim: 0.85 } },
  ],
  // every blow digs: a sack comes up out of the snow, and another fuses to his back
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  floor: 0.5, meantToLose: false, limit: 60 * 180,
  verbs: {
    // put the spade down and stand on the bare rock by the lantern, under its blows
    yield: { lay: 60, act: "puts the spade down and stands on the rock", follow: { kind: "stand", at: "anchor", reach: 1.4, hold: 120 },
      beat: beat("e4_night", "The glow goes out. He stands on rock in the snow, with the goats coming back round him one at a time.") },
    lose: { beat: beat("e4_night", "He wakes with the taste of frozen earth in his mouth and his hands raw.") },
  },
  force: { ends: "fall", dc: { smell: -1 }, beat: beat("e4_night", "He wakes curled on a heap that was never there, his back bent under it. The hill stinks of fat. They were sitting on it.") },
  boon: { id: "nose", name: "The Nose", what: "telegraphs read sooner: every foe's tell starts four frames earlier in later inner fights", effect: { nose: 4 },
    // era 4 is the only run that arms this fight today, so the cost lands on the Row; Will's era 2 cost, for when his
    // line is written: "The next time Will passes the hill, Dorrah Tesk turns a child's face away from him with her hand." (q.dorrah, q_will)
    cost: { who: "e4.mira", scene: "e4_night", beat: "The next time Ann walks the Row, Mira Saro turns Teo's face away from her with her hand." } },
  faces: ["will", "ann"], objects: ["the bare rock under the snow", "goats that scatter and are never enemies", "sacks heaped on his back"],
  lines: proposal([
    { at: "start", voice: "smell", text: "There. Under the fold. Smell it?" },
    { at: 1, voice: "smell", text: "That's them. That's how they live. You'll have it in your coat for a week." },
    { at: 2, voice: "smell", text: "Dig. It's not stealing if it was always ours. Wash your hands after." },
  ]),
  senses: { look: "snow at night, a glow of grain where he looks", sound: "wind; a spade in frozen ground; grain pouring where it cannot be", haptic: "a weight settling, per sack", grammar: "what he looks for appears" },
};

export const BARN = {
  id: "barn", n: 9, era: 2, liar: "the line", line: "both", tool: "w.stick", trait: "smallprint",
  // COWARDICE embodied: a long barn that walks on its own beams, its doors always open on the far side, so you never
  // see its front; it runs, and it runs head first into the walls it was running from
  town: "Cowardice", title: "The Long Barn", sin: "avarice", method: "Erysichthon: a hunger that grows the more it eats, until it eats itself",
  selflie: "e4.sl.barn", pending: { kind: "NEW LINE", voice: "smallprint", text: "It's the Company's grain. It was never ours to give." },
  hinge: { after: "e4_town", when: "the night after the board and the walk (Ruth); in era 2 the night after the granary door, once the line is written" },
  arena: "granary", anchor: { name: "one sack left by the chute", key: "anchor", draw: "lamp" },
  body: { form: "barn", defaults: { tool: "w.hands", standing: 22, breath: 12, poise: 99, speed: 0.8, accel: 6, turn: 3, radius: 0.9, height: 2.6, grip: 10 } },
  specials: {
    // the chute's drag toward its throat (unparryable, grab cue, lead 34)
    "barn.drag": like("warden.drag", { toward: "throat", dmg: 1.2 }),
    // a rib comes down (unparryable, ring cue, lead 36)
    "barn.rib": like("foreman.slam", { dmg: 1.2 }),
  },
  phases: [
    { name: "the barn", until: 0.6, rest: 100, pattern: [step("barn.drag", 0.6, 4.5), step("barn.rib", 0, 3.0)] },
    { name: "the whistle", until: 0.3, rest: 80, trigger: { kind: "time", frames: 900 }, eat: { every: 150, most: 6 }, pattern: [step("barn.rib", 0, 3.0), step("barn.drag", 0.6, 4.5)], morph: { look: "whistle" } },
    { name: "itself", until: 0, rest: 60, pattern: [step("barn.drag", 0.6, 4.5), step("barn.rib", 0, 3.0), step("barn.drag", 0.6, 4.5)], morph: { look: "itself", scale: 0.85 } },
  ],
  // every blow is swallowed: it eats a third of it back, and the third blow takes the tool that struck it
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // stand in the throat and do not feed it
    endure: { stand: { anchor: "throat", r: 1.4, every: 300 },
      beat: beat("e4_mill", "The whistle stops. He is left in an empty barn with one sack at his feet.") },
    lose: { beat: beat("e4_mill", "He wakes in the chute's dust with his pockets turned out.") },
  },
  force: { ends: "fall", dc: { smallprint: -1 }, beat: beat("e4_mill", "When it falls the barn and the train go down with it. The dust hangs a long time after, and nobody comes to look.") },
  boon: { id: "crust", name: "A Crust", what: "Breath up", effect: { st: 1 },
    cost: { who: "q.tesk", scene: "e4_mill", beat: "The next morning's queue scene shows the Tesks at the back of it, and nobody makes room." } },
  faces: [], objects: ["the chute for a throat", "the export train its gut", "one sack left by the chute"],
  lines: proposal([
    { at: "start", voice: "smallprint", text: "It's the Company's grain. It was never ours to give." },
    { at: 1, voice: "smallprint", text: "Not your street. Not your sign. You were only holding the box." },
    { at: 2, voice: "smallprint", text: "It was his can. He'd have sprayed it somewhere whatever you did." },
    { at: "end", voice: "smallprint", text: "Nobody lifted one. Nobody ever lifts one." },
  ]),
  senses: { look: "roof ribs, the chute, the train's gut out of the arena's end", sound: "his own voice reading the steward's verse; the train's wheel-joint through the floor", haptic: "a pull toward the chute", grammar: "it eats what strikes it" },
};

export const FIGURE = {
  id: "figure", n: 10, era: 3, liar: "pell", line: "furrowe", tool: "w.stick", trait: "carbon",
  // GUILT embodied: a stooped figure stitched from sacking and twine with Ned's coat across it, a frosted window where
  // its face should be; it fights with the player's own last string, because guilt is the past done again
  town: "Guilt", title: "The Figure", sin: "the maker's abandonment; false witness inherited", method: "Frankenstein: the thing a father made and would not look at, which turns his son's own blows back on him",
  selflie: "e3.sl.figure", hinge: { after: "e3_town", when: "the night after the keys at the allocation office" },
  arena: "survey", anchor: { name: "the lamp over Pell's drawing board", key: "anchor", draw: "lamp" },
  body: { form: "figure", defaults: { tool: "w.hands", standing: 30, breath: 12, poise: 14, speed: 1.4, accel: 10, turn: 4, radius: 0.55, height: 2.4, grip: 8 } },
  specials: {
    // it asks: no blow
    "figure.jab": { startup: 40, active: 2, recovery: 60, stamina: 0, tell: null },
    // the answer to a blow: an open hand (parryable, lead 22)
    "figure.hook": like("foreman.sweep", { dmg: 1.0 }),
    // on the ice, the chase: it grabs (unparryable, grab cue, lead 34)
    "figure.grab": like("captain.drag", { dmg: 1.3, toward: "anchor" }),
  },
  phases: [
    { name: "the visitor", until: -1, rest: 150, still: true, pattern: [step("figure.jab", 0, 99)] },
    { name: "the river", until: -1, rest: 90, pattern: [step("figure.hook", 0, 2.6), step("figure.jab", 0, 99)], morph: { look: "river" } },
    { name: "the ice", until: -1, rest: 70, pattern: [step("figure.grab", 0.6, 4.0), step("figure.hook", 0, 2.6)], morph: { look: "ice", frost: true, dim: 0.8 } },
  ],
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // survive three of its rounds without a blow: it stops answering him
    endure: { rounds: 3, beat: beat("e3_town", "At the end it sits down on the ice and stops answering him. Pell is left standing on the river with his father's coat over his arm.") },
    lose: { beat: beat("e3_town", "Pell wakes at his drawing board with his fist shut, and keeps his careful father.") },
  },
  force: { ends: "fall", dc: { carbon: -1 }, beat: beat("e3_town", "It goes through the ice and does not come up. Pell wakes with his hands cold, still defending his father's name.") },
  boon: null,
  faces: [], objects: ["Ned's coat across its shoulders", "stitches of twine and sacking", "a face left unfinished"],
  lines: proposal([
    { at: "start", voice: "carbon", text: "Your father made me in an afternoon. He wouldn't look at me after." },
    { at: 1, voice: "carbon", text: "You did it like this. Then like this. Watch. I'll show you." },
    { at: 2, voice: "carbon", text: "Hit me, then. You hit like him. Same hand." },
    { at: "end", voice: "carbon", text: "Stay a minute. Sit with me. He never would." },
  ]),
  senses: { look: "a tall stooped figure stitched from sacking and twine, Ned's coat across it; then the river ice", sound: "slow, heavy breath; one low string; wind on ice", haptic: "a jolt when it answers in kind", grammar: "the player's own string comes back at him" },
};
