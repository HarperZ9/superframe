// Tests of the native host (shell/out/lwhost.exe, built by shell/build.bat):
//   1. exe smoke: launch to the title, keys and a pad move focus, settings land on disk, clean exit, timed
//   2. the filestore round trip against the real bridge (the exe's --bridge-op), with the kill-at-every-step sweep
//   3. a real process kill during writes, then a read back through the real bridge
// Run: node --test shell/tests/host.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createFileStore, decode, pathOf } from "../../game/engine/save/filestore.mjs";

const here = dirname(fileURLToPath(import.meta.url)).replace(/\\/g, "/"), exe = join(here, "../out/lwhost.exe"), game = join(here, "../..").replace(/\\/g, "/");
const fresh = () => mkdtempSync(join(tmpdir(), "lwhost-")).replace(/\\/g, "/");
const op = (root, ...a) => spawnSync(exe, ["--bridge-op", ...a.slice(0, 1), root, ...a.slice(1)], { input: a.__in, encoding: "utf8" });
// the real bridge, one process per call (slow, but it is the real thing)
const exeBridge = (root) => ({
  read: (p) => { const r = spawnSync(exe, ["--bridge-op", "read", root, p], { encoding: "utf8" }); if (r.status === 3) return null; if (r.status) throw new Error(r.stderr); return r.stdout; },
  write: (p, t) => { const r = spawnSync(exe, ["--bridge-op", "write", root, p], { input: t, encoding: "utf8" }); if (r.status) throw new Error(r.stderr); },
  rename: (a, b) => { const r = spawnSync(exe, ["--bridge-op", "rename", root, a, b], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr); },
  remove: (p) => { const r = spawnSync(exe, ["--bridge-op", "remove", root, p], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr); },
  list: (d) => spawnSync(exe, ["--bridge-op", "list", root, d], { encoding: "utf8" }).stdout.split("\n").filter(Boolean),
});
const KEY = "lowwater.save.v1.auto", save = (n) => JSON.stringify({ v: 5, pad: "x".repeat(n) });

test("exe smoke: launch to title, focus moves by key and by pad, files on disk, clean exit", { timeout: 120000 }, () => {
  assert.ok(existsSync(exe), "build shell/out/lwhost.exe first (shell/build.bat)");
  const root = fresh(), t0 = Date.now();
  const r = spawnSync(exe, ["--game", game, "--save-root", root, "--smoke"], { encoding: "utf8", timeout: 100000 });
  const wall = Date.now() - t0;
  assert.equal(r.status, 0, `exit code (stderr: ${r.stderr.slice(-300)})`);
  const m = JSON.parse(r.stdout.trim().split("\n").pop());
  const seq = m.focus_sequence.split(",").map(Number);
  assert.deepEqual(seq.slice(0, 4), [seq[0], seq[0] + 1, seq[0] + 2, seq[0] + 1], "Down, Down, Up move the focus by one each");
  assert.equal(seq[4], seq[0] + 2, "a pad d-pad down moves the focus through the real input module");
  assert.ok(m.settings_files_on_disk && readdirSync(join(root, "settings")).length > 0, "the boot's marks are files, not browser storage");
  assert.ok(m.key_to_painted_ms.every((x) => x < 50), `input to painted under 50 ms: ${m.key_to_painted_ms}`);
  assert.ok(wall < 90000, `wall ${wall} ms`);
  console.log(`smoke: wall ${wall} ms; ${r.stdout.trim()}`);
});

test("filestore on the real bridge: round trip, replace, kill at every step leaves the old save or the new one whole", { timeout: 300000 }, () => {
  const root = fresh(), B = exeBridge(root);
  const s = createFileStore(B); s.set(KEY, save(650));
  assert.equal(s.get(KEY), save(650));
  s.set(KEY, save(700)); assert.equal(s.get(KEY), save(700));
  assert.ok(B.list(pathOf(KEY).split("/").slice(0, -1).join("/")).some((f) => f.endsWith(".bak")), "the last good copy sits beside it");
  assert.throws(() => B.write("../escape", "x"), /refused/);
  const outcomes = new Set();
  for (let n = 1; n <= 14; n++) {
    const dir = fresh(), R = exeBridge(dir); createFileStore(R).set(KEY, save(650));
    let k = 0; const die = () => { if (++k === n) throw new Error("killed"); };
    const dying = { read: R.read, list: R.list, write: (p, t) => { die(); R.write(p, t); die(); }, rename: (a, b) => { die(); R.rename(a, b); die(); }, remove: (p) => { die(); R.remove(p); } };
    try { createFileStore(dying).set(KEY, save(700)); } catch (e) { assert.equal(e.message, "killed"); }
    const got = createFileStore(R).get(KEY);
    assert.ok(got === save(650) || got === save(700), `killed at call ${n}: read ${String(got).slice(0, 40)}`);
    outcomes.add(got === save(650) ? "old" : "new");
  }
  assert.deepEqual([...outcomes].sort(), ["new", "old"], "the kills land both before and after the last rename");
});

test("a real process kill during writes: the live file reads whole afterwards", { timeout: 120000 }, async () => {
  const root = fresh();
  for (let round = 0; round < 6; round++) {
    const child = spawn(exe, ["--run", join(here, "stress.mjs"), "--save-root", root], { stdio: ["ignore", "ignore", "pipe"] });
    await new Promise((ok) => { child.stderr.on("data", (d) => { if (String(d).includes("ready")) ok(); }); child.on("exit", ok); });
    await new Promise((ok) => setTimeout(ok, 20 + round * 37));
    child.kill("SIGKILL"); await new Promise((ok) => child.on("exit", ok));
    const B = exeBridge(root), got = createFileStore(B).get(KEY);
    assert.ok(got !== null && decode(B.read(pathOf(KEY)) ?? "", KEY) !== undefined, `round ${round}: a save reads back`);
    assert.match(got, /^\{"v":5,"pad":"x+"\}$/, `round ${round}: the value is whole`);
  }
});
