// The community model's stocks for the proofs in node (stockstates.mjs has the states and the parser).
//   const R = stocksReader(root, state)  -> read(name, subject)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseLwd, readerOf, STATES } from "./stockstates.mjs";
export { STATES };
export const stocksReader = (root, state = "start") => readerOf(parseLwd(readFileSync(join(root, "content/quota/q_community.lwd"), "utf8")), state);
