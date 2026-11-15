// Saves, settings and the world record as files on disk, behind the storage shape the game already uses
// ({ get(key), set(key, value), remove(key) }, save/save.mjs). The native shell provides a file bridge; in a
// browser with no bridge the game keeps browser storage, as before. Nothing here sends anything anywhere.
//   const fs = createFileStore(bridge, { build })   fs.get(k)  fs.set(k, v)  fs.remove(k)  fs.incidents()
//   const { storage, kind } = openStorage()          the file store when a bridge exists, else browser storage
//   installFileStorage(bridge)                       puts a localStorage-shaped face over the file store, so the
//                                                    saves, the world record and every setting land on disk
//                                                    with no change to the modules that read them
//
// The bridge (W1-D implements it in the shell; nodeBridge below is the same contract over Node's fs). All calls
// are synchronous, because the storage shape is: WebView2 gives synchronous host objects
// (chrome.webview.hostObjects.sync), and the shell's page script sets globalThis.__lwFileBridge to one.
//   read(path)         the file's text, or null when it does not exist
//   write(path, text)  create or overwrite, making folders; flushed to the disk before it returns
//   rename(from, to)   replace `to` in one step (Windows MoveFileExW with REPLACE_EXISTING and WRITE_THROUGH)
//   remove(path)       no error when the file is missing
//   list(dir)          the file names in dir, [] when it is missing
// Paths are relative, with forward slashes, under the bridge's own root folder; the bridge refuses any other.
//
// On disk, under the root (the shell picks it: %LOCALAPPDATA%/Low Water on Windows is the proposal):
//   saves/slot-<slot>.json   one file per save slot (auto, quick, 1 to 9)
//   world/<story>.json       the world record, and world/<story>.b.json its second copy (save/worldrecord.mjs)
//   settings/<key>.json      one file per setting key (prefs, bindings, the boot's seen marks)
//   crash/<id>.json          crash reports (ui/crash.mjs)
// Beside each file: <name>.bak, the last good copy; <name>.tmp, a write in progress; <name>.corrupt-<time>, a
// damaged file moved aside and kept for the crash report (the newest KEEP_CORRUPT of them per file).
//
// A file is an envelope: { format: "low-water.file", version, key, savedAt, build, length, sum, data | text }.
// data holds the value when it is JSON written compactly (so a save reads as JSON on disk); text holds any other
// value. sum is FNV-1a over the value, and length its length: a truncated or edited file fails one of them.
// Version 0 is a bare file with no envelope (what tools/worldfile.mjs writes); it is upgraded on first read.
// The save inside the envelope keeps its own version and migrations (save/save.mjs MIGRATIONS).
//
// Writing a key: the value goes to <name>.tmp and is read back; the current file, when good, is copied to
// <name>.bak (through its own .tmp); then <name>.tmp replaces <name> in one rename, and <name> is read back.
// The live file is never missing and never half written: a write killed at any step leaves the old save or
// the new one whole. Reading a key: the live file when good; else a whole .tmp (a write killed before its last
// rename, so the newest); else the .bak, written back as the live file. A damaged live file is moved aside first.
//
// Steam Cloud, for later (W2-E). From memory, moderate confidence; check against the Steamworks Auto-Cloud page
// before setting it. Auto-Cloud takes a root (WinAppDataLocal, WinMyDocuments, WinSavedGames and others; the
// Linux and Proton roots map onto them), a subdirectory ("Low Water") and file patterns. Sync saves/*.json,
// world/*.json and settings/*.json, recursively off. Leave out *.tmp, *.bak, *.corrupt-*, and crash/ (reports
// stay on the machine). A .bak is a local safety copy; Cloud keeps its own history.
export const FILE_FORMAT = "low-water.file";
export const FILE_VERSION = 1;
export const KEEP_CORRUPT = 3;

const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const stamp = (now) => now().toISOString().replace(/[:.]/g, "-");

export function envelope(key, value, { build = "dev", now = () => new Date() } = {}) {
  const v = String(value), env = { format: FILE_FORMAT, version: FILE_VERSION, key, savedAt: now().toISOString(), build, length: v.length, sum: fnv(v) };
  let data; try { data = JSON.parse(v); } catch { data = undefined; }
  if (data !== undefined && JSON.stringify(data) === v) env.data = data; else env.text = v;
  return env;
}

// FILE_MIGRATIONS[n] turns a version-n file (already parsed, or the raw text for version 0) into version n+1.
export const FILE_MIGRATIONS = {
  0: (raw, key, opt) => envelope(key, raw, opt),
};

