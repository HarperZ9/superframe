// Local server for the Low Water prototype. Serves the game, the engine (a raw-native checkout) and
// the private content (plates and script) from their own folders. Localhost only.
//   node game/serve.mjs [--port 8731] [--rn C:/dev/worktrees/raw-native-lowwater]
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MOUNTS = { "/rn/": opt("--rn", "C:/dev/worktrees/raw-native-lowwater"), "/content/": join(root, "content"), "/content-v1/": join(root, "content-v1"), "/slice/": join(root, "slice"), "/characters/": join(root, "characters"), "/": here };
const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".css": "text/css; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2", ".lwd": "text/plain; charset=utf-8", ".wgsl": "text/plain" };
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const m = Object.keys(MOUNTS).find((k) => url.startsWith(k));
  let file = normalize(join(MOUNTS[m], url.slice(m.length)));
  if (!file.startsWith(normalize(MOUNTS[m]))) { res.writeHead(403); res.end(); return; }
  try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); const body = await readFile(file); res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body); }
  catch (e) { res.writeHead(404); res.end(String(e.code || e)); }
});
const port = +opt("--port", 8731);
server.listen(port, "127.0.0.1", () => console.log(`Low Water on http://127.0.0.1:${port}/`));
