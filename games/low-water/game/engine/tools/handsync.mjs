// The writers' hands for the game (the UI art lead's, 2026-10-22): design/voice/quota-cast.json keeps each
// speaker's `hand`; the game cannot read design/, so this writes game/engine/ui/lettering/hands.json, keyed
// by the speaker's id in lower case, with the cast's display name for matching a script's speaker line.
//   node game/engine/tools/handsync.mjs [--check]   (--check exits 1 when hands.json is out of date)
import { readFile, writeFile } from "node:fs/promises";

const cast = JSON.parse(await readFile(new URL("../../../design/voice/quota-cast.json", import.meta.url), "utf8"));
const out = {};
for (const [key, sp] of Object.entries(cast.speakers || {})) if (sp.hand) out[key.toLowerCase()] = { name: sp.name || key, ...sp.hand };
const text = JSON.stringify({ format: "lw-hands/1", from: "design/voice/quota-cast.json", hands: out }, null, 1) + "\n";
const file = new URL("../ui/lettering/hands.json", import.meta.url);
if (process.argv.includes("--check")) {
  let cur = ""; try { cur = await readFile(file, "utf8"); } catch { /* none yet */ }
  if (cur.replace(/\r/g, "") !== text) { console.error("handsync: hands.json is out of date; run node game/engine/tools/handsync.mjs"); process.exit(1); }
  console.log(`handsync: ${Object.keys(out).length} hands, in step`);
} else { await writeFile(file, text); console.log(`handsync: wrote ${Object.keys(out).length} hands`); }
