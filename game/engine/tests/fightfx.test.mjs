import { test } from "node:test";
import assert from "node:assert/strict";
import { fightFx } from "../ui/fightfx.mjs";

// a 2D context that records what is drawn
function fakeG() { const calls = []; const g = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === "createRadialGradient" ? () => ({ addColorStop() {} }) : (...a) => calls.push([k, ...a]))), set: (t, k, v) => { t[k] = v; return true; } }); return { g, calls }; }
const W = (over = {}) => ({ byId(id) { return this.fighters.find((F) => F.id === id); }, projectiles: [], fighters: [{ id: "lamb", x: 0, z: 0 }, { id: "f#0", x: 1, z: 0, act: { id: "m.throw", f: 10 } }], moves: { "m.throw": { id: "world.throw", tell: { kind: "throw", at: [0, 48] }, parryable: true, blockable: true } }, events: [], ...over });
const screen = ([x, y, z]) => ({ x: 100 + x * 50, y: 100 + z * 50 - y * 50, ppm: 50 });

test("fight fx: a stone in the air is drawn with a trail; a fighter's tell reaches the drawer", () => {
  const fx = fightFx(), w = W({ projectiles: [{ n: 1, use: "stone", x: 0.5, z: 0, y: 1, vx: 4, vz: 0 }] });
  fx.read(w);
  const t = fx.tellOf("f#0"); assert.ok(t); assert.equal(t.kind, "throw"); assert.equal(t.answer, "throw");
  assert.equal(fx.tellOf("lamb"), null);
  const { g, calls } = fakeG(); fx.draw(g, screen, 1 / 60);
  assert.ok(calls.some((c) => c[0] === "arc"), "the stone is drawn");
  assert.ok(calls.some((c) => c[0] === "lineTo"), "with a trail");
});

test("fight fx: a catch leaves a mark that lasts about a quarter second", () => {
  const fx = fightFx(), w = W({ events: [{ type: "parry", id: "lamb", by: "f#0" }] });
  w.byId = (id) => w.fighters.find((F) => F.id === id);
  fx.read(w); w.events = [];
  let { g, calls } = fakeG(); fx.draw(g, screen, 0.1); assert.ok(calls.some((c) => c[0] === "arc"), "the catch's ring is drawn");
  fx.read(w); ({ g, calls } = fakeG()); fx.draw(g, screen, 0.1); assert.ok(calls.some((c) => c[0] === "arc"), "still there at 0.1 s");
  fx.read(w); fx.draw(fakeG().g, screen, 0.1); fx.read(w); ({ g, calls } = fakeG()); fx.draw(g, screen, 0.1);
  assert.ok(!calls.some((c) => c[0] === "arc"), "gone after 0.3 s");
});
