// A whole night as data: the tide from its low and high water, and the weather as keyframes.
// This is the engine's own environment for the full acts (R11). It needs no renderer, so tests,
// tools and the shell all read the same night; the shell can mirror it into raw-native's
// environment hub for the look.
//
//   @night n1
//   low: 22:58 -0.55          low water: time and height above chart datum (m)
//   high: 05:10 5.3           the next high water
//   at: 23:20 fog 0           a keyframe: time, term, value. Numbers ease linearly to the next
//   at: 03:00 fog 0.09        keyframe of the same term; words switch at their time.
//
// Terms a night gives: tide, fog, rain (mm/h), wind.speed (m/s), wind.dir (degrees, where it
// blows from), temp (deg C), frost (0 or 1), daylight (0 to 1), plus any other keyframed term.
// Places give light and sodium, dimmed to dark-light when their zone's power is off.
// Daylight (the playable interlude; a @day record is a @night by another name): a place's light
// is its artificial light combined with daylight x its day-light factor (@place day-light,
// default 1 outdoors and 0.35 under shelter): 1 - (1 - a)(1 - d). Sodium is the artificial
// share of that light, so a lamp doused by day changes little and colour reads in the sun.
// Terms day (daylight >= 0.5) and daylight. Commands (LWD cmd lines):
//   setPower <zone> on|off     restrike mother     setTerm <term> <value>
//   Mother is on the quay board (R16): cutting the power of her zone (night key mother-zone,
//   default quay) puts her out, and power coming back does not relight her; only restrike does.
//   setLight <place> <light> <sodium>     gust <m/s> <minutes>
import { toMin } from "../core/expr.mjs";

// Night 1 of Act 1 (design/PRODUCTION.md section 8, 2026-10-16). Used when content has no @night.
export const NIGHT_ONE = {
  id: "night1", night: 1,
  low: { at: toMin("22:58"), h: -0.55 }, high: { at: toMin("05:10"), h: 5.3 },
  keys: [
    ["22:41", "fog", 0], ["23:20", "fog", 0], ["23:50", "fog", 0.05], ["03:00", "fog", 0.09], ["05:00", "fog", 0.05], ["06:20", "fog", 0.03],
    ["22:41", "rain", 0], ["23:35", "rain", 0], ["23:41", "rain", 1.6], ["01:20", "rain", 1.6], ["01:30", "rain", 6], ["02:40", "rain", 6], ["02:50", "rain", 1.6], ["04:00", "rain", 1.6], ["04:10", "rain", 0],
    ["22:41", "wind.speed", 6], ["23:35", "wind.speed", 6], ["23:41", "wind.speed", 9], ["04:10", "wind.speed", 9], ["04:30", "wind.speed", 6],
    ["22:41", "wind.dir", 270], ["23:35", "wind.dir", 225],
    ["22:41", "temp", 8], ["23:35", "temp", 7], ["02:40", "temp", 4], ["04:10", "temp", 1], ["06:10", "temp", 1], ["06:40", "temp", 2],
    ["22:41", "frost", 0], ["04:10", "frost", 1], ["06:20", "frost", 0],
  ].map(([t, term, v]) => ({ at: toMin(t), term, v })),
};

// @night records to night specs. Errors are collected for the validator.
export function loadNights(book) {
  const out = {}, errors = [];
  for (const r of [...Object.values((book.records || {}).night || {}), ...Object.values((book.records || {}).day || {})]) {
    try {
      const n = { id: r.id, night: 1, low: null, high: null, keys: [] };
      for (const { key, value, line } of r.kv) {
        const w = value.trim().split(/\s+/);
        if (key === "low" || key === "high") n[key] = { at: toMin(w[0]), h: +w[1] };
        else if (key === "night") n.night = +w[0];
        else if (key === "mother-zone") n.motherZone = w[0];
        else if (key === "at") { if (w.length < 3) throw new SyntaxError(`line ${line}: at: expected "hh:mm term value"`); n.keys.push({ at: toMin(w[0]), term: w[1], v: isNaN(+w[2]) ? w[2] : +w[2] }); }
        else throw new SyntaxError(`line ${line}: unknown key "${key}"`);
      }
      if (!n.low || !n.high) throw new SyntaxError("needs low: and high:");
      out[r.id] = n;
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `night ${r.id}: ${e.message}` }); }
  }
  return { nights: out, errors };
}

