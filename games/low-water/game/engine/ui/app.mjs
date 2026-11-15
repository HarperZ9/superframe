// The game shell: loads content, makes the game, and moves between screens.
//   play.html                     Act 1 (content/act1/act1.lwd and its includes) with the engineer's
//                                 area wiring (wiring/act1-areas.lwd); the one game (2026-10-17)
//   play.html?content=test        the placeholder content (the default for ?shot= states)
//   play.html?figures=plain       the plain ink figures instead of the character pipeline's
//   play.html?shot=<state>        jump to a state for screenshots (ui/shots.mjs)
// Screens are layers on one focus model (ui/focus.mjs); input (ui/input.mjs) goes to the top
// layer first, then to the shared defaults (move focus, press, back).
import { createFullGame as createGame, loadContent } from "../full.mjs";
import { carryState } from "../game.mjs";
import { createSaves, browserStorage } from "../save/save.mjs";
import { createWorldRecord, installWorldRecord } from "../save/worldrecord.mjs";
import { newSheet } from "../rules/sheet.mjs";
import { createFocus } from "./focus.mjs";
import { createInput } from "./input.mjs";
import { clear, toast } from "./dom.mjs";
import { installGearCards } from "./gearcard.mjs";
import { watchStack } from "./notify.mjs";
import { TOOLS21 } from "../combat/data/build.mjs";
const TOOL_IDS = new Set(Object.keys(TOOLS21));
import { loadPrefs, applyPrefs } from "./prefs.mjs";
import { titleScreen } from "./title.mjs";
import { createScreen } from "./create.mjs";
import { playScreen } from "./play.mjs";
import { openDaybook } from "./daybook.mjs";
import { openSaves, openPause } from "./saves.mjs";
import { openSettings } from "./settings.mjs";
import { runShot } from "./shots.mjs";
import { loadStyles } from "./styles.mjs";
import { loadAct } from "../dialogue/book.mjs";
import { installCharacterFigures } from "./figures.mjs";
import { installPainter } from "../paint/install.mjs";
import { installLetterer } from "./letterer.mjs";
import { installAged } from "./aged.mjs";
import { installRecordMarks } from "./recordmarks.mjs";
import { installTyped } from "./typed.mjs";
import { openCompare } from "./compare.mjs";
import { runBoot } from "./boot.mjs";

const CONTENT = { test: ["rules.lwd", "demo.lwd", "systems.lwd", "yard.lwd"].map((f) => `test-content/${f}`) };

const fetchText = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`could not load ${url}: ${r.status}`); return r.text(); };
// An act: its root and includes from /content/actN/, then the engineer's wiring for it.
// act2: play.html?content=act2 starts the daylight interlude fresh; with &carry=1 it takes the state Act 1
// ended with (the end screen's "On to the next night" writes it, game.mjs carryState).
const ACTS = { act1: { root: "/content/act1/act1.lwd", wiring: ["wiring/act1-areas.lwd"], next: "act2" }, act2: { root: "/content/act2/act2.lwd", wiring: ["wiring/act2-areas.lwd"], next: "act3" }, act3: { root: "/content/act3/act3.lwd", wiring: ["wiring/act3-areas.lwd"] }, quota: { root: "/content/quota/slice.lwd", wiring: ["wiring/quota-areas.lwd", "wiring/era1-areas.lwd", "wiring/era3-areas.lwd", "wiring/era4-areas.lwd", "wiring/era5-areas.lwd"] } };
const CARRY_KEY = "lowwater.carry.v1";
async function fetchSources(name) {
  if (ACTS[name]) {
    const A = ACTS[name], { sources, errors } = await loadAct(A.root, fetchText);
    for (const e of errors) console.error(`content ${name}: ${e.file}:${e.line} ${e.msg}`);
    for (const w of A.wiring) sources.push({ file: w.split("/").pop(), text: await fetchText(new URL(`../${w}`, import.meta.url)) });
    return sources;
  }
  const files = CONTENT[name]; if (!files) throw new Error(`no content set ${name}`);
  return Promise.all(files.map(async (f) => {
    const r = await fetch(new URL(`../${f}`, import.meta.url)); if (!r.ok) throw new Error(`could not load ${f}: ${r.status}`);
    return { file: f.split("/").pop(), text: await r.text() };
  }));
}

