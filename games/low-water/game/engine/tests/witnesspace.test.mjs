// The witness scene in the talk panel (ui/witnesspace.mjs): it holds a beat's lines and lets them in a node at a
// time through the witness gate, keeps the options and the end back until every line is in and read, and cannot be
// hurried. With a control: the same lines taken with no witness open come through at once.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installWitness } from "../world/witness.mjs";
import { witnessPace, groupByNode, readMs } from "../ui/witnesspace.mjs";

function fakeGame() {
  const subs = {}, nodes = {
    "w.open": { place: "room", steps: [{ kind: "nar", value: "She lets him in." }] },
    "w.a": { place: "room", steps: [{ kind: "line", text: "one two three four" }] },
    "w.b": { place: "room", steps: [{ kind: "line", text: "five six" }] },
    "before": { place: "yard", steps: [] },
  };
  const G = { state: {}, book: { nodes }, scope: {}, on: (e, f) => ((subs[e] ||= []).push(f), () => {}), emit: (e, x) => (subs[e] || []).forEach((f) => f(x)) };
  installWitness(G, { "w": { id: "w", place: "room", beats: [{ node: "w.a" }, { node: "w.b" }] } });
  return G;
}
const lines = [{ node: "before", text: "The scene that led there." }, { node: "w.open", text: "She lets him in." }, { node: "w.a", text: "one two three four" }, { node: "w.b", text: "five six" }];

test("lines group by the node that said them, in order", () => {
  assert.deepEqual(groupByNode(lines).map((g) => g.node), ["before", "w.open", "w.a", "w.b"]);
  assert.equal(readMs([{ text: "a b c" }]), 600 + 750);
});

test("a witness holds its lines and lets them in a node at a time, each after its reading time and through the gate", () => {
  let t = 1000; const G = fakeGame(), P = { log: [] }, api = { render() {}, root: { isConnected: true } };
  const W = witnessPace({ G }, P, api, { now: () => t, every: 1e9 });
  G.witness.open("w"); G.emit("witness.open", {});
  assert.equal(W.take(lines).length, 0, "nothing is handed back to the caller");
  assert.equal(P.log.length, 2, "the line from elsewhere shows at once, and the witness's first line is let in");
  assert.ok(W.held(), "options and the end wait");
  // nothing hurries it: no time passed, nothing more comes in
  W.take([]); assert.equal(P.log.length, 2);
  t += readMs([lines[1]]) + 1; W.take([]);
  assert.equal(P.log.length, 3, "the first beat after the opening's reading time");
  assert.equal(G.state.witness.ui.shown, 1, "through the gate");
  t += 100; W.take([]); assert.equal(P.log.length, 3, "the second beat waits out the first's reading time");
  t += readMs([lines[2]]); W.take([]); assert.equal(P.log.length, 4);
  G.witness.end();
  assert.ok(W.held(), "closed in the script, but the last beat is not read yet: the end stays back");
  t += readMs([lines[3]]) + 1;
  assert.equal(W.held(), false, "read: the end may show");
  W.stop();
});

test("control: with no witness open the lines come through at once", () => {
  const G = fakeGame(), P = { log: [] }, W = witnessPace({ G }, P, { render() {} }, { now: () => 0, every: 1e9 });
  assert.equal(W.take(lines).length, 4); assert.equal(W.held(), false);
  W.stop();
});

test("a beat with no line on screen does not hold the end forever, and the end still waits for the last read", () => {
  let t = 0; const G = fakeGame(), P = { log: [] };
  G.witness.records.w.beats.push({ node: "w.c" }); G.book.nodes["w.c"] = { place: "room", steps: [] };
  const W = witnessPace({ G }, P, { render() {}, root: { isConnected: true } }, { now: () => t, every: 1e9 });
  G.witness.open("w"); G.emit("witness.open", {});
  W.take(lines.slice(1)); for (let k = 0; k < 4; k++) { t += 5000; W.take([]); }
  G.witness.end();
  assert.equal(P.log.length, 3); assert.equal(W.held(), false, "w.c said nothing: the scene may close");
  W.stop();
});
