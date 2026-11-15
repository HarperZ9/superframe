// The Old Light's door in the eye (2026-10-21): a new Wader alone in Nan's boat fails the wrench, and the
// try shows the low corner, which opens the door; with a boatman aboard the corner is theirs to tell.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { createGame, loadContent } from "../game.mjs";
import { ROOT } from "./helpers.mjs";

test("a failed wrench at the Old Light door shows the low corner, and the knee gets Lamb in", async () => {
  const { sources } = await loadAct(join(ROOT, "..", "..", "content", "act3", "act3.lwd"), (p) => readFile(p, "utf8"));
  const G = createGame({ content: loadContent(sources), seed: 1 });
  G.create({ archetype: "p.wader", enter: false });
  (G.state.vars ||= {})["quay3.boat"] = "eye";
  G.pressure.addMeter("cold", 10); // numb hands, as a Wader is by the eye (the walk's sum was 3 against 6)
  let t = G.talk("oldlight.door");
  const labels = () => t.beat.options.filter((o) => !o.locked).map((o) => o.label);
  assert.ok(!labels().some((l) => /low corner/.test(l)), "no knee before a try");
  const w = t.beat.options.findIndex((o) => /Wrench the door/.test(o.label));
  assert.ok(t.beat.options[w].check.total < 6, `the wrench fails: ${t.beat.options[w].check.total}`);
  t.choose(w);
  for (let i = 0; i < 6 && t.node !== "oldlight.door"; i++) t.choose(0);
  assert.equal(t.node, "oldlight.door", "back at the door after the failed wrench");
  const k = t.beat.options.findIndex((o) => /low corner/.test(o.label) && !o.locked);
  assert.ok(k >= 0, `the knee is offered: ${labels().join(" | ")}`);
  t.choose(k);
  assert.ok(G.flag("oldlight.in"), "in");
});
