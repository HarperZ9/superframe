#!/usr/bin/env node
// The discourse check (world/discourse.mjs, design/DISCOURSE-SYSTEM.md). The lint: every @claim's carriers exist
// (@carrier), every carrier has a rule that turns its volume into the standing of the people it targets, and
// every discourse(...) call in the content names an act and a claim (a paste also the claim pasted over).
// The play: for each claim and each act it allows, a fresh game of each class acts on the claim through the
// world's own objects (the verbs on the chalk and the crier) or the call, the model runs on for two weeks, and the result is set
// against the same two weeks with no act (the control). Both start with the carrier loud (0.4, as after the
// blamed report), and the control records an empty event at the same moment. It checks that
//   - the act is a record event with its victim and street, and the carrier's volume moved its way at once
//   - two weeks on, repeating left the targeted people's standing lower than the control somewhere it is heard,
//     and challenging, silencing and answering left it higher somewhere
//   - a challenge cost the challenger's own household (honesty costs too) and a silenced carrier came back
// The lint also refuses the paper acts (tear, paste) in story content: the device rule, design/DEVICE-AUDIT.md.
//   - what each act moved can be seen from a lens (@lens shows)
//   LW_STORY=quota node tools/discoursecheck.mjs [--lint]          (run from game/engine)
import { ACTS, OLD_ACTS } from "../world/discourse.mjs";

export function lintDiscourse(C, text = "") {
  const out = [], claims = (C.story && C.story.claims) || {}, M = C.community || { carriers: {}, rules: [] };
  const err = (r, msg) => out.push({ level: "error", file: r.file, line: r.line, msg });
  for (const e of C.errors.filter((x) => /^claim /.test(x.msg))) out.push({ level: "error", ...e });
  for (const c of Object.values(claims)) for (const k of c.carriers) if (!M.carriers[k]) err(c, `claim ${c.id}: no @carrier ${k}`);
  for (const k of Object.values(M.carriers)) {
    const shifts = M.rules.some((r) => (r.src || r.doSrc || JSON.stringify(r)).includes(`volume.${k.id}`) && JSON.stringify(r).includes(`standing.${k.target}`));
    if (!shifts) err(k, `carrier ${k.id}: no rule turns volume.${k.id} into standing.${k.target}`);
  }
  for (const m of text.matchAll(/discourse\(([^)]*)\)/g)) {
    const a = m[1].split(",").map((x) => x.trim()), where = { file: "content", line: 0 };
    if (OLD_ACTS[a[0]]) err(where, `discourse(${m[1]}): ${a[0]} is a paper act; say ${OLD_ACTS[a[0]]} (the hand or the voice)`);
    else if (!ACTS.includes(a[0])) err(where, `discourse(${m[1]}): no act ${a[0]} (one of ${ACTS.join(", ")})`);
    if (!claims[a[1]]) err(where, `discourse(${m[1]}): no claim ${a[1]}`);
    if (a[0] === "answer" && !claims[a[3]]) err(where, `discourse(${m[1]}): an answer names the claim said in its place (no claim ${a[3]})`);
  }
  return out;
}

