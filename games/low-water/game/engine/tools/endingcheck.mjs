#!/usr/bin/env node
// The ending check (design/eras/era5.md sections 3, 4 and 8; ledger row S19). Era 5 ends in the ten households'
// ends (e5.s15) and the table in the shop window (e5.s16, the witness e5.w.table), then e5.end (q.end). Over the
// harness's runs (every build and route of tools/quota/policy.mjs, which include one route per class and movement):
//   - Reached: every finished run plays the ending through, in order: each household's end, the shop, the table's
//     first and last beats, and e5.end, with Danil's fate fallen
//   - Every ending: each ending node (e5.ends, e5.end.*, e5.shop, e5.w.*) is reached on at least one run
//   - Every movement: each class reaches e5.end on each movement (union, league, alliance, well, none)
//   - Shows what it must: a variant is entered only with the state and fates it stands for (ENDS), and the lines
//     that change with the state say the right thing (SAYS)
//   - No count: no line shown in the ending totals the run (lives lost, a score, a tally, a run number)
//   - The last image is the table: the last line shown is in the table's last beat
// Controls (run every time): a planted "Lives lost" caption, a variant entered against its state, and a run that
// stops before the table must each fail the check; a control that passes fails the tool.
// The run records come from tools/quota/story.mjs watch(): R.e5end (node, class, flags, e5 fates as each ending node
// is entered) and R.e5lines (the lines shown there).
//   LW_STORY=quota node tools/endingcheck.mjs [--seeds 1,2] [--runs a.json,b.json]      (run from game/engine)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

export const ENDING = /^e5\.(ends?$|end\.|shop$|w\.)/;
// the movement a run took (e5.move): the flag each door sets; "well" asks at the Well House and goes home (mv_none too)
export const MOVEMENTS = { union: "e5.mv_union", league: "e5.mv_league", alliance: "e5.mv_alliance", well: "e5.mv_well_asked", none: "e5.mv_none" };
export const movementOf = (flags) => (flags.includes("e5.mv_well_asked") ? "well" : Object.keys(MOVEMENTS).find((m) => m !== "well" && flags.includes(MOVEMENTS[m])) || null);
// the ending's order on every run (one node of each household, then the table)
export const ORDER = ["e5.ends", "e5.end.furrowe", "e5.end.ashby", "e5.end.lind", "e5.end.brack", "e5.end.orme", "e5.end.haldane", "e5.end.ryan", "e5.end.krall", "e5.end.tesk", "e5.end.saro", "e5.shop", "e5.w.table.open", "e5.w.table.sale", "e5.end"];

