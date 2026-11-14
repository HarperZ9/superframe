// The lens switch on screen, a placeholder until the rendering lead's wide plate and ink-blot transition
// land (world/lens.mjs is the mechanic). In the wide lens: each street with what can be seen of it, in words
// (the relief queue: some), and the households and places to go down to; choosing a street looks across at
// it. In the narrow lens: the household's table in words and the way back out to the district. No number
// and nothing drawn as a bar: the model is shown as things, and the plates will draw the things.
//   lensPanel(ctx, host) -> { el, refresh, stop }
import { h, btn } from "./dom.mjs";

export function lensPanel(ctx, host) {
  const G = ctx.G, el = h("div.lenspanel.sheet"); el.hidden = true; host.append(el);
  if (!G.lens) return { el, refresh() {}, stop() {} };
  const names = () => (G.community ? G.community.model : { streets: {}, households: {} });
  // a counted sign (the bowls) is named, never counted: the plates draw the bowls (2026-10-22, the author's
  // "less emphasis on counting"); the count stays in G.lens.signs() and the lens's seen() log
  // @meta numbers: off (The Quota, 2026-10-22): no readout of levels at all; the street names and the ways out
  // stay, and the table is told by the scene and the props
  const quiet = ((G.book && G.book.meta) || {}).numbers === "off";
  const line = (s) => h("div.small", s.count != null ? s.what : `${s.what}: ${s.level}`);
  let looking = null;
  function refresh() {
    const m = G.lens.mode(); el.hidden = m === "near"; if (m === "near") return el.replaceChildren();
    const out = [h("div.caps", m === "wide" ? "The district" : "At the table")];
    if (m === "wide") {
      for (const [id, st] of Object.entries(names().streets)) {
        out.push(btn(st.name, () => { looking = looking === id ? null : id; refresh(); }, { cls: "plain" }));
        if (looking === id && !quiet) out.push(...G.lens.look(id).map(line));
      }
    } else if (!quiet) out.push(...G.lens.signs().map(line));
    // the ways out of this lens (the area's exits): down to a household, or back out to the district
    for (const x of G.world.exits()) out.push(btn(x.label, () => G.world.enter(x.target, { spawn: x.spawnAt || null })));
    // a heading over nothing (the narrow lens with numbers off and no way out, as at the witness's table) is not
    // shown: the table is told by the scene and the plate (coordinator's browser walk, 2026-10-22)
    if (out.length < 2) { el.hidden = true; return el.replaceChildren(); }
    el.replaceChildren(...out);
  }
  const offs = [G.on("area", refresh), G.on("community.rule", () => { if (!el.hidden) refresh(); })];
  refresh();
  return { el, refresh, stop: () => offs.forEach((f) => f()) };
}
