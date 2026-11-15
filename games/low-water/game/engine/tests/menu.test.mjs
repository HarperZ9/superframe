// The pause menu in place of the Daybook, and the HUD clock (UI and UX lead, 2026-10-23; DECISIONS-2026-10-22,
// "Retire the tide and the Daybook"). A story with @meta menu gets only the pages it names, plainly named; a story
// without it keeps the Daybook. A scene's own hour (node hud-clock) beats its area's while the clock is held, and
// a later day's clock carries its weekday, so the HUD never reads as running back (ledger U7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { menuOf, menuLabel, TABS } from "../ui/daybook.mjs";
import { heldHud, clockWords } from "../ui/hudtab.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const sources = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources;
for (const w of ["quota-areas.lwd", "era1-areas.lwd"]) sources.push({ file: w, text: await readFile(join(ROOT, "wiring", w), "utf8") });
const content = loadContent(sources);
const game = () => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: "q.ned", enter: false }); G.state.vars.q_class = "inspector"; return G; };
const names = (m) => m.tabs.map((t) => t[1]);

test("the Quota's menu: Character, Inventory and Map, and no Daybook, tide, diary or journal page (the device rule)", () => {
  const m = menuOf(content.book.meta);
  assert.equal(m.plain, true);
  assert.deepEqual(names(m), ["Character", "Inventory", "Map"]);
  for (const gone of ["Daybook", "Notes", "Journal", "Build", "Pack", "Lamps", "Claims", "Margin", "Town", "History"]) assert.ok(!names(m).includes(gone), gone);
  assert.equal(menuLabel(content.book.meta), "Character, Inventory, Map", "the Pause page names the pages, not the Daybook");
  assert.equal(m.tabs[0][2], TABS.find((t) => t[0] === "build")[2], "Character is the Build page under its plain name");
});

test("control: a story without @meta menu keeps the Daybook's nine tabs; a page the menu names that does not exist is dropped", () => {
  const d = menuOf({});
  assert.equal(d.plain, false); assert.equal(d.tabs.length, 9); assert.equal(menuLabel({}), "Daybook");
  const warn = console.warn; let said = ""; console.warn = (s) => { said = s; };
  try { assert.deepEqual(names(menuOf({ menu: "notes nowhere map" })), ["Journal", "Map"]); } finally { console.warn = warn; }
  assert.match(said, /nowhere/);
});

test("era 1: a night scene's own hour and weather beat its area's, and a move clears them", () => {
  const G = game(); G.state.vars.era = 1;
  const barns = content.map.areas["q1.barns"];
  assert.ok(barns && barns.hudClock === "17:35", "the barns' area hour is the afternoon");
  // the talk runs on through the loft and beyond to its first choice, so read the HUD as the scene leaves the barns
  let h = null; const move = G.setPlace; G.setPlace = (p) => { if (G.state.place === "q1_barns" && p !== "q1_barns" && !h) h = heldHud(G, barns); move(p); };
  G.talk("e1.count"); G.setPlace = move;
  assert.ok(h, "the count played in the barns");
  assert.equal(h.clock, 22 * 60, "the count at ten reads 22:00, not the barns' 17:35");
  assert.equal(h.weather, "a cold night");
  assert.equal(clockWords(G, h), "22:00");
  G.setPlace("q1_exchange");
  assert.equal(G.state.sceneHud, undefined, "a move clears the scene's hour");
  assert.equal(heldHud(G, barns).clock, null, "the barns' hour is not the exchange's: no clock rather than another scene's");
  assert.equal(heldHud(G, barns).place, "The exchange hall, Exchange Street", "and the place line names the scene's place");
  G.setPlace("q1_barns");
  assert.equal(heldHud(G, barns).clock, 17 * 60 + 35, "control: with no scene hour, in the area's own place, the area's hour shows");
  G.state.vars.era = 2;
  assert.equal(heldHud(G, barns), null, "era 2 runs on the day's clock");
});

test("the day's clock carries its weekday, so a later day's earlier hour never reads as the clock running back", () => {
  const G = game(); G.state.vars.era = 2;
  assert.equal(clockWords(G), "Wednesday 05:50");
  G.env.advance(5 * 60 + 10); assert.equal(clockWords(G), "Wednesday 11:00");
  G.env.advance(20 * 60 + 6); assert.equal(clockWords(G), "Thursday 07:06", "11:00 then 07:06 is the next morning, and says so");
  const plain = { clock: () => 31 * 60, book: { meta: {} }, state: {} }; // 07:00 past midnight
  assert.equal(clockWords(plain, null), "07:00", "control: a story without hud-week keeps the bare clock");
});
