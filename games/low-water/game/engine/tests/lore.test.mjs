// The lore graph (world/lore.mjs, design/PITCHES.md 3c.2): fragments found where they are when their requirements
// hold, the facts they keep for later runs, and the lore check (tools/lorecheck.mjs) on the slice and on bad graphs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { lintLore, checkLorePlay } from "../tools/lorecheck.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const base = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources, text = base.map((s) => s.text).join("\n");
const content = loadContent(base);
const game = (cls = "inspector") => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: cls === "militia" ? "q.will" : "q.ned", enter: false }); G.state.vars.q_class = cls; return G; };

test("the missing-Tomas chain loads: eight fragments in three layers and five routes", () => {
  const L = content.story.lore;
  assert.deepEqual(content.errors.filter((e) => e.level !== "warn"), []);
  assert.equal(Object.keys(L.fragments).length, 8);
  assert.deepEqual([...new Set(Object.values(L.fragments).map((f) => f.layer))].sort(), ["deep", "hidden", "surface"]);
  assert.deepEqual(L.chains["q.missing_tomas"].routes.map((r) => r.rule), ["two-classes", "one-run", "across-runs", "one-run", "one-run"]);
  assert.deepEqual(lintLore(content, text), []);
});

test("a fragment is found where it is, and only when its requirements hold: class, state, choice, prior fact", () => {
  const ned = game("inspector"), will = game("militia");
  // the wedge under the scale's pan, found by the hand (weighted devices, 2026-10-23: the ledger was a page)
  for (const G of [ned, will]) { G.setPlace("q_tower"); G.props.touch("q.exchange_scale", 0); }
  assert.ok(ned.lore.isFound("q.lore.ledger")); assert.ok(!will.lore.isFound("q.lore.ledger"), "the wedge is the inspector's find");
  assert.deepEqual(ned.lore.facts(), ["q.fact.ledger"]);
  will.talk("q.will.post.arrest"); assert.ok(will.lore.isFound("q.lore.cell_log"), "a node finds it"); assert.ok(will.state.flags.includes("lore.q.lore.cell_log"));
  ned.props.examine("q.haldane_bowls"); assert.ok(!ned.lore.isFound("q.lore.bowls"), "five bowls tell nothing yet");
  ned.community.state.households.haldane.bowls = 4; ned.props.examine("q.haldane_bowls"); assert.ok(ned.lore.isFound("q.lore.bowls"));
  assert.equal(ned.lore.find("q.lore.corner"), false, "the corner needs the blame");
  ned.state.vars.q_figure = "blamed"; assert.equal(ned.lore.find("q.lore.corner"), true);
  const later = game("inspector"); assert.equal(later.props.state("q.burial_fence").id, "gap");
  later.lore.seedPrior(["q.fact.cell_log"]); assert.equal(later.props.state("q.burial_fence").id, "dug", "an earlier run's cell log finds the corner dug over: no stone, nothing to stand in front of");
  later.props.examine("q.burial_fence"); assert.ok(later.lore.isFound("q.lore.stone"));
});

test("the lore lint catches each kind of bad record", () => {
  const bad = `@lore x.surface
chain: q.missing_tomas
layer: surface
where: node q.nowhere
requires: class clerk
about: x

@lore x.hidden
chain: x.nochain
layer: hidden
where: prop q.haldane_bowls seven
about: x

@lore x.prior
chain: q.missing_tomas
layer: deep
where: prop q.burial_fence dug
requires: prior q.fact.never
about: x

@lore x.cross
chain: q.missing_tomas
layer: hidden
where: prop q.burial_fence dug
requires: choice q_figure == true
about: x

@chain x.route
route: one-run | q.lore.bowls, x.missing
`;
  const C = loadContent([...base, { file: "bad.lwd", text: bad }]);
  const msgs = lintLore(C, text + bad).map((o) => o.msg).join("\n");
  for (const re of [/x\.surface: where: no node q\.nowhere/, /x\.surface: requires class clerk, a value q_class never takes/, /x\.surface: a surface fragment is for anyone/,
    /x\.hidden: no @chain x\.nochain/, /x\.hidden: where: the prop q\.haldane_bowls has no state seven/, /x\.hidden: a hidden fragment needs a class, a choice or a prior fact/,
    /x\.prior: requires prior q\.fact\.never, which no fragment gives/, /x\.prior: a fragment found across runs is hidden/,
    /x\.cross: found through q\.burial_fence dug, which reads prior\(q\.fact\.cell_log\), so it must say requires: prior q\.fact\.cell_log/,
    /chain x\.route: route one-run needs x\.missing, which does not exist/, /chain x\.route: route one-run needs q\.lore\.bowls, which is in chain q\.missing_tomas/]) assert.match(msgs, re);
});

test("the played check: orphans, a two-class route one run holds whole, a route nobody completes, a prior fragment on a fresh run", () => {
  const good = [
    { build: "a", cls: "inspector", lore: ["q.lore.bowls", "q.lore.ledger", "q.lore.notebook", "q.lore.corner"] },
    { build: "b", cls: "militia", lore: ["q.lore.cell_log"] },
    { build: "c", cls: "militia", lore: ["q.lore.stone"], seeded: true },
    { build: "d", cls: "inspector", lore: ["q.lore.bowls", "q.lore.ledger", "q.lore.boots"] },
    { build: "e", cls: "militia", lore: ["q.lore.bowls", "q.lore.cell_log", "q.lore.carry"] },
  ];
  assert.equal(checkLorePlay(content, good).errors, 0, checkLorePlay(content, good).lines.join(" | "));
  const res = checkLorePlay(content, [
    { build: "a", cls: "inspector", lore: ["q.lore.bowls", "q.lore.ledger", "q.lore.cell_log", "q.lore.stone"] },
  ]).lines.join("\n");
  assert.match(res, /q\.lore\.notebook \(deep\): an orphan/);
  assert.match(res, /the two-classes route is held whole by one run \(a\)/);
  assert.match(res, /route across-runs .* is completed by no runs its rule allows/);
  assert.match(res, /q\.lore\.stone found on a fresh run \(a\)/);
});
