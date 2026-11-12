// The Daybook's Build page (design/UI-SYSTEM.md 7.2 and 7.2a). Owned by the UI and UX lead.
// Left page: the case (four compartments, their pillars, their voices). Right page: Lamb in a
// fight, in Plain words or in Numbers (N, pad Y), with every planned change shown as old to new.
// Planning is in pencil: left and right on a voice pencil in ranks (below zero is a respec
// preview); "Ink the plan" spends the pages. Focusing a tool or a piece of clothing compares it
// with what Lamb has now, side by side. At a bench, temper and fittings are offered with their
// cost, and focusing one previews it. Numbers come from ui/buildstats.mjs (the fight's own maths).
//   buildTab(ctx, rerender) -> element (el._onAction handles left, right and the density key)
import { h, btn } from "./dom.mjs";
import { buildOf, statRows, compareRows, verdict, fmtNum, ms, toolName, COMPARTMENTS, PILLAR, PILLAR_WORDS } from "./buildstats.mjs";
import { store } from "./dom.mjs";
import { sheetTab } from "./tabs-a.mjs";

const UI = { plan: {}, preview: null, get dens() { return store.get("lowwater.build.density", "plain"); }, set dens(v) { store.set("lowwater.build.density", v); } };
export const resetPlan = () => { UI.plan = {}; UI.preview = null; };

const nameOf = (G, id) => (G.rs.items[id] && G.rs.items[id].name) || (/^w\./.test(id) && toolName(G, id)) || (G.rs.skills[id] && G.rs.skills[id].name) || (G.rs.attrs[id] && G.rs.attrs[id].name) || id;
const voicesOf = (G, k) => Object.values(G.rs.skills).filter((s) => s.attr === k);
// the tool in hand, as the inventory has it (the case when nothing is held)
const inHand = (G) => ((G.state.inv || {}).equipped || {}).hand || "w.case";
const compPlanned = () => Object.entries(UI.plan).filter(([k]) => COMPARTMENTS.includes(k)).reduce((a, [, n]) => a + n, 0);
const planned = () => Object.values(UI.plan).reduce((a, n) => a + n, 0);

// The plan as level deltas: a compartment raises itself and every voice under it.
function deltas(G, plan = UI.plan) {
  const d = {};
  for (const [id, n] of Object.entries(plan)) {
    if (!n) continue;
    d[id] = (d[id] || 0) + n;
    if (COMPARTMENTS.includes(id)) for (const v of voicesOf(G, id)) d[v.id] = (d[v.id] || 0) + n;
  }
  return d;
}

function stepPlan(G, id, dir) {
  const S = G.sheet, isComp = COMPARTMENTS.includes(id), cur = UI.plan[id] || 0, next = cur + dir;
  const pts = G.state.sheet.points || 0;
  if (dir > 0) {
    if (!isComp && S.skillBase(id) + S.ranks(id) + next > S.cap(id)) return "At the cap for this voice";
    if (!isComp && next > 0 && planned() - compPlanned() + 1 > pts) return "No more pages to spend; this is a preview";
  } else if (!isComp && next < -S.ranks(id)) return "No ranks left to take back";
  else if (isComp && next < 0) return "Compartments are only raised";
  UI.plan[id] = next; if (!next) delete UI.plan[id];
  return null;
}

function inkPlan(G) {
  const neg = Object.values(UI.plan).some((n) => n < 0), comp = Object.keys(UI.plan).some((k) => COMPARTMENTS.includes(k));
  if (neg) return "Taking ranks back is a preview: the case is re-filed at a daylight page";
  // chapter pages raise compartments (SYSTEMS-FULL 19.4) once the engine pays them: G.sheet.chapters() and raiseAttr(id)
  const S = G.sheet, chap = typeof S.chapters === "function" ? S.chapters() : 0;
  const compN = Object.entries(UI.plan).filter(([k]) => COMPARTMENTS.includes(k)).reduce((a, [, n]) => a + n, 0);
  if (comp && typeof S.raiseAttr !== "function") return "A compartment rises on a chapter page; the engine does not pay chapter pages yet";
  if (compN > chap) return `Raising a compartment takes a chapter page; you have ${chap}`;
  for (const [id, n] of Object.entries(UI.plan)) for (let i = 0; i < n; i++) {
    const ok = COMPARTMENTS.includes(id) ? S.raiseAttr(id) : S.raise(id);
    if (!ok) return `Could not raise ${nameOf(G, id)}`;
  }
  resetPlan(); return null;
}

