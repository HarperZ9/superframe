// The community model's chains (design/quota/04-SYSTEMS.md section 8): for each figure the slice's district
// office can take, play the record event forward through the model and print every change it caused, in
// day order, with the rules it passed through and each rule's delay, down to the bowls on the tables. Then
// the tables on the coda's day for each figure, side by side. Exit 1 when two figures lay the same
// Haldane table (the slice's success criterion 2: the reported figure changes the coda's table), or when
// a figure leaves every table as it began (decay rule 2: no clean ending).
//   node tools/communitycheck.mjs [--act content/quota/slice.lwd] [--var q_figure] [--days 21] [--coda 7] [--quiet]
// --var: the variable the office's options assign (the figure); the first node whose options assign it is the office.
import { readFile } from "node:fs/promises";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const ROOT = new URL("../../../", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const ACT = opt.act ? (/^[A-Za-z]:|^\//.test(opt.act) ? opt.act : ROOT + opt.act) : ROOT + "content/quota/slice.lwd", VAR = opt.var || "q_figure";
const DAYS = +(opt.days || 21), CODA = +(opt.coda || 7);
const { sources } = await loadAct(ACT, (p) => readFile(p, "utf8"));
const content = loadContent(sources);
if (!content.community || !Object.keys(content.community.streets).length) { console.error(`communitycheck: ${ACT} has no @street records`); process.exit(2); }

// the office's options, found in the script: every option that assigns the figure. A figure may be offered by
// more than one option, some behind conditions (the weighing: the wedge found or not, 2026-10-23), so each value
// is played through the first of its options a fresh game is offered
const assigns = (s) => s.kind === "opt" && new RegExp(`\\b${VAR}\\s*=`).test(String((s.attrs || {}).do || ""));
const cands = Object.values(content.book.nodes).flatMap((n) => n.steps.filter(assigns).map((s) => ({ node: n.id, label: s.label, value: String(s.attrs.do).match(new RegExp(`\\b${VAR}\\s*=\\s*(\\w+)`))[1] })));
if (!cands.length) { console.error(`communitycheck: no option assigns ${VAR}`); process.exit(2); }
const figures = [...new Set(cands.map((c) => c.value))].map((value) => ({ value, label: cands.find((c) => c.value === value).label }));

const tables = {}, pressures = {};
for (const f of figures) {
  let G = null, t = null;
  for (const c of cands.filter((x) => x.value === f.value)) {
    G = createFullGame({ content, seed: 1 });
    G.create({ archetype: Object.keys(G.rs.archetypes)[0], enter: false });
    t = G.talk(c.node);
    const i = (t.beat.options || []).findIndex((o) => o.label === c.label);
    if (i >= 0) { f.label = c.label; t.choose(i); break; }
    t = null;
  }
  if (!t) { console.error(`communitycheck: no option assigning ${VAR} = ${f.value} is offered to a fresh game`); process.exit(2); }
  const day0 = G.community.day();
  for (let k = 0; k < 4 && t.beat && !t.beat.options && !t.done; k++) t.choose(0); // through the office's own result node
  G.community.run(CODA);
  tables[f.value] = Object.fromEntries(Object.keys(G.community.state.households).map((h) => [h, { bowls: G.community.bowls(h), portion: G.community.stock("portion", h) ?? 1, start: content.community.households[h].members.length }]));
  // a person decides a fate now (@fate, design/spine-plan/03-FATES.md): the model's part in a table is the pressure
  // it puts on the decider, so a figure's table is its bowls and the fates its pressures arm
  pressures[f.value] = Object.keys(G.community.state.pressure || {}).sort();
  G.community.run(DAYS - CODA);
  if (!opt.quiet) {
    console.log(`\nreport = ${f.value}  ("${f.label}")`);
    for (const { event, steps } of G.community.chains()) {
      console.log(`  ${event.type}  victim ${event.victim || "-"}, street ${event.street || "-"}, day ${event.day}`);
      // one line per chain and stock: when it first moved, how often, and from what to what (a rule that holds
      // every day moves its stock every day; the chain is the same)
      const groups = new Map();
      for (const s of steps) {
        const path = s.path.length ? s.path.map((p) => `${p.rule} ${(content.community.rules.find((r) => r.id === p.rule) || {}).name || ""} (${p.delay} d)`).join(" -> ") : "set by the script";
        const k = `${path}|${s.at}|${s.name}`, g = groups.get(k);
        if (g) { g.last = s.day; g.to = s.to; g.n++; } else groups.set(k, { path, at: s.at, name: s.name, first: s.day, last: s.day, from: s.from, to: s.to, n: 1 });
      }
      for (const g of groups.values()) console.log(`    +${String(g.first - event.day).padStart(2)} d  ${g.path}  =>  ${g.at} ${g.name} ${g.from} -> ${g.to}${g.n > 1 ? `  (${g.n} days, to +${g.last - event.day} d)` : ""}`);
    }
  }
  void day0;
}
console.log(`\nthe tables on the coda's day (${CODA} days after the office): bowls, and how full each is`);
const fmt = (t) => `${t.bowls}${t.portion < 1 ? ` at ${Math.round(t.portion * 100)}%` : ""}`;
for (const [v, t] of Object.entries(tables)) console.log(`  ${v.padEnd(9)} ${Object.entries(t).map(([h, x]) => `${h} ${fmt(x)}`).join(", ")}; pressures armed: ${(pressures[v] || []).join(", ") || "none"}`);
// the success criterion, and decay rule 2: each figure lays its own Haldane table, and every figure leaves at
// least one table poorer than it began (no clean ending)
const haldane = Object.entries(tables).map(([v, t]) => `${t.haldane.bowls}:${(pressures[v] || []).join("+")}`), same = haldane.length !== new Set(haldane).size;
const clean = Object.entries(tables).filter(([v, t]) => !Object.values(t).some((x) => x.bowls < x.start || x.portion < 1) && !(pressures[v] || []).length).map(([v]) => v);
console.log(same ? "two figures lay the same Haldane table" : "every figure lays a different Haldane table");
console.log(clean.length ? `no table is poorer after: ${clean.join(", ")}` : "every figure leaves at least one table poorer");

// every record event's effect can be seen from a lens (world/lens.mjs, @lens shows): each node in the script
// that records an event is played once on its own, the model runs on, and the stocks the event moved must
// include one that the wide or the narrow lens shows. An event that moves nothing has nothing to show.
const recorders = Object.values(content.book.nodes).filter((n) => n.steps.some((s) => /\brecord\(/.test(JSON.stringify(s))));
const unseen = [];
console.log("\nseen from a lens, for every node that records an event:");
for (const n of recorders) {
  const G = createFullGame({ content, seed: 1 });
  G.create({ archetype: Object.keys(G.rs.archetypes)[0], enter: false });
  if (!G.lens) { console.log("  (no @lens records: nothing to check)"); break; }
  try { G.talk(n.id); } catch (e) { console.warn(`communitycheck: ${n.id}: ${e.message}`); }
  G.community.run(DAYS);
  for (const { event, steps } of G.community.chains()) {
    if (!event.source || event.source.node !== n.id) if (!steps.length) continue;
    const moved = [...new Set(steps.map((s) => s.name))], lenses = moved.flatMap((s) => G.lens.shows(s).map((l) => `${l}: ${s}`));
    if (!moved.length) continue;
    if (!lenses.length) unseen.push(`${n.id} ${event.type} (moves ${moved.join(", ")})`);
    console.log(`  ${n.id.padEnd(22)} ${event.type.padEnd(20)} ${lenses.length ? [...new Set(lenses)].slice(0, 4).join("; ") : `NOT SEEN (moves ${moved.join(", ")})`}`);
  }
}
console.log(unseen.length ? `effects no lens shows: ${unseen.length}` : "every record event's effect is seen from a lens");
process.exit(same || clean.length || unseen.length ? 1 : 0);
