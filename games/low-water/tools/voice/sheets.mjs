#!/usr/bin/env node
// One cast file, two tools: design/voice/quota-cast.json writes
//   design/voice-sheets/quota/<name>.json   Articulate's voice sheets (articulate-voice-sheet/1) and _project.json
//   design/voice/profiles.json              the speakers (setting "quota"), the slurs, the read-back's flat voice
// so `articulate dialogue --voices design/voice-sheets/quota` and game/engine/tools/dirlint.mjs read the same
// people. Gullet's sheets stay where they were (design/voice-sheets/*.json, marked setting gullet).
//   node tools/voice/sheets.mjs [--check]     --check: exit 1 if a written file would change
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CAST = JSON.parse(readFileSync(join(ROOT, "design/voice/quota-cast.json"), "utf8"));
const OUT = join(ROOT, "design/voice-sheets/quota"), PROF = join(ROOT, "design/voice/profiles.json");
const check = process.argv.includes("--check");
const slug = (k) => k.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
let changed = [];
const put = (p, obj) => { const s = JSON.stringify(obj, null, 1) + "\n"; if (!existsSync(p) || readFileSync(p, "utf8") !== s) { changed.push(p); if (!check) writeFileSync(p, s); } };

export function sheetOf(key, c) {
  const s = {
    format: "articulate-voice-sheet/1", name: key, setting: "quota",
    status: "draft 2026-10-21 from design/quota/02-HOUSEHOLDS.md by the voice director; generated from design/voice/quota-cast.json, edit that file",
    role: `${c.name}: ${c.trade}`, age: c.age,
    register: { level: c.register.level, education: c.register.education, class: c.class, trade: c.trade, words: c.register.words },
    region: { name: c.people, markers: c.region.markers, idioms: c.region.idioms },
    sentence_length: { min: c.sentence_length[0], max: c.sentence_length[1] },
    never: c.never_words, never_patterns: [],
    knowledge: { knows: c.knows, unknown: c.unknown },
    trade: c.trade, wound: c.wound, lie: c.lie, fears: c.wound, hides: c.lie, tics: c.region.idioms,
  };
  // a hand-strengthened sheet keeps its changes through a regeneration: the cast entry's sheet: overrides the fields
  // derived above (register and region field by field), as Pell's does (story lead, 2026-10-23)
  for (const [k, v] of Object.entries(c.sheet || {})) s[k] = (k === "register" || k === "region") ? { ...s[k], ...v } : v;
  if (c.aliases) s.aliases = c.aliases;
  if (c.questions) s.questions = c.questions;
  if (c.contractions === false) s.contractions = false;
  if (key === "READBACK") delete s.region;   // no people, no markers: the flat voice
  return s;
}

export function profileOf(key, c) {
  return { setting: "quota", role: `${c.trade} (${c.household})`, people: c.people, age: c.age, timbre: c.timbre, pace_sps: c.pace_sps,
    wound: c.wound, lie: c.lie, tics: c.tics, never_performance: c.never, under_stress: c.stress, range: c.range,
    status: "planned", synth: c.synth, face: c.face, never: [] };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/voice/sheets.mjs")) {
  if (!check) mkdirSync(OUT, { recursive: true });
  put(join(OUT, "_project.json"), { format: "articulate-voice-project/1", setting: "quota", theme_words: CAST.theme_words, min_lines: 20,
    about: "Theme words for The Quota's theme-statement check: words a character would use to say the game's argument out loud. Generated from design/voice/quota-cast.json." });
  for (const [k, c] of Object.entries(CAST.speakers)) put(join(OUT, `${slug(k)}.json`), sheetOf(k, c));
  const P = JSON.parse(readFileSync(PROF, "utf8"));
  for (const [k, c] of Object.entries(CAST.speakers)) {
    const prev = P.speakers[k];
    if (prev && prev.setting !== "quota") throw new Error(`profiles.json: ${k} already names a ${prev.setting} speaker`);
    P.speakers[k] = { ...profileOf(k, c), ...(prev && prev.status ? { status: prev.status } : {}) };
  }
  P.peoples_quota = CAST.peoples;
  P.slurs = CAST.slurs;
  P.readback = { speaker: "READBACK", direction: "flat 1 steady", allowed_cues: ["beat", "pause"], row_gap_s: 0.6, hinge_gap_s: 1.4,
    about: "The read-back's flat voice (VOICE-BIBLE 11.4): one voice, flat, no stress, no breath, no room, no music; the dirlint holds READBACK lines to it." };
  put(PROF, P);
  console.log(`${check ? "would change" : "wrote"} ${changed.length} file(s)`);
  if (check && changed.length) { for (const p of changed) console.log("  " + p); process.exit(1); }
}
