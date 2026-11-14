// Will Brack's line, era 2 (design/spine-plan/inferno/03-BESTIARY-B.md section 1), each a trait of his embodied
// (design/TRAITS.md, 2026-10-23): OBEDIENCE as Forty Carts (boss 4), APPETITE as Friday (boss 5), TENDERNESS as He's
// With Me (boss 6, the Golem), NERVE as Nearest One (boss 7, the Minotaur) and CONTEMPT as Nobody Checks (lesser). Every spoken line is a
// PROPOSAL from the bestiary. He's With Me and Nearest One wait on NEW LINE self-lies (inferno/03), under the
// dialogue gate (DECISIONS 6): their `pending` lines are not in the scenes yet.
import { like, H, step, beat } from "./flaws-common.mjs";

const proposal = (ls) => ls.map((l) => ({ ...l, proposal: true }));

export const FORTY = {
  id: "forty", n: 4, era: 2, liar: "will", line: "brack", tool: "w.stick", trait: "ballast",
  // OBEDIENCE embodied: a man who is the road barrier, his arm the striped pole hinged at his hip, a lantern where his
  // head should be; he strikes only along the line his arm points, and the carts come when he whistles
  town: "Obedience", title: "Forty Carts", sin: "fear in the uniform of duty", method: "Mara's army: a host that cannot be beaten by counting, and goes when it is seen for what it is",
  selflie: "q.sl.forty_carts", hinge: { after: "q_will", when: "the night after the road post" },
  arena: "road", anchor: { name: "the lantern on the hut door", key: "anchor", draw: "lamp" },
  body: { form: "pole", defaults: { tool: "w.boathook", standing: 30, breath: 12, poise: 12, speed: 2.8, accel: 16, turn: 6, radius: 0.55, height: 2.4, grip: 8 } },
  specials: {
    "forty.hook": like("warden.hook", { dmg: 0.8 }),
    // the drag toward the district line (08-ARENA's Pole)
    "forty.drag": like("warden.drag", { toward: "line", dmg: 1.2 }),
    "forty.thrust": like("warden.thrust", { dmg: 1.2 }),
    // at half it whistles, and carts come up out of the dip in the road: carts and horses only, never people
    "forty.whistle": { startup: 36, active: 2, recovery: 30, stamina: 1, summon: { n: 2, at: "dip", form: "cart", style: "hound", def: { hp: 3 } }, armor: [0, 38, 6], tell: { at: [4, 36], kind: "shout" } },
  },
  phases: [
    // it does not attack until the player comes near
    { name: "the pole", until: 0.5, rest: 96, still: true, pattern: [step("forty.hook", 0, 4.0), step("forty.drag", 0.6, 4.0), step("forty.thrust", 0.6, 3.4)] },
    { name: "the host", until: 0, rest: 70, opening: [step("forty.whistle", 0, 99)], pattern: [step("forty.hook", 1.8, 5.0), step("forty.drag", 0.6, 4.0), step("forty.whistle", 0, 99), step("forty.thrust", 0.6, 3.4)],
      morph: { look: "host" } },
  ],
  strike: [],
  floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // lift the pole, then walk through its drag without striking until it lets go (08-ARENA); the one cart goes by
    yield: { lay: 60, act: "lifts the pole", follow: { kind: "outlast", move: "forty.drag", n: 2 },
      beat: beat("q_will", "The host thins to one cart on the road, far off, and it goes by. Nothing in the day's outcome changes.") },
    lose: { beat: beat("q_will", "Will wakes in the hut with Holt's order still in his ears.") },
  },
  force: { ends: "fall", dc: { ballast: -1 }, beat: beat("q_will", "The post held. When the last cart turns, the dust settles on one cart turned back.") },
  boon: { id: "ballast", name: "Ballast", what: "grabs no longer knock the character down", effect: { keepFeet: true },
    cost: { who: "q.aaron", scene: "q_will", beat: "At the next day scene Aaron, at the horse's head, looks at Will, and Will looks at the brazier." } },
  faces: ["will"], objects: ["Will's hands on the pole", "a brown coat with the cuffs turned back, on the arrest route", "the Haldane cart, far off, never fought"],
  lines: proposal([
    { at: "start", voice: "ballast", text: "One cart. Then forty. Then there's no post. There's you on a road." },
    { at: 1, voice: "ballast", text: "You don't make the rule. You hold the rope. Look at them all. You can't stop them, can you." },
    { at: "laid", voice: "ballast", text: "Go on, pick it back up. Your hands don't know what to do with themselves." },
  ]),
  senses: { look: "snow, the road in era 2's cold ink broken where frost lies", sound: "the drag motif; layered wheels that build as loops; then one set of wheels and a girl's voice too far to make out", haptic: "the export train's wheel-joint pulse, weak, rising with the host", grammar: "the crowd that repeats, carts only" },
};

