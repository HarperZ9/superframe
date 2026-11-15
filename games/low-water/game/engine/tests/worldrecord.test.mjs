// The world record (save/worldrecord.mjs): kept beside the saves, written once per finished run, healed from its
// second copy, untouched by a new game, a deleted slot or an older save loaded, and read by the next run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { createWorldRecord, installWorldRecord } from "../save/worldrecord.mjs";
import { createSaves, memoryStorage } from "../save/save.mjs";
import { newSheet } from "../rules/sheet.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const content = loadContent((await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources);
const wf = content.story.worldfacts;
function run(storage, cls, { choose = null } = {}) {
  const G = createFullGame({ content, seed: 1 }); G.create({ archetype: cls === "militia" ? "q.will" : "q.ned", enter: false }); G.state.vars.q_class = cls;
  const W = installWorldRecord(G, createWorldRecord(storage, "quota"), { story: "quota", worldfacts: wf });
  if (choose) { const t = G.talk(choose.node); t.choose(t.beat.options.findIndex((o) => o.label.includes(choose.words))); }
  return { G, W };
}
// The run ends at the node that carries end: q.end. That was era 2's witness scene, reached from q.readback in a few
// choices. With five eras in the slice it is e5.end, after era 5's last beat (content/quota/e5_end.lwd), and era 2's
// witness now opens era 3. The node is found by its end: step, so a moved end is followed and a second one fails.
const ENDS = Object.values(content.book.nodes).filter((n) => (n.steps || []).some((s) => s.kind === "end" && s.value === "q.end")).map((n) => n.id);
const finish = (G) => { assert.deepEqual(ENDS, ["e5.end"], "one node ends the run"); G.talk(ENDS[0]); };

test("a finished run leaves one entry: class, end, facts, harm, kept variables, the line said", () => {
  const S = memoryStorage(), { G, W } = run(S, "militia", { choose: { node: "q.office.will", words: "tallowmen" } });
  G.setFlag("q.tomas_held", true); G.lore.find("q.lore.cell_log");
  G.community.record("refuse.pass", "haldane", "haldane_yard");
  finish(G); finish(G);
  const e = W.runs(); assert.equal(e.length, 1, "written once, by its run id");
  assert.equal(e[0].class, "militia"); assert.equal(e[0].end, "q.end");
  for (const f of ["q.fact.cell_log", "world.dead.tomas"]) assert.ok(e[0].facts.includes(f), f);
  assert.deepEqual(e[0].harmed, ["haldane"]); assert.equal(e[0].keep.q_figure, "blamed");
  assert.match(e[0].line.words, /tallowmen/); assert.equal(e[0].line.flag, "said.will_report_blamed");
});

test("the next run, of either class, starts from the record: prior facts, the line, the stone", () => {
  const S = memoryStorage(), a = run(S, "militia", { choose: { node: "q.office.will", words: "tallowmen" } });
  a.G.setFlag("q.tomas_held", true); a.G.lore.find("q.lore.cell_log"); finish(a.G);
  const b = run(S, "inspector");
  assert.ok(b.G.lore.prior("q.fact.cell_log") && b.G.lore.prior("world.dead.tomas"));
  assert.match(b.G.state.vars.prior_line, /tallowmen/); assert.equal(b.G.state.vars.prior_who, "militia"); assert.equal(b.G.state.vars.prior_runs, 1);
  assert.equal(b.G.props.state("q.burial_fence").id, "dug", "the corner dug over: what the record knew buys no stone");
  b.G.setPlace("q_post"); const board = b.G.props.examine("q.post_board")[0].text; assert.match(board, /tallowmen/); assert.ok(!/said that|militia|inspector/.test(board), "the line said at the brazier, with no speaker named (2026-10-22; said, not chalked, 2026-10-23)");
  const fresh = run(memoryStorage(), "inspector"); assert.equal(fresh.G.props.state("q.burial_fence").id, "gap", "the control: no record, the corner as it is");
  assert.equal(fresh.G.props.state("q.post_board").id, "brazier");
});

test("nothing a player does short of clearing the site's data clears it: a slot deleted, a copy deleted, a copy edited, an older save loaded", async () => {
  const S = memoryStorage(), { G, W } = run(S, "inspector", { choose: { node: "q.office.ned", words: "Stand by the pan and watch the arm" } });
  const saves = createSaves(G, S, { newSheet }); saves.save("1", "before the end");
  finish(G); assert.equal(W.runs().length, 1);
  saves.remove("1"); saves.remove("auto"); assert.equal(W.runs().length, 1, "deleting slots");
  S.remove(W.keys[0]); assert.equal(W.runs().length, 1); assert.ok(S.get(W.keys[0]), "healed");
  S.remove(W.keys[1]); assert.equal(W.runs().length, 1); assert.ok(S.get(W.keys[1]), "healed");
  S.set(W.keys[1], S.get(W.keys[1]).replace('"runs":[', '"runs":[{"run":"forged"},'));
  assert.ok(!W.runs().some((e) => e.run === "forged"), "a hand-edited copy fails its sum and is rewritten");
  const S2 = memoryStorage(), g2 = run(S2, "inspector"), sv = createSaves(g2.G, S2, { newSheet }); sv.save("2", "early");
  finish(g2.G); await sv.load("2"); assert.equal(g2.W.runs().length, 1, "loading an older save takes nothing back"); finish(g2.G); assert.equal(g2.W.runs().length, 1, "and the same run ends once");
  run(S, "militia"); assert.equal(W.runs().length, 1, "a new game clears nothing");
  S.remove(W.keys[0]); S.remove(W.keys[1]); assert.equal(createWorldRecord(S, "quota").runs().length, 0, "the control: both copies gone (the site's data cleared) is the only way");
});
