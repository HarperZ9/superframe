// The save and load panel (slots with their summaries) and the pause menu that leads to it.
// Ink mode keeps one night: manual saves and loads are refused with the engine's reason.
import { h, btn, clockText } from "./dom.mjs";

const SLOT_NAME = { auto: "Autosave", quick: "Quick" };

function summary(save) {
  if (!save) return h("span.quiet", "Empty");
  if (save.error) return h("span.quiet", `Unreadable: ${save.error}`);
  const s = save.summary || {}, when = save.savedAt ? new Date(save.savedAt) : null;
  return h("span.ssum",
    h("span.mono", s.time || clockText(s.clock || 0)), "  ", h("span", s.area || ""),
    h("span.mono.small.quiet", `  level ${s.level ?? 1}${save.label && save.slot !== "auto" ? `  ${save.label}` : ""}${when ? `  saved ${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`));
}

function panel(ctx, title, body, { onClose } = {}) {
  const root = h("div.screen.dim", h("div.menu.sheet.wide.fade-in", h("h2", title), body, h("div.mono.small.quiet.foot", "Esc or B: back")));
  ctx.stage.append(root);
  const layer = ctx.F.push({ name: title, root, onBack: () => close() });
  function close() { ctx.F.pop(layer); root.remove(); if (onClose) onClose(); }
  return { root, close, layer };
}

// mode: "save" or "load".
export function openSaves(ctx, mode = "load") {
  if (!ctx.saves) ctx.newGame();
  const S = ctx.saves, list = h("div.slots"), note = h("p.small.note");
  const p = panel(ctx, mode === "save" ? "Save the night" : "Load a night", h("div", S.ink ? h("p.small", "Ink mode: the night saves itself, and there is no going back.") : null, list, note));
  function fill() {
    const rows = S.list().filter(({ slot }) => mode === "load" || slot !== "auto");
    list.replaceChildren(...rows.map(({ slot, save }) => {
      const go = mode === "save" ? () => doSave(slot) : () => doLoad(slot, save);
      const b = btn([h("span.slotname.mono", SLOT_NAME[slot] || `Slot ${slot}`), summary(save)], go, { cls: "slot", disabled: mode === "load" && (!save || !!save.error) });
      return b;
    }));
    const first = list.querySelector(".f:not([aria-disabled])"); if (first) first.dataset.first = "";
  }
  function doSave(slot) {
    const why = S.save(slot, ctx.G.world.area() ? ctx.G.world.area().name : "");
    note.textContent = why || `Saved to ${SLOT_NAME[slot] || `slot ${slot}`}.`;
    fill(); ctx.F.focus(list.querySelector(".f"), { scroll: false });
  }
  async function doLoad(slot) {
    const why = await ctx.loadSlot(slot);
    if (why) note.textContent = why;
  }
  fill();
  return p;
}

// Esc in play: resume, save, load, settings, back to the title.
export function openPause(ctx) {
  const p = panel(ctx, "Paused", h("div",
    btn("Resume", () => p.close(), { key: "Esc" }),
    btn("Save", () => { p.close(); openSaves(ctx, "save"); }),
    btn("Load", () => { p.close(); openSaves(ctx, "load"); }),
    btn("Daybook", () => { p.close(); ctx.daybook(); }, { key: "Tab" }),
    btn("Settings", () => { p.close(); ctx.settings(); }),
    btn("Back to the title", () => ctx.title())));
  return p;
}
