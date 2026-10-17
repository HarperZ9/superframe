// The UI and UX lead's lab (game/engine/uxlab.html): the shell's own screens on Act 1 content,
// with the shell's focus, input and styles, for stills and keyboard, mouse and pad tests.
//   uxlab.html?screen=build&archetype=p.ledger[&numbers=1][&plan=grip:1,nose:1][&tool=w.boathook][&compare=w.hammer][&bench=1]
// Not part of the game.
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { loadStyles } from "./styles.mjs";
import { createFocus } from "./focus.mjs";
import { createInput } from "./input.mjs";
import { loadPrefs, applyPrefs } from "./prefs.mjs";
import { openDaybook } from "./daybook.mjs";
import { openSettings } from "./settings.mjs";
import { createScreen } from "./create.mjs";
import { store } from "./dom.mjs";

export async function lab() {
  const q = new URLSearchParams(location.search);
  await loadStyles();
  const { sources, errors } = await loadAct("/content/act1/act1.lwd", async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.text(); });
  if (errors.length) console.error("act errors", errors);
  const content = loadContent(sources), G = createFullGame({ content, seed: 7 });
  const why = q.get("screen") === "create" ? [] : G.create({ archetype: q.get("archetype") || "p.ledger", enter: false });
  if (why && why.length) console.error("create:", why);
  const F = createFocus(), prefs = loadPrefs(); applyPrefs(prefs);
  if (q.get("calm") !== "0") document.documentElement.classList.add("calm");
  const ctx = { G, F, prefs, stage: document.getElementById("stage"), q, play: null };
  ctx.settings = () => openSettings(ctx); ctx.daybook = (t) => openDaybook(ctx, t); ctx.title = () => {};
  ctx.input = createInput((a, e) => {
    const L = F.top(); if (!L) return false;
    if (L.onAction && L.onAction(a, e)) return true;
    if (["up", "down", "left", "right"].includes(a)) return F.move(a);
    if (a === "confirm") return F.confirm();
    if (a === "back") { if (L.onBack) L.onBack(); return true; }
    return false;
  });
  // a Lamb with an evening behind them: pages to spend, salvage, tools and clothes
  G.state.sheet.points = +(q.get("pages") || 3);
  for (const [id, n] of [["w.boathook", 1], ["w.hammer", 1], ["w.knife", 1], ["c.oilskin", 1], ["s.tin", 2], ["s.cork", 1], ["s.brass", 1]]) { try { G.inv.give(id, n); } catch (e) { console.warn(`uxlab: ${e.message}`); } }
  if (q.get("tool")) G.inv.equip(q.get("tool"));
  if (q.get("bench")) G.body.bench = () => true;
  store.set("lowwater.build.density", q.get("numbers") ? "numbers" : "plain");
  const screen = q.get("screen") || "build";
  if (screen === "settings") ctx.settings();
  else if (screen === "create") { ctx.content = content; ctx.title = () => {}; ctx.play = () => {}; createScreen(ctx); }
  else {
    const D = ctx.daybook(screen === "build" ? "build" : screen);
    const build = await import("./build.mjs"); build.resetPlan();
    if (q.get("plan")) {
      for (const pair of q.get("plan").split(",")) { const [k, n] = pair.split(":"); for (let i = 0; i < Math.abs(+n); i++) { const row = ctx.stage.querySelector(`[data-plan="${k}"]`); if (row) { row.focus(); D.root.querySelector(".dbook"); F.top().onAction(+n > 0 ? "right" : "left"); } } }
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // after the Daybook's own first focus
    if (q.get("compare")) { const rows = [...ctx.stage.querySelectorAll(".gearrow")]; const r = rows.find((x) => x.textContent.toLowerCase().includes(q.get("compare").toLowerCase())); if (r) r.focus(); }
  }
  window.__lab = { G, ctx };
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  document.documentElement.dataset.ready = "1";
}
