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
import { ARENA_SPECIALS, ARENA_ARCHETYPES } from "./archetypes.mjs";
import MOVES from "./moves.json" with { type: "json" };
// Notes kept from the table before it moved to moves.json (P1):
// The world's answers to a kiter (ai/pursuit.mjs, design/COMBAT-WORLD.md), every opponent's: a slow,
// readable throw of whatever is to hand (a stone, a bottle), which can be caught, blocked or stepped;
// and a lunge that only fires from range, closes about 4 m in its wind-up with its weight behind it
// (armoured against a poke) and recovers quickly.
export const SPECIALS = { ...ARENA_SPECIALS, ...MOVES.foeSpecials }; // the data: moves.json

// Brain numbers (ai/brain.mjs). Attack entries name a move key: a tool strike (light_1, heavy)
// resolved per fighter, or a special id.
export const ARCHETYPES = {
  ...ARENA_ARCHETYPES,
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
