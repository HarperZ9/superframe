#!/usr/bin/env node
// Pacing from the scripted runs: a beat chart per act and build, an intensity curve in real minutes,
// and the flat stretches and cliffs it shows (game director, 2026-10-21).
//   node tools/playthrough.mjs --build all --beatlog out/beats.jsonl --json out/time.json
//   node tools/pacing.mjs out/beats.jsonl [--build fist] [--chart] [--json out/pacing.json]
// Real time per beat uses tools/playtime.mjs's middle model: words at 230 a minute, 4 s a choice,
// 15 s a walk between places, fights at 1.3 times their simulated seconds.
// Intensity (0 to 5) is a proxy read from the beat log, not a measure of what a player feels:
//   1    talk;  0.5 a short menu or hub beat (navigation)
//   +1   a check is on offer (something can fail);  +0.5 two or more inner voices speak
//   +0 to 1.5  danger words in the text (per 100 words);  +1.5 a reveal or a reckoning (node id)
//   +1   a world event (ev.*);  5  a fight, run or sneak row
// A flat stretch is 10 real minutes or more whose 2-minute windows all sit under 1.8. A cliff is a
// rise of 2.5 or more between neighbouring windows with no window between 2 and 3 before it, or 8
// minutes or more at 3.2 or above with no window under 2 (no breath).
// Does not prove: that a player is bored or tense. Words, checks and fights stand in for pressure; a
// quiet scene can be the best one in the act. Use it to find where to look, then read the scene.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const argv = MAIN ? process.argv.slice(2) : [], opt = {}; const files = [];
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; else files.push(argv[i]); }
const rows = !MAIN ? [] : readFileSync(files[0] || "out/beats.jsonl", "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));

const DANGER = /\b(blood|knife|knives|crowbar|hammer|drown\w*|scream\w*|fire|surge|gale|fall\w*|struck|strike|hit|blow|blows|wreck\w*|collier|shout\w*|grab\w*|run|running|dark|blackout|break\w*|broke|smash\w*|fight\w*|cold|frost|water at|rising|flood\w*|lie|lied|liar|gun|dead|death|die|kill\w*|hang\w*|rope|trial)\b/gi;
const REVEAL = /(admit|confess|reveal|truth|told|ledger|letter|typist|hester\.|verdict|trial|founders|wages|door\.open|lowroom|low_room|eye\.|gallery|muster|surge|vote|cause|tube\.choose|crake\.case|keel\.question)/i;
const words = (t) => (String(t || "").match(/\S+/g) || []).length;
const hhmm = (c) => `${String(Math.floor(c / 60) % 24).padStart(2, "0")}:${String(Math.floor(c % 60)).padStart(2, "0")}`;

export function intensity(r) {
  if (r.kind === "fight" || r.kind === "run" || r.kind === "sneak") return 5;
  const w = words(r.text);
  let x = (r.opts > 0 && w < 40) || /\.(hub|menu)$/.test(r.node) && w < 80 ? 0.5 : 1;
  if (r.checks > 0) x += 1;
  if ((r.voices || 0) >= 2) x += 0.5;
  const d = (String(r.text).match(DANGER) || []).length;
  x += Math.min(1.5, w ? (d / w) * 100 * 0.3 : 0);
  if (REVEAL.test(r.node)) x += 1.5;
  if (/(^|\.)ev\d?\./.test(r.node) || /^ev/.test(r.node)) x += 1;
  return Math.min(5, x);
}
export function minutes(r, prev) {
  if (r.kind === "fight") return ((r.secs || 0) * 1.3) / 60;
  if (r.kind === "run" || r.kind === "sneak") return 0.75;
  return words(r.text) / 230 + (r.opts > 0 ? 4 / 60 : 0) + (prev && prev.place !== r.place ? 15 / 60 : 0);
}

const out = {};
const builds = [...new Set(rows.map((r) => r.build))].filter((b) => !opt.build || b === opt.build);
for (const b of builds) {
  for (const act of [1, 2, 3]) {
    const seq = rows.filter((r) => r.build === b && r.act === act);
    if (!seq.length) continue;
    let t = 0, prev = null; const beats = [];
    for (const r of seq) { const m = minutes(r, prev); beats.push({ t, m, i: intensity(r), node: r.node, place: r.place, clock: r.clock, kind: r.kind || "beat" }); t += m; prev = r; }
    // 2-minute windows, time-weighted
    const W = 2, n = Math.ceil(t / W), win = Array.from({ length: n }, () => ({ s: 0, w: 0 }));
    for (const x of beats) { let a = x.t, e = x.t + Math.max(x.m, 0.01); while (a < e) { const k = Math.min(n - 1, Math.floor(a / W)), cut = Math.min(e, (k + 1) * W); win[k].s += x.i * (cut - a); win[k].w += cut - a; a = cut; } }
    const curve = win.map((x) => (x.w ? x.s / x.w : 0));
    // scenes: contiguous beats in one place
    const scenes = []; for (const x of beats) { const s = scenes[scenes.length - 1]; if (s && s.place === x.place) { s.m += x.m; s.is.push([x.i, x.m]); s.end = x.clock; if (x.kind !== "beat") s.events.push(x.node); } else scenes.push({ place: x.place, t: x.t, m: x.m, clock: x.clock, end: x.clock, first: x.node, is: [[x.i, x.m]], events: x.kind !== "beat" ? [x.node] : [] }); }
    for (const s of scenes) { const w = s.is.reduce((a, [, m]) => a + m, 0) || 1; s.mean = s.is.reduce((a, [i, m]) => a + i * m, 0) / w; delete s.is; }
    // flats and cliffs
    const flats = []; let st = null;
    curve.forEach((v, k) => { if (v < 1.8) { if (st == null) st = k; } else { if (st != null && (k - st) * W >= 10) flats.push([st * W, k * W]); st = null; } });
    if (st != null && (n - st) * W >= 10) flats.push([st * W, n * W]);
    const cliffs = [];
    for (let k = 1; k < n; k++) if (curve[k] - curve[k - 1] >= 2.5) cliffs.push({ at: k * W, kind: "rise", from: +curve[k - 1].toFixed(1), to: +curve[k].toFixed(1) });
    let hs = null; curve.forEach((v, k) => { if (v >= 3.2) { if (hs == null) hs = k; } else if (v < 2) { if (hs != null && (k - hs) * W >= 8) cliffs.push({ at: hs * W, kind: "no breath", minutes: (k - hs) * W }); hs = null; } });
    const at = (m) => { const x = beats.find((y) => y.t + y.m >= m) || beats[beats.length - 1]; return `${hhmm(x.clock)} ${x.place} (${x.node})`; };
    (out[b] ||= {})[act] = { minutes: +t.toFixed(1), mean: +(curve.reduce((a, v) => a + v, 0) / n).toFixed(2), curve: curve.map((v) => +v.toFixed(2)), scenes, flats: flats.map(([a, e]) => ({ from: a, to: e, where: at(a) })), cliffs: cliffs.map((c) => ({ ...c, where: at(c.at) })) };
  }
}

const spark = (c) => c.map((v) => " .:-=+*#%@"[Math.max(0, Math.min(9, Math.round(v * 1.8)))]).join("");
for (const [b, acts] of Object.entries(out)) for (const [a, v] of Object.entries(acts)) {
  console.log(`${b.padEnd(8)} act ${a}: ${v.minutes} min, mean intensity ${v.mean}; flat stretches ${v.flats.length}, cliffs ${v.cliffs.length}`);
  console.log(`  curve (2-minute windows, 0 to 5): |${spark(v.curve)}|`);
  for (const f of v.flats) console.log(`  FLAT  ${Math.round(f.from)} to ${Math.round(f.to)} min (${Math.round(f.to - f.from)} min) from ${f.where}`);
  for (const c of v.cliffs) console.log(`  CLIFF ${Math.round(c.at)} min, ${c.kind}${c.minutes ? ` for ${c.minutes} min` : ` ${c.from} to ${c.to}`}, at ${c.where}`);
  if (opt.chart) for (const s of v.scenes.filter((s) => s.m >= 1.5 || s.events.length)) console.log(`    ${String(Math.round(s.t)).padStart(4)} min  ${hhmm(s.clock)}-${hhmm(s.end)}  ${s.place.padEnd(16)} ${s.m.toFixed(1).padStart(5)} min  i ${s.mean.toFixed(1)}  ${s.first}${s.events.length ? `  [${s.events.join(", ")}]` : ""}`);
}
if (opt.json) writeFileSync(opt.json, JSON.stringify(out, null, 1));
