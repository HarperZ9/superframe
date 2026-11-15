// Found gear reads like gear (author, 2026-10-21: "Make it more like No Rest for the Wicked"; the
// reference's loot structure in cleanroom/spec/NRFTW-PRESENTATION-2.md section 5: four tiers ranked by
// look, a card with the tier on its border, the effect on load). A tool Lamb picks up shows a paper card
// for a few seconds, beside the toasts: its name and tier, what it does against the tool in hand (light
// and heavy blow, breath a swing) and whether the load band changes. Tiers are Low Water's own, from the
// bench: plain (temper 0), sound (1 to 2), tempered (3 to 4), true (5, or old bronze). Author,
// 2026-10-21: "Colour, like NRFTW": the familiar ladder white, blue, purple, gold, taken from Oil and
// Ink's own palette (chalk, the plates' sea-glass blue shadow, their violet, sodium gold), as a band on the
// card and on the tier word. The band's width (the old ink rule) stays as a second cue, so the ladder
// reads without colour.
//   installGearCards(G)   listens for item.gain
import { h } from "./dom.mjs";
import { notify } from "./notify.mjs";
import { TOOLS21 } from "../combat/data/build.mjs";

export const TIERS = [{ id: "plain", rule: 3, colour: "#ece4d2", ink: "#6b6255" }, { id: "sound", rule: 5, colour: "#4f7f93", ink: "#2f5666" }, { id: "tempered", rule: 7, colour: "#7a5aa0", ink: "#4f3870" }, { id: "true", rule: 9, colour: "#c9932e", ink: "#8a5f14" }];
export function tierOf(temper = 0, bronze = false) { return TIERS[bronze || temper >= 5 ? 3 : temper >= 3 ? 2 : temper >= 1 ? 1 : 0]; }

// the rows: found against in hand; each { label, now, found, better: +1 | 0 | -1 }
export function compareRows(now, found) {
  const row = (label, a, b, higherBetter = true) => ({ label, now: a, found: b, better: a == null || b == null || a === b ? 0 : (b > a) === higherBetter ? 1 : -1 });
  return [
    row("Light blow", now.light, found.light), row("Heavy blow", now.heavy, found.heavy),
    row("Breath a swing", now.strikes?.light?.breath, found.strikes?.light?.breath, false),
    { label: "Load", now: now.load?.band, found: found.load?.band, better: now.load?.band === found.load?.band ? 0 : ["light", "medium", "heavy", "over"].indexOf(found.load?.band) < ["light", "medium", "heavy", "over"].indexOf(now.load?.band) ? 1 : -1 },
  ];
}

export function installGearCards(G, { ms = 5200 } = {}) {
  return G.on("item.gain", (d) => showGearCard(G, d, { ms }));
}
// one card; tier: a tier id to show instead of the bench's (captures)
export function showGearCard(G, d, { ms = 5200, tier: forced = null } = {}) {
  {
    const C = G.ext && G.ext.combat, T = TOOLS21[d.id];
    if (!C || !C.preview || !T || typeof document === "undefined") return;
    let now, found;
    try { now = C.preview(); found = C.preview(null, d.id); } catch (e) { console.warn(`gear card: no preview for ${d.id}: ${e.message}`); return; }
    const tier = (forced && TIERS.find((t) => t.id === forced)) || tierOf(found.temper || 0, /bronze/.test(d.id));
    const rows = compareRows(now, found).filter((r) => r.now != null || r.found != null);
    const mark = (b) => (b > 0 ? "▲" : b < 0 ? "▼" : "·");
    const card = h("div.gearcard.sheet.fade-in",
      h("div.caps", "Found"), h("div.gname", d.name || d.id), h("div.small", h("span.gtier", tier.id), T.cls ? h("span.quiet", `, ${T.cls}`) : null),
      h("table.gearrows", ...rows.map((r) => h("tr", h("td.quiet.small", r.label), h("td", String(r.now ?? "-")), h("td", `${mark(r.better)} ${r.found ?? "-"}`)))));
    // the band in the tier's colour with an ink edge (chalk white needs one on paper), its width the second cue
    card.style.borderLeft = `${tier.rule}px solid ${tier.colour}`; card.style.boxShadow = `inset 1px 0 0 ${tier.ink}, var(--shadow)`; card.dataset.tier = tier.id;
    const tw = card.querySelector(".gtier"); if (tw) { tw.style.color = tier.ink; tw.style.fontWeight = "600"; }
    return notify({ kind: "Found", node: card, ms });   // one stack with the notes (ui/notify.mjs)
  }
}
