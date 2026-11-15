// The arena's ten archetypes (combat/data/archetypes.mjs): each builds, each fights, each uses its
// signature move, and its elite is harder and armoured through that move.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld } from "./helpers.mjs";
import { createPilot } from "../tools/pilot.mjs";
import { ARCHETYPES } from "../data/foes.mjs";
import { ARENA_ARCHETYPES, elite } from "../data/archetypes.mjs";
import { foeDef, fighterSpec } from "../roster.mjs";

const STYLES = ["holder", "skirmisher", ...Object.keys(ARENA_ARCHETYPES)];

test("ten archetypes, each with its signature and its look", () => {
  assert.equal(STYLES.length, 10);
  for (const s of Object.keys(ARENA_ARCHETYPES)) {
    const A = ARCHETYPES[s];
    assert.ok(A && A.specials.includes(A.signature), `${s}: signature among its specials`);
    assert.ok(A.look && A.look.scale > 0, `${s}: a look`);
  }
});

test("against the scripted player, every archetype lands blows and uses its signature move within 30 s", () => {
  for (const s of Object.keys(ARENA_ARCHETYPES)) {
    const pack = ARENA_ARCHETYPES[s].look.beast, W = makeWorld({ foes: pack ? [[s, [9, 8]], [s, [5, 9]]] : [[s, [9, 8]]] }), sig = ARCHETYPES[s].signature; // beasts come in pairs
    const pilot = createPilot(), ev = [];
    for (let i = 0; i < 60 * 30 && !W.result; i++) ev.push(...W.step({ lamb: pilot(W) }));
    const used = ev.some((e) => e.type === "move" && e.id.startsWith("foe") && String(e.move).startsWith(sig));
    const hits = ev.filter((e) => e.type === "hit" && e.id === "lamb").length;
    assert.ok(hits > 0, `${s}: no blow landed in 30 s`);
    assert.ok(used, `${s}: ${sig} never used`);
  }
});

test("an elite has more standing and poise, and its signature move is armoured", () => {
  for (const s of Object.keys(ARENA_ARCHETYPES)) {
    const d = foeDef(null, s), e = elite(d), spec = fighterSpec("x", "foe", e, [0, 0], { brain: true });
    assert.ok(e.hp > d.hp && e.poise > d.poise, s);
    const m = spec.moves[`${ARCHETYPES[s].signature}@elite`];
    assert.ok(m && m.armor && m.armor[2] >= 3, `${s}: armoured signature`);
  }
});