// ---- left page: the case ----
function voiceRow(G, sk, onPlan) {
  const S = G.sheet, n = UI.plan[sk.id] || 0, lvl = S.skill(sk.id);
  const b = btn([h("span.vn", sk.name), h("span.lvl", String(lvl)), h(`span.pl${n ? ".on" : ""}${n < 0 ? ".neg" : ""}`, n ? `${n > 0 ? "+" : "−"}${Math.abs(n)}` : ""),
    h("span.note", sk.train === false ? "fitted, not trained" : `ranks ${S.ranks(sk.id)} of ${S.cap(sk.id) - S.skillBase(sk.id) + S.ranks(sk.id)}`)], () => onPlan(sk.id, 1), { cls: "vrow" });
  b.dataset.plan = sk.id;
  return b;
}
function caseColumn(G, onPlan) {
  const out = [h("h3", "The case")];
  for (const k of COMPARTMENTS) {
    const a = G.rs.attrs[k]; if (!a) continue;
    const n = UI.plan[k] || 0;
    const head = btn([h("span", a.name, " ", h("span.pillar", PILLAR[k])), h("span.lvl", String(G.sheet.attr(k))), h(`span.pl${n ? ".on" : ""}`, n ? `+${n}` : ""), h("span.note", "")], () => onPlan(k, 1), { cls: "chead", title: PILLAR_WORDS[k] });
    head.dataset.plan = k;
    out.push(h("div.comp", head, ...voicesOf(G, k).filter((s) => s.train !== false).map((s) => voiceRow(G, s, onPlan))));
  }
  return h("div.casecol", out);
}

// ---- right page: Lamb in a fight ----
function valueText(r, v) { return `${fmtNum(v, r.digits)}${typeof v === "number" ? r.unit : ""}`; }
function plainPage(G, rows) {
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  const line = (k, label, text) => h("div.plainline", h("span.k", label), h("span", text));
  const chg = (r) => (r && r.to != null ? h("span.chg", `  → ${valueText(r, r.to)}`) : null);
  const B = buildOf(G).p, tool = inHand(G), T = { needs: B.needs || {}, scale: B.scale || {} };
  const needs = Object.entries(T.needs || {}).map(([k, n]) => `${String(nameOf(G, k)).toUpperCase()} ${n}`).join(", ") || "nothing";
  const scale = Object.entries(T.scale || {}).map(([k, g]) => `${String(nameOf(G, k)).toUpperCase()} ${g}`).join(", ") || "nothing";
  const met = by.met && by.met.now === "met";
  return h("div",
    line("standing", "Standing", [valueText(by.standing, by.standing.now), chg(by.standing)]),
    line("breath", "Breath", [valueText(by.breath, by.breath.now), chg(by.breath)]),
    line("composure", "Composure", [valueText(by.composure, by.composure.now), chg(by.composure)]),
    line("load", "Load", [`${by.band.now}: you ${by.form.now}`, by.band.to != null ? h("span.chg", `  → ${by.band.to}: you ${by.form.to ?? by.form.now}`) : null]),
    line("tool", "In hand", h("span", h("strong", nameOf(G, tool)), `  temper ${B.temper || 0} of 5${B.fitting ? `, ${B.fitting.replace(/_/g, " ")}` : ""}`)),
    line("needs", "Needs", h(`span.met${met ? "" : ".no"}`, met ? `${needs}: met` : `${needs}: not met, so it swings slow and costs double Breath`)),
    line("scales", "Scales with", scale));
}
function numbersTable(rows, { compare = null } = {}) {
  const head = compare ? h("tr", h("th", h("span.small.quiet", "▲ better for you, ▽ worse")), h("th.c", "now"), h("th.c", "with it"), h("th.c", "")) : null;
  const body = [];
  let grp = "";
  for (const r of rows) {
    if (r.group !== grp) { grp = r.group; body.push(h("tr.grp", h("th", { colSpan: 4 }, grp))); }
    const other = compare ? r.other : r.to, v = verdict(r, r.now, other);
    // better and worse by shape and word, never by colour: a filled triangle up is better for Lamb
    const diff = typeof r.now === "number" && typeof other === "number" && other !== r.now ? `${other > r.now ? "+" : "−"}${fmtNum(Math.abs(other - r.now), r.digits)}${v > 0 ? " ▲" : v < 0 ? " ▽" : ""}` : "";
    body.push(h(`tr${other != null && other !== r.now ? ".chg" : ""}`, h("th", r.label),
      h("td.now", valueText(r, r.now)),
      compare ? h("td", other == null ? "" : valueText(r, other)) : other != null ? h("td.to", valueText(r, other)) : h("td", r.frames && typeof r.now === "number" ? h("span.ms", ms(r.now)) : ""),
      h("td.d", diff)));
  }
  return h("table.stats.cmp", head ? h("thead", head) : null, h("tbody", body));
}

