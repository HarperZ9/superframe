// An inner fight (design/spine-plan/08-ARENA.md, 10-INFERNO.md): the combat world on the flaw's own ground, with
// the rules the flaw brings laid over it. The world (combat/sim/world.mjs) stays as it is; this wraps its step:
//   before   Lamb's input read for the verbs (combat/arena/innerverbs.mjs: lay, the strikes a laid tool refuses)
//   after    the fight rules (Fond of Them's healing catch, The Figure's mirror); a phase change plays its morph
//            (look, scale, the arena closing in, the lights) and its ground (combat/arena/innerhaz.mjs) and quiets
//            the hands for MORPH.quiet frames; the hazards; phase triggers other than standing; the optional layers
//            once the fight is joined: the yield's act (rub, outlast, read, after), endure (rests, standing at an
//            anchor); the cap. Force is a fall (combat/data/fights.mjs).
//   result   win never: a boss brought down is `forced`; down, fled, endured, laid as the verbs (innerverbs.mjs)
//   the prop (combat/arena/innerprop.mjs): a committed blow carried onto it smashes it and the boss reels
//   const W = createInnerWorld({ G, flaw, seed, levels, boons })   W.step(inputs)   W.inner (state for the drawer)
import { createWorld } from "../sim/world.mjs";
import { dist, angleTo, wrapAngle, settleClear } from "../sim/fighter.mjs";
import { go } from "../sim/paths.mjs";
import { INNER_ARENAS, bowl } from "../data/arenas-inner.mjs";
import { flawBossSpec, innerSummoner, innerLamb, embody } from "./innerspawn.mjs";
import { readLamb, endAs, convertResult, endureStep, MORPH } from "./innerverbs.mjs";
import { pathed } from "./innerpath.mjs";
import { datan2, dcos, dhypot, dsin } from "../sim/math.mjs";
import { installProp, propStep, propPhase } from "./innerprop.mjs";
import { installHazards, stepHazards, changeGround } from "./innerhaz.mjs";

const DEG = 180 / Math.PI;

export function createInnerWorld({ G, flaw, seed = 1, levels = {}, boons = [], arena: arenaOver = null, lambAt = null, bossAt = null, record = false }) {
  const base = arenaOver || INNER_ARENAS[flaw.arena];
  if (!base) throw new Error(`inner: no arena ${flaw.arena} for ${flaw.id}`);
  // a way out only where the flaw can be refused (08-ARENA: "for this one there is a door")
  const arena = { ...base, rows: [...base.rows], exits: flaw.verbs.refuse ? [...(base.door || [])] : [] };
  const L = innerLamb(flaw, { levels, boons }), at = lambAt || arena.spawns.lamb; L.x = at[0]; L.z = at[1];
  const B = flawBossSpec("boss", flaw, bossAt || arena.spawns.foes[0], { face: angleTo({ x: (bossAt || arena.spawns.foes[0])[0], z: (bossAt || arena.spawns.foes[0])[1] }, { x: at[0], z: at[1] }) });
  const traitAt = embody(B, flaw, levels); // the trait as strong in the dream as it is in him (design/TRAITS.md section 2)
  const W = createWorld({ G, arena, fighters: [L, B], seed, record, barks: false });
  W.summon = innerSummoner(W, arena);
  W.brains.boss = pathed(W.brains.boss, (W2) => W2.lamb()); // round the maze's stacks and the closing walls
  W.inner = {
    flaw: flaw.id, kind: "flaw", lay: 0, laid: false, layAt: null, rested: 0, lastHit: -1e9, struck: false,
    scale: 1, bowl: 0, look: null, morphAt: -1e9, phase: -1, atFloor: 0, outlast: 0, rub: 0, handsStill: false, thread: [[at[0], at[1]]], baseRows: [...base.rows],
    advanced: 0, quieted: 0, standT: 0, phaseAt: 0,
    bossIds: ["boss"], numbers: false, anchor: flaw.anchor, flawRec: flaw, trait: traitAt,
  };
  W.inner.say = (at) => say(W, flaw, at);
  installHazards(W); // the ground as a threat (combat/arena/innerhaz.mjs)
  W.inner.open = !flaw.fight; // the optional layers, once the fight is joined (after())
  const nose = +W.defs.lamb.nose || 0; // The Nose (Under the Goats, innerspawn.mjs): every foe's tell starts sooner for him
  if (nose) for (const [id, m] of Object.entries(W.moves)) if (m.tell && !id.startsWith("lamb")) W.moves[id] = { ...m, tell: { ...m.tell, at: [Math.max(0, m.tell.at[0] - nose), m.tell.at[1]] } };
  installProp(W, flaw);
  // a real fight's door opens only once the fight is joined (after())
  if (flaw.fight) W.field.arena.exits = [];
  W.inner.door = flaw.verbs.refuse ? [...(base.door || [])] : [];
  const step0 = W.step;
  W.step = (inputs = {}) => {
    if (W.result) return [];
    const lamb = readLamb(W, inputs.lamb || {});
    step0({ ...inputs, lamb });
    if (W.result) convertResult(W);
    if (!W.result) after(W, flaw, W.events);
    return W.events;
  };
  return W;
}

