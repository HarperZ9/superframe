// Move builders for the inner bosses' movesets (design/COMBAT-SPEC.md 5.2 and 12, the rework of 2026-10-23). Each
// builder gives one readable attack whose telegraph meets T9 by construction: a parryable blow's tell leads its first
// active frame by 18 frames or more, an unparryable or unblockable one by 30, a signature by 36. Numbers are in
// frames at 60 a second and in Standing (the player has 16 at the inner arena's build).
//   swing   a parryable blow (arc, reach); the string's bread and butter
//   late    the same blow held: the delayed half of a mixup, its tell drawn out so an early roll is caught
//   lunge   a gap closer with root motion; parryable, short recovery
//   heavy   a guard-breaking blow under armour; unparryable
//   sweep   all round, under armour, guard-breaking: the answer to a player who stays behind it
//   grab    a seize at close range: unblockable, unparryable, puts him down; a roll through it is the answer
//   slam    a signature blow that also calls the room (a hazard on the move's first active frame)
//   catch   a stance that catches the player's wind-up (a boss parry), then a riposte
//   call    a shout or a summon: more hands, or the hands' next blows at once
export const T9 = { parry: 18, unparry: 30, signature: 36 };
// the reel a boss falls into when a committed blow carries it onto the ground's prop (combat/arena/innerprop.mjs)
export const REEL = { id: "inner.reel", frames: 120, r: 0.7 };
export const reelMove = { kind: "stagger", startup: 0, active: 0, recovery: REEL.frames, stamina: 0, anim: "stagger" };

const hit = (arc, r, extra = {}) => ({ arc, r, ...extra });
const tell = (startup, kind, from = 4) => ({ at: [from, startup - 1], kind });

export const swing = ({ s = 24, a = 6, rec = 24, dmg = 1.1, poise = 2, arc = [-50, 50], r = [0.3, 2.3], knock = 1.6, track = 8, kind = "swing", root = null, ...o } = {}) =>
  ({ startup: s, active: a, recovery: rec, stamina: 1, dmg, poise, hits: [hit(arc, r)], tell: tell(s, kind), track, trackUntil: s - 6, hitstop: 4, knock, shake: 0.3, root: root || [[s - 6, s + a, 2.2]], ...o });

export const late = (base, hold = 20) => ({ ...base, startup: base.startup + hold, tell: tell(base.startup + hold, base.tell.kind), trackUntil: base.startup + hold - 4, root: (base.root || []).map(([f0, f1, v]) => [f0 + hold, f1 + hold, v]), late: true });

export const lunge = ({ s = 26, a = 8, rec = 22, dmg = 1.2, poise = 3, reach = 7, r = [0.2, 1.6], ...o } = {}) =>
  ({ startup: s, active: a, recovery: rec, stamina: 1, dmg, poise, hits: [hit([-35, 35], r)], tell: tell(s, "pounce"), track: 12, trackUntil: s - 4, root: [[s - 2, s + a, reach]], hitstop: 5, knock: 2.4, shake: 0.35, ...o });

export const heavy = ({ s = 36, a = 6, rec = 36, dmg = 1.8, poise = 5, arc = [-35, 35], r = [0.3, 2.6], knock = 3, ...o } = {}) =>
  ({ startup: s, active: a, recovery: rec, stamina: 2, dmg, poise, hits: [hit(arc, r)], tell: tell(s, "slam"), armor: [0, s + a, 4], guardBreak: true, parryable: false, track: 6, trackUntil: s - 10, hitstop: 8, knock, shake: 0.6, ...o });

export const sweep = ({ s = 38, a = 10, rec = 34, dmg = 1.3, poise = 4, r = [0.3, 2.8], ...o } = {}) =>
  ({ startup: s, active: a, recovery: rec, stamina: 2, dmg, poise, hits: [hit([-180, 180], r)], tell: tell(s, "sweep"), armor: [0, s + a, 3], guardBreak: true, parryable: false, hitstop: 6, knock: 2.6, shake: 0.5, ...o });

export const grab = ({ s = 34, a = 8, rec = 40, dmg = 2.0, poise = 6, r = [0.2, 1.9], toward = null, ...o } = {}) =>
  ({ startup: s, active: a, recovery: rec, stamina: 2, dmg, poise, hits: [hit([-25, 25], r)], tell: tell(s, "grab"), blockable: false, parryable: false, knockdown: true, track: 10, trackUntil: s - 8, root: [[s - 4, s + a, 3.2]], hitstop: 9, knock: 3.4, shake: 0.55, ...(toward ? { toward } : {}), ...o });

export const slam = ({ s = 44, a = 6, rec = 44, dmg = 1.9, poise = 6, r = [0, 3.0], hazard = null, ...o } = {}) =>
  ({ startup: s, active: a, recovery: rec, stamina: 2, dmg, poise, hits: [hit([-180, 180], r, { y: [0, 1.2] })], tell: tell(s, "slam"), armor: [0, s + a, 5], guardBreak: true, parryable: false, hitstop: 9, knock: 3, shake: 0.75, signature: true, ...(hazard ? { hazard } : {}), ...o });

export const catcher = ({ win = [5, 16], rec = 30, ...o } = {}) => ({ kind: "parry", startup: 0, active: 0, recovery: win[1] + rec, stamina: 1, parry: win, ...o });

export const call = ({ s = 36, rec = 30, summon = null, shout = null, ...o } = {}) =>
  ({ startup: s, active: 2, recovery: rec, stamina: 1, armor: [0, s + 2, 4], tell: tell(s, "shout"), ...(summon ? { summon } : {}), ...(shout ? { shout } : {}), ...o });

// the lead a move's tell gives, and the lead T9 asks of it
export const leadOf = (m) => (m.tell ? m.startup - m.tell.at[0] : null);
export const needOf = (m) => (m.signature ? T9.signature : m.parryable === false || m.blockable === false ? T9.unparry : T9.parry);