// a father's blow: every tell is drawn on the north wall as a boy's shoulders coming up round his ears
const shadow = (at) => ({ at, kind: "shadow" });
export const FRIDAY = {
  id: "friday", n: 5, era: 2, liar: "will", line: "brack", tool: "w.stick", trait: "grip",
  // APPETITE embodied: the father bent under the kitchen ceiling, too big for the room, mouth open, hands longer than
  // the table; Saturn at his son. Everything it does is a reach, and a reach leaves it open
  town: "Appetite", title: "Friday", sin: "wrath", method: "Kronos and Goya's Saturn: the father too big for the room; scale and eyes only, nothing eaten",
  selflie: "q.sl.never_hand", hinge: { after: "q_dinner", when: "the night after the Brack table" },
  arena: "kitchen", anchor: { name: "the table", key: "anchor", draw: "table" },
  body: { form: "father", defaults: { tool: "w.hands", standing: 34, breath: 12, poise: 14, speed: 2.4, accel: 14, turn: 5, radius: 0.6, height: 2.4, grip: 9 } },
  specials: {
    "friday.backhand": like("foreman.sweep", { dmg: 1.3, tell: shadow([4, 25]) }),
    "friday.slam": like("foreman.slam", { dmg: 1.5, tell: shadow([6, 41]) }),
    "friday.reach": like("warden.drag", { toward: null, dmg: 1.0, knockdown: false, knock: -2.5, tell: shadow([6, 39]) }),
    // Saturn: bent at the waist to fit the ceiling, the blow comes down over the whole table
    "friday.overhead": like("foreman.ringslam", { dmg: 1.4, tell: shadow([6, 41]) }),
    // the arm (Never Once): it holds and leans, and never strikes first: it reaches only a body that comes under it
    // unparryable on purpose (a weight leant on him, not a blow to answer), so its tell leads by 30 frames (T9, wave 1;
    // was 26 until 2026-10-23: startup 30 to 34, the shadow from frame 4 to 33)
    "friday.lean": { startup: 34, active: 10, recovery: 26, stamina: 0, dmg: 0.9, poise: 2, hits: [H([-30, 30], [0, 1.4])], blockable: false, parryable: false, drain: 1, knock: 0, hitstop: 6, shake: 0.2, tell: shadow([4, 33]), track: 6 },
  },
  phases: [
    { name: "the father", until: 0.5, rest: 100, pattern: [step("friday.backhand", 0, 2.6), step("friday.reach", 0.6, 4.0), step("friday.slam", 0, 2.4)] },
    { name: "Saturn", until: 0, rest: 70, pattern: [step("friday.overhead", 0, 3.0), step("friday.backhand", 0, 2.6), step("friday.reach", 0.6, 4.0)],
      morph: { look: "saturn", scale: 1.7, dark: true, lights: [{ x: 8, z: 4.5, r: 3.6, k: 0.62 }] } },
    // if the player stops striking for four seconds, the father becomes the arm
    { name: "the arm", until: -1, rest: 50, still: true, trigger: { kind: "still", frames: 240, from: 360 }, pattern: [step("friday.lean", 0, 1.3)],
      morph: { look: "arm", scale: 1.2, dark: true, lights: [{ x: 8, z: 4.5, r: 5, k: 0.55 }] } },
  ],
  // every blow the player lands is answered off screen by a boy's sharp breath in; never in the arm's phase
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  // meant to be lost: it cannot be brought down. At its floor three more blows turn the coat (force, the lie
  // shown false by the player's own hands); its true end is to go under the arm
  floor: 0.2, meantToLose: true, limit: 60 * 180,
  verbs: {
    lose: { lay: true, act: "lays the guard down and goes under the arm",
      beat: beat("q_dinner", "Davey's shoulders, up round his ears, and Edie pulling her sleeve over her wrist.") },
  },
  force: { ends: "floor", atFloor: 3, dc: { grip: -1 },
    beat: beat("q_dinner", "The father falls, the coat turns, and the back of it is Will's. The kitchen dissolves to the table: Davey's shoulders up round his ears.") },
  boon: { id: "friday", name: "Friday", what: "heavy blows land harder", effect: { heavy: 0.2 },
    cost: { who: "q.davey", scene: "q_dinner", beat: "At the next Brack table Davey has moved his chair one place further from Will, and nobody mentions it." } },
  // Will's father is of his own line (Josh, era 1), faceless, in Will's coat; Davey is a shadow and a breath
  faces: ["josh"], objects: ["Will's coat", "Davey as a shadow on the wall and a breath", "Edie's sleeve"],
  lines: proposal([
    { at: "start", voice: "grip", text: "It's Friday. You know what Friday is." },
    { at: 1, voice: "grip", text: "I never once did it for nothing. Name me one time it was for nothing." },
    { at: 2, voice: "grip", text: "You're the same. Look at your hand. Look where it is. It's on the bread again." },
  ]),
  senses: { look: "the kitchen stretched tall into dark; only the lamp and the eyes lit", sound: "the drag motif at half speed; a boy's sharp breath answering each landed blow; no music in the arm's phase", haptic: "one strong 0.5 pulse when the player's blow lands, none when the father's does", grammar: "scale out of true: the father to the ceiling" },
};

