#!/usr/bin/env node
// The clock is canon too: a beat whose narration tells the time now must agree with the game clock
// when it is shown (coordinator, 2026-10-21, after the prologue said twenty-two past ten at 22:41 and
// both later nights opened mid-afternoon under "ten past seven"). Reads a beat log from
// tools/playthrough.mjs --beatlog (every beat shown, with its clock) and checks each statement of the
// time against the clock, within a tolerance set by how exact the statement is (5 minutes for one
// given to the minute, 10 to five minutes, 15 for a quarter, a half or an hour, 30 when hedged;
// --tol N overrides). The twelve-hour reading nearest the clock is taken, so "seven" is 07:00 or 19:00.
//   node tools/playthrough.mjs --build all,routes --beatlog out/beats.jsonl
//   node tools/clocklint.mjs out/beats.jsonl [--tol N]
// Only the narration is read (the beat log's nar field): people in the script speak of other hours
// all night (what they did at twenty to ten, where they will be at two), and narration is the voice
// that says what time it is now. What counts as telling the time now: a sentence that is only the time ("Ten past seven."), one that
// opens with it ("Eight minutes past seven. The wind ..."), or one that reads a clock or a watch ("by
// the ship's clock", "the church clock says", "It is half past three"). Times after at, by, until,
// before, after, since, from, till or between are appointments and schedules, not now; a clock the
// script says is wrong ("slow", "fast", "lying", "stopped"), a quotation, and a log or ledger line
// read out (a time followed by capitals) are skipped.
import { readFileSync } from "node:fs";

const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const word = (w) => { if (!w) return null; w = w.toLowerCase().replace(/^an?\s+/, ""); if (w === "quarter") return 15; if (w === "half") return 30; if (/^\d+$/.test(w)) return +w; let n = 0; for (const p of w.split(/[-\s]+/)) { if (!(p in NUM)) return null; n += NUM[p]; } return n; };
const H = "(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const M = "((?:a\\s+)?quarter|half|(?:twenty|thirty|forty|fifty)(?:[-\\s](?:one|two|three|four|five|six|seven|eight|nine))?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|\\d{1,2})";
// tol: how exact the statement is. Given to the minute ("twenty-two past ten", 22:41): 5 minutes;
// to five minutes ("ten past seven"): 10; a quarter, a half or an hour ("half past three", "two
// o'clock", "midnight"): 15; any of them hedged ("about", "nearly", "or near it"): 30.
const PATTERNS = [
  { re: new RegExp(`\\b${M}\\s+(?:minutes?\\s+)?(past|to)\\s+${H}\\b`, "i"), at: (m) => { const min = word(m[1]), h = word(m[3]); return m[2].toLowerCase() === "past" ? h * 60 + min : h * 60 - min; }, tol: (m) => { const min = word(m[1]); return min % 15 === 0 ? 15 : min % 5 === 0 ? 10 : 5; } },
  { re: new RegExp(`\\b${H}\\s+o'clock\\b`, "i"), at: (m) => word(m[1]) * 60, tol: () => 15 },
  { re: /\b(midnight)(?=\s*[.,!?;]|\s*$)/i, at: () => 0, tol: () => 15 },   // the hour, not "the Shelf's midnight word"
  { re: /\b([01]?\d|2[0-3]):([0-5]\d)\b/, at: (m) => +m[1] * 60 + +m[2], tol: () => 5 },
];
const NOT_NOW = /\b(at|by|until|till|before|after|since|from|between|for|every|in|on|of)\s+(?:about\s+|nearly\s+|almost\s+|just\s+)?$/i;
const READS = /(clock|watch|chronometer|it is|it's|by the|says|reads|strikes|struck)/i;
const WRONG = /\b(slow|fast|lying|lies|stopped|wrong)\b/i;
export const sentences = (t) => String(t || "").split(/(?<=[.!?])\s+/);

// The statements of the time now in a beat's text: [{ said, at (minutes in 12-hour form) }]
export function statements(text) {
  const out = [];
  for (const sen of sentences(text)) {
    if (WRONG.test(sen)) continue;
    if (/^\W*["“‘']/.test(sen)) continue;                                  // a quotation: someone else's hour
    if (/^\s*\d{1,2}:\d{2},\s/.test(sen)) continue;                                    // a log or a ledger entry (02:51, ALDERMAN BY TELEPHONE; 03:20, reset)
    for (const P of PATTERNS) {
      const m = P.re.exec(sen); if (!m) continue;
      const before = sen.slice(0, m.index), alone = sen.replace(/[.!?,]\s*$/, "").trim().length <= m[0].length + 6, opens = /^\W*$/.test(before);
      if (NOT_NOW.test(before) || /\bnight,\s*$/i.test(before)) continue; // "Low Night, one o'clock.": a dated document, not now
      if (!(alone || opens || READS.test(sen))) continue;
      const hedged = /\b(about|nearly|almost|getting on for|near|round about|around)\s+$/i.test(before) || /\bor (near|about|so)\b/i.test(sen);
      out.push({ said: m[0], at: ((P.at(m) % 720) + 720) % 720, tol: hedged ? 30 : P.tol(m), sentence: sen.trim() });
      break;
    }
  }
  return out;
}

// How far a statement is from the clock (minutes, on the twelve-hour dial)
export const off = (at, clock) => { const d = Math.abs((((clock % 720) - at) % 720 + 720) % 720); return Math.min(d, 720 - d); };

// Each narration line against the clock when it was said (narAt, from the runner's line stamps),
// else the beat's text against the clock when the beat was shown.
export function check(row, tol = null) {
  const parts = row.narAt ? row.narAt.map(([clock, text]) => ({ clock, text })) : [{ clock: row.clock, text: row.nar ?? row.text }];
  return parts.flatMap((p) => statements(p.text).filter((s) => off(s.at, p.clock) > (tol ?? s.tol)).map((s) => ({ ...s, clock: p.clock, by: off(s.at, p.clock) })));
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/clocklint.mjs");
if (isMain) {
  const argv = process.argv.slice(2), file = argv.find((a) => !a.startsWith("--") && !/^\d/.test(a)), ti = argv.indexOf("--tol"), tol = ti >= 0 ? +argv[ti + 1] : null;
  if (!file) { console.error("usage: node tools/clocklint.mjs beats.jsonl [--tol 20]"); process.exit(2); }
  const rows = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  const seen = new Set(); let n = 0, told = 0;
  const hh = (c) => `${String(Math.floor(c / 60) % 24).padStart(2, "0")}:${String(Math.floor(c % 60)).padStart(2, "0")}`;
  for (const r of rows) {
    told += statements(r.nar ?? r.text).length;
    for (const f of check(r, tol)) { const k = `${r.act}|${r.node}|${f.said}`; if (seen.has(k)) continue; seen.add(k); n++; console.log(`act ${r.act} ${r.node} at ${hh(f.clock ?? r.clock)} (${r.build}): "${f.said}" is ${f.by} minutes off (allowed ${tol ?? f.tol}): ${f.sentence.slice(0, 110)}`); }
  }
  console.log(`${rows.length} beats read, ${told} statements of the time, ${n} disagree with the clock by more than ${tol == null ? "their precision allows (5, 10, 15 or 30 minutes)" : `${tol} minutes`}`);
  process.exit(n ? 1 : 0);
}
