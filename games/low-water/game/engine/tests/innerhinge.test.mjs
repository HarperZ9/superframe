// S18: the story's hinge into the inner fights (combat/innerhook.mjs). A scene's inner(<flaw>, <next>) pauses the
// talk with beat.inner only when the flaw is armed by a heard self-lie (the Descent and the Adversary once, at the end
// of era 5); the records it hands back become story state in G.state.inner, and the named node plays.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { playInner } from "../tools/innerplay.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const content = loadContent((await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources);
const game = (cls, heard = []) => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: cls === "militia" ? "q.will" : "q.ned", enter: false }); G.state.vars.q_class = cls; G.state.selfLies = heard.map((id) => ({ id })); return G; };

test("armed: Order pauses the night of Leon's statement, and the morning is the next scene", () => {
  const G = game("militia", ["e5.sl.order"]), t = G.talk("e5.inner.order");
  assert.deepEqual({ id: t.beat.inner.id, next: t.beat.inner.next }, { id: "order", next: "e5.false" });
  const recs = [{ type: "inner.outcome", flaw: "order", verb: "yield", outcome: "laid", scene: "e5_day", beat: "They walk past." }];
  t.afterInner(t.beat.inner, recs);
  assert.ok(G.memory.visits("e5.false") > 0, "the morning's scene played");
  assert.equal(G.state.inner.order.verb, "yield"); assert.ok(!G.state.pendingInner);
});

test("not armed: the inspector never heard Leon's lie, so the night passes and the scene goes on", () => {
  const G = game("inspector", ["e5.sl.says"]), t = G.talk("e5.inner.order");
  assert.ok(!t.beat.inner, "no inner beat"); assert.ok(!G.state.inner || !G.state.inner.order);
});

test("the Descent and the Adversary come once, whatever was heard; the Descent reads the run's resolutions", () => {
  const G = game("inspector", []); G.state.inner = { says: { verb: "endure" }, prudence: { verb: "force" } };
  const t = G.talk("e5.inner.descent");
  assert.equal(t.beat.inner.id, "descent"); assert.deepEqual(t.beat.inner.resolved, { says: "endure", prudence: "force" }); assert.deepEqual(t.beat.inner.kept, ["prudence"]);
  t.afterInner(t.beat.inner, []);
  assert.equal(G.state.inner.descent.verb, "walked");
  // once: the second time the Descent is passed over and the scene moves on to the Adversary's hinge, then the door
  const again = G.talk("e5.inner.descent"); assert.equal(again.beat.inner.id, "host");
  again.afterInner(again.beat.inner, [{ type: "inner.outcome", flaw: "host", movement: "withdraws", verb: "name", outcome: "talk", beat: "z" }]);
  assert.equal(G.state.inner.host.verb, "name"); assert.ok(G.memory.visits("e5.door") > 0, "the clearance day follows");
  assert.ok(!G.talk("e5.inner.host").beat.inner, "the Adversary comes once");
});

test("a Descent ring's record does not overwrite the flaw's own night; a boon's cost is kept as owed", () => {
  const G = game("militia", ["e5.sl.says"]); G.innerHinge.finish("says", [
    { type: "inner.outcome", flaw: "says", verb: "force", outcome: "forced", beat: "x" }, { type: "boon.cost", flaw: "says", boon: "reach" }]);
  G.innerHinge.finish("descent", [{ type: "inner.outcome", flaw: "says", ring: true, verb: "lose", outcome: "down", beat: "y" }]);
  assert.equal(G.state.inner.says.verb, "force"); assert.equal(G.state.inner.says.boon, "reach");
});

// Since the rework of 2026-10-23 the bosses are real fights, and the scripted fist build (combat's pilot) loses to
// Everybody Says in about one attempt in four (combat/tests/innerduel.json). Seed 3 is a win; seed 1 is a loss,
// which the story takes as the flaw's lose ending and goes on.
test("the harness plays a hinge headless: a talk build ends it without force, a fist build by force or falls, each read first", () => {
  const says = { id: "says", heard: ["e5.sl.says"] };
  const talk = playInner(says, { habit: "tongue" }), fist = playInner(says, { habit: "fist", seed: 3 }), fell = playInner(says, { habit: "fist", seed: 1 });
  assert.deepEqual(talk.ends, ["endured"]); assert.deepEqual(fist.ends, ["forced"]); assert.deepEqual(fell.ends, ["down"]);
  assert.equal(talk.records[0].verb, "endure"); assert.equal(fist.records[0].verb, "force"); assert.equal(fell.records[0].verb, "lose");
});

// the eight earlier hinges (eras 1 to 4): each pauses only for its own heard self-lie and then plays the scene it names
const EARLIER = [
  ["e1.inner.fond", "fond", "e1.sl.fond", "e1.frost.eve"], ["q.inner.prudence", "prudence", "q.sl.signed", "q.inner.only"],
  ["q.inner.only", "only", "q.sl.add_up", "q.inner.forty"], ["q.inner.forty", "forty", "q.sl.forty_carts", "q.inner.friday"],
  ["q.inner.friday", "friday", "q.sl.never_hand", "q.week"], ["e3.inner.figure", "figure", "e3.sl.figure", "e3.table"],
  ["e4.inner.barn", "barn", "e4.sl.barn", "e4.shift"], ["e4.inner.goats", "goats", "e4.sl.goats", "e4.shelter"],
];
test("the eight earlier hinges: armed, each pauses for its own flaw and names the next scene; unheard, the scene goes on", () => {
  for (const [node, flaw, lie, next] of EARLIER) {
    const t = game("inspector", [lie]).talk(node);
    assert.deepEqual(t.beat.inner && { id: t.beat.inner.id, next: t.beat.inner.next }, { id: flaw, next }, node);
    const other = EARLIER.find((e) => e[2] !== lie)[2], u = game("inspector", [other]).talk(node);
    assert.ok(!u.beat.inner || u.beat.inner.id !== flaw, `${node} does not fight unheard`);
  }
});

test("era 2's night: three flaws heard the same day come one after another, then the week", () => {
  const G = game("inspector", ["q.sl.signed", "q.sl.add_up", "q.sl.never_hand"]); let t = G.talk("q.inner.prudence"); const met = [];
  for (let i = 0; i < 6 && t.beat.inner; i++) { met.push(t.beat.inner.id); t.afterInner(t.beat.inner, [{ type: "inner.outcome", flaw: t.beat.inner.id, verb: "endure", outcome: "x", beat: "" }]); }
  assert.deepEqual(met, ["prudence", "only", "friday"]); assert.ok(G.memory.visits("q.week") > 0, "the week follows");
});
