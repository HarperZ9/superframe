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
// A shaking view never hides a telegraph: while an opponent's tell shows, the shake is held to 3 px,
// and a punch that would push a tell out of view is not played.
//   const C = fightCam({ prefs, mode, layers, view, toScreen }); C.blow(e); C.contact(c, sp);
//   C.tells(list of screen points); C.tick(dt) each frame; C.stop()
const SHAKE_MAX = 18, SHAKE_F = 10, SHAKE_TAU = 0.06, SHAKE_LIFE = 0.25, PUNCH_T = 0.12, TELL_CAP = 3;

export function fightCam({ prefs = {}, mode = "both", layers = () => [], view = () => ({ w: 1280, h: 720 }) } = {}) {
  let shake = null, punch = null, tellPts = [];
  const calm = () => typeof document !== "undefined" && document.documentElement.classList.contains("calm");
  const gain = () => (calm() || prefs.shake === "off" ? 0 : prefs.shake === "light" || prefs.shake === "reduced" ? 0.4 : 1);
  const scale = () => view().h / 1080;
  function apply(dx, dy, z, o) {
    for (const el of layers()) { if (!el) continue; el.style.transformOrigin = o ? `${o[0]}px ${o[1]}px` : ""; el.style.translate = dx || dy ? `${dx.toFixed(1)}px ${dy.toFixed(1)}px` : ""; el.style.scale = z !== 1 ? z.toFixed(4) : ""; }
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
        const env = Math.exp(-shake.t / SHAKE_TAU), v = shake.amp * scale() * gain() * env * Math.cos(2 * Math.PI * SHAKE_F * shake.t);
        const cap = tellPts.length ? TELL_CAP : Infinity, vv = Math.max(-cap, Math.min(cap, v));
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
