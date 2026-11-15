// A storage adapter over a folder of files, for the harness (Node only): the same { get, set, remove } shape as
// save/save.mjs browserStorage, one file per key. The world record (save/worldrecord.mjs) uses it in
// tools/playthrough.mjs --world <dir>, so a harness run leaves its entry for the next run, as the game does.
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

export function fileStorage(dir) {
  mkdirSync(dir, { recursive: true });
  const f = (k) => join(dir, `${k.replace(/[^\w.-]/g, "_")}.json`);
  return {
    get: (k) => (existsSync(f(k)) ? readFileSync(f(k), "utf8") : null),
    set: (k, v) => writeFileSync(f(k), v),
    remove: (k) => { try { rmSync(f(k)); } catch (e) { if (e.code !== "ENOENT") throw e; } },
  };
}
