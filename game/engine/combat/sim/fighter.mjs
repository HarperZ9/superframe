// A fighter: plain data (so the world can be hashed, saved and replayed) plus the step that moves
// it one frame. Every action runs through the move table; staggers and falls are moves too.
// Action names: light, heavy, catch, step, roll, shove, grapple, use; block is held (a stance).
import { DT, canCancel, rootSpeed, phaseOf } from "./moves.mjs";
import { RULES } from "../data/common.mjs";
import { RUN } from "../data/build.mjs";

const TAU = Math.PI * 2;
export const wrapAngle = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
export const dirOf = (a) => [Math.cos(a), Math.sin(a)];
export const angleTo = (A, B) => Math.atan2(B.z - A.z, B.x - A.x);
export const dist = (A, B) => Math.hypot(B.x - A.x, B.z - A.z);

export function createFighter(def, { id, team, x, z, face = 0 }) {
  return {
    id, team, kind: def.kind, x, z, face, vx: 0, vz: 0, kx: 0, kz: 0,
    hp: def.hp, hpMax: def.hp, st: def.stamina, stMax: def.stamina, stWait: 0, winded: false,
    poise: def.poise, poiseMax: def.poise, poiseWait: 0, guardT: 0, blind: 0,
    act: null, hitstop: 0, flash: 0, lock: null, lockLost: 0, buf: [], items: { ...(def.items || {}) },
    out: false, fallen: false, yielded: false, lastOffense: 0, aware: true, notice: 1, composure: 0, composureMax: def.composureMax || 0, running: false, lantern: def.lantern || 0, lastHitBy: null, tool: def.tool ? def.tool.id : null,
  };
}

const MOVE_INPUT = 0.2;
export const inputDir = (inp) => (Math.hypot(inp.mx || 0, inp.mz || 0) > MOVE_INPUT ? Math.atan2(inp.mz, inp.mx) : null);
const has = (F, use) => F.items[use] > 0;

// Which move an action name means now. Returns null when it means nothing.
export function resolveAction(W, F, a, inp) {
  const def = W.defs[F.id], set = F.tool ? def.moveset : { ...def.moveset, ...def.hands }, cur = F.act && W.moves[F.act.id];
  if (a === "roll") return chooseRoll(W, F, set.roll);
  if (a === "art" || a === "art2") return set[a] && F.composure >= W.moves[set[a]].composure ? set[a] : (W.emit({ type: "nocomposure", id: F.id, action: a }), null);
  if (a === "light" && set.run && F.running && !F.act) return set.run;
  if (a === "light" && set.takedown && W.takedownTarget(F)) return set.takedown;
  if (a === "light" && set.riposte && W.riposteTarget(F)) return set.riposte;
  if (cur && cur.next[a]) return cur.next[a];
  if (a === "use") return (set.use || []).find((id) => has(F, W.moves[id].item.use)) || null;
  // a learned variant rides on the action while Lamb can pay for it (data/learned.mjs)
  const v = ((def.variants || {})[a] || []).find((vid) => W.moves[vid] && F.composure >= W.moves[vid].composure && (!W.moves[vid].item || has(F, W.moves[vid].item.use)));
  if (v) return v;
  const id = typeof set[a] === "string" ? set[a] : def.moves.includes(a) ? a : null;
  if (!id || !W.moves[id]) return null;
  const m = W.moves[id];
  if (m.item && !has(F, m.item.use)) return null;
  return id;
}

// The roll's form: knee-deep water or mud lurches, waist-deep refuses, otherwise by load.
export function chooseRoll(W, F, forms) {
  if (!forms) return null;
  const foot = W.field.footing(F.x, F.z);
  if (foot.band === "waist") return null;
  if ((foot.band === "knee" || foot.surface === "mud") && !(W.defs[F.id].learned || []).includes("mudstep")) return forms.lurch;
  return forms[W.defs[F.id].load] || forms.medium;
}

// May this fighter start an action now (free, or inside the current move's cancel window)?
export function canAct(W, F, a) {
  if (F.out || F.fallen || F.yielded) return false;
  if (!F.act) return true;
  if (F.act.charging) return false;
  return canCancel(W.moves[F.act.id], F.act.f, a);
}

// The direction an action goes: the stick for footwork, then the lock, the stick, soft targeting.
function actionAngle(W, F, m, inp) {
  const stick = inputDir(inp);
  if (["stagger", "down", "fall"].includes(m.kind)) return F.face;
  if (m.dir === "input") return stick ?? F.face;
  const locked = F.lock != null && W.byId(F.lock);
  if (locked) return angleTo(F, locked);
  const want = stick ?? F.face, soft = W.softTarget(F, want);
  return soft ? angleTo(F, soft) : want;
}