// The value a file holds, or why it cannot be trusted: { ok, value, version, upgraded } or { ok: false, why }.
// checks: false skips the length and sum (only the tests' control does that).
export function decode(text, key, { checks = true, ...opt } = {}) {
  if (text == null) return { ok: false, why: "missing" };
  if (text === "") return { ok: false, why: "empty" };
  let d; try { d = JSON.parse(text); } catch (e) { return { ok: false, why: `unreadable (${e.message})` }; }
  let upgraded = false;
  if (!d || typeof d !== "object" || d.format !== FILE_FORMAT) { d = FILE_MIGRATIONS[0](text, key, opt); upgraded = true; }
  if (d.version > FILE_VERSION) return { ok: false, newer: true, why: `version ${d.version} is newer than this game (${FILE_VERSION})` };
  while (d.version < FILE_VERSION) { const m = FILE_MIGRATIONS[d.version]; if (!m) return { ok: false, why: `no upgrade from version ${d.version}` }; d = m(d, key, opt); upgraded = true; }
  if (d.key !== key) return { ok: false, why: `holds ${JSON.stringify(d.key)}, not ${JSON.stringify(key)}` };
  const value = "data" in d ? JSON.stringify(d.data) : typeof d.text === "string" ? d.text : null;
  if (value == null) return { ok: false, why: "no value" };
  if (checks && (value.length !== d.length || fnv(value) !== d.sum)) return { ok: false, why: "the sum does not match (truncated or edited)" };
  return { ok: true, value, version: d.version, upgraded, savedAt: d.savedAt || null };
}

// Where a key lives on disk. A key whose characters had to be replaced gets a hash, so two keys never share a file.
export function pathOf(key) {
  let m = /^lowwater\.save\.(auto|quick|[1-9])$/.exec(key); if (m) return `saves/slot-${m[1]}.json`;
  m = /^lw\.world\.([\w-]+)(\.b)?$/.exec(key); if (m) return `world/${m[1]}${m[2] || ""}.json`;
  m = /^lw\.crash\.([\w-]+)$/.exec(key); if (m) return `crash/${m[1]}.json`;
  const safe = key.replace(/[^\w.-]/g, "_").slice(0, 80);
  return `settings/${safe === key ? safe : `${safe}~${fnv(key)}`}.json`;
}
const DIRS = ["saves", "world", "settings", "crash"];

// verify: false turns off the sums and the read-backs; it exists only so the tests can show their controls fail.
export function createFileStore(bridge, { build = "dev", now = () => new Date(), onIncident = null, verify = true } = {}) {
  if (!bridge || ["read", "write", "rename", "remove", "list"].some((f) => typeof bridge[f] !== "function")) throw new Error("filestore: the bridge needs read, write, rename, remove and list");
  const log = [], lastSaved = { slot: null };
  const opt = { build, now, checks: verify };
  // a sync COM host object may hand back a JSON string or an array-like; the Node bridge gives an array
  const ls = (d) => { const r = bridge.list(d); return typeof r === "string" ? JSON.parse(r) : Array.from(r || []); };
  let seq = 0;
  const note = (kind, key, path, extra = {}) => {
    const e = { at: now().toISOString(), kind, key, path, ...extra }; log.push(e); if (log.length > 50) log.shift();
    (kind === "corrupt" || kind === "write-failed" ? console.error : console.warn)(`filestore: ${kind} ${path}${extra.why ? `: ${extra.why}` : ""}`);
    if (onIncident) { try { onIncident(e); } catch (err) { console.error(`filestore: onIncident failed: ${err.message}`); } }
  };
  const dirOf = (p) => p.slice(0, p.lastIndexOf("/"));
  const nameOf = (p) => p.slice(p.lastIndexOf("/") + 1);
  // a damaged file moved aside, kept for the report; only the newest KEEP_CORRUPT per file stay
  const quarantine = (key, p, why) => {
    const kept = `${p}.corrupt-${stamp(now)}-${seq++}`;
    try { bridge.rename(p, kept); } catch (e) { note("write-failed", key, p, { why: `could not move the damaged file aside: ${e.message}` }); return null; }
    note("corrupt", key, p, { why, kept });
    const mine = ls(dirOf(p)).filter((n) => n.startsWith(`${nameOf(p)}.corrupt-`)).sort();
    for (const old of mine.slice(0, Math.max(0, mine.length - KEEP_CORRUPT))) bridge.remove(`${dirOf(p)}/${old}`);
    return kept;
  };
  // one whole file put in place: through .tmp, read back, renamed over
  const place = (p, text) => {
    bridge.write(`${p}.tmp`, text);
    if (verify && bridge.read(`${p}.tmp`) !== text) { bridge.remove(`${p}.tmp`); throw new Error(`filestore: ${p}.tmp read back different from what was written`); }
    bridge.rename(`${p}.tmp`, p);
  };
  const api = {
    kind: "file",
    get(key) {
      const p = pathOf(key), cur = bridge.read(p), d = decode(cur, key, opt);
      if (d.ok) { if (d.upgraded) { note("upgraded", key, p, { from: 0 }); api.set(key, d.value); } return d.value; }
      // a file from a newer build (another machine through Steam Cloud, say) is left alone, never overwritten
      if (d.newer) { note("newer", key, p, { why: d.why }); return null; }
      if (cur != null) quarantine(key, p, d.why);
      // a whole .tmp is a write that was killed before its last rename: it is the newest
      const t = decode(bridge.read(`${p}.tmp`), key, opt);
      if (t.ok) { bridge.rename(`${p}.tmp`, p); note("promoted", key, p, { why: "an interrupted write was whole" }); return t.value; }
      const b = decode(bridge.read(`${p}.bak`), key, opt);
      if (b.ok) {
        try { place(p, JSON.stringify(envelope(key, b.value, opt), null, 1)); } catch (e) { note("write-failed", key, p, { why: e.message }); }
        note("restored", key, p, { why: cur == null ? "the file was missing" : "the file was damaged", from: `${p}.bak` });
        return b.value;
      }
      return null;
    },
    set(key, value) {
      const p = pathOf(key), text = JSON.stringify(envelope(key, value, opt), null, 1);
      try {
        const cur = bridge.read(p);
        if (cur != null) {
          const d = decode(cur, key, opt);
          if (d.newer) throw new Error(`filestore: ${p} was written by a newer build; not overwritten`);
          if (d.ok) place(`${p}.bak`, cur); else quarantine(key, p, d.why);
        }
        place(p, text);
        if (verify && bridge.read(p) !== text) throw new Error(`filestore: ${p} read back different from what was written`);
      } catch (e) { note("write-failed", key, p, { why: e.message }); throw e; }
      const m = /^lowwater\.save\.(\w+)$/.exec(key); if (m) lastSaved.slot = m[1];
      return true;
    },
    // a removed slot is gone: its .bak and .tmp go too (else the next read would bring it back); damaged copies stay
    remove(key) { const p = pathOf(key); for (const f of [p, `${p}.tmp`, `${p}.bak`]) bridge.remove(f); },
    keys() {
      const out = [];
      for (const dir of DIRS) for (const n of ls(dir)) {
        if (!n.endsWith(".json")) continue;
        try { const d = JSON.parse(bridge.read(`${dir}/${n}`)); if (d && d.format === FILE_FORMAT && pathOf(d.key) === `${dir}/${n}`) out.push(d.key); } catch { /* damaged: get() moves it aside */ }
      }
      return out;
    },
    incidents: () => log.slice(),
    lastSlot: () => lastSaved.slot,
  };
  return api;
}

