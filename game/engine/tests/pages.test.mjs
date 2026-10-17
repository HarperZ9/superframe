import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadContent, createGame } from "../game.mjs";
import { ROOT, game, testSources } from "./helpers.mjs";

// Pages on the test content: 100 xp a page (test-content rules), one point a page.
const pages = (G, n) => G.sheet.addXp(n * +G.rs.rules["xp-per-level"]);

test("every third page is a chapter page: one compartment raise owed, spent on the player's choice", () => {
  const G = game(); G.create({ archetype: "a.clerk", enter: false });
  const ev = []; G.on("chapter", (e) => ev.push(e.owed));
  const attr = Object.keys(G.rs.attrs)[0], before = G.sheet.attrBase(attr);
  pages(G, 2); assert.equal(G.sheet.chapters(), 0);
  pages(G, 1); assert.equal(G.sheet.chapters(), 1); assert.deepEqual(ev, [1]);
  assert.equal(G.state.sheet.points, 3, "the chapter page still buys its rank");
  assert.ok(G.sheet.raiseAttr(attr));
  assert.equal(G.sheet.attrBase(attr), before + 1);
  assert.equal(G.sheet.chapters(), 0);
  assert.equal(G.sheet.raiseAttr(attr), false, "no chapter owed");
  pages(G, 6); assert.equal(G.sheet.chapters(), 2);
  assert.equal(G.sheet.raiseAttr("no.such.attr"), false);
});

test("compartments stop at chapter-attr-max (10)", () => {
  const G = game(); G.create({ archetype: "a.clerk", enter: false });
  const attr = Object.keys(G.rs.attrs)[0];
  G.state.sheet.attrs[attr] = 9; pages(G, 6);
  assert.ok(G.sheet.raiseAttr(attr)); assert.equal(G.sheet.attrBase(attr), 10);
  assert.equal(G.sheet.canRaiseAttr(attr), false); assert.equal(G.sheet.chapters(), 1, "the other chapter stays owed");
});

test("re-filing the case takes back bought ranks and chapter raises, only at a daylight page", () => {
  const G = game(); G.create({ archetype: "a.clerk", enter: false });
  const attr = Object.keys(G.rs.attrs)[0], base = G.sheet.attrBase(attr), ranks0 = { ...G.state.sheet.ranks };
  pages(G, 3);
  const sk = Object.values(G.rs.skills).find((s) => G.sheet.canRaise(s.id));
  assert.ok(sk, "a voice can take a rank"); assert.ok(G.sheet.raise(sk.id)); assert.ok(G.sheet.raiseAttr(attr));
  assert.equal(G.sheet.canRefile(), false, "night: no daylight page");
  assert.equal(G.sheet.refile(), false);
  assert.ok(G.sheet.refile({ force: true }));
  assert.deepEqual(G.state.sheet.ranks, ranks0, "archetype ranks stay, bought ones come back");
  assert.equal(G.sheet.attrBase(attr), base);
  assert.equal(G.state.sheet.points, 3); assert.equal(G.sheet.chapters(), 1);
  const D = createGame({ content: loadContent([{ file: "day.lwd", text: readFileSync(join(ROOT, "test-content", "day.lwd"), "utf8") }]) });
  assert.equal(D.sheet.canRefile(), true, "in daylight the case can be re-filed");
  loadContent(testSources()); // the night clock back for the other tests
});

test("lines carry the speaker's char id and a face; the talk names its speaker's id", () => {
  const extra = { file: "face.lwd", text: ["@node t.face", "line: SPEAKER: Test, warily. {face: wary}", "line: Test, no speaker.", "exit: walk", ""].join("\n") };
  const C = loadContent([...testSources(), extra]);
  const G = createGame({ content: C, seed: 7 }), t = G.talk("t.face"), [a, b] = t.beat.lines;
  assert.equal(a.face, "wary"); assert.equal(a.whoId, "t.speaker"); assert.equal(t.speakerId, "t.speaker");
  assert.equal(b.face, undefined);
});

test("travel from the Map: next door costs travel-minutes, lands in the district's area", () => {
  const G = game(); G.create({ archetype: "a.clerk" });
  assert.equal(G.world.district().id, "d.quay");
  assert.equal(G.world.travelTo("d.quay").why, "Lamb is here already");
  assert.ok(G.world.travelTo("d.nowhere").why);
  const c0 = G.clock(), r = G.world.travel("d.gut");
  assert.equal(r.why, null); assert.equal(r.minutes, 10);
  assert.equal(G.clock() - c0, 10);
  assert.equal(G.world.district().id, "d.gut"); assert.equal(G.state.area, "t.bar");
});
