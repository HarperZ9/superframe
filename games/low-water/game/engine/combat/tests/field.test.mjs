// The environment as a combatant (SYSTEMS-FULL 18.8), read through the engine's hub: the night's
// tide, frost, fog, rain and wind change footing, sight and thrown things for both sides.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, makeG, run, press } from "./helpers.mjs";
import { createField } from "../sim/field.mjs";
import { FLOOR, QUAY } from "../data/arenas.mjs";

test("the tide fills the gully first and then the floor, by the night's own clock", () => {
  const at = (clock) => createField({ G: makeG({ clock }), arena: FLOOR });
  const early = at("23:00"), late = at("00:30");
  assert.equal(early.footing(10.5, 5.5).band, "ankle", "23:00: ankle-deep in the gully (open on foot)");
  assert.equal(early.footing(3.5, 6.5).band, "dry", "23:00: the mud is dry");
  assert.ok(["knee", "waist"].includes(late.footing(10.5, 5.5).band), "00:30: the gully is deep");
  assert.notEqual(late.footing(3.5, 6.5).band, "dry", "00:30: the mud is under");
});

test("a roll in knee-deep water is a lurch; on dry slabs it is the load's form", () => {
  const G = makeG({ clock: "23:50" }), f = createField({ G, arena: FLOOR });
  assert.equal(f.footing(10.5, 5.5).band, "knee");
  const W = makeWorld({ G, brains: false, lambAt: [10.5, 5.5], foes: [] });
  assert.ok(run(W, 1, press("roll", { mx: 1, mz: 0 })).some((e) => e.move === "lamb:lurch"));
  const W2 = makeWorld({ G: makeG({ clock: "23:00" }), brains: false, foes: [] });
  assert.ok(run(W2, 1, press("roll", { mx: 1, mz: 0 })).some((e) => e.move === "lamb:roll"), "the case is a medium load");
  const W3 = makeWorld({ G: makeG({ clock: "23:00" }), brains: false, foes: [], tool: "w.stick", lamb: { coat: 4 } });
  assert.ok(run(W3, 1, press("roll", { mx: 1, mz: 0 })).some((e) => e.move === "lamb:roll_dash"), "the stick in a greatcoat on a COAT 4 frame is a light load");
});

test("frost glazes the stone and costs more poise for both sides", () => {
  // the floor is under the sea at 04:40 (high water 05:10), so frost is a quay fight
  const frosty = createField({ G: makeG({ clock: "04:40" }), arena: QUAY }), dry = createField({ G: makeG({ clock: "23:00" }), arena: QUAY });
  assert.equal(frosty.footing(10, 4).kind, "frost");
  assert.ok(frosty.footing(10, 4).grip < dry.footing(10, 4).grip);
  const hitOn = (clock) => { const W = makeWorld({ G: makeG({ clock }), arena: QUAY, brains: false, foes: [["holder", [10, 5.5]]] }); run(W, 1, press("light")); return run(W, 40).find((e) => e.type === "hit").poise; };
  assert.ok(hitOn("04:40") > hitOn("23:00"));
});

test("fog shortens sight; a lantern makes its bearer seen from further", () => {
  const clear = createField({ G: makeG({ clock: "23:00" }), arena: FLOOR }), fog = createField({ G: makeG({ clock: "03:00" }), arena: FLOOR });
  assert.ok(fog.seenRange(0.1) < clear.seenRange(0.1) / 2);
  const lit = clear.lightAt(15, 10, [{ x: 15, z: 10, r: 5, k: 0.45 }]), dark = clear.lightAt(15, 10, []);
  assert.ok(clear.seenRange(lit) > clear.seenRange(dark) + 5);
});

test("the wind carries a thrown bottle; a lantern lands burning, and rain puts it out fast", () => {
  const landing = (terms) => {
    const W = makeWorld({ G: makeG({ clock: "23:00", terms }), brains: false, foes: [] });
    run(W, 1, press("use")); let e = null;
    for (let i = 0; i < 120 && !e; i++) { const ev = W.step(); e = ev.find((x) => x.type === "lit" || x.type === "doused") || ev.find((x) => x.type === "land"); }
    return { e, W };
  };
  const calm = landing({ "wind.speed": 0 }), gale = landing({ "wind.speed": 18, "wind.dir": 270 });
  assert.ok(gale.e.x - calm.e.x > 0.3, `a west wind pushes it east: ${calm.e.x} -> ${gale.e.x}`);
  const dry = landing({ "wind.speed": 0 }), wet = landing({ "wind.speed": 0, rain: 4 });
  assert.equal(dry.e.type, "lit"); assert.equal(wet.e.type, "lit");
  assert.ok(wet.e.frames < dry.e.frames / 10, "rain douses a thrown lantern");
  assert.equal(dry.W.lamb().lantern, 0, "the lantern is gone from Lamb's hand");
});

test("a gust over 20 m/s staggers a heavy in its wind-up", () => {
  const W = makeWorld({ G: makeG({ clock: "23:00", terms: { "wind.speed": 24 } }), brains: false, foes: [] });
  const ev = run(W, 1, press("heavy")).concat(run(W, 5));
  assert.ok(ev.some((e) => e.type === "gust" && e.id === "lamb"));
});

test("a nose finds Lamb downwind in the dark, and eyes do not", () => {
  const G = makeG({ clock: "23:00", terms: { "wind.speed": 8, "wind.dir": 270, light: 0.01 } });
  const W = makeWorld({ G, brains: false, lambAt: [4, 8], foes: [["skirmisher", [12, 8], { def: { sight: "smell" } }], ["skirmisher", [12, 9]]] });
  W.lamb().lantern = 0; W.groundLights = []; W.step();
  assert.equal(W.visible(W.byId("foe0"), W.lamb()), true, "the wind carries Lamb to the nose");
  assert.equal(W.visible(W.byId("foe1"), W.lamb()), false, "eyes see nothing at 8 m in the dark");
});

test("voices bark from the situation: frost underfoot, breath low", async () => {
  const W = makeWorld({ G: makeG({ clock: "04:40" }), arena: QUAY, brains: false, foes: [] });
  const ev = run(W, 60);
  assert.ok(ev.some((e) => e.type === "bark" && e.voice === "ballast" && e.key === "footing.frost"));
  const W2 = makeWorld({ G: makeG({ clock: "23:00" }), arena: QUAY, brains: false, foes: [] });
  W2.lamb().st = 0.5; W2.lamb().stWait = 1000;
  assert.ok(run(W2, 60).some((e) => e.type === "bark" && e.voice === "knees"));
});
