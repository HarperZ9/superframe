// The trait cabinet (Low Water's Margin): notes Lamb finds in conversation, carries in a slot
// while they are researched (pencilled: game minutes, with their own costs while they cook), and
// keeps as traits with lasting effects once done (inked). Forgetting a trait frees its slot.
//   state.cabinet = { found: [id], slots: [{ id, spent }], done: [id in completion order], extra }
// Pages (sheet points) buy extra slots up to @rules cabinet-slots-max, and pay @rules
// forget-cost to forget a trait (R9). An archetype's traits start done (R6).
import { runEffects } from "../core/expr.mjs";

export function createCabinet(G) {
  const rs = G.rs, C = () => (G.state.cabinet ||= { found: [], slots: [], done: [], extra: 0 });
  const R = (k) => rs.rules[k];
  const api = {
    slots: () => Math.min(R("cabinet-slots-max"), R("cabinet-slots") + (C().extra || 0)) + G.sheet.mods("cabinet.slots").reduce((a, m) => a + m.amount, 0),
    free: () => api.slots() - C().slots.length,
    status(id) {
      const c = C(), slotted = c.slots.some((s) => s.id === id);
      if (c.done.includes(id) && slotted) return "done";
      if (slotted) return "researching";
      if (c.done.includes(id)) return "forgotten";
      if (c.found.includes(id)) return "found";
      return "none";
    },
    offer(id) {
      if (!rs.traits[id]) throw new Error(`no trait ${id}`);
      const c = C(); if (c.found.includes(id)) return false;
      c.found.push(id); G.emit("trait.found", { id, name: rs.traits[id].name }); return true;
    },
    canResearch(id) {
      const c = C(), t = rs.traits[id];
      if (!t || !c.found.includes(id)) return "Not found yet";
      if (c.slots.some((s) => s.id === id)) return "Already in the cabinet";
      if (c.done.includes(id)) return "Already learned once";
      if (api.free() <= 0) return "No free slot";
      return null;
    },
    research(id) { const why = api.canResearch(id); if (why) return why; C().slots.push({ id, spent: 0 }); G.emit("trait.research", { id }); return null; },
    // Forgetting costs @rules forget-cost pages (0 in the generic rules, 1 in Low Water's).
    canForget(id) {
      if (!C().slots.some((s) => s.id === id)) return "Not in the cabinet";
      if (G.state.sheet.points < R("forget-cost")) return `Needs ${R("forget-cost")} page${R("forget-cost") === 1 ? "" : "s"}`;
      return null;
    },
    forget(id) {
      const why = api.canForget(id); if (why) return why;
      const c = C(), k = c.slots.findIndex((s) => s.id === id);
      c.slots.splice(k, 1); G.state.sheet.points -= R("forget-cost");
      G.emit("trait.forget", { id }); return null;
    },
    canBuySlot() {
      if (R("cabinet-slots") + (C().extra || 0) >= R("cabinet-slots-max")) return "The margin is full";
      if (G.state.sheet.points < 1) return "Needs a page";
      return null;
    },
    buySlot() { const why = api.canBuySlot(); if (why) return why; C().extra = (C().extra || 0) + 1; G.state.sheet.points -= 1; G.emit("trait.slot", { slots: api.slots() }); return null; },
    // Character creation: the trait is found, slotted and done, and its effects run (R6).
    grant(id) {
      const t = rs.traits[id]; if (!t) throw new Error(`no trait ${id}`);
      const c = C();
      if (!c.found.includes(id)) c.found.push(id);
      if (!c.slots.some((s) => s.id === id)) c.slots.push({ id, spent: t.research });
      if (!c.done.includes(id)) { c.done.push(id); if (t.effects) runEffects(t.effects, G.scope); }
      G.emit("trait.done", { id, name: t.name, granted: true });
    },
    // Done traits still in the cabinet, in the order they were completed.
    completed: () => C().done.filter((id) => C().slots.some((s) => s.id === id)),
    progress(id) { const s = C().slots.find((x) => x.id === id); return s ? Math.min(1, s.spent / Math.max(1, rs.traits[id].research)) : 0; },
    list: () => C().found.map((id) => ({ ...rs.traits[id], status: api.status(id), progress: api.progress(id), why: api.status(id) === "found" ? api.canResearch(id) : null })),
    // The clock moved: research advances in every slot.
    tick(minutes) {
      for (const s of C().slots) {
        if (C().done.includes(s.id)) continue;
        s.spent += minutes;
        if (s.spent >= rs.traits[s.id].research) {
          C().done.push(s.id); const t = rs.traits[s.id];
          if (t.effects) runEffects(t.effects, G.scope);
          G.emit("trait.done", { id: s.id, name: t.name });
        }
      }
    },
    mods() {
      const out = [];
      for (const s of C().slots) {
        const t = rs.traits[s.id]; if (!t) continue;
        const done = C().done.includes(s.id);
        for (const m of done ? t.mods : t.during) out.push({ ...m, label: `${t.name}${done ? "" : " (researching)"}` });
      }
      return out;
    },
  };
  return api;
}
