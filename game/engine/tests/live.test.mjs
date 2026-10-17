import { test } from "node:test";
import assert from "node:assert/strict";
import { testSources } from "./helpers.mjs";
import { createGame, loadContent } from "../game.mjs";
import { createLoop } from "../core/hooks.mjs";

// A talk at a menu, an event due at 23:05, a speaker with live lines, a node with a walk: reaction.
const LIVE = { file: "live.lwd", text: [
  "@char t.live", "name: Test live", "speaker: LIVELY", "walkaway: \"Test: suit yourself.\"", "interrupted: \"Test: later.\"", "fightstart: \"Test: now you've done it.\"", "",
  "@event t.live.ev", "at: 23:05", "nar: Test: a shout from the quay.", "",
  "@node t.live.talk", "speaker: LIVELY", "line: LIVELY: Test: well?", "set: t.live.once", "opt: \"Test: ask.\" -> t.live.ask", "opt: \"Test: go.\" -> t.live.ask", "",
  "@node t.live.ask", "line: LIVELY: Test: asked.", "exit: walk", "",
  "@node t.live.react", "speaker: LIVELY", "line: LIVELY: Test: a menu with a walk reaction.", "walk: t.live.gone", "opt: \"Test: stay.\" -> t.live.ask", "",
  "@node t.live.gone", "nar: Test: Lively shrugs and turns back to the water.", "exit: walk", "",
].join("\n") };
const live = () => { const C = loadContent([...testSources(), LIVE]); assert.ok(C.ok, JSON.stringify(C.errors.filter((e) => e.level !== "warn").slice(0, 3))); return createGame({ content: C, seed: 7 }); };
const texts = (b) => b.lines.map((l) => l.text);

test("a due event cuts into an open menu at once, then play returns to the same menu", () => {
  const G = live(), t = G.talk("t.live.talk");
  assert.equal(t.interrupt(), null, "nothing due yet");
  G.advance(6);
  const b = t.interrupt();
  assert.ok(b, "the event cut in");
  assert.deepEqual(texts(b).slice(0, 2), ["Test: later.", "Test: a shout from the quay."], "the speaker's interrupted line, then the event");
  assert.deepEqual(b.options.map((o) => o.label), ["Test: ask.", "Test: go."], "back at the same menu");
  assert.ok(!texts(b).includes("Test: well?"), "the node's lines are not said again");
  assert.equal(t.interrupt(), null, "the event fires once");
});

test("walking off: the speaker's walkaway line closes the talk; a node's walk: reaction plays instead", () => {
  const G = live(), seen = []; G.on("talk.walkaway", (e) => seen.push(e.node));
  const a = G.talk("t.live.talk").walkAway();
  assert.ok(a.done && a.walked); assert.deepEqual(texts(a), ["Test: suit yourself."]); assert.deepEqual(seen, ["t.live.talk"]);
  assert.equal(G.activeTalk, null, "the talk is over");
  const b = G.talk("t.live.react").walkAway();
  assert.ok(b.done); assert.deepEqual(texts(b), ["Test: Lively shrugs and turns back to the water."]);
});

test("a speaker with no live lines says nothing extra when Lamb walks off", () => {
  const G = live(), b = G.talk("t.speaker.hub").walkAway();
  assert.ok(b.done); assert.deepEqual(b.lines, []);
});

test("the world clock runs in real time at clockRate seconds a game minute", () => {
  const G = live(), L = createLoop(G), c0 = G.clock();
  L.clockRate = 8;
  for (let i = 0; i < 60 * 24; i++) L.step(); // 24 real seconds
  assert.equal(G.clock() - c0, 3);
  L.clockRate = 0; for (let i = 0; i < 600; i++) L.step();
  assert.equal(G.clock() - c0, 3, "stepped mode: the world stands");
});

test("an area's passive voice lines load with their skill, dc, spot and reach", () => {
  const extra = { file: "voice.lwd", text: ["@area t.vo", "name: Test voice area", "place: t.vo", "spawn: 0 0 0", "voice: ledger 3 \"Test: the numbers on the slate are wrong.\" {at: 1 0 2, r: 3}", ""].join("\n") };
  const C = loadContent([...testSources(), extra]); assert.ok(C.ok, JSON.stringify(C.errors.slice(0, 3)));
  const v = C.map.areas["t.vo"].voices[0];
  assert.deepEqual({ skill: v.skill, dc: v.dc, at: v.at, r: v.r, once: v.once }, { skill: "ledger", dc: 3, at: [1, 0, 2], r: 3, once: true });
  assert.equal(v.text, "Test: the numbers on the slate are wrong.");
});
