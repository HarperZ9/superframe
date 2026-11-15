#!/usr/bin/env node
// The fate check (world/community.mjs @fate; design/spine-plan/03-FATES.md section 6). A person's fate is decided
// by a named person in a written scene; the model only presses. It refuses any rule that sets a person's fate.
// The lint (lintFates, no play):
//   - No fate by threshold: a household rule that writes bowls, taken, members or end (the loader refuses it, and
//     this reports the refusal)
//   - A decider speaks: each @fate's scene has a line by its decider, in the scene node or a node it opens into
//   - Two ways: each @fate's scene has an outcome where the fate falls (a fate(<id>) call) and one where it does
//     not, and something the player did or chooses decides between them (an option, or an alt on a condition)
//   - Every fate() call names a @fate, and is made in one of that fate's scenes or the nodes they open into
// The play (checkFateRuns): for each finished run,
//   - Played: a pressure that held had one of its scenes played
//   - Cause: every change to a fate field on the run came from a fate() call made in a node, never from a rule
//     (the path of each change ends in a node), and each household's bowls are its members less its fates
//   LW_STORY=quota node tools/fatecheck.mjs [--seeds 1,2] [--lint] [--runs a.json,b.json]      (run from game/engine)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

// The canon exemptions from "Two ways": a fate with one outcome by the author's decision, each with its reason
// written here. The list is explicit and short on purpose; nothing else may join it without a decision of record.
export const EXEMPT = {
  "f.e5_danil": "canon hinge of era 5: Danil Saro dies under Leon Brack's knee; the player's agency is in what follows (the certificate, the pages, the door), not in the death (design/spine-plan/DECISIONS-2026-10-22.md, eras 1, 3, 4 and 5, item 4; commit e519930)",
};

const edges = (n) => (n.steps || []).flatMap((s) => (["opt", "claim", "check"].includes(s.kind) ? [{ to: s.target, effects: s.effects, choice: true }, ...(s.fail ? [{ to: s.fail, effects: s.effects, choice: true }] : [])]
  : s.kind === "alt" ? [{ to: s.target, cond: s.cond }] : ["go", "call"].includes(s.kind) ? [{ to: s.value }] : []));
const callsFate = (eff, id) => !!eff && eff.calls.has("fate") && eff.calls.get("fate").some((a) => String(a[0]) === id);
const nodeFates = (n, id) => (n.steps || []).some((s) => ["do", "if", "set"].includes(s.kind) && callsFate(s.effects, id));
// the scene of a fate: its scene nodes and the nodes they open into that share their id (q.fate.gate -> q.fate.gate.*),
// or their parent's (q.ned.cart.held -> q.ned.cart.*)
const inScene = (scene, id) => scene.some((s) => id === s || id.startsWith(`${s}.`) || id.startsWith(`${s.split(".").slice(0, -1).join(".")}.`));

export function sceneOf(f, N) {
  const nodes = new Set(), stack = [...f.scene];
  while (stack.length) { const id = stack.pop(); if (!N[id] || nodes.has(id) || !inScene(f.scene, id)) continue; nodes.add(id); for (const e of edges(N[id])) stack.push(e.to); }
  return nodes;
}

// every way out of the scene, and whether the fate fell on it
export function outcomes(f, N) {
  const out = [], seen = new Set();
  const walk = (id, fell, depth) => {
    const key = `${id}:${fell}`; if (seen.has(key) || depth > 12) return; seen.add(key);
    const n = N[id]; if (!n || !inScene(f.scene, id)) { out.push({ exit: id, fell }); return; }
    const here = fell || nodeFates(n, f.id), es = edges(n);
    if (!es.length) { out.push({ exit: id, fell: here }); return; }
    for (const e of es) walk(e.to, here || callsFate(e.effects, f.id), depth + 1);
  };
  for (const s of f.scene) walk(s, false, 0);
  return out;
}