// ---- gear and the bench ----
function gearList(G, onPreview, onUse) {
  const items = G.inv.list().map((x) => x.id), hand = inHand(G), worn = Object.values(G.inv.worn());
  const slotOf = (id) => (G.rs.items[id] || {}).slot;
  const tools = ["w.case", ...items.filter((id) => /^w\./.test(id) && id !== "w.case" && (slotOf(id) === "hand" || !slotOf(id)))];
  const clothes = items.filter((id) => slotOf(id) && slotOf(id) !== "hand");
  const B = { tool: hand, gear: worn.filter((id) => slotOf(id) !== "hand") };
  const row = (id, kind) => {
    const isOn = kind === "tool" ? B.tool === id : B.gear.includes(id);
    const b = btn([h("span.gn", nameOf(G, id), isOn ? h("span.gk", kind === "tool" ? "  in hand" : "  worn") : null), h("span.gk", kind === "tool" ? "" : slotOf(id))], () => onUse(id, kind), { cls: `gearrow${isOn ? " worn" : ""}` });
    b.addEventListener("focus", () => onPreview(isOn ? null : kind === "tool" ? { tool: id, label: nameOf(G, id) } : { gear: [...B.gear.filter((g) => (G.rs.items[g] || {}).slot !== (G.rs.items[id] || {}).slot), id], label: nameOf(G, id) }));
    b.addEventListener("blur", () => onPreview(null));
    return b;
  };
  return h("div.gearlist", h("h3", "Tools and clothes: focus one to compare, choose it to take it up"), h("div.chips", ...tools.map((id) => row(id, "tool"))), clothes.length ? h("div.chips", ...clothes.map((id) => row(id, "gear"))) : null);
}
function benchSection(G, onPreview, rerender) {
  const C = G.ext.combat, B = { ...buildOf(G).p, tool: inHand(G) }, at = (() => { try { return !!G.body.bench(); } catch (e) { console.warn(`build: no bench reading: ${e.message}`); return false; } })();
  if (!C || !C.upgradeCost) return null;
  const cost = C.upgradeCost(B.tool), T = { fittings: B.fittings || [] };
  const need = cost ? Object.entries(cost.needs).map(([id, n]) => `${nameOf(G, id)} ${Math.min(G.inv.count(id), n)} of ${n}`).join(", ") : "";
  const why = !at ? "Only at a bench" : !cost ? "Fully tempered" : !cost.affordable ? "Not enough salvage" : "";
  const temper = btn([`Temper to ${cost ? cost.next : 5}:`, h("span.quiet.small", cost ? `  ${need}, ${cost.minutes} min` : "")], () => { if (C.upgrade(B.tool)) rerender(); }, { cls: "mini", disabled: !!why, title: why });
  temper.addEventListener("focus", () => cost && onPreview({ temper: cost.next, label: `temper ${cost.next}` }));
  temper.addEventListener("blur", () => onPreview(null));
  const fits = (T.fittings || []).map((f) => {
    const b = btn(f.replace(/_/g, " "), () => { if (C.fit(B.tool, f)) rerender(); }, { cls: "mini", disabled: !at || B.fitting === f, title: !at ? "Only at a bench" : "" });
    b.addEventListener("focus", () => onPreview({ fitting: f, label: f.replace(/_/g, " ") }));
    b.addEventListener("blur", () => onPreview(null));
    return b;
  });
  return h("div.bench", h("h3", at ? "The bench" : "The bench (not here)"),
    h("div.acts-row", temper, why ? h("span.why.small", why) : null), fits.length ? h("div.acts-row", h("span.small.quiet", "Fittings, 15 min:"), ...fits) : null);
}

