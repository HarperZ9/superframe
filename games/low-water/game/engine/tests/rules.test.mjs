import { test } from "node:test";
import assert from "node:assert/strict";
import { game, pick, labels } from "./helpers.mjs";

const option = (t, text) => t.beat.options.find((o) => o.label.includes(text));

test("fixed checks: success when the level meets the target, no line printed after", () => {
  const G = game({ mode: "fixed" }); G.create({ archetype: "a.clerk", enter: false }); G.setPlace("t.bar");
  const t = G.talk("t.r.hub"), o = option(t, "[LEDGER]");
  assert.equal(o.check.total, 5, "wits 4 + training 1");
  assert.equal(o.check.odds, 0, "fixed mode reads 0 or 1");
  pick(t, "[LEDGER]");
  assert.ok(t.beat.lines.every((l) => l.kind !== "check"), "the scene shows the result; no tally line");
  assert.ok(t.beat.lines.some((l) => l.text === "Test: failure."));
  assert.ok(G.memory.history().some((l) => l.kind === "check" && l.hidden), "the history keeps the sum");
});

test("pencil checks lock until the sum changes: 'Nothing has changed.'", () => {
  const G = game({ mode: "fixed" }); G.create({ archetype: "a.clerk", enter: false }); G.setPlace("t.bar");
  const t = G.talk("t.r.hub"); pick(t, "[LEDGER]");
  assert.equal(option(t, "[LEDGER]").locked, "Nothing has changed.");
  const before = t.beat; t.choose(option(t, "[LEDGER]").index); assert.equal(t.beat, before, "a locked option does nothing");
  G.state.sheet.points = 1; assert.ok(G.sheet.raise("ledger"));
  t.jump("t.r.hub");
  assert.equal(option(t, "[LEDGER]").locked, null, "a rank raised the sum: try again");
});

test("ink (red) checks are tried once", () => {
  const G = game({ mode: "fixed" }), t = G.start();
  pick(t, "[Brass] Bluff.");
  t.jump("t.speaker.hub");
  assert.ok(!labels(t).includes("[Brass] Bluff."));
});

test("dice checks are a pure function of the seed: reloading does not change luck", () => {
  const roll = () => { const G = game({ mode: "dice" }); const t = G.start(); pick(t, "[Eye] Look closer."); return t.beat.lines.find((l) => l.kind === "check").check.roll; };
  assert.deepEqual(roll(), roll());
});

test("environment modifiers are parts of the sum, each with its reason", () => {
  const G = game({ mode: "fixed" }); G.setPlace("t.quay");
  const b = G.checks.breakdown("eye");
  assert.ok(b.parts.some((p) => p.why === "Sodium light" && p.amount === -1));
  G.env.command(["setTerm", "fog", "0.08"]);
  assert.ok(G.checks.breakdown("eye").parts.some((p) => p.why === "Fog" && p.amount === -2));
});

test("R1 strain on a meter: +n for cost, refused when it would fill the meter", () => {
  const G = game({ mode: "fixed" }); G.create({ archetype: "a.clerk", enter: false }); G.setPlace("t.bar");
  const t = G.talk("t.r.hub"), o = option(t, "[LEDGER]");
  assert.deepEqual(o.strain(2), { ok: true, n: 2, kind: "meter", id: "tension", cost: 4 });
  pick(t, "[LEDGER]", { strain: 2 });
  assert.equal(G.pressure.meter("tension"), 4);
  assert.ok(t.beat.lines.some((l) => l.text === "Test: success."), "5 + 2 meets 7");
  G.pressure.addMeter("tension", 4);
  const o2 = option(t, "[LEDGER]"); // passed: hidden; use a fresh preview through the API
  assert.equal(o2, undefined);
  assert.equal(G.checks.strain("ledger", 1).ok, false, "8 + 2 would fill 10");
});

