// Time of day as a continuous clock: the sun and moon over the Tarn (about 50 degrees north), the sky's
// light at every minute, and the named hours (golden, blue, night) as weights that fade into each other,
// never steps. Directions are world vectors (y up); a place's `north` (degrees, default 0) turns the
// compass onto its axes: north is +z, east is -x at 0 (the Quota plates' convention: the dawn sun at
// [-150, 32, -90] is south-east). Original code; the solar formulas are the standard textbook ones.
//   sunAt(hour, doy, { lat, north }) -> { el, az, dir }        el, az in degrees; dir toward the sun
//   moonAt(hour, doy, opt)           -> { el, dir, phase }      a simple moon half a day behind the sun
//   skyAt(hour, doy, opt)            -> { sun: {dir, rgb, E}, moon: {dir, rgb, E}, amb: rgb, ground: rgb, horizon: rgb, phases }
//   phasesAt(el)                     -> { day, golden, blue, night } weights summing to 1
import { kelvinRgb } from "./kelvin.mjs";

const D = Math.PI / 180, clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const TARN = { lat: 50.5, north: 0 };

export function compass(azDeg, elDeg, north = 0) {
  const a = (azDeg + north) * D, e = elDeg * D;
  return [-Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
}
export function sunAt(hour, doy = 172, { lat = TARN.lat, north = TARN.north } = {}) {
  const dec = 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + doy)) * D, H = (hour - 12) * 15 * D, phi = lat * D;
  const sel = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H), el = Math.asin(clamp(sel, -1, 1));
  // azimuth from north, clockwise (east 90)
  const caz = (Math.sin(dec) - Math.sin(el) * Math.sin(phi)) / (Math.cos(el) * Math.cos(phi) || 1e-9);
  let az = Math.acos(clamp(caz, -1, 1)) / D; if (H > 0) az = 360 - az;
  return { el: el / D, az, dir: compass(az, el / D, north) };
}
export function moonAt(hour, doy = 172, opt = {}) {
  const s = sunAt((hour + 12.4) % 24, doy + 182, opt);   // a full-ish moon, opposite the sun
  return { el: s.el, az: s.az, dir: s.dir, phase: opt.moonPhase ?? 0.7 };
}
export function phasesAt(el) {
  const day = ss(6, 14, el), golden = ss(-1, 3, el) * (1 - ss(6, 14, el)), blue = ss(-9, -4, el) * (1 - ss(-1, 3, el)), night = 1 - ss(-12, -6, el);
  const t = day + golden + blue + night || 1; return { day: day / t, golden: golden / t, blue: blue / t, night: night / t };
}
// sunlight through the air: air mass (Kasten and Young 1989), per-channel optical depth (Rayleigh and haze)
export function sunColour(el, haze = 1) {
  if (el <= -1) return [0, 0, 0];
  const e = Math.max(el, -0.9), m = 1 / (Math.sin(e * D) + 0.50572 * Math.pow(e + 6.07995, -1.6364));
  const tau = [0.055 + 0.03 * haze, 0.095 + 0.035 * haze, 0.175 + 0.045 * haze], base = kelvinRgb(5800);
  return base.map((c, k) => c * Math.exp(-tau[k] * m));
}
const mixc = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const add = (a, b, w = 1) => a.map((v, k) => v + b[k] * w);
// sky colours at the named hours (linear, irradiance on an up-facing surface, about 1 for a lit day)
const SKY = { day: [0.36, 0.42, 0.55], golden: [0.34, 0.26, 0.24], blue: [0.05, 0.075, 0.17], night: [0.012, 0.016, 0.034] };
export function skyAt(hour, doy = 172, opt = {}) {
  const sun = sunAt(hour, doy, opt), moon = moonAt(hour, doy, opt), ph = phasesAt(sun.el), haze = opt.haze ?? 1;
  let amb = [0, 0, 0]; for (const k of Object.keys(SKY)) amb = add(amb, SKY[k], ph[k]);
  const sunE = Math.max(0, Math.sin(sun.el * D)) * 1.15 * ss(-1, 2, sun.el) * (1 - (opt.overcast ?? 0) * 0.8);
  const moonE = moon.el > 0 ? Math.sin(moon.el * D) * 0.05 * moon.phase * ph.night : 0;
  // sky glow from the town's own lamps (era 5's sodium: the night is never black under it)
  if (opt.skyglow) amb = add(amb, opt.skyglow.rgb, opt.skyglow.k * (ph.night + ph.blue));
  if (opt.overcast) amb = mixc(amb, [amb[1], amb[1], amb[1] * 1.05], opt.overcast * 0.6);
  const horizon = add(mixc(amb, sunColour(Math.max(sun.el, 0.5), haze), 0.35 * (ph.golden + ph.blue * 0.4)), [0, 0, 0]);
  const snow = opt.snow ?? 0, sunRgb = sunColour(sun.el, haze);
  const ground = add(amb.map((v) => v * (0.12 + 0.5 * snow)), sunRgb, sunE * (0.08 + 0.55 * snow));   // the bounce off the ground (snow throws light up)
  return { hour, doy, sun: { ...sun, rgb: sunRgb, E: sunE }, moon: { ...moon, rgb: [0.62, 0.72, 1.0], E: moonE }, amb, ground, horizon, phases: ph };
}
