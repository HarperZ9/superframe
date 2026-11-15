// Local server for a worktree: serves this checkout's code like game/serve.mjs, and falls back to a
// second checkout (the main folder) for files this one lacks. Bakes (plates, geo buffers, forged
// meshes) are git-ignored, so a fresh worktree has none; they are read from the fallback, never copied.
//   node game/engine/paint/tools/serve.mjs [--port 8760] [--fallback <second checkout>] [--rn path]
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..", "..", "..", "..");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const fb = opt("--fallback", root);
const mount = (rel) => [join(root, rel), join(fb, rel)];
const MOUNTS = { "/rn/": [opt("--rn", join(root, "..", "..", "native"))], "/content/": mount("content"), "/content4k/": mount("content4k"), "/slice/": mount("slice"), "/characters/": mount("characters"), "/": mount("game") };
const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".css": "text/css; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2", ".lwd": "text/plain; charset=utf-8", ".wgsl": "text/plain" };

async function find(dirs, rel) {
  for (const d of dirs) {
    let f = normalize(join(d, rel));
    if (!f.startsWith(normalize(d))) return { code: 403 };
    try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); await stat(f); return { file: f }; } catch { /* try the next checkout */ }
  }
  return { code: 404 };
}
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const m = Object.keys(MOUNTS).find((k) => url.startsWith(k));
  const r = await find(MOUNTS[m], url.slice(m.length));
  if (!r.file) { res.writeHead(r.code); res.end(); return; }
  try { const body = await readFile(r.file); res.writeHead(200, { "Content-Type": TYPES[extname(r.file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body); }
  catch (e) { console.error(`serve: ${r.file}: ${e.message}`); res.writeHead(500); res.end(String(e.code || e)); }
});
const port = +opt("--port", 8760);
server.listen(port, "127.0.0.1", () => console.log(`Low Water (worktree ${root}, fallback ${fb}) on http://127.0.0.1:${port}/`));
