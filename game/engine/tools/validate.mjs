#!/usr/bin/env node
// Validate Low Water content.
//   node tools/validate.mjs <act root .lwd | files .lwd ...> [--carry <earlier act root>]... [--json] [--quiet]
// A root file's include: lines are followed. Each --carry names an earlier act, oldest first
// (--carry act1/act1.lwd --carry act2/act2.lwd for Act 3). The earlier acts are validated in that
// order, each carrying what the ones before it set, and this act may read every flag and variable
// any of them sets. Prints file:line: level: message, then a summary.
// Exit code 1 when there are errors (warnings alone exit 0).
import { readFile } from "node:fs/promises";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent } from "../game.mjs";
import { lint } from "./lint.mjs";

const args = process.argv.slice(2), carryRoots = [], files = [];
for (let i = 0; i < args.length; i++) { if (args[i] === "--carry") carryRoots.push(args[++i]); else if (!args[i].startsWith("--")) files.push(args[i]); }
const flag = (f) => args.includes(f);
if (!files.length) { console.error("usage: node tools/validate.mjs <root.lwd | files.lwd ...> [--carry <earlier act root>]... [--json] [--quiet]"); process.exit(2); }

const read = (p) => readFile(p, "utf8");
async function loadAll(list) {
  const sources = [], errors = [];
  for (const f of list) { const r = await loadAct(f.replace(/\\/g, "/"), read); for (const x of r.sources) if (!sources.some((y) => y.file === x.file)) sources.push(x); errors.push(...r.errors); }
  return { sources, errors };
}

// The earlier acts, oldest first: each is linted carrying what came before it, then merged.
let carry = null;
for (const root of carryRoots) {
  const prev = await loadAll([root]), report = lint(loadContent(prev.sources), { carry });
  const u = (mine, theirs = mine) => [...new Set([...(carry ? carry[mine] : []), ...report[theirs]])];
  carry = { sets: u("sets"), declared: u("declared"), nodes: u("nodes", "nodeIds") };
  console.log(`carried through ${root}: ${carry.sets.length} flags set, ${carry.declared.length} variables, ${carry.nodes.length} nodes`);
}
const { sources, errors: loadErrors } = await loadAll(files);
const C = loadContent(sources);
C.errors.unshift(...loadErrors);
const r = lint(C, { carry });
if (flag("--json")) { console.log(JSON.stringify({ ...r, graph: undefined }, null, 1)); }
else {
  if (!flag("--quiet")) for (const i of r.issues) console.log(`${i.file || "?"}:${i.line || 0}: ${i.level}: ${i.msg}${i.node ? `  [${i.node}]` : ""}`);
  console.log(`${sources.length} file(s), ${r.nodes} nodes, ${r.reachable} reachable; ${r.errors} error(s), ${r.warnings} warning(s)`);
}
process.exit(r.errors ? 1 : 0);
