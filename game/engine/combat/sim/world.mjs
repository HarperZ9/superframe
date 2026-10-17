// The combat world: a fixed-timestep simulation at 60 frames a second. Given the same arena,
// night, seed and per-frame inputs, it produces the same frames, so a fight can be recorded as
// its inputs and replayed exactly (replay() below; tests/replay.test.mjs).
//
//   const W = createWorld({ G, arena, fighters: [{ id, team, def, moves, x, z, face, brain }],
//                           seed, minutesPerFrame })
//   W.step({ lamb: { mx, mz, press: ["light"], hold: { heavy: true, block: false } } }) -> events
//   W.result  null while the fight runs, then { outcome, reason, tick }
//   W.hash()  a number over the whole simulated state
//
// Inputs: mx, mz (the stick in arena axes, -1..1), press (light, heavy, catch, step, roll,
// shove, grapple, use, lock, next, prev, or a move id the fighter owns), hold (heavy charges,
// block raises the guard). Fighters with a brain get their input from it (ai/brain.mjs).
// Outcomes: win (every opponent down), yield (the rest gave in), fled (Lamb left by an exit),
// down (Lamb's Standing gone), lose (the tide ended it: arena.tideEnds and water at Lamb's waist),
// talk (Lamb took a talk exit the content offered: W.offerTalk, then a "talk" press).
// Immediate actions (no move): lock, next, prev, lantern (shutter or unshutter), interact (work a
// prop in reach: sim/props.mjs), talk. Openings (sneak, alerted, open): sim/stealth.mjs.
import { defineMoves } from "./moves.mjs";
import { COMMON, RULES } from "../data/common.mjs";
import { createField } from "./field.mjs";
import { createFighter, consumeBuffer, stepAction, stepFree, stepRecovery, integrate, startMove } from "./fighter.mjs";
import { findContacts, applyHit } from "./hits.mjs";
import { softTarget, riposteTarget, toggleLock, switchLock, keepLock, lamps, visible } from "./target.mjs";
import { spawnProjectile, stepProjectiles } from "./projectiles.mjs";
import { createBarks } from "./barks.mjs";
import { COMPOSURE } from "../data/build.mjs";
import { stepAwareness, takedownTarget, applyOpening } from "./stealth.mjs";
import { installProps, interact, stepProps, parseProp, anchorProps } from "./props.mjs";
import { hashStr } from "../../core/rng.mjs";

export function createWorld({ G, arena, fighters, seed = 1, minutesPerFrame = 0, envEvery = 30, record = false, barks = true, barkText = null, opening = "open", lastSeen = null, props = [], limitFrames = 0, endEmpty = false }) {
  const table = { ...COMMON };
  for (const f of fighters) Object.assign(table, f.moves || {});
  const W = {
    G, tick: 0, seed: seed >>> 0, moves: defineMoves(table), defs: {}, fighters: [], brains: {}, projectiles: [], nextProj: 0, groundLights: [],
    events: [], record: record ? [] : null, minutesPerFrame, envEvery, field: createField({ G, arena }), lampsNow: null,
    result: null, fleeT: 0, struck: [], seenViolence: false, limitFrames, endEmpty, props: [], talk: null, opening: "open", barks: barks ? createBarks(barkText ? { text: barkText } : {}) : null,
  };
  for (const f of fighters) {
    W.defs[f.id] = { ...f.def, moves: Object.keys(f.moves || {}) };
    W.fighters.push(createFighter(f.def, f));
    if (f.brain) W.brains[f.id] = f.brain;
  }
  W.emit = (e) => { W.events.push({ t: W.tick, ...e }); };
  W.byId = (id) => W.fighters.find((F) => F.id === id) || null;
  W.softTarget = (F, a) => softTarget(W, F, a);
  W.riposteTarget = (F) => riposteTarget(W, F);
  W.visible = (A, B) => visible(W, A, B);
  W.useItem = (F, m) => useItem(W, F, m);
  W.step = (inputs = {}) => step(W, inputs);
  W.hash = () => hashWorld(W);
  W.lamb = () => W.fighters.find((F) => F.team === "lamb");
  W.takedownTarget = (F) => takedownTarget(W, F);
  // a talk exit the content offers now (encounter.mjs sets it; null withdraws it)
  W.offerTalk = (offer) => { const was = W.talk && W.talk.node; W.talk = offer; if (offer && offer.node !== was) W.emit({ type: "talk.offer", ...offer }); if (!offer && was) W.emit({ type: "talk.withdrawn" }); };
  installProps(W, anchorProps(arena, [...(arena.props || []).map((w) => parseProp(w)), ...props]));
  applyOpening(W, opening, { lastSeen });
  return W;
}

