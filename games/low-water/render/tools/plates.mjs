// The plate lock (coordinator, 2026-10-21: plate binaries stay out of git; a clean checkout must be able to
// reproduce or verify the art). content/PLATES.lock lists every file of every plate (content/<plate>/ with a
// place.json): path, sha256, size, and per plate the recipe that made it (render/tools/recipe.mjs): the place's source
// closure with a hash per file, the pipeline's closure hash (its file table under the lock's "pipelines"), the paint
// seed, the variants, the raw-native revision the bake loads, and the steps.
//   node render/tools/plates.mjs lock   [--content <dir>] [--rebaked a,b] [--only a,b]   write content/PLATES.lock from what is there
//                                                                           (--only: only those plates may be rewritten)
//   node render/tools/plates.mjs verify [--content <dir>]                   check a copied set against the lock (exit 1 on any difference)
//   node render/tools/plates.mjs status [--only a,b]                        which recipes no longer match the sources (exit 1 if any is unmarked)
//   node render/tools/plates.mjs stale  --only a,b --reason "..."           mark recipes stale on purpose, with the reason
//   node render/tools/plates.mjs rebake [--content <dir>] [--only plate,...] [--dry]
//                                                                           bake every plate with a missing or differing file from its recipe
// lock keeps a plate's entry, recipe and all, while its files still match it: a plate the lock run did not rebake keeps
// the recipe that made it, so editing a source never makes an old picture look current (the 30 entries of a07bd37 were
// merged by hand for this reason). --rebaked names plates baked again whose bytes came out the same; they take the
// current recipe. A rebake reproduces the art from source; verify is for copies and rebake for a checkout without plates.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { pipelineOf, recipeOf, recipeDiff, canon } from "./recipe.mjs";

const here = dirname(fileURLToPath(import.meta.url)), render = join(here, ".."), repo = join(render, "..");
const argv = process.argv.slice(2), cmd = argv[0], opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const list = (k) => (opt(k, "") || "").split(",").filter(Boolean);
const content = opt("--content", join(repo, "content")), lockFile = join(repo, "content", "PLATES.lock");
// a text file (place.json, arena-*.json) is hashed as git stores it, CRLF read as LF: a Windows checkout writes them with
// CRLF and every one failed verify after a rebase (2026-10-24); sizes of text files are not compared for the same reason
const TEXT = /\.json$/, sha = (f) => createHash("sha256").update(TEXT.test(f) ? canon(f) : readFileSync(f)).digest("hex");
const files = (d) => readdirSync(d).filter((f) => statSync(join(d, f)).isFile());
function rawNative() { const rn = process.env.RN_ROOT || process.env.LW_RN || fileURLToPath(new URL("../../../../native", import.meta.url)); try { return execFileSync("git", ["-C", rn, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return null; } }
const plates = (dir) => readdirSync(dir).filter((d) => existsSync(join(dir, d, "place.json")));
const readLock = () => (existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : { plates: {} });
const save = (L) => writeFileSync(lockFile, JSON.stringify(L, null, 1) + "\n");
const fileTable = (dir) => Object.fromEntries(files(dir).filter((f) => !f.endsWith(".part") && !f.includes(".part.")).sort().map((f) => [f, { sha256: sha(join(dir, f)), size: TEXT.test(f) ? canon(join(dir, f)).length : statSync(join(dir, f)).size }]));
const sameFiles = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => b[k] && b[k].sha256 === a[k].sha256 && b[k].size === a[k].size); };
// the pipeline tables the entries name, the current one added
const tables = (L, pipe) => { const used = new Set(Object.values(L.plates).map((P) => P.recipe?.pipeline).filter((s) => typeof s === "string")); const t = {}; for (const s of [...used].sort()) if (L.pipelines?.[s]) t[s] = L.pipelines[s]; if (used.has(pipe.sha)) t[pipe.sha] = pipe.files; return t; };

