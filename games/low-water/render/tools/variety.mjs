// Prop variety per era (world-layers pass, 2026-10-23): for every place module in render/places whose name carries an era
// prefix (q1_ era 1, q_ era 2, q3_ and q3w_ era 3, q4_ and q4w_ era 4, q5_ era 5), the distinct prop names its built world
// holds, and the union per era. A prop name is the kind (a "relief_bowl" twenty times counts once). Game-agnostic: pass
// --prefix to map other place names to groups, e.g. --prefix a_=act1,b_=act2.
//   LW_PLATE=1 node render/tools/variety.mjs [--json out.json] [--places a,b] [--prefix ...]
import { readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), dir = join(here, "..", "places");
const argv = process.argv.slice(2), opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const PREFIX = opt("--prefix") ? opt("--prefix").split(",").map((s) => s.split("=")) : [["q1_", "era 1"], ["q3w_", "era 3"], ["q3_", "era 3"], ["q4w_", "era 4"], ["q4_", "era 4"], ["q5_", "era 5"], ["q_", "era 2"]];
const only = opt("--places") ? new Set(opt("--places").split(",")) : null;
const groupOf = (n) => (PREFIX.find(([p]) => n.startsWith(p)) || [])[1];
const per = {}, groups = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".mjs") && !f.startsWith("_")).sort()) {
  const name = f.slice(0, -4), g = groupOf(name); if (!g || (only && !only.has(name))) continue;
  let P; try { P = (await import(pathToFileURL(join(dir, f)).href)).default; } catch (e) { console.error(`${name}: ${e.message.split("\n")[0]}`); continue; }
  const props = (P.world && P.world.props) || []; if (!props.length) continue;
  const names = [...new Set(props.map((p) => p.name).filter(Boolean))].sort();
  per[name] = { group: g, props: props.length, kinds: names.length, names };
  (groups[g] ||= new Set()); for (const n of names) groups[g].add(n);
}
for (const [n, r] of Object.entries(per)) console.log(`${n.padEnd(22)} ${r.group}  ${String(r.kinds).padStart(3)} kinds  ${String(r.props).padStart(4)} props`);
for (const g of Object.keys(groups).sort()) console.log(`${g}: ${groups[g].size} distinct kinds over ${Object.values(per).filter((r) => r.group === g).length} places`);
if (opt("--json")) writeFileSync(opt("--json"), JSON.stringify({ per, groups: Object.fromEntries(Object.entries(groups).map(([g, s]) => [g, [...s].sort()])) }, null, 1));
