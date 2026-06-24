import { test } from "node:test";
import assert from "node:assert/strict";
import { createDispatcher } from "../mcp/protocol.mjs";

const tools = [{ name: "echo", description: "echo", inputSchema: { type: "object" }, handler: async (a) => ({ content: [{ type: "text", text: JSON.stringify(a) }] }) }];
const resources = { list: () => [{ uri: "perception://live", name: "live", mimeType: "application/json" }], read: () => ({ contents: [{ uri: "perception://live", text: "{}" }] }), subscribe: () => {} };
const d = createDispatcher({ serverInfo: { name: "studio-perception", version: "0.1.0" }, instructions: "native not weights", tools, resources });

test("initialize returns protocolVersion + capabilities + serverInfo", async () => {
  const r = await d({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(r.id, 1);
  assert.ok(r.result.serverInfo.name === "studio-perception");
  assert.ok(r.result.capabilities.tools && r.result.capabilities.resources);
});
test("tools/list returns the registered tools (no handler leaked)", async () => {
  const r = await d({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(r.result.tools[0].name, "echo");
  assert.equal(r.result.tools[0].handler, undefined);
});
test("tools/call invokes the handler", async () => {
  const r = await d({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: { hi: 1 } } });
  assert.equal(JSON.parse(r.result.content[0].text).hi, 1);
});
test("resources/list + notification (no id) → null", async () => {
  assert.equal((await d({ jsonrpc: "2.0", id: 4, method: "resources/list" })).result.resources[0].uri, "perception://live");
  assert.equal(await d({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
});
test("unknown method → JSON-RPC error -32601", async () => {
  const r = await d({ jsonrpc: "2.0", id: 5, method: "nope" });
  assert.equal(r.error.code, -32601);
});
test("tools/call unknown tool → isError result (not a protocol error)", async () => {
  const r = await d({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "nope" } });
  assert.equal(r.result.isError, true);
  assert.ok(/unknown tool/i.test(r.result.content[0].text));
});
