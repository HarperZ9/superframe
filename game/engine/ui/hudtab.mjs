// The HUD tab, top left (design/UI-SYSTEM.md section 6). Owned by the UI and UX lead. The clock in
// Hanken's tabular digits, the tide in words with its direction, the weather only when it changes
// the night, and the place; on paper, never straight on the plate.
import { h, clockText } from "./dom.mjs";

const term = (G, k) => { try { return G.env.term(k, G.state.place); } catch (e) { console.warn(`hudtab: no term ${k}: ${e.message}`); return undefined; } };
let last = null; // { clock, tide, trend }: the direction holds between samples at the same minute

export function tideTrend(G) {
  const c = G.clock(), t = +term(G, "tide") || 0;
  if (!last || c < last.clock) { last = { clock: c, tide: t, trend: 0 }; return 0; }
  if (c > last.clock) { const d = t - last.tide; last = { clock: c, tide: t, trend: Math.abs(d) < 0.002 ? last.trend : Math.sign(d) }; }
  return last.trend;
}

export function tideWords(t, trend) {
  const state = t <= -1.2 ? "low water" : t >= 1.2 ? "high water" : trend > 0 ? "rising" : trend < 0 ? "falling" : "on the turn";
  return state;
}

export function weatherWords(G) {
  const out = [], w = term(G, "weather"), ws = +term(G, "wind.speed") || 0, fog = +term(G, "fog") || 0;
  if (w === "rain") out.push("rain");
  if (fog > 0.03) out.push(fog > 0.08 ? "thick fog" : "fog");
  if (ws >= 9) out.push(`wind ${Math.round(ws)} m/s`);
  return out.join(", ");
}

export function hudTab(G) {
  const a = G.world.area(), t = +term(G, "tide") || 0, tr = tideTrend(G), wx = weatherWords(G);
  const arrow = tr > 0 ? "↑" : tr < 0 ? "↓" : "↔";
  return h("div.hud",
    h("div.clock", clockText(G.clock())),
    h("div.tide", h("span.trend", { "aria-hidden": "true" }, arrow), " ", tideWords(t, tr), h("span.m", `${t >= 0 ? "+" : "−"}${Math.abs(t).toFixed(2)} m`)),
    wx ? h("div.wx", wx) : null,
    h("div.place", a ? a.name : (G.book.places[G.state.place] || {}).name || ""));
}