export const WITHME = {
  id: "withme", n: 6, era: 2, liar: "will", line: "brack", tool: "w.stick", trait: "condolence",
  // TENDERNESS embodied: a clay giant that walks beside you with its arm round your shoulders and a word cut in its
  // brow; its chest is a cell door. It holds, and the hold is the attack
  town: "Tenderness", title: "He's With Me", sin: "pride that calls custody care", method: "the Golem: clay given life by one word on the brow, ended only when its maker erases what he wrote",
  selflie: "q.sl.with_me", pending: { kind: "NEW LINE", voice: "condolence", text: "He's safer with you than with Gedge. Take him yourself. Then he's with you." },
  hinge: { after: "q_week", when: "the night after the yard, on the route where Will takes the boy himself" },
  arena: "yard", anchor: { name: "the coat on its nail, behind the chest door", key: "anchor", draw: "coat" },
  body: { form: "golem", word: "HELD", defaults: { tool: "w.hands", standing: 30, breath: 12, poise: 16, speed: 2.0, accel: 12, turn: 4, radius: 0.65, height: 2.6, grip: 10 } },
  specials: {
    "withme.fist": like("foreman.slam", { dmg: 1.4 }),
    "withme.sweep": like("foreman.sweep", { dmg: 1.2 }),
    "withme.hold": like("warden.drag", { toward: "cell", dmg: 1.0 }),
  },
  phases: [
    // the guard: it walks beside the player and fights the dark of the yard for him; it never strikes him
    { name: "the guard", until: -1, rest: 120, still: true, pattern: [step("withme.fist", 0, 0.01)] },
    // it turns: it stands between the player and its own chest door; after eight seconds, or the first blow
    { name: "the cell", until: -1, rest: 90, trigger: { kind: "time", frames: 480, struck: true }, pattern: [step("withme.fist", 0, 2.4), step("withme.sweep", 0, 2.6), step("withme.hold", 0.6, 4.0)], morph: { look: "cell" } },
    // the walls: every blow added clay; it is the cell's walls now
    { name: "the walls", until: -1, rest: 60, trigger: { kind: "grown", scale: 1.5 }, pattern: [step("withme.fist", 0, 2.6), step("withme.hold", 0.6, 4.0), step("withme.sweep", 0, 2.8)], morph: { look: "walls", bowl: 1 } },
  ],
  // every blow adds clay: it heals what the blow took and grows; at 2.25 times its size it fills the arena
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  floor: 0.5, meantToLose: false, limit: 60 * 180,
  verbs: {
    // reach its brow under its blows and rub the word out with a wet thumb: a held action that costs standing
    yield: { lay: 60, act: "rubs the word out", follow: { kind: "rub", at: "brow", reach: 1.9, hold: 150, from: 1 },
      beat: beat("q_cells", "The word goes and leaves a shine. The clay falls; the coat is on its nail. In the cells the boy is still there.") },
    lose: { beat: beat("q_cells", "Will wakes with clay under his nails, in the yard.") },
  },
  force: { ends: "grown", dc: { condolence: -1 }, beat: beat("q_cells", "It fills the yard and the door shuts. He is with Will, in the cells.") },
  boon: { id: "clay", name: "Clay", what: "two more standing", effect: { hp: 2 },
    cost: { who: "q.tomas", scene: "q_discourse", beat: "At the Crown a man tells the bar about \"a Hesh lad with a knife at the post\", and stands Will a drink for it. Will drinks it. Text only, never an image." } },
  faces: ["will"], objects: ["a Tarn word cut into the brow", "the cell's iron door for a chest", "an empty brown coat on a nail"],
  lines: proposal([
    { at: "start", voice: "condolence", text: "He's with me. He's all right. He's with me." },
    { at: 1, voice: "condolence", text: "Come here. You're freezing. Nobody touches him but me." },
    { at: 2, voice: "condolence", text: "Where is he, then. Where've I put him." },
  ]),
  senses: { look: "wet clay against snow; the cut word darker than anything near it", sound: "silence from the clay; Will's voice from inside it; snow sliding off its shoulders", haptic: "weak 0.2 grains under the rub, like rubbing paper", grammar: "the empty place laid, inverted: a coat on a nail where a boy should be" },
};