function useItem(W, F, m) {
  F.items[m.item.use]--;
  if (m.item.use === "lantern") F.lantern = 0;
  if (m.item.heal) { F.hp = Math.min(F.hpMax, F.hp + m.item.heal); W.emit({ type: "heal", id: F.id, n: m.item.heal }); }
  if (m.item.proj) spawnProjectile(W, F, m);
}

// Inputs for this frame: external ones as given, a brain's for the rest. Presses go to the
// buffer; lock presses act at once.
function gather(W, inputs) {
  for (const F of W.fighters) {
    const brain = W.brains[F.id], idle = F.out || F.fallen || F.yielded;
    const inp = inputs[F.id] || (brain && !idle ? brain(W, F) : null) || {};
    F.inp = inp;
    for (const a of inp.press || []) {
      if (a === "lock") toggleLock(W, F);
      else if (a === "next" || a === "prev") switchLock(W, F, a === "next" ? 1 : -1);
      else if (a === "lantern") shutter(W, F);
      else if (a === "interact") { if (!F.act && !F.fallen) interact(W, F); }
      else if (a === "talk") talkExit(W, F);
      else F.buf.push({ a, t: W.tick, ...heldPress(W, F) });
    }
  }
  if (W.record) W.record.push(JSON.parse(JSON.stringify(inputs)));
}

// Is a press made now held to the current move's window? (fighter.mjs consumeBuffer)
function heldPress(W, F) {
  if (!F.act) return {};
  const m = W.moves[F.act.id], from = m.kind === "dodge" ? (m.iframes ? m.iframes[0] + 2 : 0) : m.startup;
  return F.act.f >= from ? { held: true, seq: F.act.seq } : {};
}

// A talk exit costs Composure (19.2): the words have to be found in the middle of it.
function talkExit(W, F) {
  if (F.team !== "lamb" || !W.talk || F.fallen) return;
  const cost = W.talk.cost ?? COMPOSURE.talk;
  if (F.composure < cost) { W.emit({ type: "nocomposure", id: F.id, action: "talk" }); return; }
  F.composure -= cost; W.talkTaken = W.talk;
}

// Shutter or unshutter a carried lantern (not one already thrown).
function shutter(W, F) {
  if (!(F.items.lantern > 0)) return;
  F.lantern = F.lantern > 0 ? 0 : W.defs[F.id].lantern || 5;
  W.emit({ type: "lantern", id: F.id, lit: F.lantern > 0 });
}

// A gust over the limit staggers anyone in the wind-up of a guard-breaking swing (18.8).
function gust(W, F) {
  if (!F.act || F.act.gusted || W.field.terms.windSpeed <= RULES.gust) return;
  const m = W.moves[F.act.id];
  if (!m.guardBreak || F.act.f >= m.startup) return;
  F.act.gusted = true;
  startMove(W, F, "stagger");
  W.emit({ type: "gust", id: F.id, speed: W.field.terms.windSpeed });
}

function stepFighter(W, F) {
  if (F.flash > 0) F.flash--;
  if (F.hitstop > 0) { F.hitstop--; return; }
  if (F.out || F.fallen) return;
  const inp = F.inp || {};
  consumeBuffer(W, F, inp);
  gust(W, F);
  if (F.act) { stepAction(W, F, inp); if (!F.act && !F.yielded) consumeBuffer(W, F, inp); }
  else if (!F.yielded) stepFree(W, F, inp);
  if (!F.act && (F.hp <= 0 || F.yielded)) settle(W, F);
  stepRecovery(W, F);
  integrate(W, F);
}

// A fall or a yield that has played out: Lamb is Down; a foe is out of the fight (never dead).
function settle(W, F) {
  if (F.team === "lamb") { F.fallen = true; W.emit({ type: "down", id: F.id }); }
  else { F.out = true; W.emit({ type: "out", id: F.id, yielded: F.yielded }); }
  F.lock = null;
}

// Bodies do not overlap: push pairs apart along the line between them, half each.
function separate(W) {
  const live = W.fighters.filter((F) => !F.out && !F.fallen);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const A = live[i], B = live[j], min = W.defs[A.id].radius + W.defs[B.id].radius;
    const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
    if (d >= min) continue;
    const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0, push = (min - d) / 2;
    // the push never moves a body into solid ground
    if (!W.field.solid(A.x - nx * push, A.z - nz * push)) { A.x -= nx * push; A.z -= nz * push; }
    if (!W.field.solid(B.x + nx * push, B.z + nz * push)) { B.x += nx * push; B.z += nz * push; }
  }
}

