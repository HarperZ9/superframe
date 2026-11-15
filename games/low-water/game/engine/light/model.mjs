// The one light model both styles consume (design/art/LIGHT.md; design/state/light.md has the interface). It
// holds a place's lights resolved to kinds (sources.mjs), the era's sky on a continuous clock (clock.mjs,
// eras.mjs), each light's decay from the street's stock (decay.mjs), and per frame each light's gain
// (flicker, decay, the crowd in its pool) and the moving lights (the export train's headlamp).
//   const M = createLightModel({ place, variant, era, hour, terms, read, street })
//   M.lights            resolved lights: { at, reach, I, e0, rgb, K, kind, flicker, seed, role, decay }
//   M.sky               clock.skyAt for the model's hour (M.setHour(h) moves it)
//   M.gains(t)          Float32Array, one gain per light at time t (seconds)
//   M.contrib(i, P, N)  light i's raw irradiance (scalar, before colour and gain) at point P with normal N
//   M.flickerK          1 full flicker, 0.3 reduced, 0 none (the accessibility setting; fx/install.mjs sets it)
//   M.setCrowd(figs)    figures [{ at:[x,y,z] }]: bodies in a pool take light off its ground (crowd.mjs)
//   M.dynamic(t)        the moving lights at time t (train.mjs), resolved like M.lights
import { sourceOf } from "./sources.mjs";
import { skyAt } from "./clock.mjs";
import { skyOptions, eraOf } from "./eras.mjs";
import { flicker } from "./flicker.mjs";
import { decayLights } from "./decay.mjs";
import { crowdGains } from "./crowd.mjs";
import { trainLights, coneK } from "./train.mjs";
import { windowLit } from "./windows.mjs";
import { lum } from "./kelvin.mjs";
// how much daylight a window lets in at this hour, 1 at a clear noon
const daylight = (S) => Math.min(1.2, (lum(S.amb) + 0.5 * S.sun.E) / 0.6);
// how bright a flame or a bulb reads to an eye adapted to the hour: full at night, a fifth by day. The sky here is
// already an exposed picture (a lit day about 1, a night about 0.02, where the real ratio is thousands), so without
// this a lamp would rival the low sun at dawn; with it the lamp still lit at dawn is a warm point, not the key
export function adaptK(S) { const p = S.phases; return p.night + 0.75 * p.blue + 0.4 * p.golden + 0.2 * p.day; }

// the plates' intensity convention (the glyph and paint light layers): sqrt(I) * 0.3 at the source
export const E_OF_I = (I) => Math.sqrt(I || 1) * 0.3;
const seedOf = (L, i) => { const a = L.at || [i, 0, 0]; return (Math.round(a[0] * 97) * 73856093) ^ (Math.round(a[1] * 89) * 19349663) ^ (Math.round(a[2] * 83) * 83492791) ^ i; };

export function resolveLights(lights, { read = null, street = null, households = {} } = {}) {
  const dec = decayLights(lights, read, { street, households });
  return lights.map((L, i) => {
    const s = sourceOf(L), d = dec[i], prof = d.dying && s.kind === "sodium" ? "tube" : s.flicker;
    return { at: L.at, reach: (L.reach || 6) * d.reachK, I: L.I || 1, e0: E_OF_I(L.I), rgb: s.rgb, rgb0: sourceOf({ kind: L.kind }).rgb, K: s.K, kind: s.kind, flicker: prof, seed: seedOf(L, i), role: d.role, decay: d, group: L.group || null, cone: L.cone || null, generated: !!L.generated, street: L.street || street, src: L };
  });
}
export function contrib(L, px, py, pz, nx, ny, nz) {
  const dx = L.at[0] - px, dy = L.at[1] - py, dz = L.at[2] - pz, d = Math.hypot(dx, dy, dz); if (d >= L.reach || d < 1e-4) return 0;
  const nl = (nx * dx + ny * dy + nz * dz) / d; if (nl <= -0.2) return 0;
  const f = 1 - d / L.reach, e = L.e0 * f * f * (0.25 + 0.75 * Math.max(0, nl));
  return L.cone ? e * coneK(L, [px, py, pz]) : e;
}

export function createLightModel({ place, variant = null, era = 2, hour = null, terms = {}, read = null, street = null, households = {}, lights = null, extra = [], indoor = false } = {}) {
  const pj = place || {}, v = variant || (pj.variants && pj.variants[0]);
  const H0 = hour ?? (pj.variantInfo && pj.variantInfo[v] && pj.variantInfo[v].hour) ?? 23;
  const src = [...(lights || (pj.lights && pj.lights[v]) || []), ...extra], opt = { ...skyOptions(era, { snow: terms.snow ?? (terms.frost ? eraOf(era).snow : undefined), north: pj.north }), overcast: terms.overcast ?? eraOf(era).overcast };
  const M = {
    place: pj, variant: v, era, terms, indoor, hour: H0, bakeHour: H0, street, read,
    lights: resolveLights(src, { read, street, households }), crowd: null, crowdK: null, sky: null, opt,
    setHour(h) { M.hour = h; M.sky = skyAt(h, opt.doy, opt); return M; },
    skyAt: (h) => skyAt(h, opt.doy, opt),
    refreshDecay() { M.lights = resolveLights(src, { read: M.read, street: M.street, households }); M.crowdK = null; return M; },
    setCrowd(figs) { M.crowd = figs; M.crowdK = figs && figs.length ? crowdGains(M.lights, figs) : null; return M; },
    gains(t = 0, out = new Float32Array(M.lights.length)) {
      const ad = M.indoor ? 1 : adaptK(M.sky);   // indoors the eye adapts to the room's own light
      for (let i = 0; i < M.lights.length; i++) { const L = M.lights[i]; out[i] = (L.kind === "window" ? 1 : ad) * L.decay.gain * (1 + (flicker(L.flicker, L.seed, t) - 1) * (M.flickerK ?? 1)) * (M.crowdK ? M.crowdK[i] : 1) * (L.group === "window" ? windowLit(M.hour, L.seed) : 1) * (L.kind === "window" ? daylight(M.sky) : 1); }
      return out;
    },
    contrib: (i, P, N) => contrib(M.lights[i], P[0], P[1], P[2], N[0], N[1], N[2]),
    dynamic: (t) => resolveLights(trainLights(pj, t, M.trainSpec), { read: null }),
    trainSpec: pj.train || null,
  };
  M.setHour(H0);
  return M;
}
