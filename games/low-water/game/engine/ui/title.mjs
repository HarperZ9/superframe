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

// No mature-themes line on the title (author, 2026-10-22): the rating comes from the platform's process
// (design/RATING.md) and the opening film says what kind of game this is (design/CINEMATICS.md).

export function titleScreen(ctx) {
  watchDevice();
  const hint = h("div.hint.prompts"), drawHint = () => hint.replaceChildren(glyph("confirm"), " choose   ", glyph("back"), " back");
  drawHint(); const offDev = onDevice(drawHint);
  const last = latestSave(ctx);
  const art = h("div.title-art"), meta = (ctx.content && ctx.content.book && ctx.content.book.meta) || {};
  if (meta["title-screen"] && typeof document !== "undefined") document.title = meta["title-screen"];
  const firstArea = ctx.content.map.areas[meta["title-area"] || ctx.content.rs.rules["start-area"]];   // @meta title-area: the story's own picture behind its title
  // the start area's plate; while the ferry deck has none, the arrival's wide plate (UX walk, 2026-10-21: the
  // title sat on black)
  const artArea = firstArea && firstArea.plate ? firstArea : { plate: "wide_arrival", variant: "night" };
  if (artArea && artArea.plate) {
    const url = plateUrl(artArea), img = new Image();
    img.onload = () => { art.style.backgroundImage = `url("${url}")`; };
    img.src = url;
  }
  const cont = last
    ? btn(h("span", "Continue", h("span.small.quiet.mono", `  ${last.save.summary.time || clockText(last.save.summary.clock || 0)}  ${last.save.summary.area || ""}`)), () => ctx.loadSlot(last.slot), { key: "C" })
    : btn(h("span", "Continue", h("span.small.quiet", "  no saved game yet")), () => {}, { key: "C", disabled: true, title: "No saved game yet" }); // ux: the reason is visible to a pad player
  if (last) cont.dataset.first = "";
  const neu = btn("New game", () => ctx.create(), { key: "N" });
  if (!last) neu.dataset.first = "";
  const root = h("div.screen.title", art,
    h("div.menu.sheet.fade-in",
      // a story may name its own title screen (@meta title-screen, title-sub; The Quota: the working title of
      // design/spine-plan/DECISIONS-2026-10-22.md), else Low Water's
      h("h1", meta["title-screen"] || "Low Water"),
      h("p.sub", meta["title-sub"] || "", ctx.q && ctx.q.has("dev") ? [h("br"), h("span.small", `Content: ${ctx.content.book.meta.title || "untitled"}`)] : null), // ux: the content line is for developers (?dev)
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
