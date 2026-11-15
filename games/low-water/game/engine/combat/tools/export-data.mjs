// P1: the move data as one versioned JSON file (combat/data/moves.json) that the JS loads and the C++
// port loads. The file holds the fixed tables (common, body, the specials of foes, bosses and arenas)
// and the tool settings (tool classes and tools). Tool strikes are not stored: buildToolMoves in
// data/tools.mjs expands them from the settings, and the C++ port reimplements that generator.
// design/DETMATH.md section 6 has the schema.
//   node combat/tools/export-data.mjs golden   writes tests/moves-expanded.golden.json
//   node combat/tools/export-data.mjs check    exits 1 if the expansion differs from the golden
// The golden is the expansion of every table and every tool class, at the Lamb's wind-up and the
// foes', through defineMoves: the frame data both implementations must produce.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineMoves } from "../sim/moves.mjs";
import { COMMON } from "../data/common.mjs";
import { BODY } from "../data/body.mjs";
import { SPECIALS } from "../data/foes.mjs";
import { BOSS_SPECIALS } from "../data/bosses.mjs";
import { ARENA_SPECIALS } from "../data/archetypes.mjs";
import { TOOL_CLASSES, TOOLS, profileOf, buildToolMoves } from "../data/tools.mjs";
import { FOE_WINDUP } from "../roster.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const GOLDEN = join(here, "..", "tests", "moves-expanded.golden.json");

const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);

// The base set: the tables plus one expansion of every tool class at the Lamb's wind-up.
export function baseTable() {
  const t = { ...COMMON, ...BODY, ...SPECIALS, ...BOSS_SPECIALS, ...ARENA_SPECIALS };
  for (const cls of Object.keys(TOOL_CLASSES).sort()) Object.assign(t, buildToolMoves({ ...TOOL_CLASSES[cls], cls, id: cls }, { prefix: `${cls}:` }));
  return t;
}
// Everything the generator can make from the settings: each tool id at the Lamb's wind-up, slow, and the foes'.
export function expandAll() {
  const out = { base: sortKeys(defineMoves(baseTable())) };
  const tools = {};
  for (const id of Object.keys(TOOLS).sort()) {
    const P = profileOf(id);
    tools[id] = sortKeys({ lamb: defineMoves(buildToolMoves(P, {})), slow: defineMoves(buildToolMoves(P, { slow: true })), foe: defineMoves(buildToolMoves(P, { windup: FOE_WINDUP })) });
  }
  out.tools = tools;
  return out;
}

const mode = process.argv[1] && process.argv[1].endsWith("export-data.mjs") ? process.argv[2] : null;
if (mode === "golden") {
  const e = expandAll(); writeFileSync(GOLDEN, JSON.stringify(e) + "\n");
  console.log(`golden: ${Object.keys(e.base).length} base moves, ${Object.keys(e.tools).length} tools`);
} else if (mode === "check") {
  const same = JSON.stringify(expandAll()) + "\n" === readFileSync(GOLDEN, "utf8");
  console.log(same ? "expansion matches the golden" : "expansion DIFFERS from the golden"); process.exit(same ? 0 : 1);
}
