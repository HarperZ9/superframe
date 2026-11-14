// Shared machine locks (coordinator, 2026-10-21), all under the lock root (LW_GPU_LOCK_ROOT, or lw-gpu in the system temp folder):
//   gpu        <lock root>/lock.d    exclusive: one GPU job at a time
//   bench      <lock root>/bench.d   exclusive: one benchmark run at a time. After taking it the bench waits
//                                  for running heavy jobs to finish, for up to 10 minutes, then records
//                                  what is still running and goes on.
//   heavy-cpu  <lock root>/heavy/<pid>-<time>-<tag>.d   shared: any number of heavy CPU jobs (bakes,
//                                  compiles, headless captures, test suites over about 30 s) at once,
//                                  each of them waiting while `bench` is held.
// Every lock directory is made atomically by mkdir and holds owner.json: pid, job, host, start and a
// heartbeat refreshed every 30 s. A lock is stale when its owner pid is gone, its heartbeat is more than 2
// minutes old, or it has had no owner file for more than 2 minutes. A stale lock is taken over by renaming
// it atomically to <lock root>/stale-<timestamp>-<pid>-<tag>.d, never by deleting it; the stale folders stay
// for the author to clear. A holder releases on exit, SIGINT, SIGTERM, SIGBREAK and an uncaught error, and
// only while the lock is still its own.
//   import { acquireGpuLock, acquireBench, acquireHeavy, withGpuLock, lockStatus, allStatus } from "./gpu-lock.mjs";
//   const L = await acquireGpuLock({ job: "bench" }); ... ; L.release();
//   const B = await acquireBench({ job: "perf bench" });  // B.drain = { waitedMs, heavyLeft }
// CLI:
//   node tools/gpu-lock.mjs status                                                 every lock, and whether it is stale
//   node tools/gpu-lock.mjs run [--lock gpu|bench|heavy-cpu] <job> -- <cmd ...>    hold a lock while a command runs
// LW_GPU_LOCK_ROOT moves the locks (the tests use a scratch folder).
import { mkdirSync, writeFileSync, readFileSync, renameSync, rmdirSync, unlinkSync, statSync, readdirSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export const ROOT = process.env.LW_GPU_LOCK_ROOT || join(tmpdir(), "lw-gpu");
export const HEARTBEAT_MS = 30000, STALE_MS = 120000, DRAIN_MS = 600000;
export const LOCKS = ["gpu", "bench", "heavy-cpu"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lockDir = (root, name) => join(root, name === "gpu" ? "lock.d" : `${name}.d`);
const heavyDir = (root) => join(root, "heavy");
const tag = () => Math.random().toString(36).slice(2, 7);

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }   // EPERM: alive, someone else's
}

// { held, stale, why, owner, ageMs } for one lock directory as it is now
export function dirStatus(dir, { now = Date.now(), staleMs = STALE_MS } = {}) {
  let st; try { st = statSync(dir); } catch { return { held: false, stale: false, why: "free", owner: null }; }
  let owner = null; try { owner = JSON.parse(readFileSync(join(dir, "owner.json"), "utf8")); } catch { /* none yet, or being written */ }
  if (!owner) { const age = now - st.mtimeMs; return { held: true, stale: age > staleMs, why: age > staleMs ? `no owner file for ${Math.round(age / 1000)} s` : "no owner file yet", owner: null, ageMs: age }; }
  const beat = now - (owner.heartbeat || 0);
  if (owner.host === hostname() && !pidAlive(owner.pid)) return { held: true, stale: true, why: `owner pid ${owner.pid} (${owner.job}) is gone`, owner, ageMs: beat };
  if (beat > staleMs) return { held: true, stale: true, why: `heartbeat ${Math.round(beat / 1000)} s old (${owner.job}, pid ${owner.pid})`, owner, ageMs: beat };
  return { held: true, stale: false, why: `held by ${owner.job}, pid ${owner.pid}`, owner, ageMs: beat };
}
export const lockStatus = ({ root = ROOT, name = "gpu", now, staleMs } = {}) => dirStatus(lockDir(root, name), { now, staleMs });
// every heavy-cpu entry now, stale ones included and marked
export function heavyStatus({ root = ROOT, now, staleMs } = {}) {
  let names = []; try { names = readdirSync(heavyDir(root)).filter((n) => n.endsWith(".d")); } catch { /* none yet */ }
  return names.map((n) => ({ dir: join(heavyDir(root), n), ...dirStatus(join(heavyDir(root), n), { now, staleMs }) }));
}
export const allStatus = ({ root = ROOT } = {}) => ({ gpu: lockStatus({ root, name: "gpu" }), bench: lockStatus({ root, name: "bench" }), heavy: heavyStatus({ root }) });

