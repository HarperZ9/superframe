// The found-gear card's numbers (ui/gearcard.mjs): tiers from the bench, and the rows against the tool in hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tierOf, compareRows, TIERS as tiers } from "../ui/gearcard.mjs";

test("tiers: plain, sound, tempered, true (temper 5 or old bronze)", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((t) => tierOf(t).id), ["plain", "sound", "sound", "tempered", "tempered", "true"]);
  assert.equal(tierOf(0, true).id, "true");
});

test("rows mark what is better: more damage, less breath, a lighter load", () => {
  const now = { light: 1, heavy: 2, strikes: { light: { breath: 1.2 } }, load: { band: "medium" } };
  const found = { light: 1.4, heavy: 1.8, strikes: { light: { breath: 1.0 } }, load: { band: "light" } };
  const r = Object.fromEntries(compareRows(now, found).map((x) => [x.label, x.better]));
  assert.deepEqual(r, { "Light blow": 1, "Heavy blow": -1, "Breath a swing": 1, Load: 1 });
});

test("the colour ladder runs white, blue, purple, gold, and the band widens with the tier", () => {
  const { TIERS } = { TIERS: tiers };
  assert.deepEqual(TIERS.map((t) => t.id), ["plain", "sound", "tempered", "true"]);
  for (let i = 1; i < TIERS.length; i++) assert.ok(TIERS[i].rule > TIERS[i - 1].rule, "a wider band each tier");
  const hue = (hex) => { const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; return { s: mx ? d / mx : 0, h: !d ? 0 : mx === r ? (60 * ((g - b) / d) + 360) % 360 : mx === g ? 60 * ((b - r) / d) + 120 : 60 * ((r - g) / d) + 240 }; };
  assert.ok(hue(TIERS[0].colour).s < 0.2, "plain is a chalk white");
  assert.ok(hue(TIERS[1].colour).h > 180 && hue(TIERS[1].colour).h < 220, "sound is blue");
  assert.ok(hue(TIERS[2].colour).h > 250 && hue(TIERS[2].colour).h < 290, "tempered is violet");
  assert.ok(hue(TIERS[3].colour).h > 30 && hue(TIERS[3].colour).h < 50, "true is gold");
});
