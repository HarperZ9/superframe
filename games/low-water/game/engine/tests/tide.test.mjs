import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "../tools/tidelint.mjs";
import { tideAt, tideTurn, tideDir } from "../world/night.mjs";
import { toMin } from "../core/expr.mjs";
import { tideWords } from "../ui/hudtab.mjs";

const N2 = { low: { at: toMin("23:46"), h: -0.42 }, high: { at: toMin("05:58"), h: 5.1 } };
const R = { low: -0.42, high: 5.1 };
const row = (clock, text) => ({ clock: toMin(clock), tide: +tideAt(N2, toMin(clock)).toFixed(2), rising: tideAt(N2, toMin(clock) + 5) > tideAt(N2, toMin(clock)), text });

test("the tide lint catches the old 14:05 line and passes its rewrite", () => {
  assert.equal(check(row("14:05", "The harbour is a grey plain with pools in it that hold the sky. The tide is out again."), R).length, 2);
  assert.deepEqual(check(row("14:05", "The flats in the harbour are going under one pool at a time. The tide is on the make again."), R), []);
  assert.equal(check(row("14:05", "The tide is going out."), R).length, 1, "a falling claim on a rising tide is caught");
});

test("forecasts, past turns, similes and the title are not claims about now", () => {
  for (const t of ["High water at 05:58, 5.10 metres.", "Leave on the ebb or row against it.", "The ebb has turned.", "Like a tide coming in.", "LOW WATER ENDS.", "The Brine wants salt before high water."])
    assert.deepEqual(check(row("14:05", t), R), [], t);
});

test("the night's tide turns and direction follow its low and high water", () => {
  assert.deepEqual(tideTurn(N2, toMin("01:00")), { kind: "high", at: toMin("05:58"), h: 5.1 });
  assert.equal(tideTurn(N2, toMin("14:00")).kind, "high", "the afternoon flood runs to the evening high");
  assert.equal(tideDir(N2, toMin("14:00")), "rising");
  assert.equal(tideDir(N2, toMin("23:50")), "slack");
  assert.equal(tideDir(N2, toMin("03:00")), "rising");
});

test("the HUD names high water from the night's range, not fixed metres", () => {
  assert.equal(tideWords(2.53, 1, R), "rising", "+2.53 m on a 5.1 m night is half tide (the 14:36 mole defect)");
  assert.equal(tideWords(4.9, 1, R), "high water");
  assert.equal(tideWords(-0.3, -1, R), "low water");
});

import { sweepWaitRow } from "../tools/tidelint.mjs";
import { waitLabel } from "../ui/waiting.mjs";
const N3 = { low: { at: toMin("00:34"), h: -0.3 }, high: { at: toMin("06:44"), h: 6.2 } };

test("the waiting row never offers the water the tide already stands at, and the sweep would catch it", () => {
  assert.equal(waitLabel({ tide: 5.77, dir: "rising", next: "high", at: toMin("06:44"), clock: toMin("05:43"), range: { low: -0.3, high: 6.2 } }).text, "Wait for the turn at high water");
  assert.deepEqual(sweepWaitRow(N3, toMin("19:08"), toMin("06:44")), []);
  const old = ({ dir }) => ({ text: dir === "falling" ? "Wait for low water" : dir === "rising" ? "Wait for high water" : "Wait for the tide to turn", minutes: 180 }); // the rule before 2026-10-21
  assert.ok(sweepWaitRow(N3, toMin("19:08"), toMin("06:44"), old).length > 0, "the old rule offered high water at high water (the Brine at 05:43)");
});

import { check as clockCheck, statements } from "../tools/clocklint.mjs";
test("the clock lint catches a night that opens mid-afternoon under 'ten past seven', and passes it at its hour", () => {
  const nar = "Ten past seven. In the weigh-house somebody puts the quay switch up, and the click carries the length of the quay in the frost.";
  assert.equal(clockCheck({ nar, clock: toMin("16:00") }).length, 1, "the Act 2 night as it opened before 2026-10-21");
  assert.deepEqual(clockCheck({ nar, clock: toMin("19:10") }), []);
  assert.equal(clockCheck({ nar: "Eight minutes past seven. The wind has come round the Spit ahead of itself.", clock: toMin("13:02") }).length, 1, "the gale as it opened");
});
test("the clock lint reads only what tells the time now", () => {
  for (const t of ["Nobody in till the pans come down at twenty to one, says the larger.", "A Board boatman says the Shelf's midnight word out loud.", "02:51, ALDERMAN BY TELEPHONE: NO HURRY.", "\"It is twenty to ten, or near it.\"", "The church clock is eleven minutes slow, or it is not."])
    assert.deepEqual(statements(t), [], t);
  assert.equal(statements("The church clock on the hill says a quarter past two.").length, 1);
});
test("the clock lint's tolerance follows how exact the statement is, and catches the prologue's 19 minutes", () => {
  const pro = "The deck of the Saint Cuthwin, twenty-two minutes past ten by the ship's clock.";
  assert.equal(clockCheck({ nar: pro, clock: toMin("22:41") }).length, 1, "to the minute: 5 minutes allowed");
  assert.deepEqual(clockCheck({ nar: pro, clock: toMin("22:20") }), []);
  assert.deepEqual(clockCheck({ nar: "Half past three. The wind has gone round.", clock: toMin("03:42") }), [], "a half hour: 15 allowed");
  assert.equal(clockCheck({ nar: "Ten past five. High water.", clock: toMin("05:22") }).length, 1, "to five minutes: 10 allowed");
  assert.deepEqual(clockCheck({ nar: "It is twenty to ten, or near it.", clock: toMin("22:05") }), [], "hedged: 30 allowed");
  assert.deepEqual(clockCheck({ narAt: [[toMin("22:24"), "The clock in the wheelhouse door says twenty-four minutes past ten."]], clock: toMin("22:43") }), [], "each line against its own clock");
});