// rename a stale lock aside; true when this caller moved it (another may have won the race)
function takeOver(root, dir, why) {
  const to = join(root, `stale-${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}-${tag()}.d`);
  try { renameSync(dir, to); console.warn(`gpu-lock: stale lock ${dir} moved to ${to} (${why})`); return true; }
  catch (e) { if (e.code === "ENOENT" || e.code === "EPERM" || e.code === "EEXIST" || e.code === "EBUSY") return false; throw e; }
}

// hold a lock directory this process just made: owner file, heartbeat, release on exit, signals and errors
function hold(dir, job, heartbeatMs) {
  const ownerPath = join(dir, "owner.json"), token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const owner = { pid: process.pid, job, host: hostname(), started: new Date().toISOString(), token, heartbeat: Date.now() };
  const write = () => { owner.heartbeat = Date.now(); const tmp = `${ownerPath}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(owner)); renameSync(tmp, ownerPath); };
  write();
  const mine = () => { try { return JSON.parse(readFileSync(ownerPath, "utf8")).token === token; } catch { return false; } };
  const timer = setInterval(() => { try { if (mine()) write(); } catch (e) { console.error(`gpu-lock: heartbeat failed: ${e.message}`); } }, heartbeatMs); timer.unref();
  let released = false;
  function release() {
    if (released) return; released = true; clearInterval(timer);
    for (const [ev, fn] of handlers) process.off(ev, fn);
    // only our own lock: one taken over from us (we were judged stale) belongs to someone else now
    if (!mine()) { console.warn(`gpu-lock: ${dir} is no longer ours; left alone`); return; }
    try { unlinkSync(ownerPath); rmdirSync(dir); } catch (e) { console.error(`gpu-lock: release of ${dir} failed: ${e.message}`); }
  }
  const onSignal = (sig) => () => { release(); process.exit(sig === "SIGINT" ? 130 : 143); };
  const onError = (err) => { console.error(err && err.stack ? err.stack : err); release(); process.exit(1); };
  const handlers = [["exit", release], ["SIGINT", onSignal("SIGINT")], ["SIGTERM", onSignal("SIGTERM")], ["SIGBREAK", onSignal("SIGBREAK")], ["uncaughtException", onError], ["unhandledRejection", onError]];
  for (const [ev, fn] of handlers) process.on(ev, fn);
  return { release, path: dir, owner, mine };
}

// an exclusive lock by name: gpu or bench
export async function acquireLock({ name = "gpu", job, root = ROOT, waitMs = Infinity, pollMs = 5000, staleMs = STALE_MS, heartbeatMs = HEARTBEAT_MS, log = console.log } = {}) {
  if (!job) throw new Error("gpu-lock: a job name is required");
  if (name === "heavy-cpu") throw new Error("gpu-lock: heavy-cpu is shared; use acquireHeavy");
  mkdirSync(root, { recursive: true });
  const dir = lockDir(root, name), t0 = Date.now();
  for (let i = 0; ; i++) {
    try { mkdirSync(dir); break; }
    catch (e) {
      if (e.code !== "EEXIST") throw e;
      const s = dirStatus(dir, { staleMs });
      if (s.stale && takeOver(root, dir, s.why)) continue;
      if (Date.now() - t0 > waitMs) throw new Error(`gpu-lock: ${name} still held after ${Math.round(waitMs / 1000)} s (${s.why})`);
      if (i % 12 === 0) log(`gpu-lock: ${name} ${s.why}; waiting`);
      await sleep(pollMs);
    }
  }
  return hold(dir, job, heartbeatMs);
}
export const acquireGpuLock = (o = {}) => acquireLock({ ...o, name: "gpu" });

// a heavy CPU job: shared with other heavy jobs, never while a benchmark holds `bench`
export async function acquireHeavy({ job, root = ROOT, waitMs = Infinity, pollMs = 5000, staleMs = STALE_MS, heartbeatMs = HEARTBEAT_MS, log = console.log } = {}) {
  if (!job) throw new Error("gpu-lock: a job name is required");
  mkdirSync(heavyDir(root), { recursive: true });
  const t0 = Date.now(), benchDir = lockDir(root, "bench");
  const benchHeld = () => { const s = dirStatus(benchDir, { staleMs }); if (s.stale) { takeOver(root, benchDir, s.why); return false; } return s.held; };
  for (let i = 0; ; i++) {
    if (!benchHeld()) {
      const dir = join(heavyDir(root), `${process.pid}-${Date.now()}-${tag()}.d`); mkdirSync(dir);
      const H = hold(dir, job, heartbeatMs);
      // a bench that took its lock between the look and the entry may already have seen no heavy jobs:
      // look again after the entry exists, and step aside if a bench is there
      if (!benchHeld()) return H;
      H.release();
    }
    if (Date.now() - t0 > waitMs) throw new Error(`gpu-lock: bench still held after ${Math.round(waitMs / 1000)} s`);
    if (i % 12 === 0) log(`gpu-lock: a benchmark holds bench; ${job} waiting`);
    await sleep(pollMs);
  }
}

// a benchmark: `bench` exclusively, then the running heavy jobs drained (stale entries moved aside) for up
// to drainMs. B.drain says how long it waited and which heavy jobs were still running when it went on.
export async function acquireBench({ job, root = ROOT, drainMs = DRAIN_MS, waitMs = Infinity, pollMs = 5000, staleMs = STALE_MS, heartbeatMs = HEARTBEAT_MS, log = console.log } = {}) {
  const B = await acquireLock({ name: "bench", job, root, waitMs, pollMs, staleMs, heartbeatMs, log });
  const t0 = Date.now(); let left = [];
  for (let i = 0; ; i++) {
    left = heavyStatus({ root, staleMs }).filter((h) => { if (h.stale) { takeOver(root, h.dir, h.why); return false; } return h.held; });
    const waited = Date.now() - t0;
    if (!left.length || waited >= drainMs) break;
    if (i % 12 === 0) log(`gpu-lock: bench waiting for ${left.length} heavy job(s): ${left.map((h) => (h.owner ? h.owner.job : "?")).join(", ")}`);
    await sleep(Math.max(10, Math.min(pollMs, drainMs - waited)));
  }
  B.drain = { waitedMs: Date.now() - t0, heavyLeft: left.map((h) => (h.owner ? `${h.owner.job} (pid ${h.owner.pid})` : h.dir)) };
  if (left.length) log(`gpu-lock: bench went on after ${Math.round(B.drain.waitedMs / 1000)} s with heavy jobs still running: ${B.drain.heavyLeft.join(", ")}`);
  return B;
}

export async function withGpuLock(job, fn, opts = {}) {
  const L = await acquireGpuLock({ job, ...opts });
  try { return await fn(L); } finally { L.release(); }
}

// CLI
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), cmd = args.shift();
  let lock = "gpu"; if (args[0] === "--lock") { args.shift(); lock = args.shift(); }
  const [job, ...rest] = args, usage = "usage: node tools/gpu-lock.mjs status | run [--lock gpu|bench|heavy-cpu] <job> -- <cmd ...>";
  if (cmd === "status") { console.log(JSON.stringify(allStatus(), null, 1)); }
  else if (cmd === "run" && job && LOCKS.includes(lock)) {
    const argv = rest[0] === "--" ? rest.slice(1) : rest; if (!argv.length) { console.error(usage); process.exit(2); }
    const L = lock === "heavy-cpu" ? await acquireHeavy({ job }) : lock === "bench" ? await acquireBench({ job }) : await acquireLock({ name: lock, job });
    const ch = spawn(argv[0], argv.slice(1), { stdio: "inherit", shell: /\.(cmd|bat)$/i.test(argv[0]) });
    ch.on("exit", (code) => { L.release(); process.exit(code ?? 1); });
  } else { console.error(usage); process.exit(2); }
}
