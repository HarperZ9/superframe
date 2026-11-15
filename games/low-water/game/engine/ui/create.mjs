// Character creation over the painted scene (ux: rebuilt by the UI and UX lead, design/UI-SYSTEM.md
// section 7; the first screen a player meets keeps the world in view). Left, a Daybook page: the
// Precedents (archetypes) as cards, each with its three claims and the four compartments as pips
// with their pillar in one plain word, and the custom spread. Right, a smaller page: what the
// focused choice means in a fight (from the combat layer's preview), the custom spread's rows, the
// trusted instrument (only the Kit's instruments), ink mode, and Begin. G.create's errors show as
// written. Arrows move, left and right change a value, Enter chooses, Esc goes back.
import { h, btn } from "./dom.mjs";
import { plateUrl } from "./scene.mjs";
import { PILLAR } from "./buildstats.mjs";
import { COMPARTMENT_TRAITS } from "../combat/data/traits.mjs";

const pips = (v, max) => h("span.pips", { "aria-label": `${v} of ${max}` }, ...Array.from({ length: max }, (_, k) => h(k < v ? "i.on" : "i")));

function artFor(ctx) {
  const art = h("div.title-art.create-art"), rules = ctx.content.rs.rules, map = ctx.content.map || { areas: {} };
  const area = map.areas[rules["start-area"]];
  const url = area && area.plate ? plateUrl(area) : "/content/wide_arrival/night.png";
  const img = new Image(); img.onload = () => { art.style.backgroundImage = `url("${url}")`; }; img.onerror = () => console.warn(`create: no plate at ${url}`); img.src = url;
  return art;
}

// The four great traits and what each one is for, said once where they first appear (UX walk, 2026-10-21: a new player
// met a compartment and "Read" with nothing to say what they meant). Since the traits pass (2026-10-23, design/TRAITS.md)
// every compartment and voice is a quality the character carries and a being he meets inside; the story's own line
// (@attr about:) wins, and these stand in for a ruleset that has none.
export const COMPARTMENT_LINES = Object.fromEntries(Object.entries(COMPARTMENT_TRAITS).map(([k, t]) => [k, t.does]));
export const TRAITS_LINE = "Each of these is something you carry. Raise one and it works for you; meet it inside and it is as big as you made it.";
// the fight words in the summary on the right, one plain line each
export const FIGHT_LINES = {
  composure: "Composure: the calm to find words in a fight. Holding your ground fills it; talking your way out spends it.",
  load: "Load: what you carry against what your coat can bear. Carry little and you dash; more, you roll; too much, you hop.",
};
function legend(rs) {
  const rows = Object.entries(COMPARTMENT_LINES).filter(([k]) => rs.attrs[k]).map(([k, line]) => h("div.lrow", h("span.cname2", rs.attrs[k].name), h("span.pillar", PILLAR[k] || ""), h("span.small", rs.attrs[k].about || line)));
  return rows.length ? h("div.legend", h("p.small.quiet", TRAITS_LINE), ...rows) : null;
}

function compRows(rs, attrs, max) {
  return h("div.crows", ...Object.entries(rs.attrs).map(([k, a]) => h("div.crow", h("span.cname2", a.name), h("span.pillar", PILLAR[k] || ""), pips(attrs[k] || 0, max))));
}

function archetypeCard(ctx, a, on, choose, onFocus) {
  const rs = ctx.G.rs, max = rs.rules["attr-max"] || 5;
  const note = a.traits.map((t) => (rs.traits[t] || {}).name || t).join(", ");
  const b = btn([h("div.cname", a.name, on ? h("span.chosen", "chosen") : null), a.about ? h("div.claims", a.about) : null, compRows(rs, a.attrs, max),
    note ? h("div.small.quiet", `First note: ${note}`) : null], choose, { cls: `card${on ? " on" : ""}` });
  b.setAttribute("aria-pressed", String(on));
  b.addEventListener("focus", onFocus);
  return b;
}

