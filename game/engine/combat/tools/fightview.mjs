// Test harness for the shell's fight view (ui/fight.mjs, the systems engineer's), on the Act 1
// content: loads act1.lwd with its includes, makes a full game (engine plus combat), creates
// Lamb, plays the node that starts the fight, and mounts openFight with the shell's own focus
// and styles, as ui/play.mjs does. Through game/serve.mjs at
//   /engine/combat/tools/fightview.html?node=floor.salvors.fight&archetype=p.ledger[&pilot=1][&drive=1]
// pilot=1: the scripted test player drives Lamb (combat/tools/pilot.mjs) through the combat
// system's input. drive=1: the real-time loop is paused and window.__fv.step(n) advances n fixed
// steps (for headless captures). Not part of the game.
import { loadAct } from "../../dialogue/book.mjs";
import { loadContent, createFullGame } from "../../full.mjs";
import { loadStyles } from "../../ui/styles.mjs";
import { createFocus } from "../../ui/focus.mjs";
import { openFight } from "../../ui/fight.mjs";
import { createPilot } from "./pilot.mjs";

const q = new URLSearchParams(location.search);
await loadStyles();
const { sources, errors } = await loadAct("/content/act1/act1.lwd", async (p) => { const r = await fetch(p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.text(); });
if (errors.length) console.error("act errors", errors);
const G = createFullGame({ content: loadContent(sources), seed: +(q.get("seed") || 7) });
G.create({ archetype: q.get("archetype") || "p.ledger", enter: false });
const talk = G.talk(q.get("node") || "floor.salvors.fight");
if (!talk.beat.fight) throw new Error(`node ${q.get("node")} does not start a fight`);
const stage = document.getElementById("stage"), F = createFocus();
const ctx = { G, stage, F };
const log = [];
G.on("*", (e, name) => { if (name.startsWith("fight.") && name !== "fight.lock") log.push({ name, ...e }); });
let outcome = null;
const fight = openFight(ctx, talk.beat.fight, () => { outcome = talk.afterFight(); });
if (q.get("pilot") === "1") { const pilot = createPilot(), C = G.ext.combat, step = C.step; C.step = (inp) => step(inp || (C.current ? pilot(C.current.W) : null)); }
const DRIVE = q.get("drive") === "1";
let last = performance.now();
const tick = (now) => { if (!DRIVE) G.loop.frame(Math.min(0.25, (now - last) / 1000)); last = now; requestAnimationFrame(tick); };
requestAnimationFrame(tick);
window.__fv = {
  G, fight, log, get outcome() { return outcome; },
  step(n = 1) { for (let i = 0; i < n; i++) G.loop.step(); return { tick: fight.W.tick, clock: G.env.clock(), result: fight.W.result }; },
  finish() { fight.finish(); return outcome && { lines: outcome.lines.map((l) => l.text).slice(0, 3), clock: G.env.clock() }; },
};
document.documentElement.dataset.ready = "1";
