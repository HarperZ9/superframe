// Small DOM helpers shared by every panel.
//   h("div.sheet.menu", { onclick }, child, "text", [more])   element with classes, props, children
//   btn("New game", fn, { key: "N" })                           a focusable button
export function h(tag, props = {}, ...kids) {
  if (props == null || typeof props !== "object" || props instanceof Node || Array.isArray(props)) { kids.unshift(props); props = {}; }
  const [name, ...cls] = tag.split(".");
  const el = document.createElement(name || "div");
  if (cls.length) el.className = cls.join(" ");
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  add(el, kids);
  return el;
}

function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

// A focusable control. disabled keeps it focusable (to read why) but inert.
export function btn(label, fn, { cls = "btn", key = "", disabled = false, title = "" } = {}) {
  const b = h(`button.f.${cls.split(" ").join(".")}`, { type: "button", title: title || null }, label, key ? h("span.k", key) : null);
  if (disabled) b.setAttribute("aria-disabled", "true");
  b.addEventListener("click", (e) => { if (b.getAttribute("aria-disabled") === "true") return; fn(e); });
  return b;
}

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

// Minutes on the night's clock as hh:mm.
export function clockText(min) {
  const m = Math.floor(min) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
export const pct = (p) => `${Math.round(p * 100)}%`;

// Browser storage that never throws (private windows and blocked storage just forget).
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { console.warn(`storage: could not read ${k}: ${e.message}`); return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(`storage: could not write ${k}: ${e.message}`); } },
};

// Short-lived notes at the top of the screen for what the night does.
export function toast(kind, text, ms = 3200) {
  const box = document.getElementById("toasts"); if (!box) return;
  const t = h("div.toast.fade-in", h("span.caps", kind), text);
  box.append(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.remove(), ms);
}