export function startMove(W, F, id, inp = {}, extra = {}) {
  const m = W.moves[id];
  if (!m) throw new Error(`combat: no move ${id}`);
  if (m.composure) F.composure = Math.max(0, F.composure - m.composure);
  if (m.stamina > 0) {
    F.st -= m.stamina; F.winded = F.st <= 0; if (F.st < 0) F.st = 0;
    F.stWait = W.defs[F.id].staminaDelay * (F.winded ? 2 : 1);
  }
  const foot = W.field.footing(F.x, F.z), slow = m.kind === "dodge" ? foot.recovery : 0;
  // COAT shortens the hit-stun a body suffers (sim/tempo.mjs); only a staggered or downed body
  const t = W.defs[F.id].tempo, stun = t && (m.kind === "stagger" || m.kind === "down") ? t.stun : 1;
  const dir = wrapAngle(actionAngle(W, F, m, inp)), locked = F.lock != null && W.byId(F.lock);
  // under a lock a dodge keeps the eyes on the target and goes where the stick says
  if (!(m.dir === "input" && locked)) F.face = dir;
  F.guardT = 0;
  // movement hands into the move: 60% of the walking speed carries, fading over 12 frames
  const carry = m.kind === "attack" || m.kind === "riposte" ? [F.vx * 0.6, F.vz * 0.6] : null;
  F.act = { id, f: 0, end: Math.round(m.total * stun) + slow, hit: [], charge: 0, charging: false, dir, seq: (F.seq = (F.seq || 0) + 1), carry, ...extra };
  if (["attack", "riposte", "parry"].includes(m.kind) || m.shove || m.grapple) F.lastOffense = W.tick;
  if (m.resetRead || m.behind) learnedStart(W, F, m); // after F.act exists: the turn re-aims it
  W.emit({ type: "move", id: F.id, move: id });
  if (m.tell) W.emit({ type: "tell", id: F.id, move: id, kind: m.tell.kind, frames: m.startup });
}

// Try buffered presses, newest first, against what the fighter may do this frame. A press made
// once the current move has passed its wind-up (a dodge: its window's opening) is held until the
// move lets it out or ends ("buffer early, cancel late", COMBAT-FEEL v2 3.3); any other press
// expires after RULES.buffer frames.
export function consumeBuffer(W, F, inp) {
  F.buf = F.buf.filter((b) => (b.held && F.act && F.act.seq === b.seq) || W.tick - b.t <= RULES.buffer);
  for (let i = F.buf.length - 1; i >= 0; i--) {
    const a = F.buf[i].a;
    if (!canAct(W, F, a)) continue;
    const id = resolveAction(W, F, a, inp);
    if (!id) continue;
    if (W.moves[id].stamina > 0 && F.st < 1) { W.emit({ type: "breathless", id: F.id, action: a }); F.buf.splice(i, 1); continue; }
    F.buf.splice(i, 1);
    startMove(W, F, id, inp);
    return id;
  }
  return null;
}

// Learned moves that act on the fight as they start: Rook's step resets the opponents' read (their
// attack tokens on Lamb and a fresh pause); Pip's turn aims past the nearest opponent to its back.
function learnedStart(W, F, m) {
  const foes = W.fighters.filter((T) => T.team !== F.team && !T.out && !T.fallen);
  if (m.resetRead) { F.tokens = []; for (const T of foes) if (T.mem) { T.mem.cool = Math.max(T.mem.cool || 0, W.tick + 40); T.mem.next = W.tick + 20; } W.emit({ type: "readreset", id: F.id }); }
  if (m.behind && foes.length) { const T = foes.sort((a, b) => dist(F, a) - dist(F, b))[0]; if (dist(F, T) < 3) F.act.dir = angleTo(F, T) + 0.3; }
}

// One frame of the current move: charge, tracking, root motion, item use, end.
export function stepAction(W, F, inp) {
  const m = W.moves[F.act.id], A = F.act, foot = W.field.footing(F.x, F.z);
  // a learned feint: the heavy released early becomes the quick strike
  if (m.tap && A.f > 0 && A.f <= m.tap.before && !(inp.hold && inp.hold.heavy) && F.composure >= (W.moves[m.tap.into].composure || 0)) { startMove(W, F, m.tap.into, inp); return; }
  if (m.charge && A.f === m.charge.at) {
    const holding = !!(inp.hold && inp.hold.heavy);
    if (holding && A.charge < m.charge.max) { A.charge++; A.charging = true; F.vx = F.vz = 0; return; }
    if (A.charging) { A.charging = false; if (A.charge >= m.charge.min) { startMove(W, F, m.charge.into, inp, { charged: A.charge }); return; } }
  }
  const target = F.lock != null ? W.byId(F.lock) : W.softTarget(F, F.face);
  if (m.track > 0 && A.f < m.trackUntil && target) {
    const d = wrapAngle(angleTo(F, target) - F.face), lim = (m.track * Math.PI) / 180;
    F.face = wrapAngle(F.face + Math.max(-lim, Math.min(lim, d)));
  }
  if (m.dir !== "input") A.dir = F.face;
  const sure = m.kind === "dodge" && (W.defs[F.id].learned || []).includes("mudstep");
  const v = rootSpeed(m, A.f) * (sure ? Math.max(1, foot.root) : foot.root), [dx, dz] = dirOf(A.dir ?? F.face);
  F.vx = dx * v; F.vz = dz * v;
  if (A.carry && A.f < 12) { const k = 1 - A.f / 12; F.vx += A.carry[0] * k; F.vz += A.carry[1] * k; }
  if (m.item && A.f === m.startup && has(F, m.item.use)) W.useItem(F, m);
  A.f++;
  if (A.f >= A.end) { F.act = null; if (m.then) startMove(W, F, m.then, inp); }
}

