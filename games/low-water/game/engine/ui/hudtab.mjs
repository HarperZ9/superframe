// The HUD tab, top left (design/UI-SYSTEM.md section 6). Owned by the UI and UX lead. The clock in
// Hanken's tabular digits, the tide in words with its direction, the weather only when it changes
// the night, and the place; on paper, never straight on the plate.
import { h, clockText } from "./dom.mjs";
import { compile, evaluate, toMin } from "../core/expr.mjs";

const term = (G, k) => { try { return G.env.term(k, G.state.place); } catch (e) { console.warn(`hudtab: no term ${k}: ${e.message}`); return undefined; } };
let last = null; // { clock, tide, trend }: the direction holds between samples at the same minute

export function tideTrend(G) {
  const d = term(G, "tide.dir"); if (d === "rising") return 1; if (d === "falling") return -1; if (d === "slack") return 0; // the night's own clock
  const c = G.clock(), t = +term(G, "tide") || 0;
  if (!last || c < last.clock) { last = { clock: c, tide: t, trend: 0 }; return 0; }
  if (c > last.clock) { const d = t - last.tide; last = { clock: c, tide: t, trend: Math.abs(d) < 0.002 ? last.trend : Math.sign(d) }; }
  return last.trend;
}

// Words for the tide from the night's own range (2026-10-21: fixed metres called +2.53 m "high
// water" on a 5.1 m night): the bottom 15% is low water, the top 15% high water.
export function tideWords(t, trend, range = { low: -0.5, high: 5.2 }) {
  const f = (t - range.low) / Math.max(0.01, range.high - range.low);
  return f <= 0.15 ? "low water" : f >= 0.85 ? "high water" : trend > 0 ? "rising" : trend < 0 ? "falling" : "on the turn";
}
export const tideRange = (G) => { const s = G.env && G.env.spec; return s && s.low && s.high ? { low: s.low.h, high: s.high.h } : undefined; };

// The fields come from the story (@meta hud, in order; 2026-10-21): clock, tide, day, weather, place.
// The weather words a story shows come from @meta hud-weather (rain, fog, wind, frost, snow), and the
// day line from @meta hud-day, with {day} filled from the community model's day. Low Water's acts set
// none of these and get the clock, the tide, the night's rain, fog and wind, and the place, as before.
// The Quota: hud: clock weather place; hud-weather: frost snow wind. Its hud-day line stays in @meta and is not
// shown (2026-10-22, the author's "less emphasis on counting": light, frost and snow carry the time).
const DEFAULT = { fields: ["clock", "tide", "weather", "place"], weather: ["rain", "fog", "wind"] };
const words = (v) => String(v || "").split(/[\s,]+/).filter(Boolean);
export function hudConfig(G) {
  const m = (G.book && G.book.meta) || {};
  return { fields: m.hud ? words(m.hud) : DEFAULT.fields, weather: m["hud-weather"] ? words(m["hud-weather"]) : DEFAULT.weather, day: m["hud-day"] || "Day {day}" };
}

export function weatherWords(G, kinds = DEFAULT.weather) {
  const out = [], w = term(G, "weather"), ws = +term(G, "wind.speed") || 0, fog = +term(G, "fog") || 0;
  for (const k of kinds) {
    if (k === "rain" && w === "rain") out.push("rain");
    else if (k === "fog" && fog > 0.03) out.push(fog > 0.08 ? "thick fog" : "fog");
    // a story with @meta numbers: off says the wind in words (The Quota, 2026-10-22: no numbers on the player's surface)
    else if (k === "wind" && ws >= 9) out.push(((G.book && G.book.meta) || {}).numbers === "off" ? (ws >= 15 ? "a gale off the hill" : "a hard wind off the hill") : `wind ${Math.round(ws)} m/s`);
    else if (k === "frost" && +term(G, "frost") > 0) out.push("frost");
    else if (k === "snow") { const sn = +term(G, "snow") || 0; if (sn > 0.2) out.push(sn > 1.5 ? "heavy snow" : "snow"); }
  }
  return out.join(", ");
}

export function dayWords(G, cfg = hudConfig(G)) {
  const m = (G.book && G.book.meta) || {}, day = G.community ? G.community.day() : +m["community-day"] || 1;
  return cfg.day.replace("{day}", String(day));
}

