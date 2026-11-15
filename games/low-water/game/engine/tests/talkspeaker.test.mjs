// The talk panel's speaker header follows the node that is talking now. Era 5's video
// (e5.clip.stop, LEON's lines) runs on into the share (e5.share, speaker TOM, narration only)
// in one beat; the header kept LEON, the last named line in the log, from the node before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { talkSpeaker } from "../ui/talkspeaker.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const content = loadContent((await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources);
const game = () => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: "q.ned", enter: false }); G.state.vars.q_class = "inspector"; return G; };

test("the share after the video is headed TOM, not LEON from the video before it", () => {
  const G = game(), t = G.talk("e5.clip.stop"), log = [...t.beat.lines];
  assert.equal(t.node, "e5.share");
  assert.ok(log.some((l) => l.kind === "line" && l.who === "LEON"), "the video's lines are in the same beat");
  assert.equal(talkSpeaker(log, t).speaker, "TOM");
});

test("a named line in the current node still heads the panel, and its face goes with it", () => {
  const talk = { node: "n2", speaker: "TOM" };
  const log = [{ kind: "line", who: "LEON", text: "a", node: "n1", face: "hard" }, { kind: "line", who: "ANN", text: "b", node: "n2", face: "wary" }, { kind: "nar", who: "", text: "c", node: "n2" }];
  assert.deepEqual(talkSpeaker(log, talk), { speaker: "ANN", face: log[1] });
});

test("a node with no named line takes its own speaker and no face from an earlier node", () => {
  const talk = { node: "n2", speaker: "TOM" };
  const log = [{ kind: "line", who: "LEON", text: "a", node: "n1", face: "hard" }, { kind: "nar", who: "", text: "c", node: "n2" }];
  assert.deepEqual(talkSpeaker(log, talk), { speaker: "TOM", face: null });
});

test("idle (no talk): no speaker", () => {
  assert.equal(talkSpeaker([{ kind: "line", who: "LEON", text: "a", node: "n1" }], null).speaker, "");
});