// Free movement: accelerate toward the stick on this footing; face the lock or the stick.
// Holding block raises the guard (after guardFrames) and slows the feet.
export function stepFree(W, F, inp) {
  const def = W.defs[F.id], foot = W.field.footing(F.x, F.z), stick = inputDir(inp);
  F.guardT = inp.hold && inp.hold.block && F.tool ? F.guardT + 1 : 0;
  // raising a guard puts the lantern away, unless Hobb taught Lamb to hold both
  if (F.guardT === 1 && F.lantern > 0 && !(def.learned || []).includes("lampguard") && def.kind === "lamb") { F.lantern = 0; W.emit({ type: "lantern", id: F.id, lit: false, why: "guard" }); }
  // running: faster, paid in Breath every frame it lasts; never while guarding or out of breath
  F.running = !!(inp.hold && inp.hold.run) && F.guardT === 0 && F.st > 0.2 && stick !== null;
  if (F.running) { F.st = Math.max(0, F.st - RUN.breath * DT); F.stWait = Math.max(F.stWait, 10); }
  const guard = F.guardT > 0 ? RULES.guardSpeed : F.running ? RUN.speed : 1;
  const mag = stick === null ? 0 : Math.min(1, Math.hypot(inp.mx, inp.mz));
  const sp = def.speed * foot.speed * mag * guard, tx = stick === null ? 0 : Math.cos(stick) * sp, tz = stick === null ? 0 : Math.sin(stick) * sp;
  const k = Math.min(1, (def.accel * Math.max(0.15, foot.accel) * DT) / Math.max(0.5, def.speed));
  F.vx += (tx - F.vx) * k; F.vz += (tz - F.vz) * k;
  const lock = F.lock != null && W.byId(F.lock), want = lock ? angleTo(F, lock) : stick;
  if (want !== null && want !== false) {
    const d = wrapAngle(want - F.face), lim = def.turn * foot.turn * DT;
    F.face = wrapAngle(F.face + Math.max(-lim, Math.min(lim, d)));
  }
}

export const guarding = (F) => !F.act && F.guardT >= RULES.guardFrames;

// Breath and poise recover on their delays; water and a raised guard slow breath.
export function stepRecovery(W, F) {
  const def = W.defs[F.id], foot = W.field.footing(F.x, F.z), m = F.act && W.moves[F.act.id];
  if (F.blind > 0) F.blind--;
  if (F.stWait > 0) F.stWait--;
  else if (!m || m.kind === "stagger") {
    F.st = Math.min(F.stMax, F.st + def.staminaRegen * foot.regen * (F.guardT > 0 ? RULES.guardRegen : 1) * DT);
    if (F.st > F.stMax * 0.3) F.winded = false;
  }
  if (F.poiseWait > 0) F.poiseWait--;
  else F.poise = Math.min(F.poiseMax, F.poise + RULES.poiseRegen * DT);
}

// Velocity and knockback into position, knockback decaying with the footing's friction.
export function integrate(W, F) {
  const foot = W.field.footing(F.x, F.z), b = W.field.bounds, r = W.defs[F.id].radius;
  // solid ground (a plate's walls and furniture) stops a body on that axis
  const nx = F.x + (F.vx + F.kx) * DT, nz = F.z + (F.vz + F.kz) * DT, f = W.field;
  if (!f.solid(nx, F.z)) F.x = nx; else { F.kx = 0; F.vx = 0; }
  if (!f.solid(F.x, nz)) F.z = nz; else { F.kz = 0; F.vz = 0; }
  const decay = Math.exp(-foot.friction * DT);
  F.kx *= decay; F.kz *= decay;
  if (Math.abs(F.kx) < 1e-3) F.kx = 0;
  if (Math.abs(F.kz) < 1e-3) F.kz = 0;
  F.x = Math.max(b.x0 + r, Math.min(b.x1 - r, F.x)); F.z = Math.max(b.z0 + r, Math.min(b.z1 - r, F.z));
}

export const phase = (W, F) => (F.act ? phaseOf(W.moves[F.act.id], F.act.f) : "free");
