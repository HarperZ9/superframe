// Era 5's inner bosses (design/spine-plan/inferno/03-BESTIARY-B.md section 3; design/eras/era5.md section 9), each a
// trait embodied (design/TRAITS.md, 2026-10-23): LOYALTY as Order (boss 11), returning for Leon Brack with three
// generations in the wall, and SPITE as Everybody Says (boss 12), the era 5 man's share grown a body. Every spoken line is a PROPOSAL from the bestiary or the scenes' own self-lie
// text (content/quota/e5_town.lwd), for the author to approve. Telegraphs follow COMBAT-SPEC T9 (wave 1): 18
// frames or more from tell to first active frame, 30 when unparryable with its own cue, 36 on a signature.
//
// Since the rework of 2026-10-23 the moves, phases and ground below are replaced by the real fights in
// combat/data/fights-a.mjs (Order: a riot shield whose front blows glance, constables, walls that close; Everybody
// Says: a crowd boss whose heads close round the player). The old rules (a blow that moves the wall or posts two
// heads, a floor it cannot fall below) are retired; force is a fall. The optional layers stay: Order's yield (the
// baton dropped, three drags outlasted) and Everybody Says' endure (stand at the stone).
// Each fight is the flaw given a body; how its moveset and ground carry it is in design/COMBAT-SPEC.md section 12.
import { like, H, step, beat } from "./flaws-common.mjs";

const proposal = (ls) => ls.map((l) => ({ ...l, proposal: true }));

export const ORDER = {
  id: "order", n: 11, era: 5, liar: "leon", line: "brack", tool: "w.stick", trait: "precedent",
  // LOYALTY embodied: three Brack men in one riot shield, three helmets over the rim, six arms through each other's
  // sleeves. It guards its front and never looks behind it. The shown name is the trait; the title, in its dialogue
  // only, is the lie's own words
  town: "Loyalty", title: "Somebody Had To", sin: "wrath", method: "the Erinyes run backwards: a family renames its vengeance as order, and the court becomes the pursuit again",
  // Leon's statement in era 5 arms it; Will's at the Well House fire in era 3 is the same lie (03-BESTIARY-B: "and again for Leon")
  selflie: "e5.sl.order", also: ["e3.sl.order", "q.sl.order"], hinge: { after: "e5_town", when: "the night after Leon's statement" },
  arena: "street", anchor: { name: "the square's cobbles under Mill Street", key: "anchor", draw: "cobbles" },
  body: { form: "shield", defaults: { tool: "w.stick", standing: 28, breath: 12, poise: 14, speed: 2.2, accel: 14, turn: 5, radius: 0.6, height: 2.1, grip: 9, frontGuard: 0.65 } },
  specials: {
    // the baton over the shield rim: parryable, a quick read (lead 18)
    "order.baton": like("sergeant.baton", { dmg: 1.1 }),
    // the shield driven forward (lead 26)
    "order.bash": like("sergeant.bash", { dmg: 1.2 }),
    // the wall's drag: three shields locked and walked forward across the street; unparryable, the grab cue (lead 34)
    "order.drag": like("captain.drag", { dmg: 1.3 }),
    // two more of the line come in: Josh's road-post lantern and Leon's van light, never faces of anyone else
    "order.call": { startup: 36, active: 2, recovery: 30, stamina: 1, summon: { n: 2, at: "kerb", form: "lantern", style: "shield", def: { hp: 4, speed: 1.6 } }, armor: [0, 38, 6], tell: { at: [4, 36], kind: "shout" } },
  },
  phases: [
    { name: "one", until: 0.66, rest: 100, pattern: [step("order.baton", 0, 2.0), step("order.bash", 0.4, 2.6), step("order.baton", 0, 2.0)] },
    // the other two come whether he strikes or not (eight seconds), and the wall locks at twenty: the line hunts together
    { name: "three", until: 0.33, rest: 80, trigger: { kind: "time", frames: 480 }, opening: [step("order.call", 0, 99)], pattern: [step("order.bash", 0.4, 2.6), step("order.baton", 0, 2.0), step("order.drag", 0.6, 4.0)],
      morph: { look: "three", dim: 0.9 } },
    { name: "the wall", until: 0, rest: 60, trigger: { kind: "time", frames: 1200 }, pattern: [step("order.drag", 0.6, 4.0), step("order.bash", 0.4, 2.6), step("order.drag", 0.6, 4.0)], morph: { look: "wall", scale: 1.25 } },
  ],
  // every blow the player lands moves the wall a column in from the street's open end (at most six)
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  floor: 0, meantToLose: false, limit: 60 * 180,
  verbs: {
    // drop the baton, then endure the wall's drag to its end; the three walk on up the street
    yield: { lay: 60, act: "drops the baton", follow: { kind: "outlast", move: "order.drag", n: 3 },
      beat: beat("e5_day", "The three walk past him and on up Mill Street, out of step, and he is left standing on the square's stones. On the clearance day the van is where it was.") },
    lose: { beat: beat("e5_day", "Leon wakes on his own kitchen floor with the baton in his hand and the radio on.") },
  },
  force: { ends: "fall", dc: { precedent: -1 },
    beat: beat("e5_day", "The shield comes down, and it was his own. He wakes knowing what he'll say in the morning, and it's what he said before.") },
  boon: { id: "theline", name: "The Line", what: "a front guard, as the Clearance Sergeant has: front blows glance", effect: { frontGuard: 0.4 },
    cost: { who: "e4.ann_c", scene: "e5_end", beat: "At the Brack end Ann says it to Leon in the corridor as a family saying, \"Somebody had to, love\", and he does not answer her." } },
  faces: ["will", "leon"], objects: ["the riot shield with a thread caught on the rim", "Josh's road-post lantern", "the van's light", "the square's cobbles, which stay real"],
  lines: proposal([
    { at: "start", voice: "precedent", text: "Somebody has to keep order on Mill Street. If it's not us it's the lads with the bats.", quotes: "content/quota/e5_town.lwd:280" },
    { at: 1, voice: "precedent", text: "Your grandad held this street. Your dad held it. You going to be the one that didn't?" },
    { at: 2, voice: "precedent", text: "Somebody had to, and it was us. It's always us." },
    { at: "laid", voice: "precedent", text: "Go on, then. Put it down. We'll hold it without you." },
  ]),
  senses: { look: "era 3 square stones under era 5 sodium; the shields' rims catch the van light", sound: "one sentence in three voices, slightly out of time; the drag motif in three registers; boots, the van's engine, a lantern's hiss", haptic: "the bash, strong 0.35; the drag a long low pull", grammar: "the street closes behind every blow" },
};

