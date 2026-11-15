// The GPU lock helper (tools/gpu-lock.mjs): taking, waiting, stale detection and takeover by rename,
// release on exit and on an uncaught error. Runs in a scratch folder, never on <lock root>.
//   node --test tools/tests/gpu-lock.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readdirSync, writeFileSync, mkdirSync, utimesSync, readFileSync } from "node:fs";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { acquireGpuLock, lockStatus } from "../gpu-lock.mjs";

const fresh = () => mkdtempSync(join(tmpdir(), "lwgpu-"));
const quiet = { log: () => {} };
const stales = (root) => readdirSync(root).filter((n) => n.startsWith("stale-"));
const plant = (root, owner) => { mkdirSync(join(root, "lock.d"), { recursive: true }); if (owner) writeFileSync(join(root, "lock.d", "owner.json"), JSON.stringify(owner)); };

test("takes, names the holder, releases", async () => {
  const root = fresh(), L = await acquireGpuLock({ job: "t1", root, ...quiet });
  const s = lockStatus({ root }); assert.equal(s.held, true); assert.equal(s.stale, false); assert.equal(s.owner.job, "t1"); assert.equal(s.owner.pid, process.pid);
  L.release(); assert.equal(existsSync(join(root, "lock.d")), false);
});
test("a live holder makes the next job wait", async () => {
  const root = fresh(), L = await acquireGpuLock({ job: "a", root, ...quiet });
  await assert.rejects(acquireGpuLock({ job: "b", root, waitMs: 200, pollMs: 50, ...quiet }), /still held/);
  L.release();
});
test("a dead owner pid is stale: renamed aside, never deleted", async () => {
  const root = fresh(), dead = spawnSync(process.execPath, ["-e", "0"]).pid;
  plant(root, { pid: dead, job: "gone", host: hostname(), heartbeat: Date.now() });
  assert.match(lockStatus({ root }).why, /is gone/);
  const L = await acquireGpuLock({ job: "new", root, ...quiet });
  assert.equal(stales(root).length, 1); assert.equal(JSON.parse(readFileSync(join(root, stales(root)[0], "owner.json"), "utf8")).job, "gone");
  L.release();
});
test("an old heartbeat is stale even with a live pid", async () => {
  const root = fresh();
  plant(root, { pid: process.pid, job: "hung", host: hostname(), heartbeat: Date.now() - 3 * 60000 });
  assert.equal(lockStatus({ root }).stale, true);
  const L = await acquireGpuLock({ job: "new", root, ...quiet }); assert.equal(stales(root).length, 1); L.release();
});
test("no owner file: fresh is held, over 2 minutes is stale", async () => {
  const root = fresh(); plant(root, null);
  assert.deepEqual([lockStatus({ root }).held, lockStatus({ root }).stale], [true, false]);
  await assert.rejects(acquireGpuLock({ job: "x", root, waitMs: 100, pollMs: 50, ...quiet }), /still held/);
  const old = (Date.now() - 3 * 60000) / 1000; utimesSync(join(root, "lock.d"), old, old);
  assert.equal(lockStatus({ root }).stale, true);
  const L = await acquireGpuLock({ job: "x", root, ...quiet }); assert.equal(stales(root).length, 1); L.release();
});
test("a lock taken over from us is not released by us", async () => {
  const root = fresh(), L = await acquireGpuLock({ job: "slow", root, ...quiet });
  writeFileSync(join(root, "lock.d", "owner.json"), JSON.stringify({ pid: process.pid, job: "other", host: hostname(), heartbeat: Date.now(), token: "theirs" }));
  L.release(); assert.equal(existsSync(join(root, "lock.d")), true);
});
const child = (root, body) => spawnSync(process.execPath, ["--input-type=module", "-e", `import { acquireGpuLock } from ${JSON.stringify(new URL("../gpu-lock.mjs", import.meta.url).href)}; ${body}`], { env: { ...process.env, LW_GPU_LOCK_ROOT: root }, encoding: "utf8" });
test("released on normal exit and on an uncaught error", () => {
  const a = fresh(); child(a, "await acquireGpuLock({ job: 'exit', log: () => {} });"); assert.equal(existsSync(join(a, "lock.d")), false);
  const b = fresh(), r = child(b, "await acquireGpuLock({ job: 'boom', log: () => {} }); setTimeout(() => { throw new Error('boom'); }, 10);");
  assert.equal(r.status, 1); assert.equal(existsSync(join(b, "lock.d")), false);
  const c = fresh(); child(c, "await acquireGpuLock({ job: 'rej', log: () => {} }); Promise.reject(new Error('no'));"); assert.equal(existsSync(join(c, "lock.d")), false);
});
test("released on SIGINT (the handler, raised in-process: Windows has no kill -INT)", () => {
  const d = fresh(), r = child(d, "await acquireGpuLock({ job: 'int', log: () => {} }); process.emit('SIGINT', 'SIGINT'); setTimeout(() => {}, 5000);");
  assert.equal(r.status, 130); assert.equal(existsSync(join(d, "lock.d")), false);
});
test("a hard kill leaves a lock the next job finds stale (pid gone)", async () => {
  const e = fresh(), r = child(e, "await acquireGpuLock({ job: 'killed', log: () => {} }); process.reallyExit(9);");
  assert.equal(existsSync(join(e, "lock.d")), true); assert.equal(lockStatus({ root: e }).stale, true);
  const L = await acquireGpuLock({ job: "next", root: e, ...quiet }); assert.equal(stales(e).length, 1); L.release(); void r;
});

