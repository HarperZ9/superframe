// Print the node sequence and clock of one route (debug aid for routes.json).
import { readFileSync } from "node:fs";
import { build, walk } from "./lwd_check.mjs";
const [file, routes, idx] = process.argv.slice(2), book = build(readFileSync(file, "utf8")), rt = JSON.parse(readFileSync(routes, "utf8"))[+idx];
const seq = []; const orig = book.nodes; book.nodes = new Proxy(orig, { get: (o, k) => { if (typeof k === "string" && o[k]) seq.push(k); return o[k]; } });
const w = walk(book, 1, { route: rt }); console.log(rt.name, "->", w.outcome || w.why); console.log(seq.filter((x, i) => x !== seq[i - 1]).join(" > "));
