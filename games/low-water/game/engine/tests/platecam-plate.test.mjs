import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, loadContent } from "../game.mjs";
import { testSources } from "./helpers.mjs";
import { plateAction } from "../ui/platecam.mjs";

// The Well House's fire (2026-10-24): the area stays the same record while its conditional plate line switches it to
// the burning plate (wiring/era3-areas.lwd, plate: q3_well_fire ? ...). The camera must load that plate whole; swapping
// the variant inside the plate it already shows never brought the fire on screen.
const WIRING = `
@area t.well
name: The test well house
plate: well_house
plate: well_fire ? var.fire == 1
variant: day
place: yard
spawn: 0 0 0
`;

test("the same area with a new conditional plate reloads the plate, not just the variant", () => {
  const G = createGame({ content: loadContent([...testSources(), { file: "wiring.lwd", text: WIRING }]), seed: 3 });
  const area = G.world.areas["t.well"], shown = { ready: true, loadedPlate: "well_house", shownV: "day" };
  assert.equal(plateAction({ now: area, area, ...shown }), null, "nothing changed: nothing to do");
  G.state.vars.fire = 1;
  assert.equal(area.plate, "well_fire", "the area record now names the burning plate");
  assert.equal(plateAction({ now: area, area, ...shown }), "plate", "the camera loads the burning plate");
  assert.equal(plateAction({ now: area, area, ...shown, loadedPlate: "well_fire" }), null, "once loaded, it stays");
});

test("a move to another area and a variant change keep their own actions", () => {
  const other = { plate: "yard", variant: "day" }, area = { plate: "well_house", variant: "night" };
  assert.equal(plateAction({ now: other, area, ready: true, loadedPlate: "well_house", shownV: "night" }), "place");
  assert.equal(plateAction({ now: area, area, ready: true, loadedPlate: "well_house", shownV: "day" }), "variant");
  const fire = { ...area, plate: "well_fire" };
  assert.equal(plateAction({ now: fire, area: fire, ready: false, loadedPlate: "well_house", shownV: "night" }), null, "not while a load is under way");
});
