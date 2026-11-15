// The Quota's content read from disk for the inner arena's checkers (combat/arena/innercontent.mjs parses it).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseContent } from "../arena/innercontent.mjs";

export const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "content", "quota");
export function loadContent(dir = CONTENT) {
  const files = {};
  for (const f of readdirSync(dir)) if (f.endsWith(".lwd")) files[f] = readFileSync(join(dir, f), "utf8");
  return parseContent(files);
}
