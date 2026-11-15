// P2: frame data for T5 (catch window and lockout) and T9 (telegraph lead), COMBAT-SPEC section 3.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, run, press } from "./helpers.mjs";
import { SPECIALS } from "../data/foes.mjs";
import { BOSS_SPECIALS } from "../data/bosses.mjs";
import { ARENA_SPECIALS } from "../data/archetypes.mjs";
import { TOOLS, profileOf, buildToolMoves } from "../data/tools.mjs";
import { FOE_WINDUP } from "../roster.mjs";
import { RULES } from "../data/common.mjs";

const foeMoves = () => {
  const all = { ...SPECIALS, ...BOSS_SPECIALS, ...ARENA_SPECIALS };
  for (const t of Object.keys(TOOLS)) Object.assign(all, buildToolMoves(profileOf(t), { prefix: `${t}:`, windup: FOE_WINDUP }));
  return all;
};

test("T9: every tell leads its first active frame by 18 frames, 30 when unparryable", () => {
  const short = [];
  for (const [id, m] of Object.entries(foeMoves())) {
    if (!m.tell) continue;
    const lead = m.startup - m.tell.at[0], need = m.parryable === false ? 30 : 18;
    if (lead < need) short.push(`${id} ${lead} < ${need}`);
  }
  assert.deepEqual(short, []);
});

test("T5: catch windows are 8 to 10 frames, 11 to 12 with a shield", () => {
  for (const t of Object.keys(TOOLS)) {
    const P = profileOf(t), m = buildToolMoves(P, {})["catch"], w = m.parry[1] - m.parry[0] + 1;
    const [lo, hi] = P.cls === "shield" ? [11, 12] : [8, 10];
    assert.ok(w >= lo && w <= hi, `${t} (${P.cls}) catch ${w} frames`);
  }
});

test("T5: a missed catch locks out the next for 24 frames; mashing cannot hold the window open", () => {
  const W = makeWorld({}), L = W.lamb(), starts = [];
  for (let i = 0; i < 200; i++) { for (const e of W.step(press("catch"))) if (e.type === "move" && e.id === "lamb" && W.moves[e.move].parry) starts.push(W.tick); }
  assert.ok(starts.length >= 2, `catches started: ${starts.length}`);
  const total = W.moves[L.act ? L.act.id : Object.keys(W.moves).find((k) => k.endsWith("catch") && k.startsWith("lamb"))].total;
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= total + RULES.catchLockout, `gap ${starts[i] - starts[i - 1]}`);
});
