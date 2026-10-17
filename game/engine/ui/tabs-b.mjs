// Daybook tabs, second half: Pack (clothes, carried things, crafting, salvage), Lamps (the
// settlement's projects), Town (factions as sentences) and History (every line, with hidden
// check results in a quieter style).
import { h, btn, clockText, signed } from "./dom.mjs";
import { empty, section, modText, notchBar } from "./tabs-a.mjs";
import { lineEl, hiddenEl } from "./talk.mjs";

const itemName = (G, id) => (G.rs.items[id] ? G.rs.items[id].name : id);
const counts = (G, list) => list.map((c) => `${c.n} ${itemName(G, c.id)}`).join(", ");

function itemRow(ctx, it, rerender) {
  const G = ctx.G, def = it.item || {}, acts = [];
  if (def.slot && !it.worn) acts.push(btn("Wear", () => { G.inv.equip(it.id); rerender(); }, { cls: "mini" }));
  if (def.slot && it.worn) acts.push(btn("Take off", () => { G.inv.unequip(def.slot); rerender(); }, { cls: "mini" }));
  if (def.salvage && def.salvage.length) acts.push(btn(`Salvage for ${counts(G, def.salvage)}`, () => { G.inv.salvage(it.id); rerender(); }, { cls: "mini" }));
  const mods = (def.mods || []).map((m) => modText(G, m));
  return h("div.item",
    h("div.thead", h("span.tname", def.name || it.id), it.n > 1 ? h("span.mono", ` x${it.n}`) : null, def.slot ? h("span.caps.quiet", it.worn ? `worn: ${def.slot}` : def.slot) : null),
    def.about ? h("p.small", def.about) : null,
    mods.length ? h("p.mods.mono.small", mods.join("; ")) : null,
    acts.length ? h("div.acts-row", acts) : null);
}

function recipeRow(ctx, r, rerender) {
  const G = ctx.G, why = G.inv.whyNot(r.id);
  return h("div.item",
    h("div.thead", h("span.tname", r.name), h("span.mono.small.quiet", r.cost ? `${r.cost} min` : "")),
    h("p.mods.mono.small", `${counts(G, r.in)}${r.tool.length ? `; to hand: ${r.tool.map((t) => itemName(G, t)).join(", ")}` : ""}  makes ${r.out.n} ${itemName(G, r.out.id)}`),
    h("div.acts-row", btn("Make it", () => { G.inv.craft(r.id); rerender(); }, { cls: "mini", disabled: !!why, title: why || "" }), why ? h("span.why.small", why) : null));
}

export function packTab(ctx, rerender) {
  const G = ctx.G, items = G.inv.list(), worn = Object.entries(G.inv.worn()), recipes = G.inv.known();
  const body = h("div.attrs",
    h("div.attr", h("span.aname", "Wet"), h("span.lvl.mono", `${Math.round(G.body.wet() * 100)} percent`)),
    h("div.attr", h("span.aname", "Warmth worn"), h("span.lvl.mono", String(G.body.warm()))),
    h("div.attr", h("span.aname", "Taken for"), h("span.lvl.mono", String(G.body.guise()))));
  return h("div.cols",
    h("div",
      section("Worn", worn.length ? h("ul.entries", worn.map(([slot, id]) => h("li", h("span.t.mono", slot), h("span", itemName(G, id))))) : empty("Nothing worn.")),
      section("Body", body),
      section("Carried", ...(items.length ? items.map((it) => itemRow(ctx, it, rerender)) : [empty("Empty pockets.")]))),
    h("div", section("Making", ...(recipes.length ? recipes.map((r) => recipeRow(ctx, r, rerender)) : [empty("No recipes known.")]))));
}

export function lampsTab(ctx, rerender) {
  const G = ctx.G, list = G.settlement.list();
  if (!list.length) return section("Lamps", empty("Nothing in town to put back yet."));
  return section("Lamps", ...list.map((p) => {
    const d = p.district ? (G.content.map.districts[p.district] || {}).name || p.district : "";
    const next = p.next;
    return h("div.item",
      h("div.thead", h("span.tname", p.name), h("span.caps.quiet", d), h("span.mono.small", `${p.done} of ${p.stages.length} stages`)),
      notchBar(p.done / Math.max(1, p.stages.length), p.stages.length),
      p.about ? h("p.small", p.about) : null,
      next ? h("p.small", h("strong", `Next: ${next.name}. `), next.about || "", next.needs.length ? h("span.mono", `  needs ${counts(G, next.needs)}`) : null) : h("p.small", "Finished."),
      next ? h("div.acts-row", btn("Give the materials", () => { G.settlement.contribute(p.id); rerender(); }, { cls: "mini", disabled: !!p.why, title: p.why || "" }), p.why ? h("span.why.small", p.why) : null) : null);
  }));
}

export function townTab(ctx) {
  const G = ctx.G, fs = G.factions.list();
  if (!fs.length) return section("Town", empty("Nobody in town has an opinion yet."));
  return section("Town", h("ul.town", fs.map((f) => h("li",
    h("span.sentence", `${f.name.startsWith("The ") ? "" : "The "}${f.name} reads you as ${String(f.tier || "unknown").toLowerCase()}.`),
    h("span.mono.small.quiet", `favour ${signed(f.value)}`),
    f.about ? h("span.small.quiet", f.about) : null))));
}

export function historyTab(ctx) {
  const log = ctx.G.memory.history();
  if (!log.length) return section("History", empty("Nothing said yet."));
  const el = section("History", h("div.history", log.map((l) => h("div.hrow", h("span.t.mono", clockText(l.at)), l.hidden ? hiddenEl(l) : lineEl(l)))));
  el.dataset.end = "";
  return el;
}
