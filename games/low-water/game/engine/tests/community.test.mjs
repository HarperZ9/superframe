// The Quota slice: the community model (world/community.mjs, content/quota/q_community.lwd) on the story
// lead's scenes (content/quota/q_*.lwd): the record with its victims, class gating, the granary door, the
// success criterion that the reported figure changes the coda's table (design/quota/07-PRODUCTION.md), and
// the coordinator's rulings of 2026-10-21 (no clean ending, slow uneven rhetoric, losing the door as story).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { meterMarks } from "../ui/scene.mjs";
import { ROOT } from "./helpers.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const content = loadContent((await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources);
const ARCH = { inspector: "q.ned", militia: "q.will" };
const game = (cls = "inspector") => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: ARCH[cls], enter: false }); G.state.vars.q_class = cls; return G; };
const FIGURE = { true: "true", inflated: "inflated", blamed: "blamed" };
// the office for a class, and the option that assigns a figure
function report(G, cls, figure) {
  const t = G.talk(cls === "militia" ? "q.office.will" : "q.office.ned");
  const i = t.beat.options.findIndex((o) => new RegExp(`q_figure\\s*=\\s*${figure}\\b`).test(String((o.s.attrs || {}).do || "")));
  assert.ok(i >= 0, `${cls}: no option reports ${figure}`);
  t.choose(i); return t;
}

test("the model loads: three streets and a village row, era 2's three households among the fourteen of five eras, the eight rules of the brief, a carrier, no errors", () => {
  assert.deepEqual(content.errors.filter((e) => e.level !== "warn"), []);
  const M = content.community;
  assert.deepEqual(Object.keys(M.streets).sort(), ["haldane_yard", "hollow", "mill", "square"]); // hollow: the next village over, one row
  // The slice was one day of era 2 when this was written, with three households. slice.lwd now includes eras 1, 3, 4
  // and 5 (design/eras/INDEX.md), and each era's world file declares the households its fates press (e1_world.lwd,
  // e3_world.lwd, e4_world.lwd, e5_world.lwd). Era 2's three are pinned as before; the whole list is pinned as well,
  // so a household added or dropped in any era fails here.
  const era = (id) => (/^e(\d)_/.exec(id) || [null, "2"])[1];
  assert.deepEqual(Object.keys(M.households).filter((h) => era(h) === "2").sort(), ["brack", "furrowe", "haldane"]);
  assert.deepEqual(Object.keys(M.households).sort(), ["brack", "e1_sallis", "e1_tesk", "e3_prayer", "e3_sallis", "e3_sholl", "e4_lew", "e4_row", "e4_saro",
    "e5_haldane", "e5_record", "e5_saro", "furrowe", "haldane"]);
  assert.deepEqual(M.households.brack.members, ["Will", "Edie", "Davey"]);
  for (const r of ["R2", "R3", "R4", "R5", "R8", "R9", "R11", "R17"]) assert.ok(M.rules.some((x) => x.id === r), r);
  assert.ok(M.carriers.notices);
});

test("no meter on screen: the slice turns meters off, though it borrows a ruleset that has them", () => {
  const G = game();
  for (const m of Object.values(G.content.meters)) G.pressure.addMeter(m.id, 99);
  assert.deepEqual(meterMarks(G, { all: true }), []);
});

test("a rule waits its delay: the requisition (R2, 7 days) lands a week after the figure, and presses Bet's decision that day (no rule takes a bowl)", () => {
  const G = game(), C = G.community, food0 = C.stock("food", "haldane_yard");
  C.record("report.figure", "haldane", "haldane_yard"); C.shift("owed", 120, "haldane_yard");
  C.run(6); assert.equal(C.stock("food", "haldane_yard"), food0, "nothing taken in six days");
  C.run(1); assert.ok(C.stock("food", "haldane_yard") < food0, "taken on the seventh");
  assert.ok(C.chains()[0].steps.some((s) => s.path.map((p) => p.rule).join(">") === "R2" && s.name === "food"), "the chain from the figure to the food");
  assert.ok(C.pressure("f.anni_home"), "the requisition presses Anni's fate");
  assert.equal(C.bowls("haldane"), 5, "and no rule takes her bowl: Bet decides, in a scene");
});

