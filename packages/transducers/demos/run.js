/* Runs the four chains and a sweep of the budget's prediction. Writes the chain ledger, the rows and the sweep to TRANSDUCERS_OUT.
   node demos/run.js */
"use strict";
const fs = require("fs"), path = require("path"), T = require("../src/index.js"), F = T.Field();
const OUT = process.env.TRANSDUCERS_OUT || ".", round = (x) => (x === null || x === undefined ? null : +x.toPrecision(5));
const row = (x) => ({ id: x.id, grade: x.grade, bytes: x.bytes, ms: +x.ms.toFixed(2), bitsLost: round(x.bitsLost), ledgerKept: round(x.bitsKept), measuredKept: round(x.keptMeasured), budget: round(x.budget.I), half: round(x.budget.half), tight: round(x.budget.tight), running: round(x.running), signal: round(x.budget.signal), noiseFloor: round(x.budget.noise), dt: round(x.budget.dt), dx: round(x.budget.dx), spaceModes: x.budget.sbw, timeModes: x.budget.tbw, overBudget: !!x.overBudget, overRunning: !!x.overRunning, overTight: !!x.overTight, overLedger: !!x.overLedger, status: x.status });
const chains = { camera: T.demoCamera(), retina: T.demoRetina(), text: T.demoText(), dna: T.demoDNA() }, report = {};
for (const [k, d] of Object.entries(chains)) {
  const r = T.chain(d.src, d.kernels, d.opt);
  report[k] = { name: d.name, worstLedger: r.worst, worstMeasured: r.worstMeasured, ledgerOk: r.ledgerOk, finalHash: F.hashValues(r.out), rows: r.rows.map(row) };
  fs.writeFileSync(path.join(OUT, `ledger-${k}.jsonl`), F.ledgerJSONL(r.out.ledger));
  console.log(`${d.name}: worst by ledger ${r.worst}, worst by measure ${r.worstMeasured}`);
  for (const x of report[k].rows) console.log(`  ${x.id.padEnd(36)} ${String(x.grade).padEnd(13)} lost ${String(x.bitsLost).padStart(8)} kept ${String(x.measuredKept).padStart(8)} budget ${String(x.budget).padStart(9)} half ${String(x.half).padStart(9)} ${x.bytes}B ${x.ms}ms ${x.overBudget ? "OVER" : ""}${x.overRunning ? " RUN" : ""}${x.overTight ? " TIGHT" : ""}`);
}
const sweep = [], tally = (name, r) => { for (const x of r.rows.slice(1)) sweep.push({ case: name, id: x.id, kept: round(x.keptMeasured), budget: round(x.budget.I), half: round(x.budget.half), tight: round(x.budget.tight), over: !!x.overBudget, overRunning: !!x.overRunning, overHalf: x.keptMeasured > x.budget.half, overTight: !!x.overTight }); };
for (const peak of [20, 200, 2000, 20000]) for (const bits of [6, 8, 10, 12]) { const d = T.demoCamera(64, { peak, bits }); tally(`camera peak=${peak} bits=${bits}`, T.chain(d.src, d.kernels, d.opt)); }
for (const mean of [5, 10, 40, 160, 640]) for (const seed of [2, 3, 4]) { const d = T.demoRetina(4096, { mean, seed }); tally(`retina mean=${mean} seed=${seed}`, T.chain(d.src, d.kernels, d.opt)); }
const count = (f) => sweep.filter(f).length, summary = { steps: sweep.length, over: count((s) => s.over), overNonSpike: count((s) => s.over && !s.id.startsWith("spike")), overRunning: count((s) => s.overRunning), overRunningNonSpike: count((s) => s.overRunning && !s.id.startsWith("spike")), overHalf: count((s) => s.overHalf), overTight: count((s) => s.overTight), overIds: [...new Set(sweep.filter((s) => s.over).map((s) => s.id))], overRunningIds: [...new Set(sweep.filter((s) => s.overRunning).map((s) => s.id))], overHalfIds: [...new Set(sweep.filter((s) => s.overHalf).map((s) => s.id))], overTightIds: [...new Set(sweep.filter((s) => s.overTight).map((s) => s.id))] };
console.log(JSON.stringify(summary, null, 1));
fs.writeFileSync(path.join(OUT, "chain-ledger.json"), JSON.stringify({ report, summary, sweep }, null, 1));
