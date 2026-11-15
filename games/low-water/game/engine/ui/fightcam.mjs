// The camera's answer to a blow in a fight (coordinator, 2026-10-17, lifting LOOK-UNIFIED R5's
// 2-plate-pixel cap for combat impacts only; the author: the dashes, rolls, dodges, parries and
// combination strikes "will need to feel incredible, and have weight to them"). Exploring, talking and
// sneaking keep the calm camera: this runs only inside a fight layer.
//   shake  directional, scaled by the blow's weight (combat's fight.shake amp), in screen pixels at
//          1080p (weight^0.7 x 6: a full-weight blow peaks at 6, T10; the quay fight's 0.75 blow at 4.9, a
//          light 0.15 blow at 1.6), keyed as the reference keys it
//          (KEYS below), plus an inertial spring the blow kicks (SPRING)
//   punch  a zoom in of 2 to 4 % and back over 120 ms, at the struck body, on a heavy or charged hit,
//          a guard break and a catch (combat's fx contacts)
// Treatments (CAMERA.md records which ships): "shake", "punch", "both". Settings: Camera shake full,
// reduced (40 %), off (none; also off in calm mode).
// A shaking view never hides a telegraph: while an opponent's tell shows, the shake is held to 3 px,
// and a punch that would push a tell out of view is not played.
//   const C = fightCam({ prefs, mode, layers, view, toScreen }); C.blow(e); C.contact(c, sp);
//   C.tells(list of screen points); C.tick(dt) each frame; C.stop()
// SHAKE_MAX is the peak a full-weight blow may reach at 1080p, the whole offset (keyed shake plus spring)
// together: COMBAT-SPEC T10, 6 px. It was 18 from the first build because the old shake (a 10 Hz swing
// under a 60 ms decay) was sampled at 1/60 s and read about 0.38 of its nominal size; the keyed shake
// of 63515f2 jumps to its nominal size at frame 3, so 18 became a real 18 px (15.8 px measured on the
// quay fight, CB8 FAIL). The nominal size is now the measured one.
const SHAKE_MAX = 6, PUNCH_T = 0.12, TELL_CAP = 3;
// The shake's shape, as the reference keys it (cleanroom/spec/NRFTW-PRESENTATION-2.md 3.1; author
// 2026-10-21 "Make it more like No Rest for the Wicked"): a jump to the peak at frame 3, an overshoot of 40%
// the other way at frame 7 to 8, rest at frame 12 (a heavier blow, 0.5 and up, rests at 15; a catch is
// longer, 40 frames with a second, smaller swing). Keyed, not noise: no 10 Hz ringing.
const KEYS = { short: [[0, 0], [3, 1], [7.5, -0.4], [12, 0]], medium: [[0, 0], [3, 1], [8, -0.4], [11.5, 0.12], [15, 0]], catch: [[0, 0], [3, 1], [10, -0.45], [20, 0.25], [30, -0.08], [40, 0]] };
export function keyed(keys, f) {
  if (f >= keys[keys.length - 1][0]) return null;
  for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) { const [f0, v0] = keys[i - 1], [f1, v1] = keys[i], t = (f - f0) / (f1 - f0), s = t * t * (3 - 2 * t); return v0 + (v1 - v0) * s; }
  return 0;
}
// and the reference's second layer: an inertial spring the blow kicks (stiffness 300, damping 30: 2.8 Hz,
// damping ratio 0.87), stepped at 100 Hz, its offset adds to the keyed shake under the one limit in tick()
export const SPRING = { k: 300, c: 30, kick: 2.2, dt: 0.01 };
export const IMPACT = { shakeScale: 1, punchScale: 1 };

export function fightCam({ prefs = {}, mode = "both", layers = () => [], view = () => ({ w: 1280, h: 720 }) } = {}) {
  let shake = null, punch = null, tellPts = [];
  const spring = { x: [0, 0], v: [0, 0], acc: 0 };
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
      const amp = Math.min(1, e.amp || 0.2), a = Math.pow(amp, 0.7), L = Math.hypot(dirScreen[0], dirScreen[1]) || 1; // light blows still read (0.2 gives 1.9 px), heavy ones carry (1 gives 6)
      const d = [dirScreen[0] / L, dirScreen[1] / L];
      shake = { f: 0, amp: a * SHAKE_MAX, d, keys: e.kind === "catch" ? KEYS.catch : amp >= 0.5 ? KEYS.medium : KEYS.short };
      spring.v[0] += d[0] * a * SHAKE_MAX * SPRING.kick; spring.v[1] += d[1] * a * SHAKE_MAX * SPRING.kick;   // the hit kicks the spring along the blow
    },
    // a contact from combat's fx: { kind, power }, sp = the struck body's screen point
    contact(c, sp) {
      if (mode === "shake" || !gain() || !sp) return;
      const big = c.kind === "catch" || c.kind === "guardbreak" || (c.kind === "hit" && c.power >= 0.66);
      if (!big) return;
      const amount = (0.02 + 0.02 * Math.min(1, c.power)) * IMPACT.punchScale * gain();
      // the punch scales about the struck body: a tell point p goes to sp + (p - sp) x (1 + amount); skip it if any would leave the view
      const v = view(), z = 1 + amount, out = tellPts.some(([x, y]) => { const X = sp[0] + (x - sp[0]) * z, Y = sp[1] + (y - sp[1]) * z; return X < 8 || Y < 8 || X > v.w - 8 || Y > v.h - 8; });
      if (out) return;
      punch = { t: 0, amount, o: sp };
    },
    tells(points) { tellPts = points || []; },
    tick(dt) {
      let dx = 0, dy = 0, z = 1, o = null;
      const g = IMPACT.shakeScale * scale() * gain();
      if (shake) {
        shake.f += dt * 60;
        const k = keyed(shake.keys, shake.f);
        if (k == null) shake = null;
        else { const v = shake.amp * g * k; dx = shake.d[0] * v; dy = shake.d[1] * v; }
      }
      // the spring, stepped at 100 Hz whatever the frame rate
      for (spring.acc += dt; spring.acc >= SPRING.dt; spring.acc -= SPRING.dt) for (let i = 0; i < 2; i++) { const a = -SPRING.k * spring.x[i] - SPRING.c * spring.v[i]; spring.v[i] += a * SPRING.dt; spring.x[i] += spring.v[i] * SPRING.dt; }
      if (Math.hypot(...spring.x) > 0.05 || Math.hypot(...spring.v) > 0.5) { dx += spring.x[0] * g; dy += spring.x[1] * g; }
      else { spring.x = [0, 0]; spring.v = [0, 0]; }
      // one limit on the sum of both layers (two blows in a frame, or a blow into the last one's spring, must not
      // stack past the peak): T10's 6 px, and 3 px while any tell shows. Clamped as a vector so the direction holds.
      const lim = (tellPts.length ? TELL_CAP : SHAKE_MAX) * scale() * gain(), m = Math.hypot(dx, dy);
      if (m > lim) { dx *= lim / m; dy *= lim / m; }
      if (punch) {
        punch.t += dt;
        z = 1 + punch.amount * Math.sin((Math.PI * Math.min(punch.t, PUNCH_T)) / PUNCH_T); o = punch.o;
        if (punch.t >= PUNCH_T) { punch = null; z = 1; }
      }
      apply(dx, dy, z, o);
      return { dx, dy, z };
    },
    active: () => !!(shake || punch || Math.hypot(...spring.x) > 0.05),
    stop() { shake = punch = null; spring.x = [0, 0]; spring.v = [0, 0]; apply(0, 0, 1, null); },
  };
}
