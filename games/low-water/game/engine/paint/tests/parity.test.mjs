// Style parity (design/art/STYLE-PARITY.md): a scene or a UI element that exists in one style and not the
// other fails here. Each check has a control that plants the defect it looks for and must fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { FEATURES, checkFeatures, checkDoc, checkPanels, checkPlates } from "../glyph/parity.mjs";
import { PANELS } from "../glyph/ui.mjs";

const engine = fileURLToPath(new URL("../../", import.meta.url)), repo = join(engine, "..", "..");
// the painted style's panels, as ui/notify.mjs lists them for the paper layout
const paintedPanels = () => JSON.parse(/const PANELS = (\[[^\]]+\])/.exec(readFileSync(join(engine, "ui/notify.mjs"), "utf8"))[1].replace(/'/g, '"'));

test("every feature has its painted and glyph form where the table says so", () => {
  assert.deepEqual(checkFeatures(engine), []);
  // control: a feature whose glyph module is gone, and one whose export was renamed
  const planted = [["x-gone", "planted", ["ui/talk.mjs", "lineEl"], ["paint/glyph/nothere.mjs", "draw"], "both", ""], ["x-renamed", "planted", ["ui/talk.mjs", "lineElNot"], ["paint/glyph/ui.mjs", "drawUi"], "both", ""], ["x-claim", "planted", null, ["paint/glyph/ui.mjs", "drawUi"], "both", ""]];
  assert.equal(checkFeatures(engine, planted).length, 3);
});
test("the parity table lists every feature", () => {
  const doc = readFileSync(join(repo, "design/art/STYLE-PARITY.md"), "utf8");
  assert.deepEqual(checkDoc(doc), []);
  assert.equal(checkDoc(doc, [...FEATURES, ["x-undocumented"]]).length, 1, "control: an entry missing from the table fails");
});
test("every panel the painted style shows is drawn in the glyph grid", () => {
  assert.deepEqual(checkPanels(paintedPanels(), PANELS), []);
  assert.equal(checkPanels([...paintedPanels(), ".newpanel"], PANELS).length, 1, "control: a painted panel the grid does not know fails");
});
test("every plate the painted style can show, glyph can draw, and the other way round", () => {
  const dirs = [process.env.LW_CONTENT || join(repo, "content")];
  assert.deepEqual(checkPlates(dirs), []);
  // control: a plate folder with a painted variant and no geo buffers, and one with buffers and no picture
  const t = mkdtempSync(join(tmpdir(), "parity-")); for (const [n, fs] of [["painted_only", ["place.json", "night.png"]], ["geo_only", ["place.json", "geo-pos.f32", "geo-id.u8"]]]) { mkdirSync(join(t, n)); for (const f of fs) writeFileSync(join(t, n, f), "x"); }
  assert.equal(checkPlates([t]).length, 2);
});
