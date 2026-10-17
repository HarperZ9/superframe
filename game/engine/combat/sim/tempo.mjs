// Attributes scale how fast Lamb moves (author, 2026-10-17: "attributes scaling animation speed,
// and other variables"). The table, with soft-capped points above 3 (data/build.mjs soft) and
// hard limits so speed never breaks a window or an animation:
//
//   variable          driven by        per point            limit
//   swing tempo       GRIP             -3% startup and recovery     0.82x to 1.10x
//   cancel windows    GRIP             open 0.7 frame earlier       4 frames
//   dodge tempo       NOSE             -3.5% every dodge frame      0.80x to 1.10x
//   i-frames          NOSE             +0.6 frame on the window     4 frames
//   parry window      BALLAST          +0.5 frame                   3 frames
//   hit-stun          COAT             -4% on staggers, knockdowns  0.75x
//   load              the load band    light 0.97x, heavy 1.06x, over 1.12x on everything
//
// Active frames never change (a hit lands as long as it always did); only wind-ups, recoveries,
// windows and dodges move. The animation follows: anim/drive.mjs warps clips to these frames, so
// the clip's playback rate is the move's tempo.
import { soft } from "../data/build.mjs";

export const TEMPO = {
  swing: { per: 0.03, min: 0.82, max: 1.1 }, cancel: { per: 0.7, max: 4 },
  dodge: { per: 0.035, min: 0.8, max: 1.1 }, iframe: { per: 0.6, max: 4 },
  parry: { per: 0.5, max: 3 }, stun: { per: 0.04, min: 0.75 },
  load: { light: 0.97, medium: 1, heavy: 1.06, over: 1.12 },
};

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const up = (L, k) => Math.max(0, soft(L[k] ?? 3) - 3);

export function tempoOf(L, band = "medium") {
  const lf = TEMPO.load[band] || 1;
  return {
    swing: clamp(1 - TEMPO.swing.per * up(L, "grip"), TEMPO.swing.min, TEMPO.swing.max) * lf,
    cancel: Math.round(Math.min(TEMPO.cancel.max, TEMPO.cancel.per * up(L, "grip"))),
    dodge: clamp(1 - TEMPO.dodge.per * up(L, "nose"), TEMPO.dodge.min, TEMPO.dodge.max) * lf,
    iframe: Math.round(Math.min(TEMPO.iframe.max, TEMPO.iframe.per * up(L, "nose"))),
    parry: Math.round(Math.min(TEMPO.parry.max, TEMPO.parry.per * up(L, "ballast"))),
    stun: Math.max(TEMPO.stun.min, 1 - TEMPO.stun.per * up(L, "coat")),
  };
}

// A move's frames at tempo k: wind-up and recovery stretch by k, active frames stay; every frame
// window (cancels, i-frames, armour, parry, hits, root motion, tell, charge, tracking) maps along.
export function scaleMove(m, k) {
  if (Math.abs(k - 1) < 1e-3) return m;
  const s = m.startup || 0, a = m.active || 0, S = Math.round(s * k);
  const f = (x) => (x < s ? Math.round(x * k) : x < s + a ? S + (x - s) : S + a + Math.round((x - s - a) * k));
  const w = (p) => (p ? [f(p[0]), f(p[1]), ...p.slice(2)] : p);
  return {
    ...m, startup: S, recovery: Math.max(1, Math.round((m.recovery || 0) * k)),
    iframes: w(m.iframes), armor: w(m.armor), parry: w(m.parry), tell: m.tell ? { ...m.tell, at: w(m.tell.at) } : m.tell,
    cancel: Object.fromEntries(Object.entries(m.cancel || {}).map(([key, v]) => [key, w(v)])),
    hits: (m.hits || []).map((h) => (h.at ? { ...h, at: w(h.at) } : h)), root: (m.root || []).map(([a0, a1, v]) => [f(a0), f(a1), v / k]),
    charge: m.charge ? { ...m.charge, at: f(m.charge.at) } : m.charge, trackUntil: m.trackUntil != null ? f(m.trackUntil) : m.trackUntil,
  };
}

// Lamb's moves at Lamb's tempo: strikes by GRIP (and cancels earlier), dodges by NOSE (and wider
// windows), catches wider by BALLAST. Ids beginning `p` are Lamb's own (lamb:...).
export function tempoMoves(moves, p, t) {
  const out = {};
  for (const [id, m0] of Object.entries(moves)) {
    if (!id.startsWith(p) || id.startsWith(`${p}hands:`) && !m0.dmg) continue;
    let m = m0;
    const kind = m.kind || "attack"; // raw tables leave kind unset until defineMoves
    if (kind === "dodge") {
      m = scaleMove(m, t.dodge);
      const total = (m.startup || 0) + (m.active || 0) + (m.recovery || 0);
      if (m.iframes) m = { ...m, iframes: [m.iframes[0], Math.min(m.iframes[1] + t.iframe, total - 2)] };
    } else if (kind === "parry") {
      if (m.parry && t.parry) m = { ...m, active: m.active + t.parry, parry: [m.parry[0], m.parry[1] + t.parry] };
    } else if (kind === "attack" || kind === "riposte" || kind === "item") {
      m = scaleMove(m, t.swing);
      if (t.cancel) m = { ...m, cancel: Object.fromEntries(Object.entries(m.cancel).map(([key, v]) => [key, [Math.max(m.startup + m.active, v[0] - t.cancel), v[1]]])) };
    }
    // the move's length at base tempo, so the animation knows how much faster this body plays it
    out[id] = m === m0 ? m : { ...m, baseTotal: (m0.startup || 0) + (m0.active || 0) + (m0.recovery || 0) };
  }
  return out;
}
