// A boss's brain (combat/data/bosses.mjs): phases by the share of standing left, each with a pattern that
// repeats in a fixed order, so a player who watches learns it. Each step is a move with the distance it
// wants; the boss walks into that distance (or backs off to it, for a charge) and fires. After the last
// step of a round it rests (rest frames: winded, slow, the punish window) unless the step says norest. A
// new phase opens with a roar (iframes, poise refilled) and its own opening steps once (a whistle).
// Events: boss.phase { id, phase }, boss.rest { id, frames }.
import { dist, angleTo } from "../sim/fighter.mjs";
import { go } from "../sim/paths.mjs";
import { dcos, dsin } from "../sim/math.mjs";

const alive = (F) => F && !F.out && !F.fallen && F.hp > 0;
export function createBossBrain(cfg) { return (W, F) => think(W, F, cfg); }

function think(W, F, cfg) {
  const M = (F.mem ||= {}); // an opening may have seeded the memory already (stealth): fill in the boss's own
  if (M.phase === undefined) Object.assign(M, { phase: -1, i: 0, rest: 0, open: [], next: 0, cool: 0 });
  const T = W.fighters.find((O) => O.team !== F.team && alive(O) && O.team === "lamb") || null;
  if (!T) return { mx: 0, mz: 0 };
  if (F.act) return {}; // inside a move: commit
  // the phase: by standing left, never back to an earlier one (an inner boss that heals or grows keeps its
  // form); M.hold names a phase the fight's rules chose instead (combat/arena/innerworld.mjs: Friday's arm
  // when the player stops striking, the Golem's walls when it has grown)
  const share = F.hp / F.hpMax, ph = cfg.phases.findIndex((p) => share > p.until);
  const phase = M.hold != null ? M.hold : Math.max(M.phase, ph < 0 ? cfg.phases.length - 1 : ph);
  if (phase !== M.phase) {
    const first = M.phase < 0; M.phase = phase; M.i = 0; M.rest = 0; M.open = [...(cfg.phases[phase].opening || [])];
    W.emit({ type: "boss.phase", id: F.id, phase });
    if (!first) { F.poise = F.poiseMax; return { press: ["boss.roar"] }; }
  }
  const P = cfg.phases[phase], d = dist(F, T);
  if (W.tick < M.rest) { const a = angleTo(T, F); return { mx: dcos(a) * 0.15, mz: dsin(a) * 0.15 }; } // winded, giving ground slowly
  const step = M.open.length ? M.open[0] : P.pattern[M.i % P.pattern.length];
  if (d >= step.min && d <= step.max && F.st >= 1) {
    if (M.open.length) M.open.shift();
    else {
      M.i++;
      if (M.i % P.pattern.length === 0 && !step.norest) { M.rest = W.tick + (W.moves[step.move] ? W.moves[step.move].total : 0) + P.rest; W.emit({ type: "boss.rest", id: F.id, frames: P.rest }); }
    }
    F.face = angleTo(F, T);
    return { press: [step.move], mx: 0, mz: 0 };
  }
  // a still phase never closes in: it strikes only a body that comes into its reach (Never Once)
  if (P.still && d > step.max) { F.face = angleTo(F, T); return { mx: 0, mz: 0 }; }
  // into the step's distance: back off for a charge that wants room, else close in
  if (d < step.min) { const a = angleTo(T, F); return { mx: dcos(a), mz: dsin(a) }; }
  const m = go(W, F, T.x, T.z, 1); return { mx: m.mx, mz: m.mz, hold: d > 6 ? { run: true } : {} };
}
