// Items, clothing, crafting and salvage, and the gear layer an action-RPG build reads:
// requirements to wear or wield (@item requires), upgrade stages (@item upgrade), and gear(slot)
// for the combat layer (the item, its upgrade level, the modifiers it gives now).
//   state.inv = { items: { id: count }, equipped: { slot: id }, upgrades: { id: level } }
// An item with a slot gives its modifiers when worn; an item without a slot gives them while
// carried (a charm, a lantern in the hand is a slot: hand). Recipes take items and minutes and
// may need a tool held; salvage breaks an item into its parts.
import { evaluate } from "../core/expr.mjs";

export function createInventory(G) {
  const rs = G.rs, I = () => (G.state.inv ||= { items: {}, equipped: {} });
  const name = (id) => (rs.items[id] ? rs.items[id].name : id);
  const api = {
    count: (id) => I().items[id] || 0,
    list: () => Object.entries(I().items).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, item: rs.items[id], worn: api.isWorn(id) })),
    isWorn: (id) => Object.values(I().equipped).includes(id),
    give(id, n = 1) {
      if (!rs.items[id]) throw new Error(`no item ${id}`);
      I().items[id] = api.count(id) + n; G.emit("item.gain", { id, n, name: name(id) });
    },
    take(id, n = 1) {
      const have = api.count(id); if (have < n) return false;
      I().items[id] = have - n;
      if (I().items[id] === 0) { delete I().items[id]; for (const [s, v] of Object.entries(I().equipped)) if (v === id) delete I().equipped[s]; }
      G.emit("item.lose", { id, n, name: name(id) }); return true;
    },
    equip(id) {
      const it = rs.items[id]; if (!it || !it.slot) return "That is not worn";
      if (!api.count(id)) return "You do not have it";
      if (it.requires && !evaluate(it.requires, G.scope)) return `Needs ${it.requires.src}`;
      const prev = I().equipped[it.slot]; I().equipped[it.slot] = id; G.emit("item.equip", { id, slot: it.slot, prev }); return null;
    },
    unequip(slot) { const id = I().equipped[slot]; if (!id) return false; delete I().equipped[slot]; G.emit("item.unequip", { id, slot }); return true; },
    worn: () => ({ ...I().equipped }),
    mods() {
      const out = [];
      for (const [id, n] of Object.entries(I().items)) {
        const it = rs.items[id]; if (!it || !n) continue;
        if (it.slot && !api.isWorn(id)) continue;
        for (const m of it.mods) out.push({ ...m, label: it.name });
        for (const u of it.upgrades || []) if (u.n <= api.level(id)) for (const m of u.mods) out.push({ ...m, label: `${it.name} +${u.n}` });
      }
      return out;
    },
    // Gear upgrades
    level: (id) => ((I().upgrades || {})[id] || 0),
    nextUpgrade: (id) => { const it = rs.items[id]; return it && it.upgrades ? it.upgrades.find((u) => u.n === api.level(id) + 1) || null : null; },
    upgradeWhy(id) {
      const u = api.nextUpgrade(id); if (!u) return "No further upgrade";
      if (!api.count(id)) return "You do not have it";
      for (const c of u.needs) if (api.count(c.id) < c.n) return `Needs ${c.n} ${name(c.id)} (have ${api.count(c.id)})`;
      return null;
    },
    upgrade(id) {
      const why = api.upgradeWhy(id); if (why) return why;
      const u = api.nextUpgrade(id); for (const c of u.needs) api.take(c.id, c.n);
      (I().upgrades ||= {})[id] = u.n; G.emit("item.upgrade", { id, level: u.n }); return null;
    },
    // What the combat layer reads: the piece in a slot, its upgrade level and its modifiers now.
    gear(slot) {
      const id = I().equipped[slot]; if (!id) return null;
      const it = rs.items[id], lv = api.level(id);
      return { id, level: lv, item: it, mods: [...it.mods, ...(it.upgrades || []).filter((u) => u.n <= lv).flatMap((u) => u.mods)].filter((m) => !m.cond || evaluate(m.cond, G.scope)) };
    },
    // Crafting
    known: () => Object.values(rs.recipes).filter((r) => evaluate(r.known, G.scope)),
    whyNot(rid) {
      const r = rs.recipes[rid]; if (!r) return "No such recipe";
      if (!evaluate(r.known, G.scope)) return "You do not know how";
      for (const t of r.tool) if (!api.count(t)) return `Needs ${name(t)} to hand`;
      for (const c of r.in) if (api.count(c.id) < c.n) return `Needs ${c.n} ${name(c.id)} (have ${api.count(c.id)})`;
      if (r.when && !evaluate(r.when, G.scope)) return "Not here, not now";
      return null;
    },
    craft(rid) {
      const why = api.whyNot(rid); if (why) return why;
      const r = rs.recipes[rid];
      for (const c of r.in) api.take(c.id, c.n);
      if (r.out.id) api.give(r.out.id, r.out.n);
      if (r.cost) G.advance(r.cost);
      G.emit("craft", { id: rid, out: r.out }); return null;
    },
    salvage(id) {
      const it = rs.items[id]; if (!it || !it.salvage.length) return "Nothing to salvage";
      if (!api.take(id, 1)) return "You do not have it";
      for (const c of it.salvage) api.give(c.id, c.n);
      G.emit("salvage", { id, out: it.salvage }); return null;
    },
  };
  return api;
}
