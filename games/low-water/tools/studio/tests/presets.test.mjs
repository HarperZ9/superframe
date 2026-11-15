// Brush presets: the starting set loads with nothing saved; a saved preset comes back with the sitter and
// keeps only brush settings; a nameless preset is refused.
//   node --test tools/studio/tests/presets.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { memSink } from "./fixture.mjs";
import { PRESETS, loadPresets, savePreset } from "../core/presets.mjs";

test("a preset saved with one sitter comes back with that sitter, not another", async () => {
  const sink = memSink(), start = await loadPresets(sink, "src/ned@e2");
  assert.deepEqual(Object.keys(start), Object.keys(PRESETS), "nothing saved: the starting set");
  await savePreset(sink, "src/ned@e2", start, "ned skin", { tool: "brush", size: 9, flow: 0.4, colour: [1, 0, 0], junk: 1 });
  const back = await loadPresets(sink, "src/ned@e2"); assert.deepEqual(back["ned skin"], { tool: "brush", size: 9, flow: 0.4 });
  assert.equal((await loadPresets(sink, "src/will@e2"))["ned skin"], undefined, "control: another sitter does not get it");
  await assert.rejects(savePreset(sink, "src/ned@e2", back, " ", {}), /needs a name/);
});