export function buildTab(ctx, rerender) {
  const G = ctx.G, s = G.state.sheet;
  // content without the four compartments (the engine's test content) keeps the plain sheet
  if (!G.ext || !G.ext.combat || !COMPARTMENTS.some((k) => G.rs.attrs[k])) return sheetTab(ctx, rerender);
  const onPlan = (id, dir) => { const why = stepPlan(G, id, dir); if (why) note.textContent = why; else rerender(); };
  const onPreview = (p) => { UI.preview = p; drawRight(); };
  const onUse = (id, kind) => { const why = G.inv.equip(id); if (why) note.textContent = why; else { UI.preview = null; rerender(); } };
  const note = h("span.why.small");
  const statsBox = h("div.statsbox"), right = h("div.rightcol", statsBox);
  const pts = s.points || 0, plan = planned();
  const inkB = btn("Ink the plan", () => { const why = inkPlan(G); if (why) note.textContent = why; else rerender(); }, { cls: "mini", disabled: !Object.keys(UI.plan).length });
  const rubB = btn("Rub out", () => { resetPlan(); rerender(); }, { cls: "mini", disabled: !Object.keys(UI.plan).length });
  const densB = btn(UI.dens === "plain" ? "Show every number" : "Show it plainly", () => toggleDens(), { cls: "mini dens" });
  function toggleDens() { UI.dens = UI.dens === "plain" ? "numbers" : "plain"; rerender(); }
  const bar = h("div.bar", h("span.pages", `${pts} page${pts === 1 ? "" : "s"} to spend`), h("span.quiet.small", `${Object.values(s.ranks || {}).reduce((a, n) => a + n, 0)} filed`),
    typeof G.sheet.chapters === "function" ? h("span.pages.small", `${G.sheet.chapters()} chapter page${G.sheet.chapters() === 1 ? "" : "s"}`) : null,
    plan || Object.keys(UI.plan).length ? h("span.plan.small", `pencilled: ${Object.entries(UI.plan).map(([k, n]) => `${nameOf(G, k)} ${n > 0 ? "+" : "−"}${Math.abs(n)}`).join(", ")}`) : h("span.plan.small", "Left and right on a voice pencil in a rank"),
    inkB, rubB, note, h("span.sp", densB));
  function drawRight() {
    const now = buildOf(G), planB = Object.keys(UI.plan).length ? buildOf(G, { levels: deltas(G), plan: true }) : null;
    let body;
    if (UI.preview) {
      const other = buildOf(G, { ...UI.preview, levels: deltas(G) });
      body = [h("h3", `Now against ${UI.preview.label}`), other.applied ? null : h("p.why.small", "The fight's preview does not take clothes, temper or fittings yet, so these columns match; asked of the combat engineer."), numbersTable(compareRows(planB || now, other), { compare: UI.preview.label })];
    } else {
      const rows = statRows(now, planB);
      body = UI.dens === "plain" ? [h("h3", "In a fight"), plainPage(G, rows)] : [h("h3", "In a fight, every number"), numbersTable(rows)];
    }
    statsBox.replaceChildren(...body.filter(Boolean)); // only the numbers redraw on a preview; the focused control stays put
  }
  drawRight();
  const left = caseColumn(G, onPlan);
  right.prepend(gearList(G, onPreview, onUse)); // the gear sits above the numbers, so a comparison is read where it is chosen
  right.append(benchSection(G, onPreview, rerender) || "");
  const first = left.querySelector(".chead"); if (first) first.dataset.first = "";
  const el = h("div.build", bar, left, right);
  el._onAction = (a) => {
    const f = document.activeElement, id = f && f.dataset ? f.dataset.plan : null;
    if ((a === "left" || a === "right") && id) { onPlan(id, a === "right" ? 1 : -1); return true; }
    if (a === "density") { toggleDens(); return true; }
    return false;
  };
  return el;
}
