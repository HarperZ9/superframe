// The notification stack's placement (ui/notify.mjs): the column takes the side the panels leave and
// stops above a panel below it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnFor, overlap } from "../ui/notify.mjs";

const view = { w: 1280, h: 720 };
test("walking: the column sits top right under the top bar, clear of the place menu bottom left", () => {
  const rects = [{ sel: ".hud", x: 29, y: 29, w: 165, h: 88 }, { sel: ".topbar", x: 1050, y: 29, w: 200, h: 36 }, { sel: ".screen.play .here", x: 29, y: 198, w: 360, h: 492 }];
  const c = columnFor(view, rects, 300);
  assert.equal(c.side, "right"); assert.ok(c.top >= 29 + 36 + 8, `top ${c.top}`);
  assert.ok(!overlap({ x: c.x, y: c.top, w: 300, h: c.bottom - c.top }, rects[2]), "never over the place menu");
});
test("talking: the column moves left under the HUD, and stops above anything below it", () => {
  const rects = [{ sel: ".hud", x: 29, y: 29, w: 165, h: 88 }, { sel: "aside.talk", x: 933, y: 0, w: 347, h: 720 }, { sel: ".talkoffer", x: 20, y: 600, w: 320, h: 80 }];
  const c = columnFor(view, rects, 300);
  assert.equal(c.side, "left"); assert.ok(c.top >= 29 + 88 + 8); assert.ok(c.bottom <= 600 - 8, `bottom ${c.bottom}`);
  assert.ok(!overlap({ x: c.x, y: c.top, w: 300, h: c.bottom - c.top }, rects[1]));
});
