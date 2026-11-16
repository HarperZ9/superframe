// game/serve.mjs: a plate missing from the repository's content/ is served from --plates DIR, the
// repository's own file wins over the bake, and no path climbs out of a mount.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SERVE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "game", "serve.mjs");

function start(extra, env = {}) {
  return new Promise((resolve, reject) => {
    const port = 18000 + Math.floor(Math.random() * 2000);
    const p = spawn(process.execPath, [SERVE, "--port", String(port), ...extra], { env: { ...process.env, LW_PLATES: "", ...env } });
    let out = "";
    p.stdout.on("data", (d) => { out += d; if (out.includes("plates:")) resolve({ p, port, out: () => out }); });
    p.on("error", reject);
    setTimeout(() => reject(new Error("serve did not start: " + out)), 8000);
  });
}
const get = async (port, path) => { const r = await fetch(`http://127.0.0.1:${port}${path}`); return { status: r.status, body: await r.text() }; };

test("a plate only in the bake folder is served; the repository's file wins; no climbing out", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lw-plates-"));
  mkdirSync(join(dir, "content", "zz_test_place"), { recursive: true });
  writeFileSync(join(dir, "content", "zz_test_place", "dawn.png"), "BAKED");
  writeFileSync(join(dir, "content", "PLATES.lock"), "NOT THE REPO'S");
  writeFileSync(join(dir, "secret.txt"), "OUTSIDE");
  mkdirSync(join(dir, "characters", "portraits-quota", "zz"), { recursive: true });
  writeFileSync(join(dir, "characters", "portraits-quota", "zz", "neutral-paraffin.png"), "FACE");
  const s = await start(["--plates", dir]);
  try {
    assert.deepEqual(await get(s.port, "/content/zz_test_place/dawn.png"), { status: 200, body: "BAKED" });
    const lock = await get(s.port, "/content/PLATES.lock");
    assert.equal(lock.status, 200); assert.notEqual(lock.body, "NOT THE REPO'S");
    assert.equal((await get(s.port, "/content/nope/none.png")).status, 404);
    assert.deepEqual(await get(s.port, "/characters/portraits-quota/zz/neutral-paraffin.png"), { status: 200, body: "FACE" });
    assert.notEqual((await get(s.port, "/content/%2e%2e/secret.txt")).body, "OUTSIDE");
    assert.notEqual((await get(s.port, "/content/..%2fsecret.txt")).body, "OUTSIDE");
    assert.match(s.out(), /plates: /);
  } finally { s.p.kill(); rmSync(dir, { recursive: true, force: true }); }
});

test("LW_PLATES works like --plates, and without either the bake is absent and the server says so", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lw-plates-"));
  mkdirSync(join(dir, "content", "zz_env_place"), { recursive: true });
  writeFileSync(join(dir, "content", "zz_env_place", "geo-id.u8"), "IDS");
  const a = await start([], { LW_PLATES: dir });
  try { assert.deepEqual(await get(a.port, "/content/zz_env_place/geo-id.u8"), { status: 200, body: "IDS" }); }
  finally { a.p.kill(); }
  const b = await start([]);
  try {
    assert.equal((await get(b.port, "/content/zz_env_place/geo-id.u8")).status, 404);
    assert.match(b.out(), /plates: none given/);
  } finally { b.p.kill(); rmSync(dir, { recursive: true, force: true }); }
});
