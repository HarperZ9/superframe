// The real-time hazard layer: the tide, the weather and the dark as danger while Lamb moves.
//   @hazard id   name, where (condition on place or area), when (condition on the environment),
//                every (real seconds between hits, default 1), do (effects per hit),
//                enter (effects once on entering), leave (effects once on leaving),
//                warn (text shown on entering), danger (expression 0..1 for the interface)
// The shell calls step(dt) with real seconds while the player is in control (walking, not in a
// conversation). Hazards read the environment through the same scope as dialogue, so a hazard is
// as data-driven as a line: `when: tide > -0.3`, `do: res.health -= 1; wet(0.1)`.
import { compile, compileEffects, evaluate, runEffects } from "../core/expr.mjs";

export function loadHazards(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).hazard || {})) {
    const g = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
    try {
      out[r.id] = { id: r.id, name: g("name") || r.id, where: compile(g("where")), when: compile(g("when")), every: +(g("every") || 1), effects: compileEffects(g("do")), enter: compileEffects(g("enter")), leave: compileEffects(g("leave")), warn: g("warn") || "", danger: compile(g("danger") || "1"), file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `hazard ${r.id}: ${e.message}` }); }
  }
  return { hazards: out, errors };
}

// step(dt) runs every hazard while Lamb walks; during a Tide Run the run steps its own listed
// hazards (stepOnly). Where and when conditions hold in both.
export function createHazards(G, hazards) {
  const live = () => (G.state.hazards ||= {});
  const api = {
    active: () => Object.keys(live()).map((id) => hazards[id]).filter(Boolean),
    // 0..1: how much danger the player is in now, for the interface's tension.
    danger: () => api.active().reduce((a, h) => Math.max(a, Math.max(0, Math.min(1, +evaluate(h.danger, G.scope) || 0))), 0),
    step(dt) { api.run(Object.values(hazards), dt); },
    stepOnly(ids, dt) { api.run(ids.map((id) => hazards[id]).filter(Boolean), dt); },
    run(list, dt) {
      for (const h of list) {
        const on = (!h.where || evaluate(h.where, G.scope)) && (!h.when || evaluate(h.when, G.scope)), L = live();
        if (on && !L[h.id]) { L[h.id] = { t: 0 }; if (h.enter) runEffects(h.enter, G.scope); G.emit("hazard.enter", { id: h.id, name: h.name, warn: h.warn }); }
        else if (!on && L[h.id]) { delete L[h.id]; if (h.leave) runEffects(h.leave, G.scope); G.emit("hazard.leave", { id: h.id }); continue; }
        if (!on) continue;
        L[h.id].t += dt;
        while (L[h.id] && L[h.id].t >= h.every) { L[h.id].t -= h.every; if (h.effects) runEffects(h.effects, G.scope); G.emit("hazard.hit", { id: h.id }); }
      }
    },
  };
  return api;
}
