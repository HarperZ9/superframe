import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, loadContent } from "../game.mjs";
import { testSources } from "./helpers.mjs";

// a plate area whose look follows the hour and the power, as @area variant: x ? cond lines
const WIRING = `
@area t.hall
name: The test hall
plate: hall
variant: early
variant: dark ? power.yard == "off"
variant: vote ? clock >= 00:40 & clock < 01:30
place: yard
spawn: 0 0 0
`;

test("an area's variant follows its conditions in order, and falls back to its plain line", () => {
  const G = createGame({ content: loadContent([...testSources(), { file: "wiring.lwd", text: WIRING }]), seed: 3 });
  const area = G.world.areas["t.hall"];
  assert.ok(area, "the area loads");
  const at = (hhmm) => { const [h, m] = hhmm.split(":").map(Number), t = (h < 12 ? h + 24 : h) * 60 + m; G.env.advance(t - G.clock()); return area.variant; };
  assert.equal(at("23:30"), "early");
  assert.equal(at("00:50"), "vote");
  G.env.command(["setPower", "yard", "off"]);
  assert.equal(area.variant, "dark", "the first line that holds wins");
  G.env.command(["setPower", "yard", "on"]);
  assert.equal(at("02:00"), "early");
});

test("a second game on the same content reads its own hour, not the first game's", () => {
  const C = loadContent([...testSources(), { file: "wiring.lwd", text: WIRING }]);
  const G1 = createGame({ content: C, seed: 1 }), G2 = createGame({ content: C, seed: 2 });
  const area = G2.world.areas["t.hall"];
  G2.env.advance(toVote(G2));
  assert.equal(area.variant, "vote", "the newest game decides");
  assert.ok(G1.clock() !== G2.clock());
});
function toVote(G) { return 24 * 60 + 50 - G.clock(); }
