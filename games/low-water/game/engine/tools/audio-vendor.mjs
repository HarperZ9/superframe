// The game's copy of the shared instrument library (studio-libs, render-sound/instruments), pinned by
// commit and by the SHA-256 of every file (line endings normalised to LF, so a Windows checkout agrees).
// The game imports its copy, so its build has no dependency; this tool keeps the copy honest.
//   node tools/audio-vendor.mjs --check                          every file matches the manifest (exit 1 if not)
//   node tools/audio-vendor.mjs --sync <dir> --commit <sha>      copy the library from <dir> and rewrite the manifest
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const LIB = join(dirname(fileURLToPath(import.meta.url)), "..", "audio", "lib"), MANIFEST = join(LIB, "VENDOR.json");
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const hashOf = (p) => createHash("sha256").update(readFileSync(p, "utf8").replace(/\r\n/g, "\n")).digest("hex");
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(mjs|md)$/.test(f)) out.push(p); }
  return out;
}

if (args.includes("--sync")) {
  const src = opt("--sync"), commit = opt("--commit");
  if (!src || !commit) { console.error("--sync <dir> --commit <sha>"); process.exit(2); }
  const files = {};
  for (const p of walk(src)) {
    const rel = relative(src, p).replace(/\\/g, "/"), dst = join(LIB, rel);
    mkdirSync(dirname(dst), { recursive: true }); copyFileSync(p, dst); files[rel] = hashOf(dst);
  }
  writeFileSync(MANIFEST, JSON.stringify({ source: "studio-libs render-sound/instruments", commit, files }, null, 2) + "\n");
  console.log(`synced ${Object.keys(files).length} files at ${commit}`);
} else {
  const M = JSON.parse(readFileSync(MANIFEST, "utf8")), bad = [];
  for (const [rel, h] of Object.entries(M.files)) { let got = null; try { got = hashOf(join(LIB, rel)); } catch { /* missing */ } if (got !== h) bad.push(rel); }
  const extra = walk(LIB).map((p) => relative(LIB, p).replace(/\\/g, "/")).filter((r) => !(r in M.files));
  if (bad.length || extra.length) { console.log(`DRIFT from ${M.commit}: changed ${bad.join(", ") || "none"}; not in the library ${extra.join(", ") || "none"}`); process.exit(1); }
  console.log(`MATCH: ${Object.keys(M.files).length} files at studio-libs ${M.commit}`);
}
