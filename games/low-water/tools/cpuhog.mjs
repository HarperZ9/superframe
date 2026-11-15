// A synthetic CPU hog for the loaded-machine benchmark (perf/PROGRESS.md): N worker threads, each spinning
// a core flat out at normal priority, until this process is stopped. Stands in for a player's other apps.
//   node tools/cpuhog.mjs [threads]      default: every logical core but two
import { Worker } from "node:worker_threads";
import { availableParallelism } from "node:os";
const n = Math.max(1, +(process.argv[2] || availableParallelism() - 2));
const spin = "let x = 0; for (;;) { for (let i = 0; i < 1e7; i++) x = (x * 1664525 + 1013904223) | 0; }";
for (let i = 0; i < n; i++) new Worker(spin, { eval: true });
console.log(`cpuhog: ${n} threads spinning (pid ${process.pid})`);
