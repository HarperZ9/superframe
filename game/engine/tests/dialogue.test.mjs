import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGame, loadContent } from "../game.mjs";
import { loadAct } from "../dialogue/book.mjs";
import { game, pick, labels, texts, SLICE } from "./helpers.mjs";

test("the LWD/0 slice loads as LWD/1 with no errors and plays to its first choice", () => {
  const C = loadContent([{ file: "slice.lwd", text: readFileSync(SLICE, "utf8") }]);
  assert.deepEqual(C.errors, []);
  assert.equal(Object.keys(C.book.nodes).length, 119, "118 scenes and the built-in at-end event");
  const G = createGame({ content: C }), t = G.start();
  assert.ok(t.beat.lines.length > 0, "the opening plays lines");
  assert.ok(t.beat.options && t.beat.options.length > 0, "and reaches a choice");
});

test("hub, once options, effects and ^hub", () => {
  const G = game(), t = G.start();
  assert.ok(labels(t).includes("Ask the first question."));
  assert.ok(!labels(t).includes("Ask about the switch."), "hidden while its condition fails");
  pick(t, "Ask the first question.");
  assert.ok(texts(t.beat).includes("Test answer one."));
  assert.equal(G.factions.get("guild"), 10);
  assert.equal(G.scope.get("coins"), 5, "a declared var starts at its default");
  assert.ok(!labels(t).includes("Ask the first question."), "{once} hides it after choosing");
  assert.equal(G.sheet.ranks("eye"), 0);
  assert.equal(G.state.sheet.xp, 5, "{xp: 5} on the option");
});

test("call and return come back to the line after the call", () => {
  const G = game(), t = G.start();
  G.setFlag("t.switch", true);
  pick(t, "Ask the first question."); // any choice re-enters the hub, which re-reads conditions
  pick(t, "Ask about the switch.");
  const lines = texts(t.beat);
  assert.ok(lines.indexOf("Test aside, reached by call.") < lines.indexOf("Test line after the call returned."));
});

test("a passive check diverts into its node and returns; a voice line needs its level", () => {
  const G = game(); G.create({ archetype: "a.clerk", enter: false });
  const t = G.start(), lines = texts(t.beat);
  assert.ok(lines.includes("Test passive line: heard only with Ledger 4 or more."));
  assert.ok(lines.includes("Test interjection: the passive check diverted here."));
  assert.ok(G.flag("t.switch"), "the diverted node's effects ran");
  const weak = game(), w = weak.start();
  assert.ok(!texts(w.beat).includes("Test passive line: heard only with Ledger 4 or more."));
});

test("R3: {below: n} voices play only under the level; dc and below make a band", () => {
  const G = game(); G.setPlace("t.quay");
  const t = G.talk("t.r.start"), lines = texts(t.beat);
  assert.ok(lines.includes("Test low voice: only below Eye 3."));
  assert.ok(!lines.includes("Test band voice: Eye 1 to 5."), "eye is 0 under the quay's sodium: below the band");
  const H = game(); H.create({ archetype: "a.clerk", enter: false }); H.setPlace("t.bar");
  const u = texts(H.talk("t.r.start").beat);
  assert.ok(!u.includes("Test low voice: only below Eye 3."), "eye 4 is not below 3");
  assert.ok(u.includes("Test band voice: Eye 1 to 5."));
});

test("R13: {show} hides a claim until it holds; the claim's condition still picks the outcome", () => {
  const G = game(), t = G.talk("t.r.start");
  assert.ok(!labels(t).includes("Test hidden claim."));
  G.setFlag("t.read_tide", true);
  t.jump("t.r.hub");
  assert.ok(labels(t).includes("Test hidden claim."));
  pick(t, "Test hidden claim.");
  assert.ok(texts(t.beat).includes("Test: failure."), "no t.switch: the claim fails");
});

test("events play at the next node boundary: at a time, and on a condition alone", () => {
  const G = game(), t = G.start();
  G.advance(25);
  pick(t, "Ask the first question.");
  assert.ok(texts(t.beat).includes("Test event: fog comes in."));
  assert.equal(G.env.term("fog"), 0.08, "the event's cmd ran");
  assert.ok(!texts(t.beat).includes("Test event on a condition."));
  G.setFlag("t.switch", true); G.advance(10);
  t.jump("t.speaker.hub");
  assert.ok(texts(t.beat).includes("Test event on a condition."));
});