test("the reported figure changes the coda's table: the pressures it arms, and Bet's decision at the gate", () => {
  const seen = {};
  for (const figure of Object.keys(FIGURE)) {
    const G = game(); report(G, "inspector", figure);
    G.talk("q.coda");
    seen[figure] = Object.keys(G.community.state.pressure).sort();
  }
  assert.deepEqual(seen, { true: [], inflated: ["f.anni_home"], blamed: ["f.aaron_taken", "f.anni_home"] });
  // the gate: with nobody bringing food, Bet lets Anni go in, and the bowl leaves the table by her decision
  const G = game(); report(G, "inspector", "inflated"); G.community.run(7);
  const t = G.talk("q.fate.gate"); t.choose(t.beat.options.findIndex((o) => /Say nothing/.test(o.label)));
  assert.ok(G.flag("q.anni_sent")); assert.equal(G.community.bowls("haldane"), 4);
  assert.equal(G.community.state.fates["f.anni_home"].decider, "BET");
});

test("the record keeps each event's victim, street and the player's own words, and a lie's gap names who it fell on", () => {
  const G = game(); report(G, "inspector", "blamed");
  const ev = G.reckoning.events(), rep = ev.find((e) => e.type === "report.figure");
  assert.ok(rep && rep.victim === "haldane" && rep.street === "haldane_yard");
  assert.ok(ev.some((e) => e.type === "blame.people"));
  assert.ok(rep.source && /Hesh/.test(rep.source.words) && rep.source.node === "q.office.ned", JSON.stringify(rep.source));
  // Until 2026-10-22 the office's outcome nodes set lied.figure, and this test read the gap it opened. The story lead
  // cut the flag that day with two others no line read: "lied.figure, because q_figure carries it" (PROGRESS.md step
  // 192). The lie is now kept as the figure, which the world record carries on (world-keep in slice.lwd). The rule in
  // this test's name is the engine's (rules/reckoning.mjs): a lied.* flag set in the beat of a record event opens a
  // gap that names the event's household and street. No scene sets one now, so the event and the flag are made here
  // in one beat, as the outcome node made them.
  assert.equal(G.state.vars.q_figure, "blamed", "the figure carries the lie");
  assert.deepEqual(G.state.flags.filter((f) => f.startsWith("lied.")), [], "no scene of the slice sets a lied.* flag; one that does brings its own assertion here");
  const near = game(); near.community.record("report.figure", "haldane", "haldane_yard"); near.setFlag("lied.figure", true);
  assert.ok(near.flag("gap.lied"));
  assert.ok(near.reckoning.log().some((l) => /lied\.figure@haldane\/haldane_yard$/.test(l)), near.reckoning.log().join(" | "));
  const far = game(); far.setFlag("lied.figure", true);
  assert.ok(far.reckoning.log().some((l) => /lied\.figure$/.test(l)), "the control: a lie with no record event beside it names nobody");
});

test("class gating: each line has its own morning and its own road", () => {
  for (const [cls, own, other] of [["inspector", "q.ned.", "q.will."], ["militia", "q.will.", "q.ned."]]) {
    const G = game(cls);
    G.talk("q.morning"); G.talk("q.afternoon");
    const seen = Object.keys(G.state.memory.visits);
    assert.ok(seen.some((n) => n.startsWith(own)) && !seen.some((n) => n.startsWith(other)), `${cls}: ${seen.join(", ")}`);
  }
});

