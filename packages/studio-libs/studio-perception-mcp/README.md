# studio-perception-mcp

A zero-dependency Node.js MCP server providing native perception and nD rendering tools over stdio (newline-delimited JSON-RPC).

## Run

```
node packages/studio-libs/studio-perception-mcp/server.mjs
```

## Honest Disclosure

Native, lossless, persistent, near-ambient perception — NOT weights-level ambient. When a tool is invoked is the client's decision, not this server's. Readouts are structured truth (and raw bytes for vision clients), refreshed on a live resource a client may subscribe to.

## Tools

- **perceive_image** — Perceive an image file or base64 → complete layered readout (+ raw pixels).
- **perceive_screen** — Capture the screen (optional region) → complete layered readout (+ raw pixels).
- **measure** — Re-read the current live source → readout (poll a changing subject).
- **render_nd** — Render a 1-D…10-D polytope (cube/simplex/orthoplex/24cell) with full nD rotation + a chosen projection, then perceive the rendered frame.

## Live Resource

The server exposes `perception://live` — a resource a client may subscribe to. Each turn, the model should read or subscribe to `perception://live` to receive the most-recent structured perception readout. The resource emits a `notifications/resources/updated` notification only when the perceived content changes (near-ambient: idle when static, never noisy).

## Claude Desktop Config

```json
{ "mcpServers": { "studio-perception": { "command": "node", "args": ["packages/studio-libs/studio-perception-mcp/server.mjs"] } } }
```
