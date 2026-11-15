// The surface kinds (render/kit/ids.mjs) as data for the game's glyph renderer, which runs in the
// browser and does not load the bake's kit: id, name, material, tone (0..1 value), flags, emitter.
//   node render/tools/export-kinds.mjs   (writes game/engine/paint/glyph/kinds.json)
import { writeFileSync } from "node:fs";
import { BY_ID } from "../kit/ids.mjs";
const out = [];
for (const k of BY_ID) if (k) out.push({ id: k.id, name: k.name, mat: k.mat, tone: k.tone, flags: k.flags, emit: k.emit || null });
writeFileSync(new URL("../../game/engine/paint/glyph/kinds.json", import.meta.url), JSON.stringify(out));
console.log(`${out.length} kinds`);
