// The scene area: the current area's plate (content/<plate>/<variant>.png) when one exists,
// else a plain paper card with the place name. Over it, the clock and tide, and an edge mark for
// any meter at 70 percent of its maximum or more.
import { h } from "./dom.mjs";
import { hudTab } from "./hudtab.mjs";

export const plateUrl = (a) => `/content/${a.plate}/${a.variant || "night"}.png`;

// ux: the HUD tab is the UI lead's (ui/hudtab.mjs): clock, tide in words with its direction, weather, place.
export function hudEl(G) { return hudTab(G); }

// Meters as marks: a notch per unit, filled to the value, with the name and number in words.
export function meterMarks(G, { all = false } = {}) {
  const out = [];
  for (const m of Object.values(G.content.meters)) {
    const v = G.pressure.meter(m.id), frac = (v - m.min) / Math.max(1e-9, m.max - m.min);
    if (!all && frac < 0.7) continue;
    // ux: pencil tally marks in fives, inked at 70 percent and over (UI-SYSTEM section 4)
    out.push(h("div.meter", { title: m.about || m.name }, h("span.mname.caps", m.name), tally(v - m.min, frac >= 0.7), h("span.mval.mono", `${fmt(v)} of ${fmt(m.max)}`)));
  }
  return out;
}
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// Tally marks: groups of five, the fifth struck through.
export function tally(v, inked = false) {
  const n = Math.max(0, Math.round(v)), el = h(`span.tally${inked ? ".inked" : ""}`);
  if (!n) { el.append(h("span.none", "none")); return el; }
  for (let k = 0; k < n; k += 5) { const c = Math.min(5, n - k), g = h(`span.five${c === 5 ? ".full" : ""}`); for (let i = 0; i < Math.min(c, 4); i++) g.append(h("i")); el.append(g); }
  return el;
}
