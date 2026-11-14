// Plain DOM helpers for the Studio's panels.
export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : String(k));
  return e;
};
export const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
// a labelled range; onInput while dragging, onChange (if given) once on release
export function slider(label, value, min, max, step, onInput, onChange = null) {
  const out = el("output", {}, String(value)), inp = el("input", { type: "range", min, max, step, value, oninput: (e) => { out.textContent = e.target.value; onInput?.(+e.target.value); }, onchange: (e) => onChange?.(+e.target.value) });
  return el("label", { class: "row" }, el("span", {}, label), inp, out);
}
export const button = (label, onclick, title = null, on = false) => el("button", { onclick, title, class: on ? "on" : null }, label);
export const select = (label, options, value, onchange) => el("label", { class: "row" }, el("span", {}, label), el("select", { onchange: (e) => onchange(e.target.value) }, options.map((o) => el("option", { value: o, selected: o === value }, o))));
