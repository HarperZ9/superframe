import { test } from "node:test";
import assert from "node:assert/strict";
import { testSources } from "./helpers.mjs";
import { createGame, loadContent } from "../game.mjs";

// The shape the director writes to (content/act1/interrog1.lwd x1.merrow), on the test content.
const SRC = { file: "ix.lwd", text: [
  "@char t.mer", "name: Test Mer", "speaker: MER", "fightstart: \"Test: now then.\"", "",
  "@interrogation x.t", "name: Test interrogation", "who: t.mer", "nerve: 6", "heat: 0", "cool: 1", "hold: 25",
  "bolt: 5 -> x.t.bolts", "swing: 8 -> e.t.guard", "break: x.t.tells", "walk: x.t.walk",
  "press: fist \"Test: collar him.\" -> x.t.collar {nerve: -3, heat: +3}",
  "press: tongue \"Test: ask what he lost.\" -> x.t.lost {nerve: -2, heat: -1}",
  "press: shadow \"Test: the prints.\" -> x.t.prints ? has(t.prints) {nerve: -4}",
  "press: any \"Test: wait.\" -> x.t.wait {nerve: -1, again}",
  "lie: l.boat \"Test: never left the boat.\" {catch: t.wet | t.prints.seen, nerve: -4, node: x.t.caught, after: 5}",
  "tell: 3 \"Test: he stops turning the pipe.\"", "",
  "@node x.t.start", "speaker: MER", "line: MER: Test: ask, then.", "do: interrogate(x.t)", "return:", "",
  ...["collar", "lost", "prints", "wait", "caught"].flatMap((k) => [`@node x.t.${k}`, "speaker: MER", `line: MER: Test reply ${k}.`, "return:", ""]),
  ...["tells", "bolts", "walk"].flatMap((k) => [`@node x.t.${k}`, `nar: Test outcome ${k}.`, "exit: walk", ""]),
].join("\n") };
const make = () => { const C = loadContent([...testSources(), SRC]); assert.ok(C.ok, JSON.stringify(C.errors.filter((e) => e.level !== "warn").slice(0, 3))); return createGame({ content: C, seed: 7 }); };
const labels = (b) => b.options.map((o) => o.label);
const texts = (b) => b.lines.map((l) => l.text);
const pick = (t, text) => t.choose(t.beat.options.findIndex((o) => o.label.includes(text)));

test("interrogate() opens a live exchange: the presses are the options, gated by their conditions, plus the lie call", () => {
  const G = make(), t = G.talk("x.t.start"), b = t.beat;
  assert.ok(b.interrogation); assert.equal(b.interrogation.nerve, 6); assert.equal(b.interrogation.face, "wary");
  assert.deepEqual(labels(b), ["Test: collar him.", "Test: ask what he lost.", "Test: wait."], "no lie said yet: no lie call");
  G.state.flags.push("t.prints");
  assert.ok(labels(pick(t, "wait")).includes("Test: the prints."), "a press appears when its condition holds");
});

test("a press plays its reply and comes back; once each unless again; heat never goes below zero", () => {
  const G = make(), t = G.talk("x.t.start");
  const b = pick(t, "ask what he lost");
  assert.ok(texts(b).includes("Test reply lost.")); assert.ok(b.interrogation, "back in the exchange");
  assert.equal(b.interrogation.nerve, 4); assert.equal(b.interrogation.heat, 0, "heat -1 clamps at 0");
  assert.ok(!labels(b).includes("Test: ask what he lost."), "used once");
  const c = pick(t, "wait"); assert.ok(labels(c).includes("Test: wait."), "again stays");
});

test("nerve at 0 breaks him; the tell is said once on the way down", () => {
  const G = make(), t = G.talk("x.t.start"), said = []; G.on("interrog.say", (l) => said.push(l.text));
  const c = texts(pick(t, "collar")); // nerve 3, heat 3
  assert.deepEqual(c.slice(0, 2), ["Test: collar him.", "Test: he stops turning the pipe."], "the tell follows Lamb's words, in the press's own lines");
  assert.deepEqual(said, [], "not said a second time on the live channel");
  pick(t, "lost"); // nerve 1
  const b = pick(t, "wait"); // nerve 0
  assert.ok(texts(b).includes("Test outcome tells.")); assert.ok(b.done); assert.equal(G.interrog.current, null);
});

