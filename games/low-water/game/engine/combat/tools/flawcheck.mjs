// The inner arena's static check (design/spine-plan/08-ARENA.md section 6, extended by inferno/06-SYSTEMS.md
// section 6; bounds S1 to S6, V1, F2 and B2 in combat/PROGRESS.md 29). Over every flaw and the Adversary:
//   - its self-lie is a @selflie in content/quota, or a pending NEW LINE with its text
//   - it can be ended without force: refuse, endure, yield or name; or it is meant to be lost and can be lost (S1)
//   - a door only where it can be refused, and one where it can (V1)
//   - no outcome, beat or boon writes a fate field or a witness beat (S2); a non-force ending carries no number (S3)
//   - every dc shift on a force ending falls (S4); a meant-to-lose boss has a floor (S5)
//   - faces are its liar's line only: no Hesh person, child or world perpetrator (S6)
//   - a boon's cost names a @char, a scene file that exists and a beat (B2)
//   - every special that strikes winds up 18 frames or more and shows its tell for 60% of that (F2)
//   - every line is marked PROPOSAL; the anchor is in the arena; its hinge's scene exists
// Planted controls must each fail, or the check is reported broken.
//   node combat/tools/flawcheck.mjs [--json]
import { FLAWS, HOST } from "../data/flaws.mjs";
import { VERBS, FATE_FIELDS, NUMBER_FIELDS, LINES, NEVER_FACES } from "../data/flaws-common.mjs";
import { INNER_ARENAS } from "../data/arenas-inner.mjs";

const NONFORCE = ["refuse", "endure", "yield", "name"];
const FATE_CALL = new RegExp(`\\b(${FATE_FIELDS.join("|")})\\s*\\(`);

// every key and string under a value, with its path
function* walk(v, path = []) {
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { yield [k, x, [...path, k]]; yield* walk(x, [...path, k]); }
}

export function checkFlaw(f, ctx) {
  const errs = [], err = (m) => errs.push(`${f.id}: ${m}`), arena = INNER_ARENAS[f.arena];
  // the self-lie (the Adversary is built from the run's, not one of its own)
  if (!f.adversary) {
    if (!f.selflie) err("names no self-lie");
    else if (!ctx.selflies[f.selflie] && !(f.pending && f.pending.kind === "NEW LINE" && f.pending.text)) err(`self-lie ${f.selflie} is not a @selflie in content/quota and no pending NEW LINE is given`);
  }
  const verbs = f.adversary ? Object.assign({}, ...f.movements.map((m) => m.verbs)) : f.verbs || {};
  for (const v of Object.keys(verbs)) if (!(v in VERBS)) err(`unknown verb ${v}`);
  // S1: an end without force
  if (!NONFORCE.some((v) => verbs[v]) && !((f.meantToLose || f.loseEnds) && verbs.lose)) err("has no ending but force (S1)");
  for (const v of Object.keys(f.trap || {})) if (verbs[v]) err(`verb ${v} is both offered and a trap`);
  // V1: a door only where it can be refused
  if (!f.adversary) {
    if (!arena) err(`no arena ${f.arena}`);
    else {
      if (verbs.refuse && !(arena.door || []).length) err("can be refused but its arena has no door (V1)");
      if (!verbs.refuse && (f.door || (arena.exits || []).length)) err("has a way out but no refuse verb (V1)");
      if (!(arena.anchors || {})[f.anchor && f.anchor.key]) err(`its anchor ${f.anchor && f.anchor.key} is not in the arena`);
    }
  }
  // S2: no fate written anywhere in what it records
  for (const [k, x, p] of walk({ verbs, force: f.force, boon: f.boon })) {
    if (FATE_FIELDS.includes(k)) err(`${p.join(".")} writes a fate field (S2)`);
    if (typeof x === "string" && /^(do|effect|set)$/.test(p[p.length - 1]) && FATE_CALL.test(x)) err(`${p.join(".")} writes a fate (S2)`);
  }
  // S3: a non-force ending carries no number
  for (const [v, rec] of Object.entries(verbs)) for (const [k, , p] of walk(rec)) if (NUMBER_FIELDS.includes(k)) err(`verb ${v}: ${p.join(".")} is a number on a non-force ending (S3)`);
  // S4: force hardens the lie: its dc falls
  for (const [voice, n] of Object.entries((f.force || {}).dc || {})) if (!(n < 0)) err(`force raises or keeps ${voice} dc (${n}): force must harden the lie (S4)`);
  // S5: meant to lose means a floor
  if (f.meantToLose && !(f.floor > 0)) err("is meant to be lost but has no floor (S5)");
  // S6: faces
  const line = f.line === "both" ? [...LINES.furrowe, ...LINES.brack] : LINES[f.line] || [];
  if (!f.line || (!line.length && f.line !== "both")) err(`no line ${f.line}`);
  for (const face of f.faces || []) {
    for (const [why, ids] of Object.entries(NEVER_FACES)) if (ids.includes(face)) err(`face ${face} is ${why === "hesh" ? "a Hesh person" : why === "child" ? "a child" : "a world perpetrator"} (S6)`);
    if (!line.includes(face)) err(`face ${face} is not of the ${f.line} line (S6)`);
  }
  // B2: a boon's cost
  if (f.boon) {
    const c = f.boon.cost;
    if (!c) err(`boon ${f.boon.id} has no cost (B2)`);
    else {
      if (!ctx.chars.has(c.who)) err(`boon ${f.boon.id}: its cost's who (${c.who}) is not a @char in content/quota (B2)`);
      if (!ctx.scenes.has(c.scene)) err(`boon ${f.boon.id}: its cost's scene ${c.scene} is not a content file (B2)`);
      if (!c.beat || c.beat.length < 20) err(`boon ${f.boon.id}: its cost has no written beat (B2)`);
    }
  }
  // F2: telegraphs
  for (const [id, m] of Object.entries(f.specials || {})) {
    if (!(m.hits || []).length) continue;
    if (!(m.startup >= 18)) err(`move ${id} winds up ${m.startup} frames, under 18 (F2)`);
    if (!m.tell || m.tell.at[1] - m.tell.at[0] < 0.6 * m.startup) err(`move ${id} shows its tell for under 60% of its wind-up (F2)`);
  }
  // PROPOSAL lines, beats with scenes
  const lines = f.adversary ? f.movements.flatMap((m) => m.lines || []) : f.lines || [];
  for (const l of lines) if (!l.proposal || !l.text || !l.voice) err(`a line is not marked PROPOSAL or lacks voice or text: ${JSON.stringify(l).slice(0, 80)}`);
  for (const [k, x] of walk({ verbs, force: f.force })) if (k === "beat" && x && !ctx.scenes.has(x.scene)) err(`a beat's scene ${x.scene} is not a content file`);
  if (f.hinge && f.hinge.after && !ctx.scenes.has(f.hinge.after)) err(`its hinge's scene ${f.hinge.after} is not a content file`);
  return errs;
}

