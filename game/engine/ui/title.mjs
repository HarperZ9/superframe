// The title screen: new game, continue (the most recent save), load, settings.
import { h, btn, clockText } from "./dom.mjs";
import { plateUrl } from "./scene.mjs";
import { glyph, onDevice, watchDevice } from "./bindings.mjs";

// The most recent save in any slot, or null.
export function latestSave(ctx) {
  const saves = ctx.saves || ctx.newGame() && ctx.saves;
  let best = null;
  for (const { slot, save } of saves.list()) if (save && !save.error && (!best || String(save.savedAt) > String(best.save.savedAt))) best = { slot, save };
  return best;
}

export function titleScreen(ctx) {
  watchDevice();
  const hint = h("div.hint.prompts"), drawHint = () => hint.replaceChildren(glyph("confirm"), " choose   ", glyph("back"), " back");
  drawHint(); const offDev = onDevice(drawHint);
  const last = latestSave(ctx);
  const art = h("div.title-art");
  const firstArea = ctx.content.map.areas[ctx.content.rs.rules["start-area"]];
  if (firstArea && firstArea.plate) {
    const url = plateUrl(firstArea), img = new Image();
    img.onload = () => { art.style.backgroundImage = `url("${url}")`; };
    img.src = url;
  }
  const cont = last
    ? btn(h("span", "Continue", h("span.small.quiet.mono", `  ${last.save.summary.time || clockText(last.save.summary.clock || 0)}  ${last.save.summary.area || ""}`)), () => ctx.loadSlot(last.slot), { key: "C" })
    : btn(h("span", "Continue", h("span.small.quiet", "  no saved night yet")), () => {}, { key: "C", disabled: true, title: "No saved night yet" }); // ux: the reason is visible to a pad player
  if (last) cont.dataset.first = "";
  const neu = btn("New game", () => ctx.create(), { key: "N" });
  if (!last) neu.dataset.first = "";
  const root = h("div.screen.title", art,
    h("div.menu.sheet.fade-in",
      h("h1", "Low Water"),
      h("p.sub", "A night on the tide, kept in a Daybook.", ctx.q && ctx.q.has("dev") ? [h("br"), h("span.small", `Content: ${ctx.content.book.meta.title || "untitled"}`)] : null), // ux: the content line is for developers (?dev)
      cont, neu,
      btn("Load", () => ctx.savesPanel("load"), { key: "L" }),
      btn("Settings", () => ctx.settings(), { key: "O" })),
    hint);
  ctx.stage.append(root);
  const keys = { C: () => last && ctx.loadSlot(last.slot), N: () => ctx.create(), L: () => ctx.savesPanel("load"), O: () => ctx.settings() };
  const onKey = (e) => { if (ctx.F.top() && ctx.F.top().root === root && keys[e.key.toUpperCase()] && !e.repeat) keys[e.key.toUpperCase()](); };
  window.addEventListener("keydown", onKey);
  return ctx.F.push({ name: "title", root, onBack: () => {}, onClose: () => { window.removeEventListener("keydown", onKey); offDev(); } });
}
