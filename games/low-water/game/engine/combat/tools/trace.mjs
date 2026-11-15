// Combat run traces: one canonical JSON-lines record of a fight, in the line format of the story
// trace recorder (game/engine/tools/tracer.mjs, design/DETMATH.md section 4). The C++ combat port
// replays the same arena, seed and inputs and must emit the same bytes.
//   const tr = traceFight(W, { seed, arena, lineup }); tr.step(input) ...; tr.finish() -> string
//   node combat/tools/trace.mjs <outdir> [seeds=40] [frames=900]   writes one .jsonl per run
// Records (all "s":"h", the host's: the story VM passes them through unchecked):
//   cbegin  v seed arena fighters[{id team kind x z face}]
//   cin     tick lamb input, only on frames where the pilot's input changed
//   cev     tick n (event type) d (the event's other fields, keys sorted)
//   cstate  tick hash f[[id x z hp st]] every 60 ticks
//   cend    tick outcome reason hash
// Numbers are written as JSON.stringify writes a double: the shortest string that reads back to the
// same bits. The C++ writer uses std::to_chars with no precision argument, which is the same rule.
import { mkdirSync, writeFileSync } from "node:fs";
import { makeWorld, makeG } from "../tests/helpers.mjs";
import { createPilot } from "./pilot.mjs";
import { ARENAS } from "../data/arenas.mjs";
import { ARCHETYPES } from "../data/foes.mjs";

export const TRACE_VERSION = 1;

const clean = (v, d = 0) => {
  if (v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || typeof v !== "object") return v;
  if (d > 3) return null;
  if (Array.isArray(v)) return v.map((x) => clean(x, d + 1));
  const o = {}; for (const k of Object.keys(v).sort()) if (typeof v[k] !== "function" && v[k] !== undefined) o[k] = clean(v[k], d + 1);
  return o;
};

export function traceFight(W, { seed, arena, every = 60 } = {}) {
  const out = [], emit = (o) => out.push(JSON.stringify({ ...o, s: "h" }));
  let last = "";
  const state = () => W.fighters.map((F) => [F.id, F.x, F.z, F.hp, F.st]);
  return {
    begin() { emit({ t: "cbegin", v: TRACE_VERSION, seed, arena, fighters: W.fighters.map((F) => ({ id: F.id, team: F.team, kind: W.defs[F.id].kind || null, x: F.x, z: F.z, face: F.face })) }); },
    step(input) {
      const tick = W.tick, key = JSON.stringify(clean(input));
      if (key !== last) { emit({ t: "cin", tick, lamb: clean(input && input.lamb) }); last = key; }
      const evs = W.step(input);
      for (const e of evs) { const { t, type, ...d } = e; emit({ t: "cev", tick: t, n: type, d: clean(d) }); }
      if (W.tick % every === 0) emit({ t: "cstate", tick: W.tick, hash: W.hash(), f: clean(state()) });
      return evs;
    },
    finish() {
      const r = W.result || { outcome: "running", reason: null };
      emit({ t: "cend", tick: W.tick, outcome: r.outcome, reason: r.reason ?? null, hash: W.hash() });
      return out.join("\n") + "\n";
    },
  };
}

// The corpus: every arena with a spawn table, foes cycled through every archetype, seeds 1..n.
export const ARENA_IDS = Object.keys(ARENAS).filter((k) => ARENAS[k].spawns && ARENAS[k].spawns.foes).sort();
export const STYLE_IDS = Object.keys(ARCHETYPES).sort();
export function corpusRun(i) {
  const arena = ARENA_IDS[i % ARENA_IDS.length], A = ARENAS[arena], seed = i + 1;
  const spots = A.spawns.foes.slice(0, 2);
  const foes = spots.map((at, k) => [STYLE_IDS[(i * 2 + k) % STYLE_IDS.length], at]);
  return { arena, seed, foes, name: `${String(seed).padStart(2, "0")}-${arena}-${foes.map((f) => f[0]).join("+")}` };
}
export function traceCorpusRun(i, frames = 900) {
  const { arena, seed, foes, name } = corpusRun(i);
  const W = makeWorld({ G: makeG({ clock: "23:30" }), arena: ARENAS[arena], seed, foes, minutesPerFrame: 1 / 240 });
  const tr = traceFight(W, { seed, arena }), pilot = createPilot();
  tr.begin();
  for (let f = 0; f < frames && !W.result; f++) tr.step({ lamb: pilot(W) });
  return { name, text: tr.finish() };
}

if (process.argv[1] && process.argv[1].endsWith("trace.mjs")) {
  const dir = process.argv[2] || "combat/out/traces", n = +(process.argv[3] || 40), frames = +(process.argv[4] || 900);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < n; i++) { const { name, text } = traceCorpusRun(i, frames); writeFileSync(`${dir}/${name}.jsonl`, text); }
  console.log(`${n} combat traces in ${dir}; run tools/trace-manifest.mjs on it for hashes`);
}
