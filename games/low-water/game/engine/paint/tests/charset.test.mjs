// Every character the game can show sets as a glyph (coordinator, 2026-10-21: "? falling ?0.53 m" in the
// clock panel). The strings come from the UI's source (string and template literals in game/engine/ui and
// the engine's own modules) and from the content (every .lwd file): each character must map to itself or
// a defined substitute, never to "?" unless it is "?".
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { glyphOf, STANDIN } from "../glyph/charset.mjs";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..", "..", "..", "..");
function files(dir, ext, out = []) { for (const f of readdirSync(dir)) { const p = join(dir, f); const st = statSync(p); if (st.isDirectory()) { if (!/node_modules|out|capture|\.pre-/.test(f)) files(p, ext, out); } else if (ext.some((e) => p.endsWith(e))) out.push(p); } return out; }

test("every character the UI and the content can show has a glyph or a defined substitute", () => {
  const chars = new Set();
  for (const f of files(join(root, "game", "engine"), [".mjs"])) { const s = readFileSync(f, "utf8"); for (const m of s.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) for (const c of m[2]) chars.add(c); }
  for (const f of files(join(root, "content"), [".lwd"])) for (const c of readFileSync(f, "utf8")) chars.add(c);
  const stood = [];
  for (const c of chars) { if (c < " " && c !== "\t") continue; const g = glyphOf(c); assert.notEqual(g === "?" && c !== "?", true, `"${c}" (U+${c.codePointAt(0).toString(16)}) sets as "?"`); if (g === STANDIN && c !== STANDIN) stood.push(c); }
  // the stand-in is a last resort: report what uses it so it can be given a proper substitute
  assert.ok(stood.length < 40, `stand-in used for ${stood.length} characters: ${stood.slice(0, 40).join("")}`);
});

test("the clock panel's arrows and minus set as themselves", () => {
  for (const c of "↓↑↔−") assert.equal(glyphOf(c), c);
});
