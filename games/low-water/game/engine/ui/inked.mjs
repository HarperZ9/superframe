// The inked Margin page and the chapter page (design/UI-SYSTEM.md 7.2; clean-room DIALOGUE-AND-VOICES
// proposal 4: "when a Margin note inks, Lamb writes a short page in the Daybook"). Owned by the UI
// and UX lead. When a pencilled note inks (G event trait.done, not granted at creation), a Daybook
// leaf slides in at the top right: the note's name in ink, the page Lamb writes (the trait's
// `done:` text, else its `about:`), what it now does and when it works, in words. A chapter page
// (a gate's page that is every fourth, G event gate with pages and the sheet's count) gets the same
// leaf with its own words. Leaves wait for a quiet moment: never over a fight, a sneak or a run, and
// never while another leaf is open. Enter, A, Esc or B, or a click puts the leaf in the book; it
// never blocks for long and the world keeps its place behind it.
//   const I = inkedPages(ctx)   I.stop()   I.show({ title, kind, text, lines })   (tests)
import { h, btn } from "./dom.mjs";
import { modText } from "./tabs-a.mjs";
import { glyph } from "./bindings.mjs";

export function inkedPages(ctx) {
  const G = ctx.G, queue = [];
  let open = null, timer = 0;
  const busy = () => { const t = ctx.F.top(); return !t || t.name !== "play" || document.querySelector(".fightlayer"); };
  function pump() {
    clearTimeout(timer);
    if (open || !queue.length) return;
    if (busy()) { timer = setTimeout(pump, 500); return; }
    show(queue.shift());
  }
  function show(leaf) {
    const keep = btn(["Into the book", glyph("confirm")], close, { cls: "btn go" });
    const el = h(`div.leaf.sheet.${leaf.kind || "ink"}`, { role: "dialog", "aria-label": leaf.title },
      h("div.caps.quiet", leaf.kind === "chapter" ? "A chapter page" : "Inked in the margin"),
      h("h3.ltitle", leaf.title),
      leaf.text ? h("p.ltext", leaf.text) : null,
      leaf.lines && leaf.lines.length ? h("ul.llines", ...leaf.lines.map((l) => h("li", l))) : null,
      keep);
    ctx.stage.append(el);
    const layer = ctx.F.push({ name: "leaf", root: el, onBack: close, onAction: (a) => (a === "confirm" ? (close(), true) : false) });
    open = { el, layer };
    function close() {
      if (!open || open.el !== el) return;
      ctx.F.pop(layer); el.classList.add("going"); setTimeout(() => el.remove(), 160); open = null;
      setTimeout(pump, 300);
    }
    return { close };
  }
  const offs = [
    G.on("trait.done", (d) => {
      if (d.granted) return;
      const t = (G.rs.traits || {})[d.id] || {};
      const lines = (t.mods || []).map((m) => modText(G, m));
      queue.push({ kind: "ink", title: t.name || d.name, text: t.done || t.about || "", lines }); pump();
    }),
    G.on("chapter", (d) => { // the engine's chapter page, when it pays one (SYSTEMS-FULL 19.4)
      queue.push({ kind: "chapter", title: d.name || "A chapter page", text: "Every fourth page is a chapter page. It raises one compartment by one: the case grows, and so does what it does in a fight.", lines: ["Spend it on the Build page in the Daybook."] }); pump();
    }),
  ];
  return { show: (leaf) => { queue.push(leaf); pump(); }, stop: () => { for (const o of offs) o(); clearTimeout(timer); if (open) open.el.remove(); } };
}
