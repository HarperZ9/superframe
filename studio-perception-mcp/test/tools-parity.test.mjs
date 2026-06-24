import { test } from "node:test";
import assert from "node:assert/strict";
import * as sense from "../../sense-core/index.mjs";
import { writeBMP24 } from "../mcp/intake.mjs";
import { makeTools } from "../mcp/tools.mjs";
import { checker } from "../../sense-core/test/fixtures/frames.mjs";

const frame = checker();
const intake = { toRGBA: async () => frame, writeBMP24 };
const live = { current: () => frame, setSource() {} };
const tools = makeTools({ sense, render: null, intake, live });
const call = (name, args) => tools.find((t) => t.name === name).handler(args);

test("perceive_image readout equals sense-core directly (parity)", async () => {
  const r = await call("perceive_image", { path: "x" });
  const direct = sense.assembleFullPerception(frame.data, frame.width, frame.height, 4, { source: "image" });
  assert.deepEqual(JSON.parse(r.content[0].text).multiScale.grid8, direct.multiScale.grid8);
  assert.equal(r.content[1].type, "image"); // raw pixels for vision clients
});
test("measure reads the live source", async () => {
  const r = await call("measure", {});
  assert.ok(JSON.parse(r.content[0].text).dimensions.w === frame.width);
});
