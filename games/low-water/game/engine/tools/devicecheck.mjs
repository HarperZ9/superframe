#!/usr/bin/env node
// The device check (the author, 2026-10-23: "All aspects that rely upon writing notes, and unintuitive game mechanics
// and poor story telling mechanics and devices should be replaced with ideas that are more practical and
// weighted/impactful in a physical, mental, emotional, or sensory sense"; and "Bookkeeping should not be a part of
// the plot"). design/DEVICE-AUDIT.md is the audit; this is its gate. It reads what the player is shown (narration,
// options, inner voices, prop and echo text, verb labels, the menu and the HUD) and fails on a device that works by
// writing, reading or bookkeeping:
//   hand        a line drawn in a writer's hand ({hand: x}): a document put on screen
//   inscription narration, prop or echo text quoting written words (three capitalised words or more in a run)
//   figure      a numeral in narration, an option, an inner voice, a prop, an echo or a verb label
//   docverb     an option or verb that asks the player to read, write, sign, paste, compare or count
//   docprop     a prop that is a document (a ledger, a log, a slip, a notice, a list ...)
//   sense       a prop with no carries: (what the thing carries to the body)
//   journal     a fact that writes itself into the journal (unless @meta journal: off), a journal(...) effect, or a
//               menu with the Journal page
//   counter     a HUD or meta setting that shows a count (numbers or meters on)
//   unfelt      a fate or a world fact that no @echo shows in the world
//   cue         a cue fired ({sense: x}, sense(x), sense: on an echo, a load or a scale) that no @sense defines
// Spoken lines (line:) are a person talking, so they are not read for figures or inscriptions: a character may say
// a number, or read something aloud in a scene. --inventory lists every finding and the per-node density of
// document words for the audit. Controls: tests/devicecheck.test.mjs plants one of each and sees it caught.
//   LW_STORY=quota node tools/devicecheck.mjs [--inventory] [--only e1_,q_] [--json file] [root.lwd]     (run from game/engine)
import { readFile, writeFile } from "node:fs/promises";
import { SENSES as SENSE_KINDS } from "../world/props.mjs";

export const DOC_WORDS = ["ledger", "log", "logbook", "slip", "slips", "notice", "notices", "handbill", "letter", "letters", "form", "forms", "register",
  "list", "page", "pages", "book", "notebook", "blotter", "certificate", "report", "return", "returns", "tally", "sheet", "card", "label", "circular",
  "poster", "file", "record", "minutes", "receipt", "figure", "figures", "signature", "stamp", "stamped", "column", "columns", "margin", "pencil",
  "ink", "pen", "written", "writes", "wrote", "signs", "signed", "reads", "quota", "statement", "pass", "passes", "census", "map"];
export const DOC_PROP = /\b(ledger|log|logbook|slips?|notices?|handbills?|letters?|forms?|register|list|pages?|notebook|blotter|certificate|report|returns?|tally|sheet|card|label|circular|poster|file|record|receipt|statement|minutes|book)\b/i;
const DOC_VERB = /^"?\s*(read|write|sign|paste|compare|check the|count|tally|copy|note|look up|pencil|rub out|stamp|file)\b/i;
const INSCRIPTION = /\b[A-Z][A-Z'.,-]*(?:\s+[A-Z0-9][A-Z0-9'.,-]*){2,}/;
const FIGURE = /\d/;
const RULES = ["hand", "inscription", "figure", "docverb", "docprop", "sense", "journal", "counter", "unfelt", "cue"];

const strip = (t) => String(t || "").replace(/\{\{[^}]*\}\}/g, "").replace(/\{[^}]*\}\s*$/, "");
// three capitals in a run, not a speaker's name in caps nor a single shout: words of three letters or more, at least one of four
const inscribed = (t) => { const m = INSCRIPTION.exec(strip(t)); return m && m[0].split(/\s+/).filter((w) => w.replace(/[^A-Z]/g, "").length >= 3).length >= 3 && /[A-Z]{4,}/.test(m[0]) ? m[0] : null; };

