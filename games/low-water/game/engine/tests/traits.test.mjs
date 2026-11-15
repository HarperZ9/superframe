// The traits pass (design/TRAITS.md, 2026-10-23): every trait the character carries is a being he meets inside, and
// raising it and fighting it are the same story. Checked here: the story's ruleset and the combat table name the same
// twenty traits; the sheet's level reaches the dream and makes the being bigger; each ending of a night changes the
// trait in him (cut back, made terms with, lost to) and the sheet reads it in every later check; the night is felt in
// the body as it opens and as he wakes; an old save and an old hinge id still find Steady Hand under its new id.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { COMPARTMENT_TRAITS, VOICE_TRAITS, embodied, OUTCOME_MARK, flawId } from "../combat/data/traits.mjs";
import { FLAWS } from "../combat/data/flaws.mjs";
import { createInnerRun } from "../combat/arena/inner.mjs";
import { createInnerWorld } from "../combat/arena/innerworld.mjs";
import { makeG } from "../combat/tests/helpers.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const content = loadContent((await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources);
const game = (cls, heard = []) => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: cls === "militia" ? "q.will" : "q.ned", enter: false }); G.state.vars.q_class = cls; G.state.selfLies = heard.map((id) => ({ id })); return G; };

test("the ruleset and the combat table name the same twenty traits, under the same compartments, and every voice has one being", () => {
  const G = game("inspector");
  for (const [id, t] of Object.entries(COMPARTMENT_TRAITS)) assert.equal(G.rs.attrs[id].name, t.name, `compartment ${id}`);
  for (const [id, t] of Object.entries(VOICE_TRAITS)) {
    assert.equal(G.rs.skills[id].name, t.name, `voice ${id}`); assert.equal(G.rs.skills[id].attr, t.of, `${id} sits under ${t.of}`);
    assert.equal(FLAWS[t.flaw].trait, id, `${t.name} is embodied by ${t.flaw}`);
  }
  const paper = /\b(PEN|HAT|FORM LETTER|SMALL PRINT|PRECEDENT|CARBON|HEFT|CHIT|HEARSAY|LEDGER|RECEIPT)\b/;
  for (const r of [...Object.values(G.rs.attrs), ...Object.values(G.rs.skills)]) assert.ok(!paper.test(r.name), `${r.id} is still named for paper: ${r.name}`);
  // the control: the old name would fail
  assert.ok(paper.test("FORM LETTER"));
});

test("raising a trait makes its being bigger: the dream reads the sheet's level, and a thin trait is a smaller thing", () => {
  const f = FLAWS.prudence, W5 = createInnerWorld({ G: makeG(), flaw: f, levels: { sum: 5 } }), W9 = createInnerWorld({ G: makeG(), flaw: f, levels: { sum: 9 } }), W2 = createInnerWorld({ G: makeG(), flaw: f, levels: { sum: 2 } });
  const hp = (W) => W.byId("boss").hpMax, dmg = (W) => W.moves["prudence.hammer"].dmg;
  assert.ok(hp(W9) > hp(W5) && hp(W5) > hp(W2), `standing ${hp(W2)} < ${hp(W5)} < ${hp(W9)}`);
  assert.ok(dmg(W9) > dmg(W5), "it hits harder"); assert.equal(W9.inner.trait.trait, "sum"); assert.equal(W9.inner.trait.level, 9);
  assert.deepEqual(embodied(5), { standing: 1, harm: 1 }); assert.ok(embodied(40).standing <= 1.5 && embodied(-10).standing >= 0.82, "bounded");
});

test("the hinge carries the sheet into the dream, and the night is felt as it opens", () => {
  const G = game("inspector", ["q.sl.signed"]), t = G.talk("q.inner.prudence");
  assert.equal(t.beat.inner.id, "prudence"); assert.equal(t.beat.inner.levels.sum, G.sheet.skill("sum"), "PRUDENCE at his own level");
  assert.ok((G.state.cues || []).some((c) => c.id === "trait.sum.near"), "PRUDENCE's presence before the night");
});

test("every ending changes the trait in him, and the sheet reads it: cut back by force, terms keep its ear, losing gives it him", () => {
  for (const [verb, mark] of [["force", "force"], ["yield", "terms"], ["lose", "lose"]]) {
    const G = game("inspector", ["q.sl.signed"]), before = G.sheet.skill("sum"), t = G.talk("q.inner.prudence");
    const recs = [{ type: "inner.outcome", flaw: "prudence", verb, outcome: verb === "force" ? "forced" : verb === "lose" ? "down" : "laid", scene: "q_ned", beat: "x" },
      { type: "trait.change", flaw: "prudence", trait: "sum", mark, delta: OUTCOME_MARK[mark] }];
    t.afterInner(t.beat.inner, recs);
    assert.equal(G.sheet.skill("sum"), before + OUTCOME_MARK[mark], `${verb}: PRUDENCE ${before} becomes ${before + OUTCOME_MARK[mark]}`);
    assert.ok(G.sheet.mods("skill.sum").some((m) => /inside/.test(m.why)), `${verb}: the sheet names the night as the reason`);
    const cue = { force: "trait.cut", terms: "trait.terms", lose: "trait.taken" }[mark];
    assert.ok((G.state.cues || []).some((c) => c.id === cue), `${verb}: ${cue} felt on waking`);
  }
});

test("an inner run records what each ending does to its trait, and nothing else carries a number", () => {
  const got = [], R = createInnerRun({ flaw: "only", onRecord: (e) => got.push(e) });
  R.finish({ result: { outcome: "fled", verb: "refuse" } });
  const ch = got.find((e) => e.type === "trait.change");
  assert.deepEqual({ trait: ch.trait, mark: ch.mark, delta: ch.delta }, { trait: "knees", mark: "terms", delta: 1 });
  const out = got.find((e) => e.type === "inner.outcome"); assert.ok(!("delta" in out) && !("level" in out), "the outcome record itself stays a turning point");
});

test("the old id still works: inner(received) and a save holding state.inner.received both reach Steady Hand as prudence", () => {
  assert.equal(flawId("received"), "prudence"); assert.equal(flawId("friday"), "friday");
  const G = game("inspector", ["q.sl.signed"]); G.state.inner = { received: { verb: "force" } };
  assert.deepEqual(G.innerHinge.resolved(), { prudence: "force" }, "the save's record migrated");
  assert.ok(!G.innerHinge.armed("received"), "already fought under its old name");
  const R = createInnerRun({ flaw: "received", heard: [{ id: "q.sl.signed" }] }); assert.equal(R.flaw.id, "prudence");
});
