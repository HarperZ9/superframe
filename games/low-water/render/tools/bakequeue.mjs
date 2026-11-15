// A long bake in pieces, each a short job under the heavy-cpu lock (coordinator, 2026-10-21: a bench must get a
// window between pieces), with checkpoint and resume: the shade in bands of rows, then the geo buffers, then each
// variant's paint and lens layers, then the blackout plate, then the streaks and the plate lock. Each finished
// piece is recorded in render/.tmp/<place><suffix>/queue.json; run it again and it carries on where it stopped.
//   node render/tools/bakequeue.mjs --place quay [--out <content>] [--preview 2 --hires] [--rows 320] [--variants a,b] [--dry]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const name = opt("--place"), out = opt("--out", "content"), pv = +opt("--preview", 1), hires = argv.includes("--hires"), rows = +opt("--rows", 0);
process.env.LW_PLATE = "1";
const P = (await import(pathToFileURL(join(repo, "render", "places", `${name}.mjs`)).href)).default;
const vnames = opt("--variants", Object.keys(P.variants).join(",")).split(","), H = Math.round(P.camera.H * pv), W = Math.round(P.camera.W * pv);
// rows a band: about 2.5 million pixels for all the variants together, a few minutes on this machine
const step = rows || Math.max(64, Math.floor(2.5e6 / W / Math.max(1, vnames.length) / 64) * 64);
const tmp = join(repo, "render", ".tmp", `${name}${pv < 1 ? "-pv" : pv > 1 ? `-x${pv}` : ""}`); mkdirSync(tmp, { recursive: true });
const qf = join(tmp, "queue.json"), Q = existsSync(qf) ? JSON.parse(readFileSync(qf, "utf8")) : { done: [] }, done = new Set(Q.done || []);
const base = ["render/bake2.mjs", "--place", name, "--out", out, ...(pv !== 1 ? ["--preview", String(pv)] : []), ...(hires ? ["--hires"] : [])];
const all = [...base, "--variants", vnames.join(",")];
const pieces = [];
for (let y = 0; y < H; y += step) pieces.push({ id: `band ${y}:${Math.min(H, y + step)}`, args: [...all, "--band", `${y}:${Math.min(H, y + step)}`] });
pieces.push({ id: "assemble", args: [...all, "--only", "assemble"] });
for (const v of vnames) pieces.push({ id: `post ${v}`, args: [...base, "--variants", v, "--only", "post"] });
if (P.dark || P.dithers) pieces.push({ id: "dark", args: [...all, "--only", "dark"] });
for (const p of pieces) {
  if (done.has(p.id)) { console.log(`bakequeue ${name}: ${p.id} done before`); continue; }
  console.log(`bakequeue ${name}: ${p.id}`); if (argv.includes("--dry")) continue;
  const t0 = Date.now(), r = spawnSync(process.execPath, ["tools/gpu-lock.mjs", "run", "--lock", "heavy-cpu", `bake ${name} ${p.id}`, "--", process.execPath, ...p.args], { cwd: repo, stdio: "inherit", env: process.env });
  if (r.status !== 0) { console.error(`bakequeue ${name}: ${p.id} failed; run again to resume`); process.exit(1); }
  done.add(p.id); Q.done = [...done]; Q.last = { id: p.id, s: Math.round((Date.now() - t0) / 1000) }; writeFileSync(qf, JSON.stringify(Q, null, 1));
  console.log(`bakequeue ${name}: ${p.id} in ${Q.last.s} s`);
}
if (argv.includes("--dry")) process.exit(0);
if (pv === 1) {
  spawnSync("python", ["render/tools/restreak.py", "--src", out, "--dst", out, "--only", vnames.map((v) => `${name}/${v}`).join(",")], { cwd: repo, stdio: "inherit" });
  if (argv.includes("--lock")) spawnSync(process.execPath, ["render/tools/plates.mjs", "lock", "--content", out], { cwd: repo, stdio: "inherit" });   // --lock: the plate lock (only for the game's own content folder)
}
writeFileSync(qf, JSON.stringify({ done: [], finished: new Date().toISOString() }, null, 1));   // the next run starts afresh
console.log(`bakequeue ${name}: finished`);
