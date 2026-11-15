// A plate's recipe: every file of this repository a bake reads, hashed (plates pass 2026-10-24). The lock's earlier
// recipe hashed a fixed list (render/bake2.mjs, render/v2, render/kit, render/places/_common.mjs for the pipeline; the
// place, its worlds and the props they import for the source) and missed render/sdf.mjs (the tracer), the place
// helpers (render/places/_q*.mjs), a world's own-folder imports (render/worlds/_season.mjs, _room.mjs),
// render/grade.mjs and the light model under game/engine/light/, so an edit there left the recipe unchanged.
// Now both halves are import closures, followed from their entry files through every relative module specifier:
//   from "x", import "x", import("x"), new URL("x", import.meta.url), with a template's literal head ("x?${...}").
// The pipeline is the closure of render/bake2.mjs plus the files it reads as data (DATA below) and render/tools/restreak.py
// (the second step); the source is the
// closure of render/places/<place>.mjs less the pipeline's files. Engine modules come from raw-native by revision
// (render/rn.mjs), which the lock records beside the recipe. Files are hashed with CRLF read as LF, so a checkout's
// line endings never change a recipe. The test game/engine/paint/tests/recipe.test.mjs runs a small bake, records
// every module it loads (the main thread and the shade workers), and fails if changing any one of them leaves the
// recipe unchanged.
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPEC = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bnew URL\(\s*)(["'`])([^"'`$?\s]+)/g;
const MODULE = /\.(mjs|js|json)$/;
export const unix = (p) => p.split(sep).join("/");
// a file's bytes as git stores them (CRLF read as LF)
export const canon = (abs) => { const b = readFileSync(abs); return b.includes(13) ? Buffer.from(b.toString("latin1").replace(/\r\n/g, "\n"), "latin1") : b; };
// per-file results are kept for the process, keyed by path, size and mtime (the lock test asks for 116 closures at once)
const memo = new Map(), stamp = (abs) => { const st = statSync(abs); return `${abs}|${st.size}|${st.mtimeMs}`; };
const cached = (kind, abs, make) => { const k = `${kind}|${stamp(abs)}`; if (!memo.has(k)) memo.set(k, make()); return memo.get(k); };
export const fileSha = (abs) => cached("sha", abs, () => createHash("sha256").update(canon(abs)).digest("hex").slice(0, 16));
const specs = (f) => cached("spec", f, () => [...readFileSync(f, "utf8").matchAll(SPEC)].map((m) => m[2]));
const inside = (root, abs) => { const r = relative(root, abs); return r && !r.startsWith("..") && !r.includes(":"); };

// every repository file reached from the entries (absolute paths), the entries included
export function closure(entries, root = REPO) {
  const seen = new Set(), todo = [...entries];
  while (todo.length) {
    const f = todo.pop(); if (seen.has(f) || !existsSync(f) || !statSync(f).isFile()) continue;
    seen.add(f); if (!/\.(mjs|js)$/.test(f)) continue;
    for (const s of specs(f)) {
      if (/^[a-z]+:/i.test(s) || !MODULE.test(s)) continue;   // node:fs, file:, https: and non-module strings
      const abs = resolve(dirname(f), s); if (inside(root, abs) && existsSync(abs)) todo.push(abs);
    }
  }
  return [...seen].sort();
}
const table = (root, list) => Object.fromEntries(list.map((f) => [unix(relative(root, f)), fileSha(f)]));
const digest = (t) => { const h = createHash("sha256"); for (const [k, v] of Object.entries(t)) h.update(`${k} ${v}\n`); return h.digest("hex").slice(0, 16); };

// files the pipeline reads with readFileSync rather than imports: the light model's community stocks
// (game/engine/light/tools/stocks.mjs, for the stroke light's terms). The test's trace records file reads too.
export const DATA = ["content/quota/q_community.lwd", "render/tools/restreak.py"];
export function pipelineOf(root = REPO) {
  const files = table(root, [...closure([join(root, "render", "bake2.mjs")], root), ...DATA.map((f) => join(root, f))].filter(existsSync).sort());
  return { sha: digest(files), files };
}
// the recipe's two halves for a place module name (render/places/<name>.mjs), or null when there is no such module
export function recipeOf(name, root = REPO, pipe = pipelineOf(root)) {
  const p = join(root, "render", "places", `${name}.mjs`); if (!existsSync(p)) return null;
  const deps = table(root, closure([p], root).filter((f) => !(unix(relative(root, f)) in pipe.files)));
  return { source: { place: unix(relative(root, p)), sha: digest(deps), deps }, pipeline: pipe.sha };
}
// what differs between a recorded recipe and the current one: [] when it is current
export function recipeDiff(rec, cur, pipes = {}) {
  const out = [];
  if (!rec || !rec.source || !rec.source.deps) return ["recorded before the closure recipe (no per-file hashes)"];
  if (!cur) return ["the place module is gone"];
  if (rec.source.sha !== cur.source.sha) {
    const a = rec.source.deps, b = cur.source.deps;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) out.push(`${k} ${!(k in a) ? "added" : !(k in b) ? "dropped" : "changed"}`);
  }
  if (rec.pipeline !== cur.pipeline) {
    const a = pipes[rec.pipeline], b = pipes[cur.pipeline];
    if (!a || !b) out.push(`pipeline ${rec.pipeline} -> ${cur.pipeline}`);
    else for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) out.push(`${k} ${!(k in a) ? "added" : !(k in b) ? "dropped" : "changed"} (pipeline)`);
  }
  return out;
}
