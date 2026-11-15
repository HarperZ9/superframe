#!/usr/bin/env node
// The direction lint (design/VOICE-BIBLE.md section 5.6). Reads .lwd files directly, without loading
// the act, and checks every performance direction a writer has added:
//   errors   a [block] or {dir:} that does not parse (unknown word, two emotions, a bad pace), an
//            unknown <cue>, unpaired *stress*, whisper at intensity 3, an inner voice told to shout,
//            [over] on the first spoken line of a node (nothing to speak over)
//   warnings a <cut> with no spoken line after it in the node; more than four cues in one line; a
//            speaker with no voice profile (design/voice/profiles.json); a line that breaks what its
//            speaker never says (profile "never" rules, quoted speech ignored)
//   summary  spoken lines, how many carry direction, per speaker
//   node game/engine/tools/dirlint.mjs [file.lwd | dir ...] [--json] [--never-off] [--quiet]
// Default paths: content/act1, act2, act3 and design/voice. Exit 1 on any error; warnings never fail.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRecords, parseStep } from "../dialogue/parse.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "..", "..", "..");
const SPOKEN = new Set(["line", "inst", "voice", "nar"]);

export function loadProfiles(path = join(ROOT, "design", "voice", "profiles.json")) {
  if (!existsSync(path)) return null;
  const P = JSON.parse(readFileSync(path, "utf8"));
  const never = {};
  for (const [who, p] of Object.entries(P.speakers || {})) never[who] = (p.never || []).map((r) => ({ re: new RegExp(r.re, r.case === false ? "i" : ""), msg: r.msg }));
  const slurs = ((P.slurs || {}).words || []).map((w) => new RegExp(`\\b${w.replace(/[-]/g, "[- ]?")}\\b`, "i"));
  return { P, never, slurs, readback: P.readback || null, speakers: new Set(Object.keys(P.speakers || {})), skills: new Set([...Object.keys((P.voices || {}).skills || {}), ...Object.keys(P.instruments || {}).map((k) => k.replace(/^THE /, "").toLowerCase())]), instruments: new Set(Object.keys(P.instruments || {}).filter((k) => k !== "about").flatMap((k) => [k, k.replace(/^THE /, "")])) };
}

const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ").trim();
// The player's choices: option id -> label, from opt, claim and check lines with {id: ...}
export function playerChoices(text, into = new Map()) {
  for (const r of parseRecords(text).recs) for (const kv of r.kv) {
    if (!["opt", "claim", "check"].includes(kv.key)) continue;
    try { const s = parseStep(kv.key, kv.value, {}); if (s.attrs && s.attrs.id) into.set(String(s.attrs.id), s.label); } catch { /* the validator reports it */ }
  }
  return into;
}

// quoted speech is someone else's words: Keel quoting the Shelf's "I saw a light" is not Keel saying I
const unquoted = (t) => String(t).replace(/"[^"]*"/g, " ").replace(/\s+/g, " ").trim();

