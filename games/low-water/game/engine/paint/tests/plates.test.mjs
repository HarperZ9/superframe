// Every plate the game can load is in content/PLATES.lock (render/tools/plates.mjs): each tracked
// content/<plate>/place.json and each plate the area wiring names has a lock entry with a recipe, and the lock
// lists the files the game reads for it (each variant's plate, the blackout plate, the geo buffers). Plate
// images are not in git; the lock is how a clean checkout reproduces or verifies them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const repo = new URL("../../../../", import.meta.url), at = (p) => new URL(p, repo);
const L = JSON.parse(readFileSync(at("content/PLATES.lock"), "utf8"));
// the plates the area wiring names (walked plates: their geo buffers are read too)
const wired = new Set(); for (const f of readdirSync(at("game/engine/wiring/")).filter((f) => f.endsWith(".lwd"))) for (const m of readFileSync(at(`game/engine/wiring/${f}`), "utf8").matchAll(/^plate:\s*(\S+)/gm)) wired.add(m[1]);

test("every place.json in content has a lock entry listing what the game reads", () => {
  const missing = [];
  for (const d of readdirSync(at("content/"))) {
    if (!existsSync(at(`content/${d}/place.json`))) continue;
    const pj = JSON.parse(readFileSync(at(`content/${d}/place.json`), "utf8")), P = L.plates[d];
    if (!P) { missing.push(`${d}: no lock entry`); continue; }
    assert.ok(P.recipe && P.recipe.source && P.recipe.source.place, `${d}: a recipe with its source`);
    const need = [...(pj.variants || []).map((v) => `${v}.png`), ...(wired.has(d) ? ["geo-id.u8", "geo-pos.f32"] : []), ...(pj.dark ? ["dark.png"] : [])];
    for (const f of need) if (!P.files[f]) missing.push(`${d}/${f}: not in the lock`);
  }
  assert.deepEqual(missing, []);
});

test("every plate the area wiring names is in the lock, or declared pending and not locked", () => {
  const missing = [], pending = JSON.parse(readFileSync(at("content/PLATES.pending.json"), "utf8")).plates;
  for (const k of Object.keys(pending)) if (L.plates[k]) missing.push(`${k}: locked, so it must leave content/PLATES.pending.json`);
  for (const f of readdirSync(at("game/engine/wiring/")).filter((f) => f.endsWith(".lwd"))) {
    for (const m of readFileSync(at(`game/engine/wiring/${f}`), "utf8").matchAll(/^plate:\s*(\S+)/gm)) if (!L.plates[m[1]] && !pending[m[1]]) missing.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(missing, []);
});

// The recipe each entry records is the one that made its files (render/tools/recipe.mjs: every repository file the bake
// reads, hashed). An entry whose sources have moved on must be rebaked and relocked, or marked stale on purpose with its
// reason (node render/tools/plates.mjs stale --only <plate> --reason "..."); `plates.mjs status` names the files that moved.
test("every lock entry's recipe matches the sources, or is marked stale with a reason", async () => {
  const { recipeOf, pipelineOf, recipeDiff } = await import(pathToFileURL(fileURLToPath(at("render/tools/recipe.mjs"))).href);
  const pipe = pipelineOf(), open = [];
  for (const [name, P] of Object.entries(L.plates)) {
    const R = P.recipe || {}; if (typeof R.stale === "string" && R.stale.trim()) continue;
    const diff = recipeDiff(R, recipeOf(R.source?.place?.replace(/^render\/places\/|\.mjs$/g, "") || name, undefined, pipe), L.pipelines || {});
    if (diff.length) open.push(`${name}: ${diff.slice(0, 3).join("; ")}`);
  }
  assert.deepEqual(open, []);
});
