// Fights on painted plates (sim/plate.mjs): the ground comes from the plate's own geometry, walls
// stop bodies and sight, and an encounter played there reaches an outcome.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { loadPlateArena } from "../data/plates.mjs";
import { createPilot } from "../tools/pilot.mjs";
import { HERE, ARENA_LWD } from "./helpers.mjs";

const CONTENT = join(HERE, "..", "..", "..", "..", "content");
const fights = () => [{ file: "arena.lwd", text: ARENA_LWD }, { file: "combat.lwd", text: readFileSync(join(CONTENT, "act1", "combat.lwd"), "utf8") }, { file: "encounters1.lwd", text: readFileSync(join(CONTENT, "act1", "encounters1.lwd"), "utf8") }];

for (const [plate, area, enc] of [["quay", "quay", "e.wardens"], ["brine", "brine", "e.brawl"], ["weigh", "weigh", "e.afterdark"]]) {
  test(`${enc} on the ${plate} plate: walkable spawns, walls hold, an outcome`, { timeout: 120000 }, async () => {
    const A = await loadPlateArena(CONTENT, plate);
    assert.ok(A.grid.cells.some(Boolean), "the plate has walkable ground");
    const G = createGame({ sources: fights(), seed: 5 }), C = installCombat(G);
    G.state.place = { quay: "quay", brine: "brine", weigh: "weigh_in" }[plate];
    C.usePlate(area, A);
    const W = C.start(enc), pilot = createPilot({ style: "fighter" });
    for (const F of W.fighters) assert.ok(!W.field.solid(F.x, F.z), `${F.id} starts on walkable ground`);
    let inWall = 0;
    for (let i = 0; i < 60 * 125 && !W.result; i++) { C.step(pilot(W)); for (const F of W.fighters) if (!F.out && W.field.solid(F.x, F.z)) inWall++; }
    assert.ok(W.result, "the fight ended");
    assert.equal(inWall, 0, "no body ever stood inside solid ground");
  });
}

test("solid ground blocks sight for both sides", async () => {
  const A = await loadPlateArena(CONTENT, "weigh");
  const { createField } = await import("../sim/field.mjs");
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD }], seed: 5 });
  const f = createField({ G, arena: A });
  const { w, h, cells } = A.grid, c = A.cell, [ox, oz] = A.origin;
  // find a walkable cell and a solid cell directly beyond it, then a walkable cell past that
  let found = false;
  for (let r = 0; r < h && !found; r++) for (let x = 0; x + 4 < w && !found; x++) {
    if (cells[r * w + x] && !cells[r * w + x + 2] && cells[r * w + x + 4]) {
      found = true;
      assert.equal(f.lineClear(ox + (x + 0.5) * c, oz + (r + 0.5) * c, ox + (x + 4.5) * c, oz + (r + 0.5) * c), false);
    }
  }
  assert.ok(found, "the plate has a wall between two walkable cells");
});
