// Impact offsets per tool class (runtime/feel.mjs IMPACT_BY_CLASS): the hammer's striker rebounds further
// and turns more than the knife's, the knife flicks its wrist most, and every landed blow recoils.
//   node characters/proto/impact_test.mjs
import { makeReactions, IMPACT_BY_CLASS } from "../runtime/feel.mjs";
let fail = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fail++; };
function recoil(cls, power = 0.3) {
  const W = { tick: 10, fighters: [], defs: { lamb: { tool: { cls } }, foe: { tool: { cls: "light" } } } };
  const L = { id: "lamb", x: 0, z: 0, face: 0 }, F = { id: "foe", x: 1, z: 0, face: Math.PI };
  W.byId = (id) => (id === "lamb" ? L : F);
  const R = makeReactions(() => ({ contacts: [{ kind: "hit", id: "foe", by: "lamb", power, t: 10 }], frozen: [] }));
  R.read(W); W.tick = 12; R.read(W);
  return { me: R.layer("lamb", 0), them: R.layer("foe", Math.PI) };
}
const knife = recoil("short"), hammer = recoil("heavy"), hook = recoil("long");
ok(knife.me && hammer.me, "a light-power blow still recoils for the knife and the hammer (every: true)");
ok(!hook.me, "the hook's light blow does not recoil (the push goes down the shaft)");
ok(Math.abs(hammer.me.root.z) > Math.abs(knife.me.root.z) * 3, `hammer kick ${hammer.me.root.z.toFixed(3)} against knife ${knife.me.root.z.toFixed(3)}`);
ok(Math.abs(hammer.me.chest.turn) > Math.abs(knife.me.chest.turn), "the hammer turns the body more");
ok(Math.abs(knife.me.handR.bend) > Math.abs(hammer.me.handR.bend), "the knife flicks the wrist more");
ok(Math.abs(hammer.them.chest.bend) > Math.abs(knife.them.chest.bend), "the hammer throws the struck body further");
ok(Object.keys(IMPACT_BY_CLASS).length >= 7, "every tool class has offsets");
process.exit(fail ? 1 : 0);