// the flaw's lines (all PROPOSAL) as barks: at the start, at each phase, when the tool is laid
function say(W, flaw, at) {
  for (const l of (flaw.lines || []).filter((x) => x.at === at)) W.emit({ type: "bark", voice: l.voice, text: l.text, id: "boss", proposal: true });
}

function after(W, flaw, ev) {
  const I = W.inner, B = W.byId("boss"), L = W.lamb();
  if (W.tick === 1) say(W, flaw, "start");
  // the optional layers (the verbs without force, the door) open only once the fight is joined: a real fight's boss
  // driven into its second phase (the rework of 2026-10-23: never the main way through)
  I.open = !flaw.fight || I.phase >= 1;
  propStep(W);
  if (I.door.length && I.open && !W.field.arena.exits.length) W.field.arena.exits = [...I.door];
  for (const e of ev) {
    if (e.type === "boss.phase" && e.id === "boss") phase(W, flaw, e.phase);
    if (e.type === "parry" && e.id === "boss") caught(W, flaw);
    if (e.type === "move" && e.id === "lamb") lambString(W, e.move);
    if (e.type === "join") quietHand(W, e.id);
    if (e.type === "hit" && e.by === "lamb") { I.lastHit = W.tick; I.struck = true; strike(W, flaw, e); if (W.result) return; }
  }
  stepHazards(W, flaw.phases[I.phase], ev);
  if (W.result) return;
  if (!I.laid && W.tick % 10 === 0 && L) I.thread.push([+L.x.toFixed(2), +L.z.toFixed(2)]);
  trigger(W, flaw);
  // the force endings that are not a fall (a fall is the world's own `win`, converted)
  if (flaw.force.ends === "floor" && B && B.hp <= flaw.floor * B.hpMax + 1e-6 && I.atFloor >= (flaw.force.atFloor || 1)) return endAs(W, "forced", "floor");
  const V = flaw.verbs;
  const ok = I.open; // no ending without force before the fight is joined
  if (V.endure && V.endure.stand) { if (ok && standStep(W, flaw, ev)) return endAs(W, "endured", "stood"); }
  else if (V.endure && ok && endureStep(W, ev, V.endure.rounds)) return endAs(W, "endured", "rests");
  if (V.yield && I.laid && ok) yieldStep(W, flaw, ev);
  const P = flaw.phases[I.phase]; if (P && P.eat && (W.tick - I.phaseAt) % P.eat.every === P.eat.every - 1 && I.advanced < P.eat.most) advance(W, I.advanced + 1);
  if (!W.result && W.tick >= (flaw.limit || 60 * 180)) endAs(W, "down", "time"); // the night ends under it: the loss beat plays
}

// A phase begins: its hands, its morph (from the second phase on), its line, a human voice from outside.
function phase(W, flaw, idx) {
  const I = W.inner, P = flaw.phases[idx]; if (!P || idx === I.phase) return;
  I.phase = idx; I.phaseAt = W.tick;
  if (P.hands) { I.handsStill = !!P.hands.still; for (const F of W.fighters) if (F.id.startsWith("boss-hand") && P.hands.speed != null) W.defs[F.id].speed = P.hands.speed; }
  const M = P.morph;
  if (M && idx > 0) {
    I.morphAt = W.tick; if (M.look) I.look = M.look;
    for (const F of W.fighters) if (F.id.startsWith("boss-hand") && F.act) F.act = null; // every hand stops: the boss roars through the morph (F3)
    if (M.scale) resize(W, M.scale);
    if (M.bowl) closeIn(W, M.bowl);
    if (M.lights) W.field.arena.lights = M.lights.map((l) => ({ ...l }));
    if (M.dark) { W.field.arena.blackout = true; W.field.refresh(); } // only the morph's own lamps light the room
    if (M.frost) W.field.arena.rows = W.field.arena.rows.map((r) => r.replace(/\./g, "f")); // the floor freezes (The Figure's river)
    if (M.dim) W.field.arena.lights = W.field.arena.lights.map((l) => ({ ...l, k: l.k * M.dim }));
    W.emit({ type: "morph", phase: idx, look: M.look || null });
  }
  if (P.ground) changeGround(W, P.ground);
  propPhase(W);
  if (idx > 0) say(W, flaw, idx);
  if (P.voice) W.emit({ type: "bark", voice: P.voice.voice, text: P.voice.text, human: !!P.voice.human, proposal: true });
}

