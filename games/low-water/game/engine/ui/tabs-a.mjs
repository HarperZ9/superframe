// Daybook tabs, first half: Notes (journal facts), Claims (quests by stage), Margin (the trait
// cabinet) and Sheet (attributes, skills, ranks). Each tab is (ctx, rerender) -> element.
import { h, btn, clockText, signed } from "./dom.mjs";

export const empty = (text) => h("p.empty", text);
export const section = (title, ...kids) => h("section.dsec", h("h3.caps", title), ...kids);

// A modifier in words: "Eye +2 when tide < -0.27".
export function modText(G, m) {
  const [kind, id, sub] = String(m.target).split(".");
  const rs = G.rs, name =
    kind === "skill" ? (rs.skills[id] || {}).name || id
    : kind === "attr" ? (rs.attrs[id] || {}).name || id
    : kind === "res" ? `${(rs.resources[id] || {}).name || id}${sub === "max" ? " maximum" : ""}`
    : kind === "cabinet" ? "Margin slots" : m.target;
  return `${name} ${signed(m.amount)}${m.cond && m.cond.src ? ` when ${m.cond.src}` : ""}`;
}

export function notesTab(ctx) {
  const facts = ctx.G.quests.journal().filter((j) => j.kind !== "quest");
  if (!facts.length) return section("Notes", empty("Nothing written down yet."));
  return section("Notes", h("ul.entries", facts.map((j) => h("li", h("span.t.mono", clockText(j.at)), h("span", j.text)))));
}

export function claimsTab(ctx) {
  const qs = ctx.G.quests.list();
  if (!qs.length) return section("Claims", empty("No claims open."));
  return section("Claims", ...qs.map((q) => {
    const stageText = (q.stages.find((s) => s.id === q.state.stage) || {}).text || "";
    return h("article.claim",
      h("div.chead", h("span.cname", q.name), h("span.caps.quiet", q.state.done ? "Settled" : "Open")),
      h("p.now", stageText),
      h("ul.entries.past", q.entries.slice(0, -1).reverse().map((e) => h("li", h("span.t.mono", clockText(e.at)), h("span", e.text)))));
  }));
}

function traitRow(ctx, t, rerender) {
  const G = ctx.G, C = G.cabinet, page = (n) => `${n} page${n === 1 ? "" : "s"}`;
  const mods = (t.status === "done" ? t.mods : t.during).map((m) => modText(G, m));
  const acts = [];
  if (t.status === "found") acts.push(btn("Pencil it in", () => { C.research(t.id); rerender(); }, { cls: "mini", disabled: !!t.why, title: t.why || "" }), t.why ? h("span.why.small", t.why) : null);
  if (t.status === "researching" || t.status === "done") {
    const why = C.canForget(t.id), cost = G.rs.rules["forget-cost"];
    acts.push(btn(cost ? `Forget (${page(cost)})` : "Forget", () => { C.forget(t.id); rerender(); }, { cls: "mini", disabled: !!why, title: why || "" }), why ? h("span.why.small", why) : null);
  }
  const prog = t.status === "researching" ? h("span.mono.small", `${Math.round(t.progress * t.research)} of ${t.research} min`) : null;
  return h("div.trait",
    h("div.thead", h("span.glyph.mono", t.glyph || "·"), h("span.tname", t.name), h("span.caps.quiet", STATUS[t.status] || t.status), prog),
    t.status === "researching" ? notchBar(t.progress) : null,
    t.about ? h("p.small", t.about) : null,
    mods.length ? h("p.mods.mono.small", (t.status === "done" ? "" : "while pencilled: ") + mods.join("; ")) : null,
    h("div.acts-row", acts));
}
const STATUS = { found: "Found", researching: "Pencilled", done: "Inked", forgotten: "Forgotten" };
export const notchBar = (p, n = 12) => h("span.notches.wide", Array.from({ length: n }, (_, k) => h(`i.${k < Math.round(p * n) ? "on" : "off"}`)));

export function marginTab(ctx, rerender) {
  const G = ctx.G, C = G.cabinet, list = C.list(), why = C.canBuySlot();
  const slots = h("div.slotline", h("span.mono", `${C.slots() - C.free()} of ${C.slots()} slots used`),
    btn("Buy a slot (1 page)", () => { C.buySlot(); rerender(); }, { cls: "mini", disabled: !!why, title: why || "" }), why ? h("span.why.small", why) : null);
  const group = (st, title) => { const xs = list.filter((t) => t.status === st); return xs.length ? section(title, ...xs.map((t) => traitRow(ctx, t, rerender))) : null; };
  const any = list.length;
  return h("div", slots, any ? null : empty("No thoughts found yet. They turn up in conversation."),
    group("researching", "Pencilled"), group("found", "Found"), group("done", "Inked"), group("forgotten", "Forgotten"));
}

function skillRow(ctx, sk, rerender) {
  const S = ctx.G.sheet, lvl = S.skill(sk.id), ranks = S.ranks(sk.id), can = S.canRaise(sk.id);
  const parts = ctx.G.checks.breakdown(sk.id).parts.map((p) => `${p.why} ${signed(p.amount)}`).join(", ");
  const trusted = ctx.G.state.sheet.trusted === sk.id;
  return h("div.skill",
    h("span.glyph.mono", sk.glyph || "·"),
    h("span.sname", sk.name, trusted ? h("span.caps.quiet", "  trusted") : null),
    h("span.lvl.mono", String(lvl)),
    h("span.mono.small.quiet", sk.train === false ? "not trained" : `ranks ${ranks}, cap ${S.cap(sk.id)}`),
    btn("+1 rank", () => { S.raise(sk.id); rerender(); }, { cls: "mini", disabled: !can, title: can ? "Spend a page" : sk.train === false ? "This is never trained" : "No page to spend, or at the cap" }),
    h("span.parts.mono.small", parts));
}

export function sheetTab(ctx, rerender) {
  const G = ctx.G, rs = G.rs, s = G.state.sheet;
  const attrs = Object.values(rs.attrs).map((a) => h("div.attr", h("span.ashort.mono", a.short || a.name), h("span.aname", a.name), h("span.lvl.mono", String(G.sheet.attr(a.id)))));
  const groups = Object.values(rs.attrs).map((a) => section(`${a.name} skills`, ...Object.values(rs.skills).filter((k) => k.attr === a.id).map((k) => skillRow(ctx, k, rerender))));
  const loose = Object.values(rs.skills).filter((k) => !k.attr);
  const res = Object.keys(rs.resources).map((id) => h("div.attr", h("span.aname", rs.resources[id].name), h("span.lvl.mono", `${G.sheet.res(id)} of ${G.sheet.resMax(id)}`)));
  return h("div",
    h("div.sheetline.mono.small", `${s.name || "Lamb"}   ${s.archetype ? (rs.archetypes[s.archetype] || {}).name || s.archetype : "custom"}   level ${s.level}   xp ${s.xp} of ${G.sheet.xpForLevel(s.level + 1)}   pages to spend ${s.points}`),
    section("Attributes", h("div.attrs", attrs)),
    ...groups,
    loose.length ? section("Instruments", ...loose.map((k) => skillRow(ctx, k, rerender))) : null,
    res.length ? section("Resources", h("div.attrs", res)) : null);
}
