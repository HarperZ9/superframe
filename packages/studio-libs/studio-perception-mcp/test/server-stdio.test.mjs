import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test("server.mjs stdio handshake: initialize + tools/list + resources/list", async () => {
  const proc = spawn("node", ["c:/dev/public/studio-libs/studio-perception-mcp/server.mjs"]);
  const responses = [];
  let buf = "";
  proc.stdout.on("data", (d) => {
    buf += d; let nl;
    while ((nl = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (line) responses.push(JSON.parse(line)); }
  });
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "resources/list" }) + "\n");
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = setInterval(() => {
      const have = [1, 2, 3].every((id) => responses.find((r) => r.id === id));
      if (have) { clearInterval(tick); resolve(); }
      else if (++attempts > 80) { clearInterval(tick); reject(new Error("timeout waiting for server responses")); } // ~4s at 50ms
    }, 50);
  });
  proc.kill();
  const init = responses.find((r) => r.id === 1);
  const tools = responses.find((r) => r.id === 2);
  const res = responses.find((r) => r.id === 3);
  assert.equal(init.result.serverInfo.name, "studio-perception");
  assert.ok(/NOT weights-level/i.test(init.result.instructions), "honest disclosure must be in instructions");
  assert.equal(tools.result.tools.length, 4, "four tools: perceive_image/perceive_screen/measure/render_nd");
  assert.equal(res.result.resources[0].uri, "perception://live");
});
