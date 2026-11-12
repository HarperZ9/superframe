import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBMP, writeBMP24 } from "../mcp/intake.mjs";

test("writeBMP24→parseBMP round-trips pixels (with row padding)", () => {
  // 3×2 image (width 3 → 9 bytes/row → padded to 12), distinct colours.
  const width = 3, height = 2, data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { data[i*4]=i*10; data[i*4+1]=i*20; data[i*4+2]=i*30; data[i*4+3]=255; }
  const round = parseBMP(writeBMP24({ data, width, height }));
  assert.equal(round.width, 3); assert.equal(round.height, 2);
  for (let i = 0; i < width * height; i++) {
    assert.equal(round.data[i*4], i*10); assert.equal(round.data[i*4+1], i*20); assert.equal(round.data[i*4+2], i*30);
  }
});
test("parseBMP rejects a non-BMP buffer", () => {
  assert.throws(() => parseBMP(Uint8Array.from([1, 2, 3, 4])));
});
