import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadContent, createGame } from "../game.mjs";
import { toMin } from "../core/expr.mjs";
import { crowdCover } from "../world/stealth.mjs";
import { ROOT, testSources } from "./helpers.mjs";
import { texts, pick } from "./helpers.mjs";

const dayGame = () => createGame({ content: loadContent([{ file: "day.lwd", text: readFileSync(join(ROOT, "test-content", "day.lwd"), "utf8") }]) });

test("a day book reads its times on a daytime clock: 13:00 comes after 09:00", () => {
  const G = dayGame();
  assert.equal(G.clock(), 9 * 60);
  const t = G.start();
  assert.deepEqual(texts(t.beat).slice(0, 2), ["Test: morning in the market.", "Test: it is day."]);
  pick(t, "Wait until the afternoon.");
  assert.equal(G.clock(), 13 * 60);
  assert.ok(texts(t.beat).includes("Test: afternoon in the market."));
  loadContent(testSources());
  assert.ok(toMin("05:00") > toMin("23:00"), "loading a night book restores the night clock");
});

test("daylight through the hub: places light up, sodium becomes a small share, indoors less", () => {
  const G = dayGame();
  assert.equal(G.env.term("daylight"), 1);
  assert.equal(G.env.term("light", "d.market"), 1);
  assert.ok(G.env.term("sodium", "d.market") < 0.1, "colour reads in the sun");
  assert.ok(Math.abs(G.env.term("light", "d.shop") - (1 - 0.7 * 0.65)) < 1e-9, "day-light 0.35 under shelter");
  G.advance(toMin("20:00") - G.clock());
  assert.equal(G.env.term("daylight"), 0); assert.equal(G.env.term("day"), false);
  assert.equal(G.env.term("light", "d.market"), 0.1, "night again: the lamps only");
});

test("schedules and crowds by day; daylight makes Lamb easy to see", () => {
  const G = dayGame(); G.start();
  assert.equal(G.people.where("d.beadle"), "d.market");
  assert.equal(crowdCover(G, { place: "d.market" }), 0.8);
  assert.equal(G.scope.get("seen"), true, "full sun beats a crowd");
  G.advance(toMin("13:30") - G.clock());
  assert.equal(G.people.where("d.beadle"), "d.shop");
  assert.equal(crowdCover(G, { place: "d.market" }), 0, "the market has emptied");
  const t = G.talk("d.shop");
  assert.ok(texts(t.beat).includes("Test: you again."));
});

test("the term phase: dawn, day, dusk, dark from the rules' times", () => {
  const G = dayGame();
  assert.equal(G.scope.get("phase"), "dawn", "09:00 is before day at 09:30");
  G.advance(60); assert.equal(G.scope.get("phase"), "day");
  G.advance(toMin("16:00") - G.clock()); assert.equal(G.scope.get("phase"), "dusk");
  G.advance(toMin("22:00") - G.clock()); assert.equal(G.scope.get("phase"), "dark");
});
