import test from "node:test";
import vm from "node:vm";
import { assert } from "./h.mjs";
import { pcbRoomPage } from "../views/pcb-room/build.mjs";
import { soundRoomPage } from "../views/sound-room/build.mjs";

for (const [name, page] of [
  ["PCB Room", pcbRoomPage()],
  ["Sound Room", soundRoomPage()],
]) {
  const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  test(`${name}: the generated page parses, with no module syntax`, () => {
    assert.ok(scripts.length >= 1);
    for (const s of scripts) {
      new vm.Script(s);
      assert.doesNotMatch(s, /^(import|export)\s/m);
    }
  });
  test(`${name}: no unfilled token or marker is left`, () => {
    assert.doesNotMatch(page, /\{\{\w+\}\}|ROOM-SCRIPT/);
  });
}
test("Sound Room: its shaders come from the solver", () => {
  assert.match(soundRoomPage(), /<script id="step" type="x">#version 300 es/);
});