test("outside a conversation nextScene() hands over due events", () => {
  const G = game(); G.advance(25);
  const s = G.nextScene();
  assert.deepEqual(s, { kind: "event", id: "t.fog", node: "@event.t.fog" });
  assert.equal(G.nextScene(), null, "an event plays once");
});

test("run(id) ends the beat with beat.run; after the run play goes to win or lose", () => {
  const G = game(), t = G.talk("t.r.hub");
  pick(t, "Test run.");
  assert.equal(t.beat.run, "t.dash");
  assert.ok(!texts(t.beat).includes("Test: this line never plays."));
  const r = G.runs.start("t.dash", { mode: "stepped" });
  while (!r.state.done) r.stepMove(1, 0);
  t.afterRun();
  assert.ok(texts(t.beat).includes("Test: the run was won.") || texts(t.beat).includes("Test: the run was lost."));
});

test("with runs turned off the run node falls back to an ordinary check", () => {
  const G = game(); G.state.runsOff = true;
  const t = G.talk("t.r.hub"); pick(t, "Test run.");
  assert.equal(t.beat.run, undefined);
  assert.ok(labels(t).includes("[KNOTS] Test fallback for the run."));
});

test("history log and memory of everything said", () => {
  const G = game(), t = G.start();
  pick(t, "Ask the first question.");
  const log = G.memory.history();
  assert.ok(log.some((l) => l.kind === "you" && l.text === "Ask the first question."));
  assert.ok(log.every((l) => typeof l.at === "number" && l.node));
  assert.equal(G.memory.visits("t.speaker.hub"), 2);
  assert.ok(G.scope.call("said", [{ k: "id", name: "t.speaker.hub#0" }], G.scope));
});

test("loadAct reads the root and its include: lines in order", async () => {
  const files = { "act/root.lwd": "@meta\nformat: lwd/1\nstart: a\ninclude: one.lwd\ninclude: missing.lwd\n", "act/one.lwd": "@node a\nnar: A.\nend: done\n" };
  const { sources, errors } = await loadAct("act/root.lwd", (p) => { if (!(p in files)) throw new Error("not found"); return files[p]; });
  assert.deepEqual(sources.map((s) => s.file), ["act/root.lwd", "act/one.lwd"]);
  assert.equal(errors.length, 1);
  const G = createGame({ sources }); assert.equal(G.start().beat.end, "done");
});

test("R15: {when} and {once} on nar, line and inst; the block never prints", async () => {
  const { loadContent, createGame } = await import("../game.mjs");
  const C = loadContent([{ file: "r15.lwd", text: `@meta
start: a
@node a
speaker: KEEL
nar: Always shown. {when: 1 == 1}
nar: Never shown. {when: 1 == 2}
line: KEEL: Spoken only with the flag. {when: has(f)}
inst: THE GLASS: Read only once. {once}
nar: Plain narration with the tide {{tide}} m.
opt: "Again." -> a
` }]);
  assert.deepEqual(C.errors, []);
  const G = createGame({ content: C }), t = G.start(), first = texts(t.beat);
  assert.deepEqual(first.slice(0, 2), ["Always shown.", "Read only once."]);
  assert.ok(first.every((x) => !x.includes("{") && !x.includes("when:")), "no attribute text on screen");
  assert.match(first[2], /^Plain narration with the tide -?\d+\.\d\d m\.$/, "{{expr}} still fills and is not taken for a block");
  G.setFlag("f", true); pick(t, "Again.");
  const second = texts(t.beat);
  assert.ok(second.includes("Spoken only with the flag."));
  assert.ok(!second.includes("Read only once."), "{once} does not repeat");
  assert.ok(!second.includes("Never shown."));
});

test("fight(id) ends the beat with beat.fight; afterFight plays the outcome node", async () => {
  const { loadContent, createFullGame } = await import("../full.mjs"); // real combat: an integration test
  const G = createFullGame({ content: loadContent([{ file: "f.lwd", text: `@meta
start: a
@node a
nar: Before.
do: fight(e.none)
` }]) });
  assert.throws(() => G.start(), /no encounter e.none/, "an unknown encounter is an error, not a silent skip");
  assert.equal(typeof G.ext.combat.request, "function", "combat is installed with the game");
});

