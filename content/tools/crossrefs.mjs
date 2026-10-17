// Cross-file dependencies in an act: for each file, the flags, vars and nodes it provides that
// another file reads. Editors must keep these. Director's tool, private.
//   node content/tools/crossrefs.mjs content/act1/act1.lwd > content/act1/CROSSREFS.txt
import { readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";

const root = process.argv[2];
const rootText = readFileSync(root, "utf8");
const files = [basename(root), ...[...rootText.matchAll(/^include:\s*(\S+)/gm)].map((m) => m[1])];
const text = Object.fromEntries(files.map((f) => [f, readFileSync(join(dirname(root), f), "utf8")]));

const sets = {}, reads = {}, nodes = {}, targets = {}, assigns = {}, varReads = {};
const add = (m, k, f) => ((m[k] ||= new Set()).add(f));
for (const [f, t] of Object.entries(text)) {
  for (const m of t.matchAll(/^@node (\S+)/gm)) nodes[m[1]] = f;
  for (const m of t.matchAll(/\bset\(([\w.]+)\)/g)) add(sets, m[1], f);
  for (const m of t.matchAll(/\bhas\(([\w.]+)\)/g)) add(reads, m[1], f);
  for (const m of t.matchAll(/(?:->\s*|go:\s*|alt:\s*|call:\s*|else:\s*|\/\s*)([a-z][\w.]+)/g)) add(targets, m[1], f);
  for (const m of t.matchAll(/\b((?:var\.)?(?:tab_\w+|seenas_\w+|prov|lens|fish|copper|damp_hair|damp_wet|blindfolded|stairs_at|fights|[a-z]+_[a-z_]+))\s*(?:=|\+=|-=)[^=]/g)) add(assigns, m[1].replace(/^var\./, ""), f);
  for (const m of t.matchAll(/\bvar\.(\w+)|\b(tab_\w+|seenas_\w+|damp_hair|damp_wet)\b/g)) add(varReads, m[1] || m[2], f);
  for (const m of t.matchAll(/\bseen\(([\w.]+)\)|\bvisits\(([\w.]+)\)/g)) add(targets, m[1] || m[2], f);
}
const out = {};
for (const [flag, fs] of Object.entries(reads)) for (const rf of fs) for (const sf of sets[flag] || []) if (sf !== rf) add(out, sf, `flag ${flag} (read in ${rf})`);
for (const [n, fs] of Object.entries(targets)) for (const rf of fs) if (nodes[n] && nodes[n] !== rf) add(out, nodes[n], `node ${n} (reached or tested from ${rf})`);
for (const [v, fs] of Object.entries(varReads)) for (const rf of fs) for (const sf of assigns[v] || []) if (sf !== rf) add(out, sf, `var ${v} (read in ${rf})`);
for (const f of files) {
  const l = [...(out[f] || [])].sort();
  console.log(`== ${f}: ${l.length} things other files depend on`);
  l.forEach((x) => console.log("  " + x));
}
