// The camera's answer to a blow in a fight (coordinator, 2026-10-17, lifting LOOK-UNIFIED R5's
// 2-plate-pixel cap for combat impacts only; the author: the dashes, rolls, dodges, parries and
// combination strikes "will need to feel incredible, and have weight to them"). Exploring, talking and
// sneaking keep the calm camera: this runs only inside a fight layer.
//   shake  directional, scaled by the blow's weight (combat's fight.shake amp), in screen pixels at
//          1080p (weight^0.7 x 18: a light blow 5.6, a heavy one 18), a damped 10 Hz swing gone in 0.25 s
//   punch  a zoom in of 2 to 4 % and back over 120 ms, at the struck body, on a heavy or charged hit,
//          a guard break and a catch (combat's fx contacts)
// Treatments (CAMERA.md records which ships): "shake", "punch", "both". Settings: Camera shake full,
// reduced (40 %), off (none; also off in calm mode).
// A shaking view never hides a telegraph: the shake is clamped so that no showing tell point comes
// within 8 px of the view's edge, and a punch that would push a tell there is not played. (The first
// rule, a flat 3 px cap while any tell showed, swallowed every light string in a two-opponent fight,
// where a tell is nearly always up: combat engineer's feel5 capture, 2026-10-17. The layers move as
// one, so a tell inside the view stays on its body; only the edge can hide it.)
//   const C = fightCam({ prefs, mode, layers, view, toScreen }); C.blow(e); C.contact(c, sp);
//   C.tells(list of screen points); C.tick(dt) each frame; C.stop()
const SHAKE_MAX = 18, SHAKE_F = 10, SHAKE_TAU = 0.06, SHAKE_LIFE = 0.25, PUNCH_T = 0.12, EDGE = 8;
// The impact shake's tuning value (coordinator, 2026-10-17: the author judges the size in play): a share
// of the amplitude above, read every frame, so a tool or the settings can change it live. Combat
// engineer's strips at 1, 0.6 and 0.4 are in design/COMBAT-WORLD.md, "Shake size".
export const IMPACT = { shakeScale: 1 };

export function fightCam({ prefs = {}, mode = "both", layers = () => [], view = () => ({ w: 1280, h: 720 }) } = {}) {
  let shake = null, punch = null, tellPts = [];
  const calm = () => typeof document !== "undefined" && document.documentElement.classList.contains("calm");
  const gain = () => (calm() || prefs.shake === "off" ? 0 : prefs.shake === "light" || prefs.shake === "reduced" ? 0.4 : 1);
  const scale = () => view().h / 1080;
  function apply(dx, dy, z, o) {
    for (const el of layers()) { if (!el) continue; el.style.transformOrigin = o ? `${o[0]}px ${o[1]}px` : ""; el.style.translate = dx || dy ? `${dx.toFixed(1)}px ${dy.toFixed(1)}px` : ""; el.style.scale = z !== 1 ? z.toFixed(4) : ""; }
  }
  // the range of shake offsets v along d that keeps every tell point (after any punch) EDGE px inside the
  // view; a tell already past the edge only forbids moves that push it further out
  function shakeRoom(d, pu) {
    const v = view(); let lo = -Infinity, hi = Infinity;
    const z = pu ? 1 + pu.amount * Math.sin((Math.PI * Math.min(pu.t, PUNCH_T)) / PUNCH_T) : 1, o = pu ? pu.o : [0, 0];
    for (const [x0, y0] of tellPts) {
      const p = [o[0] + (x0 - o[0]) * z, o[1] + (y0 - o[1]) * z], max = [v.w - EDGE, v.h - EDGE];
      for (let k = 0; k < 2; k++) {
        if (!d[k]) continue;
        let a = (EDGE - p[k]) / d[k], b = (max[k] - p[k]) / d[k]; if (a > b) [a, b] = [b, a];
        lo = Math.max(lo, Math.min(a, 0)); hi = Math.min(hi, Math.max(b, 0));
      }
    }
    return lo > hi ? [0, 0] : [lo, hi];
  }
  return {
    mode,
    // combat's fight.shake: { amp 0..1, dir: screen direction [x, y] }
    blow(e, dirScreen) {
      if (mode === "punch" || !gain()) return;
      const a = Math.pow(Math.min(1, e.amp || 0.2), 0.7), L = Math.hypot(dirScreen[0], dirScreen[1]) || 1; // light blows still read (0.2 gives 5.6 px), heavy ones carry (1 gives 18)
      shake = { t: 0, amp: a * SHAKE_MAX, d: [dirScreen[0] / L, dirScreen[1] / L] };
    },
    // a contact from combat's fx: { kind, power }, sp = the struck body's screen point
    contact(c, sp) {
      if (mode === "shake" || !gain() || !sp) return;
      const big = c.kind === "catch" || c.kind === "guardbreak" || (c.kind === "hit" && c.power >= 0.66);
      if (!big) return;
      const amount = (0.02 + 0.02 * Math.min(1, c.power)) * gain();
      // the punch scales about the struck body: a tell point p goes to sp + (p - sp) x (1 + amount); skip it if any would leave the view
      const v = view(), z = 1 + amount, out = tellPts.some(([x, y]) => { const X = sp[0] + (x - sp[0]) * z, Y = sp[1] + (y - sp[1]) * z; return X < 8 || Y < 8 || X > v.w - 8 || Y > v.h - 8; });
      if (out) return;
      punch = { t: 0, amount, o: sp };
    },
    tells(points) { tellPts = points || []; },
    tick(dt) {
      let dx = 0, dy = 0, z = 1, o = null;
      if (shake) {
        shake.t += dt;
        const env = Math.exp(-shake.t / SHAKE_TAU), v = shake.amp * IMPACT.shakeScale * scale() * gain() * env * Math.cos(2 * Math.PI * SHAKE_F * shake.t);
        const [lo, hi] = shakeRoom(shake.d, punch), vv = Math.max(lo, Math.min(hi, v));
        dx = shake.d[0] * vv; dy = shake.d[1] * vv;
        if (shake.t > SHAKE_LIFE) shake = null;
      }
      if (punch) {
        punch.t += dt;
        z = 1 + punch.amount * Math.sin((Math.PI * Math.min(punch.t, PUNCH_T)) / PUNCH_T); o = punch.o;
        if (punch.t >= PUNCH_T) { punch = null; z = 1; }
      }
      apply(dx, dy, z, o);
      return { dx, dy, z };
    },
    active: () => !!(shake || punch),
    stop() { shake = punch = null; apply(0, 0, 1, null); },
  };
}
