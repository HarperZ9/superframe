// A book: every record from one or more LWD files, with nodes compiled to steps.
//   const book = loadBook([{ file: "a.lwd", text }, ...]);
//   book.nodes[id].steps, book.meta, book.places, book.facts, book.events, book.records[kind][id]
// Records the dialogue layer does not own (attributes, skills, items and the rest) stay in
// book.records for the rules loader (rules/ruleset.mjs). Errors are collected, not thrown, so the
// validator can list them all; book.ok is false when there are any.
import { parseRecords, parseStep } from "./parse.mjs";
import { toMin, compile, setClockPivot, pivotFor } from "../core/expr.mjs";

const DIALOGUE_KINDS = new Set(["meta", "node", "place", "fact", "event"]);

export function loadBook(sources) {
  const list = typeof sources === "string" ? [{ file: "", text: sources }] : sources;
  const book = { meta: {}, nodes: {}, places: {}, facts: {}, events: [], records: {}, errors: [], files: list.map((s) => s.file), format: "lwd/0" };
  // the clock pivot must be known before any time is parsed (core/expr.mjs toMin)
  const startClock = list.map((s) => String(s.text).match(/^@meta\b[\s\S]*?^clock:\s*(\d+):\d{2}/m)).find(Boolean);
  setClockPivot(pivotFor(startClock ? +startClock[1] : 23));
  book.pivot = startClock ? pivotFor(+startClock[1]) : 12;
  for (const { file, text } of list) {
    const { recs, errors } = parseRecords(text, file);
    book.errors.push(...errors);
    for (const r of recs) addRecord(book, r);
  }
  if (book.meta.format) book.format = book.meta.format.trim().toLowerCase();
  book.clock0 = book.meta.clock ? toMin(book.meta.clock) : 23 * 60;
  book.ok = !book.errors.some((e) => e.level !== "warn");
  return book;
}

function dup(book, r, table) {
  if (table[r.id]) { book.errors.push({ file: r.file, line: r.line, msg: `duplicate ${r.kind} ${r.id} (first at ${table[r.id].file}:${table[r.id].line})` }); return true; }
  return false;
}

function addRecord(book, r) {
  const get = (k) => (r.kv.find((x) => x.key === k) || {}).value, all = (k) => r.kv.filter((x) => x.key === k).map((x) => x.value);
  if (r.kind === "meta") { for (const { key, value } of r.kv) { if (key === "include") (book.meta.include ||= []).push(value.trim()); else book.meta[key] = value; } return; }
  const yes = (k) => /^(yes|true|1)$/i.test(String(get(k) || "").trim());
  if (r.kind === "place") { if (!dup(book, r, book.places)) book.places[r.id] = { id: r.id, name: get("name"), light: +(get("light") ?? 0.5), sodium: +(get("sodium") ?? 0), dark: +(get("dark-light") ?? 0.05), zone: get("zone") || r.id, district: get("district") || null, footing: get("footing") || null, dayLight: get("day-light") != null ? +get("day-light") : undefined, camera: get("camera") != null ? +get("camera") : null, stove: yes("stove"), shelter: yes("shelter"), bench: yes("bench"), file: r.file, line: r.line }; return; }
  if (r.kind === "fact") {
    if (!dup(book, r, book.facts)) book.facts[r.id] = { id: r.id, about: get("about"), by: get("by"), against: all("against").map((v) => { const [who, w] = v.split(/\s+/); return { who, weight: +w || 0 }; }), journal: get("journal") !== "no", file: r.file, line: r.line };
    return;
  }
  if (r.kind === "event") {
    const at = get("at"); if (!at && !get("when")) book.errors.push({ file: r.file, line: r.line, msg: `event ${r.id} has neither "at" nor "when"` });
    book.events.push({ id: r.id, at: at ? toMin(at) : -Infinity, when: safeCompile(book, r, get("when")), steps: compileSteps(book, r, r.kv.filter((x) => x.key !== "at" && x.key !== "when")), file: r.file, line: r.line });
    return;
  }
  if (r.kind === "node") {
    if (dup(book, r, book.nodes)) return;
    const steps = compileSteps(book, r, r.kv);
    const meta = Object.fromEntries(steps.filter((s) => s.kind === "hub" || s.kind === "speaker" || s.kind === "title").map((s) => [s.kind, s.value]));
    book.nodes[r.id] = { id: r.id, steps, hub: meta.hub === "yes" || meta.hub === "true", speaker: meta.speaker || "", title: meta.title || "", file: r.file, line: r.line };
    return;
  }
  const table = (book.records[r.kind] ||= {});
  if (!dup(book, r, table)) table[r.id] = r;
}

function compileSteps(book, r, kv) {
  const steps = [];
  let choice = 0;
  for (const { key, value, line } of kv) {
    try {
      const s = parseStep(key, value, { file: r.file, line, node: r.id });
      if (s.kind === "opt" || s.kind === "claim" || s.kind === "check") s.key = s.attrs.id ? String(s.attrs.id) : `${r.id}#${choice++}`;
      if (s.kind === "voice" || s.kind === "passive" || s.once) s.key = `${r.id}@${line}`;
      if (s.kind === "unknown") book.errors.push({ file: r.file, line, msg: `unknown key "${s.key}" in ${r.kind} ${r.id}`, level: "warn" });
      steps.push(s);
    } catch (e) { book.errors.push({ file: r.file, line, msg: e.message }); }
  }
  return steps;
}

// An act from its root file: reads the root, then every include: line (relative to the root),
// in order. read(path) returns the text (sync or async). Missing files are errors in the book.
export async function loadAct(rootPath, read) {
  const dir = rootPath.replace(/[^/\\]*$/, ""), root = await read(rootPath), sources = [{ file: rootPath, text: root }], errors = [];
  for (const inc of parseRecords(root, rootPath).recs.filter((r) => r.kind === "meta").flatMap((r) => r.kv.filter((x) => x.key === "include").map((x) => ({ path: x.value.trim(), line: x.line })))) {
    try { sources.push({ file: dir + inc.path, text: await read(dir + inc.path) }); }
    catch (e) { errors.push({ file: rootPath, line: inc.line, msg: `include ${inc.path}: ${e.message}` }); }
  }
  return { sources, errors };
}

export const isDialogueKind = (k) => DIALOGUE_KINDS.has(k);

function safeCompile(book, r, src) {
  try { return compile(src); } catch (e) { book.errors.push({ file: r.file, line: r.line, msg: `${r.kind} ${r.id}: ${e.message}` }); return null; }
}