// The boss caught a blow (a catch, combat/sim/hits.mjs): Fond of Them heals by its catch, and a counter with a
// riposte follows at once (combat/ai/duel.mjs reads the queue)
function caught(W, flaw) {
  const B = W.byId("boss"), I = W.inner; if (!B) return;
  for (const s of flaw.strike || []) if (s.kind === "parryheal" && !B.out) { B.hp = Math.min(B.hpMax, B.hp + s.heal); I.healed = (I.healed || 0) + s.heal; W.emit({ type: "heal", id: "boss", by: s.heal }); }
  const C = (flaw.phases[Math.max(0, I.phase)] || {}).counter; if (C && C.then && B.mem) { B.mem.queue = [C.then]; B.mem.string = [C.move]; B.mem.after = C; }
}
// The player's last string, as The Figure answers it: light, heavy or charged blows within 90 frames of each other
function lambString(W, id) {
  const k = /heavy_charged/.test(id) ? "charged" : /heavy$/.test(id) ? "heavy" : /light_\d$/.test(id) ? "light" : null; if (!k) return;
  const I = W.inner; if (W.tick - (I.lastStringAt || -1e9) > 90) I.lastString = [];
  I.lastString = [...(I.lastString || []), k].slice(-3); I.lastStringAt = W.tick;
}

// The boss's size: a morph's scale (Saturn, the arm) or the Golem's clay. The hurt volume grows with it.
function resize(W, s) {
  const I = W.inner, d = W.defs.boss; I.scale = s;
  d.height = +(d.baseHeight * s).toFixed(3); d.radius = +(d.baseRadius * (1 + (s - 1) * 0.35)).toFixed(3);
}

// The arena closes in: rows outside an ellipse inset by n cells turn solid; bodies left inside a wall step out
function closeIn(W, n) {
  const I = W.inner; if (n <= I.bowl) return; I.bowl = n;
  W.field.arena.rows = bowl(I.baseRows, n);
  const b = W.field.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  for (const F of W.fighters) {
    for (let k = 0; k < 40 && W.field.solid(F.x, F.z); k++) { const a = datan2(cz - F.z, cx - F.x); F.x += dcos(a) * 0.25; F.z += dsin(a) * 0.25; }
    settleClear(W, F);
  }
  W.emit({ type: "closein", n });
}

// Hands called in keep still (the coats sit) unless the character comes within reach, and every hand is quiet
// for MORPH.quiet frames after a morph
function quietHand(W, id) {
  const orig = W.brains[id]; if (!orig || orig.quiet) return;
  const q = (W2, F) => {
    const I = W.inner, L = W.lamb();
    if (W.tick - I.morphAt < MORPH.quiet) return { mx: 0, mz: 0 };
    if (I.handsStill && L && dist(F, L) > 1.7) { F.face = angleTo(F, L); return { mx: 0, mz: 0 }; }
    return orig(W2, F);
  };
  const p = pathed(q, (W2) => W2.lamb()); p.quiet = true; W.brains[id] = p;
}

// What a blow the player lands does. Since the rework of 2026-10-23 (combat/data/fights.mjs) a landed blow only
// harms: the old on-strike rules that healed, slowed, swallowed, posted or proved the lie are gone. The two fight
// rules left act on the boss's catch and on the player's string (caught(), lambString()). A floor (a checker's
// planted control, combat/tools/flawcheck.mjs S5) is still counted.
function strike(W, flaw, e) {
  const I = W.inner, B = W.byId("boss");
  if (B && e.id === "boss" && flaw.floor && B.hp <= flaw.floor * B.hpMax + 1e-6) { I.atFloor++; W.emit({ type: "atfloor", n: I.atFloor }); }
}

// The wall: columns 1..n of every inner row turn solid; a body caught in them steps out toward the open street
function advance(W, n) {
  const I = W.inner; if (n <= I.advanced) return; I.advanced = n;
  W.field.arena.rows = W.field.arena.rows.map((r, z, all) => (z === 0 || z === all.length - 1 ? r : r[0] + "K".repeat(n) + r.slice(n + 1)));
  for (const F of W.fighters) { for (let k = 0; k < 40 && W.field.solid(F.x, F.z); k++) F.x += 0.25; settleClear(W, F); }
  W.emit({ type: "advance", n });
}

