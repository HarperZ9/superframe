// Moves as data. Every action a fighter takes (an attack, a dodge, a parry, a drink, a stagger)
// is one move record counted in simulation frames at 60 per second. Frame 0 is the first frame.
//
//   startup, active, recovery   frame counts; total = their sum
//   stamina                     paid when the move starts (refused below 1)
//   dmg, poise                  health and poise damage per hit
//   hits: [{ arc: [a, b], r: [r0, r1], y: [y0, y1], at: [f0, f1] }]
//                               hit volumes: a ring sector in degrees from facing (negative is
//                               left), radii in metres, a height band, and frames (default: the
//                               active window)
//   root: [[f0, f1, speed]]     root motion in m/s along the move's direction (negative: back)
//   iframes: [f0, f1]           frames on which hits pass through
//   armor: [f0, f1, n]          poise damage reduced by n on those frames
//   cancel: { action: [f0, f1] } the frames on which a buffered action may cut the move short
//   next: { action: moveId }    a chain: that action inside its cancel window starts this move
//   track: deg                  turn toward the target by up to this many degrees a frame in
//                               startup (trackUntil: frame limit, default end of startup)
//   hitstop, knock, shake       frames of freeze on a hit, knockback m/s (negative pulls), and a
//                               0..1 camera shake amount
//   parry: [f0, f1]             deflects parryable hits arriving from the front on these frames
//   parryable                   false for attacks a parry cannot turn
//   tell: { at: [f0, f1], kind } a telegraph the renderer shows (kind: swing, grab, throw)
//   charge: { at, max, min, into } hold the button at frame `at` to charge up to `max` frames;
//                               released after `min` it becomes move `into`
//   item: { use, heal, proj }   an item used on the first active frame (heal, or throw proj)
//   then: moveId                the move that follows on the last frame (knockdown -> getup)
//   knockdown                   a hit puts the target down whatever its poise
//   shove, grapple              a push (into water: under for a moment) / a seize (a GRIP contest)
//   blockable, guardBreak       false for blows a block cannot stop / true for blows that break it
//   toward                      "water": a pull drags toward the deepest water near the target
//   kind                        attack, dodge, parry, riposte, item, stagger, down, fall
//   dir                         facing, or input (the stick direction, for dodges)
//   anim                        the animation clip id (default: the move id), see anim/drive.mjs
export const FPS = 60, DT = 1 / FPS;

const DEFAULTS = {
  kind: "attack", startup: 0, active: 0, recovery: 0, stamina: 0, dmg: 0, poise: 0, hits: [], root: [],
  iframes: null, armor: null, cancel: {}, next: {}, track: 0, trackUntil: null, hitstop: 0, knock: 0,
  shake: 0, dir: "facing", parry: null, parryable: true, tell: null, charge: null, item: null, then: null, knockdown: false, anim: null,
  shove: false, grapple: false, blockable: true, guardBreak: false, toward: null, takedown: false, tap: null, composure: 0, pierce: false, through: false, snare: false, resetRead: false, behind: false, wide: 0, baseTotal: null,
  // sweep: [from, to) inside startup where the swing's long travel plays (the art's `sweep` phase),
  // so the active frames carry only contact. Timing only for the animation: no hits, no windows.
  sweep: null,
};

const isPair = (w) => Array.isArray(w) && w.length >= 2 && w.every((x) => typeof x === "number");

function check(m) {
  const bad = (why) => { throw new Error(`move ${m.id}: ${why}`); };
  for (const k of ["startup", "active", "recovery", "stamina", "dmg", "poise", "hitstop"]) if (!(m[k] >= 0)) bad(`${k} must be 0 or more`);
  if (m.total < 1) bad("needs at least one frame");
  for (const k of ["iframes", "armor", "parry"]) if (m[k] && !isPair(m[k])) bad(`${k} must be [from, to]`);
  for (const [a, w] of Object.entries(m.cancel)) if (!isPair(w)) bad(`cancel.${a} must be [from, to]`);
  for (const r of m.root) if (!(Array.isArray(r) && r.length === 3)) bad("root entries are [from, to, speed]");
  for (const h of m.hits) if (!isPair(h.arc) || !isPair(h.r)) bad("hits need arc and r");
  if (m.charge && !(m.charge.at < m.startup && m.charge.into)) bad("charge.at must fall in startup and name into");
  if (m.sweep && !(isPair(m.sweep) && m.sweep[0] >= 0 && m.sweep[1] === m.startup && m.sweep[0] < m.sweep[1])) bad("sweep must be [from, startup)");
}

// Fill defaults and derived fields. Hits default to the active window and the full body height.
export function defineMoves(table) {
  const out = {};
  for (const [id, raw] of Object.entries(table)) {
    const m = { ...DEFAULTS, ...raw, id };
    m.total = m.startup + m.active + m.recovery;
    m.anim ||= id;
    m.hits = m.hits.map((h) => ({ y: [0, 2.2], at: [m.startup, m.startup + m.active - 1], ...h }));
    m.trackUntil ??= m.startup;
    check(m);
    out[id] = Object.freeze(m);
  }
  for (const m of Object.values(out)) {
    for (const to of Object.values(m.next)) if (!out[to]) throw new Error(`move ${m.id}: next names unknown move ${to}`);
    if (m.then && !out[m.then]) throw new Error(`move ${m.id}: then names unknown move ${m.then}`);
    if (m.charge && !out[m.charge.into]) throw new Error(`move ${m.id}: charge.into names unknown move`);
  }
  return out;
}

export const within = (w, f) => !!w && f >= w[0] && f <= w[1];

export function phaseOf(m, f) {
  if (f < m.startup) return "startup";
  if (f < m.startup + m.active) return "active";
  if (f < m.total) return "recovery";
  return "done";
}

export function rootSpeed(m, f) {
  let v = 0;
  for (const [a, b, s] of m.root) if (f >= a && f <= b) v += s;
  return v;
}

export const canCancel = (m, f, action) => within(m.cancel[action], f) || within(m.cancel.any, f);
export const hitsAt = (m, f) => m.hits.filter((h) => f >= h.at[0] && f <= h.at[1]);
export const armorAt = (m, f) => (within(m.armor, f) ? m.armor[2] || 0 : 0);
