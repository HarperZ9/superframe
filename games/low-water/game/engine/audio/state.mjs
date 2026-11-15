// What the music reads from the game, as one plain snapshot (SCORE.md section 6). Every read is guarded:
// a missing system gives a neutral value, so the score runs on any story and in the tests.
//   snapshot(G, extra) -> { cue, lens, street, hunger, food, deaths, export, standing: { hesh, tarn }, wind,
//                           threat, intensity, phase, talking, inBout, crowd, readback, readbackNotes,
//                           harm, cls, bowlsMissing }
import { BOWLS } from "./theory.mjs";

const safe = (f, d) => { try { const v = f(); return v == null || Number.isNaN(v) ? d : v; } catch { return d; } };

// which cue plays where: the slice's areas (content/quota, wiring/quota-areas.lwd)
export const CUES = {
  "q.tower": "dawn", "q.furrowe_kitchen": "kitchen", "q.brack_kitchen": "kitchen", "q.haldane": "coda",
  "q.returns": "office", "q.office": "office", "q.cells": "office", "q.post": "road", "q.hill": "road", "q.furrowe_door": "dawn",
};
const STREET = { "q.tower": "square", "q.furrowe_door": "square", "q.returns": "square", "q.office": "square", "q.cells": "square", "q.post": "hollow", "q.hill": "hollow", "q.haldane": "haldane_yard", "q.brack_kitchen": "mill", "q.furrowe_kitchen": "square" };

// the record's harmony: the reported figure (q_figure) is "true", "inflated" or "blamed"
export function harmOf(G) {
  const f = safe(() => G.state.vars.q_figure, null);
  return f === "inflated" || f === "blamed" ? f : "true";
}

export function snapshot(G, extra = {}) {
  const area = safe(() => G.world.area().id, extra.area || null), street = STREET[area] || "square";
  const C = G && G.community, st = (k, d) => safe(() => C.stock(k, street), d);
  const bowls = safe(() => C.bowls("haldane"), 5);
  const fight = safe(() => G.fight || G.combat?.active, null);
  return {
    cue: extra.cue || (fight ? (fight.arena ? "arena" : "granary") : CUES[area] || "dawn"),
    lens: safe(() => G.lens.mode(), "near"), area, street,
    hunger: st("hunger", 0.3), food: st("food", 0.6), deaths: safe(() => C.stock("deaths", "square"), 0),
    export: !!safe(() => C.stock("export"), 0), standing: { hesh: st("standing.hesh", 0), tarn: st("standing.tarn", 0) },
    wind: extra.wind ?? 0.5, threat: !!(extra.threat ?? safe(() => G.state.vars.q_squad_near, false)),
    intensity: extra.intensity ?? safe(() => fight.intensity, 0), phase: extra.phase ?? safe(() => fight.phase, 1),
    talking: !!(extra.talking ?? safe(() => fight.talking, false)), inBout: extra.inBout ?? !!fight, crowd: extra.crowd ?? 0,
    readback: !!extra.readback, readbackNotes: !!extra.readbackNotes,
    harm: harmOf(G), cls: safe(() => G.state.vars.q_class, "inspector"),
    bowlsMissing: BOWLS.slice(2, 2 + Math.max(0, 5 - bowls)),         // Tomas first, then Aaron, then Anni (open question 4)
  };
}