// What each variant stands for: s.has(flag), s.fell(fate), s.cls. A variant entered when its test is false shows a
// state or fate the run does not hold.
const pageFell = (s) => s.fell("f.e5_page_tom") || s.fell("f.e5_page_leon");
export const ENDS = {
  "e5.end.mott.burn": [(s) => s.has("e5.page_torn") && s.fell("f.e5_frank"), "the page torn out (f.e5_frank fell): Frank burns the ledger"],
  "e5.end.mott.give": [(s) => !s.has("e5.page_torn") && !s.fell("f.e5_frank"), "the page left in: Frank gives the ledger back"],
  "e5.end.furrowe.tom": [(s) => s.cls === "inspector", "Tom's own end is the Inspector line's"],
  "e5.end.furrowe.keep": [(s) => (s.cls === "inspector" ? s.has("said.e5_tom_keep") : !s.has("e5.house_down")), "Tom keeps his post: his own choice, or no Brack stood down at the door"],
  "e5.end.furrowe.resign": [(s) => (s.cls === "inspector" ? s.has("said.e5_tom_resign") : s.has("e5.house_down")), "Tom resigns: his own choice, or the door stood down"],
  "e5.end.ashby.post": [(s) => s.has("e5.mara_true"), "Mara said where he lies (chain H): Ellie posts the cut"],
  "e5.end.ashby.hold": [(s) => !s.has("e5.mara_true"), "Mara did not have it: Ellie holds the Saro girl's video"],
  "e5.end.lind.name": [(s) => s.has("e5.cert_true") && !s.fell("f.e5_cert"), "the true cause on the certificate: Sam names it at the inquest"],
  "e5.end.lind.leave": [(s) => s.has("e5.cert_false") && s.fell("f.e5_cert"), "the surgeon's words on the certificate (f.e5_cert fell): Sam leaves"],
  "e5.end.brack.leon": [(s) => s.cls === "militia", "Leon's own end is the Militia line's"],
  "e5.end.brack.suspend": [(s) => s.has("e5.cert_true") || (s.cls === "militia" && s.has("said.e5_leon_true")), "the certificate true, or Leon's true statement: suspended"],
  "e5.end.brack.move": [(s) => !s.has("e5.cert_true") && !(s.cls === "militia" && s.has("said.e5_leon_true")), "nothing found against him: moved to the estate"],
  "e5.end.haldane.stay": [(s) => s.has("e5.house_down") && !s.fell("f.e5_house"), "the door stood down: Mara and Joss stay on the far bank"],
  "e5.end.haldane.go": [(s) => s.has("e5.house_cleared") && s.fell("f.e5_house"), "the flat cleared (f.e5_house fell): Arlen"],
  "e5.end.tesk.open": [(s) => s.has("e5.page_given") && !pageFell(s), "Dorrah's page given to Sefa: the Well House door opens"],
  "e5.end.tesk.shut": [(s) => (s.has("e5.page_lost") || s.has("e5.page_kept")) && pageFell(s), "the page lost or kept (its fate fell): the door stays shut"],
  "e5.w.table.thread": [(s) => s.has("e4.carry_h1"), "the thread round the leg only where the world record holds it (chain H in era 4)"],
  "e5.w.table.spoons": [(s) => s.has("e5.house_cleared"), "Ilo's spoons in the window only from a cleared flat"],
};
// The lines that change with the state: [node, pattern, test]; the node must show a line matching pattern iff test holds
export const SAYS = [
  ["e5.end.saro", /We're staying/, (s) => s.has("e5.cert_true"), "Teo stays when the paper says what happened"],
  ["e5.end.orme", /Orme's Mill Junction/, (s) => s.has("e5.mara_true") || s.has("e5.page_kept"), "the mill's name on the junction when the old story is public"],
  ["e5.end.krall", /I'll go again/, (s) => s.has("e5.page_kept") || s.has("e5.cert_false"), "Dennis stands again when the League is winning"],
];
// a count on screen: a tally of the run, never a person's age, a time, or a bus
export const COUNT = /\b(lives? (lost|saved)|(people|dead|lives|souls|households?) (lost|saved|counted)|you (saved|lost|kept) \d+|\d+ (of|out of) \d+ (saved|lost|lived|died)|death toll|total (dead|lost|saved)|tally|score|run (number|no\.?|#\s*\d+))\b/i;

const state = (e) => ({ cls: e.cls, has: (f) => e.flags.includes(f), fell: (f) => e.fates.includes(f) });

// check the finished runs; returns { lines, errors }
export function checkEndings(runs, nodes) {
  const lines = [], err = (m) => { errors++; lines.push(`error: ${m}`); }; let errors = 0;
  const reached = new Set(), moves = {};
  for (const r of runs) {
    if (!r.finished) continue;
    const E = r.e5end || [], seen = E.map((e) => e.node), last = E[E.length - 1];
    for (const n of seen) reached.add(n);
    // Reached, in order
    let at = -1;
    for (const n of ORDER) { const i = seen.indexOf(n, at + 1); if (i < 0) { err(`${r.build}: the ending does not reach ${n} (after ${at >= 0 ? seen[at] : "the start"}) (Reached)`); break; } at = i; }
    if (last && !last.fates.includes("f.e5_danil")) err(`${r.build}: e5.end without Danil's fate (f.e5_danil) fallen (Reached)`);
    // Shows what it must
    for (const e of E) { const S = ENDS[e.node]; if (S && !S[0](state(e))) err(`${r.build}: ${e.node} shown, and the run does not hold what it stands for: ${S[1]} (Shows)`); }
    const shown = r.e5lines || [];
    for (const [node, pat, test, why] of SAYS) {
      const e = E.find((x) => x.node === node); if (!e) continue;
      const says = shown.some((l) => l.node === node && pat.test(l.text)), want = test(state(e));
      if (says !== want) err(`${r.build}: ${node} ${says ? "says" : "does not say"} ${pat.source}; ${why} (Shows)`);
    }
    // No count, and the last image is the table
    for (const l of shown) if (COUNT.test(l.text)) err(`${r.build}: ${l.node} shows a count: "${l.text.slice(0, 80)}" (No count)`);
    if (shown.length && shown[shown.length - 1].node !== "e5.w.table.sale") err(`${r.build}: the last line shown is in ${shown[shown.length - 1].node}, not the table's last beat (The last image)`);
    // Every movement
    const ended = last && last.node === "e5.end", mv = ended ? movementOf(last.flags) : null;
    if (mv) ((moves[last.cls] ||= {})[mv] ||= []).push(r.build);
  }
  for (const n of nodes) if (!reached.has(n)) err(`${n}: no run reaches it (Every ending)`);
  for (const cls of ["inspector", "militia"]) for (const m of Object.keys(MOVEMENTS)) {
    const by = (moves[cls] || {})[m];
    if (!by) err(`${cls} on ${m}: no run reaches e5.end (Every movement)`); else lines.push(`ok   ${cls} on ${m}: e5.end on ${by.length} run(s) (${by.slice(0, 3).join(", ")})`);
  }
  lines.push(`${nodes.length} ending nodes, ${[...nodes].filter((n) => reached.has(n)).length} reached; ${runs.filter((r) => r.finished).length} finished runs; ${errors} error(s)`);
  return { lines, errors };
}

// The controls: each planted fault must fail the check on a copy of one good run
export function controls(runs, nodes) {
  const good = runs.find((r) => r.finished && (r.e5end || []).some((e) => e.node === "e5.end"));
  if (!good) return [{ name: "controls", caught: false, why: "no finished run reaches e5.end to plant on" }];
  // a fault is caught when the planted copy has more errors than the good run alone (the coverage rules, which one
  // run cannot meet, count the same on both)
  const copy = () => JSON.parse(JSON.stringify(good)), only = (r) => checkEndings([r], nodes).errors, base = only(good);
  const caption = copy(); caption.e5lines.push({ node: "e5.w.table.sale", kind: "nar", who: "", text: "Lives lost: 3. Households saved: 7 of 10." });
  const wrong = copy(), h = wrong.e5end.find((e) => /^e5\.end\.haldane\.(go|stay)$/.test(e.node)); if (h) h.node = h.node.endsWith("go") ? "e5.end.haldane.stay" : "e5.end.haldane.go";
  const short = copy(); short.e5end = short.e5end.filter((e) => !e.node.startsWith("e5.w.") && e.node !== "e5.end");
  return [["a planted \"Lives lost\" caption", caption], ["the Haldane end swapped against the door's outcome", wrong], ["a run that stops before the table", short]]
    .map(([name, r]) => ({ name, caught: only(r) > base }));
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/endingcheck.mjs");
if (isMain) {
  const { STORY } = await import("./use-story.mjs"), { BUILDS, ROUTES } = await import("./use-policy.mjs");
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent } = await import("../full.mjs");
  if (!STORY.acts || STORY.name !== "quota") { console.log("endingcheck: era 5's ending is the Quota's (LW_STORY=quota)"); process.exit(0); }
  const argv = process.argv.slice(2), arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const C = loadContent((await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources);
  const nodes = Object.keys(C.book.nodes).filter((n) => ENDING.test(n)).sort();
  const out = new URL("../out/endingcheck/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"); mkdirSync(out, { recursive: true });
  const all = [...Object.keys(BUILDS), ...Object.keys(ROUTES)].join(","), runs = arg("--runs") ? arg("--runs").split(",").flatMap((f) => JSON.parse(readFileSync(f, "utf8"))) : [];
  if (!runs.length) for (const s of (arg("--seeds") || "1").split(",")) {
    const f = `${out}runs-${s}.json`, r = spawnSync(process.execPath, ["tools/playthrough.mjs", "--build", all, "--seed", s, "--json", f], { stdio: ["ignore", "ignore", "inherit"], env: process.env });
    if (r.status !== 0) { console.error(`endingcheck: playthrough seed ${s} failed (${r.status})`); process.exit(2); }
    runs.push(...JSON.parse(readFileSync(f, "utf8")));
  }
  const res = checkEndings(runs, nodes), ctl = controls(runs, nodes);
  console.log(res.lines.join("\n"));
  for (const c of ctl) console.log(`control ${c.caught ? "caught" : "MISSED"}: ${c.name}${c.why ? ` (${c.why})` : ""}`);
  process.exit(res.errors || ctl.some((c) => !c.caught) ? 1 : 0);
}