export const SAYS = {
  id: "says", n: 12, era: 5, liar: "era5", line: "both", tool: "w.hands", trait: "hearsay",
  // SPITE embodied: a crier's tin horn at a man's head height with no man under it, and the lit screens that grow round
  // it, each one a mouth; break the one that started it and the rest go home
  town: "Spite", title: "Everybody Says", sin: "false witness and slander; denial", method: "the Hydra (two heads for one), the Ghoul that feeds where the dead are buried, the spirit that denies",
  selflie: "e5.sl.says", hinge: { after: "e5_town", when: "the night after the clip" },
  arena: "verge", anchor: { name: "the one stone at a wrong angle in the clean road edge", key: "anchor", draw: "stone" },
  body: { form: "horn", defaults: { tool: "w.hands", standing: 24, breath: 10, poise: 99, speed: 0.6, accel: 6, turn: 3, radius: 0.6, height: 2.0, grip: 6 } },
  specials: {
    // a weight slams down where he stands: unparryable, the ring cue (lead 36, signature)
    "says.post": like("foreman.slam", { dmg: 1.2 }),
    // every head reads at once: rings going out (lead 36)
    "says.chorus": like("foreman.ringslam", { dmg: 1.0 }),
    // the heads sink into the verge and come up under him: a low sweep (lead 22)
    "says.sink": like("foreman.sweep", { dmg: 1.0, hits: [H([-120, 60], [0.4, 2.6], { y: [0, 0.5] })] }),
  },
  phases: [
    { name: "the crier", until: -1, rest: 110, pattern: [step("says.post", 0, 3.0), step("says.sink", 0, 2.6)] },
    { name: "the heads", until: -1, rest: 80, trigger: { kind: "heads", n: 4 }, pattern: [step("says.chorus", 0, 3.0), step("says.post", 0, 3.0), step("says.sink", 0, 2.6)], morph: { look: "screens" } },
    { name: "the verge", until: -1, rest: 60, trigger: { kind: "heads", n: 8 }, pattern: [step("says.chorus", 0, 3.0), step("says.sink", 0, 2.6), step("says.post", 0, 3.0)], morph: { look: "verge", bowl: 1 } },
  ],
  // two heads grow for every blow that lands on it or on a head; at twelve posted the lie is proved
  strike: [] /* the on-strike rule is retired: every blow only harms (fights.mjs, 2026-10-23) */,
  // it cannot be beaten: its standing never falls below this share
  floor: 0.45, meantToLose: false, limit: 60 * 180,
  verbs: {
    // walk to the stone and stand on the verge without striking: one head quiet each `every` frames while he stands
    endure: { stand: { anchor: "anchor", r: 1.3, every: 90 },
      beat: beat("e5_day", "The heads go quiet one at a time while he stands by the stone. In the morning the posts are all still up.") },
    lose: { beat: beat("e5_day", "He wakes with the phone on his chest, still lit, and the share still up.") },
  },
  force: { ends: "heads", dc: { hearsay: -2 },
    beat: beat("e5_day", "The crier's horn comes down and the heads go home with it. In the morning the share is still up, in his words.") },
  boon: { id: "reach", name: "Reach", what: "a longer strike: light strikes reach 0.3 m further", effect: { reach: 0.3 },
    cost: { who: "e5.ryan", scene: "e5_week", beat: "In the next scene Ryan Haldane, fifteen, quotes the player's post back at a friend on the Yard's wall, word for word, and does not know whose blood it denies." } },
  faces: [], objects: ["one head in a cloth hood", "a crowd of hooded heads, then lit faces in the dark, each mouthing the player's own words", "the stone at the verge"],
  lines: proposal([
    { at: "start", voice: "hearsay", text: "Everybody's sharing everything. It was already out. Everybody says it. You only passed it on.", quotes: "content/quota/e5_town.lwd:123" },
    { at: 1, voice: "hearsay", text: "I'm not saying it's them. I'm saying I've not heard anybody say different." },
    { at: 2, voice: "hearsay", text: "There was no corner. There was a verge. Go on, tell them. They'll believe you." },
    { at: "quiet", voice: "hearsay", text: "Everybody says." },
  ]),
  senses: { look: "hooded heads, then lit faces with no bodies; the verge at night with one stone wrong", sound: "the player's own words read by many voices at once, none raised; a phone chime where the bell was", haptic: "a short buzz per post, weak 0.15", grammar: "a quiet head is still there" },
};
