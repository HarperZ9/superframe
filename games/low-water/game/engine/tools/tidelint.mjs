#!/usr/bin/env node
// The tide is canon: a line that names the tide must agree with the tide clock when it is shown
// (coordinator, 2026-10-21: the mole at 14:36 said "the tide is out" at +2.5 m and rising).
// Reads a beat log from tools/playthrough.mjs --beatlog (every beat shown, with its clock, the tide in
// metres and whether it is rising) and checks each line's tide words against the tide then. The
// night's range sets what "out" and "in" mean: below 30% of the way from low to high water is out, above
// 70% is in.
//   node tools/playthrough.mjs --build all --beatlog out/beats.jsonl
//   node tools/tidelint.mjs out/beats.jsonl [--low -0.42 --high 5.1]   (defaults: each act's own range, from the log)
// Prints file-free findings: act, node, clock, tide, the words and why they disagree. Exit 1 on any.
// It also sweeps each act's night every five minutes for the waiting row (ui/waiting.mjs waitLabel):
// the row must never offer to wait for the water the tide already stands at.
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tideAt, tideDir, tideTurn, NIGHT_ONE } from "../world/night.mjs";
import { waitLabel } from "../ui/waiting.mjs";
import { tideWords } from "../ui/hudtab.mjs";

// tide words and what each claims: level (out | in) and direction (rising | falling)
export const CLAIMS = [
  { re: /\b(tide is out|tide's out|tide out|low water|at low tide|the tide has gone out|mud showing|grey plain with pools|pools in it that hold the sky)\b/i, level: "out" },
  { re: /\b(tide is in|tide's in|high water|at high tide|full tide|the tide is full|harbour is full)\b/i, level: "in" },
  { re: /\b(tide (?:is )?(?:coming|comes) in|tide (?:is )?rising|tide (?:is )?on the make|the flood|flooding tide|making tide)\b/i, dir: "rising" },
  { re: /\b(tide (?:is )?(?:going|goes) out|tide (?:is )?falling|the ebb|ebbing)\b/i, dir: "falling" },
];

// Sentences that name the tide at another time are forecasts or tables, not claims about now: a
// sentence with a clock time in it ("Low water at twenty-six minutes to one", "High water at 05:58"),
// a tide word after before/after/until/by/on/at ("before high water", "leave on the ebb", "washed
// up at low water"), a simile
// ("like a tide coming in"), a past turn ("the ebb has turned", "where the flood left it"), and the
// title in capitals (LOW WATER ENDS).
const TIME = /\b(\d{1,2}:\d{2}|o'clock|(?:quarter|half|minutes?|ten|five|twenty) (?:past|to)|at (?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|midnight))\b/i;
const NOT_NOW = /\b(before|after|until|till|by|on|at|like a|like the)\s+(?:the\s+|a\s+)?$/i;
const PAST = /^\s*(?:has|had)?\s*(?:turned|left)\b/i;
// the Congregation's refrain ("Low light, low water, low voices"): a litany, not the hour
const REFRAIN = /low light, low water/i;
export const sentences = (text) => String(text || "").split(/(?<=[.!?])\s+/);

// The waiting row over a whole night: findings where it offers the state the tide is in.
export function sweepWaitRow(spec, from, to, label = waitLabel) {
  const out = [], range = { low: spec.low.h, high: spec.high.h };
  for (let c = from; c <= to; c += 5) {
    const tide = tideAt(spec, c), dir = tideDir(spec, c), t = tideTurn(spec, c), L = label({ tide, dir, next: t.kind, at: t.at, clock: c, range });
    const now = tideWords(tide, dir === "rising" ? 1 : dir === "falling" ? -1 : 0, range), m = L.text.match(/^Wait for (high|low) water$/);
    if (m && now === `${m[1]} water`) out.push({ clock: c, tide: +tide.toFixed(2), text: L.text, now });
  }
  return out;
}

// a beat's claims checked against the tide then; range: { low, high } metres
export function check(row, range) {
  const out = [], f = (row.tide - range.low) / Math.max(0.01, range.high - range.low);
  for (const sen of sentences(row.text)) {
    if (TIME.test(sen) || REFRAIN.test(sen)) continue;
    for (const c of CLAIMS) {
      const m = c.re.exec(sen); if (!m) continue;
      if (m[0] === m[0].toUpperCase() && /[A-Z]/.test(m[0])) continue;
      if (NOT_NOW.test(sen.slice(0, m.index)) || PAST.test(sen.slice(m.index + m[0].length))) continue;
      if (c.level === "out" && f > 0.3) out.push(`"${m[0]}" but the tide is ${row.tide} m (${Math.round(f * 100)}% of the way to high water)`);
      if (c.level === "in" && f < 0.7) out.push(`"${m[0]}" but the tide is ${row.tide} m (${Math.round(f * 100)}% of the way to high water)`);
      if (c.dir === "rising" && row.rising === false) out.push(`"${m[0]}" but the tide is falling`);
      if (c.dir === "falling" && row.rising === true) out.push(`"${m[0]}" but the tide is rising`);
    }
  }
  return out;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/tidelint.mjs");
if (isMain) {
  const argv = process.argv.slice(2), file = argv.find((a) => !a.startsWith("--") && !/^-?\d/.test(a));
  if (!file) { console.error("usage: node tools/tidelint.mjs beats.jsonl [--low m --high m]"); process.exit(2); }
  const num = (k) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : null; };
  const rows = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  // each act's range from the tides the log saw, unless given
  const range = {};
  for (const r of rows) { const g = (range[r.act] ||= { low: Infinity, high: -Infinity }); g.low = Math.min(g.low, r.tide); g.high = Math.max(g.high, r.tide); }
  if (num("--low") != null) for (const k in range) { range[k].low = num("--low"); range[k].high = num("--high"); }
  const seen = new Set(); let n = 0;
  for (const r of rows) for (const why of check(r, range[r.act])) {
    const key = `${r.act}|${r.node}|${why}`; if (seen.has(key)) continue; seen.add(key); n++;
    const hh = `${String(Math.floor(r.clock / 60) % 24).padStart(2, "0")}:${String(Math.floor(r.clock % 60)).padStart(2, "0")}`;
    console.log(`act ${r.act} ${r.node} at ${hh} (${r.place}): ${why}`);
  }
  console.log(`${rows.length} beats read, ${n} tide line${n === 1 ? "" : "s"} disagree${n === 1 ? "s" : ""} with the tide clock`);
  // the waiting row, each act's own night
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent } = await import("../game.mjs");
  const ROOT = new URL("../../../content/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
  let w = 0;
  const { actFiles } = await import("./acts.mjs");
  for (const act of actFiles(ROOT)) {
    const { sources } = await loadAct(ROOT + act, (p) => readFile(p, "utf8")), C = loadContent(sources), spec = Object.values(C.nights)[0] || NIGHT_ONE;
    const from = C.book.clock0, to = C.book.meta["end-clock"] ? (([h, m]) => (h < 12 ? h + 24 : h) * 60 + m)(C.book.meta["end-clock"].split(":").map(Number)) : from + 600;
    for (const f of sweepWaitRow(spec, from, to)) { w++; console.log(`${act} ${String(Math.floor(f.clock / 60) % 24).padStart(2, "0")}:${String(f.clock % 60).padStart(2, "0")}: the waiting row says "${f.text}" at ${f.tide} m, already ${f.now}`); }
  }
  console.log(`waiting row: ${w} offer${w === 1 ? "" : "s"} of the state the tide is already in`);
  process.exit(n || w ? 1 : 0);
}
