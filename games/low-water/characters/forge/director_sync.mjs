// Copy the art director's head records (design/art/heads.json) into forge/heads.director.mjs, which
// the browser imports (design/ is not served). node characters/forge/director_sync.mjs
import { readFileSync, writeFileSync } from "node:fs";
const j = JSON.parse(readFileSync(new URL("../../design/art/heads.json", import.meta.url), "utf8"));
writeFileSync(new URL("./heads.director.mjs", import.meta.url), `// The art director's head records, copied from design/art/heads.json (written by
// design/art/tools/export_heads.py). The tests check this copy equals the file. Regenerate with
// node characters/forge/director_sync.mjs.
export const DIRECTOR = ${JSON.stringify(j.people)};
`);
console.log("director records:", Object.keys(j.people).join(", "));