// A row the player changes with left and right (or a click to step on).
function stepRow(label, value, step, help = "") {
  const val = h("span.val", value());
  const el = h("button.f.row", { type: "button" }, h("span.lab", label, help ? h("span.help", help) : null), val);
  el.addEventListener("click", () => { step(1); val.textContent = value(); });
  el._step = (d) => { step(d); val.textContent = value(); };
  return el;
}

export function createScreen(ctx) {
  const G = ctx.G, rs = G.rs, R = rs.rules, arch = Object.values(rs.archetypes), max = R["attr-max"] || 5;
  const C = { archetype: arch[0] ? arch[0].id : null, custom: false, kit: arch[0] ? arch[0].id : null, attrs: Object.fromEntries(Object.keys(rs.attrs).map((k) => [k, R["attr-min"]])), trusted: null, ink: false, look: null };
  const cards = h("div.cards"), fight = h("div.cfight"), detail = h("div.detail"), errs = h("div.errs");
  const root = h("div.screen.create", artFor(ctx),
    h("div.createbox.sheet.fade-in", h("h2", "Lamb's case"), h("p.sub.quiet", "Eleven years of claims. Choose the three that made you, or spread the points yourself."), legend(ctx.G.rs), cards),
    h("div.createside.sheet.fade-in", fight, detail, errs));
  ctx.stage.append(root);
  const spent = () => Object.values(C.attrs).reduce((a, v) => a + v, 0);
  const attrsOf = (id) => (id === "custom" ? C.attrs : (rs.archetypes[id] || {}).attrs || {});

  // What the focused (or chosen) choice means in a fight, in plain words, from the combat preview.
  function drawFight() {
    const id = C.look || (C.custom ? "custom" : C.archetype), A = attrsOf(id), comb = G.ext && G.ext.combat;
    const name = id === "custom" ? "Your spread" : (rs.archetypes[id] || {}).name || "";
    if (!comb || !comb.preview || !Object.keys(PILLAR).some((k) => rs.attrs[k])) { fight.replaceChildren(h("div.caps.quiet", name)); return; }
    let p = null;
    try { p = comb.preview({ ...A }); } catch (e) { console.warn(`create: preview failed: ${e.message}`); }
    if (!p) { fight.replaceChildren(h("div.caps.quiet", name)); return; }
    const form = { roll_dash: "you dash", roll: "you roll", roll_hop: "you hop" }[p.frames && p.frames.rollForm] || "";
    const best = Object.entries(A).sort((a, b) => b[1] - a[1])[0];
    fight.replaceChildren(h("div.caps.quiet", `${name} in a fight`),
      h("div.fline", h("span", "Standing"), h("strong.num", String(p.standing)), h("span", "Breath"), h("strong.num", String(p.breath)), h("span", "Composure"), h("strong.num", String(p.composure))),
      h("p.small", best && PILLAR[best[0]] ? `Strongest at ${PILLAR[best[0]].toLowerCase()}: ${({ coat: "you take blows and carry the heavy tools", nose: "you are out of the way before the blow lands", pen: "you read a blow before it comes", hat: "people give in to you sooner" })[best[0]]}.` : "",
        p.load ? ` Load ${p.load.band}${form ? `: ${form}` : ""}.` : ""),
      h("p.small.quiet", FIGHT_LINES.composure), h("p.small.quiet", FIGHT_LINES.load));
  }
  function drawCards() {
    cards.replaceChildren(...arch.map((a) => archetypeCard(ctx, a, !C.custom && C.archetype === a.id, () => { C.custom = false; C.archetype = a.id; C.kit = a.id; redraw(true); }, () => { C.look = a.id; drawFight(); })),
      (() => {
        const b = btn([h("div.cname", "A custom spread", C.custom ? h("span.chosen", "chosen") : null), h("div.small", `Spend ${R["creation-points"]} points, each compartment ${R["attr-min"]} to ${R["attr-max"]}, and take one Precedent's things and note.`)], () => { C.custom = true; redraw(true); }, { cls: `card${C.custom ? " on" : ""}` });
        b.addEventListener("focus", () => { C.look = "custom"; drawFight(); });
        return b;
      })());
  }
  function drawDetail() {
    const rows = [];
    if (C.custom) {
      rows.push(h("div.caps.quiet", `Points left ${R["creation-points"] - spent()} of ${R["creation-points"]}`));
      for (const [k, a] of Object.entries(rs.attrs)) rows.push(stepRow(`${a.name}${PILLAR[k] ? `  ${PILLAR[k]}` : ""}`, () => `${C.attrs[k]}`, (d) => { C.attrs[k] = Math.max(R["attr-min"], Math.min(R["attr-max"], C.attrs[k] + d)); drawDetailKeep(); drawFight(); }, a.about));
      const kits = [null, ...arch.map((a) => a.id)];
      rows.push(stepRow("Things and note from", () => (C.kit ? rs.archetypes[C.kit].name : "nothing"), (d) => { C.kit = kits[(kits.indexOf(C.kit) + d + kits.length) % kits.length]; }, "A Precedent's things and first note; its numbers are not used"));
    }
    // the trusted instrument is one of the Kit (instruments are never trained)
    const inst = Object.values(rs.skills).filter((s) => s.train === false).map((s) => s.id), skills = [null, ...(inst.length ? inst : Object.keys(rs.skills))];
    rows.push(stepRow("Trusted instrument", () => (C.trusted ? rs.skills[C.trusted].name : "none"), (d) => { C.trusted = skills[(skills.indexOf(C.trusted) + d + skills.length) % skills.length]; }, "Starts one condition higher"));
    rows.push(stepRow("Ink mode", () => (C.ink ? "on" : "off"), () => { C.ink = !C.ink; }, "One save, written as you go; no loading back"));
    const begin = btn(["Begin the night", h("span.k", "Enter")], start, { cls: "btn go" });
    begin.dataset.begin = "";
    detail.replaceChildren(h("div.rows", rows), begin);
  }
  function drawDetailKeep() { const i = [...detail.querySelectorAll(".f")].indexOf(document.activeElement); drawDetail(); const f = detail.querySelectorAll(".f")[i]; if (f) f.focus({ preventScroll: true }); }
  function redraw(toBegin = false) {
    const i = [...cards.querySelectorAll(".f")].indexOf(document.activeElement);
    drawCards(); drawDetail(); errs.replaceChildren(); C.look = null; drawFight();
    if (toBegin && !C.custom) { const b = detail.querySelector("[data-begin]"); if (b) { b.focus({ preventScroll: true }); return; } }
    if (toBegin && C.custom) { const f = detail.querySelector(".row"); if (f) { f.focus({ preventScroll: true }); return; } }
    const f = cards.querySelectorAll(".f")[i]; if (f) f.focus({ preventScroll: true });
  }
  function start() {
    const choice = C.custom ? { attrs: { ...C.attrs }, archetype: C.kit, trusted: C.trusted, ink: C.ink } : { archetype: C.archetype, trusted: C.trusted, ink: C.ink };
    const problems = G.create(choice);
    if (problems.length) { errs.replaceChildren(h("div.caps", "Not yet"), ...problems.map((p) => h("p.small", p))); return; }
    ctx.play(rs.rules["start-node"] || G.book.meta.start || null);
  }
  drawCards(); drawDetail(); drawFight();
  if (cards.firstChild) cards.firstChild.dataset.first = "";
  return ctx.F.push({
    name: "create", root, onBack: () => ctx.title(),
    onAction(a) {
      if ((a === "left" || a === "right") && document.activeElement && document.activeElement._step) { document.activeElement._step(a === "right" ? 1 : -1); return true; }
      return false;
    },
  });
}
