import { test } from "node:test";
import assert from "node:assert/strict";
import { fightCam } from "../ui/fightcam.mjs";

const el = () => ({ style: {} });
const make = (mode, prefs = { shake: "on" }) => { const L = [el()]; return { L, C: fightCam({ prefs, mode, layers: () => L, view: () => ({ w: 1920, h: 1080 }) }) }; };
const px = (L) => Math.hypot(...(L[0].style.translate || "0px 0px").split(" ").map(parseFloat));

test("impact camera: a heavy blow shakes up to 18 px at 1080p and is gone in a quarter second", () => {
  const { L, C } = make("shake");
  C.blow({ amp: 1 }, [1, 0]); C.tick(0.001);
  assert.ok(px(L) > 16, `shook ${px(L)} px`);
  for (let i = 0; i < 20; i++) C.tick(1 / 60);
  assert.equal(L[0].style.translate, "", "settled");
});
test("impact camera: a catch punches 2 to 4 % in and back within 120 ms; a light hit does not punch", () => {
  const { L, C } = make("punch");
  C.contact({ kind: "hit", power: 0.3 }, [900, 500]); C.tick(0.06); assert.equal(L[0].style.scale || "", "", "no punch on a light hit");
  C.contact({ kind: "catch", power: 1 }, [900, 500]); C.tick(0.06);
  const z = +L[0].style.scale; assert.ok(z > 1.02 && z <= 1.04, `zoom ${z}`);
  C.tick(0.07); assert.equal(L[0].style.scale || "", "", "back by 130 ms");
});
test("impact camera: a showing tell holds the shake to 3 px and blocks a punch that would push it out of view", () => {
  const { L, C } = make("both");
  C.tells([[1915, 540]]); C.blow({ amp: 1 }, [1, 0]); C.tick(0.001); assert.ok(px(L) <= 3.01, `held to ${px(L)}`);
  C.contact({ kind: "catch", power: 1 }, [100, 540]); C.tick(0.06); assert.equal(L[0].style.scale || "", "", "the tell at the edge would leave the view: no punch");
});
test("impact camera: reduced is 40 %, off is nothing", () => {
  const r = make("shake", { shake: "light" }); r.C.blow({ amp: 1 }, [1, 0]); r.C.tick(0.001); assert.ok(px(r.L) < 7.5 && px(r.L) > 6.5, `reduced ${px(r.L)}`);
  const o = make("both", { shake: "off" }); o.C.blow({ amp: 1 }, [1, 0]); o.C.contact({ kind: "catch", power: 1 }, [900, 500]); o.C.tick(0.05); assert.equal(px(o.L), 0); assert.equal(o.L[0].style.scale || "", "");
});