const DAYS = 14, LOUD = 0.4;
export function simulateDiscourse(C, createFullGame) {
  const claims = C.story.claims, lines = [], M = C.community; let errors = 0;
  const e = (m) => { errors++; lines.push(`error: ${m}`); };
  const classVar = String(C.book.meta["class-var"] || "class").trim(), classes = [...new Set([...JSON.stringify(C.book.nodes).matchAll(new RegExp(`${classVar}\\s*=\\s*(\\w+)`, "g"))].map((m) => m[1]))];
  const ph = String(C.book.meta["player-household"] || "").trim().split(/\s+/), phMap = Object.fromEntries(ph.slice(1).map((x) => x.split("=")));
  const fresh = (cls) => { const G = createFullGame({ content: C, seed: 1 }); G.create({ archetype: Object.keys(C.rs.archetypes)[0], enter: false }); G.state.vars[classVar] = cls; return G; };
  const standing = (G, target) => Object.fromEntries(Object.keys(G.community.state.streets).map((s) => [s, +G.community.stock(`standing.${target}`, s) || 0]));
  // the acts each claim allows, through the world's own verbs where an object offers them
  const objs = Object.values(C.objects).flatMap((o) => o.verbs.filter((v) => /discourse\(/.test(v.attrs.do || "")).map((v) => ({ o, v, args: v.attrs.do.match(/discourse\(([^)]*)\)/)[1].split(",").map((x) => x.trim()) })));
  const trials = [];
  for (const c of Object.values(claims)) for (const act of ACTS) {
    const via = objs.find((x) => x.args[0] === act && x.args[1] === c.id);
    if (via) trials.push({ c, act, via });
    const viaCarrier = via ? (c.carriers.includes(via.args[2]) ? via.args[2] : c.carriers[0]) : null;
    if (act === "repeat" || act === "challenge") for (const k of c.carriers.filter((k) => k !== viaCarrier)) trials.push({ c, act, carrier: k }); // said there, from any scene // the pub and the pulpit: said there, from any scene
  }
  for (const cls of classes) for (const t of trials) {
    const label = `${cls}: ${t.act} ${t.c.id}${t.via ? ` at ${t.via.o.id}` : ` in the ${t.carrier}`}`;
    const ctl = fresh(cls), G = fresh(cls), carrier = t.via ? (t.c.carriers.includes(t.via.args[2]) ? t.via.args[2] : t.c.carriers[0]) : t.carrier;
    if (t.via && t.via.v.cond) for (const [id] of t.via.v.cond.calls.get("has") || []) if (id && !G.state.flags.includes(id)) G.state.flags.push(id); // the answer is offered to the one who saw: give the flags its condition reads
    // both start loud (the claim is out, as after the blamed report) and both record an event now, so the only
    // difference two weeks on is the act itself, not when the model's rules were first scheduled
    for (const g of [G, ctl]) { const now = g.discourse.volume(carrier); if (now < LOUD) g.community.shift(`volume.${carrier}`, LOUD - now); }
    ctl.community.record("control", t.c.victim, "");
    const v0 = G.discourse.volume(carrier), events0 = G.community.state.events.length;
    if (t.via) { G.setPlace(t.via.o.place); const r = G.verbs.act(t.via.o.id, t.via.v.kind, { label: t.via.v.label }); if (!r.ok) { e(`${label}: the verb could not be done (${r.why || "?"})`); continue; } }
    else G.discourse.act(t.act, t.c.id, t.carrier);
    const ev = G.community.state.events[events0];
    if (!ev || !ev.street) e(`${label}: no record event with a street`); else if (t.act !== "silence" && !ev.victim) e(`${label}: the record event names no victim`);
    const v1 = G.discourse.volume(carrier), want = t.act === "repeat" ? 1 : -1;
    if (Math.sign(v1 - v0) !== want) e(`${label}: volume.${carrier} went ${v0} to ${v1}`);
    const portion0 = ph[0] && phMap[cls] ? +G.community.stock("portion", phMap[cls]) : null, ctlPortion = ph[0] && phMap[cls] ? +ctl.community.stock("portion", phMap[cls]) : null;
    G.community.run(2); const reposted = G.discourse.volume(t.c.carriers[0]);
    G.community.run(DAYS - 2); ctl.community.run(DAYS);
    const a = standing(G, t.c.target), b = standing(ctl, t.c.target), diff = Object.keys(a).map((s) => a[s] - b[s]);
    if (want > 0 && !diff.some((d) => d < -1e-4)) e(`${label}: two weeks on, standing.${t.c.target} is nowhere lower than with no act`);
    if (want < 0 && !diff.some((d) => d > 1e-4)) e(`${label}: two weeks on, standing.${t.c.target} is nowhere higher than with no act`);
    if (want < 0 && diff.some((d) => d < -1e-4)) e(`${label}: it left standing.${t.c.target} lower somewhere`);
    if (t.act === "challenge" && t.c.costSrc && !(portion0 < ctlPortion)) e(`${label}: the challenge cost nobody (portion ${portion0} against ${ctlPortion})`);
    if (t.act === "silence" && !(reposted > v1)) e(`${label}: the silenced carrier did not come back (${v1} then ${reposted})`);
    const moved = [...new Set([`volume.${carrier}`, ...(G.community.chains().find((x) => x.event.id === (ev && ev.id)) || { steps: [] }).steps.map((s) => s.name)])];
    if (G.lens && !moved.some((n) => G.lens.shows(n).length)) e(`${label}: nothing it moved is shown by a lens (${moved.join(", ")})`);
    lines.push(`ok   ${label}: ${ev ? ev.type : "?"}; volume.${carrier} ${v0.toFixed(2)} to ${v1.toFixed(2)}; standing.${t.c.target} against no act: ${Object.keys(a).map((s, i) => `${s} ${diff[i] >= 0 ? "+" : ""}${diff[i].toFixed(3)}`).join(", ")}`);
  }
  lines.push(`${trials.length} acts x ${classes.length} classes; ${errors} error(s)`);
  return { lines, errors };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/discoursecheck.mjs");
if (isMain) {
  const { readFile } = await import("node:fs/promises"), { STORY } = await import("./use-story.mjs");
  const { loadAct } = await import("../dialogue/book.mjs"), { loadContent, createFullGame } = await import("../full.mjs");
  if (!STORY.acts) { console.log("discoursecheck: this story names no act root (LW_STORY=quota has claims)"); process.exit(0); }
  const sources = (await loadAct(STORY.acts[0], (p) => readFile(p, "utf8"))).sources;
  if (STORY.wiring) sources.push({ file: STORY.wiring, text: await readFile(STORY.wiring, "utf8") }); // the story's areas, from its story file
  const C = loadContent(sources), lint = lintDiscourse(C, sources.map((s) => s.text).join("\n"));
  for (const o of lint) console.log(`${o.file}:${o.line}: ${o.level}: ${o.msg}`);
  console.log(`lint: ${Object.keys(C.story.claims).length} claims, ${Object.keys(C.community.carriers).length} carriers, ${lint.length} problem(s)`);
  if (lint.length || process.argv.includes("--lint")) process.exit(lint.length ? 1 : 0);
  const res = simulateDiscourse(C, createFullGame);
  console.log(res.lines.join("\n"));
  process.exit(res.errors ? 1 : 0);
}