export function checkDevices(C, { text = "" } = {}) {
  const out = [], N = C.book.nodes, S = C.story || {}, meta = C.book.meta || {};
  const add = (rule, at, msg, extra = {}) => out.push({ rule, file: at.file || "", line: at.line || 0, msg, ...extra });
  const shown = []; // { where, kind, text, at }
  for (const n of Object.values(N)) for (const s of n.steps) {
    const at = { file: n.file, line: s.line || n.line };
    if (s.kind === "nar") shown.push({ kind: "nar", node: n.id, text: s.value, attrs: s.attrs, at });
    if (s.kind === "line" || s.kind === "inst") shown.push({ kind: "line", node: n.id, text: s.text, attrs: s.attrs, at });
    if (s.kind === "voice") shown.push({ kind: "voice", node: n.id, text: s.text, attrs: s.attrs, at });
    if (s.kind === "opt" || s.kind === "check" || s.kind === "claim") shown.push({ kind: "opt", node: n.id, text: s.label, attrs: s.attrs, at });
  }
  for (const p of Object.values(S.props || {})) {
    for (const st of p.states) shown.push({ kind: "prop", node: p.id, text: st.text, attrs: {}, at: { file: p.file, line: st.line } });
    for (const t of p.touches || []) { shown.push({ kind: "prop", node: p.id, text: t.text, attrs: {}, at: { file: p.file, line: t.line } }); shown.push({ kind: "opt", node: p.id, text: t.label, attrs: {}, at: { file: p.file, line: t.line } }); }
    if (p.label) shown.push({ kind: "opt", node: p.id, text: p.label, attrs: {}, at: p });
    if (DOC_PROP.test(p.name)) add("docprop", p, `prop ${p.id} is a document ("${p.name}"): make it a thing the hands and the senses meet, or cut it`);
    if (!p.sense) add("sense", p, `prop ${p.id} has no carries: (sight touch weight sound smell heat)`);
  }
  for (const e of Object.values(S.echoes || {})) if (e.sense) shown.push({ kind: "echo", node: e.id, text: e.sense, attrs: {}, at: e });
  for (const o of Object.values(C.objects || {})) if (!o.prop) for (const v of o.verbs) if (v.label) shown.push({ kind: "opt", node: o.id, text: v.label, attrs: {}, at: { file: o.file, line: v.line } });

  for (const x of shown) {
    const t = x.text || "";
    if (x.attrs && x.attrs.hand) add("hand", x.at, `${x.node}: a line in ${x.attrs.hand}'s hand puts a document on screen`, { text: t });
    if (x.kind !== "line" && x.kind !== "opt") { const w = inscribed(t); if (w) add("inscription", x.at, `${x.node}: written words shown to be read: "${w}"`, { text: t }); }
    if (x.kind !== "line" && FIGURE.test(strip(t))) add("figure", x.at, `${x.node}: a numeral in ${x.kind} text`, { text: t });
    if (x.kind === "opt" && DOC_VERB.test(t)) add("docverb", x.at, `${x.node}: the option asks the player to do paperwork: "${t}"`, { text: t });
  }
  // the journal: facts that write themselves, journal() effects, the Journal page in the menu
  const journalOn = String(meta.journal || "on") !== "off";
  for (const f of Object.values(C.book.facts || {})) if (journalOn && f.about && f.journal) add("journal", f, `fact ${f.id} writes "${f.about}" into the journal (give it journal: no, or cut its about:)`);
  for (const m of text.matchAll(/journal\("/g)) add("journal", { file: "", line: 0 }, `a journal("...") effect writes a note for the player to read`);
  if (/\bnotes\b/.test(String(meta.menu || ""))) add("journal", { file: "", line: 0 }, `@meta menu: shows the Journal page (notes)`);
  // counters
  if (String(meta.numbers || "") === "on") add("counter", { file: "", line: 0 }, "@meta numbers: on shows counts");
  if (meta.meters && String(meta.meters) !== "off") add("counter", { file: "", line: 0 }, `@meta meters: ${meta.meters} shows meters`);
  if (/\{day\}/.test(String(meta["hud-day"] || "")) && /\bday\b/.test(String(meta.hud || ""))) add("counter", { file: "", line: 0 }, "the HUD counts the days");
  // fates and world facts that the world never shows
  const told = new Set(Object.values(S.echoes || {}).flatMap((e) => e.tells.map((t) => `${t.kind === "worldfact" ? "fact" : t.kind}:${t.id}`)));
  for (const f of Object.values((C.community && C.community.fates) || {})) if (!told.has(`fate:${f.id}`)) add("unfelt", f, `fate ${f.id} (${f.who || ""}) is shown by no @echo: what happens to a person must change a place or a person the player meets`);
  for (const w of Object.values(S.worldfacts || {})) if (!told.has(`fact:${w.id}`)) add("unfelt", w, `world fact ${w.id} is shown by no @echo: what an earlier run left must be met in the world`);
  // cues named and not defined
  const cues = S.cues || {}, named = new Set();
  for (const m of text.matchAll(/\{[^}]*\bsense:\s*([\w.-]+)/g)) named.add(m[1]);
  for (const m of text.matchAll(/\bsense\(([\w.-]+)\)/g)) named.add(m[1]);
  for (const m of text.matchAll(/^sense:\s*([\w.-]+)/gm)) if (!SENSE_KINDS.includes(m[1])) named.add(m[1]);
  for (const id of named) if (!cues[id]) add("cue", { file: "", line: 0 }, `${id} is fired but no @sense defines it`);
  return out;
}

// the audit's density: document words per node in what the player is shown (spoken lines included)
export function docDensity(C) {
  const rows = [], re = new RegExp(`\\b(${DOC_WORDS.join("|")})\\b`, "gi");
  for (const n of Object.values(C.book.nodes)) {
    let words = 0, hits = []; for (const s of n.steps) { const t = s.value || s.text || s.label || ""; if (typeof t !== "string") continue; words += t.split(/\s+/).length; for (const m of t.matchAll(re)) hits.push(m[1].toLowerCase()); }
    if (hits.length) rows.push({ node: n.id, file: n.file, line: n.line, hits: hits.length, words, kinds: [...new Set(hits)] });
  }
  return rows.sort((a, b) => b.hits - a.hits);
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/devicecheck.mjs");
if (isMain) {
  const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent } = await import("../full.mjs");
  let root = argv.find((a) => a.endsWith(".lwd"));
  if (!root) { const { STORY } = await import("./use-story.mjs"); if (!STORY.acts) { console.log("devicecheck: this story names no act root (LW_STORY=quota)"); process.exit(0); } root = STORY.acts[0]; }
  const sources = (await loadAct(root, (p) => readFile(p, "utf8"))).sources, C = loadContent(sources), text = sources.map((s) => s.text).join("\n");
  const only = arg("--only") ? arg("--only").split(",") : null; // --only e1_,w_lore: findings in those files (and the story-wide rules)
  const res = checkDevices(C, { text }).filter((x) => !only || !x.file || only.some((o) => x.file.split(String.fromCharCode(92)).join("/").includes(o)));
  const by = Object.fromEntries(RULES.map((r) => [r, res.filter((x) => x.rule === r).length]));
  if (argv.includes("--inventory")) { for (const x of res) console.log(`${x.file}:${x.line}: ${x.rule}: ${x.msg}`); console.log("\ndocument words by node (most first):"); for (const r of docDensity(C).slice(0, 80)) console.log(`${r.file}:${r.line}: ${r.node}: ${r.hits} in ${r.words} words (${r.kinds.join(", ")})`); }
  else for (const x of res.slice(0, 200)) console.log(`${x.file}:${x.line}: error: ${x.rule}: ${x.msg}`);
  if (arg("--json")) await writeFile(arg("--json"), JSON.stringify({ by, findings: res, density: docDensity(C) }, null, 1));
  console.log(`devicecheck: ${res.length} finding(s): ${RULES.map((r) => `${r} ${by[r]}`).join(", ")}`);
  process.exit(res.length ? 1 : 0);
}