// named locks: bench (exclusive) and heavy-cpu (shared, kept out while bench is held)
import { acquireBench, acquireHeavy, heavyStatus, allStatus } from "../gpu-lock.mjs";
test("bench lives in bench.d, apart from the GPU lock", async () => {
  const root = fresh(), G = await acquireGpuLock({ job: "g", root, ...quiet }), B = await acquireBench({ job: "b", root, ...quiet });
  assert.equal(existsSync(join(root, "bench.d")), true); assert.equal(lockStatus({ root, name: "bench" }).owner.job, "b");
  assert.deepEqual(B.drain.heavyLeft, []);
  await assert.rejects(acquireBench({ job: "b2", root, waitMs: 150, pollMs: 50, ...quiet }), /bench still held/);
  B.release(); G.release(); assert.equal(existsSync(join(root, "bench.d")), false);
});
test("heavy jobs share; each waits while bench is held", async () => {
  const root = fresh(), H1 = await acquireHeavy({ job: "h1", root, ...quiet }), H2 = await acquireHeavy({ job: "h2", root, ...quiet });
  assert.equal(heavyStatus({ root }).length, 2); H1.release(); H2.release(); assert.equal(heavyStatus({ root }).length, 0);
  const B = await acquireBench({ job: "b", root, ...quiet });
  await assert.rejects(acquireHeavy({ job: "h3", root, waitMs: 150, pollMs: 50, ...quiet }), /bench still held/);
  assert.equal(heavyStatus({ root }).length, 0, "a waiting heavy job leaves no entry behind");
  B.release(); const H3 = await acquireHeavy({ job: "h3", root, ...quiet }); assert.equal(allStatus({ root }).heavy.length, 1); H3.release();
});
test("bench waits for running heavy jobs, then goes on when they finish", async () => {
  const root = fresh(), H = await acquireHeavy({ job: "bake", root, ...quiet });
  setTimeout(() => H.release(), 200);
  const t0 = Date.now(), B = await acquireBench({ job: "b", root, pollMs: 30, ...quiet });
  assert.ok(Date.now() - t0 >= 150, "waited for the bake"); assert.deepEqual(B.drain.heavyLeft, []); B.release();
});
test("bench gives up waiting at the cap and names what was still running", async () => {
  const root = fresh(), H = await acquireHeavy({ job: "compile", root, ...quiet });
  const B = await acquireBench({ job: "b", root, drainMs: 120, pollMs: 30, ...quiet });
  assert.ok(B.drain.waitedMs >= 120); assert.equal(B.drain.heavyLeft.length, 1); assert.match(B.drain.heavyLeft[0], /compile/);
  B.release(); H.release();
});
test("stale heavy entries and a stale bench are moved aside, not waited on", async () => {
  const root = fresh(), dead = spawnSync(process.execPath, ["-e", "0"]).pid;
  mkdirSync(join(root, "heavy", "x.d"), { recursive: true }); writeFileSync(join(root, "heavy", "x.d", "owner.json"), JSON.stringify({ pid: dead, job: "gone", host: hostname(), heartbeat: Date.now() }));
  const B = await acquireBench({ job: "b", root, drainMs: 5000, pollMs: 30, ...quiet }); assert.deepEqual(B.drain.heavyLeft, []); assert.equal(stales(root).length, 1); B.release();
  mkdirSync(join(root, "bench.d")); writeFileSync(join(root, "bench.d", "owner.json"), JSON.stringify({ pid: dead, job: "gone", host: hostname(), heartbeat: Date.now() }));
  const H = await acquireHeavy({ job: "h", root, ...quiet }); assert.equal(stales(root).length, 2); H.release();
});
test("CLI run --lock heavy-cpu holds an entry while the command runs", () => {
  const root = fresh(), cli = new URL("../gpu-lock.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const r = spawnSync(process.execPath, [cli, "run", "--lock", "heavy-cpu", "cli-job", "--", process.execPath, "-e", "const fs=require('fs');console.log(fs.readdirSync(process.env.LW_GPU_LOCK_ROOT+'/heavy').length)"], { env: { ...process.env, LW_GPU_LOCK_ROOT: root }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout.trim(), "1"); assert.equal(heavyStatus({ root }).length, 0);
});
