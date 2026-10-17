// The game shell: loads content, makes the game, and moves between screens.
//   play.html?content=test        the placeholder content (the default until Act 1 is wired)
//   play.html?shot=<state>        jump to a state for screenshots (ui/shots.mjs)
// Screens are layers on one focus model (ui/focus.mjs); input (ui/input.mjs) goes to the top
// layer first, then to the shared defaults (move focus, press, back).
import { createFullGame as createGame, loadContent } from "../full.mjs";
import { createSaves, browserStorage } from "../save/save.mjs";
import { newSheet } from "../rules/sheet.mjs";
import { createFocus } from "./focus.mjs";
import { createInput } from "./input.mjs";
import { clear, toast } from "./dom.mjs";
import { loadPrefs, applyPrefs } from "./prefs.mjs";
import { titleScreen } from "./title.mjs";
import { createScreen } from "./create.mjs";
import { playScreen } from "./play.mjs";
import { openDaybook } from "./daybook.mjs";
import { openSaves, openPause } from "./saves.mjs";
import { openSettings } from "./settings.mjs";
import { runShot } from "./shots.mjs";
import { loadStyles } from "./styles.mjs";

const CONTENT = { test: ["rules.lwd", "demo.lwd", "systems.lwd", "yard.lwd"].map((f) => `test-content/${f}`) };

async function fetchSources(name) {
  const files = CONTENT[name]; if (!files) throw new Error(`no content set ${name}`);
  return Promise.all(files.map(async (f) => {
    const r = await fetch(new URL(`../${f}`, import.meta.url)); if (!r.ok) throw new Error(`could not load ${f}: ${r.status}`);
    return { file: f.split("/").pop(), text: await r.text() };
  }));
}

export async function boot() {
  const q = new URLSearchParams(location.search), stage = document.getElementById("stage");
  await loadStyles();
  const content = loadContent(await fetchSources(q.get("content") || "test"));
  if (!content.ok) console.error("content errors:", content.errors);
  const F = createFocus(), prefs = loadPrefs();
  applyPrefs(prefs);
  const ctx = { content, F, prefs, stage, G: null, saves: null, play: null, q };
  ctx.input = createInput((a, e) => dispatch(ctx, a, e));
  Object.assign(ctx, actions(ctx));
  tick(ctx);
  await document.fonts.ready;
  if (q.get("shot")) await runShot(ctx, q.get("shot"));
  else ctx.title();
  document.documentElement.dataset.ready = "1";
}

// Every frame: devices into G.input (one action state for keys, mouse and pad), then the
// engine's fixed-step loop (G.loop: hazards, animation, and a Tide Run while one is open).
function tick(ctx) {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    const G = ctx.G;
    if (G && G.loop) {
      G.input.set("move", ctx.input.vector()); G.input.set("run", ctx.input.run());
      try { G.loop.frame(dt); } catch (e) { console.error("loop: frame failed:", e); G.loop.paused = true; }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Input goes to the top layer; what it leaves goes to the shared defaults.
function dispatch(ctx, action, e = {}) {
  if (ctx.G && ctx.G.input && !action.startsWith("terms")) ctx.G.input.press(action);
  const L = ctx.F.top(); if (!L) return false;
  if (L.onAction && L.onAction(action, e)) return true;
  if (["up", "down", "left", "right"].includes(action)) return ctx.F.move(action);
  if (action === "confirm") return ctx.F.confirm();
  if (action === "back") { if (L.onBack) L.onBack(); else if (ctx.F.layers.length > 1) ctx.F.pop(); return true; }
  return false;
}

function actions(ctx) {
  const resetTo = (layerFn) => {
    while (ctx.F.layers.length) ctx.F.pop();
    clear(ctx.stage);
    return layerFn();
  };
  return {
    // A fresh game: new state, saves bound to it, autosave watching, events turned into notes.
    newGame(seed = ctx.q.has("shot") ? 7 : (Date.now() >>> 0) % 100000) {
      if (ctx.unwatch) ctx.unwatch();
      ctx.G = createGame({ content: ctx.content, seed });
      ctx.G.state.runMode = ctx.prefs.runMode; ctx.G.state.runsOff = !!ctx.prefs.runsOff;
      ctx.saves = createSaves(ctx.G, browserStorage(), { newSheet });
      ctx.unwatch = ctx.saves.watch();
      listen(ctx.G);
      return ctx.G;
    },
    title: () => resetTo(() => titleScreen(ctx)),
    create: () => resetTo(() => { ctx.newGame(); return createScreen(ctx); }),
    // Into the world; with a starting node, a conversation opens at once.
    play: (startNode = null) => resetTo(() => (ctx.play = playScreen(ctx, { startNode }))),
    daybook: (tab) => openDaybook(ctx, tab),
    savesPanel: (mode) => (mode === "menu" ? openPause(ctx) : openSaves(ctx, mode)),
    settings: () => openSettings(ctx),
    // Load a slot into a fresh game, then go to the world.
    async loadSlot(slot) {
      const keep = ctx.G && ctx.saves;
      if (!keep) ctx.newGame();
      const why = await ctx.saves.load(slot);
      if (why) { toast("Load", why); return why; }
      ctx.play();
      return null;
    },
  };
}

// The night's events as short notes; the words come from content.
function listen(G) {
  G.on("trait.found", (d) => toast("Margin", `Found: ${d.name}`));
  G.on("gate", (d) => toast("A page", `${d.name}: ${d.pages === 1 ? "a page" : `${d.pages} pages`} to spend`)); // SYSTEMS-FULL 19.4
  G.on("trait.done", (d) => { if (!d.granted) toast("Margin", `Inked: ${d.name}`); });
  G.on("item.gain", (d) => toast("Pack", `${d.name} ${d.n > 1 ? `x${d.n}` : ""}`));
  G.on("quest", (d) => toast("Claims", `${d.name}: ${d.text}`));
  G.on("level", (d) => toast("Sheet", `A new page to spend (${d.points})`));
  G.on("meter.warn", (d) => toast("Note", d.text));
  G.on("hazard.enter", (d) => toast("Warning", d.warn || d.name || ""));
  G.on("saved", (d) => { if (d.slot !== "auto") toast("Saved", `Slot ${d.slot}`); });
}
