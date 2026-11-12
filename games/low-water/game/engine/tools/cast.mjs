// The cast ids the character pipeline can draw (characters/): what a figure id must be. Read from the
// pipeline itself: CAST_IDS when characters/runtime/fightdrawer.mjs exports it, else the cast modules'
// file names and the named exports of the shared-body modules (folk.mjs, lamplighter.mjs).
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function castIds(charactersDir) {
  try { const m = await import(pathToFileURL(`${charactersDir}/runtime/fightdrawer.mjs`).href); if (m.CAST_IDS) return new Set(m.CAST_IDS); } catch (e) { console.warn(`cast: fightdrawer not read (${e.message}); reading the cast folder`); }
  const ids = new Set(), files = (await readdir(`${charactersDir}/cast`)).filter((f) => f.endsWith(".mjs"));
  for (const f of files) {
    const base = f.replace(/\.mjs$/, "");
    if (!["folk", "lamplighter", "parts", "tools"].includes(base)) ids.add(base);
    if (base === "folk" || base === "lamplighter") for (const m of (await readFile(`${charactersDir}/cast/${f}`, "utf8")).matchAll(/\b([A-Z][A-Z]+)\s*=\s*make\(/g)) ids.add(m[1].toLowerCase());
  }
  return ids;
}
