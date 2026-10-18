// What a renderer should draw on top of the bodies this frame, as plain data (combat owns the
// rules; the fight layer and the figure drawer own the look). Written after the 1080p feel capture
// found the shell draws bodies only: no thrown things, no contact, and one tell ring for every
// kind of wind-up (design/COMBAT-WORLD.md, "Feel").
//
//   fxOf(W) -> {
//     thrown:   [{ n, use, x, z, y, vx, vz }]            stones, mud, rope, lanterns in the air (metres, plate world)
//     tells:    [{ id, kind, answer, k, unstoppable }]    a wind-up showing: kind swing | grab | throw; answer
//                                                         "lunge" or "throw" when it is the world's answer to
//                                                         kiting; k 0..1 through the tell; unstoppable when it
//                                                         cannot be caught or blocked (the drag, the rope)
//     contacts: [{ kind, id, by, x, z, power, t }]       contacts since `since`: hit | catch | block | guardbreak |
//                                                         evade, at the struck body; power 0..1 for size
//     frozen:   [id]                                      bodies in hit-stop this frame (hold their pose)
//   }
// Pure: reads W, changes nothing; safe to call every animation frame.

const ANSWERS = { "world.lunge": "lunge", "world.throw": "throw" };
const CONTACT = { hit: "hit", parry: "catch", block: "block", guardbreak: "guardbreak", evade: "evade" };

// fxOf(W, since): contacts of every tick after `since` (default: this tick only), from the world's
// short contact log (sim/world.mjs keeps the last 30 ticks), so a renderer that draws less often than
// the simulation steps misses none. Each contact carries its tick `t`.
export function fxOf(W, since = W.tick - 1) {
  const thrown = W.projectiles.map((P) => ({ n: P.n, use: P.use, x: P.x, z: P.z, y: P.y, vx: P.vx, vz: P.vz }));
  const tells = [];
  for (const F of W.fighters) {
    if (!F.act || F.out || F.fallen) continue;
    const m = W.moves[F.act.id];
    if (!m || !m.tell || F.act.f < m.tell.at[0] || F.act.f >= m.tell.at[1]) continue;
    tells.push({ id: F.id, kind: m.tell.kind, answer: ANSWERS[m.id] || null, k: (F.act.f - m.tell.at[0]) / Math.max(1, m.tell.at[1] - m.tell.at[0]), unstoppable: m.parryable === false && m.blockable === false });
  }
  const contacts = [];
  for (const e of (W.fxLog || W.events).filter((x) => (x.t ?? W.tick) > since)) {
    const kind = CONTACT[e.type]; if (!kind) continue;
    const T = W.byId(e.id); if (!T) continue;
    const power = kind === "hit" ? Math.min(1, ((e.dmg || 0) + (e.poise || 0) * 0.5) / 3) : kind === "catch" || kind === "guardbreak" ? 1 : kind === "block" ? 0.4 : 0.2;
    contacts.push({ kind, id: e.id, by: e.by, x: e.x ?? T.x, z: e.z ?? T.z, power: +power.toFixed(2), t: e.t ?? W.tick });
  }
  const frozen = W.fighters.filter((F) => F.hitstop > 0).map((F) => F.id);
  return { thrown, tells, contacts, frozen };
}
