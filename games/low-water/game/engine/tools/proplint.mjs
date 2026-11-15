#!/usr/bin/env node
// The prop lint (design/PITCHES.md 3c.6: "a prop record with a state per era and per community-model
// condition, placed on plate marks, with a lint that every era a scene references has a state and a mark").
// For a story's root file (and its wiring), every @prop:
//   - tells about a person (@char), a household (@household) or an era: the object rule
//   - stands in a place that exists and that some scene or area uses
//   - has a state for every era the story plays (@meta era, and @meta eras: 1 2 ...), the era's last state
//     with no condition (so the prop always shows something), state ids unique within an era
//   - stands on a mark of its place's plate (error when the plate exists and lacks the mark; a warning
//     when the place has no plate yet)
//   - has text that says more than what the thing is (at least 8 words)
//   - has conditions that evaluate, in every era, on a fresh game
//   - gives only lore fragments the story defines (world/lore.mjs), when it has a lore graph
//   node tools/proplint.mjs [root.lwd] [--wiring wiring/x.lwd]     (default: the LW_STORY story's root and wiring)
// Exit 1 on any error. lintProps(content, { plateOf }) is the same check for tests.
import { DOC_PROP } from "./devicecheck.mjs";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { evaluate } from "../core/expr.mjs";

const ENGINE = new URL("../", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), CONTENT = `${ENGINE}../../content/`;

export function lintProps(C, { plateOf = () => null } = {}) {
  const out = [], err = (p, msg) => out.push({ level: "error", file: p.file, line: p.line, msg: `prop ${p.id}: ${msg}` }), warn = (p, msg) => out.push({ level: "warn", file: p.file, line: p.line, msg: `prop ${p.id}: ${msg}` });
  for (const e of C.errors.filter((x) => /^prop /.test(x.msg))) out.push({ level: "error", ...e });
  const props = (C.story && C.story.props) || {}, book = C.book, M = C.community || { households: {} };
  const eras = [...new Set([+book.meta.era || 1, ...String(book.meta.eras || "").split(/\s+/).filter(Boolean).map(Number)])];
  const used = new Set([...scenePlaces(book), ...Object.values(C.map.areas).map((a) => a.place).filter(Boolean)]);
  const lore = (book.records || {}).lore || {};
  const senses = (C.story && C.story.cues) || {};
  for (const p of Object.values(props)) {
    // the device rule (2026-10-23, design/DEVICE-AUDIT.md): a prop is a thing the senses meet, never a document
    if (!p.carries && !p.sense) err(p, "carries: what the thing carries to the body (sight touch weight sound smell heat)");
    if (DOC_PROP.test(p.name)) err(p, `"${p.name}" is a document: make it a thing the hands and the senses meet`);
    for (const t of p.touches || []) if (t.cue && !senses[t.cue]) err(p, `touch ${t.kind}: no @sense ${t.cue}`);
    if (p.tells.kind === "person" && !(C.rs.chars || {})[p.tells.id]) err(p, `tells: no @char ${p.tells.id}`);
    if (p.tells.kind === "household" && !M.households[p.tells.id]) err(p, `tells: no @household ${p.tells.id}`);
    if (!p.place || !book.places[p.place]) err(p, `place: no @place ${p.place}`);
    else if (!used.has(p.place) && !Object.keys(p.places || {}).length) err(p, `place ${p.place}: no scene or area uses it, so nobody can examine the prop`);
    for (const [era, at] of Object.entries(p.places || {})) {   // in: <era> <place>, where it stands in a later era
      if (!book.places[at]) err(p, `in: ${era} ${at}: no @place ${at}`);
      else if (!used.has(at)) err(p, `in: ${era} ${at}: no scene or area uses it, so nobody can examine the prop in era ${era}`);
      if (!p.states.some((s) => s.era === +era)) err(p, `in: ${era} ${at}: the prop has no state for era ${era}`);
    }
    for (const era of eras) {
      if (p.from && era < p.from) continue;   // a prop that first exists in a later era (from:) needs no state before it
      const ss = p.states.filter((s) => s.era === era);
      if (!ss.length) { err(p, `no state for era ${era}`); continue; }
      if (ss[ss.length - 1].cond) err(p, `era ${era}: the last state (${ss[ss.length - 1].id}) has a condition, so the prop can show nothing`);
      const ids = ss.map((s) => s.id); for (const d of ids.filter((x, i) => ids.indexOf(x) !== i)) err(p, `era ${era}: state ${d} twice`);
    }
    for (const s of p.states) {
      if (s.text.split(/\s+/).filter(Boolean).length < 8) err(p, `state ${s.era} ${s.id}: the text says too little (under 8 words): a prop tells about someone, not only what it is`);
      for (const f of s.gives) if (Object.keys(lore).length && !lore[f]) err(p, `state ${s.era} ${s.id}: gives ${f}, which no @lore defines`);
    }
    const plate = p.place ? plateOf(C, p.place) : null;
    if (plate && plate.marks) { if (!p.mark) warn(p, `no mark: (the plate ${plate.id} has marks ${plate.marks.join(", ")})`); else if (!plate.marks.includes(p.mark)) err(p, `mark ${p.mark}: not on the plate ${plate.id} (its marks: ${plate.marks.join(", ")})`); }
    else if (p.place) warn(p, `the place ${p.place} has no plate yet, so the mark ${p.mark || "(none)"} is not checked`);
  }
  // conditions: evaluated on a fresh game in each era (a call that does not exist, or a bad name, throws)
  if (Object.keys(props).length) {
    const G = createFullGame({ content: C, seed: 1 }); const a = Object.keys(C.rs.archetypes)[0]; if (a) G.create({ archetype: a, enter: false });
    for (const era of eras) { G.state.vars.era = era; for (const p of Object.values(props)) for (const s of p.states) if (s.cond) { try { evaluate(s.cond, G.scope); } catch (e) { err(p, `state ${s.era} ${s.id}: the condition fails: ${e.message}`); } } }
  }
  return out;
}

