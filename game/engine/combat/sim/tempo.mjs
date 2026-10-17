// Attributes scale how fast Lamb moves (author, 2026-10-17; the mapping is the director's,
// SYSTEMS-FULL 19.11a; the curves are the combat engineer's). Soft-capped points above 3, hard limits
// so speed never breaks a window or an animation:
//
//   variable                     driven by   per point                 limit
//   light strings (whole move)   NOSE        -3%                       0.82x to 1.10x
//   heavy strikes' recovery      COAT        -3.5%                     0.80x
//   sidestep and roll            NOSE        -3.5% every frame         0.80x to 1.10x
//   i-frames                     NOSE        +0.6 frame                4 frames
//   cancel windows open earlier  NOSE        0.6 frame                 4 frames
//   parry window                 BALLAST     +0.5 frame                3 frames
//   stagger and knockdown        COAT        -4%                       0.75x
//   read window, bench minutes   PEN         (data/build.mjs read; bench -6% a point, 0.6x)
//   Composure regain             HAT         +10% a point              1.6x
//   load                         band        light 0.97x, heavy 1.06x, over 1.12x on all of it
//   under a tool's requirement   every animation 1.3x slower (19.3; data/tools.mjs slow)
//
// Active frames never change; only wind-ups, recoveries, windows and dodges move. The animation
// follows: anim/drive.mjs warps clips to these frames and reports the playback rate.
import { soft } from "../data/build.mjs";

export const TEMPO = {
  light: { per: 0.03, min: 0.82, max: 1.1 }, heavy: { per: 0.035, min: 0.8 }, cancel: { per: 0.6, max: 4 },
  dodge: { per: 0.035, min: 0.8, max: 1.1 }, iframe: { per: 0.6, max: 4 },
  parry: { per: 0.5, max: 3 }, stun: { per: 0.04, min: 0.75 }, regain: { per: 0.1, max: 1.6 }, bench: { per: 0.06, min: 0.6 },
  load: { light: 0.97, medium: 1, heavy: 1.06, over: 1.12 },
};

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const up = (L, k) => Math.max(0, soft(L[k] ?? 3) - 3);

export function tempoOf(L, band = "medium") {
  const lf = TEMPO.load[band] || 1;
  return {
    swing: clamp(1 - TEMPO.light.per * up(L, "nose"), TEMPO.light.min, TEMPO.light.max) * lf,
    heavy: Math.max(TEMPO.heavy.min, 1 - TEMPO.heavy.per * up(L, "coat")) * lf,
    cancel: Math.round(Math.min(TEMPO.cancel.max, TEMPO.cancel.per * up(L, "nose"))),
    dodge: clamp(1 - TEMPO.dodge.per * up(L, "nose"), TEMPO.dodge.min, TEMPO.dodge.max) * lf,
    iframe: Math.round(Math.min(TEMPO.iframe.max, TEMPO.iframe.per * up(L, "nose"))),
    parry: Math.round(Math.min(TEMPO.parry.max, TEMPO.parry.per * up(L, "ballast"))),
    stun: Math.max(TEMPO.stun.min, 1 - TEMPO.stun.per * up(L, "coat")),
    regain: Math.min(TEMPO.regain.max, 1 + TEMPO.regain.per * up(L, "hat")),
    bench: Math.max(TEMPO.bench.min, 1 - TEMPO.bench.per * up(L, "pen")),
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
      // the move shortens with NOSE, but its invulnerable frames never fall below the base count
      // (UI lead, 2026-10-17: a min-maxer reads absolute frames); NOSE only widens them
      m = scaleMove(m, t.dodge);
      const total = (m.startup || 0) + (m.active || 0) + (m.recovery || 0);
      if (m.iframes && m0.iframes) {
        const base = m0.iframes[1] - m0.iframes[0], scaled = m.iframes[1] - m.iframes[0];
        const len = Math.max(base, Math.min(Math.max(base, scaled) + t.iframe, total - 2 - m.iframes[0]));
        m = { ...m, iframes: [m.iframes[0], m.iframes[0] + len, ...m.iframes.slice(2)] };
      }
    } else if (kind === "parry") {
      if (m.parry && t.parry) m = { ...m, active: m.active + t.parry, parry: [m.parry[0], m.parry[1] + t.parry] };
    } else if (kind === "attack" || kind === "riposte" || kind === "item") {
      // heavies keep their wind-up and recover by COAT; everything else moves at the NOSE tempo
      if (/heavy/.test(id)) m = { ...m, recovery: Math.max(1, Math.round((m.recovery || 0) * t.heavy)) };
      else m = scaleMove(m, t.swing);
      if (t.cancel) m = { ...m, cancel: Object.fromEntries(Object.entries(m.cancel).map(([key, v]) => [key, [Math.max(m.startup + m.active, v[0] - t.cancel), v[1]]])) };
    }
    // the move's length at base tempo, so the animation knows how much faster this body plays it
    out[id] = m === m0 ? m : { ...m, baseTotal: (m0.startup || 0) + (m0.active || 0) + (m0.recovery || 0) };
  }
  return out;
}
