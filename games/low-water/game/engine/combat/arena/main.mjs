// The combat test arena: placeholder figures on the engine's own night and environment hub.
// Served by game/serve.mjs at /engine/combat/arena/. Query: scenario (pair, holder, skirmisher,
// fog, frost, blackout), seed, pilot=1 (the scripted player drives Lamb), capture=1 (no real-time
// loop: a driver calls window.__arena.tick).
// Keys: WASD move, J light, K heavy (hold to charge), L catch, Space roll, Shift sidestep,
// I block (hold), E shove, G grapple, Q use, Tab lock, [ ] switch lock, 1-6 tool, R restart.
import { createGame } from "../../game.mjs";
import { createWorld } from "../sim/world.mjs";
import { lambDef, foeDef, fighterSpec } from "../roster.mjs";
import { ARENAS } from "../data/arenas.mjs";
import { createPilot } from "../tools/pilot.mjs";
import { createView } from "./draw.mjs";
import { parseProp } from "../sim/props.mjs";
import { ARENA_ARCHETYPES, elite } from "../data/archetypes.mjs";
import { createRun } from "./run.mjs";
import { bossSpec, summoner } from "./spawn.mjs";
import { createRunUI } from "./runui.mjs";

const Q = new URLSearchParams(location.search);
const CAPTURE = Q.get("capture") === "1", PILOT = Q.get("pilot") === "1", SEED = +(Q.get("seed") || 3), RUN = Q.get("mode") === "run", INNER = Q.get("mode") === "inner";
const LINEUP = ["holder", "skirmisher", ...Object.keys(ARENA_ARCHETYPES)];
export const SCENARIOS = {
  pair: { arena: "floor", clock: "23:40", rate: 1 / 60, foes: [["holder", [8.5, 7.5]], ["skirmisher", [3, 8]]] },
  holder: { arena: "floor", clock: "23:20", rate: 1 / 120, foes: [["holder", [8.5, 7.5]]] },
  skirmisher: { arena: "floor", clock: "23:20", rate: 1 / 120, foes: [["skirmisher", [3, 8]]] },
  fog: { arena: "quay", clock: "03:00", rate: 0, foes: [["holder", [10, 7]], ["skirmisher", [4, 6]]] },
  frost: { arena: "quay", clock: "04:40", rate: 0, foes: [["holder", [10, 6.5]]] },
  blackout: { arena: "weigh", clock: "00:30", rate: 0, blackout: true, foes: [["skirmisher", [7, 2], { sight: "smell" }], ["skirmisher", [3, 3], { sight: "smell" }]] },
  // the four ways in (2026-10-17): a sneak, a tools setup, a fighting build
  sneak: { arena: "floor", clock: "23:20", rate: 1 / 120, opening: "sneak", terms: { light: 0.03 }, lamb: [3, 4.5], foes: [["skirmisher", [6, 8]], ["holder", [14, 9]]] },
  tools: { arena: "floor", clock: "23:20", rate: 1 / 120, props: [["sluice", 5.5, 3.5, 7, 6, 15, 12, 1.3], ["snare", 9, 6]], foes: [["holder", [13, 10]], ["skirmisher", [11, 11]]] },
  build: { arena: "floor", clock: "23:30", rate: 1 / 120, levels: { coat: 4, knees: 6, ballast: 6, grip: 6 }, foes: [["holder", [8.5, 7.5]], ["skirmisher", [3, 8]]] },
  // the arena mode's ten archetypes in a row, and their elites behind (brains off: a still to read them apart)
  lineup: { arena: "floor", clock: "23:30", rate: 0, still: true, terms: { light: 0.9 }, lamb: [11, 3.2], foes: LINEUP.flatMap((k, i) => [[k, [2.5 + i * 2, 6.2]], [k, [2.5 + i * 2, 9.4], { elite: true }]]) },
  "boss-foreman": { arena: "floor", clock: "23:30", rate: 0, terms: { light: 0.6 }, lamb: [11, 4], levels: { grip: 5, ballast: 5, coat: 6, knees: 5 }, foes: [["boss:foreman", [12, 9]]] },
  "boss-warden": { arena: "floor", clock: "23:30", rate: 0, terms: { light: 0.6 }, lamb: [11, 4], levels: { grip: 5, ballast: 5, coat: 6, knees: 5 }, foes: [["boss:warden", [12, 9]]] },
  ...Object.fromEntries(LINEUP.map((k) => [`vs-${k}`, { arena: "floor", clock: "23:30", rate: 0, foes: [[k, [9, 8]]] }])),
  ...Object.fromEntries(LINEUP.map((k) => [`vs-${k}-elite`, { arena: "floor", clock: "23:30", rate: 0, foes: [[k, [9, 8], { elite: true }]] }])),
};
const TOOLS = ["w.case", "w.stick", "w.boathook", "w.pole", "w.knife", "w.hammer"];
const KEYS = { KeyN: "name", KeyJ: "light", KeyK: "heavy", KeyL: "catch", Space: "roll", ShiftLeft: "step", ShiftRight: "step", KeyE: "shove", KeyG: "grapple", KeyQ: "use", Tab: "lock", BracketRight: "next", BracketLeft: "prev", KeyF: "interact", KeyH: "lantern", KeyT: "talk" };