// the places scenes are set in (a node's place: steps)
export const scenePlaces = (book) => new Set(Object.values(book.nodes).flatMap((n) => (n.steps || []).filter((s) => s.kind === "place").map((s) => s.value)));

// the plate of an area at a place, and its mark ids (content/<plate>/place.json marks.spots)
export function plateFromDisk(C, place) {
  const area = Object.values(C.map.areas).find((a) => a.place === place && a.plate); if (!area) return null;
  const f = `${CONTENT}${area.plate}/place.json`; if (!existsSync(f)) return null;
  const d = JSON.parse(readFileSync(f, "utf8")); return { id: area.plate, marks: ((d.marks || {}).spots || []).map((s) => s.id) };
}

// Coverage over played runs (tools/propcheck.mjs): every prop at a scene's place seen on a run (an error if
// not); a prop only free roam reaches, and each unreached state, are listed as warnings. The runs play every era
// in turn (eras 1 to 5 in one game since 2026-10-22), so every era's states count, from the prop's from: on, each
// at the place it stands in that era (in:). Until 2026-10-23 only @meta era's states (era 2) counted, so era 4's
// five props, seen at their places on every run, were reported never seen.
export function checkPropCoverage(C, runs) {
  const props = (C.story && C.story.props) || {}, lines = [];
  const shown = new Map(); for (const r of runs) for (const k of r.props || []) shown.set(k, (shown.get(k) || 0) + 1);
  let errors = 0, warns = 0;
  const scenes = scenePlaces(C.book);
  const at = (p, e) => (p.places && p.places[e]) || p.place;
  for (const p of Object.values(props)) {
    const states = p.states.filter((s) => !p.from || s.era >= p.from), hit = states.filter((s) => shown.has(`${p.id}:${s.id}`)), where = [...new Set(states.map((s) => at(p, s.era)))];
    if (!hit.length && !where.some((w) => scenes.has(w))) { warns++; lines.push(`warn: ${p.id} (${where.join(", ")}): free roam only (no scene is set there, and the harness does not walk free roam)`); continue; }
    if (!hit.length) { errors++; lines.push(`error: ${p.id} (${where.join(", ")}): no run looked at it`); continue; }
    // a hand on it: every touch done on some run (a touch that changes the story is a route's choice; one never done is a warning)
    const felt = new Set(runs.flatMap((r) => r.touched || []));
    for (const t of p.touches || []) if (!felt.has(`${p.id}:${t.kind}`)) { if (!t.effects) { errors++; lines.push(`error: ${p.id}: touch ${t.kind} ("${t.label}") done on no run`); } else { warns++; lines.push(`warn: ${p.id}: touch ${t.kind} ("${t.label}") changes the story and no route chose it`); } }
    for (const s of states) if (!shown.has(`${p.id}:${s.id}`)) { warns++; lines.push(`warn: ${p.id}: era ${s.era} state ${s.id}${s.when ? ` (${s.when})` : ""} at ${at(p, s.era)}${scenes.has(at(p, s.era)) ? "" : " (no scene is set there)"}: no run reached it`); }
  }
  lines.push(`${runs.length} runs, ${Object.keys(props).length} props; ${errors} never seen, ${warns} state(s) unreached`);
  return { lines, errors, warns };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/proplint.mjs");
if (isMain) {
  const { STORY } = await import("./use-story.mjs"); // the story's own root and wiring (LW_STORY), so another game reuses the lint
  const argv = process.argv.slice(2), wi = argv.indexOf("--wiring");
  const root = argv.find((a, i) => !a.startsWith("--") && i !== wi + 1) || (STORY.acts && STORY.acts[0]), wiring = wi >= 0 ? argv[wi + 1] : STORY.wiring || null;
  if (!root) { console.log("proplint: name a root .lwd, or set LW_STORY to a story with one (LW_STORY=quota)"); process.exit(0); }
  // the story's wirings (every era's areas, so each era's plates are checked for their marks), or the one named
  const wirings = wi >= 0 ? [wiring] : STORY.wirings || (wiring ? [wiring] : []);
  const sources = (await loadAct(root, (p) => readFile(p, "utf8"))).sources; for (const w of wirings) sources.push({ file: w, text: await readFile(w, "utf8") });
  const C = loadContent(sources), out = lintProps(C, { plateOf: plateFromDisk });
  for (const o of out) console.log(`${o.file}:${o.line}: ${o.level}: ${o.msg}`);
  const n = Object.keys(C.story.props).length, e = out.filter((o) => o.level === "error").length;
  console.log(`${n} props; ${e} error(s), ${out.length - e} warning(s)`);
  process.exit(e ? 1 : 0);
}
