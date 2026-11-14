#!/usr/bin/env node
// Flags that are set and never read: a promise the game never keeps (the research harvest of 2026-10-21,
// after the Disco Elysium writers' habit of tagging moments for later callbacks). A flag counts as read
// when its name appears anywhere in the content (every act and the area wiring) outside the set(...)
// that sets it, or in the engine's own code (rules and events that read flags by name).
//   node tools/flags.mjs [act root .lwd] [--json]      default content/act1/act1.lwd
// Prints each unread flag with the file and line that sets it, then a count. Exit 0 always: some
// flags are kept for acts not yet written, so the list is a reading list, not a gate.
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAct } from "../dialogue/book.mjs";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..", "..", ".."), content = join(root, "content"), engine = join(here, "..");
const argv = process.argv.slice(2), act = argv.find((a) => a.endsWith(".lwd")) || join(content, "act1", "act1.lwd");
const slash = (p) => p.split("\\").join("/");
async function walk(dir, ext, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/^(node_modules|out|retired|capture|\.pre-.*)$/.test(e.name)) await walk(p, ext, out); }
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}
const { sources } = await loadAct(slash(act), (p) => readFile(p, "utf8"));
const SET = /\bset\(\s*([\w.]+)\s*\)/g, sets = new Map();
for (const s of sources) s.text.split(/\r?\n/).forEach((line, i) => { if (/^\s*#/.test(line)) return; for (const m of line.matchAll(SET)) if (!sets.has(m[1])) sets.set(m[1], `${slash(s.file).split("/content/").pop()}:${i + 1}`); });
// everything that could read a flag: all content, the wiring and the engine code, with the set(...) calls blanked out
const texts = [];
for (const f of [...await walk(content, ".lwd"), ...await walk(join(engine, "wiring"), ".lwd")]) texts.push((await readFile(f, "utf8")).split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join("\n").replace(SET, ""));
for (const f of await walk(engine, ".mjs")) if (!slash(f).endsWith("tools/flags.mjs")) texts.push(await readFile(f, "utf8"));
const all = texts.join("\n"), esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const readOne = (id) => new RegExp(`(^|[^\\w.])${esc(id)}($|[^\\w.])`, "m").test(all);
// One line of dialogue sets two flags together: said.<key> (Lamb said it) and heard.<who>.<key> (each
// listener heard it). A callback on either is the game remembering that line, so they count as one promise.
// (a lie is the same utterance as well: lied.<key> beside said.<key>; and heard.<who>.<key> is sometimes
// paired with said.<who>_<key>, so a heard flag carries both keys)
const keys = (id) => { let m; if ((m = /^(?:said|lied)\.(.+)$/.exec(id))) return [m[1]]; if ((m = /^heard\.([^.]+)\.(.+)$/.exec(id))) return [m[2], `${m[1]}_${m[2]}`, `${m[2]}_${m[1]}`]; return []; };
const keyRead = new Set(); for (const [id] of sets) if (readOne(id)) for (const k of keys(id)) keyRead.add(k);
const unread = [...sets].filter(([id]) => !readOne(id) && !keys(id).some((k) => keyRead.has(k)));
const promises = new Set(unread.map(([id]) => keys(id)[0] || id));
if (argv.includes("--json")) console.log(JSON.stringify({ act: slash(act), set: sets.size, unread: unread.map(([id, at]) => ({ id, at })) }, null, 1));
else { for (const [id, at] of unread) console.log(`${at}: ${id} is set and never read`); console.log(`${sets.size} flags set in ${slash(act).split("/content/").pop()}; ${unread.length} never read (${promises.size} promises, a said and its heard counted once; ${[...sets].filter(([id]) => !readOne(id)).length} never read by name)`); }