// Who Lamb struck, and whether someone who keeps a book could see it (SYSTEMS-FULL 18.10). Grit
// for the tool arts fills here too: a blow landed, a catch, a riposte.
function witness(W) {
  const L0 = W.lamb();
  for (const e of W.events) {
    const fill = (n) => { L0.composure = Math.min(L0.composureMax, L0.composure + n); };
    if (L0 && e.type === "parry" && e.id === L0.id) fill(COMPOSURE.catch);
    if (L0 && e.type === "hit" && e.by === L0.id) fill(e.move === "riposte" ? COMPOSURE.riposte : COMPOSURE.hit);
    if (e.type === "tell") W.telegraphsSeen = (W.telegraphsSeen || 0) + 1;
    if (e.type !== "hit" || e.by !== (W.lamb() || {}).id) continue;
    if (!W.struck.includes(e.id)) W.struck.push(e.id);
    const L = W.lamb();
    if (W.fighters.some((F) => W.defs[F.id].faction === "trust" && !F.out && W.visible(F, L))) W.seenViolence = true;
  }
}

function judge(W) {
  const L = W.lamb(), foes = W.fighters.filter((F) => F.team !== "lamb");
  const end = (outcome, reason) => { W.result = { outcome, reason, tick: W.tick }; W.emit({ type: "end", outcome, reason }); };
  if (!L) return;
  if (W.talkTaken) return end("talk", W.talkTaken.node);
  if (L.fallen) return end("down", "standing");
  if (!foes.length) { if (W.endEmpty) end("win", "nobody"); return; }
  if (foes.every((F) => F.out)) return end(foes.every((F) => F.yielded) ? "yield" : "win", "opponents");
  if (W.limitFrames && W.tick >= W.limitFrames) return end(breakOff(W, L, foes), "time");
  // fleeing takes intent: Lamb free, in an exit, and steering (a knockback into an exit is not flight)
  const steering = L.inp && Math.hypot(L.inp.mx || 0, L.inp.mz || 0) > 0.2;
  W.fleeT = W.field.inExit(L.x, L.z) && !L.act && steering ? W.fleeT + 1 : 0;
  if (W.fleeT >= 45) return end("fled", "exit");
  // the sea's own level, not a sluice's local flood
  if (W.field.arena.tideEnds && W.field.waterY() - W.field.cellAt(L.x, L.z).h >= 0.85) return end("lose", "tide");
}

// A fight that reaches its time cap breaks off: if Lamb has hurt them more than they have hurt
// Lamb, they give it up (yield); otherwise Lamb gets clear (fled). A brawl breaks up the same way.
function breakOff(W, L, foes) {
  const theirs = foes.reduce((s, F) => s + (F.hpMax - F.hp) / F.hpMax, 0) / Math.max(1, foes.length), mine = (L.hpMax - L.hp) / L.hpMax;
  return W.brawl || (theirs > mine && W.struck.length) ? "yield" : "fled";
}

function step(W, inputs) {
  W.events = [];
  if (W.result) return W.events;
  W.tick++;
  if (W.minutesPerFrame) W.G.env.advance(W.minutesPerFrame);
  if (W.tick % W.envEvery === 1) W.field.refresh();
  W.lampsNow = lamps(W);
  gather(W, inputs);
  for (const F of W.fighters) stepFighter(W, F);
  separate(W);
  for (const [A, T, m] of findContacts(W)) applyHit(W, A, T, m);
  stepProjectiles(W);
  stepProps(W);
  stepAwareness(W);
  for (const F of W.fighters) keepLock(W, F);
  witness(W);
  if (W.barks) W.barks(W);
  judge(W);
  return W.events;
}

function hashWorld(W) {
  const strip = (F) => { const { inp, ...rest } = F; return rest; };
  return hashStr(JSON.stringify({ t: W.tick, f: W.fighters.map(strip), p: W.projectiles, l: W.groundLights, q: W.props, w: W.field.floods, c: W.G.env.clock() }), W.seed);
}

// Run a recorded fight again from a fresh world. make() builds the same world (fresh night too).
export function replay(make, record) {
  const W = make();
  for (const inp of record) W.step(inp);
  return W;
}
