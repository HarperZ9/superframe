// The plate recipe (render/tools/recipe.mjs) must change whenever any file a bake loads changes. Each case bakes a tiny
// preview of a real place (about 40 x 26 px, under a second) with a preload that records every module the main thread
// and the shade workers load, then checks two things: every loaded repository file is in the recipe, and changing any
// one of them (in a copy of the repository's sources) changes the recipe. The places cover an era 5 room on the era 3,
// 4 and 5 kits, the square world with its season helper (render/worlds/_season.mjs), an era 2 room (render/worlds/_room.mjs,
// render/places/_q2.mjs) and a pre-Quota street plate. Before the closure recipe this failed on render/sdf.mjs,
// render/grade.mjs, render/places/_q*.mjs and the worlds' own-folder helpers.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const repo = fileURLToPath(new URL("../../../../", import.meta.url));
const { recipeOf, pipelineOf, closure, REPO } = await import(pathToFileURL(join(repo, "render/tools/recipe.mjs")).href);
const PLACES = ["q5_police", "q1_tower", "q_sheaf", "brine"];
const scratch = mkdtempSync(join(process.env.LW_TEST_TMP || tmpdir(), "lw-recipe-"));
test.after(() => rmSync(scratch, { recursive: true, force: true }));

// the repository files a tiny bake of <place> loads (relative, forward slashes)
function loaded(place) {
  const log = join(scratch, `${place}.log`);
  const r = spawnSync(process.execPath, ["--import", pathToFileURL(join(repo, "game/engine/paint/tests/fixtures/loadlog.mjs")).href, "render/bake2.mjs", "--place", place, "--preview", "0.02", "--preview-out", join(scratch, "pv")],
    { cwd: repo, encoding: "utf8", env: { ...process.env, LW_PLATE: "1", LW_LOADLOG: log } });
  assert.equal(r.status, 0, `${place}: the tiny bake failed\n${r.stderr}`);
  const root = pathToFileURL(repo).href;
  return [...new Set(readFileSync(log, "utf8").split("\n").filter((u) => u.startsWith(root)).map((u) => decodeURIComponent(u.slice(root.length).split("?")[0])))].sort();
}
const covered = (rec, pipe) => new Set([...Object.keys(pipe.files), ...Object.keys(rec.source.deps)]);

for (const place of PLACES) test(`${place}: every module the bake loads is in its recipe, and changing it changes the recipe`, () => {
  const files = loaded(place), pipe = pipelineOf(), rec = recipeOf(place, REPO, pipe), have = covered(rec, pipe);
  assert.ok(files.includes("render/sdf.mjs") && files.includes(`render/places/${place}.mjs`), `${place}: the trace saw the tracer and the place (${files.length} files)`);
  assert.deepEqual(files.filter((f) => !have.has(f)), [], `${place}: loaded but outside the recipe`);
  // a copy of every file the recipe and the bake name, so each can be changed without touching the checkout
  const root = join(scratch, `copy-${place}`);
  for (const f of new Set([...files, ...have])) { mkdirSync(dirname(join(root, f)), { recursive: true }); copyFileSync(join(repo, f), join(root, f)); }
  const base = recipeOf(place, root), key = (r) => `${r.source.sha} ${r.pipeline}`;
  assert.equal(key(base), key(rec), `${place}: the copy's recipe matches the checkout's`);
  const unchanged = [];
  for (const f of files) {
    const p = join(root, f), orig = readFileSync(p);
    writeFileSync(p, Buffer.concat([orig, Buffer.from("\n// changed\n")]));
    if (key(recipeOf(place, root)) === key(base)) unchanged.push(f);
    writeFileSync(p, orig);
  }
  assert.deepEqual(unchanged, [], `${place}: changing these left the recipe unchanged`);
});

test("line endings never change a recipe (CRLF is read as LF)", () => {
  const root = join(scratch, "crlf"), place = "q1_tower", pipe = pipelineOf();
  for (const f of new Set([...Object.keys(pipe.files), ...Object.keys(recipeOf(place, REPO, pipe).source.deps)])) { mkdirSync(dirname(join(root, f)), { recursive: true }); copyFileSync(join(repo, f), join(root, f)); }
  const a = recipeOf(place, root);
  for (const f of ["render/sdf.mjs", "render/worlds/_season.mjs", "render/places/q1_tower.mjs"]) { const p = join(root, f); writeFileSync(p, readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")); }
  const b = recipeOf(place, root);
  assert.equal(`${b.source.sha} ${b.pipeline}`, `${a.source.sha} ${a.pipeline}`);
});

test("the closure follows a template's literal head and leaves engine modules to the raw-native revision", () => {
  const all = closure([join(REPO, "render", "bake2.mjs")]).map((f) => f.slice(REPO.length).replace(/\\/g, "/").replace(/^\//, ""));
  assert.ok(all.includes("render/v2/dark_scene.mjs"), "dark_scene.mjs is imported as `dark_scene.mjs?place=${...}`");
  assert.ok(all.every((f) => existsSync(join(REPO, f))));
});
