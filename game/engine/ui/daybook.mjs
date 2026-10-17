// The Daybook overlay: tabs along the top (Q and E, or the bumpers, turn them), the meters as
// marks down the right edge, and the open tab's page. Tab, Esc, B or Y close it.
import { h, btn, clockText } from "./dom.mjs";
import { meterMarks } from "./scene.mjs";
import { notesTab, claimsTab, marginTab, sheetTab } from "./tabs-a.mjs";
import { packTab, lampsTab, townTab, historyTab } from "./tabs-b.mjs";
import { buildTab } from "./build.mjs"; // ux: the Build page replaces the Sheet tab (UI-SYSTEM 7.2)

export const TABS = [
  ["notes", "Notes", notesTab], ["claims", "Claims", claimsTab], ["margin", "Margin", marginTab], ["build", "Build", buildTab],
  ["pack", "Pack", packTab], ["lamps", "Lamps", lampsTab], ["town", "Town", townTab], ["history", "History", historyTab],
];

export function openDaybook(ctx, tab = ctx.lastTab || "notes") {
  const G = ctx.G;
  let cur = Math.max(0, TABS.findIndex((t) => t[0] === (tab === "sheet" ? "build" : tab)));
  const tabs = h("nav.tabs"), page = h("div.page"), edge = h("div.dedge"), head = h("div.dhead");
  const root = h("div.screen.daybook", h("div.dbook.sheet.fade-in", head, tabs, h("div.dbody", page, edge),
    h("div.dfoot.small.quiet", h("span", "Q and E, or LB and RB: turn the page."), h("span", "Tab, Esc, View or B: close."))));
  ctx.stage.append(root);

  function header() {
    const s = G.state.sheet, tide = +G.env.term("tide") || 0;
    head.replaceChildren(h("span.dtitle", "Daybook"), h("span.mono.small.quiet", `${clockText(G.clock())}   tide ${tide >= 0 ? "+" : "−"}${Math.abs(tide).toFixed(2)} m   ${s.points} page${s.points === 1 ? "" : "s"} to spend`));
  }
  // Redraw the open tab; focus goes back to the control at the same place in the page.
  function show(keep = false) {
    const items = [...page.querySelectorAll(".f")], at = keep ? items.indexOf(document.activeElement) : -1;
    ctx.lastTab = TABS[cur][0];
    tabs.replaceChildren(...TABS.map(([id, name], i) => {
      const b = btn(name, () => { cur = i; show(); }, { cls: `tab${i === cur ? " on" : ""}` });
      b.setAttribute("aria-selected", String(i === cur));
      return b;
    }));
    header();
    page.replaceChildren(TABS[cur][2](ctx, () => show(true)));
    edge.replaceChildren(h("div.caps.quiet", "Meters"), ...meterMarks(G, { all: true }));
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
      if (a === "tabPrev" || a === "tabNext") { cur = (cur + (a === "tabNext" ? 1 : TABS.length - 1)) % TABS.length; show(); return true; }
      // A page with nothing to press (History) scrolls with up and down.
      if ((a === "up" || a === "down") && !page.querySelector(".f")) { page.scrollBy({ top: (a === "down" ? 1 : -1) * page.clientHeight * 0.6 }); return true; }
      return a.startsWith("opt:") || a.startsWith("terms");
    },
    onBack: close,
  });
  show();
  return { root, show, close, select: (id) => { cur = Math.max(0, TABS.findIndex((t) => t[0] === (id === "sheet" ? "build" : id))); show(); } };
}
