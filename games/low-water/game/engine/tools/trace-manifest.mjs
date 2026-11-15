// Writes manifest.json beside a folder of traces: file, bytes, lines, sha256. The C++ equivalence run and the CI subset read it.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = process.argv[2], files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
const rows = files.map((f) => { const b = readFileSync(`${dir}/${f}`); return { file: f, bytes: b.length, lines: b.toString("utf8").split("\n").length - 1, sha256: createHash("sha256").update(b).digest("hex") }; });
writeFileSync(`${dir}/manifest.json`, JSON.stringify({ format: "lw-trace/1", count: rows.length, traces: rows }, null, 1) + "\n");
console.log(`${rows.length} traces, ${rows.reduce((a, r) => a + r.bytes, 0)} bytes`);
