import { test } from "node:test";
import assert from "node:assert/strict";
import { fightCam } from "../ui/fightcam.mjs";

const el = () => ({ style: {} });
const make = (mode, prefs = { shake: "on" }) => { const L = [el()]; return { L, C: fightCam({ prefs, mode, layers: () => L, view: () => ({ w: 1920, h: 1080 }) }) }; };
const px = (L) => Math.hypot(...(L[0].style.translate || "0px 0px").split(" ").map(parseFloat));

test("impact camera: a full-weight blow peaks at frame 3 at 6 px at 1080p (T10), swings back, and settles (keyed, as the reference)", () => {
  const { L, C } = make("shake");
  C.blow({ amp: 1 }, [1, 0]);
  for (let i = 0; i < 3; i++) C.tick(1 / 60);
  assert.ok(px(L) > 5 && px(L) <= 6.01, `peak ${px(L)} px at frame 3`);
  for (let i = 0; i < 5; i++) C.tick(1 / 60);
  assert.ok(parseFloat(L[0].style.translate) < 0, "the 40% overshoot swings the other way by frame 8");
  for (let i = 0; i < 40; i++) C.tick(1 / 60);
  assert.equal(L[0].style.translate, "", "settled by frame 48");
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
  const f = make("shake"), r = make("shake", { shake: "light" });
  for (const m of [f, r]) { m.C.blow({ amp: 1 }, [1, 0]); for (let i = 0; i < 3; i++) m.C.tick(1 / 60); }
  assert.ok(Math.abs(px(r.L) / px(f.L) - 0.4) < 0.02, `reduced ${px(r.L)} of ${px(f.L)}`);
  const o = make("both", { shake: "off" }); o.C.blow({ amp: 1 }, [1, 0]); o.C.contact({ kind: "catch", power: 1 }, [900, 500]); o.C.tick(0.05); assert.equal(px(o.L), 0); assert.equal(o.L[0].style.scale || "", "");
});

// The quay fight's blows (impact-capture, 2026-10-23): combat's shake amp and the contact frame, lifted from the
// capture's log so the test needs no browser. Two blows land together on frame 198, the 0.75 heavies. CB8 / T10:
// the whole offset peaks at 6 px or less (7 px is the test's margin) and is still by 12 frames after a light blow.
const QUAY = [[29, 0.45], [46, 0.4], [46, 0.4], [96, 0.45], [100, 0.15], [144, 0.3], [198, 0.75], [198, 0.75]];
function replay(tell) {
  const { L, C } = make("shake"); const peaks = []; let last = 0;
  for (let f = 0; f < 260; f++) {
    for (const [bf, amp] of QUAY) if (bf === f) { C.blow({ amp }, [1, 0.3]); last = f; }
    C.tells(tell && f >= 190 && f < 215 ? [[960, 540]] : []);
    C.tick(1 / 60); peaks.push({ f, p: px(L) });
  }
  return { peaks, last, L };
}
test("impact camera: the quay fight's blows never move the view more than 7 px at 1080p (regression: 15.8 px, CB8)", () => {
  const { peaks } = replay(false), top = peaks.reduce((a, b) => (b.p > a.p ? b : a));
  assert.ok(top.p <= 7, `peak ${top.p.toFixed(1)} px at frame ${top.f}`);
  assert.ok(top.f >= 198 && top.p > 4.5, `the heavy pair is the peak, and it still reads (${top.p.toFixed(1)} px)`);
});
test("impact camera: the heavy pair on one frame cannot stack past the peak", () => {
  const { L, C } = make("shake"); let top = 0;
  C.blow({ amp: 0.75 }, [1, 0]); C.blow({ amp: 0.75 }, [1, 0]); C.blow({ amp: 1 }, [1, 0]);
  for (let i = 0; i < 20; i++) { C.tick(1 / 60); top = Math.max(top, px(L)); }
  assert.ok(top <= 6.01, `three blows on one frame reached ${top.toFixed(2)} px`);
});
test("impact camera: shake is gone 12 frames after a short blow, 15 after a heavy one", () => {
  for (const [amp, rest] of [[0.15, 12], [0.4, 12], [0.75, 15]]) {
    const { L, C } = make("shake"); C.blow({ amp }, [1, 0]);
    for (let i = 0; i < rest; i++) C.tick(1 / 60);
    assert.ok(px(L) < 0.5, `amp ${amp} still ${px(L).toFixed(2)} px at frame ${rest}`);
  }
});
test("impact camera: keyed shake and spring together stay within 3 px (to the style string's 0.1 px rounding) while a tell shows", () => {
  const { peaks } = replay(true), under = peaks.filter((x) => x.f >= 191 && x.f < 215);
  assert.ok(under.some((x) => x.p > 2.9), "the clamp was reached");
  assert.ok(under.every((x) => x.p <= 3.1), `tell window peak ${Math.max(...under.map((x) => x.p)).toFixed(2)} px`);
});