test("heat at bolt sends him out; a jump past swing starts the fight, with the fightstart line first", async () => {
  const G = make(), t = G.talk("x.t.start");
  pick(t, "collar"); // heat 3
  G.interrog.current.heat = 4; assert.ok(pick(t, "wait").interrogation, "4 is under bolt (5)");
  G.interrog.current.heat = 5; G.interrog.afterNumbers();
  assert.ok(texts(t.interrogResolve()).includes("Test outcome bolts."));
  const { createFullGame } = await import("../full.mjs");
  const H = createFullGame({ content: loadContent([...testSources(), SRC]), seed: 7 }), u = H.talk("x.t.start");
  H.interrog.current.heat = 8; H.interrog.afterNumbers(); // swing (8) is checked before bolt
  const f = u.interrogResolve();
  assert.equal(f.fight, "e.t.guard"); assert.deepEqual(texts(f), ["Test: now then."]);
});

test("the lie call is offered only while a lie is open; a call without the fact costs nerve; caught or closed, it goes", () => {
  const G = make(), t = G.talk("x.t.start");
  assert.equal(G.interrog.openLie(), null); assert.ok(!t.beat.options.some((o) => o.lie));
  for (let i = 0; i < 6 * 60; i++) G.loop.step(); // six real seconds: the lie is said
  assert.ok(G.interrog.openLie()); assert.ok(t.interrogRefresh().options.some((o) => o.lie), "offered while open");
  let b = pick(t, "That's a lie"); assert.equal(b.interrogation.nerve, 8, "without the fact: nerve +2");
  for (let i = 0; i < 5 * 60; i++) G.loop.step(); // the window passes
  assert.equal(G.interrog.openLie(), null); assert.ok(!t.interrogRefresh().options.some((o) => o.lie), "gone when the window closes");
  const H = make(), u = H.talk("x.t.start"); H.state.flags.push("t.wet");
  for (let i = 0; i < 6 * 60; i++) H.loop.step(); u.interrogRefresh();
  const c = pick(u, "That's a lie"); assert.ok(texts(c).includes("Test reply caught.")); assert.equal(c.interrogation.nerve, 2);
  assert.ok(!c.options.some((o) => o.lie), "gone once caught");
});

test("silence: heat cools every cool-every seconds, and hold runs out through walk:", () => {
  const G = make(), t = G.talk("x.t.start"); pick(t, "collar"); // heat 3
  for (let i = 0; i < 8 * 60 + 1; i++) G.loop.step();
  assert.equal(G.interrog.current.heat, 2);
  for (let i = 0; i < 26 * 60; i++) G.loop.step();
  assert.equal(G.interrog.outcome().kind, "walk");
  assert.ok(texts(t.interrogResolve()).includes("Test outcome walk."));
});

test("walking off mid-interrogation plays its walk node", () => {
  const G = make(), t = G.talk("x.t.start"), b = t.walkAway();
  assert.ok(texts(b).includes("Test outcome walk.")); assert.equal(G.interrog.current, null);
});

test("with every press used and the lie past, the person leaves by walk: after a few seconds", () => {
  const G = make(), t = G.talk("x.t.start");
  G.interrog.current.def = { ...G.interrog.current.def, presses: G.interrog.current.def.presses.filter((p) => !p.again) };
  for (const l of ["collar", "lost"]) pick(t, l); // nerve 1, heat 2 (collar +3, lost -1)
  for (let i = 0; i < 20 * 60 && !G.interrog.outcome(); i++) G.loop.step(); // the lie at 5 s, its window to 9 s, then 6 s
  assert.equal(G.interrog.outcome().kind, "walk");
});

test("a lie with several catch facts is caught by any one of them", () => {
  const G = make(), t = G.talk("x.t.start"); G.state.flags.push("t.prints.seen");
  assert.deepEqual(G.interrog.current.lies[0].catch, ["t.wet", "t.prints.seen"]);
  for (let i = 0; i < 6 * 60; i++) G.loop.step(); t.interrogRefresh();
  assert.ok(texts(pick(t, "That's a lie")).includes("Test reply caught."));
});