export const NEAREST = {
  id: "nearest", n: 7, era: 2, liar: "will", line: "brack", tool: "w.stick", trait: "salt",
  // NERVE embodied: a bull in a greatcoat in the granary's maze, head down, the will to go first made into a charge;
  // it goes at everything, and the stacks it hits stun it
  town: "Nerve", title: "Nearest One", sin: "taking part in killing a soul unjustly", method: "the Minotaur in Daedalus's maze; Ariadne's thread out",
  selflie: "q.sl.nearest", pending: { kind: "NEW LINE", voice: "salt", text: "If you don't walk him, the guard will. Same boy. Same door. At least it's you." },
  hinge: { after: "q_granary", when: "the night after the granary, on the militia route where Holt sends Will to the wicket" },
  arena: "maze", anchor: { name: "the thread in the hand", key: "anchor", draw: "thread" },
  body: { form: "beast", defaults: { tool: "w.hands", standing: 30, breath: 12, poise: 13, speed: 3.0, accel: 18, turn: 6, radius: 0.55, height: 2.3, grip: 9 } },
  specials: {
    // head down down the corridor: a charge that dazes it when it meets the sacks
    "nearest.charge": like("foreman.charge", { dmg: 1.3 }),
    "nearest.gore": like("warden.thrust", { dmg: 1.4, tell: { at: [4, 21], kind: "swing" } }),
    "nearest.horns": like("foreman.sweep", { dmg: 1.2 }),
    "foreman.dazed": like("foreman.dazed"),
  },
  phases: [
    { name: "the maze", until: 0.6, rest: 90, pattern: [step("nearest.charge", 3.0, 12, { back: true }), step("nearest.gore", 0.6, 3.4)] },
    { name: "the beast", until: 0.3, rest: 70, pattern: [step("nearest.charge", 3.0, 12, { back: true }), step("nearest.gore", 0.6, 3.4), step("nearest.horns", 0, 2.6)], morph: { look: "beast" },
      voice: { voice: "holt", human: true, text: "Nearest one, Sergeant." } },
    // the maze opens on the wicket; the beast stands in the gap, and it is the player's own shape
    { name: "the gap", until: 0, rest: 50, trigger: { kind: "near", anchor: "wicket", r: 5 }, pattern: [step("nearest.gore", 0.6, 3.4), step("nearest.horns", 0, 2.6), step("nearest.charge", 3.0, 12, { back: true })], morph: { look: "gap" } },
  ],
  strike: [],
  floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // open the hand and let the thread go: the beast passes the player by, and the maze fades with him inside
    yield: { lay: 60, after: 360, act: "opens the hand and lets the thread go", passes: "wicket",
      beat: beat("q_granary", "The maze fades with Will still inside it. In the world the guard takes the same boy; nothing changes.") },
    lose: { beat: beat("q_granary", "Will wakes on the sacks with his hand shut on nothing.") },
  },
  force: { ends: "fall", dc: { salt: -1 }, beat: beat("q_granary", "He kills the beast at the gap and steps through the wicket: the thread's other end was there all along. It was him, and the guard was never needed.") },
  boon: { id: "wayout", name: "The Way Out", what: "exits and doors show in later inner arenas", effect: { ways: true },
    cost: { who: "q.edie", scene: "q_lore", beat: "When Edie dries Will's boots after the burial she finds a blue thread in his pocket and puts it on the mantel. Neither of them says anything." } },
  // the thread is never shown on a wrist; no child is in the maze; Holt is a voice from outside, never shown
  faces: ["will"], objects: ["Will's militia greatcoat", "the thread, never on a wrist", "sacks with the export company's black horse stencilled on them"],
  lines: proposal([
    { at: "start", voice: "salt", text: "Hold on to it. It's the only way out of here." },
    { at: 1, voice: "salt", text: "Go first. Somebody has to go first, and it's always you." },
    { at: 2, voice: "salt", text: "Same boy. Same door. At least it's you." },
  ]),
  senses: { look: "stacked sacks in lamp light, stencils crisp; corridors at the camera's height", sound: "Holt's voice from outside, human and dry; the Hesh water idiom thinning to one voice as the thread runs out", haptic: "none while walking; one strong 0.6 hit at the wicket bar", grammar: "scale out of true: the granary larger inside than out" },
};