test("R1 strain in favour with the speaker's faction; nostrain; instruments cannot", () => {
  const G = game({ mode: "fixed" }), t = G.talk("t.r.hub");
  const b = option(t, "[BRASS]").strain(2);
  assert.deepEqual([b.ok, b.kind, b.id, b.cost], [true, "rep", "guild", 2], "SPEAKER is t.speaker of the guild");
  pick(t, "[BRASS]", { strain: 2 });
  assert.equal(G.factions.get("guild"), -2);
  assert.equal(option(t, "[EYE]").strain(1).ok, false);
  assert.equal(option(t, "[EYE]").canStrain, false);
  assert.equal(option(t, "[GAUGE]").canStrain, false, "no attribute: cannot be strained");
});

test("R2 train: no never takes ranks; its level is base plus modifiers", () => {
  const G = game({ mode: "fixed" }); G.state.sheet.points = 3;
  assert.equal(G.sheet.canRaise("gauge"), false);
  assert.equal(G.sheet.skill("gauge"), 3);
  G.env.command(["gust", "8", "30"]); // wind 6 + 8 > 12
  assert.equal(G.sheet.skill("gauge"), 2);
});

test("R6 an archetype's trait starts done and its items are worn", () => {
  const G = game(); G.create({ archetype: "a.clerk", enter: false });
  assert.equal(G.cabinet.status("t.night_eyes"), "done");
  assert.ok(G.inv.isWorn("coat"));
  assert.deepEqual(G.cabinet.completed(), ["t.night_eyes"]);
});

test("character creation: a custom spread must spend the points; trusted adds one", () => {
  const G = game();
  assert.ok(G.create({ attrs: { wits: 5, nerve: 5, hands: 5 } }).length > 0);
  assert.deepEqual(G.create({ attrs: { wits: 3, nerve: 3, hands: 3 }, archetype: "a.diver", trusted: "gauge", enter: false }), []);
  assert.equal(G.sheet.attr("wits"), 3);
  assert.equal(G.sheet.ranks("knots"), 0, "a custom spread takes no archetype ranks");
  assert.equal(G.sheet.skill("gauge"), 4);
});

test("R9 pages buy a rank, a slot (to the max) or forget a trait", () => {
  const G = game(); G.rs.rules["forget-cost"] = 1;
  G.state.sheet.points = 5;
  assert.equal(G.cabinet.slots(), 2);
  assert.equal(G.cabinet.buySlot(), null); assert.equal(G.cabinet.slots(), 3);
  G.rs.rules["cabinet-slots-max"] = 3;
  assert.equal(G.cabinet.buySlot(), "The margin is full");
  G.cabinet.offer("t.tide_reader"); assert.equal(G.cabinet.research("t.tide_reader"), null);
  assert.equal(G.cabinet.forget("t.tide_reader"), null);
  assert.equal(G.state.sheet.points, 3);
  assert.equal(G.cabinet.status("t.tide_reader"), "found");
});

test("traits research over game minutes: costs while pencilled, effects when inked", () => {
  const G = game(); G.cabinet.offer("t.tide_reader"); G.cabinet.research("t.tide_reader");
  assert.ok(G.checks.breakdown("ledger").parts.some((p) => p.amount === -1 && /researching/.test(p.why)));
  G.advance(30);
  assert.equal(G.cabinet.status("t.tide_reader"), "done");
  assert.equal(G.state.sheet.xp, 10, "the trait's do: ran");
});

test("crafting, salvage and restoration projects take what they need", () => {
  const G = game(); G.inv.give("knife"); G.inv.give("wick"); G.inv.give("glass");
  assert.equal(G.inv.craft("r.lantern"), null);
  assert.equal(G.inv.count("lantern"), 1);
  assert.equal(G.inv.salvage("lantern"), null);
  assert.deepEqual([G.inv.count("wick"), G.inv.count("glass")], [1, 1]);
  assert.match(G.settlement.whyNot("p.jetty"), /Needs 1 Timber/);
  G.inv.give("timber", 3); G.inv.give("nails");
  G.settlement.contribute("p.jetty"); G.settlement.contribute("p.jetty");
  assert.equal(G.settlement.done("p.jetty"), 2);
  assert.ok(G.flag("t.jetty_built"));
});
