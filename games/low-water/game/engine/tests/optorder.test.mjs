// Options already said go below the new ones (ui/talk.mjs optionOrder), keeping their relative order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { optionOrder } from "../ui/talk.mjs";
test("said options sink below the rest; order within each kept", () => {
  assert.deepEqual(optionOrder([{ said: true }, {}, { said: true }, {}]), [1, 3, 0, 2]);
  assert.deepEqual(optionOrder([{}, {}]), [0, 1]);
});

test("a locked check goes below everything that can be pressed, said or not", () => {
  assert.deepEqual(optionOrder([{ said: true, locked: "Nothing has changed." }, { said: true }]), [1, 0]);
  assert.deepEqual(optionOrder([{ locked: "x" }, {}, { said: true }]), [1, 2, 0]);
});
