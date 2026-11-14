// Local server for the glyph worktree: this checkout's code, the main folder's bakes as fallback (as
// paint/tools/serve.mjs), and one more fallback for plates not yet in content/: a preview folder of baked
// plates (the painted lead's Quota previews, render/preview/v2/<plate>/), read in place, never copied.
//   node game/engine/paint/glyph/tools/serve.mjs [--port 8790] [--fallback <main>] [--preview <dir>] [--rn path]
// Original code.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..", "..", "..", "..", "..");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const fb = opt("--fallback", root);
const preview = opt("--preview", join(root, "render", "preview", "v2"));
const mount = (rel) => [join(root, rel), join(fb, rel)];
const MOUNTS = { "/rn/": [opt("--rn", join(root, "..", "..", "native"))], "/content/": [...mount("content"), preview], "/content4k/": mount("content4k"), "/slice/": mount("slice"), "/characters/": mount("characters"), "/": mount("game") };
const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".css": "text/css; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2", ".lwd": "text/plain; charset=utf-8", ".wgsl": "text/plain" };

async function find(dirs, rel) {
  for (const d of dirs) {
    let f = normalize(join(d, rel));
    if (!f.startsWith(normalize(d))) return { code: 403 };
    try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); await stat(f); return { file: f }; } catch { /* the next checkout */ }
  }
  return { code: 404 };
}
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const m = Object.keys(MOUNTS).find((k) => url.startsWith(k));
  const r = await find(MOUNTS[m], url.slice(m.length));
  if (!r.file) { res.writeHead(r.code); res.end(); return; }
  try { const body = await readFile(r.file); res.writeHead(200, { "Content-Type": TYPES[extname(r.file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body); }
  catch (e) { console.error(`glyph serve: ${r.file}: ${e.message}`); res.writeHead(500); res.end(String(e.code || e)); }
});
const port = +opt("--port", 8790);
server.listen(port, "127.0.0.1", () => console.log(`Low Water glyph (worktree ${root}, fallbacks ${fb}, ${preview}) on http://127.0.0.1:${port}/`));