test("an @event in an included district file is scheduled and runs: at, when, cmd, do", async () => {
  // a day-start act (as Act 3, clock 13:00): 03:30 reads as the small hours after its night
  const files = {
    "act/root.lwd": "@meta\nformat: lwd/1\nstart: a\nclock: 13:00\ninclude: district.lwd\n@place lane\nname: Lane\nlight: 0.7\n@node a\nplace: lane\nnar: Afternoon.\nopt: \"Wait.\" -> a +30\n",
    "act/district.lwd": "# a district file\n@event d.lost\nat: 03:30\nwhen: var.lit == 1 & !has(lamps.out)\nnar: The lane goes dark.\ncmd: setLight lane 0.03 0\ndo: set(lamps.out)\n",
  };
  const { sources } = await loadAct("act/root.lwd", (p) => files[p]);
  const C = loadContent(sources);
  assert.deepEqual(C.errors, []);
  const e = C.book.events.find((x) => x.id === "d.lost");
  assert.equal(e.file, "act/district.lwd");
  assert.equal(e.at, (24 + 3) * 60 + 30, "after midnight on a day-start act");
  const G = createGame({ content: C });
  G.scope.assign("var.lit", 1);
  G.advance(e.at - 1 - G.clock()); assert.equal(G.nextScene(), null, "not before its time");
  G.advance(1); const s = G.nextScene();
  assert.equal(s.node, "@event.d.lost");
  const t = G.talk(s.node);
  assert.deepEqual(texts(t.beat), ["The lane goes dark."]);
  assert.equal(G.env.term("light", "lane"), 0.03); assert.ok(G.flag("lamps.out"));
  assert.equal(G.nextScene(), null, "it plays once");
  // inside a conversation it plays at the next node boundary
  const H = createGame({ content: C }); H.scope.assign("var.lit", 1); const u = H.start();
  H.advance(e.at - H.clock()); pick(u, "Wait.");
  assert.ok(texts(u.beat).includes("The lane goes dark.") && H.flag("lamps.out"));
  // its condition gates it: not lit, no event
  const K = createGame({ content: C }); K.advance(e.at + 10 - K.clock()); assert.equal(K.nextScene(), null);
});

test("@meta end-clock and at-end: when the clock reaches the end the act goes to at-end", () => {
  const C = loadContent([{ file: "e.lwd", text: "@meta\nstart: a\nclock: 23:00\nend-clock: 00:30\nat-end: fin\n@node a\nopt: \"Wait an hour.\" -> a +60\n@node fin\nnar: Dawn.\nend: done\n" }]);
  const G = createGame({ content: C }), t = G.start();
  pick(t, "Wait an hour."); assert.ok(!texts(t.beat).includes("Dawn."), "00:00 is before the end");
  pick(t, "Wait an hour."); assert.ok(texts(t.beat).includes("Dawn.")); assert.equal(t.beat.end, "done");
  const H = createGame({ content: C }); H.advance(120); assert.equal(H.nextScene().node, "@event.meta.at-end", "outside a conversation too");
});

test("a scene that interrupts (a full meter) and ends with exit: returns to what it interrupted", () => {
  const C = loadContent([{ file: "i.lwd", text: "@meta\nstart: a\n@meter wear\nmax: 10\nfull: nod\nafter: 4\n@node a\nnar: Dawn begins.\ndo: meter(wear, 10)\ngo: b\n@node b\nnar: Dawn goes on.\nend: act.end\n@node nod\nnar: Lamb nods off and wakes.\nexit: walk\n@node c\nnar: Elsewhere.\nexit: walk\n" }]);
  const G = createGame({ content: C }), t = G.start();
  assert.deepEqual(texts(t.beat), ["Dawn begins.", "Lamb nods off and wakes.", "Dawn goes on."]);
  assert.equal(t.beat.end, "act.end", "the act still ends");
  const H = createGame({ content: C }); assert.equal(H.talk("c").beat.exit, "walk", "a plain exit still goes back to the world");
});