export function lintText(text, file, { profiles = loadProfiles(), never = true, choices = playerChoices(text) } = {}) {
  const quotedOnce = {}, issues = [], stats = { spoken: 0, directed: 0, cues: 0, bySpeaker: {} };
  const add = (level, line, msg, node) => issues.push({ level, file, line, node, msg });
  const { recs, errors } = parseRecords(text, file);
  for (const e of errors) add("error", e.line, e.msg, "");
  for (const r of recs) {
    if (r.kind !== "node" && r.kind !== "event") continue;
    let speaker = "", spokeYet = false;
    const steps = [];
    for (const kv of r.kv) { try { steps.push(parseStep(kv.key, kv.value, { file, line: kv.line })); } catch { /* the main validator reports syntax */ } }
    steps.forEach((s, i) => {
      const raw = (r.kv.find((kv) => kv.line === s.line) || {}).value || "";
      if (s.kind === "speaker") speaker = s.value;
      if (s.dirErrors) for (const m of s.dirErrors) add("error", s.line, m, r.id);
      if (s.kind === "dir" && profiles && s.who && !profiles.speakers.has(s.who)) add("warn", s.line, `dir: for ${s.who}, who has no voice profile`, r.id);
      if (!SPOKEN.has(s.kind)) return;
      const who = s.kind === "nar" ? "NARRATOR" : s.kind === "voice" ? String(s.skill).toUpperCase() : (s.who || speaker || "?");
      const st = (stats.bySpeaker[who] ||= { spoken: 0, directed: 0 });
      stats.spoken++; st.spoken++;
      if (s.dir || s.cues) { stats.directed++; st.directed++; }
      stats.cues += (s.cues || []).length;
      const d = s.dir || {};
      if (d.over && !spokeYet) add("error", s.line, "[over] on the first spoken line of the node: there is nothing to speak over", r.id);
      if (s.kind === "voice" && d.vol === "shout") add("error", s.line, "an inner voice never shouts; use intensity 3 (VOICE-BIBLE 4.3)", r.id);
      if ((s.cues || []).length > 4) add("warn", s.line, `${s.cues.length} cues in one line; split the line or trust the actor`, r.id);
      if ((s.cues || []).some((c) => c.cue === "cut") && !steps.slice(i + 1).some((x) => SPOKEN.has(x.kind) && x.kind !== "nar")) add("warn", s.line, "<cut> with no spoken line after it in this node", r.id);
      if (profiles && s.kind === "line" && who !== "?" && !profiles.speakers.has(who) && !(profiles.warned ||= new Set()).has(who)) { profiles.warned.add(who); add("warn", s.line, `speaker ${who} has no voice profile (first line; the summary counts the rest)`, r.id); }
      if (profiles && s.kind === "voice" && !profiles.skills.has(s.skill)) add("warn", s.line, `voice ${s.skill} has no voice profile`, r.id);
      // the read-back's flat voice (VOICE-BIBLE 11.4): flat or no emotion, no delivery, no flags, no stress, only beat and pause
      if (profiles && profiles.readback && who === profiles.readback.speaker) {
        const bad = [d.emo && d.emo !== "flat" && `emotion ${d.emo}`, d.vol && `delivery ${d.vol}`, ...["lie", "aside", "over", "cut", "held"].filter((f) => d[f]),
          ...(s.cues || []).filter((c) => !profiles.readback.allowed_cues.includes(c.cue)).map((c) => `<${c.cue}>`), /\*[^*]+\*/.test(raw) && "*stress*"].filter(Boolean);
        if (bad.length) add("error", s.line, `the read-back reads flat: ${bad.join(", ")}`, r.id);
      }
      // the slur rule in voice (VOICE-BIBLE 11.5, lead's ruling 2026-10-21 in 11.8): the narrator never says
      // one; the read-back re-reads one only inside a quote of a line the player chose ({said: option id}),
      // once, unstressed; an NPC's slur is cited by speaker and scene, never re-read
      if (profiles && profiles.slurs.length) {
        const said = s.kind === "nar" ? s.value : s.text, own = unquoted(said), isSlur = (t) => profiles.slurs.some((re) => re.test(t));
        const rb = profiles.readback && who === profiles.readback.speaker;
        if (isSlur(said) && s.kind === "nar" && isSlur(own)) add("error", s.line, "a slur in the narrator's own voice; it belongs to the character who said it", r.id);
        if (isSlur(said) && rb) {
          const src = s.attrs && s.attrs.said, quotes = [...said.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
          const count = profiles.slurs.reduce((n, re) => n + (said.match(new RegExp(re.source, "gi")) || []).length, 0);
          if (isSlur(own)) add("error", s.line, "a slur in the read-back's own voice; it may only quote the player's words", r.id);
          if (!src) add("error", s.line, "the read-back re-reads a slur only from a line the player chose: add {said: <option id>}; an NPC's slur is cited by speaker and scene, not re-read", r.id);
          else if (choices && !choices.has(String(src))) add("error", s.line, `{said: ${src}} points to no player choice (no option with {id: ${src}})`, r.id);
          else if (choices) { const label = norm(choices.get(String(src))); for (const q of quotes.filter(isSlur)) if (!label.includes(norm(q))) add("error", s.line, `the quote is not the words of the player's choice ${src}`, r.id); }
          if (count > 1) add("error", s.line, "the read-back says a slur once, never repeated", r.id);
          if (src) { const seen = (quotedOnce[r.id] ||= new Set()); if (seen.has(String(src))) add("error", s.line, `the read-back has already re-read the slur from ${src} in this node`, r.id); seen.add(String(src)); }
        }
        if (isSlur(said) && [...raw.matchAll(/\*([^*]+)\*/g)].some((m) => isSlur(m[1]))) add(rb ? "error" : "warn", s.line, "a slur under *stress*: say it as the character says the rest of the line, not as a punchline", r.id);
      }
      if (never && profiles && s.kind === "line") for (const rule of profiles.never[who] || []) if (rule.re.test(unquoted(s.text))) add("warn", s.line, `${rule.msg}: "${s.text.slice(0, 70)}"`, r.id);
      spokeYet = true;
    });
  }
  return { issues, stats };
}

function walk(p, out = []) {
  if (!existsSync(p)) return out;
  if (statSync(p).isDirectory()) { for (const n of readdirSync(p)) if (!n.startsWith(".")) walk(join(p, n), out); }   // .orig* and .pre-* are backups
  else if (p.endsWith(".lwd")) out.push(p);
  return out;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/dirlint.mjs");
if (isMain) {
  const argv = process.argv.slice(2), paths = argv.filter((a) => !a.startsWith("--"));
  const roots = paths.length ? paths : ["content/quota", "content/act1", "content/act2", "content/act3", "design/voice"].map((p) => join(ROOT, p));
  const files = roots.flatMap((r) => walk(resolve(r))), profiles = loadProfiles(), choices = new Map();
  for (const f of files) playerChoices(readFileSync(f, "utf8"), choices);   // a {said:} may point into another file
  const all = [], tot = { spoken: 0, directed: 0, cues: 0, bySpeaker: {} };
  for (const f of files) {
    const { issues, stats } = lintText(readFileSync(f, "utf8"), f.replace(/\\/g, "/").replace(ROOT.replace(/\\/g, "/") + "/", ""), { profiles, choices, never: !argv.includes("--never-off") });
    all.push(...issues); tot.spoken += stats.spoken; tot.directed += stats.directed; tot.cues += stats.cues;
    for (const [k, v] of Object.entries(stats.bySpeaker)) { const t = (tot.bySpeaker[k] ||= { spoken: 0, directed: 0 }); t.spoken += v.spoken; t.directed += v.directed; }
  }
  const errs = all.filter((i) => i.level === "error"), warns = all.filter((i) => i.level === "warn");
  if (argv.includes("--json")) console.log(JSON.stringify({ files: files.length, errors: errs.length, warnings: warns.length, issues: all, stats: tot }, null, 1));
  else {
    for (const i of argv.includes("--quiet") ? errs : all) console.log(`${i.level.toUpperCase()} ${i.file}:${i.line} [${i.node}] ${i.msg}`);
    const missing = Object.entries(tot.bySpeaker).filter(([k]) => profiles && !profiles.speakers.has(k) && !profiles.skills.has(k.toLowerCase()) && !profiles.instruments.has(k)).map(([k, v]) => `${k} ${v.spoken}`);
    console.log(`dirlint: ${files.length} files, ${tot.spoken} spoken lines, ${tot.directed} directed (${tot.spoken ? ((100 * tot.directed) / tot.spoken).toFixed(1) : 0}%), ${tot.cues} cues; ${errs.length} errors, ${warns.length} warnings`);
    if (missing.length) console.log(`speakers with no profile (lines): ${missing.slice(0, 40).join(", ")}${missing.length > 40 ? " ..." : ""}`);
  }
  process.exit(errs.length ? 1 : 0);
}
