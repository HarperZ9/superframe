#!/usr/bin/env node
// How long the game is to play, per act and build, estimated from the scripted runs:
//   node tools/playthrough.mjs --build all --beatlog out/beats.jsonl --json out/time.json
//   node tools/playtime.mjs out/beats.jsonl out/time.json
// Model (each term with a low, middle and high assumption; minutes):
//   reading   words shown in beats (narration, lines, voices, instruments) at 280 / 230 / 180 words a minute
//   choosing  each choice the run made, 2 / 4 / 8 seconds (reading the options and picking)
//   walking   each change of place between beats, 8 / 15 / 25 seconds on foot across a plate
//   fighting  each fight's simulated seconds (60 ticks a second), the inner arena's fights too (2026-10-23, from
//             tools/innerplay.mjs), times 1.0 / 1.3 / 1.8 (pauses, retries not counted: a lost fight is played once)
// Not counted: menus and the Daybook, waiting rows, saving, reading Margin leaves, deaths retried.
import { readFileSync } from "node:fs";
const [beatsFile, jsonFile] = process.argv.slice(2);
const rows = readFileSync(beatsFile, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const runs = (() => { const j = JSON.parse(readFileSync(jsonFile, "utf8")); return Array.isArray(j) ? j : j.runs || [j]; })();
const K = { low: { wpm: 280, choice: 2, walk: 8, fight: 1.0 }, mid: { wpm: 230, choice: 4, walk: 15, fight: 1.3 }, high: { wpm: 180, choice: 8, walk: 25, fight: 1.8 } };
const words = (t) => (String(t || "").match(/\S+/g) || []).length;
const out = {};
for (const r of runs) {
  const b = r.build.split(" ")[0];
  for (const a of r.acts) {
    const beats = rows.filter((x) => x.build === b && x.act === a.act);
    let w = 0, moves = 0, last = null; for (const x of beats) { w += words(x.text); if (last && x.place !== last) moves++; last = x.place; }
    const inAct = (f) => f.act === a.act || f.act == null, innerSecs = (r.inner || []).filter(inAct).reduce((s, f) => s + (f.secs || 0), 0);
    const fightSecs = (r.fights || []).filter(inAct).reduce((s, f) => s + (f.secs || 0), 0) + innerSecs;
    const e = (k) => w / K[k].wpm + (a.choices * K[k].choice + moves * K[k].walk + fightSecs * K[k].fight) / 60;
    (out[b] ||= {})[a.act] = { words: w, beats: beats.length, choices: a.choices, moves, fightSecs: Math.round(fightSecs), innerSecs: Math.round(innerSecs), low: e("low"), mid: e("mid"), high: e("high") };
  }
}
const m = (x) => `${Math.round(x)}`;
for (const [b, acts] of Object.entries(out)) {
  const tot = { low: 0, mid: 0, high: 0 };
  for (const [a, v] of Object.entries(acts)) { tot.low += v.low; tot.mid += v.mid; tot.high += v.high; console.log(`${b.padEnd(8)} act ${a}: ${m(v.mid)} min (${m(v.low)} to ${m(v.high)}); ${v.words} words in ${v.beats} beats, ${v.choices} choices, ${v.moves} walks, ${v.fightSecs} s of fighting (${v.innerSecs} s in the inner arena)`); }
  console.log(`${b.padEnd(8)} whole game: ${m(tot.mid)} min (${m(tot.low)} to ${m(tot.high)}), about ${(tot.mid / 60).toFixed(1)} h`);
}
