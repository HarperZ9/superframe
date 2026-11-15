#!/usr/bin/env node
// A tagged .lwd scene to the voice track's script (design/VOICE-BIBLE.md section 7): every spoken line
// in order, with its speaker, kind, merged direction, segments (text and cues), the renderer's
// deltas and the portrait cue. The engine's own parser reads the tags, so what the renderer hears is
// what the game will hand the voice track and the portrait.
//   node tools/voice/script.mjs design/voice/keel-steps.lwd > out.json
// Options become the line Lamb says. Lines with a {dc} gate are kept (the prototype plays the route
// where every passive in the scene succeeds) and marked passive.
import { readFileSync } from "node:fs";
import { parseRecords, parseStep } from "../../game/engine/dialogue/parse.mjs";
import { splitDirected, mergeDirection, portraitCue, renderParams } from "../../game/engine/dialogue/direction.mjs";

const file = process.argv[2], profiles = JSON.parse(readFileSync(new URL("../../design/voice/profiles.json", import.meta.url), "utf8"));
const { recs } = parseRecords(readFileSync(file, "utf8"), file), out = [];
for (const r of recs) {
  if (r.kind !== "node") continue;
  const dirs = {}; let speaker = "";
  for (const kv of r.kv) {
    const s = parseStep(kv.key, kv.value, { file, line: kv.line });
    if (s.kind === "speaker") speaker = s.value;
    if (s.kind === "dir") dirs[s.who] = s.dir;
    if (!["line", "inst", "voice", "nar"].includes(s.kind)) continue;
    const kind = s.kind === "nar" ? "nar" : s.kind === "voice" ? "voice" : s.kind === "inst" ? "inst" : "line";
    const who = kind === "nar" ? "NARRATOR" : kind === "voice" ? s.skill : (s.who || speaker);
    const raw = kind === "nar" ? kv.value.replace(/\s*\{[^{}]*\}\s*$/, "") : kv.value.replace(/\s*\{[^{}]*\}\s*$/, "").slice(kv.value.indexOf(": ") + 2);
    const d = splitDirected(raw), dir = mergeDirection(dirs[who], d.dir);
    const prof = (profiles.speakers[who] || {}).face || {};
    out.push({ node: r.id, line: kv.line, kind, who, text: d.text, dir, spoken: d.spoken, passive: !!(s.dc != null || s.below != null), render: renderParams(dir), portrait: kind === "line" ? portraitCue(dir, prof) : null });
  }
}
console.log(JSON.stringify({ file, lines: out }, null, 1));
