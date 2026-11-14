// The Studio's server: the same folders game/serve.mjs serves (the character pipeline, the engine, the
// content), rooted at the repo so the Studio's modules import them by relative path, plus one write
// route so the app can save its sources and exports into the repo. Writes are allowed under the
// portrait set and the paint-over folder only. Localhost only, no dependencies.
//   node tools/studio/serve.mjs [--port 8810]      then open http://127.0.0.1:8810/tools/studio/
import http from "node:http";
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), root = normalize(join(here, "..", ".."));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const READ = ["tools/studio/", "characters/", "game/", "content/"], WRITE = ["characters/portraits-painted/", "content/paintover/"];
const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".css": "text/css; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2", ".lwd": "text/plain; charset=utf-8" };

// a repo-relative path inside one of the allowed prefixes, or null
function inside(rel, prefixes) {
  const clean = normalize(rel).replace(/\\/g, "/").replace(/^\/+/, "");
  if (clean.includes("..")) return null;
  return prefixes.some((p) => clean.startsWith(p)) ? join(root, clean) : null;
}
async function body(req) { const parts = []; for await (const c of req) parts.push(c); return Buffer.concat(parts); }

async function handle(req, res) {
  const url = new URL(req.url, "http://x"), path = decodeURIComponent(url.pathname);
  if (req.method === "POST" && path === "/studio/write") {
    const file = inside(url.searchParams.get("path") || "", WRITE);
    if (!file) { res.writeHead(403); res.end("studio: writes only under " + WRITE.join(", ")); return; }
    await mkdir(dirname(file), { recursive: true }); await writeFile(file, await body(req));
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, path: url.searchParams.get("path") })); return;
  }
  if (path === "/" || path === "/tools/studio") { res.writeHead(302, { Location: "/tools/studio/" }); res.end(); return; }
  let file = inside(path, READ);
  if (!file) { res.writeHead(404); res.end(); return; }
  try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); }
  catch { res.writeHead(404); res.end(); return; }
  const data = await readFile(file);
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(data);
}
const server = http.createServer((req, res) => handle(req, res).catch((e) => { console.error(`studio serve: ${req.method} ${req.url}: ${e.stack || e}`); res.writeHead(500); res.end(String(e.message || e)); }));
const port = +opt("--port", 8810);   // the Studio's ports are 8810 to 8819 (coordinator, 2026-10-21)
server.listen(port, "127.0.0.1", () => console.log(`Low Water Studio on http://127.0.0.1:${port}/tools/studio/ (repo ${root})`));
