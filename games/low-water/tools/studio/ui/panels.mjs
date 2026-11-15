// The Studio's side panels: the sitter (person, age and era record, camera, the sitter's turn, the key)
// and the palette. The brush, layers and blend panels have their own files. Each panel redraws itself from the app
// state when render() is called; inputs write straight back into that state.
import { MOODS, CAM, KEY } from "../core/sitter.mjs";
import { mixSwatch } from "../core/palette.mjs";

import { el, hex, slider, button } from "./dom.mjs";
export { el, slider, button };

export function sitterPanel(app, act) {
  const p = app.form || (app.form = { who: "ned", cam: { ...CAM }, key: { ...KEY }, w: 768, h: 960, mood: "warm" });
  const opts = app.cast.people.flatMap((g) => g.records.map((r) => el("option", { value: r.key, selected: r.key === p.who }, `${g.person}: era ${r.era}${r.age ? `, ${r.age}` : ""}`)));
  return el("section", {}, el("h2", {}, "Sitter"),
    el("label", { class: "row" }, el("span", {}, "Person"), el("select", { onchange: (e) => (p.who = e.target.value) }, opts)),
    slider("Yaw", p.cam.yaw, -60, 80, 1, (v) => (p.cam.yaw = v)), slider("Turn", p.cam.turn ?? -32, -70, 70, 1, (v) => (p.cam.turn = v)), slider("Tilt", p.cam.elev, -15, 25, 1, (v) => (p.cam.elev = v)),
    slider("Frame (m)", p.cam.height, 0.4, 1.2, 0.02, (v) => (p.cam.height = v)),
    slider("Key around", p.key.az, -90, 90, 1, (v) => (p.key.az = v)), slider("Key height", p.key.el, -10, 60, 1, (v) => (p.key.el = v)),
    el("label", { class: "row" }, el("span", {}, "Key from scene"), el("input", { type: "text", placeholder: "x, y, z, facing", onchange: (e) => act.sceneLight(app, e.target.value) })),
    el("div", { class: "buttons" }, button("New sitting", () => act.sitNew(app, p)),
      button("Carry paint here", () => act.carryTo(app, { who: p.who, cam: { ...p.cam }, key: { ...p.key } }), "Re-render with these settings and replay the painting through the form")),
    el("label", { class: "row" }, el("span", {}, "Mood"), el("select", { onchange: (e) => (p.mood = e.target.value) }, Object.keys(MOODS).filter((m) => m !== "neutral").map((m) => el("option", { selected: m === p.mood }, m)))),
    el("div", { class: "buttons" }, button("Add mood override", () => act.addMood(app, p.mood))));
}

export function palettePanel(app) {
  const pal = app.sitting?.palette || [], m = app.mixer || (app.mixer = { a: 0, b: 1, t: 0 });
  const pick = (k) => (e) => { if (e.shiftKey) m.b = k; else m.a = k; app.setColour(pal[m.a] ? mixSwatch(pal[m.a].c, pal[m.b]?.c || pal[m.a].c, m.t) : app.brush.colour); };
  return el("section", {}, el("h2", {}, "Palette"), el("p", { class: "hint" }, "Click a mix; Shift-click a second; the slider mixes them as pigment. Alt-click the canvas to pick."),
    el("div", { class: "swatches" }, pal.map((s, k) => el("button", { class: `sw${k === m.a ? " a" : ""}${k === m.b ? " b" : ""}`, title: `${s.name}, value ${s.v}`, style: `background:${hex(s.c)}`, onclick: pick(k) }))),
    slider("Mix", m.t, 0, 1, 0.05, (v) => { m.t = v; if (pal[m.a]) app.setColour(mixSwatch(pal[m.a].c, pal[m.b]?.c || pal[m.a].c, v)); }),
    el("div", { class: "row" }, el("span", {}, "Loaded"), el("i", { class: "chip", style: `background:${hex(app.brush.colour)}` }), el("output", {}, `value ${(0.2126 * app.brush.colour[0] + 0.7152 * app.brush.colour[1] + 0.0722 * app.brush.colour[2]).toFixed(2)}`)));
}
