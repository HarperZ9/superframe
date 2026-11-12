// Shared setup for combat tests: a real game (the engine's own night and environment hub) on the
// combat test places, and a world on an arena.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGame } from "../../game.mjs";
import { createWorld } from "../sim/world.mjs";
import { lambDef, foeDef, fighterSpec } from "../roster.mjs";
import { FLOOR } from "../data/arenas.mjs";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ARENA_LWD = readFileSync(join(HERE, "..", "test-content", "arena.lwd"), "utf8");

// clock: "hh:mm" on night 1; terms: setTerm overrides (fog, rain, frost, wind.speed ...)
export function makeG({ clock = null, terms = {}, extra = "" } = {}) {
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD + extra }], seed: 5 });
  if (clock) { const [h, m] = clock.split(":").map(Number); let t = h * 60 + m; if (t < 12 * 60) t += 24 * 60; G.env.advance(t - G.env.clock()); }
  for (const [k, v] of Object.entries(terms)) G.env.command(["setTerm", k, String(v)]);
  return G;
}

// A world: Lamb plus foes given as [style, at, overrides]; brains on unless brains: false.
export function makeWorld({ G = makeG(), arena = FLOOR, lamb = {}, tool = "w.case", lambAt = arena.spawns.lamb, foes = [], brains = true, seed = 9, record = false, minutesPerFrame = 0, learned = [] } = {}) {
  const fighters = [fighterSpec("lamb", "lamb", lambDef(lamb, tool, {}, learned), lambAt, { face: Math.PI / 2 })];
  foes.forEach(([style, at, over = {}], i) => fighters.push(fighterSpec(`foe${i}`, "foe", foeDef(over.rec || null, style, over.def || {}), at, { face: -Math.PI / 2, brain: brains })));
  return createWorld({ G, arena, fighters, seed, record, minutesPerFrame });
}

export const run = (W, n, inp = {}) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...W.step(typeof inp === "function" ? inp(W, i) : inp)); return ev; };
export const press = (a, extra = {}) => ({ lamb: { press: [a], ...extra } });
