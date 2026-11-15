// The reckoning (rules/reckoning.mjs; design/DIRECTOR.md pillar 4): the gap between what Lamb
// professes and what Lamb does, counted on the real Act 1 content.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { compileEffects, runEffects } from "../core/expr.mjs";
import { gapsFor } from "../rules/reckoning.mjs";
import { ROOT } from "./helpers.mjs";

const ACT1 = join(ROOT, "..", "..", "content", "act1", "act1.lwd");
let C1 = null;
const content = async () => (C1 ||= loadContent((await loadAct(ACT1, (p) => readFile(p, "utf8"))).sources));
const fresh = async () => { const G = createFullGame({ content: await content(), seed: 3 }); G.create({ archetype: "p.condoler", enter: false }); return G; };
const run = (G, src) => runEffects(compileEffects(src), G.scope);

test("gapsFor: a move against a held conviction is a gap; a move with it, or with none held, is not", () => {
  assert.deepEqual(gapsFor(["conviction.fire"], "lean_rise", -1), ["conviction.fire"]);
  assert.deepEqual(gapsFor(["conviction.fire"], "lean_rise", +1), []);
  assert.deepEqual(gapsFor([], "lean_rise", -1), [], "nothing professed, nothing betrayed");
  assert.deepEqual(gapsFor(["conviction.dry"], "lean_sea", +1), ["conviction.dry"], "taking any side betrays no side");
  assert.deepEqual(gapsFor(["conviction.dry"], "lean_dry", +1), [], "sitting on the fence keeps that conviction");
  assert.deepEqual(gapsFor(["conviction.checked"], "lantern", +1), ["conviction.checked"]);
});

test("the script's own effects count: a drift tag against an inked conviction opens the gap and names it", async () => {
  const G = await fresh();
  run(G, "var.lean_rise -= 1");
  assert.equal(+G.state.vars.gap || 0, 0, "no conviction inked: no gap");
  G.setFlag("conviction.fire", true);
  run(G, "var.lean_rise += 1");
  assert.equal(+G.state.vars.gap || 0, 0, "acting on it is no gap");
  run(G, "var.lean_rise -= 1");
  assert.equal(G.state.vars.gap, 1);
  assert.ok(G.flag("gap.fire"), "the betrayal is a flag the script can quote");
  assert.equal(G.reckoning.log().length, 1);
});

test("lies and broken promises count; a relapse does not", async () => {
  const G = await fresh();
  G.setFlag("lied.keep_marrow", true);
  assert.equal(G.state.vars.gap, 1);
  assert.ok(G.flag("gap.lied"));
  G.setFlag("broke.lugg_promise", true);
  assert.equal(G.state.vars.gap, 1, "a promise never made cannot be broken");
  G.setFlag("said.lugg_promise", true); G.setFlag("broke.lugg_promise", false); G.setFlag("broke.lugg_promise", true);
  assert.equal(G.state.vars.gap, 3, "a broken promise counts double");
  G.setFlag("theme.relapse", true);
  assert.equal(G.state.vars.gap, 3, "recovery is an hour and then the next; a relapse is not a lie");
});

test("the cost is felt in the sums, and owning it changes them back", async () => {
  const G = await fresh();
  const before = { condolence: G.sheet.skill("condolence"), pride: G.sheet.skill("pride") };
  run(G, "var.gap = 3");
  assert.equal(G.sheet.skill("condolence"), before.condolence - 1, "they have heard you say it both ways");
  assert.equal(G.sheet.skill("pride"), before.pride + 1, "the comfortable story");
  run(G, "var.owned += 2");
  assert.equal(G.reckoning.open(), 1);
  assert.equal(G.sheet.skill("condolence"), before.condolence + 1, "owned twice: people remember it");
  assert.equal(G.sheet.skill("pride"), before.pride);
});