// The bridge over Node's fs, for the harness and the tests: same contract, rooted at dir.
//   nodeBridge(dir, fs)   fs is node:fs (passed in, so this file loads in a browser)
export function nodeBridge(dir, fs) {
  const abs = (p) => {
    if (typeof p !== "string" || p.startsWith("/") || /^[A-Za-z]:/.test(p) || p.split("/").includes("..")) throw new Error(`bridge: refused path ${p}`);
    return `${dir}/${p}`;
  };
  const up = (p) => fs.mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
  return {
    read: (p) => { try { return fs.readFileSync(abs(p), "utf8"); } catch (e) { if (e.code === "ENOENT") return null; throw e; } },
    write: (p, text) => { const f = abs(p); up(f); const fd = fs.openSync(f, "w"); try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } },
    rename: (a, b) => fs.renameSync(abs(a), abs(b)),
    remove: (p) => { try { fs.rmSync(abs(p)); } catch (e) { if (e.code !== "ENOENT") throw e; } },
    list: (d) => { try { return fs.readdirSync(abs(d)); } catch (e) { if (e.code === "ENOENT") return []; throw e; } },
  };
}

// The bridge the shell left for the page, or null in a plain browser.
export const findBridge = (g = globalThis) => g.__lwFileBridge || null;

// The storage the game should use: files when the shell gave a bridge, else browser storage (save/save.mjs).
export function openStorage({ bridge = findBridge(), browser = null, ...opt } = {}) {
  if (bridge) return { storage: createFileStore(bridge, opt), kind: "file" };
  return { storage: browser, kind: "browser" };
}

// A localStorage-shaped face over a store with get, set, remove and keys.
export function localStorageFace(store) {
  return {
    getItem: (k) => store.get(String(k)),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => store.remove(String(k)),
    clear: () => { for (const k of store.keys()) store.remove(k); },
    key: (i) => store.keys()[i] ?? null,
    get length() { return store.keys().length; },
  };
}

// Put the file store in place of localStorage, before any game module reads it. Every reader of localStorage
// (save/save.mjs browserStorage, ui/dom.mjs store, ui/boot.mjs) then reads and writes files. Returns the store,
// or null when there is no bridge (the browser keeps its own storage).
export function installFileStorage(bridge = findBridge(), { g = globalThis, ...opt } = {}) {
  if (!bridge) return null;
  const store = createFileStore(bridge, opt);
  Object.defineProperty(g, "localStorage", { value: localStorageFace(store), configurable: true, writable: false });
  g.__lwFileStore = store;
  return store;
}
