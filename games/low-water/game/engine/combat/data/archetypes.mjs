// The arena's opponents (coordinator, 2026-10-21: a replayable combat mode in the No Rest for the Wicked
// and Elden Ring manner; design/PITCHES.md, combat table). Ten archetypes that read apart at play size, by
// silhouette (height, breadth, what is carried), stance (upright, stooped, low, wide) and tell (each has a
// signature move whose wind-up is its own shape). The holder and the skirmisher are combat/data/foes.mjs;
// the eight here are built from the remaining foe records (the record each borrows its numbers from is
// `from`). Placeholder dressing only: any pitch reskins them by name and look.
//
//   sweeper   (f.lamplighter) a long pole held level: a low sweep that puts Lamb down unless stepped or
//             rolled, a pinning thrust, and a call that sends the others in at once
//   shield    (f.panbearer)   broad and short behind a round shield: front hits glance off its guard
//             while it walks in; a shield bash that breaks a guard; a braced shove
//   cutter    (f.gutter)      thin and leaning in: a three-cut flurry, and a lash that snags from 3 m
//   hound     (f.dog)         low and fast: circles, then a long pounce that knocks down; quick bites
//   swarm     (f.gulls)       small and erratic: a pecking flurry and a snatch that takes Breath
//   grappler  (f.conger)      wide and stooped, arms out: a grab that cannot be blocked and a slam
//   zealot    (f.zealot)      tall and hooded: armour through every swing; a four-blow frenzy
//   captain   (f.stripper_lead) tall hat, long coat: a hook that pulls, a rally that restores the others
// Every archetype has an elite (elite(def, style)): more standing and poise, quicker to come again, its
// signature move with armour, a pale sash so it reads apart.
//   tell kinds: swing, throw, grab (combat/arena/figure.mjs), and sweep (a low arc on the ground), pounce
//   (a line ahead), shout (rings out from the body), which the arena draws and the shell's figure layer
//   draws as swing until the rendering lead has its own.
import MOVES from "./moves.json" with { type: "json" };

export const ARENA_SPECIALS = MOVES.arenaSpecials; // the data: moves.json

