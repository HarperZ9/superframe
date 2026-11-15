// Moves every body has, and the rules every fighter obeys. Frames at 60 a second; damage in
// Standing, costs in Breath, poise in hits (SYSTEMS-FULL 18.2). TUNING.md gives each source.
// Notes kept from the table before it moved to moves.json (P1):
// a hit that lands in a wind-up (or on a body standing open) interrupts it: a short flinch
// poise broken: the body reels and cannot act
// a caught (parried) blow: wide open; a riposte lands in this window
// shoved into water at the knee or deeper: under for a moment
// a heavy blow, a hook or a rope puts the body down; it gets up with the frames covered
// a rigged rope round the legs: down and held, open to a free strike (sim/props.mjs)
// Standing gone: the body goes down and stays down (Lamb: Down, 18.7; a foe: beaten, C5)
// a yielding opponent backs off with its hands open
import MOVES from "./moves.json" with { type: "json" };
export const COMMON = MOVES.common; // the data: moves.json

export const RULES = {
  riposteRange: 2.4,      // metres to a parried target for a light press to become a riposte
  riposteCone: 70,        // degrees either side of facing
  parryCone: 100,         // degrees either side of facing a catch covers
  blockCone: 60,          // degrees either side of facing a block covers (a 120-degree arc)
  guardFrames: 4,         // frames from pressing block to the guard being up
  guardSpeed: 0.4,        // walking speed while the guard is up
  guardRegen: 0.1,        // breath recovers at this share while the guard is up
  catchLockout: 24,      // frames after a missed catch ends before another catch may start (T5; Lies of P locks 30)
  buffer: 8,              // frames a press waits in the buffer: 133 ms (engine PROGRESS 37, 100 to 150 ms; was 10, 167 ms)
  softRange: 5,           // metres: soft targeting looks this far
  softCone: 50,           // degrees either side of the intended direction
  flinchGuard: 90,        // frames after a flinch before the same body can be flinched again
  lockRange: 14,          // metres: lock-on reaches this far (and only what can be seen)
  lockLost: 90,           // frames out of sight before a lock drops
  poiseDelay: 120,        // frames without poise damage before poise refills
  poiseRegen: 1,          // poise a second once refilling
  knockdownPoise: -2,     // poise driven this far below zero puts the body down
  frostPoise: 1.5,        // poise damage taken on frost (18.8: frost costs poise for both sides)
  wetPoise: 1.25,         // and on wet stone
  gust: 20,               // m/s: a gust over this staggers anyone in a heavy's wind-up (18.8)
  loadBands: [2, 5],      // load at or below 2 is light, at or below 5 medium, above heavy
  loadRegen: { light: 1.2, medium: 1, heavy: 0.8 },  // breath recovery by load band
};
