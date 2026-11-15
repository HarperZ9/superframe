// The witness scene (world/witness.mjs, content/quota/q_witness.lwd) and its check (tools/witnesscheck.mjs), with
// the controls of design/spine-plan/02-WITNESS.md section 5: a planted beat about the returns room fails Reach; a
// planted narration "He was a good man, really" fails No verdict, and the same words in Anni's mouth pass; a run that
// heard a self-lie with its echo beat removed fails Echo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { lintWitness, checkWitnessRuns } from "../tools/witnesscheck.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const base = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources;
const content = loadContent(base);
const withExtra = (extra) => loadContent([...base, { file: "plant.lwd", text: extra }]);
const game = (C = content, cls = "inspector") => { const G = createFullGame({ content: C, seed: 1 }); G.create({ archetype: cls === "militia" ? "q.will" : "q.ned", enter: false }); G.state.vars.q_class = cls; return G; };

test("the slice's witness lints clean: reach, no verdict, the count cap, an echo for every self-lie", () => {
  assert.deepEqual(lintWitness(content).map((o) => o.msg), []);
});

test("control: a beat about the returns room, told as seen, fails Reach", () => {
  const C = withExtra(`@witness x.w
who: ANNI
listener: DAUGHTER
opens: q.w.anni.open
dispatch: q.w.anni.next
reach: q_post
never: q_returns
sources: BET
beat: q.w.anni.paper | q_figure | seen q_returns ? true
beat: q.w.anni.post | q_cart | heard HOLT ? true
last: q.w.anni.tin
`);
  const msgs = lintWitness(C).map((o) => o.msg).join("\n");
  assert.match(msgs, /x\.w: beat q\.w\.anni\.paper is told as seen at q_returns, where ANNI never was \(Reach\)/);
  assert.match(msgs, /x\.w: beat q\.w\.anni\.post is told as heard from HOLT, who is not one of ANNI's sources \(Reach\)/);
});

test("control: the narration may not pass a verdict, and Anni may", () => {
  const plant = (step) => base.map((s) => (s.text.includes("@node q.w.anni.quiet") ? { ...s, text: s.text.replace("nar: He says nothing. She doesn't ask him to.", `${step}\nnar: He says nothing. She doesn't ask him to.`) } : s));
  const narrated = lintWitness(loadContent(plant("nar: He was a good man, really."))).map((o) => o.msg).join("\n");
  assert.match(narrated, /q\.w\.anni\.quiet: the game passes a verdict: "good man"/);
  assert.deepEqual(lintWitness(loadContent(plant("line: ANNI: He was a good man, really."))).map((o) => o.msg), [], "a character may say it");
});

test("control: a run that heard a self-lie, with its echo beat not played, fails Echo; the gate and the oracle hold", () => {
  const run = { build: "x", finished: true, visited: ["q.w.anni.tin"], witness: { id: "q.w.anni", beats: ["q.w.anni.post", "q.w.anni.table"], played: ["q.w.anni.table"], closed: true, selfLies: ["q.sl.signed"],
    oracle: [{ when: "14:00", text: "The Haldane cart", ids: ["q_cart"] }], gate: { first: true, secondRefused: true, earlyRefused: true, closed: true } } };
  const res = checkWitnessRuns(content, [run]).lines.join("\n");
  assert.match(res, /the self-lie q\.sl\.signed was heard and no beat played on the run echoes it \(Echo\)/);
  assert.match(res, /the ledger row "14:00 \| The Haldane cart" is answered by no beat played/);
  const ok = { ...run, witness: { ...run.witness, played: ["q.w.anni.paper", "q.w.anni.post", "q.w.anni.table"] } };
  assert.equal(checkWitnessRuns(content, [ok]).errors, 0, checkWitnessRuns(content, [ok]).lines.join(" | "));
});

test("the scene plays in order, each beat once, and the talk panel's gate cannot skip it", () => {
  const G = game(); G.setFlag("q.tomas_held", true); G.state.vars.q_cart = "arrested";
  const beats = G.witness.open("q.w.anni");
  assert.ok(beats.includes("q.w.anni.post") && beats.includes("q.w.anni.week") && beats.at(-1) === "q.w.anni.guest", beats.join(", "));
  const g = G.witness.gate; assert.ok(g.next(0)); assert.equal(g.next(1), null, "too soon"); assert.equal(g.close(2), false, "not every beat is shown");
  const t = G.talk("q.w.anni.open"); for (let i = 0; i < 10 && t.beat && t.beat.options; i++) t.choose(t.beat.options.length - 1);
  assert.deepEqual(G.state.witness.shown, beats); assert.ok(G.state.witness.closed);
});
