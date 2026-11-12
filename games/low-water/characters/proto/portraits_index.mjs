// Write characters/portraits/index.json from what is on disk, atomically (temp file, then rename),
// so a reader never sees a missing or half-written index: { who: { expression: { light: path } } }.
import { readdirSync, writeFileSync, renameSync, existsSync } from "node:fs";
const root = new URL("../portraits/", import.meta.url), index = {};
if (existsSync(root)) for (const who of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  for (const f of readdirSync(new URL(`${who}/`, root))) { const m = /^(\w+)-(\w+)\.png$/.exec(f); if (!m) continue; ((index[who] ||= {})[m[1]] ||= {})[m[2]] = `characters/portraits/${who}/${f}`; }
}
const tmp = new URL("index.json.tmp", root); writeFileSync(tmp, JSON.stringify(index, null, 1)); renameSync(tmp, new URL("index.json", root));
console.log("portrait index:", Object.keys(index).length, "people");