// A lesser flaw, in the Descent only (inferno/03 section 4; 08-ARENA section 3): Nobody Checks, CONTEMPT embodied, the
// lie at the district office, overlapping Forty Carts at the same hinge, so it is never fought at a hinge of its own.
export const CHECK = {
  id: "check", n: 0, era: 2, liar: "will", line: "brack", tool: "w.stick", lesser: true, trait: "formletter",
  // CONTEMPT embodied: a stack of sacks with a full, painted front and nothing behind, that never turns to look
  town: "Contempt", title: "Nobody Checks", sin: "pride", method: "the shield: forty sacks stacked as a body that looks full from the front and is hollow from the player's side (no numeral: DECISIONS-2026-10-22, inner arena staging call 4)",
  selflie: "q.sl.check", hinge: { after: null, descent: true, when: "the Descent only, never at a hinge" },
  arena: "office", anchor: { name: "the clock, stopped", key: "anchor", draw: "clock" },
  body: { form: "sacks", defaults: { tool: "w.hands", standing: 22, breath: 12, poise: 16, speed: 1.8, accel: 12, turn: 4, radius: 0.7, height: 2.0, grip: 9, frontGuard: 0.65 } },
  specials: {
    // front blows glance off it; it bashes
    "check.bash": like("sergeant.bash", { dmg: 1.2 }),
    "check.shove": like("foreman.sweep", { dmg: 0.9, tell: { at: [4, 25], kind: "sweep" } }),
  },
  phases: [{ name: "the stack", until: 0, rest: 90, pattern: [step("check.bash", 0.3, 1.8), step("check.shove", 0, 2.6)] }],
  strike: [], floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // survive its pattern without striking for the length of a count Will never made
    endure: { rounds: 4, beat: beat("q_office", "The stack stands where it stood, and Will walks round it.") },
    lose: { beat: beat("q_office", "Will wakes under the painted sacks.") },
  },
  force: { ends: "fall", dc: { formletter: -1 }, beat: beat("q_office", "The sacks come down, and the stack was hollow behind its front.") },
  boon: null, // the Descent offers nothing between its rings (06-SYSTEMS section 3)
  faces: [], objects: ["forty sacks stacked as a body", "a front of full sacks over a hollow back"],
  lines: [{ at: "start", voice: "formletter", text: "Nobody's going to come and check.", proposal: true, quotes: "content/quota/q_office.lwd:109" },
    { at: 1, voice: "formletter", text: "Them? They can't count past their fingers. Go round, then. Nobody ever goes round.", proposal: true }],
  senses: { look: "sacks in office lamplight, a full face toward the room and nothing behind it", sound: "the drag motif; the bash a sack's thud", haptic: "a thud, weak 0.2, per bash", grammar: "a stack that is only its front" },
};