export async function boot() {
  const q = new URLSearchParams(location.search), stage = document.getElementById("stage");
  await loadStyles();
  const content = loadContent(await fetchSources(q.get("content") || (q.get("shot") ? "test" : "act1")));
  if (q.get("figures") !== "plain") installCharacterFigures({ hourOf: () => (ctx.G && ctx.G.clock ? (ctx.G.clock() / 60) % 24 : 23), playerOf: () => (ctx.G && ctx.G.playerFigure ? ctx.G.playerFigure() : "lamb") }).catch((e) => console.warn(`figures: ${e.message}`));
  // the brush painter on every figure (?paint=0 off, ?paint=screen the screen-anchored control)
  if (q.get("paint") !== "0") installPainter({ gpu: q.get("paintgpu") === "1", hourOf: () => (ctx.G && ctx.G.clock ? (ctx.G.clock() / 60) % 24 : 23), anchor: ["screen", "trace"].includes(q.get("paint")) ? q.get("paint") : "bind" }).catch((e) => console.warn(`paint: ${e.message}`));
  if (!content.ok) console.error("content errors:", content.errors);
  const F = createFocus(), prefs = loadPrefs();
  applyPrefs(prefs);
  // the face for names and headers, from the story (@meta name-face: grotesk, the Quota): Hanken in capitals
  // in place of the display face, so the story's surfaces keep to the two house faces (ux.css)
  if (content.book.meta["name-face"]) document.body.dataset.nameFace = content.book.meta["name-face"];
  // a plain pause menu in place of the Daybook (@meta menu, ui/daybook.mjs): daybook.css hides the Daybook chip
  if (content.book.meta.menu) document.body.dataset.menu = "plain";
  // the interface as part of the art (@meta ui-era or era, 1 to 5, or ?era=): the era's paper, ink and lettering
  // (ui/era.css, ui/letterer.mjs, ui/aged.mjs); a story without it keeps the plain house look
  const era = q.get("era") || content.book.meta["ui-era"] || content.book.meta.era; // a story's own @meta era serves too
  if (era && /^[1-5]$/.test(era)) document.body.dataset.uiEra = era;
  const ctx = { content, F, prefs, stage, G: null, saves: null, play: null, q };
  globalThis.__lwWriter = () => (ctx.G && ctx.G.playerFigure ? ctx.G.playerFigure() : null);   // whose hand the daybook's notes are in
  ctx.letterer = installLetterer(document.body); ctx.aged = installAged({ root: document.body }); ctx.marks = installRecordMarks(ctx); installTyped();
  ctx.input = createInput((a, e) => dispatch(ctx, a, e));
  Object.assign(ctx, actions(ctx));
  ctx.enterPlay = ctx.play; // the action itself, kept when ctx.play becomes the screen proxy
  if (q.has("capture")) window.__lw = ctx; // tools/scene_capture.py drives the shell headless
  tick(ctx);
  await document.fonts.ready;
  if (q.get("shot")) await runShot(ctx, q.get("shot"));
  else if (q.has("carry") && ctx.carryIn()) { /* the next night, straight in */ }
  else {
    // the boot (design/CINEMATICS.md section 2): the cards, the photosensitivity notice and the opening film
    try { await runBoot(ctx); } catch (e) { console.error(`boot: ${e.message}; straight to the title`); }
    ctx.title();
  }
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

// the play action, with the open play screen's fields read through it
function playProxy(fn, screen) {
  return new Proxy(fn, { get: (t, k) => (k in screen ? screen[k] : t[k]), set: (t, k, v) => { screen[k] = v; return true; }, has: (t, k) => k in screen || k in t });
}

function actions(ctx) {
  const resetTo = (layerFn) => {
    while (ctx.F.layers.length) ctx.F.pop();
    clear(ctx.stage);
    return layerFn();
  };
  return {
    // A fresh game: new state, saves bound to it, autosave watching, events turned into notes.
    newGame(seed = ctx.q.has("shot") ? 7 : (Date.now() >>> 0) % 100000, state = null) {
      if (ctx.unwatch) ctx.unwatch();
      ctx.G = createGame({ content: ctx.content, seed, state });
      // the world record (save/worldrecord.mjs): what earlier runs left, for a story that keeps one; local only
      if (ctx.content.book.meta["world-keep"] || Object.keys((ctx.content.story || {}).worldfacts || {}).length) {
        const story = ctx.q.get("content") || "act1";
        installWorldRecord(ctx.G, createWorldRecord(browserStorage(), story), { story, worldfacts: ctx.content.story.worldfacts });
      }
      ctx.G.state.runMode = ctx.prefs.runMode; ctx.G.state.runsOff = !!ctx.prefs.runsOff;
      ctx.saves = createSaves(ctx.G, browserStorage(), { newSheet });
      ctx.aged.bind(ctx.G); ctx.marks.bind(ctx.G); // ux: the record's burn and stamps follow this game
      ctx.unwatch = ctx.saves.watch();
      listen(ctx.G);
      return ctx.G;
    },
    title: () => resetTo(() => titleScreen(ctx)),
    // The act after this one, if there is one: "On to the next night" at the end of an act.
    nextAct: () => { const A = ACTS[ctx.q.get("content") || "act1"]; return A && A.next ? A.next : null; },
    // Hand the state this act ended with to the next act's page.
    goNextAct() {
      const next = ctx.nextAct(); if (!next || !ctx.G) return false;
      try { localStorage.setItem(CARRY_KEY, JSON.stringify({ from: ctx.q.get("content") || "act1", to: next, state: carryState(ctx.G.state) })); }
      catch (e) { console.error(`carry: could not keep the night's state: ${e.message}`); toast("The next night", "Could not carry this night over (storage refused)."); return false; }
      const q = new URLSearchParams(ctx.q); q.set("content", next); q.set("carry", "1"); location.href = `play.html?${q}`; // keeps the page's other settings (look, figures)
      return true;
    },
    // Start this act from the carried state, at the act's own start.
    carryIn() {
      let c = null; try { c = JSON.parse(localStorage.getItem(CARRY_KEY) || "null"); } catch (e) { console.error(`carry: unreadable: ${e.message}`); }
      if (!c || c.to !== (ctx.q.get("content") || "act1")) { console.warn("carry: nothing carried for this act; to the title"); return false; }
      ctx.newGame(undefined, c.state);
      ctx.play(ctx.content.book.meta.start || null);
      return true;
    },
    // A story with no creation screen (@rules creation: none, the Quota) starts at its own first node,
    // on its plain sheet; the class choice there gives the chosen man's sheet (rules/creation.mjs become).
    create: () => (ctx.content.rs.rules.creation === "none" ? ctx.startPlain() : resetTo(() => { ctx.newGame(); return createScreen(ctx); })),
    startPlain() {
      ctx.newGame();
      const errs = ctx.G.create({ archetype: ctx.content.rs.rules["start-archetype"] || Object.keys(ctx.content.rs.archetypes)[0] });
      if (errs.length) { console.error(`start: ${errs.join("; ")}`); toast("New game", errs.join("; ")); return null; }
      return ctx.play(ctx.content.book.meta.start || null);
    },
    // Into the world; with a starting node, a conversation opens at once.
    // Into the world. ctx.play is both this action and the play screen it opens (callers use ctx.play.P,
    // ctx.play.render): the screen is reached through a proxy on the action, so ctx.play() still works
    // once a screen is open (2026-10-21: loading a save from the pause page called the screen and threw).
    play: (startNode = null) => resetTo(() => { const screen = playScreen(ctx, { startNode }); ctx.play = playProxy(ctx.enterPlay, screen); return screen; }),
    daybook: (tab) => openDaybook(ctx, tab),
    compare: (o) => openCompare(ctx, o), // the notice beside the person (ui/compare.mjs; the art lead's)
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
  // a story with @meta numbers: off shows no counts (the device rule, 2026-10-23, design/DEVICE-AUDIT.md): growth is
  // felt (the story's @sense growth, when it has one) and named once, with no tally of pages to spend
  const counts = String((G.book.meta || {}).numbers || "on") !== "off", felt = (id) => { if (G.senses && G.senses.has(id)) G.senses.fire(id, { via: "growth" }); };
  G.on("trait.found", (d) => toast("Margin", `Found: ${d.name}`));
  G.on("gate", (d) => { if (counts) toast("A page", `${d.name}: ${d.pages === 1 ? "a page" : `${d.pages} pages`} to spend`); else felt("growth"); }); // SYSTEMS-FULL 19.4
  // trait.done shows as the inked leaf (ui/inked.mjs), not a toast
  G.on("chapter", (d) => { if (counts) toast("A chapter", `A compartment can rise (${d.owed} to place on the Build page)`); else felt("growth"); }); // SYSTEMS-FULL 19.4
  G.on("item.gain", (d) => { if (!TOOL_IDS.has(d.id)) toast("Pack", `${d.name} ${d.n > 1 ? `x${d.n}` : ""}`); }); // tools get the gear card (ui/gearcard.mjs)
  installGearCards(G); watchStack();
  G.on("quest", (d) => toast("Claims", `${d.name}: ${d.text}`));
  G.on("level", (d) => { if (counts) toast("Sheet", `A new page to spend (${d.points})`); });
  G.on("meter.warn", (d) => toast("Note", d.text));
  G.on("hazard.enter", (d) => toast("Warning", d.warn || d.name || ""));
  G.on("saved", (d) => { if (d.slot !== "auto") toast("Saved", `Slot ${d.slot}`); });
}
