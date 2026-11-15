// The Daybook overlay: tabs along the top (Q and E, or the bumpers, turn them), the meters as
// marks down the right edge, and the open tab's page. Tab, Esc, B or View close it.
// A story with @meta menu gets a plain pause menu in its place (DECISIONS-2026-10-22, "Retire the tide and the
// Daybook"; the author, 2026-10-23): only the pages it names, plainly named, no Daybook title and no diary line.
// The full menu is rebuilt natively in the C++ port; this is the browser build's stand-in.
import { h, btn } from "./dom.mjs";
import { meterMarks } from "./scene.mjs";
import { hudConfig, dayWords, clockWords, heldHud } from "./hudtab.mjs";
import { notesTab, claimsTab, marginTab, sheetTab } from "./tabs-a.mjs";
import { packTab, lampsTab, townTab, historyTab } from "./tabs-b.mjs";
import { buildTab } from "./build.mjs"; // ux: the Build page replaces the Sheet tab (UI-SYSTEM 7.2)
import { mapTab } from "./map.mjs"; // ux: the Map page

export const TABS = [
  ["notes", "Notes", notesTab], ["claims", "Claims", claimsTab], ["margin", "Margin", marginTab], ["build", "Build", buildTab],
  ["pack", "Pack", packTab], ["map", "Map", mapTab], ["lamps", "Lamps", lampsTab], ["town", "Town", townTab], ["history", "History", historyTab],
];

// The plain names a pause menu gives the pages (@meta menu), and the pages it shows.
const PLAIN = { build: "Character", pack: "Inventory", map: "Map", notes: "Journal" };
export function menuOf(meta = {}) {
  const ids = String(meta.menu || "").split(/[\s,]+/).filter(Boolean);
  if (!ids.length) return { plain: false, tabs: TABS };
  const tabs = ids.map((id) => { const t = TABS.find((x) => x[0] === id); if (!t) console.warn(`daybook: @meta menu names no page ${id}`); return t ? [t[0], PLAIN[id] || t[1], t[2]] : null; }).filter(Boolean);
  return { plain: true, tabs: tabs.length ? tabs : TABS };
}
// What a button that opens it says: "Daybook", or the plain menu's pages.
export const menuLabel = (meta = {}) => { const m = menuOf(meta); return m.plain ? m.tabs.map((t) => t[1]).join(", ") : "Daybook"; };

export function openDaybook(ctx, tab = ctx.lastTab || "notes") {
  const G = ctx.G, M = menuOf(G.book.meta), T = M.tabs;
  const find = (id) => Math.max(0, T.findIndex((t) => t[0] === (id === "sheet" ? "build" : id)));
  let cur = find(tab);
  const tabs = h("nav.tabs"), page = h("div.page"), edge = h("div.dedge"), head = h("div.dhead");
  const root = h(`div.screen.daybook${M.plain ? ".plainmenu" : ""}`, h("div.dbook.sheet.fade-in", head, tabs, h("div.dbody", page, edge),
    h("div.dfoot.small.quiet", h("span", "Q and E, or LB and RB: turn the page."), h("span", "Tab, Esc, View or B: close."))));
  ctx.stage.append(root);

  function header() {
    if (M.plain) { // the place and the clock as the HUD shows them (a held clock in era 1), nothing else
      const a = G.world.area(), held = heldHud(G, a), where = held && held.place ? held.place : a ? a.name : (G.book.places[G.state.place] || {}).name || "", when = clockWords(G, held);
      head.replaceChildren(h("span.dplace", where), when ? h("span.mono.small.quiet", when) : null);
      return;
    }
    const s = G.state.sheet, tide = +G.env.term("tide") || 0, cfg = hudConfig(G);
    const when = cfg.fields.includes("tide") ? `tide ${tide >= 0 ? "+" : "−"}${Math.abs(tide).toFixed(2)} m` : dayWords(G, cfg);
    head.replaceChildren(h("span.dtitle", "Daybook"), h("span.mono.small.quiet", `${clockWords(G)}   ${when}   ${s.points} page${s.points === 1 ? "" : "s"} to spend`));
  }
  // Redraw the open tab; focus goes back to the control at the same place in the page.
  function show(keep = false) {
    const items = [...page.querySelectorAll(".f")], at = keep ? items.indexOf(document.activeElement) : -1;
    ctx.lastTab = T[cur][0];
    tabs.replaceChildren(...T.map(([id, name], i) => {
      const b = btn(name, () => { cur = i; show(); }, { cls: `tab${i === cur ? " on" : ""}` });
      b.setAttribute("aria-selected", String(i === cur));
      return b;
    }));
    header();
    page.replaceChildren(T[cur][2](ctx, () => show(true)));
    if (!keep) { page.classList.remove("turn"); void page.offsetWidth; page.classList.add("turn"); } // ux: the page turns (era.css; none without an era)
    { const mm = meterMarks(G, { all: true }); edge.replaceChildren(...(mm.length ? [h("div.caps.quiet", "Meters"), ...mm] : [])); } // none at all in a book that turns meters off
    if (!keep) page.scrollTop = page.querySelector("[data-end]") ? page.scrollHeight : 0;
    const now = [...page.querySelectorAll(".f")];
    ctx.F.focus(at >= 0 && now[Math.min(at, now.length - 1)] ? now[Math.min(at, now.length - 1)] : page.querySelector(".f[data-first]") || now[0] || tabs.children[cur], { scroll: keep }); // ux: a page may name its first control
  }
  const close = () => { ctx.F.pop(layer); root.remove(); if (ctx.play) ctx.play.render(); };
  const layer = ctx.F.push({
    name: "daybook", root,
    onAction(a) {
      if (a === "daybook") { close(); return true; }
      const pg = page.firstElementChild; // ux: a page can take left, right and the alt key (Build: plan ranks, density)
      if (pg && pg._onAction && pg._onAction(a === "alt" ? "density" : a)) return true;
      if (a === "tabPrev" || a === "tabNext") { cur = (cur + (a === "tabNext" ? 1 : T.length - 1)) % T.length; show(); return true; }
      // A page with nothing to press (History) scrolls with up and down.
      if ((a === "up" || a === "down") && !page.querySelector(".f")) { page.scrollBy({ top: (a === "down" ? 1 : -1) * page.clientHeight * 0.6 }); return true; }
      return a.startsWith("opt:") || a.startsWith("terms");
    },
    onBack: close,
  });
  show();
  return { root, show, close, select: (id) => { cur = find(id); show(); } };
}
