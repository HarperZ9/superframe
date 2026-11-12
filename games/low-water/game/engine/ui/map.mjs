// The Daybook's Map page (UX-AUDIT, map and travel; design/UI-SYSTEM.md 4). Owned by the UI and UX
// lead. Lamb's own chart of Gullet, drawn in the Daybook's pencil and ink: districts at their
// `map:` points, the ways between them (`next:`), the ones Lamb has walked in ink and the rest in
// pencil, where Lamb is now as a filled ink mark, and for the focused district what Lamb knows: its
// name, its lamps tonight, the tide, and the minutes the last walk there cost. Every district is a
// button, so keyboard, pad and mouse move over the chart the same way.
//   mapTab(ctx, rerender) -> element
import { h, btn } from "./dom.mjs";
import { tideTrend, tideWords } from "./hudtab.mjs";

const NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const k of kids) e.append(k); return e; };

export function mapTab(ctx) {
  const G = ctx.G, D = (G.content.map && G.content.map.districts) || {}, list = Object.values(D);
  if (!list.length) return h("p.empty", "Lamb has not drawn the town yet.");
  const here = (G.world.district() || {}).id, seen = new Set(((G.state.seen || {}).districts) || []);
  const areasSeen = new Set(((G.state.seen || {}).areas) || []);
  for (const a of Object.values(G.content.map.areas || {})) if (areasSeen.has(a.id) && a.district) seen.add(a.district);
  if (here) seen.add(here);
  const W = 1000, H = 640, xs = list.map((d) => d.map[0]), ys = list.map((d) => d.map[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // the chart fits every district, keeping the town's proportions
  const k = Math.min((W - 220) / Math.max(1e-3, x1 - x0), (H - 140) / Math.max(1e-3, y1 - y0)), ox = (W - (x1 - x0) * k) / 2, oy = (H - 40 - (y1 - y0) * k) / 2;
  const P = (d) => [ox + (d.map[0] - x0) * k, oy + (d.map[1] - y0) * k];
  const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "mapchart", role: "img", "aria-label": "Lamb's chart of Gullet" });
  chart.append(svg("rect", { x: 0, y: 0, width: W, height: H, class: "mapsea" }));
  const drawn = new Set();
  for (const d of list) for (const n of d.next) {
    const e = D[n]; if (!e) continue; const key = [d.id, n].sort().join("|"); if (drawn.has(key)) continue; drawn.add(key);
    const walked = seen.has(d.id) && seen.has(n), [x1, y1] = P(d), [x2, y2] = P(e);
    chart.append(svg("line", { x1, y1, x2, y2, class: walked ? "way ink" : "way pencil" }));
  }
  const info = h("div.mapinfo");
  const term = (k, place) => { try { return G.env.term(k, place); } catch (e) { console.warn(`map: ${k}: ${e.message}`); return undefined; } };
  function describe(d) {
    const zone = d.zone, power = term(`power.${zone}`), tide = +term("tide") || 0;
    info.replaceChildren(...[h("h3.mname", d.name),
      d.about && d.about !== "null" ? h("p.small", d.about) : null,
      h("p.small", d.id === here ? "Lamb is here." : seen.has(d.id) ? "Lamb has been here tonight." : "Lamb has not been here yet; the way is pencilled in."),
      power ? h("p.small", `Lamps: ${power === "off" ? "out" : "lit"}.`) : null,
      h("p.small", `Tide ${tideWords(tide, tideTrend(G))}.`),
      d.next.length ? h("p.small.quiet", `From here: ${d.next.map((n) => (D[n] || {}).name || n).join(", ")}.`) : null].filter(Boolean));
  }
  const marks = h("div.mapmarks");
  for (const d of list) {
    const [x, y] = P(d), on = d.id === here, known = seen.has(d.id);
    chart.append(svg("circle", { cx: x, cy: y, r: on ? 13 : 9, class: on ? "spot here" : known ? "spot ink" : "spot pencil" }));
    const b = btn([h("span.mn", d.name), on ? h("span.mh", "you are here") : null], () => describe(d), { cls: `mapspot${on ? " here" : ""}${known ? "" : " unknown"}` });
    b.style.left = `${(x / W) * 100}%`; b.style.top = `${(y / H) * 100}%`;
    b.addEventListener("focus", () => describe(d));
    if (on) b.dataset.first = "";
    marks.append(b);
  }
  describe(D[here] || list[0]);
  return h("div.map", h("div.mapwrap", chart, marks), info);
}