// Tide height (m) at a clock minute: a half cosine from low to high water, continued with the
// same period either side. Night 1 gives the gully (tide < -0.35) open 22:14 to 23:42.
export function tideAt(spec, clock) {
  const { low, high } = spec, half = high.at - low.at, mid = (low.h + high.h) / 2, amp = (high.h - low.h) / 2;
  return mid - amp * Math.cos((Math.PI * (clock - low.at)) / half);
}

// A keyframed term at a clock minute: linear between numeric keys, stepped for words.
export function keyAt(spec, term, clock) {
  const ks = spec.keys.filter((k) => k.term === term);
  if (!ks.length) return undefined;
  ks.sort((a, b) => a.at - b.at);
  if (clock <= ks[0].at) return ks[0].v;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (clock >= a.at && clock < b.at) {
      if (typeof a.v !== "number" || typeof b.v !== "number" || term === "frost") return a.v;
      return a.v + ((b.v - a.v) * (clock - a.at)) / (b.at - a.at);
    }
  }
  return ks[ks.length - 1].v;
}

export function scheduleEnv({ night = NIGHT_ONE, places = {}, clock = 23 * 60 } = {}) {
  const st = { clock, power: {}, mother: "dark", terms: {}, lights: {}, gusts: [] };
  const P = (place) => places[place] || { light: 0.5, sodium: 0, dark: 0.05, zone: place };
  const env = {
    spec: night,
    clock: () => st.clock,
    // The tide at any minute of the night (a setTerm override holds it still).
    tideAt: (c) => ("tide" in st.terms ? st.terms.tide : tideAt(night, c)),
    advance: (m) => { if (m > 0) { st.clock += m; st.gusts = st.gusts.filter((g) => g.until > st.clock); } },
    set: (name, v) => { st.terms[name] = v; },
    term(name, place) {
      if (name in st.terms) return st.terms[name];
      const p = P(place), zone = p.zone || place, off = (st.power[zone] || "on") === "off", lit = st.lights[place];
      switch (name) {
        case "tide": return tideAt(night, st.clock);
        case "night": return night.night;
        case "light": case "sodium": {
          const art = off ? p.dark ?? 0.05 : lit ? lit.light : p.light ?? 0.5, artSod = off ? 0 : lit ? lit.sodium : p.sodium ?? 0;
          const dl = (keyAt(night, "daylight", st.clock) || 0) * (p.dayLight ?? (p.shelter || p.stove ? 0.35 : 1)), total = dl > 0 ? 1 - (1 - art) * (1 - dl) : art;
          return name === "light" ? total : total > 0 ? (artSod * art) / total : 0;
        }
        case "day": return (keyAt(night, "daylight", st.clock) || 0) >= 0.5;
        case "mother": return st.mother;
        case "wind.speed": return (keyAt(night, name, st.clock) ?? 0) + st.gusts.reduce((a, g) => a + g.add, 0);
        case "weather": { const r = env.term("rain"), f = env.term("fog"); return r > 0.5 ? "rain" : f > 0.03 ? "fog" : "clear"; }
        default: break;
      }
      if (name.startsWith("power.")) return st.power[name.slice(6)] || "on";
      const k = keyAt(night, name, st.clock);
      if (k !== undefined) return k;
      if (["fog", "rain", "frost", "temp", "wind.dir", "daylight"].includes(name)) return 0;
      return undefined;
    },
    command([c, a, b, d]) {
      switch (c) {
        case "setPower": st.power[a] = b; if (b === "off" && a === (night.motherZone || "quay")) st.mother = "dark"; return true;
        case "restrike": st.mother = "burning"; return true;
        case "setTerm": st.terms[a] = isNaN(+b) ? b : +b; return true;
        case "clearTerm": delete st.terms[a]; return true;
        case "setLight": st.lights[a] = { light: +b, sodium: +(d ?? 0) }; return true;
        case "gust": st.gusts.push({ add: +a, until: st.clock + (+b || 10) }); return true;
        default: return false;
      }
    },
    save: () => JSON.parse(JSON.stringify(st)),
    load: (s) => { Object.assign(st, JSON.parse(JSON.stringify(s))); },
  };
  return env;
}
