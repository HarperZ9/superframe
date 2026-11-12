// Opponent archetypes (SYSTEMS-FULL 18.6). Two are authored in full; every @foe in content uses
// one of them as its behaviour, with its own numbers from its @foe record.
//
// The holder (built on the Board's tide-wardens): heavy, slow, hard to stagger, long reach. Holds
// the middle distance in front of Lamb. Thrusts with the hook; swings the chain wide with armour
// through it; and the drag, telegraphed by a long wind-up, cannot be caught or blocked: it hooks
// Lamb, puts Lamb down and drags toward the deepest water near by. Braces after a stagger and
// answers at once.
//
// The skirmisher (built on the Low Company's salvors): quick and fragile. Works the flank while
// someone else holds the front (and closes in on a Lamb who does not fight back), throws mud from range (the wind carries it; in the face it
// blinds for a few seconds), throws a rope at the legs (cannot be caught; puts Lamb down), comes
// in with the crowbar when Lamb is busy, and scrambles off when hurt.
export const SPECIALS = {
  "holder.drag": { startup: 44, active: 6, recovery: 40, stamina: 2, dmg: 1.5, poise: 3, hits: [{ arc: [-14, 14], r: [0.6, 3.4] }],
    parryable: false, blockable: false, knockdown: true, toward: "water", tell: { at: [6, 43], kind: "grab" }, track: 9, trackUntil: 34, hitstop: 9, knock: 3.6, shake: 0.5 },
  "holder.chain": { startup: 30, active: 7, recovery: 34, stamina: 2, dmg: 1.5, poise: 2, hits: [{ arc: [-100, 100], r: [0.4, 2.6] }],
    armor: [8, 36, 2], guardBreak: true, tell: { at: [6, 29], kind: "swing" }, track: 9, trackUntil: 24, hitstop: 5, knock: 3.0, shake: 0.45 },
  "holder.braced": { startup: 18, active: 7, recovery: 34, stamina: 1, dmg: 1, poise: 2, hits: [{ arc: [-100, 100], r: [0.4, 2.6] }],
    armor: [0, 42, 4], tell: { at: [2, 17], kind: "swing" }, track: 9, trackUntil: 14, hitstop: 6, knock: 3.0, shake: 0.45 },
  "skirmisher.mud": { kind: "item", startup: 18, active: 1, recovery: 20, stamina: 1, tell: { at: [4, 17], kind: "throw" }, track: 10,
    item: { use: "mud", proj: { speed: 12, mass: 0.5, dmg: 0.25, poise: 0.5, r: 0.3, blind: 150 } } },
  "skirmisher.rope": { kind: "item", startup: 26, active: 1, recovery: 24, stamina: 2, tell: { at: [6, 25], kind: "grab" }, track: 10,
    item: { use: "rope", proj: { speed: 10, mass: 1.5, dmg: 0.5, poise: 2, r: 0.45, knockdown: true, parryable: false, blockable: false } } },
  "skirmisher.scuttle": { kind: "dodge", recovery: 22, stamina: 1, iframes: [2, 12], root: [[0, 14, -6.0]] },
  // The world's answers to a kiter (ai/pursuit.mjs, design/COMBAT-WORLD.md), every opponent's: a slow,
  // readable throw of whatever is to hand (a stone, a bottle), which can be caught, blocked or stepped;
  // and a lunge that only fires from range, closes about 4 m in its wind-up with its weight behind it
  // (armoured against a poke) and recovers quickly.
  "world.throw": { kind: "item", startup: 48, active: 1, recovery: 36, stamina: 1, tell: { at: [6, 47], kind: "throw" }, track: 8,
    item: { use: "stone", proj: { speed: 13, mass: 1, dmg: 0.6, poise: 1.5, r: 0.35, knock: 2.0, hitstop: 5, shake: 0.2 } } },
  "world.lunge": { startup: 28, active: 6, recovery: 26, stamina: 2, armor: [0, 30, 2], dmg: 1, poise: 2, hits: [{ arc: [-35, 35], r: [0.3, 1.7] }],
    root: [[12, 28, 15.0], [28, 34, 4.0]], tell: { at: [4, 27], kind: "swing" }, track: 8, trackUntil: 22, hitstop: 6, knock: 3.0, shake: 0.35 },
};

// Brain numbers (ai/brain.mjs). Attack entries name a move key: a tool strike (light_1, heavy)
// resolved per fighter, or a special id.
export const ARCHETYPES = {
  holder: {
    defaults: { tool: "w.boathook", standing: 12, breath: 5, poise: 5, speed: 2.5, accel: 16, turn: 6, radius: 0.48, height: 2.3, grip: 5 },
    items: { stone: 12 }, specials: ["holder.drag", "holder.chain", "holder.braced", "world.throw", "world.lunge"],
    brain: {
      think: 12, range: [1.8, 2.8], flankSlot: 0, retreatHp: 0.2, lowStamina: 1, cooldown: [40, 80],
      attacks: [{ move: "light_1", min: 0.8, max: 3.0, w: 3, chain: 1 }, { move: "holder.chain", min: 0.4, max: 2.5, w: 3 }, { move: "holder.drag", min: 1.6, max: 3.3, w: 2 }],
      onStagger: "brace", braced: "holder.braced", dodge: null,
    },
  },
  skirmisher: {
    defaults: { tool: "w.crowbar", standing: 9, breath: 7, poise: 3, speed: 3.8, accel: 32, turn: 16, radius: 0.36, height: 1.75, grip: 3 },
    items: { mud: 6, rope: 2, stone: 12 }, specials: ["skirmisher.mud", "skirmisher.rope", "skirmisher.scuttle", "world.throw", "world.lunge"],
    brain: {
      think: 8, range: [3.5, 6.0], flankSlot: 1, retreatHp: 0.5, lowStamina: 1, cooldown: [60, 120],
      attacks: [{ move: "light_1", min: 0, max: 1.8, w: 3, chain: 1 }, { move: "heavy", min: 0.5, max: 2.0, w: 1 },
        { move: "skirmisher.mud", min: 3.5, max: 8.5, w: 3 }, { move: "skirmisher.rope", min: 2.5, max: 6.5, w: 2 }],
      onStagger: "scramble", dodge: "skirmisher.scuttle",
    },
  },
};

// Every Act 1 @foe and the archetype it uses until it has its own (content/act1/combat.lwd).
// styleFor() below decides for any @foe, including ones added later.
// The content's named moves that are not built yet are listed in PROGRESS.md.
export const FOE_STYLE = {
  "f.warden": "holder", "f.keel": "holder", "f.panbearer": "holder", "f.lugg": "holder", "f.conger": "holder", "f.lamplighter": "holder",
  "f.salvor": "skirmisher", "f.gutter": "skirmisher", "f.dog": "skirmisher", "f.gulls": "skirmisher", "f.eel": "skirmisher",
};

const kv = (rec, k) => { const x = rec && rec.kv && rec.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };

// The archetype for an @foe: its own `style:` key, else the table above, else by what it fights
// with (a pole, boathook or hammer holds the front; a knife, bar or nothing works the flank),
// else by size (Standing 12 or more holds).
export function styleFor(id, rec) {
  const own = kv(rec, "style");
  if (own && ARCHETYPES[own]) return own;
  if (FOE_STYLE[id]) return FOE_STYLE[id];
  const tool = kv(rec, "tool");
  if (["w.pole", "w.boathook", "w.hammer", "w.case"].includes(tool)) return "holder";
  if (tool) return "skirmisher";
  return +(kv(rec, "standing") || 0) >= 12 ? "holder" : "skirmisher";
}