export function lintFates(C) {
  const out = [], N = C.book.nodes, F = (C.community && C.community.fates) || {}, err = (r, msg) => out.push({ level: "error", file: r.file, line: r.line, msg });
  for (const e of C.errors.filter((x) => /^(rule|fate) /.test(x.msg))) out.push({ level: "error", ...e });
  for (const f of Object.values(F)) {
    for (const s of f.scene) if (!N[s]) err(f, `fate ${f.id}: scene ${s}: no such node`);
    const nodes = sceneOf(f, N);
    const speaks = [...nodes].some((id) => (N[id].steps || []).some((s) => s.kind === "line" && (s.who || N[id].speaker) === f.decider));
    if (!speaks) err(f, `fate ${f.id}: ${f.decider} decides it, and has no line in its scene (${f.scene.join(", ")}) (A decider speaks)`);
    const oc = outcomes(f, N);
    if (EXEMPT[f.id]) { if (!oc.some((o) => o.fell)) err(f, `fate ${f.id}: exempt from Two ways, and has no outcome where it falls`); continue; }
    if (!oc.some((o) => o.fell) || !oc.some((o) => !o.fell)) err(f, `fate ${f.id}: its scene has ${oc.some((o) => o.fell) ? "no outcome where it does not fall" : "no outcome where it falls"} (Two ways)`);
    const choice = [...nodes].some((id) => edges(N[id]).some((e) => e.choice || (e.cond && e.cond.ids.size + e.cond.calls.size > 0)));
    if (!choice) err(f, `fate ${f.id}: nothing the player did or chooses decides between its outcomes (Two ways)`);
  }
  // fate() is called only in the fate's own scene
  for (const n of Object.values(N)) for (const s of n.steps || []) for (const eff of [s.effects].filter(Boolean)) {
    if (!eff.calls.has("fate")) continue;
    for (const a of eff.calls.get("fate")) {
      const f = F[String(a[0])];
      if (!f) err({ file: n.file, line: s.line || n.line }, `node ${n.id}: fate(${a[0]}) names no @fate`);
      else if (!sceneOf(f, N).has(n.id)) err({ file: n.file, line: s.line || n.line }, `node ${n.id}: fate(${f.id}) is called outside its scene (${f.scene.join(", ")})`);
    }
  }
  return out;
}

export function checkFateRuns(C, runs) {
  const F = C.community.fates, H = C.community.households, lines = []; let errors = 0;
  const e = (m) => { errors++; lines.push(`error: ${m}`); };
  const fell = {};
  for (const r of runs) {
    if (!r.finished) continue;
    for (const id of Object.keys(r.pressure || {})) { const f = F[id]; if (f && !f.scene.some((s) => (r.visited || []).includes(s))) e(`${r.build}: the pressure ${id} held on day ${r.pressure[id]} and none of its scenes (${f.scene.join(", ")}) played (Played)`); }
    for (const l of r.fateLog || []) { const last = (l.path || [])[l.path.length - 1]; if (!last || last.rule || !last.node) e(`${r.build}: ${l.at} ${l.name} ${l.from} to ${l.to} came from ${last && last.rule ? `the rule ${last.rule}` : "nowhere"}, not a person in a scene (Cause)`); }
    for (const [hid, h] of Object.entries(H)) {
      const n = Object.values(F).filter((f) => f.subject === hid && (r.fates || {})[f.id]).length, want = h.members.length - n, got = (r.table || {})[hid];
      if (got != null && got !== want) e(`${r.build}: the ${hid} table has ${got} bowls; ${h.members.length} members less ${n} fates is ${want} (Cause)`);
    }
    for (const id of Object.keys(r.fates || {})) (fell[id] ||= new Set()).add(r.build);
  }
  for (const f of Object.values(F)) lines.push(`${fell[f.id] ? "ok  " : "warn"} ${f.id}: decided by ${f.decider}; fell on ${fell[f.id] ? fell[f.id].size : 0} run(s)`);
  lines.push(`${runs.filter((r) => r.finished).length} finished runs, ${Object.keys(F).length} fates; ${errors} error(s)`);
  return { lines, errors };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/fatecheck.mjs");
if (isMain) {
  const { STORY } = await import("./use-story.mjs"), { BUILDS, ROUTES } = await import("./use-policy.mjs");
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent } = await import("../full.mjs");
  if (!STORY.acts) { console.log("fatecheck: this story names no act root (LW_STORY=quota has fates)"); process.exit(0); }
  const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const C = loadContent((await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources);
  const lint = lintFates(C);
  for (const o of lint) console.log(`${o.file}:${o.line}: ${o.level}: ${o.msg}`);
  for (const f of Object.values(C.community.fates)) console.log(`fate ${f.id}: ${f.decider} decides, in ${f.scene.join(", ")}; outcomes: ${[...new Set(outcomes(f, C.book.nodes).map((o) => `${o.fell ? "falls" : "spared"} at ${o.exit}`))].join("; ")}`);
  for (const [id, why] of Object.entries(EXEMPT)) console.log(`exempt ${id} from Two ways: ${why}`);
  console.log(`lint: ${Object.keys(C.community.fates).length} fates, ${lint.length} problem(s)`);
  if (lint.length || argv.includes("--lint")) process.exit(lint.length ? 1 : 0);
  const out = new URL("../out/fatecheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
  const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(","), runs = arg("--runs") ? arg("--runs").split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8"))) : [];
  if (!runs.length) for (const s of (arg("--seeds") || "1,2").split(",")) {
    const f = `${out}runs-${s}.json`, r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", all, "--seed", s, "--json", f], { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) { console.error(`fatecheck: playthrough seed ${s} failed (${r.status})`); process.exit(2); }
    runs.push(...JSON.parse(readFileSync(f, "utf8")));
  }
  const res = checkFateRuns(C, runs);
  console.log(res.lines.join("\n"));
  process.exit(res.errors ? 1 : 0);
}