const lwd = await (await fetch("../test-content/arena.lwd")).text();
const canvas = document.getElementById("c");
const state = { scenario: Q.get("scenario") || "pair", tool: TOOLS[0], held: new Set(), presses: [], W: null, G: null, view: null, pilot: null };

function setClock(G, hhmm) {
  const [h, m] = hhmm.split(":").map(Number); let t = h * 60 + m; if (t < 12 * 60) t += 1440;
  G.env.advance(t - G.env.clock());
}

// the arena mode (?mode=run&seed=n&mods=frost,fog): a ladder of rounds (combat/arena/run.mjs), its offers
// and records in the page (combat/arena/runui.mjs). Records stay in this browser's storage.
function startRun() {
  let store = null; try { store = window.localStorage; } catch (e) { console.warn(`arena: no local storage, records off: ${e.message}`); }
  state.run = createRun({ seed: SEED, skin: Q.get("skin") || null, mods: (Q.get("mods") || "").split(",").filter(Boolean), storage: store, onRecord: (ev) => { if (state.G && state.G.community) state.G.community.record(ev.type, "", "", { boon: ev.boon, round: ev.round, venue: ev.venue }); else console.info(`arena record: ${ev.name} after round ${ev.round}`); }, start: { tool: "w.stick", levels: { grip: 4, ballast: 4, coat: 4, knees: 4, pen: 4, nose: 3 } } }); // ?skin=bread or club: The Quota's venues
  state.ui = createRunUI(document.body, state.run, { onNext: nextStage });
  nextStage();
}
function nextStage() {
  const st = state.run.stage();
  if (st.kind !== "fight") { state.ui.show(st); return; }
  state.ui.hide();
  const G = createGame({ sources: [{ file: "arena.lwd", text: lwd }], seed: SEED });
  setClock(G, "23:30");
  state.G = G; state.W = state.run.world(G, ARENAS[state.run.arena || "floor"]);
  state.view = createView(canvas, state.W); state.pilot = PILOT ? createPilot() : null; state.log = []; state.endAt = 0;
  state.view.runLine = st.boss ? `ROUND ${st.round}  BOSS` : `ROUND ${st.round}  WAVE ${st.wave} OF ${st.waves}`;
}

// the inner arena (?mode=inner&flaw=...): combat/arena/innerpage.mjs
async function startInner() {
  const { createInnerPage } = await import("./innerpage.mjs");
  state.inner = await createInnerPage({ canvas, lwd, Q, createGame, setClock, seed: SEED });
  Object.defineProperty(state, "W", { get: () => state.inner.W, configurable: true });
  Object.defineProperty(state, "view", { get: () => state.inner.view, configurable: true });
}

export function start(name = state.scenario) {
  if (RUN) return nextStage();
  if (INNER) return location.reload();
  const S = SCENARIOS[name]; state.scenario = name;
  const G = createGame({ sources: [{ file: "arena.lwd", text: lwd }], seed: SEED });
  setClock(G, S.clock);
  for (const [k, v] of Object.entries(S.terms || {})) G.env.command(["setTerm", k, String(v)]);
  const arena = { ...ARENAS[S.arena], blackout: !!S.blackout };
  const fighters = [fighterSpec("lamb", "lamb", lambDef(S.levels || {}, state.tool), S.lamb || arena.spawns.lamb, { face: Math.PI / 2 })];
  S.foes.forEach(([style, at, over = {}], i) => {
    if (style.startsWith("boss:")) { fighters.push(bossSpec("boss", style.slice(5), at)); return; }
    const { elite: el, ...rest } = over, d = foeDef(null, style, rest); fighters.push(fighterSpec(`foe${i}`, "foe", el ? elite(d) : d, at, { face: -Math.PI / 2, brain: !S.still }));
  });
  state.G = G; state.W = createWorld({ G, arena, fighters, seed: SEED, minutesPerFrame: S.rate, opening: S.opening || "open", props: (S.props || []).map(parseProp) });
  state.W.summon = summoner(state.W);
  state.view = createView(canvas, state.W); state.pilot = PILOT ? createPilot() : null; state.log = []; state.endAt = 0;
}