test("the granary door: the Requisition Captain on the warden's pattern, and the talk-out only with the true figure in hand", () => {
  for (const [cls, inHand] of [["inspector", true], ["militia", false]]) {
    const G = game(cls);
    if (inHand) G.setFlag("q.true_in_hand", true);
    const W = G.ext.combat.start("e.q_granary");
    assert.ok(W.fighters.some((F) => W.defs[F.id].boss === "captain"), "the Captain");
    let talk = false;
    for (let i = 0; i < 60 * 6 && !W.result; i++) { G.ext.combat.step({}); W.lamb().hp = W.lamb().hpMax; if (W.talk) talk = true; }
    assert.equal(talk, inHand, `${cls}: talk-out ${inHand ? "offered" : "not offered"}`);
    G.ext.combat.current = null;
  }
});

test("no clean ending: every figure leaves at least one table poorer, and the honest figure's cost is at a table", () => {
  for (const cls of ["inspector", "militia"]) for (const figure of Object.keys(FIGURE)) {
    const G = game(cls); report(G, cls, figure); G.talk("q.coda");
    const C = G.community, poorer = C.bowls("haldane") < 5 || ["furrowe", "brack"].some((h) => C.stock("portion", h) < 1) || Object.keys(C.state.pressure).length > 0;
    assert.ok(poorer, `${cls}/${figure}: every table as it began`);
    if (figure === "true") {
      assert.ok(C.stock("portion", "brack") < 1, `${cls}: the Bracks' ration cut`);
      if (cls === "inspector") {
        assert.ok(C.stock("portion", "furrowe") < 1, "the Furrowes' own bowls shrink");
        assert.equal(C.stock("owed", "hollow"), 120, "Sallow's 320 for Tarn Hollow lands on the next village over");
        assert.ok(G.reckoning.events().some((e) => e.type === "replacement.figure" && e.street === "hollow"));
      }
    }
  }
});

test("the rhetoric is slow and uneven: Haldane Yard falls 0.3 in 30 to 40 days, the mixed streets less, and it recovers a little when the notices go quiet", () => {
  const G = game(), C = G.community;
  C.record("blame.people", "haldane", "haldane_yard"); C.shift("volume.notices", 0.3);
  const s0 = Object.fromEntries(["haldane_yard", "square", "mill"].map((s) => [s, C.stock("standing.hesh", s)]));
  let fell = null, low = 0;
  for (let d = 1; d <= 160; d++) { C.run(1); const v = C.stock("standing.hesh", "haldane_yard"); low = Math.min(low, v); if (fell == null && v <= s0.haldane_yard - 0.3) fell = d; if (d === 40) for (const s of ["square", "mill"]) assert.ok(s0[s] - C.stock("standing.hesh", s) < 0.15, `${s} at day 40`); }
  assert.ok(fell >= 30 && fell <= 40, `fell 0.3 on day ${fell}`);
  assert.ok(C.stock("standing.hesh", "haldane_yard") > low + 0.05, "some recovery once the notices fade");
});

test("losing the granary door is a story outcome: Will down, Anni sees, the cart taken, the record keeps it, the coda follows", () => {
  const G = game("militia");
  const t = G.talk("q.granary.broken");
  if (t.beat.options && G.perspective.active()) t.choose(0); // the night: Bet's chapter at the door (q_perspective.lwd), then on
  const ev = G.reckoning.events().find((e) => e.type === "door.lost");
  assert.ok(ev && ev.witness === "anni", JSON.stringify(ev));
  assert.ok(G.flag("q.will_down"));
  assert.ok(G.memory.visits("q.week") > 0, "on to the week and the coda, not a game over");
});

test("the granary door: a scripted Sergeant on the base sheet wins it about half the time", async () => {
  const { playDoor } = await import("../tools/quota/doorbench.mjs");
  const rows = Array.from({ length: 40 }, (_, i) => playDoor("militia", "inflated", i + 1)), won = rows.filter((r) => r.outcome === "win" || r.outcome === "yield").length;
  assert.ok(won >= 12 && won <= 28, `won ${won} of 40`);
});
