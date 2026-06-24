// protocol.mjs — minimal MCP JSON-RPC 2.0 dispatcher (transport-agnostic; server.mjs wires stdio).
const PROTOCOL_VERSION = "2024-11-05";
export function createDispatcher({ serverInfo, instructions, tools = [], resources }) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
  const err = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  return async function dispatch(msg) {
    const { id, method, params } = msg || {};
    if (id == null && method && method.startsWith("notifications/")) return null; // fire-and-forget
    switch (method) {
      case "initialize":
        return ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {}, resources: { subscribe: true } },
          serverInfo, instructions,
        });
      case "tools/list":
        return ok(id, { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      case "tools/call": {
        const t = byName.get(params?.name);
        if (!t) return err(id, -32602, `unknown tool: ${params?.name}`);
        try { return ok(id, await t.handler(params.arguments || {})); }
        catch (e) { return ok(id, { isError: true, content: [{ type: "text", text: String(e && e.message || e) }] }); }
      }
      case "resources/list": return ok(id, { resources: resources.list() });
      case "resources/read": return ok(id, resources.read(params?.uri));
      case "resources/subscribe": resources.subscribe(params?.uri); return ok(id, {});
      default:
        if (id == null) return null;
        return err(id, -32601, `method not found: ${method}`);
    }
  };
}
