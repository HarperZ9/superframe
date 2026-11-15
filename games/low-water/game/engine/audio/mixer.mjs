// The runtime mixer: pure scheduling, no audio. It keeps, per layer, a list of gain ramps in seconds of the
// audio clock, and answers gainAt(layer, t). The web adapter (web/player.mjs) copies the same ramps onto
// AudioParams; the offline renders evaluate gainAt per block. Rules (SCORE.md section 6):
// - a level change or a harmony change starts on a bar line, never mid-bar, and lasts whole bars;
// - a harmony change is an equal-power crossfade between a stem's variants, and it persists;
// - ducking under voice lines is separate from the bar grid: it follows the line, with a short look-ahead;
// - nothing here can add a sound: the mixer only moves gains of stems that are already playing.
export const SILENT = 0;
const dbg = (db) => (db == null ? 0 : Math.pow(10, db / 20));

// a layer's gain at t from its ramps (linear, or equal-power in and out)
function segAt(segs, t, init) {
  let g = init;
  for (const s of segs) {
    if (t < s.t0) break;
    if (t >= s.t1) { g = s.g1; continue; }
    const u = (t - s.t0) / (s.t1 - s.t0);
    if (s.curve === "in") return s.g0 + (s.g1 - s.g0) * Math.sin(u * Math.PI / 2);
    if (s.curve === "out") return s.g1 + (s.g0 - s.g1) * Math.cos(u * Math.PI / 2);
    return s.g0 + (s.g1 - s.g0) * u;
  }
  return g;
}
// a new ramp from t0 replaces what was scheduled after t0, starting from the gain the layer has then
function ramp(L, t0, t1, g1, curve = "lin") {
  const g0 = segAt(L.segs, t0, L.init);
  L.segs = L.segs.filter((s) => s.t0 < t0).map((s) => (s.t1 > t0 ? { ...s, t1: t0, g1: segAt([s], t0, L.init) } : s));
  L.segs.push({ t0, t1, g0, g1, curve });
  return { t0, t1, g0, g1 };
}

// the deepest duck acting on a group at t
function duckGain(ducks, group, t) {
  let g = 1;
  for (const d of ducks) {
    if (!d.groups.includes(group) || t < d.start || t > d.end + d.release) continue;
    const full = d.depth === -Infinity ? 0 : dbg(d.depth);
    const k = t < d.start + d.attack ? (t - d.start) / d.attack : t <= d.end ? 1 : 1 - (t - d.end) / d.release;
    g = Math.min(g, 1 - (1 - full) * k);
  }
  return g;
}

export function createMixer({ bpm, meter = 4, origin = 0, lookahead = 0.05, fadeBars = 1, harmBars = 2 } = {}) {
  const barSec = meter * 60 / bpm, layers = {}, variants = {}, ducks = [];
  let harm = null;
  const nextBar = (t) => origin + Math.ceil((t + lookahead - origin) / barSec - 1e-9) * barSec;

  const layer = (id, o = {}) => (layers[id] ||= { id, init: dbg(o.db ?? null), segs: [], group: o.group || "music", base: o.base || id });

  return {
    barSec, nextBar,
    layer(id, o) { layer(id, o); return this; },
    // a stem with harmonic variants: { true: "drone", inflated: "drone@inflated" }
    variants(base, map) { variants[base] = map; for (const id of Object.values(map)) layer(id, { base, group: (layers[base] || {}).group }); return this; },
    // set a layer's level (dB or null for silent); the fade starts on the next bar line after `now`
    set(id, db, now, bars = fadeBars) {
      const t0 = nextBar(now), t1 = t0 + bars * barSec, out = [];
      const ids = variants[id] ? Object.values(variants[id]) : [id];
      for (const v of ids) {
        const live = !variants[id] || v === (variants[id][harm] || variants[id][Object.keys(variants[id])[0]]);
        out.push({ id: v, ...ramp(layer(v), t0, t1, live ? dbg(db) : 0) });
      }
      for (const v of ids) layer(v).level = db;
      return out;
    },
    // move every variant stem to a harmony; the old variant fades out as the new one fades in
    harmony(name, now, bars = harmBars) {
      if (name === harm) return [];
      const t0 = nextBar(now), t1 = t0 + bars * barSec, out = [];
      harm = name;
      for (const [base, map] of Object.entries(variants)) {
        const target = map[name] || map[Object.keys(map)[0]];
        for (const id of Object.values(map)) {
          const L = layer(id), lvl = dbg(L.level ?? null);
          out.push({ id, ...ramp(L, t0, t1, id === target ? lvl : 0, id === target ? "in" : "out") });
        }
      }
      return out;
    },
    get harm() { return harm; },
    // duck a group under a line from `start` to `end`: { depth (dB), attack, release, groups }
    // lines closer together than the release share one duck, so the music does not pump between them
    duck(start, end, o = {}) {
      const d = { start: start - (o.ahead ?? 0.15), end, depth: o.depth ?? -9, attack: o.attack ?? 0.12, release: o.release ?? 0.8, groups: o.groups || ["music"] };
      const prev = ducks.find((x) => x.groups.join() === d.groups.join() && x.depth === d.depth && x.end + x.release > d.start && x.start <= d.start);
      if (prev) { prev.end = Math.max(prev.end, end); return prev; }
      ducks.push(d); return d;
    },
    duckAt(group, t) { return duckGain(ducks, group, t); },
    gainAt(id, t) { const L = layers[id]; return L ? segAt(L.segs, t, L.init) * this.duckAt(L.group, t) : 0; },
    levelAt(id, t) { const L = layers[id]; return L ? segAt(L.segs, t, L.init) : 0; },
    ramps(id) { return (layers[id] || { segs: [] }).segs.slice(); },
    ducks: () => ducks.slice(),
    ids: () => Object.keys(layers),
  };
}
