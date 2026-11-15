// Where a sound sits, from the shared camera and light (SCORE.md section 7). The wide lens hears the
// district from the bell tower: everything far, the air taking the highs, more room than source. The narrow
// lens sits at the table: close, dry, the stove at arm's length. Snow on the ground eats highs and shortens
// the room; fog damps a little more; the hour picks which beds are on.
//   placeSource({ at: [x, y, z], listener: [x, y, z], screenX (0..1, optional), lens, light })
//     -> { gain (linear), pan (-1..1), lowpass (Hz), wet (0..1), delay (s) }
// light: the shared light model's object (globalThis.__lwLightModel.at(scene)): { hour, snow, atmosphere: { fog } }
export const LENS = {
  wide: { ref: 25, roll: 1.0, wet: 0.55, air: 1, minDist: 40 },      // distances read from the tower
  near: { ref: 4, roll: 1.0, wet: 0.3, air: 1, minDist: 1 },
  narrow: { ref: 1.5, roll: 1.2, wet: 0.18, air: 0.3, minDist: 0.5 }, // the room: close and dry
};

const dist3 = (a, b) => Math.hypot(a[0] - b[0], (a[1] || 0) - (b[1] || 0), a[2] - b[2]);

export function placeSource({ at = [0, 0, 0], listener = [0, 0, 0], screenX = null, lens = "near", light = null } = {}) {
  const L = LENS[lens] || LENS.near, d = Math.max(L.minDist, dist3(at, listener));
  const snow = light?.snow ?? 0, fog = light?.atmosphere?.fog ?? 0;
  // inverse distance from a reference, softened past it (a town is not free field)
  const gain = Math.min(1, Math.pow(L.ref / Math.max(L.ref, d), L.roll));
  // air absorption: about 1 dB per 100 m at 4 kHz in cold air; snow and fog shave more off
  const lowpass = Math.max(700, 18000 / (1 + (d / 120) * L.air * (1 + snow * 0.8 + fog * 0.4)));
  const wet = Math.min(0.9, L.wet * (0.6 + 0.4 * Math.min(3, d / L.ref)) * (1 - snow * 0.35));
  const pan = screenX == null ? Math.max(-1, Math.min(1, (at[0] - listener[0]) / Math.max(4, d))) : Math.max(-1, Math.min(1, screenX * 2 - 1)) * (lens === "wide" ? 0.7 : 0.9);
  return { gain, pan, lowpass, wet, delay: d / 343 };
}

// which ambient beds play, from the hour and the weather (a famine winter: few birds, no traffic)
export function beds(light = {}) {
  const h = light.hour ?? 7, snow = light.snow ?? 0.6;
  return { wind: 0.4 + 0.4 * snow, frost: h < 8 || h > 18 ? 0.6 : 0.2, queue: h >= 6 && h < 15 ? 1 : 0, stove: h < 8 || h > 17 ? 1 : 0.5, brazier: h > 19 || h < 5 ? 1 : 0 };
}

// read the shared camera and light without depending on them: anything missing gives the defaults
export function fromWorld(G, at) {
  const light = (() => { try { return globalThis.__lwLightModel?.at?.(G?.scene) || null; } catch { return null; } })();
  const lens = (() => { try { return G?.lens?.mode?.() || "near"; } catch { return "near"; } })();
  const cam = G?.camera?.pos || [0, lens === "wide" ? 30 : 1.6, 0];
  return placeSource({ at, listener: cam, lens, light });
}
