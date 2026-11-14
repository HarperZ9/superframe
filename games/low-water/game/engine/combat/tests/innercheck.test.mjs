// The inner arena's checkers, each with its planted controls (combat/PROGRESS.md 29: S1 to S6, B1, B2, R1, R2, F2).
import { VOICE_TRAITS, COMPARTMENT_TRAITS } from "../data/traits.mjs";
import { SIN_WORDS } from "../arena/hud.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeG } from "./helpers.mjs";
import { loadContent } from "../tools/innerctx.mjs";
import { checkAll, runControls } from "../tools/flawcheck.mjs";
import { checkFlawPlayed, checkHostPlayed, CONTROLS as FORCE_CONTROLS } from "../tools/forcecheck.mjs";
import { checkBoons, CONTROLS as BOON_CONTROLS } from "../tools/boonledger.mjs";
import { checkLadders, checkArming, checkRun, checkCaptions, hudTexts, judgeTexts } from "../tools/notallycheck.mjs";
import { createInnerRun } from "../arena/inner.mjs";
import { FLAWS } from "../data/flaws.mjs";

const ctx = loadContent();

test("flawcheck: every flaw and the Adversary pass, and every planted control fails", () => {
  assert.deepEqual(checkAll(ctx), []);
  for (const c of runControls(ctx)) assert.ok(c.failed, `control passed: ${c.name}`);
});

test("forcecheck: resolutions reach their ends, force never reaches one, meant-to-lose holds, the story's state holds; controls fail", () => {
  for (const f of Object.values(FLAWS)) assert.deepEqual(checkFlawPlayed(makeG, f, [1, 2]).errs, [], f.id);
  assert.deepEqual(checkHostPlayed(makeG, [1]).errs, []);
  for (const [name, make, want] of FORCE_CONTROLS) assert.ok(checkFlawPlayed(makeG, make(), [1]).errs.some((e) => want.test(e)), `control passed: ${name}`);
});

test("boonledger: offers only after force, every cost on a named person and recorded at once; controls fail", () => {
  assert.deepEqual(checkBoons(ctx), []);
  for (const [name, opt, want] of BOON_CONTROLS) assert.ok(checkBoons(ctx, opt).some((e) => want.test(e)), `control passed: ${name}`);
});

test("notallycheck: turning points only, no storage, no count, no figure on the HUD; controls fail", async () => {
  assert.deepEqual([...checkLadders(), ...checkArming(), ...checkRun({ makeG })], []);
  assert.deepEqual(judgeTexts(await hudTexts({ makeG, flaw: "prudence", frames: 60 * 20 })), []);
  assert.ok(checkLadders({ ladders: { planted: ["foreman", "prudence"] } }).length, "a ladder with an inner boss");
  assert.ok(checkArming({ makeRun: (o) => createInnerRun({ ...o, heard: null }) }).length, "a hinge armed without its self-lie");
  assert.ok(checkRun({ makeG, makeRun: (o) => { const R = createInnerRun(o); const f = R.finish; R.finish = (W) => { globalThis.localStorage.setItem("lw.inner", "1"); f(W); }; return R; } }).length, "a run that writes storage");
  assert.ok(judgeTexts(["STANDING", "flaws beaten: 3"]).length, "a HUD that draws a tally");
});

test("notallycheck R3: no sin on the player's surface; the shown names are the traits (Friday's lines are captioned APPETITE, the voice id grip); controls fail", async () => {
  assert.deepEqual(checkCaptions(), []);
  assert.equal(FLAWS.friday.town, "Appetite"); assert.equal(FLAWS.friday.title, "Friday");
  for (const f of Object.values(FLAWS)) assert.ok(f.town && f.title && f.town !== f.title, `${f.id}: a trait for its shown name, the title kept apart`);
  for (const t of [...Object.values(VOICE_TRAITS), ...Object.values(COMPARTMENT_TRAITS)]) assert.ok(!SIN_WORDS.test(t.name), `the trait ${t.name} names a sin`);
  assert.deepEqual(judgeTexts(await hudTexts({ makeG, flaw: "friday", frames: 60 * 12 })), []);
  assert.ok(judgeTexts(["PRIDE  I never once did it for nothing."]).length, "a caption naming a sin");
  assert.ok(judgeTexts(["fear in the uniform of duty"]).length, "a flaw's own sin label");
  assert.ok(checkCaptions({ caption: (W, l) => String(l.voice || "").toUpperCase() }).length, "a caption rule that passes voices through");
});
