import test from "node:test";
import vm from "node:vm";
import { assert } from "./h.mjs";
import { pcbRoomPage } from "../views/pcb-room/build.mjs";
import { soundRoomPage } from "../views/sound-room/build.mjs";
import { fluidRoomPage } from "../views/fluid-room/build.mjs";

for (const [name, page] of [
  ["PCB Room", pcbRoomPage()],
  ["Sound Room", soundRoomPage()],
  ["Fluid Room", fluidRoomPage()],
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
test("Fluid Room: one small program per job, and its worker carries no module syntax", () => {
  const page = fluidRoomPage();
  const body = (id) => {
    const open = `<script id="${id}" type="x">`, i = page.indexOf(open);
    assert.ok(i >= 0, id);
    return page.slice(i + open.length, page.indexOf("</script>", i));
  };
  for (const id of ["fft", "prep", "viewp", "nl", "rhs", "upd", "stir", "dye", "show", "vol"]) {
    const b = body(id);
    assert.match(b, /^#version 300 es/);
    assert.ok(b.length < 2500, `${id} is ${b.length} characters`);
    assert.ok(b.split("for(").length <= 2, `${id} has more than one loop`);
  }
  const w = body("worker3");
  new vm.Script(w);
  assert.doesNotMatch(w, /^(import|export)\s/m);
});
