// The voices a fight speaks come from the story being played. A story with fights authors a line for every
// bark key, so its fights never fall back to the engine's lines (which name no place), and no line anywhere
// is marked "[placeholder]". The Quota once had no @bark records, so its granary fight spoke placeholder
// text and Lamp Quay's tide and eel-oil (found 2026-11-16 by loading the slice's book).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAct, loadBook } from "../../dialogue/book.mjs";
import { loadEncounters } from "../encounter.mjs";
import { BARK_TEXT, BARK_KEYS } from "../sim/barks.mjs";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const STORIES = { act1: "/content/act1/act1.lwd", quota: "/content/quota/slice.lwd" };
const read = (p) => readFile(join(GAME, p), "utf8");

async function barksOf(root) {
  const { sources } = await loadAct(root, read);
  const book = loadBook(sources);
  return { book, ...loadEncounters(book) };
}

test("the engine's own bark lines carry no placeholder mark", () => {
  for (const k of BARK_KEYS) {
    assert.ok(BARK_TEXT[k], `no engine line for ${k}`);
    assert.doesNotMatch(BARK_TEXT[k], /placeholder/i, k);
  }
});

for (const [story, root] of Object.entries(STORIES)) {
  test(`${story}: a story with fights authors every bark key, and none is a placeholder`, async () => {
    const { book, encounters, barks } = await barksOf(root);
    if (!Object.keys(encounters).length) return;
    const authored = new Set(Object.values(book.records.bark || {}).map((r) => (r.kv.find((e) => e.key === "key") || {}).value?.trim()));
    const missing = BARK_KEYS.filter((k) => !authored.has(k));
    assert.deepEqual(missing, [], `${story} has fights but no @bark line for ${missing.join(", ")}`);
    for (const [k, lines] of Object.entries(barks)) for (const t of lines) assert.doesNotMatch(t, /\[placeholder\]/i, `${story} ${k}: ${t}`);
  });
}

test("the Quota's fights speak no line from Lamp Quay", async () => {
  const { barks } = await barksOf(STORIES.quota);
  const lines = Object.values(barks).flat();
  for (const t of lines) assert.doesNotMatch(t, /\b(quay|tide|eel|Shelf|Gut)\b/i, t);
});
