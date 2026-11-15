// The layers panel: the stack top to bottom, under group headers (a group shows, hides and fades its
// layers together); each row has visibility, opacity, kind and author; a glaze shows its mode; a mask
// says which layer it clips and can be picked as the active layer to paint (its clip is then tinted on the
// canvas). Below: add, move, delete, the active layer's group and glaze mode, and which mood shows.
import { el, button, select } from "./dom.mjs";
import { moodsOf } from "../core/variants.mjs";

function row(app, ops, d, L) {
  const tgt = L.kind === "mask" ? d.layers.find((t) => t.id === L.target)?.name : null;
  return el("li", { class: `${L.id === d.active ? "active" : ""}${L.locked ? " locked" : ""}`, onclick: () => { d.active = L.id; app.render(); } },
    el("input", { type: "checkbox", checked: L.visible, title: "Visible", onclick: (e) => e.stopPropagation(), onchange: () => ops.toggle(L) }),
    el("span", { class: "name" }, L.name),
    el("span", { class: "meta" }, `${L.kind}${L.kind === "glaze" ? ` (${L.blend || "glaze"})` : ""}${tgt ? `, clips ${tgt}` : ""}${L.locked ? ", locked" : ""}, ${L.author}`),
    el("input", { type: "range", min: 0, max: 1, step: 0.05, value: L.opacity, title: "Opacity", onclick: (e) => e.stopPropagation(), onchange: (e) => ops.opacity(L, +e.target.value) }));
}
function groupHead(d, ops, name) {
  const g = (d.groups ||= {})[name] ||= { visible: true, opacity: 1 };
  return el("li", { class: "group" }, el("input", { type: "checkbox", checked: g.visible !== false, title: "Group visible", onchange: () => ops.group(name, { visible: !(g.visible !== false) }) }),
    el("span", { class: "name" }, `group: ${name}`), el("span", { class: "meta" }, ""),
    el("input", { type: "range", min: 0, max: 1, step: 0.05, value: g.opacity ?? 1, title: "Group opacity", onchange: (e) => ops.group(name, { opacity: +e.target.value }) }));
}
export function layersPanel(app, ops) {
  const d = app.sitting?.doc; if (!d) return el("section", {}, el("h2", {}, "Layers"));
  const items = []; let cur = null;
  for (const L of [...d.layers].reverse()) { if (L.group && L.group !== cur) items.push(groupHead(d, ops, L.group)); cur = L.group || null; items.push(row(app, ops, d, L)); }
  const act = d.layers.find((l) => l.id === d.active); let gname = act?.group || "";
  return el("section", {}, el("h2", {}, "Layers"), el("ul", { class: "layers" }, items),
    el("div", { class: "buttons" }, button("+ Paint", () => ops.add("paint")), button("+ Glaze", () => ops.add("glaze")), button("+ Mask", () => ops.add("mask")), button("+ Form", () => ops.add("form"), "A layer of painted planes; the light-stroke brush over it takes its light from them and the key"),
      button("Up", () => ops.move(1)), button("Down", () => ops.move(-1)), button("Delete", () => ops.remove())),
    el("label", { class: "row" }, el("span", {}, "Group"), el("input", { type: "text", value: gname, placeholder: "none", oninput: (e) => (gname = e.target.value) }), button("Set", () => ops.setGroup(act, gname))),
    act?.kind === "glaze" ? select("Glaze mode", ["glaze", "multiply", "screen"], act.blend || "glaze", (v) => ops.glazeMode(act, v)) : null,
    moodsOf(d).length ? select("Show mood", ["neutral", ...moodsOf(d)], "neutral", (v) => ops.showMood(v)) : null);
}
