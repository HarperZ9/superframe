// An inner boss's brain (design/COMBAT-SPEC.md 5.2 and 12, the rework of 2026-10-23): a duelist with a readable
// moveset, not a fixed loop. Each phase lists its attacks; the brain picks among those in range by weight (seeded,
// so a run replays exactly), strings follow-ups with mixups (a quick follow, a delayed one, a grab, or nothing),
// keeps its spacing between strings (circling at its range, backing off, closing), answers a wind-up it can read
// with its counter where it has one, and fires its signature on a clock. After a string it rests: the punish
// window. A new phase roars (iframes, poise refilled) and plays its opening once.
//   phase: { until, rest, space: [near, far], attacks: [attack], signature: { move, every, min, max, rest },
//            counter: { move, w, reach, before }, opening: [moveId], mirror: { light, heavy, charged } }
//   attack: { move, min, max, w, cool, rest, then: [{ move | null, w }], after: { parry: moveId } }
// Events: boss.phase { id, phase }, boss.rest { id, frames }, boss.string { id, moves }.
import { dist, angleTo } from "../sim/fighter.mjs";
import { go } from "../sim/paths.mjs";
import { dcos, dsin } from "../sim/math.mjs";
import { rand01 } from "../../core/rng.mjs";

const alive = (F) => F && !F.out && !F.fallen && F.hp > 0;
const r01 = (W, F, k) => rand01(W.seed ^ 0x6d1e, `${F.id}:${k}:${W.tick}`);
const pick = (W, F, k, list) => { const sum = list.reduce((s, a) => s + (a.w ?? 1), 0); let u = r01(W, F, k) * sum; for (const a of list) { u -= a.w ?? 1; if (u < 0) return a; } return list[list.length - 1]; };

export function createDuelBrain(cfg) { return (W, F) => think(W, F, cfg); }

function think(W, F, cfg) {
  const M = (F.mem ||= {});
  if (M.phase === undefined) Object.assign(M, { phase: -1, rest: 0, open: [], queue: [], cool: {}, sig: 0, strafe: 1, strafeAt: 0, string: [], countered: 0 });
  const T = W.fighters.find((O) => O.team === "lamb" && alive(O)) || null;
  if (!T) return { mx: 0, mz: 0 };
  if (F.act) return {};
  const share = F.hp / F.hpMax, ph = cfg.phases.findIndex((p) => share > p.until);
  const phase = M.hold != null ? Math.max(M.hold, M.phase) : Math.max(M.phase, ph < 0 ? cfg.phases.length - 1 : ph);
  if (phase !== M.phase) {
    const first = M.phase < 0, P0 = cfg.phases[phase]; M.phase = phase; M.rest = 0; if (!first) M.queue = []; M.open = [...(P0.opening || [])];
    M.sig = W.tick + ((P0.signature && P0.signature.first) ?? (P0.signature ? P0.signature.every : 0));
    W.emit({ type: "boss.phase", id: F.id, phase });
    if (!first) { F.poise = F.poiseMax; return { press: ["boss.roar"] }; }
  }
  const P = cfg.phases[phase], d = dist(F, T), face = () => { F.face = angleTo(F, T); };
  // the queued follow-up of a string comes at once: the mixup is in which one
  if (M.queue.length) { const id = M.queue.shift(); face(); M.string.push(id); return { press: [id] }; }
  if (M.string.length) endString(W, F, M, P);
  if (W.tick < M.rest) return spacing(W, F, T, P, d, 0.35); // winded after the string: the punish window
  if (M.open.length) { face(); return { press: [M.open.shift()] }; }
  // a counter: the boss reads the player's wind-up and answers it (Fond of Them's catch)
  const C = P.counter, ta = T.act && W.moves[T.act.id];
  if (C && ta && ta.kind === "attack" && d <= C.reach && T.act.f < ta.startup - (C.before || 4) && W.tick - M.countered > (C.cool || 90) && F.st >= 1) {
    M.countered = W.tick;
    if (r01(W, F, "counter") < C.w) { face(); M.string = [C.move]; M.after = C; return { press: [C.move] }; }
  }
  // the signature, on its clock, from its range
  const S = P.signature;
  if (S && W.tick >= M.sig && d >= (S.min ?? 0) && d <= (S.max ?? 99) && F.st >= 1) { M.sig = W.tick + S.every; face(); M.string = [S.move]; M.after = S; return { press: [S.move] }; }
  // a mirror string: the player's own last string, answered in kind (The Figure)
  if (P.mirror && W.inner && W.inner.lastString && W.inner.lastString.length && W.tick >= (M.cool.mirror || 0) && d <= P.mirror.reach) {
    const seq = W.inner.lastString.map((k) => P.mirror[k]).filter(Boolean);
    if (seq.length) { M.cool.mirror = W.tick + P.mirror.cool; W.inner.lastString = []; face(); M.string = [seq[0]]; M.queue = seq.slice(1); M.after = P.mirror; W.emit({ type: "mirror", id: F.id, moves: seq }); return { press: [seq[0]] }; }
  }
  const ready = P.attacks.filter((a) => d >= a.min && d <= a.max && W.tick >= (M.cool[a.move] || 0) && (!a.when || a.when(W, F, T)));
  if (ready.length && F.st >= 1) {
    const a = pick(W, F, "attack", ready);
    M.cool[a.move] = W.tick + (a.cool || 0); M.string = [a.move]; M.after = a;
    queueFollow(W, F, M, a);
    face(); return { press: [a.move] };
  }
  return spacing(W, F, T, P, d, 1);
}

// the follow-ups a string may take: each step picks one option, `null` ends the string there (the mixup)
function queueFollow(W, F, M, a) {
  let opts = a.then, k = 0;
  while (opts && opts.length && k < 4) {
    const o = pick(W, F, `then${k}`, opts); if (!o.move) break;
    M.queue.push(o.move); opts = o.then; k++;
  }
}

function endString(W, F, M, P) {
  const a = M.after || {}, frames = a.rest ?? P.rest;
  M.rest = W.tick + frames; W.emit({ type: "boss.string", id: F.id, moves: M.string }); W.emit({ type: "boss.rest", id: F.id, frames });
  M.string = []; M.after = null;
}

// between strings: close in when out of range, back off when crowded, else circle at the phase's range
function spacing(W, F, T, P, d, s) {
  const [near, far] = P.space || [1.6, 3.2], M = F.mem;
  if (W.tick >= M.strafeAt) { M.strafe = r01(W, F, "strafe") < 0.5 ? -1 : 1; M.strafeAt = W.tick + 70 + Math.floor(r01(W, F, "strafeT") * 60); }
  F.face = angleTo(F, T);
  if (d > far) { const m = go(W, F, T.x, T.z, s); return { mx: m.mx, mz: m.mz, hold: d > 6 && s >= 1 ? { run: true } : {} }; }
  const a = angleTo(T, F);
  if (d < near) return { mx: dcos(a) * 0.7 * s, mz: dsin(a) * 0.7 * s };
  const t = a + (M.strafe * Math.PI) / 2; return { mx: dcos(t) * 0.55 * s, mz: dsin(t) * 0.55 * s };
}
