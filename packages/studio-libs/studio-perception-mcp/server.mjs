// server.mjs — studio-perception-mcp entry. Newline-delimited JSON-RPC over stdio (MCP stdio transport).
import * as sense from "../sense-core/index.mjs";
import * as render from "../render-nd/index.mjs";
import { rasterize } from "../render-nd/backends/raster.mjs";
import * as intake from "./mcp/intake.mjs";
import { createDispatcher } from "./mcp/protocol.mjs";
import { makeTools } from "./mcp/tools.mjs";
import { makeRenderTool } from "./mcp/render-tool.mjs";
import { createLive } from "./mcp/resource-live.mjs";

const INSTRUCTIONS = "Native, lossless, persistent, near-ambient perception — NOT weights-level ambient. When a tool is invoked is the client's decision, not this server's. Readouts are structured truth (and raw bytes for vision clients), refreshed on a live resource a client may subscribe to.";
const live = createLive({ sense });
const renderBundle = makeRenderTool({ render: { ...render, rasterize }, sense, intake });
const tools = makeTools({ sense, render: renderBundle, intake, live });
const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const resources = { list: live.list, read: live.read, subscribe: (uri) => live.subscribe(uri, () => send({ jsonrpc: "2.0", method: "notifications/resources/updated", params: { uri } })) };
const dispatch = createDispatcher({ serverInfo: { name: "studio-perception", version: "0.1.0" }, instructions: INSTRUCTIONS, tools, resources });

let buf = "";
process.stdin.on("data", async (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (!line) continue;
    try { const res = await dispatch(JSON.parse(line)); if (res) send(res); }
    catch (e) { process.stderr.write("dispatch error: " + e.message + "\n"); }
  }
});
live.start();
process.stderr.write("studio-perception-mcp ready (stdio)\n");
