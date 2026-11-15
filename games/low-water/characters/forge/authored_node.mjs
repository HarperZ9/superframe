// Node-only loader for authored heads. Kept apart from authored.mjs, which the browser imports through
// cast/sculpt.mjs: a node:fs import there broke every figure in the page (found 2026-10-23, commit 0008ccc).
import { readFileSync } from "node:fs";
import { readRna } from "./authored.mjs";

export const loadAuthored = (path) => readRna(readFileSync(path));