// numbers per archetype (the brain's: ai/brain.mjs) and the look (combat/arena/figure.mjs): coat and trim
// grey, hat shape, stoop, and a size against Lamb's (scale) and breadth (wide)
export const ARENA_ARCHETYPES = {
  sweeper: { from: "f.lamplighter", signature: "sweeper.sweep",
    defaults: { tool: "w.pole", standing: 8, breath: 6, poise: 3, speed: 2.8, accel: 18, turn: 8, radius: 0.4, height: 2.1, grip: 4 },
    items: { stone: 6 }, specials: ["sweeper.sweep", "sweeper.pin", "sweeper.call", "world.throw", "world.lunge"],
    brain: { think: 10, range: [2.4, 3.4], flankSlot: 0, retreatHp: 0.25, lowStamina: 1, cooldown: [50, 90],
      attacks: [{ move: "light_1", min: 1.0, max: 3.2, w: 2 }, { move: "sweeper.sweep", min: 0.8, max: 3.0, w: 3 }, { move: "sweeper.pin", min: 1.2, max: 3.3, w: 2 }, { move: "sweeper.call", min: 2.5, max: 9, w: 1, allies: 1 }],
      onStagger: null, dodge: null },
    look: { coat: 0.2, trim: 0.8, hat: "wide", stoop: 0.05, scale: 1.08, wide: 0.9 } },
  shield: { from: "f.panbearer", signature: "shield.bash",
    defaults: { tool: "w.hands", standing: 13, breath: 6, poise: 6, speed: 2.2, accel: 14, turn: 6, radius: 0.55, height: 1.85, grip: 6, frontGuard: 0.35 },
    items: { stone: 4 }, specials: ["shield.bash", "shield.brace", "world.throw", "world.lunge"],
    brain: { think: 14, range: [1.2, 2.0], flankSlot: 0, retreatHp: 0.1, lowStamina: 1, cooldown: [60, 100],
      attacks: [{ move: "light_1", min: 0, max: 1.6, w: 2 }, { move: "shield.bash", min: 0.6, max: 2.6, w: 2 }, { move: "shield.brace", min: 0, max: 2.2, w: 1 }],
      onStagger: "brace", braced: "shield.bash", dodge: null },
    look: { coat: 0.3, trim: 0.7, hat: "none", stoop: 0.2, scale: 0.95, wide: 1.35, shield: true } },
  cutter: { from: "f.gutter", signature: "cutter.flurry",
    defaults: { tool: "w.knife", standing: 7, breath: 8, poise: 2, speed: 4.0, accel: 34, turn: 18, radius: 0.34, height: 1.7, grip: 3 },
    items: { stone: 6 }, specials: ["cutter.flurry", "cutter.lash", "skirmisher.scuttle", "world.throw", "world.lunge"],
    brain: { think: 7, range: [1.4, 3.0], flankSlot: 1, retreatHp: 0.25, lowStamina: 1, cooldown: [40, 80],
      attacks: [{ move: "light_1", min: 0, max: 1.4, w: 2, chain: 2 }, { move: "cutter.flurry", min: 0.4, max: 2.2, w: 3 }, { move: "cutter.lash", min: 2.0, max: 3.3, w: 1 }],
      onStagger: "scramble", dodge: "skirmisher.scuttle" },
    look: { coat: 0.32, trim: 0.9, hat: "cap", stoop: 0.45, scale: 0.92, wide: 0.75 } },
  hound: { from: "f.dog", signature: "hound.pounce",
    defaults: { tool: "w.hands", standing: 5, breath: 6, poise: 1, speed: 4.4, accel: 34, turn: 18, radius: 0.32, height: 0.9, grip: 2 },
    items: {}, specials: ["hound.pounce", "hound.bite", "hound.circle"],
    brain: { think: 8, range: [1.8, 3.2], flankSlot: 1, retreatHp: 0.3, lowStamina: 1, cooldown: [70, 120],
      attacks: [{ move: "hound.bite", min: 0, max: 1.0, w: 3 }, { move: "hound.pounce", min: 2.0, max: 4.5, w: 2 }],
      onStagger: "scramble", dodge: "hound.circle" },
    look: { coat: 0.5, trim: 0.9, hat: "ears", stoop: 0.9, scale: 0.5, wide: 1.2, beast: true } },
  swarm: { from: "f.gulls", signature: "swarm.peck",
    defaults: { tool: "w.hands", standing: 5, breath: 9, poise: 0.5, speed: 4.6, accel: 44, turn: 26, radius: 0.28, height: 0.7, grip: 1 },
    items: {}, specials: ["swarm.peck", "swarm.snatch", "hound.circle"],
    brain: { think: 5, range: [1.0, 2.6], flankSlot: 1, retreatHp: 0.6, lowStamina: 1, cooldown: [30, 70],
      attacks: [{ move: "swarm.peck", min: 0, max: 1.4, w: 4 }, { move: "swarm.snatch", min: 0, max: 1.3, w: 1 }],
      onStagger: "scramble", dodge: "hound.circle" },
    look: { coat: 0.85, trim: 0.3, hat: "none", stoop: 0.5, scale: 0.4, wide: 1.4, beast: true, flutter: true } },
  grappler: { from: "f.conger", signature: "grappler.grab",
    defaults: { tool: "w.hands", standing: 18, breath: 6, poise: 8, speed: 2.4, accel: 14, turn: 6, radius: 0.56, height: 2.0, grip: 8 },
    items: { stone: 4 }, specials: ["grappler.grab", "grappler.slam", "world.throw", "world.lunge"],
    brain: { think: 14, range: [1.2, 2.2], flankSlot: 0, retreatHp: 0.15, lowStamina: 1, cooldown: [70, 120],
      attacks: [{ move: "light_1", min: 0, max: 1.5, w: 1 }, { move: "grappler.grab", min: 0.4, max: 2.4, w: 3 }, { move: "grappler.slam", min: 0, max: 2.0, w: 2 }],
      onStagger: "brace", braced: "grappler.slam", dodge: null },
    look: { coat: 0.1, trim: 0.55, hat: "none", stoop: 0.35, scale: 1.12, wide: 1.5, arms: true } },
  zealot: { from: "f.zealot", signature: "zealot.frenzy",
    defaults: { tool: "w.stick", standing: 9, breath: 7, poise: 7, speed: 3.1, accel: 22, turn: 10, radius: 0.38, height: 2.05, grip: 4 },
    items: { stone: 4 }, specials: ["zealot.swing", "zealot.frenzy", "world.throw", "world.lunge"],
    brain: { think: 9, range: [1.2, 2.2], flankSlot: 0, retreatHp: 0, lowStamina: 0, cooldown: [40, 70],
      attacks: [{ move: "zealot.swing", min: 0.3, max: 2.0, w: 3 }, { move: "zealot.frenzy", min: 0.3, max: 2.0, w: 2 }],
      onStagger: null, dodge: null },
    look: { coat: 0.6, trim: 0.9, hat: "hood", stoop: 0.0, scale: 1.05, wide: 0.85 } },
  captain: { from: "f.stripper_lead", signature: "captain.hook",
    defaults: { tool: "w.crowbar", standing: 16, breath: 7, poise: 6, speed: 2.9, accel: 20, turn: 9, radius: 0.44, height: 2.0, grip: 6 },
    items: { stone: 8 }, specials: ["captain.hook", "captain.rally", "world.throw", "world.lunge"],
    brain: { think: 11, range: [2.6, 4.0], flankSlot: 0, retreatHp: 0.2, lowStamina: 1, cooldown: [50, 90],
      attacks: [{ move: "light_1", min: 0, max: 1.6, w: 2, chain: 1 }, { move: "heavy", min: 0.5, max: 2.0, w: 2 }, { move: "captain.hook", min: 1.6, max: 4.2, w: 3 }, { move: "captain.rally", min: 2.5, max: 10, w: 1, allies: 1 }],
      onStagger: "brace", braced: "light_1", dodge: null },
    look: { coat: 0.05, trim: 0.65, hat: "tall", stoop: 0.05, scale: 1.1, wide: 1.05, longcoat: true } },
};

// The elite of an archetype: a fighter def (roster foeDef) and its brain, made harder in ways that read.
export const ELITE = { hp: 1.6, poise: 2, speed: 1.08, cool: 0.7, think: 0.8, armor: [0, 0, 3], sash: 0.95 };
export function elite(def, A) {
  return { ...def, name: `${def.name} (elite)`, hp: Math.round(def.hp * ELITE.hp), poise: def.poise + ELITE.poise, speed: def.speed * ELITE.speed, elite: true, sash: ELITE.sash };
}
export function eliteBrain(brain) {
  return { ...brain, think: Math.max(3, Math.round(brain.think * ELITE.think)), cooldown: brain.cooldown.map((c) => Math.round(c * ELITE.cool)) };
}
// an elite's signature move carries armour through its wind-up (the move record, copied per fighter)
export function eliteMove(m) { return { ...m, armor: [0, (m.startup || 0) + (m.active || 0), Math.max(3, (m.armor || [0, 0, 0])[2])] }; }
