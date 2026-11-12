// Enemy behaviour: telegraphs, one attacker at a time, spacing and flanking, the stagger answer,
// and searching for what it cannot see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, makeG, run } from "./helpers.mjs";
import { SPECIALS } from "../data/foes.mjs";
import { dist } from "../sim/fighter.mjs";

test("every opponent special that strikes is telegraphed for most of its wind-up", () => {
  for (const [id, m] of Object.entries(SPECIALS)) {
    if (m.kind === "dodge") continue;
    assert.ok(m.tell, `${id} has a tell`);
    assert.ok(m.startup >= 18, `${id} winds up for at least 18 frames`);
    assert.ok(m.tell.at[1] - m.tell.at[0] >= 0.6 * m.startup, `${id} shows its tell for most of the wind-up`);
  }
});

test("a tell event comes before every telegraphed attack lands", () => {
  const W = makeWorld({ G: makeG({ clock: "23:00" }), foes: [["holder", [8.5, 7.5]], ["skirmisher", [3, 8]]] });
  const ev = run(W, 1200), told = new Map();
  for (const e of ev) {
    if (e.type === "tell") told.set(e.id, e.t);
    if (e.type === "hit" && e.id === "lamb" && W.moves[e.move] && W.moves[e.move].tell) assert.ok(told.has(e.by), `${e.move} landed untold`);
  }
});

// Count frames on which more than one opponent is in a melee swing at Lamb.
function crowding(W, frames, active) {
  let both = 0, n = 0;
  for (let i = 0; i < frames && !W.result; i++) {
    if (active) W.lamb().lastOffense = W.tick;
    W.step({ lamb: {} }); W.lamb().hp = W.lamb().hpMax; n++;
    if (W.fighters.filter((F) => F.team === "foe" && F.act && W.moves[F.act.id].hits.length).length > 1) both++;
  }
  return both / n;
}

test("pressure: one swings at a time at a Lamb who fights back, more at a Lamb who stands still", () => {
  const lineup = [["holder", [8.5, 7.5]], ["skirmisher", [3, 8]], ["skirmisher", [12, 8]]];
  const active = crowding(makeWorld({ G: makeG({ clock: "23:00" }), foes: lineup }), 590, true);
  const idle = crowding(makeWorld({ G: makeG({ clock: "23:00" }), foes: lineup }), 590, false);
  assert.ok(active < 0.03, `two swinging at once on ${(active * 100).toFixed(1)}% of frames against an active Lamb`);
  assert.ok(idle > active, `idle ${idle}, active ${active}`);
});

test("after a stagger the holder braces and answers at once", () => {
  const W = makeWorld({ G: makeG({ clock: "23:00" }), foes: [["holder", [6.5, 5.5]]] });
  const F = W.byId("foe0");
  run(W, 2);
  F.act = null; F.poise = 0;
  W.step({ lamb: {} });
  F.act = { id: "stagger", f: 0, end: W.moves.stagger.total, hit: [], charge: 0, charging: false };
  const ev = run(W, 120);
  const next = ev.find((e) => e.type === "move" && e.id === "foe0" && e.move !== "stagger");
  assert.equal(next && next.move, "holder.braced");
});

test("the skirmisher works at range against a Lamb who fights back", () => {
  const W = makeWorld({ G: makeG({ clock: "23:00" }), foes: [["holder", [8.5, 7.5]], ["skirmisher", [3, 8]]] });
  const L = W.lamb(); let far = 0, n = 0;
  for (let i = 0; i < 900 && !W.result; i++) { L.lastOffense = W.tick; W.step({ lamb: {} }); L.hp = L.hpMax; if (i > 120) { n++; if (dist(L, W.byId("foe1")) > 2.6) far++; } }
  assert.ok(far / n > 0.5, `skirmisher beyond 2.6 m on ${far} of ${n} frames (Lamb fighting back)`);
});

test("an opponent that loses sight walks to where it last saw Lamb", () => {
  const G = makeG({ clock: "23:00", terms: { light: 0.0 } });
  const W = makeWorld({ G, lambAt: [6.5, 3.5], foes: [["holder", [6.5, 7.5]]] });
  const L = W.lamb(), F = W.byId("foe0");
  run(W, 30);
  assert.ok(F.mem && F.mem.seen, "it saw Lamb by the lantern");
  L.lantern = 0; L.x = 20; L.z = 3.5;
  const before = { x: F.mem.seen.x, z: F.mem.seen.z };
  run(W, 240, { lamb: {} });
  assert.ok(Math.hypot(F.x - before.x, F.z - before.z) < 1.5 || F.mem.seen === null, "it went to the last place it saw Lamb");
});

test("a Lamb who stands still in the Act 1 lineups goes down within 20 seconds", () => {
  for (const foes of [[["holder", [8.5, 7.5]]], [["holder", [8.5, 7.5]], ["skirmisher", [3, 8]], ["skirmisher", [12, 8]]]]) {
    const W = makeWorld({ G: makeG({ clock: "23:00" }), foes });
    run(W, 60 * 20, { lamb: {} });
    assert.equal(W.result && W.result.outcome, "down", `${foes.length} opponents`);
  }
});
