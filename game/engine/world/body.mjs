// Lamb's body in the weather: wetness, what the clothes keep off and keep in, and the guise
// they show the town (R7). The meters that read these (Cold, Wear, Dread) are @meter records
// with rise lines (world/pressure.mjs), so the rates stay in content.
//   state.body = { wet }
// Wetness, 0 to 1: outdoors in rain it rises by @rules wet-rate per minute per mm/h of rain,
// times the exposure 1 - max(shed of the worn coat, the worn hat). Under shelter it dries with
// time constant @rules dry-tau minutes, by a stove @rules stove-tau. A place is sheltered when
// its @place has shelter: yes or stove: yes.
// Terms: wet, soaked (wet > 0.8), shed, warm (worn warmth; a coat counts 0 while wet > 0.3),
// guise (the worn coat's guise, else the hat's, else @rules guise-default), stove, shelter,
// bench (the current place has one).
export function createBody(G) {
  const rs = G.rs, B = () => (G.state.body ||= { wet: 0 });
  const worn = (slot) => { const id = G.inv.worn()[slot]; return id ? rs.items[id] : null; };
  const place = () => G.book.places[G.state.place] || {};
  const api = {
    wet: () => B().wet,
    soaked: () => B().wet > 0.8,
    addWet(n) {
      const b = B(), before = b.wet; b.wet = Math.max(0, Math.min(1, b.wet + n));
      if (b.wet !== before) G.emit("wet", { before, after: b.wet });
    },
    shed: () => Math.max(worn("coat") ? worn("coat").shed : 0, worn("hat") ? worn("hat").shed : 0),
    exposure: () => 1 - api.shed(),
    warm() {
      let w = 0;
      for (const [slot, id] of Object.entries(G.inv.worn())) {
        const it = rs.items[id]; if (!it) continue;
        if (slot === "coat" && B().wet > 0.3) continue;
        w += it.warm || 0;
      }
      return w;
    },
    guise() {
      for (const slot of ["coat", "hat"]) { const it = worn(slot); if (it && it.guise) return it.guise; }
      return rs.rules["guise-default"];
    },
    stove: () => !!place().stove,
    shelter: () => !!(place().shelter || place().stove),
    bench: () => !!place().bench,
    tick(minutes) {
      const b = B();
      if (api.shelter()) {
        const tau = api.stove() ? rs.rules["stove-tau"] : rs.rules["dry-tau"];
        if (b.wet > 0) api.addWet(b.wet * Math.exp(-minutes / tau) - b.wet);
      } else {
        const rain = +G.env.term("rain", G.state.place) || 0;
        if (rain > 0) api.addWet(rain * rs.rules["wet-rate"] * minutes * api.exposure());
      }
    },
  };
  return api;
}
