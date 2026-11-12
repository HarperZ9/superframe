// A scripted Lamb for feel captures (tools/feel_capture.py): it plays the fight in phases so each
// move the author named shows on screen at least once, and the world's answers to kiting show too.
//   kite    0 to 8 s: flight with no pokes (the kiting policy at a 5.5 m ring), to draw the lunge and
//           the thrown stone; no blow is landed, so a talk exit that wants it is offered meanwhile.
//   guard   8 to 14 s: defence only; each swing that comes is answered in turn by a catch (parry), a
//           sidestep (dodge), then a roll (or the load's dash or hop).
//   strike  14 to 23 s: strings of light strikes into a heavy, a charged heavy, the running strike.
//   finish  the pilot playing like the build.
// Every press it makes is logged in S.log as [tick, phase, what] for the capture's notes.
import { createPilot } from "./pilot.mjs";
import { dist, angleTo } from "../sim/fighter.mjs";

const live = (F) => !F.out && !F.fallen && !F.yielded && F.hp > 0;
export const PHASES = { kite: 8 * 60, guard: 14 * 60, strike: 23 * 60 };

export function createShowcase() {
  const fair = createPilot({ style: "fighter", catchShare: 1 }), kite = createPilot({ style: "kite", kite: { ring: 5.5, poke: -1, approach: false } });
  const S = { answer: 0, string: 0, hold: 0, log: [], seen: new Set() };
  const note = (W, phase, what) => S.log.push([W.tick, phase, what]);
  return (W) => {
    const L = W.lamb(); if (!L || L.fallen) return {};
    const foes = W.fighters.filter((F) => F.team !== "lamb" && live(F)).sort((a, b) => dist(L, a) - dist(L, b));
    if (!foes.length) return {};
    const T = foes[0], d = dist(L, T), a = angleTo(L, T), out = { mx: 0, mz: 0, press: [], hold: {} };
    if (L.lock == null || !live(W.byId(L.lock))) out.press.push("lock");
    if (W.tick < PHASES.kite) { if (!S.kiting) { S.kiting = true; note(W, "kite", "flight starts"); } return kite(W); }
    if (W.tick < PHASES.guard) { if (!S.guarding) { S.guarding = true; note(W, "guard", "defence starts"); } return guard(W, L, foes, out, S, note); }
    if (W.tick < PHASES.strike) {
      if (S.hold > 0) { S.hold--; out.hold.heavy = true; return out; }
      const th = threat(W, L, foes);
      if (th) return fair(W);
      if (d > 1.6) { out.mx = Math.cos(a); out.mz = Math.sin(a); if (d > 4) { out.hold.run = true; } if (d < 2.4 && L.running) { out.press.push("light"); note(W, "strike", "running strike"); } return out; }
      if (L.act) { const m = W.moves[L.act.id]; if (m.next.light && L.act.f > m.startup && S.string > 0) { S.string--; out.press.push(S.string === 0 ? "heavy" : "light"); note(W, "strike", S.string === 0 ? "string ends in a heavy" : "string, next light"); } return out; }
      if (L.st < 3) return fair(W);
      if ((S.n = (S.n || 0) + 1) % 2) { S.string = 3; out.press.push("light"); note(W, "strike", "string opens"); }
      else { S.hold = 40; out.press.push("heavy"); out.hold.heavy = true; note(W, "strike", "charged heavy"); }
      return out;
    }
    if (!S.finishing) { S.finishing = true; note(W, "finish", "fair play"); }
    return fair(W);
  };
}

function threat(W, L, foes) {
  for (const F of foes) {
    if (!F.act) continue;
    const m = W.moves[F.act.id], left = m.startup - F.act.f;
    if (!m.hits.length || left < 0 || left > 14) continue;
    if (dist(L, F) <= Math.max(...m.hits.map((h) => h.r[1])) + 0.8) return { F, m, left };
  }
  return null;
}

// Defence only: each swing answered in turn by catch, sidestep, roll, timed from the move data.
function guard(W, L, foes, out, S, note) {
  const th = threat(W, L, foes), T = foes[0], d = dist(L, T), a = angleTo(L, T);
  if (!th) { if (d > 2.6) { out.mx = Math.cos(a) * 0.6; out.mz = Math.sin(a) * 0.6; } else { const s = a + Math.PI / 2; out.mx = Math.cos(s) * 0.3; out.mz = Math.sin(s) * 0.3; } return out; }
  if (L.act) return out;
  const key = `${th.F.id}:${th.F.act.seq || th.F.act.id}:${W.tick - (th.F.act.f || 0)}`;
  const kind = ["catch", "step", "roll"][S.answer % 3], cm = W.moves[`lamb:${L.tool ? "" : "hands:"}catch`];
  const rm = W.moves[W.defs.lamb.moveset.roll[W.defs.lamb.load]] || W.moves.roll, side = angleTo(th.F, L) + Math.PI / 2;
  const at = kind === "catch" ? (cm ? cm.parry[0] + 2 : 3) : kind === "roll" ? rm.iframes[0] + 3 : 3;
  if (kind === "catch" && th.m.parryable === false) { S.answer++; return out; }
  if (th.left !== at || S.seen.has(key)) { if (th.left < at) out.hold.block = kind === "catch"; return out; }
  S.seen.add(key); S.answer++;
  if (kind !== "catch") { out.mx = Math.cos(side); out.mz = Math.sin(side); }
  out.press.push(kind); note(W, "guard", kind === "catch" ? "catch (parry)" : kind === "step" ? "sidestep (dodge)" : "roll");
  return out;
}
