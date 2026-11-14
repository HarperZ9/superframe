import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, loadContent } from "../game.mjs";
import { testSources } from "./helpers.mjs";

// an era's own plate of a shared place, as @area plate: x ? cond lines (The Quota's era 1 post, 2026-10-22)
const WIRING = `
@area t.post
name: The test post
plate: post
plate: post_harvest ? var.era == 1
variant: afternoon
variant: harvest ? var.era == 1
place: yard
spawn: 0 0 0
`;

test("an area's plate follows its conditions, with its variant, and falls back to its plain plate line", () => {
  const G = createGame({ content: loadContent([...testSources(), { file: "wiring.lwd", text: WIRING }]), seed: 3 });
  const area = G.world.areas["t.post"];
  assert.ok(area, "the area loads");
  assert.deepEqual([area.plate, area.variant], ["post", "afternoon"], "no era set: the shared plate");
  G.state.vars.era = 1;
  assert.deepEqual([area.plate, area.variant], ["post_harvest", "harvest"], "era 1: its own plate and variant");
  G.state.vars.era = 2;
  assert.deepEqual([area.plate, area.variant], ["post", "afternoon"], "era 2: back to the shared plate");
});

test("an area with plain plate lines only keeps a plain plate (no getter)", () => {
  const G = createGame({ content: loadContent([...testSources(), { file: "wiring.lwd", text: WIRING.replace("plate: post_harvest ? var.era == 1\n", "") }]), seed: 3 });
  const area = G.world.areas["t.post"];
  assert.equal(area.plate, "post");
  assert.equal(Object.getOwnPropertyDescriptor(area, "plate").get, undefined);
});