export const checkAll = (ctx, flaws = { ...FLAWS, host: HOST }) => Object.values(flaws).flatMap((f) => checkFlaw(f, ctx));

// Planted controls: each must produce at least one error carrying its bound
const clone = (x) => JSON.parse(JSON.stringify(x));
export const CONTROLS = [
  ["a Hesh face (S6)", () => ({ ...clone(FLAWS.prudence), faces: ["ned", "tomas"] }), /S6/],
  ["force as the only end (S1)", () => ({ ...clone(FLAWS.prudence), verbs: { lose: FLAWS.prudence.verbs.lose } }), /S1/],
  ["a force ending that raises a dc (S4)", () => ({ ...clone(FLAWS.forty), force: { ...FLAWS.forty.force, dc: { ballast: 1 } } }), /S4/],
  ["a dc on a yield (S3)", () => ({ ...clone(FLAWS.withme), verbs: { ...clone(FLAWS.withme.verbs), yield: { ...clone(FLAWS.withme.verbs.yield), dc: { grip: 1 } } } }), /S3/],
  ["an outcome that writes bowls(haldane) (S2)", () => ({ ...clone(FLAWS.nearest), verbs: { ...clone(FLAWS.nearest.verbs), yield: { ...clone(FLAWS.nearest.verbs.yield), do: "bowls(haldane) -1" } } }), /S2/],
  ["a boon with no cost (B2)", () => ({ ...clone(FLAWS.only), boon: { ...clone(FLAWS.only.boon), cost: null } }), /B2/],
  ["a boon's cost on a family, not a person (B2)", () => ({ ...clone(FLAWS.only), boon: { ...clone(FLAWS.only.boon), cost: { ...FLAWS.only.boon.cost, who: "a family" } } }), /B2/],
  ["meant to lose with no floor (S5)", () => ({ ...clone(FLAWS.friday), meantToLose: true, floor: 0 }), /S5/],
  ["a way out with no refuse verb (V1)", () => ({ ...clone(FLAWS.prudence), door: true }), /V1/],
  ["a 12-frame wind-up (F2)", () => ({ ...clone(FLAWS.prudence), specials: { ...FLAWS.prudence.specials, "prudence.hammer": { ...FLAWS.prudence.specials["prudence.hammer"], startup: 12, tell: { at: [2, 11], kind: "slam" } } } }), /F2/],
];

export function runControls(ctx) {
  return CONTROLS.map(([name, make, want]) => { const errs = checkFlaw(make(), ctx); return { name, failed: errs.some((e) => want.test(e)), errs }; });
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("flawcheck.mjs")) {
  const { loadContent } = await import("./innerctx.mjs");
  const ctx = loadContent(), errs = checkAll(ctx), controls = runControls(ctx);
  const n = Object.keys(FLAWS).length + 1;
  if (process.argv.includes("--json")) console.log(JSON.stringify({ errs, controls: controls.map(({ name, failed }) => ({ name, failed })) }, null, 1));
  else {
    console.log(`flawcheck: ${n} records (${Object.keys(FLAWS).join(", ")}, host): ${errs.length} errors`);
    for (const e of errs) console.log(`  ERROR ${e}`);
    for (const c of controls) console.log(`  control ${c.failed ? "fails, as it must" : "PASSES: the check is broken"}: ${c.name}`);
  }
  if (errs.length || controls.some((c) => !c.failed)) process.exit(1);
}
