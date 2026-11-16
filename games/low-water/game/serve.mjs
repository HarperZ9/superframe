// Local server for Low Water. Serves the game shell (/engine/play.html; / redirects there), the
// raw-native checkout (/rn/), the private content (plates and script) and the character pipeline
// from their own folders. Localhost only.
//   node game/serve.mjs [--port 8731] [--rn native/] [--plates DIR]
// Baked plates (dawn.png, geo-*.f32 and the rest) are build output and are not in the repository.
// --plates DIR (or LW_PLATES=DIR) names a folder laid out like games/low-water, holding content/,
// content4k/ and characters/ (the painted portraits) from a local bake; a file missing under the repository's content/ is served from there.
// Without a bake the shell runs on its placeholder ground, and the server says so once at start.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const plates = opt("--plates", process.env.LW_PLATES || "");
const MOUNTS = { "/rn/": opt("--rn", join(root, "..", "..", "native")), "/content/": join(root, "content"), "/content4k/": join(root, "content4k"), "/slice/": join(root, "slice"), "/characters/": join(root, "characters"), "/": here };
// second roots, tried in order when the first has no such file
const FALLBACK = plates ? { "/content/": [join(plates, "content")], "/content4k/": [join(plates, "content4k")], "/characters/": [join(plates, "characters")] } : {};
const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".css": "text/css; charset=utf-8", ".png": "image/png", ".woff2": "font/woff2", ".lwd": "text/plain; charset=utf-8", ".wgsl": "text/plain" };

// the file under base for this url tail, or null when the tail climbs out of base
function inside(base, tail) {
  const b = normalize(base), f = normalize(join(b, tail));
  return f === b || f.startsWith(b.endsWith(sep) ? b : b + sep) ? f : null;
}

async function find(base, tail) {
  let file = inside(base, tail);
  if (!file) return { forbidden: true };
  try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); await stat(file); return { file }; }
  catch (e) { return { missing: e.code || String(e) }; }
}

const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const m = Object.keys(MOUNTS).find((k) => url.startsWith(k)), tail = url.slice(m.length);
  let hit = await find(MOUNTS[m], tail);
  for (const alt of FALLBACK[m] || []) { if (hit.file || hit.forbidden) break; hit = await find(alt, tail); }
  if (hit.forbidden) { res.writeHead(403); res.end(); return; }
  if (!hit.file) { res.writeHead(404); res.end(String(hit.missing)); return; }
  try { const body = await readFile(hit.file); res.writeHead(200, { "Content-Type": TYPES[extname(hit.file)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(body); }
  catch (e) { res.writeHead(404); res.end(String(e.code || e)); }
});
const port = +opt("--port", 8731);
server.listen(port, "127.0.0.1", () => {
  console.log(`Low Water on http://127.0.0.1:${port}/`);
  if (plates && !existsSync(join(plates, "content"))) console.log(`plates: ${plates} has no content/ folder; places will show placeholder ground`);
  else if (!plates) console.log("plates: none given (--plates DIR or LW_PLATES); places without a local bake show placeholder ground");
  else console.log(`plates: ${plates}`);
});
