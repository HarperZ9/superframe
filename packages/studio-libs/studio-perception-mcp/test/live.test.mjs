import { test } from "node:test";
import assert from "node:assert/strict";
import * as sense from "../../sense-core/index.mjs";
import { createLive } from "../mcp/resource-live.mjs";
import { checker, gradient } from "../../sense-core/test/fixtures/frames.mjs";

test("live emits update on change, stays silent when static", async () => {
  const updates = [];
  const live = createLive({ sense, intake: {} });
  live.subscribe("perception://live", () => updates.push(1));
  live.setSource(checker()); live.tickOnce();      // first read → emit
  live.tickOnce();                                  // unchanged → silent
  const before = updates.length;
  live.tickOnce();
  assert.equal(updates.length, before, "static frame must not emit");
  live.setSource(gradient()); live.tickOnce();      // changed → emit
  assert.ok(updates.length > before);
  live.stop();
});
test("read returns the current readout as a resource content", () => {
  const live = createLive({ sense, intake: {} });
  live.setSource(checker());
  const c = live.read("perception://live");
  assert.equal(c.contents[0].uri, "perception://live");
  assert.ok(JSON.parse(c.contents[0].text).dimensions.w > 0);
});