if (cmd === "lock") {
  const old = readLock(), pipe = pipelineOf(), rn = rawNative(), rebaked = new Set(list("--rebaked")), only = new Set(list("--only"));
  const out = { version: 2, made: new Date().toISOString(), pipeline: pipe.sha, rawNative: rn, plates: {}, pipelines: {} };
  let kept = 0, renewed = [];
  for (const name of plates(content).sort()) {
    const dir = join(content, name), pj = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), place = pj.place || name, ft = fileTable(dir), was = old.plates[name];
    if (was && ((only.size && !only.has(name)) || (!rebaked.has(name) && sameFiles(was.files, ft)))) { out.plates[name] = was; kept++; continue; }
    const rec = recipeOf(place, repo, pipe);
    let seed = null; try { seed = (await import(pathToFileURL(join(render, "places", `${place}.mjs`)).href + "?lock")).default.paint?.seed ?? null; } catch { /* a place that needs LW_PLATE: no seed */ }
    out.plates[name] = { recipe: { source: rec?.source || null, pipeline: pipe.sha, rawNative: rn, seed, variants: pj.variants || [], size: [pj.width, pj.height], steps: ["LW_PLATE=1 node render/bake2.mjs --place " + place + " --out content", "python render/tools/restreak.py --src content --dst content --only " + (pj.variants || []).map((v) => `${name}/${v}`).join(",")] }, files: ft };
    renewed.push(name);
  }
  out.pipelines = tables({ ...out, pipelines: old.pipelines || {} }, pipe);
  save(out);
  console.log(`plates: locked ${Object.keys(out.plates).length} plates, ${Object.values(out.plates).reduce((s, p) => s + Object.keys(p.files).length, 0)} files (pipeline ${pipe.sha}, raw-native ${rn ? rn.slice(0, 10) : "unknown"}); ${kept} entries kept as they were, ${renewed.length} written with the current recipe${renewed.length ? `: ${renewed.join(", ")}` : ""}`);
} else if (cmd === "status" || cmd === "stale") {
  const L = readLock(), pipe = pipelineOf(), rn = rawNative(), only = list("--only");
  if (cmd === "stale") {
    const reason = opt("--reason", ""); if (!only.length || !reason) { console.log('usage: plates.mjs stale --only a,b --reason "why"'); process.exit(2); }
    for (const name of only) { if (!L.plates[name]) { console.error(`plates: ${name} is not in the lock`); process.exit(2); } L.plates[name].recipe.stale = reason; }
    save(L); console.log(`plates: marked ${only.length} recipes stale: ${reason}`);
  } else {
    let open = 0, marked = 0, current = 0;
    for (const [name, P] of Object.entries(L.plates)) {
      if (only.length && !only.includes(name)) continue;
      const R = P.recipe || {}, cur = recipeOf(R.source?.place?.replace(/^render\/places\/|\.mjs$/g, "") || name, repo, pipe);
      const diff = recipeDiff(R, cur, L.pipelines || {}); if (cur && R.rawNative && rn && R.rawNative !== rn) diff.push(`raw-native ${R.rawNative.slice(0, 10)} -> ${rn.slice(0, 10)}`);
      if (!diff.length) { current++; if (R.stale) console.log(`${name}: current, but marked stale (${R.stale}); a lock run that rebakes it clears the mark`); continue; }
      if (R.stale) { marked++; console.log(`${name}: stale, marked: ${R.stale}`); continue; }
      open++; console.log(`${name}: STALE, not marked: ${diff.slice(0, 6).join("; ")}${diff.length > 6 ? ` and ${diff.length - 6} more` : ""}`);
    }
    console.log(`plates: ${current} recipes current, ${marked} stale and marked, ${open} stale and not marked`);
    process.exit(open ? 1 : 0);
  }
} else if (cmd === "verify" || cmd === "rebake") {
  const L = readLock(), bad = {};
  for (const [name, P] of Object.entries(L.plates)) for (const [f, e] of Object.entries(P.files)) {
    const p = join(content, name, f);
    if (!existsSync(p)) (bad[name] ||= []).push(`${f}: missing`);
    else if ((!TEXT.test(f) && statSync(p).size !== e.size) || (cmd === "verify" && sha(p) !== e.sha256)) (bad[name] ||= []).push(`${f}: differs`);
  }
  const n = Object.keys(bad).length;
  if (cmd === "verify") {
    for (const [name, list] of Object.entries(bad)) console.log(`${name}: ${list.slice(0, 4).join("; ")}${list.length > 4 ? ` and ${list.length - 4} more` : ""}`);
    console.log(n ? `plates: ${n} of ${Object.keys(L.plates).length} plates differ from the lock` : `plates: all ${Object.keys(L.plates).length} plates match the lock`);
    process.exit(n ? 1 : 0);
  }
  const only = opt("--only", ""), todo = Object.keys(bad).filter((p) => !only || only.split(",").includes(p)), pipe = pipelineOf();
  if (L.pipeline !== pipe.sha) console.log(`plates: note: the pipeline has changed since the lock (${L.pipeline} -> ${pipe.sha}); rebaked plates will differ from it`);
  for (const name of todo) {
    const R = L.plates[name].recipe; console.log(`plates: rebake ${name} (${bad[name].length} files): ${R.steps.join(" && ")}`);
    if (argv.includes("--dry")) continue;
    const r = spawnSync(process.execPath, ["render/bake2.mjs", "--place", R.source ? R.source.place.replace(/^render\/places\/|\.mjs$/g, "") : name, "--out", content], { cwd: repo, stdio: "inherit", env: { ...process.env, LW_PLATE: "1" } });
    if (r.status !== 0) { console.error(`plates: ${name} failed to bake`); process.exitCode = 1; continue; }
    spawnSync("python", ["render/tools/restreak.py", "--src", content, "--dst", content, "--only", R.variants.map((v) => `${name}/${v}`).join(",")], { cwd: repo, stdio: "inherit" });
  }
  if (!todo.length) console.log("plates: nothing to rebake");
} else { console.log("usage: node render/tools/plates.mjs lock | verify | status | stale | rebake [--content dir] [--only a,b] [--rebaked a,b] [--reason why] [--dry]"); process.exit(2); }
