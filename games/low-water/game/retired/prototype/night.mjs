// The night of Low Water as the game runs it: the engine's environment hub (web/env, ADR 0017)
// for weather, fog, rain, wind and wetness, plus the town's own terms: the tide, the quay power
// and Mother. The clock is in minutes since the evening's midnight-minus-a-day (23:00 = 1380) and
// moves only when Lamb does something.
const DEFAULT_ENV = "/rn/web/env/state.mjs", DEFAULT_TERMS = "/rn/web/env/terms.mjs";

const rep = (v) => Array(8).fill(v);
export async function createNight({ envUrl = DEFAULT_ENV, termsUrl = DEFAULT_TERMS } = {}) {
  const { createEnvironment } = await import(envUrl), { DEFAULT_LIBRARY } = await import(termsUrl);
  const L = DEFAULT_LIBRARY;
  const library = {
    clear: { ...L.clear, windSpeed: rep(6), humidity: rep(0.82), temperature: rep(7) },
    fog: { ...L.fog, fogDensity: rep(0.09), windSpeed: rep(4), humidity: rep(0.98) },
    // the bay's fog with a fine rain through it, the wind gone round to the south-west
    fograin: { ...L.rain, fogDensity: rep(0.08), rainRate: rep(1.6), windSpeed: rep(9), humidity: rep(1) },
  };
  const env = createEnvironment({ seed: 4471, slots: 8, library, start: { hour: 23, weather: "clear", timeScale: 1 },
    zones: { quay: {}, floor: {}, mole: {}, brine: { shelter: 1 }, weigh: { shelter: 1 }, lamproom: { shelter: 1 } } });
  const night = {
    clock: 23 * 60, power: "on", mother: "dark", wet: 0, env, snap: env.snapshot(),
    // the weather timeline of the hour (bible section 10.2), as commands to the hub
    schedule: [
      { at: 23 * 60 + 20, cmd: { type: "setWeatherTarget", state: "fog", seconds: 30 * 60 }, why: "fog off the Flats" },
      { at: 23 * 60 + 35, cmd: { type: "setWeatherTarget", state: "fograin", seconds: 6 * 60 }, why: "rain, the wind veers" },
      { at: 23 * 60 + 35, cmd: { type: "addWind", zone: "quay", vector: [-4, -4], seconds: 3600 }, why: "south-westerly on the quay" },
    ],
  };
  // Advance the night by minutes, stepping the hub in 10-second steps.
  night.advance = (minutes) => {
    const end = night.clock + minutes;
    while (night.clock < end - 1e-9) {
      for (const s of night.schedule) if (!s.done && night.clock >= s.at) { s.done = true; env.command(s.cmd, { source: "night", reason: s.why }); }
      const d = Math.min(1 / 6, end - night.clock);
      env.step(d * 60); night.clock += d;
    }
    night.snap = env.snapshot();
  };
  // Tide height above chart datum (m): low water -0.55 m at 22:58 (systems section 4).
  night.tide = (clock = night.clock) => { const tau = (clock - (22 * 60 + 58)) / 60; return 2.4 - 2.2 * Math.cos((2 * Math.PI * tau) / 12.42) - 0.75 * Math.cos((2 * Math.PI * tau) / 12.0); };
  // The water's height in the quay's world units: the low pools hold water from the start, and the
// floor (y = -3.2) is under by h = -0.27 (about 23:48).
  night.waterY = () => -3.37 + (night.tide() + 0.55) * 0.62;
  night.fog = () => night.snap.atmosphere.fogDensity;
  night.rain = () => night.snap.weather.rainRate;
  night.wind = () => night.snap.wind;
  night.hour = () => (night.clock / 60) % 24;
  return night;
}
export const clockText = (c) => { const h = Math.floor(c / 60) % 24, m = Math.floor(c % 60); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; };
