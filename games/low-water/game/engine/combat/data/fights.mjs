// The real fights laid over the flaw records (the author, 2026-10-23; design/COMBAT-SPEC.md 5.2 and 12). A fight
// replaces a flaw's moves, phases and body numbers; force always ends it (standing to nothing: `forced`), so the old
// rules that kept force from working go: the floor, the meant-to-lose, the force endings that were not a fall, the
// phase triggers that counted blows, and the on-strike rules that healed, slowed, swallowed or proved the lie. What a
// strike still does is a fight rule (Fond of Them heals when it catches a blow; The Figure keeps the player's last
// string). The non-force verbs stay as optional layers on top, once the fight is joined: an endure now counts the boss's
// strings, so it asks for four times the rests it used to.
import { BOSS_SPECIALS } from "./bosses.mjs";
import { REEL, reelMove } from "./innermoves.mjs";
import { FOND_FIGHT, GOATS_FIGHT, BARN_FIGHT, FIGURE_FIGHT, SAYS_FIGHT, ORDER_FIGHT } from "./fights-a.mjs";
import { PRUDENCE_FIGHT, ONLY_FIGHT, FRIDAY_FIGHT, WITHME_FIGHT, NEAREST_FIGHT, FORTY_FIGHT, CHECK_FIGHT } from "./fights-b.mjs";
import { JEALOUSY_FIGHT, DREAD_FIGHT, SHAME_FIGHT } from "./fights-c.mjs";

export const FIGHTS = { fond: FOND_FIGHT, goats: GOATS_FIGHT, barn: BARN_FIGHT, figure: FIGURE_FIGHT, says: SAYS_FIGHT, order: ORDER_FIGHT,
  prudence: PRUDENCE_FIGHT, only: ONLY_FIGHT, friday: FRIDAY_FIGHT, withme: WITHME_FIGHT, nearest: NEAREST_FIGHT, forty: FORTY_FIGHT, check: CHECK_FIGHT,
  jealousy: JEALOUSY_FIGHT, dread: DREAD_FIGHT, shame: SHAME_FIGHT };
export const ENDURE_PER_ROUND = 4;
// the fights' common scale, tuned against tools/innerduel.mjs (the skilled player's time to kill, the deaths of both
// scripted players): standing and harm multiply every boss's own numbers
export const TUNE = { standing: 2.0, harm: 0.45 };
// a fight's own `tune` { standing, harm } multiplies on top, for the bosses whose hands or ground change the race
export function scaled(fight) {
  const t = fight.tune || {}, k = TUNE.harm * (t.harm ?? 1), harm = (m) => ({ ...m, dmg: +((m.dmg || 0) * k).toFixed(3), ...(m.hazard ? { hazard: { ...m.hazard, dmg: +((m.hazard.dmg ?? 1) * k).toFixed(3) } } : {}) });
  return { ...fight, body: { ...fight.body, standing: Math.round(fight.body.standing * TUNE.standing * (t.standing ?? 1)) },
    moves: Object.fromEntries(Object.entries(fight.moves).map(([id, m]) => [id, harm(m)])),
    phases: fight.phases.map((p) => ({ ...p, hazards: (p.hazards || []).map((h) => ({ ...h, dmg: +((h.dmg ?? 1) * k).toFixed(3) })) })) };
}

// the moves a fight's table needs beyond its own: the daze a wall-stunned charge falls into, and the prop's reel
export function fightMoves(fight) {
  const out = { ...fight.moves };
  for (const m of Object.values(fight.moves)) if (m.wallStun && !out[m.wallStun]) out[m.wallStun] = BOSS_SPECIALS[m.wallStun];
  out[REEL.id] = reelMove; // the reel when the ground's prop is smashed (combat/arena/innerprop.mjs)
  return out;
}

export function applyFight(flaw, fight0) {
  if (!fight0) return flaw;
  const fight = scaled(fight0);
  flaw.specials = fightMoves(fight);
  flaw.phases = fight.phases;
  flaw.body = { ...flaw.body, defaults: { ...flaw.body.defaults, ...fight.body } };
  flaw.strike = fight.strike || [];
  flaw.floor = 0; flaw.meantToLose = false; delete flaw.trap;
  flaw.force = { ...flaw.force, ends: "fall" }; delete flaw.force.at; delete flaw.force.atFloor; delete flaw.force.hold;
  if (flaw.verbs.endure && flaw.verbs.endure.rounds) flaw.verbs.endure = { ...flaw.verbs.endure, rounds: flaw.verbs.endure.rounds * ENDURE_PER_ROUND };
  flaw.limit = Math.max(flaw.limit || 0, 60 * 300);
  for (const [v, o] of Object.entries(fight.layers || {})) if (flaw.verbs[v]) flaw.verbs[v] = { ...flaw.verbs[v], ...o, ...(o.follow ? { follow: { ...flaw.verbs[v].follow, ...o.follow } } : {}) };
  if (fight.loseEnds) flaw.loseEnds = true;
  flaw.fight = true;
  return flaw;
}
