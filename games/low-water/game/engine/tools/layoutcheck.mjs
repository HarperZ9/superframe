// The fight stills' layout: every fight.json under a capture folder (tools/uxfight.py writes the layer's
// layout each second) is read, and a still fails where a panel that is not see-through (.clearway) hides more
// than COVER of a way out's on-screen box (ui/fightways.mjs coverShare), or where the keys and the meters overlap. Exit 1 on any failure.
//   node tools/layoutcheck.mjs game/capture/<folder> [more folders]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { coverShare, COVER } from "../ui/fightways.mjs";
const over = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === "fight.json") files.push(p); } };
for (const d of process.argv.slice(2)) walk(d);
let stills = 0, bad = 0, faded = 0, flat = 0;
for (const f of files) {
  const { log } = JSON.parse(readFileSync(f, "utf8"));
  for (const row of log || []) {
    const L = row.layout; if (!L) continue;
    if (L.plate === false) { flat++; continue; } // the flat row arena, drawn only when a plate fails to load (headless without a GPU): not a layout anyone plays
    stills++;
    const errs = [];
    for (const [k, p] of Object.entries(L.panels || {})) for (const b of L.outs || []) if (coverShare(p.rect, b, L.view || [1280, 720]) > COVER) { if (p.faded) faded++; else errs.push(`${k} covers a way out`); }
    const keys = (L.panels || {}).keys;
    if (keys && L.meters && over(keys.rect, L.meters)) errs.push("the keys cover the meters");
    if (errs.length) { bad++; console.log(`${f} at ${row.t} s: ${[...new Set(errs)].join("; ")}`); }
  }
}
console.log(`${stills} fight stills from ${files.length} walks: ${bad} with paper over a way out or the meters; ${faded} panel-over-box cases shown see-through${flat ? `; ${flat} stills on the flat fallback arena left out` : ""}`);
process.exit(bad || !stills ? 1 : 0);