function input() {
  if (state.pilot) return state.pilot(state.W);
  const h = state.held, mx = (h.has("KeyD") ? 1 : 0) - (h.has("KeyA") ? 1 : 0), mz = (h.has("KeyS") ? 1 : 0) - (h.has("KeyW") ? 1 : 0);
  const out = { mx, mz, press: state.presses.splice(0), hold: { heavy: h.has("KeyK"), block: h.has("KeyI"), interact: h.has("KeyF") } };
  return out;
}

// One fixed step and its events into the view (shake, flashes, barks).
function step() {
  if (INNER) { if (state.inner) { const ev = state.inner.step(input()); for (const e of ev) state.log.push(e); } return; }
  const W = state.W;
  if (RUN && state.ui && state.ui.open) return; // an offer or the run's end on screen: the fight waits
  const ev = W.step({ lamb: input() });
  state.view.events(ev);
  for (const e of ev) if (e.type !== "lock") state.log.push(e);
  if (W.result && !state.endAt) state.endAt = W.tick;
  if (RUN && W.result && W.tick - state.endAt > 120 && !state.finished) { state.finished = true; state.run.finish(W); state.finished = false; state.endAt = 0; nextStage(); return; }
  if (!RUN && !CAPTURE && W.result && W.tick - state.endAt > 240) { state.endAt = 0; start(); }
}

let acc = 0;
const api = {
  start, step,
  // capture: advance dt seconds of fixed steps, then draw one frame
  tick(dt = 1 / 30) { acc += dt; while (acc >= 1 / 60 - 1e-9) { acc -= 1 / 60; step(); } if (state.view) state.view.draw(); return state.W ? state.W.tick : 0; },
  press: (a) => state.presses.push(a), hold: (code, on) => (on ? state.held.add(code) : state.held.delete(code)),
  get W() { return state.W; }, get log() { return state.log; }, scenarios: Object.keys(SCENARIOS), get run() { return state.run; }, choose: (i) => (INNER ? state.inner && state.inner.choose(i) : state.ui && state.ui.choose(i)),
  get inner() { return state.inner; }, get view() { return state.view; },
  summary: () => ({ tick: state.W.tick, result: state.W.result, fighters: state.W.fighters.map((F) => ({ id: F.id, hp: +F.hp.toFixed(2), st: +F.st.toFixed(2), act: F.act && F.act.id })) }),
};
window.__arena = api;

addEventListener("keydown", (e) => {
  if (e.code === "Tab") e.preventDefault();
  if (e.repeat) return;
  state.held.add(e.code);
  if (KEYS[e.code]) state.presses.push(KEYS[e.code]);
  // the inner arena: digits answer the offer (1 take, 2 leave)
  if (INNER) { const n = /^Digit[12]$/.test(e.code) ? +e.code.slice(5) : 0; if (n && state.inner) state.inner.choose(n - 1); if (e.code === "KeyR") location.reload(); return; }
  if (RUN) return; // the run has its own keys (combat/arena/runui.mjs): no restarts and no tool swaps mid-run
  if (e.code === "KeyR") start();
  if (/^Digit[1-6]$/.test(e.code)) { state.tool = TOOLS[+e.code.slice(5) - 1]; start(); }
});
addEventListener("keyup", (e) => state.held.delete(e.code));
document.getElementById("keys").textContent = CAPTURE ? "" : (INNER ? "hold I+F lay the tool down  N name, then 1 what happened / 2 what you were told\n" : "") + "WASD move  J light  K heavy (hold)  L catch\nSpace roll  Shift step  I block  E shove  G grapple\nQ use  F interact  H lantern  T talk  Tab lock" + (Q.get("story") === "1" ? "" : "  1-6 tool  R restart  ?scenario=" + Object.keys(SCENARIOS).join("|")); // over a scene (ui/inneroverlay.mjs): the keys only

state.log = [];
if (INNER) await startInner(); else if (RUN) startRun(); else start();
if (!CAPTURE) {
  let last = performance.now();
  const frame = (now) => { acc += Math.min(0.1, (now - last) / 1000); last = now; while (acc >= 1 / 60) { acc -= 1 / 60; step(); } if (state.view) state.view.draw(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
