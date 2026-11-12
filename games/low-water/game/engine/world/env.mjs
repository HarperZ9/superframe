// Environment adapters. The engine layer reads the world through one small interface:
//   env.clock()             minutes on the night's clock (23:00 = 1380; after midnight > 1440)
//   env.advance(minutes)    move the night on
//   env.term(name, place)   tide, fog, rain, wind.dir, wind.speed, light, sodium, weather,
//                           power.<zone>, mother, wet, plus anything content adds
//   env.command(args)       an LWD cmd line (setPower quay off, restrike mother, wet lamb 0.3);
//                           returns true when the environment handled it
//   env.save() / env.load(saved)
// fixedEnv is for tests and tools. nightEnv wraps the prototype's night (game/night.mjs: the
// raw-native environment hub plus the tide, power and Mother).

export function fixedEnv({ clock = 23 * 60, terms = {}, places = {} } = {}) {
  const st = { clock, terms: { ...terms }, wet: 0, power: {}, mother: "dark" };
  const env = {
    clock: () => st.clock,
    advance: (m) => { st.clock += m; },
    set: (name, v) => { st.terms[name] = v; },
    term(name, place) {
      const t = st.terms[name];
      if (typeof t === "function") return t(st.clock, place);
      if (t !== undefined) return t;
      const P = places[place] || {}, zone = P.zone || place, off = st.power[zone] === "off";
      if (name === "light") return off ? P.dark ?? 0.05 : P.light ?? 0.5;
      if (name === "sodium") return off ? 0 : P.sodium ?? 0;
      if (name.startsWith("power.")) return st.power[name.slice(6)] || "on";
      if (name === "mother") return st.mother;
      if (name === "wet") return st.wet;
      return undefined;
    },
    command([c, a, b]) {
      if (c === "setPower") { st.power[a] = b; if (b === "off" && a === "quay") st.mother = "dark"; return true; }
      if (c === "restrike") { st.mother = "burning"; return true; }
      if (c === "wet") { st.wet = Math.min(1, st.wet + (+b || 0)); return true; }
      if (c === "setTerm") { st.terms[a] = isNaN(+b) ? b : +b; return true; }
      return false;
    },
    save: () => JSON.parse(JSON.stringify({ ...st, terms: Object.fromEntries(Object.entries(st.terms).filter(([, v]) => typeof v !== "function")) })),
    load: (s) => { const fns = Object.fromEntries(Object.entries(st.terms).filter(([, v]) => typeof v === "function")); Object.assign(st, s); st.terms = { ...s.terms, ...fns }; },
  };
  return env;
}

// The prototype's night (createNight from game/night.mjs) with LWD/0 place semantics. The night
// is deterministic from 23:00 given its schedule, so a load rebuilds it with remake() and
// replays the clock forward; power, Mother and wetness are restored as saved.
export function nightEnv(first, places = {}, { remake = null } = {}) {
  let night = first;
  const P = (place) => places[place] || { light: 0.5, sodium: 0.5, dark: 0.1, zone: "quay" };
  const env = {
    get night() { return night; },
    clock: () => night.clock,
    advance: (m) => night.advance(m),
    term(name, place) {
      const p = P(place), off = night.power === "off" && p.zone === "quay";
      switch (name) {
        case "tide": return night.tide();
        case "fog": return night.fog();
        case "rain": return night.rain();
        case "weather": return night.rain() > 0.5 ? "rain" : night.fog() > 0.03 ? "fog" : "clear";
        case "wind.dir": return night.clock < 23 * 60 + 35 ? 270 : 225;
        case "wind.speed": return night.snap.wind.speed;
        case "light": return place === "lamproom" && night.mother === "burning" ? 0.9 : off ? p.dark : p.light;
        case "sodium": return off ? 0 : p.sodium;
        case "power.quay": return night.power;
        case "mother": return night.mother;
        case "wet": return night.wet;
        default: return undefined;
      }
    },
    command([c, a, b]) {
      if (c === "setPower" && a === "quay") { night.power = b; if (b === "off") night.mother = "dark"; return true; }
      if (c === "restrike") { night.mother = "burning"; return true; }
      if (c === "wet") { night.wet = Math.min(1, night.wet + (+b || 0)); return true; }
      return false;
    },
    save: () => ({ clock: night.clock, power: night.power, mother: night.mother, wet: night.wet }),
    async load(s) {
      if (s.clock < night.clock) { if (!remake) throw new Error("nightEnv: cannot go back in time without remake()"); night = await remake(); }
      if (s.clock > night.clock) night.advance(s.clock - night.clock);
      night.power = s.power; night.mother = s.mother; night.wet = s.wet;
    },
  };
  return env;
}