// Endure by standing (Everybody Says): within r of the anchor, striking nothing, one live head goes quiet each
// `every` frames, the horn last; stepping off the stone or landing a blow wakes the clock (the quiet heads stay
// quiet: nothing posted comes back down, and nothing is deleted)
function standStep(W, flaw, ev) {
  const I = W.inner, S = flaw.verbs.endure.stand, L = W.lamb(), [ax, az] = (W.field.arena.anchors[S.anchor] || [[0, 0]])[0];
  if (ev.some((e) => e.type === "hit" && e.by === "lamb")) { I.standT = 0; return false; }
  if (!L || L.fallen || dhypot(L.x - ax, L.z - az) > S.r) { if (I.standT) W.emit({ type: "stand.broken" }); I.standT = 0; return false; }
  I.standT++;
  if (I.standT % S.every !== 0) return false;
  const heads = W.fighters.filter((F) => F.id.startsWith("boss-hand") && !F.out);
  if (heads.length) { const F = heads[0]; F.out = true; F.yielded = true; I.quieted++; W.emit({ type: "out", id: F.id, quiet: true }); say(W, flaw, "quiet"); return false; }
  W.emit({ type: "quiet", id: "boss" }); return true;
}

// Phase triggers that are not standing: time (or the first blow), the player gone still, grown, near an anchor
function trigger(W, flaw) {
  const I = W.inner, B = W.byId("boss"); if (!B || !B.mem || B.mem.phase == null) return;
  flaw.phases.forEach((P, idx) => {
    const T = P.trigger; if (!T || idx <= B.mem.phase || B.mem.hold === idx) return;
    const L = W.lamb(), fire =
      (T.kind === "time" && (W.tick >= T.frames || (T.struck && I.struck))) ||
      (T.kind === "still" && W.tick >= (T.from || 0) && W.tick - Math.max(I.lastHit, 0) >= T.frames && B.mem.phase >= 0) ||
      (T.kind === "grown" && I.scale >= T.scale) ||
      (T.kind === "near" && L && (W.field.arena.anchors[T.anchor] || []).some(([x, z]) => dhypot(L.x - x, L.z - z) <= T.r));
    if (fire) B.mem.hold = idx;
  });
}

// The yield's act, once the tool is down: wait (the clock runs, the beast passes by), outlast its drags, or
// rub the word from its brow under its blows (a held interact in reach and in front of it; letting go resets)
function yieldStep(W, flaw, ev) {
  const I = W.inner, Y = flaw.verbs.yield, F = Y.follow, B = W.byId("boss"), L = W.lamb();
  if (Y.passes && B && !I.passing) { I.passing = true; const [x, z] = W.field.arena.anchors[Y.passes][0]; W.brains.boss = (W2, Fb) => (dist(Fb, { x, z }) < 0.8 ? { mx: 0, mz: 0 } : { ...go(W2, Fb, x, z, 1), hold: { run: false } }); }
  if (!F) { if (W.tick - I.layAt >= (Y.after || 0)) endAs(W, "laid", "after"); return; }
  if (F.kind === "outlast") {
    for (const e of ev) if (e.type === "move" && e.id === "boss" && e.move === F.move && e.t >= I.layAt) I.outlast++;
    if (I.outlast >= F.n && !(B.act && B.act.id === F.move) && !L.fallen) endAs(W, "laid", "outlast");
    return;
  }
  if (F.kind === "stand" && L) { // put the tool down and hold a place under its blows (Under the Goats: the bare rock)
    const [ax, az] = (W.field.arena.anchors[F.at] || [[0, 0]])[0], held = L.inp && L.inp.hold && L.inp.hold.interact && dhypot(L.x - ax, L.z - az) <= F.reach && !L.fallen;
    I.rub = held ? I.rub + 1 : 0;
    if (I.rub >= F.hold) endAs(W, "laid", "stood");
    return;
  }
  if (F.kind === "rub" && B && L) {
    const facing = Math.abs(wrapAngle(angleTo(B, L) - B.face)) * DEG <= 75, held = (L.inp && L.inp.hold && L.inp.hold.interact) && dist(B, L) <= F.reach && facing && !L.fallen && I.phase >= (F.from || 0); // under its blows: not while it still walks beside him
    I.rub = held ? I.rub + 1 : 0;
    if (held && I.rub % 15 === 0) W.emit({ type: "rub", n: I.rub });
    if (I.rub >= F.hold) { I.rubbed = true; endAs(W, "laid", "rub"); }
  }
}