// A held clock (The Quota's era 1, 2026-10-22): era 1 plays before era 2's day and costs no minutes, so the day's
// clock would read 05:50 and frost through the harvest. While @meta hud-held holds (an expression: var.era == 1),
// the HUD shows the area's hud-clock and hud-weather (wiring/era1-areas.lwd), else @meta hud-held-clock and
// hud-held-weather, else no clock and no weather.
const heldCache = new Map();
export function heldHud(G, a = G.world.area()) {
  const m = (G.book && G.book.meta) || {}, src = m["hud-held"]; if (!src) return null;
  if (!heldCache.has(src)) heldCache.set(src, compile(src));
  let on = false; try { on = !!evaluate(heldCache.get(src), G.scope); } catch (e) { console.warn(`hudtab: hud-held ${src}: ${e.message}`); }
  if (!on) return null;
  // a scene's own hour first (a node's hud-clock and hud-weather, dialogue/runner.mjs; G.setPlace clears them on a
  // move), since one area holds scenes at different hours: the barns at dawn, at the count at ten, the night before
  // the frost (2026-10-23: era 1 night scenes read the barns' 17:35)
  // The area's hour only while the scene is in the area's own place: a talk's place: line moves the scene (the
  // loft, then the Furrowe parlour the morning after) without moving the area, and its hour would be another scene's.
  const s = G.state.sceneHud || {}, here = !!(a && (!a.place || a.place === G.state.place));
  const hm = (t) => { const x = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim()); return x ? +x[1] * 60 + +x[2] : null; };
  return { clock: hm(s.clock || (here && a.hudClock) || m["hud-held-clock"]), weather: (s.weather != null ? s.weather : here && a.hudWeather != null ? a.hudWeather : m["hud-held-weather"]) || "",
    place: here || !G.book.places[G.state.place] ? null : G.book.places[G.state.place].name };   // the scene's place name when the area is elsewhere
}

// The clock as the HUD and the menu show it. Held: the scene's hour, or none. Else the day's clock, with the
// weekday when the story names its first day's (@meta hud-week; the Quota: Wednesday, day 41), so a later
// day's earlier hour never reads as the clock running back (ledger U7: 11:00, then 07:06 in the cells).
const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function clockWords(G, held = heldHud(G)) {
  if (held) return held.clock == null ? null : clockText(held.clock);
  const m = (G.book && G.book.meta) || {}, c = G.clock(), w = WEEK.indexOf(String(m["hud-week"] || "").trim());
  if (w < 0) return clockText(c);
  const day = Math.floor(c / 1440) - Math.floor(toMin(String(m.clock || "23:00").trim()) / 1440); // days since the act's first (an early hour counts past midnight, core/expr.mjs toMin)
  return `${WEEK[(((w + day) % 7) + 7) % 7]} ${clockText(c)}`;
}

export function hudTab(G) {
  const cfg = hudConfig(G), a = G.world.area(), held = heldHud(G, a);
  const field = {
    clock: () => { const t = clockWords(G, held); return t == null ? null : h("div.clock", t); },
    tide: () => { const t = +term(G, "tide") || 0, tr = tideTrend(G), arrow = tr > 0 ? "↑" : tr < 0 ? "↓" : "↔"; return h("div.tide", h("span.trend", { "aria-hidden": "true" }, arrow), " ", tideWords(t, tr, tideRange(G)), h("span.m", `${t >= 0 ? "+" : "−"}${Math.abs(t).toFixed(2)} m`)); },
    day: () => h("div.day", dayWords(G, cfg)),
    weather: () => { const wx = held ? held.weather : weatherWords(G, cfg.weather); return wx ? h("div.wx", wx) : null; },
    place: () => h("div.place", held && held.place ? held.place : a ? a.name : (G.book.places[G.state.place] || {}).name || ""),
  };
  // out of the day's time: the witness's room years later (and the cold open there) shows only the place, never
  // the day's clock and weather (the browser walk of 2026-10-22 read "frost, heavy snow" over her rainy kitchen)
  const outOfTime = !!(G.witness && Object.values(G.witness.records || {}).some((w) => w.place && w.place === G.state.place));
  return h("div.hud", ...(outOfTime ? ["place"] : cfg.fields).map((f) => (field[f] ? field[f]() : (console.warn(`hudtab: no field ${f}`), null))));
}
