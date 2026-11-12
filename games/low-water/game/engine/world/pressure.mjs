// Rumour and pressure: what is said travels, and some places get hot.
// Rumour: pressure 0..1 per fact per district. Each 30 minutes of the clock it decays and
// spreads to the districts next door (@district next). Above 0.5 the district knows.
//   state.rumour = { fact: { district: p } }, state.rumourAt = last spread minute
// Meters (@meter id): name, about, min, max, start, decay (per hour, toward start),
// scope (district or global), warn (n text, repeatable). For cover, heat, suspicion, nerve, and
// Low Water's Cold, Wear and Dread (R4):
//   rise: n ? cond     per game hour while cond holds (repeatable; negative falls)
//   full: node         played when the meter reaches max: outside a conversation at once,
//                      inside one at the next node boundary. In the id, "$district" becomes the
//                      current district; "$trait" tries each completed trait, latest first, then
//                      "default" (full: nod.$trait -> nod.m.clocks, else nod.default). When none
//                      of those nodes exist, the part before ".$" is used (chilled.$district ->
//                      chilled).
//   after: n           the meter's value once the full scene has played (default: unchanged)
//   wait: minutes      minutes that pass when the full scene plays (R5 nodding: 30)
//   state.meters = { id: { districtOrGlobal: value } }, state.full = { id: true } while full
import { compile, evaluate } from "../core/expr.mjs";
const SPREAD = 30;

export function loadMeters(book) {
  const out = {};
  for (const r of Object.values((book.records || {}).meter || {})) {
    const g = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; }, n = (k, d) => (g(k) == null ? d : +g(k));
    const rise = r.kv.filter((e) => e.key === "rise").map((e) => { const m = e.value.trim().match(/^([+-]?\d+(?:\.\d+)?)(?:\s*\?\s*(.*))?$/); if (!m) throw new SyntaxError(`meter ${r.id}: rise: expected "n ? cond", got ${e.value}`); return { per: +m[1], cond: compile(m[2]), line: e.line }; });
    out[r.id] = { id: r.id, name: g("name") || r.id, about: g("about") || "", min: n("min", 0), max: n("max", 1), start: n("start", 0), decay: n("decay", 0), scope: g("scope") || "global",
      rise, full: g("full") || null, after: g("after") == null ? null : +g("after"), wait: n("wait", 0), file: r.file, line: r.line,
      warn: r.kv.filter((e) => e.key === "warn").map((e) => { const v = e.value.trim(), k = v.indexOf(" "); return { at: +v.slice(0, k), text: v.slice(k + 1) }; }).sort((a, b) => a.at - b.at) };
  }
  return out;
}

export function createPressure(G, { districts, meters }) {
  const st = G.state, here = () => (G.world.district() || { id: "*" }).id;
  const rum = () => (st.rumour ||= {}), met = () => (st.meters ||= {});
  const api = {
    rumour: (fact, d = here()) => ((rum()[fact] || {})[d] || 0),
    knows: (fact, d = here()) => api.rumour(fact, d) >= 0.5,
    addRumour(fact, d = here(), w = 0.2) { const r = (rum()[fact] ||= {}); r[d] = Math.min(1, (r[d] || 0) + w); G.emit("rumour", { fact, district: d, value: r[d] }); },
    spread() {
      for (const r of Object.values(rum())) {
        const next = {};
        for (const d of Object.keys(districts)) {
          const nb = districts[d].next.reduce((a, n) => a + (r[n] || 0), 0);
          next[d] = Math.min(1, 0.85 * (r[d] || 0) + 0.25 * nb / Math.max(1, districts[d].next.length));
          if (next[d] < 0.01) delete next[d];
        }
        for (const k of Object.keys(r)) if (!districts[k]) next[k] = r[k] * 0.85;
        Object.keys(r).forEach((k) => delete r[k]); Object.assign(r, next);
      }
    },
    meterKey: (id) => (meters[id] && meters[id].scope === "district" ? here() : "*"),
    meter(id, key = api.meterKey(id)) { const m = meters[id]; if (!m) return 0; const v = (met()[id] || {})[key]; return v == null ? m.start : v; },
    addMeter(id, n, key = api.meterKey(id)) {
      const m = meters[id]; if (!m) throw new Error(`no meter ${id}`);
      const before = api.meter(id, key), after = Math.max(m.min, Math.min(m.max, before + n));
      (met()[id] ||= {})[key] = after;
      for (const w of m.warn) if (before < w.at && after >= w.at) G.emit("meter.warn", { id, text: w.text, value: after });
      G.emit("meter", { id, key, before, after });
      const F = (st.full ||= {});
      if (after >= m.max && !F[id] && m.full) { F[id] = true; (st.fullQueue ||= []).push(id); G.emit("meter.full", { id }); }
      else if (after < m.max && F[id]) delete F[id];
    },
    // The next full meter whose scene should play, with its node resolved; null when none.
    takeFull() {
      const q = st.fullQueue || [];
      while (q.length) { const id = q.shift(), node = api.fullNode(id); if (node) return { id, node }; }
      return null;
    },
    fullNode(id) {
      const m = meters[id]; if (!m || !m.full) return null;
      const nodes = G.book.nodes, d = (G.world.district() || {}).id || "";
      let ids = [m.full];
      if (m.full.includes("$trait")) ids = [...G.cabinet.completed().reverse().map((t) => m.full.replace("$trait", t)), m.full.replace("$trait", "default")];
      ids = ids.map((x) => x.replace("$district", d));
      const found = ids.find((x) => nodes[x]);
      if (found) return found;
      const bare = m.full.split(".$")[0];
      return nodes[bare] ? bare : null;
    },
    // After the full scene: set the meter to its after value and let the night move on.
    afterFull(id) { const m = meters[id]; if (!m) return; if (m.wait) G.advance(m.wait); if (m.after != null) api.addMeter(id, m.after - api.meter(id)); },
    // The clock moved.
    tick(minutes) {
      for (const m of Object.values(meters)) {
        const per = m.rise.reduce((a, r) => a + (!r.cond || evaluate(r.cond, G.scope) ? r.per : 0), 0);
        if (per) api.addMeter(m.id, (per * minutes) / 60);
      }
      for (const m of Object.values(meters)) if (m.decay) for (const key of Object.keys(met()[m.id] || {})) {
        const v = met()[m.id][key], d = (m.decay * minutes) / 60;
        met()[m.id][key] = v > m.start ? Math.max(m.start, v - d) : Math.min(m.start, v + d);
      }
      st.rumourAt ??= G.clock() - minutes;
      while (G.clock() - st.rumourAt >= SPREAD) { st.rumourAt += SPREAD; api.spread(); }
    },
  };
  return api;
}
