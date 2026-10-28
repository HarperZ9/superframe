// tools/mcp.mjs: a minimal MCP server over stdio (JSON-RPC 2.0, one message per line), dependency-free.
// It answers initialize, tools/list and tools/call with the handlers in lib/tools.mjs.
//   node tools/mcp.mjs
import { createInterface } from 'node:readline';
import { TOOLS, callTool } from '../lib/tools.mjs';

const send = m => process.stdout.write(JSON.stringify(m) + '\n');
const rl = createInterface({ input: process.stdin });
rl.on('line', async line => {
  let msg; try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); }
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'superframe', version: '0.2.0' } } });
    if (method === 'notifications/initialized' || id === undefined) return;
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') { const r = await callTool(params.name, params.arguments ?? {}); return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(r) }] } }); }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `no method ${method}` } });
  } catch (e) {
    console.error(`mcp ${method}: ${e.message}`);
    send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: e.message }] } });
  }
});
